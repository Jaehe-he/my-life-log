import { getRows } from './db';
import { habitRate } from './habits';
import { fmtMin, sleepHours, sum, won } from './util';

export type Metric = { label: string; value: number | null; fmt: (n: number) => string; goodUp?: boolean };

/** from~to(포함) 기간의 영역별 요약 수치. 호출하는 화면이 필요한 표를 useTable로 불러 둬야 한다 */
export function metrics(from: string, to: string): Metric[] {
  const inR = (t: string, k = 'date') => getRows(t).filter((r) => r[k] && r[k] >= from && r[k] <= to);
  const tx = inR('transactions');
  const income = sum(tx.filter((t) => t.type === 'income'), (t) => t.amount);
  const expense = sum(tx.filter((t) => t.type === 'expense'), (t) => t.amount);
  const saving = sum(tx.filter((t) => t.type === 'saving'), (t) => t.amount);
  const sleeps = inR('sleeps');
  const moods = inR('diary').filter((d) => d.mood);
  const avg = (rows: any[], f: (r: any) => number) => (rows.length ? sum(rows, f) / rows.length : null);
  const one = (n: number) => n.toFixed(1);
  return [
    { label: '지출', value: expense, fmt: won, goodUp: false },
    { label: '수입', value: income, fmt: won, goodUp: true },
    { label: '저축', value: saving, fmt: won, goodUp: true },
    { label: '저축률', value: income ? (saving / income) * 100 : null, fmt: (n) => Math.round(n) + '%', goodUp: true },
    { label: '읽은 쪽수', value: sum(inR('reading_logs'), (l) => l.pages), fmt: (n) => n + '쪽', goodUp: true },
    { label: '완독한 책', value: inR('books', 'finished').filter((b) => b.status === '완독').length, fmt: (n) => n + '권', goodUp: true },
    { label: '공부 시간', value: sum(inR('study_logs'), (l) => l.minutes), fmt: fmtMin, goodUp: true },
    { label: '취미 활동', value: inR('hobby_logs').length, fmt: (n) => n + '회', goodUp: true },
    { label: '운동', value: inR('workouts').length, fmt: (n) => n + '회', goodUp: true },
    { label: '평균 수면', value: avg(sleeps, (s) => sleepHours(s.bed_time, s.wake_time)), fmt: (n) => one(n) + '시간', goodUp: true },
    { label: '평균 기분 (5점)', value: avg(moods, (d) => d.mood), fmt: one, goodUp: true },
    { label: '일기 쓴 날', value: inR('diary').length, fmt: (n) => n + '일', goodUp: true },
    { label: '습관 달성률', value: (() => { const r = habitRate(getRows('habits'), getRows('habit_checks'), from, to); return r === null ? null : r * 100; })(), fmt: (n) => Math.round(n) + '%', goodUp: true },
    { label: '끝낸 할 일', value: inR('todos', 'done_at').filter((t) => t.done).length, fmt: (n) => n + '개', goodUp: true },
  ];
}

export const REPORT_TABLES = ['transactions', 'reading_logs', 'books', 'study_logs', 'hobby_logs', 'workouts', 'sleeps', 'diary', 'habits', 'habit_checks', 'todos'];
