export const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => ymd(new Date());
export const thisMonth = () => today().slice(0, 7);
export const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d || 1);
};
export const addDays = (s: string, n: number) => {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
};
export const addMonths = (m: string, n: number) => {
  const d = parse(m + '-01');
  d.setMonth(d.getMonth() + n);
  return ymd(d).slice(0, 7);
};
export const daysIn = (m: string) => {
  const d = parse(m + '-01');
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
};
export const lastDays = (n: number, end = today()) => Array.from({ length: n }, (_, i) => addDays(end, i - n + 1));
export const lastMonths = (n: number) => Array.from({ length: n }, (_, i) => addMonths(thisMonth(), i - n + 1));
/** 월요일 시작 */
export const weekStart = (s: string) => addDays(s, -((parse(s).getDay() + 6) % 7));
export const won = (n: any) => Math.round(Number(n) || 0).toLocaleString('ko-KR') + '원';
export const num = (n: any) => (Number(n) || 0).toLocaleString('ko-KR');
export const fmtMin = (m: any) => {
  m = Math.round(Number(m) || 0);
  const h = Math.floor(m / 60), r = m % 60;
  return h ? (r ? `${h}시간 ${r}분` : `${h}시간`) : `${r}분`;
};
export const sum = (rows: any[], f: (r: any) => any) => rows.reduce((a, r) => a + (Number(f(r)) || 0), 0);
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
export const fmtDate = (s: string) => {
  if (!s) return '';
  const d = parse(s);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW[d.getDay()]})`;
};
export const fmtMonth = (m: string) => `${m.slice(0, 4)}년 ${Number(m.slice(5, 7))}월`;
export const md = (s: string) => `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}`;
/** 잠든 시각과 일어난 시각(HH:MM)으로 수면 시간(시간 단위) 계산 */
export const sleepHours = (bed?: string, wake?: string) => {
  if (!bed || !wake) return 0;
  const [bh, bm] = bed.split(':').map(Number), [wh, wm] = wake.split(':').map(Number);
  let mins = wh * 60 + wm - (bh * 60 + bm);
  if (mins <= 0) mins += 24 * 60;
  return Math.round((mins / 60) * 10) / 10;
};
export const byDateDesc = (a: any, b: any) =>
  (b.date || '').localeCompare(a.date || '') || (b.created_at || '').localeCompare(a.created_at || '');
export const MOODS = ['', '매우 나쁨', '나쁨', '보통', '좋음', '매우 좋음'];
