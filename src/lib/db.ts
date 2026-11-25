import { createClient } from '@supabase/supabase-js';
import { useEffect, useSyncExternalStore } from 'react';

export type Row = { id: string; [k: string]: any };

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase = url && key ? createClient(url, key, { auth: { flowType: 'pkce' } }) : null;
/** Supabase 설정이 없으면 체험 모드: 이 기기의 브라우저에만 저장한다 */
export const isLocal = !supabase;

export const TABLES = [
  'transactions', 'budgets', 'recurring', 'accounts', 'net_worth_snapshots', 'investments',
  'diary', 'notes', 'books', 'book_quotes', 'reading_logs',
  'study_subjects', 'study_materials', 'study_logs',
  'hobbies', 'hobby_logs', 'media',
  'weights', 'workouts', 'sleeps', 'meals', 'waters',
  'events', 'todos', 'habits', 'habit_checks', 'goals', 'settings',
];

const EMPTY: Row[] = [];
let cache: Record<string, Row[]> = {};
let pending: Record<string, Promise<Row[]>> = {};
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};

// ---- 알림 ----
let toastSubs = new Set<(m: string) => void>();
export const notify = (m: string) => toastSubs.forEach((f) => f(m));
export const onNotify = (f: (m: string) => void) => {
  toastSubs.add(f);
  return () => { toastSubs.delete(f); };
};

async function fetchAll(table: string): Promise<Row[]> {
  if (!supabase) return JSON.parse(localStorage.getItem('ml:' + table) || '[]');
  const out: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select('*').order('created_at').range(from, from + 999);
    if (error) throw error;
    out.push(...(data as Row[]));
    if (data.length < 1000) break;
  }
  return out;
}

export function load(table: string): Promise<Row[]> {
  if (cache[table]) return Promise.resolve(cache[table]);
  return (pending[table] ??= fetchAll(table)
    .catch((e) => {
      notify(`불러오지 못했습니다: ${e.message || e}`);
      return [] as Row[];
    })
    .then((rows) => {
      cache[table] = rows;
      delete pending[table];
      emit();
      return rows;
    }));
}

export const getRows = (table: string) => cache[table] ?? EMPTY;
export const isLoaded = (table: string) => !!cache[table];

export function useTable(table: string): Row[] {
  const rows = useSyncExternalStore(subscribe, () => cache[table] ?? EMPTY);
  useEffect(() => { load(table); }, [table]);
  return rows;
}

function set(table: string, rows: Row[]) {
  cache[table] = rows;
  if (!supabase) {
    try {
      localStorage.setItem('ml:' + table, JSON.stringify(rows));
    } catch {
      notify('이 기기의 저장 공간이 가득 찼습니다. 사진을 줄여 주세요.');
    }
  }
  emit();
}

async function persist(table: string, op: () => PromiseLike<{ error: any }>) {
  if (!supabase) return;
  const { error } = await op();
  if (error) {
    notify(`저장하지 못했습니다: ${error.message}`);
    delete cache[table];
    await load(table);
  }
}

export async function add(table: string, values: Record<string, any>): Promise<Row> {
  await load(table);
  const row: Row = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...values };
  set(table, [...cache[table], row]);
  await persist(table, () => supabase!.from(table).insert(row));
  return row;
}

export async function update(table: string, id: string, patch: Record<string, any>) {
  await load(table);
  const { id: _i, user_id: _u, created_at: _c, ...clean } = patch;
  set(table, cache[table].map((r) => (r.id === id ? { ...r, ...clean } : r)));
  await persist(table, () => supabase!.from(table).update(clean).eq('id', id));
}

export async function remove(table: string, id: string) {
  await load(table);
  set(table, cache[table].filter((r) => r.id !== id));
  await persist(table, () => supabase!.from(table).delete().eq('id', id));
}

export function clearCache() {
  cache = {};
  pending = {};
  emit();
}

// ---- 설정 (key/value) ----
export const DEFAULT_SETTINGS = {
  expenseCats: ['식비', '교통', '주거', '통신', '생활', '의료', '문화', '쇼핑', '교육', '경조사', '기타'],
  incomeCats: ['월급', '부수입', '용돈', '이자', '기타'],
  methods: ['카드', '현금', '계좌이체', '간편결제'],
  targetWeight: null as number | null,
  waterGoal: 2000,
};
export type Settings = typeof DEFAULT_SETTINGS;

export function useSettings(): Settings {
  const rows = useTable('settings');
  const s: any = { ...DEFAULT_SETTINGS };
  for (const r of rows) if (r.key in s && r.value !== null && r.value !== undefined) s[r.key] = r.value;
  return s;
}

export async function setSetting(k: keyof Settings, value: any) {
  const rows = await load('settings');
  const cur = rows.find((r) => r.key === k);
  if (cur) await update('settings', cur.id, { value });
  else await add('settings', { key: k, value });
}
