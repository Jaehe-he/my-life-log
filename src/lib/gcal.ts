import { supabase } from './db';
import { addDays, daysIn } from './util';

const KEY = 'ml:gtoken';
const SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

/** 로그인 직후에만 받을 수 있는 구글 토큰을 보관한다 (약 1시간 유효) */
export function saveGoogleToken(token?: string | null) {
  if (token) localStorage.setItem(KEY, JSON.stringify({ token, exp: Date.now() + 55 * 60 * 1000 }));
}
export function clearGoogleToken() {
  localStorage.removeItem(KEY);
}
function token(): string | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    return v && v.exp > Date.now() ? v.token : null;
  } catch {
    return null;
  }
}
export const gcalConnected = () => !!token();

export function googleSignIn() {
  return supabase!.auth.signInWithOAuth({
    provider: 'google',
    options: { scopes: SCOPE, redirectTo: location.origin + location.pathname },
  });
}

async function call(path: string, init?: RequestInit) {
  const t = token();
  if (!t) throw new Error('구글 연결이 만료되었습니다');
  const r = await fetch(API + path, {
    ...init,
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
  });
  if (r.status === 401 || r.status === 403) {
    clearGoogleToken();
    throw new Error('구글 연결이 만료되었습니다');
  }
  if (!r.ok && r.status !== 404 && r.status !== 410) throw new Error('구글 캘린더 요청에 실패했습니다');
  return r.status === 204 || !r.ok ? null : r.json();
}

export type GEvent = { google_id: string; title: string; date: string; start_time: string | null; end_time: string | null };

export async function listMonth(month: string): Promise<GEvent[]> {
  const from = new Date(`${month}-01T00:00:00`).toISOString();
  const to = new Date(`${addDays(`${month}-${daysIn(month)}`, 1)}T00:00:00`).toISOString();
  const j = await call(`?singleEvents=true&orderBy=startTime&maxResults=250&timeMin=${encodeURIComponent(from)}&timeMax=${encodeURIComponent(to)}`);
  return (j?.items || []).map((e: any) => {
    const s = e.start?.dateTime ? new Date(e.start.dateTime) : null;
    const en = e.end?.dateTime ? new Date(e.end.dateTime) : null;
    const hm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return {
      google_id: e.id, title: e.summary || '(제목 없음)',
      date: s ? ymd(s) : e.start?.date, start_time: s ? hm(s) : null, end_time: en ? hm(en) : null,
    };
  });
}

function body(ev: any) {
  const b: any = { summary: ev.title, description: ev.memo || undefined };
  if (ev.start_time) {
    const start = new Date(`${ev.date}T${ev.start_time}`);
    const end = ev.end_time ? new Date(`${ev.date}T${ev.end_time}`) : new Date(start.getTime() + 3600000);
    b.start = { dateTime: start.toISOString() };
    b.end = { dateTime: (end > start ? end : new Date(start.getTime() + 3600000)).toISOString() };
  } else {
    b.start = { date: ev.date };
    b.end = { date: addDays(ev.date, 1) };
  }
  return b;
}

/** 앱 일정을 구글 캘린더에 만들거나 고친다. 구글 일정 id를 돌려준다 */
export async function pushEvent(ev: any): Promise<string | null> {
  if (ev.google_id) {
    const j = await call('/' + ev.google_id, { method: 'PATCH', body: JSON.stringify(body(ev)) });
    if (j) return j.id;
  }
  const j = await call('', { method: 'POST', body: JSON.stringify(body(ev)) });
  return j?.id || null;
}

export async function deleteEvent(googleId: string) {
  await call('/' + googleId, { method: 'DELETE' });
}
