import { Check, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Bars, Lines } from '../components/Charts';
import { Card, Empty, Progress, Stat, useEditor } from '../components/ui';
import { useSettings, useTable } from '../lib/db';
import { netWorth } from '../lib/finance';
import { useTxEditor } from '../lib/txEditor';
import { diaryFields, noteFields, todoFields, weightFields } from '../lib/forms';
import { habitRate, toggleHabit, toggleTodo } from '../lib/habits';
import { addDays, fmtDate, fmtMin, lastDays, lastMonths, md, sum, thisMonth, today, weekStart, won } from '../lib/util';
import { useEventEditor } from './Plan';

export default function Home() {
  const s = useSettings();
  const txs = useTable('transactions');
  const budgets = useTable('budgets');
  const accounts = useTable('accounts');
  const investments = useTable('investments');
  const snaps = useTable('net_worth_snapshots');
  const diary = useTable('diary');
  const todos = useTable('todos');
  const goals = useTable('goals');
  const habits = useTable('habits');
  const checks = useTable('habit_checks');
  const events = useTable('events');
  const books = useTable('books');
  const readLogs = useTable('reading_logs');
  const studyLogs = useTable('study_logs');
  const weights = useTable('weights');
  const workouts = useTable('workouts');

  const t = today(), m = thisMonth(), ws = weekStart(t), year = t.slice(0, 4);
  const txEd = useTxEditor();
  const diaryEd = useEditor('diary', '일기', diaryFields);
  const noteEd = useEditor('notes', '메모', noteFields);
  const todoEd = useEditor('todos', '할 일', todoFields(goals), { defaults: () => ({ done: false, due: t }) });
  const weightEd = useEditor('weights', '체중', weightFields, { defaults: () => ({ date: t }) });
  const eventEd = useEventEditor(() => ({ date: t }));

  const monthTx = txs.filter((x) => (x.date || '').startsWith(m));
  const expense = sum(monthTx.filter((x) => x.type === 'expense'), (x) => x.amount);
  const income = sum(monthTx.filter((x) => x.type === 'income'), (x) => x.amount);
  const saving = sum(monthTx.filter((x) => x.type === 'saving'), (x) => x.amount);
  const budget = sum(budgets.filter((b) => s.expenseCats.includes(b.category)), (b) => b.amount);
  const todayTodos = todos.filter((x) => (!x.done && (!x.due || x.due <= t)) || (x.done && x.done_at === t));
  const activeHabits = habits.filter((h) => h.active !== false);
  const todayEvents = events.filter((e) => e.date === t).sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
  const upcoming = events.filter((e) => e.date > t && e.date <= addDays(t, 7)).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
  const { net } = netWorth(accounts, investments);
  const rate7 = habitRate(habits, checks, addDays(t, -6), t);
  const lastWeight = [...weights].sort((a, b) => a.date.localeCompare(b.date)).pop();

  const flow = lastMonths(6).map((mm) => {
    const r = txs.filter((x) => (x.date || '').startsWith(mm));
    return { m: Number(mm.slice(5)) + '월', 수입: sum(r.filter((x) => x.type === 'income'), (x) => x.amount), 지출: sum(r.filter((x) => x.type === 'expense'), (x) => x.amount) };
  });
  const worth = [...snaps].sort((a, b) => a.month.localeCompare(b.month)).slice(-12).map((x) => ({ m: x.month.slice(2).replace('-', '.'), 순자산: Number(x.assets) - Number(x.debts) }));
  const study = lastDays(14).map((d) => ({ d: md(d), 공부: sum(studyLogs.filter((l) => l.date === d), (l) => l.minutes), }));
  const pages = lastDays(14).map((d) => ({ d: md(d), 쪽: sum(readLogs.filter((l) => l.date === d), (l) => l.pages) }));
  const weightData = [...weights].sort((a, b) => a.date.localeCompare(b.date)).slice(-30).map((w) => ({ d: md(w.date), kg: Number(w.kg) }));

  return (
    <>
      <div className="page-head"><div><h1>{fmtDate(t)}</h1><p className="muted small">오늘 할 일과 기록을 한눈에 봅니다.</p></div></div>
      <div className="row">
        <button className="btn" onClick={() => txEd.open()}><Plus size={16} />지출·수입·저축</button>
        <button className="btn ghost" onClick={() => diaryEd.open(diary.find((d) => d.date === t) || { date: t })}>일기</button>
        <button className="btn ghost" onClick={() => todoEd.open()}>할 일</button>
        <button className="btn ghost" onClick={() => eventEd.open()}>일정</button>
        <button className="btn ghost" onClick={() => noteEd.open()}>메모</button>
        <button className="btn ghost" onClick={() => weightEd.open()}>체중</button>
      </div>

      <div className="grid2">
        <Card title="오늘 할 일" action={<Link className="small" to="/plan">계획 열기</Link>}>
          {!todayTodos.length && <Empty>오늘 할 일이 없습니다. 위의 할 일 버튼으로 추가하세요.</Empty>}
          <ul className="list">
            {todayTodos.slice(0, 8).map((x) => (
              <li key={x.id}>
                <button className={'check' + (x.done ? ' on' : '')} onClick={() => toggleTodo(x)} aria-label="완료 표시">{x.done && <Check size={14} />}</button>
                <div className="body"><span className={x.done ? 'done' : ''}>{x.title}</span>{x.due && x.due < t && !x.done && <span className="sub neg">{fmtDate(x.due)} 기한 지남</span>}</div>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="오늘 습관" action={rate7 !== null ? <span className="small muted">7일 달성률 {Math.round(rate7 * 100)}%</span> : undefined}>
          {!activeHabits.length && <Empty>계획 메뉴의 습관 탭에서 매일 지킬 습관을 추가하세요.</Empty>}
          <ul className="list">
            {activeHabits.map((h) => {
              const on = checks.some((c) => c.habit_id === h.id && c.date === t);
              return (
                <li key={h.id}>
                  <button className={'check' + (on ? ' on' : '')} onClick={() => toggleHabit(h.id, t)} aria-label={`${h.name} 체크`}>{on && <Check size={14} />}</button>
                  <div className="body"><span className={on ? 'done' : ''}>{h.name}</span></div>
                </li>
              );
            })}
          </ul>
        </Card>
        <Card title="일정">
          {!todayEvents.length && !upcoming.length && <Empty>오늘과 앞으로 7일 동안 일정이 없습니다.</Empty>}
          <ul className="list">
            {todayEvents.map((e) => <li key={e.id}><span className="tag">오늘 {e.start_time || ''}</span><div className="body"><span>{e.title}</span></div></li>)}
            {upcoming.map((e) => <li key={e.id}><span className="tag">{md(e.date)} {e.start_time || ''}</span><div className="body"><span className="muted">{e.title}</span></div></li>)}
          </ul>
        </Card>
        <Card title="이번 달 지출" action={<Link className="small" to="/finance">가계부 열기</Link>}>
          <div className="row"><b className="timer">{won(expense)}</b>{budget > 0 && <span className="muted small">/ 예산 {won(budget)}</span>}</div>
          {budget > 0 && <Progress value={expense} max={budget} over={expense > budget} />}
          <p className="small muted">
            {budget > 0 ? (expense > budget ? `예산을 ${won(expense - budget)} 넘었습니다.` : `예산이 ${won(budget - expense)} 남았습니다.`) : '경제 메뉴의 예산 탭에서 월 예산을 정할 수 있습니다.'}
            {' '}오늘 쓴 돈 {won(sum(monthTx.filter((x) => x.date === t && x.type === 'expense'), (x) => x.amount))}
          </p>
        </Card>
      </div>

      <h2>전체 통계</h2>
      <div className="tiles">
        <Stat label="순자산" value={won(net)} />
        <Stat label="이번 달 수입" value={won(income)} tone="pos" />
        <Stat label="이번 달 지출" value={won(expense)} tone="neg" />
        <Stat label="이번 달 저축" value={won(saving)} sub={income ? `저축률 ${Math.round((saving / income) * 100)}%` : undefined} />
        <Stat label={`${year}년 완독`} value={`${books.filter((b) => b.status === '완독' && (b.finished || '').startsWith(year)).length}권`} />
        <Stat label="이번 주 공부" value={fmtMin(sum(studyLogs.filter((l) => l.date >= ws), (l) => l.minutes))} />
        <Stat label="이번 주 운동" value={`${workouts.filter((w) => w.date >= ws).length}회`} />
        <Stat label="이번 달 일기" value={`${diary.filter((d) => (d.date || '').startsWith(m)).length}일`} />
        <Stat label="체중" value={lastWeight ? `${lastWeight.kg}kg` : '-'} />
      </div>
      <div className="grid2">
        <Card title="최근 6개월 수입과 지출">
          <Bars data={flow} x="m" fmt={won} series={[{ key: '수입', name: '수입', color: 'var(--pos)' }, { key: '지출', name: '지출', color: 'var(--neg)' }]} />
        </Card>
        <Card title="순자산 추이">
          {worth.length > 1 ? <Lines data={worth} x="m" fmt={won} series={[{ key: '순자산', name: '순자산' }]} /> : <Empty>경제 메뉴의 자산 탭에 잔액을 적으면 매달 기록됩니다.</Empty>}
        </Card>
        <Card title="최근 14일 공부 시간"><Bars data={study} x="d" fmt={fmtMin} series={[{ key: '공부', name: '공부 시간' }]} /></Card>
        <Card title="최근 14일 읽은 쪽수"><Bars data={pages} x="d" fmt={(n) => n + '쪽'} series={[{ key: '쪽', name: '읽은 쪽수', color: '#3f7f6b' }]} /></Card>
        <Card title="체중 변화">
          {weightData.length > 1 ? <Lines data={weightData} x="d" fmt={(n) => n + 'kg'} series={[{ key: 'kg', name: '체중' }]} target={s.targetWeight} /> : <Empty>체중을 두 번 이상 기록하면 그래프가 그려집니다.</Empty>}
        </Card>
      </div>
      {txEd.modal}{diaryEd.modal}{noteEd.modal}{todoEd.modal}{weightEd.modal}{eventEd.modal}
    </>
  );
}
