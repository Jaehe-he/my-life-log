import { add, getRows, remove, update } from './db';
import { addDays, today } from './util';

export function toggleHabit(habitId: string, date: string) {
  const cur = getRows('habit_checks').find((c) => c.habit_id === habitId && c.date === date);
  return cur ? remove('habit_checks', cur.id) : add('habit_checks', { habit_id: habitId, date });
}

export function toggleTodo(todo: any) {
  return update('todos', todo.id, { done: !todo.done, done_at: todo.done ? null : today() });
}

/** from~to(포함) 사이 습관 달성률 0~1. 오늘 이후와 습관을 만들기 전 날짜는 세지 않는다 */
export function habitRate(habits: any[], checks: any[], from: string, to: string) {
  const end = to > today() ? today() : to;
  let possible = 0, done = 0;
  for (const h of habits) {
    if (h.active === false) continue;
    const start = (h.created_at || '').slice(0, 10);
    for (let d = from > start ? from : start; d <= end; d = addDays(d, 1)) possible++;
    done += checks.filter((c) => c.habit_id === h.id && c.date >= from && c.date <= end).length;
  }
  return possible ? Math.min(1, done / possible) : null;
}

export function streak(habitId: string, checks: any[]) {
  const set = new Set(checks.filter((c) => c.habit_id === habitId).map((c) => c.date));
  let d = today(), n = 0;
  if (!set.has(d)) d = addDays(d, -1);
  while (set.has(d)) { n++; d = addDays(d, -1); }
  return n;
}

/** 목표 진행률 0~1: 연결된 할 일 완료율과 연결된 습관의 최근 30일 달성률의 평균 */
export function goalProgress(goal: any, todos: any[], habits: any[], checks: any[]) {
  if (goal.done) return 1;
  const parts: number[] = [];
  const gt = todos.filter((t) => t.goal_id === goal.id);
  if (gt.length) parts.push(gt.filter((t) => t.done).length / gt.length);
  const gh = habits.filter((h) => h.goal_id === goal.id);
  const r = habitRate(gh, checks, addDays(today(), -29), today());
  if (r !== null) parts.push(r);
  return parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 0;
}
