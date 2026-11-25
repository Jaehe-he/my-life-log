import { useEffect, useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { Card, Empty, MonthGrid, MonthNav, PageHead, Progress, Tabs, useEditor } from '../components/ui';
import { isLocal, notify, update, useTable } from '../lib/db';
import { eventFields, todoFields } from '../lib/forms';
import { deleteEvent, gcalConnected, GEvent, googleSignIn, listMonth, pushEvent } from '../lib/gcal';
import { goalProgress, habitRate, streak, toggleHabit, toggleTodo } from '../lib/habits';
import { addDays, fmtDate, lastDays, parse, thisMonth, today } from '../lib/util';

const TABS = ['캘린더', '할 일', '습관', '목표'];

export default function Plan() {
  const [tab, setTab] = useState(TABS[0]);
  return (
    <>
      <PageHead title="계획" />
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      {tab === '캘린더' && <Calendar />}
      {tab === '할 일' && <Todos />}
      {tab === '습관' && <Habits />}
      {tab === '목표' && <Goals />}
    </>
  );
}

/** 일정 저장·삭제를 구글 캘린더에도 반영한다 */
export function useEventEditor(defaults: () => Record<string, any>, onSynced?: () => void) {
  return useEditor('events', '일정', eventFields, {
    defaults,
    afterSave: async (row) => {
      if (!gcalConnected()) return;
      try {
        const gid = await pushEvent(row);
        if (gid && gid !== row.google_id) await update('events', row.id, { google_id: gid });
        onSynced?.();
      } catch (e: any) { notify(`${e.message}. 일정은 앱에 저장되었습니다.`); }
    },
    afterDelete: async (row) => {
      if (!row.google_id || !gcalConnected()) return;
      try { await deleteEvent(row.google_id); onSynced?.(); } catch (e: any) { notify(e.message); }
    },
  });
}

function Calendar() {
  const events = useTable('events');
  const todos = useTable('todos');
  const [month, setMonth] = useState(thisMonth());
  const [sel, setSel] = useState(today());
  const [gEvents, setGEvents] = useState<GEvent[]>([]);
  const [connected, setConnected] = useState(gcalConnected());
  const [nonce, setNonce] = useState(0);
  const ed = useEventEditor(() => ({ date: sel }), () => setNonce((n) => n + 1));

  useEffect(() => {
    if (!gcalConnected()) { setConnected(false); setGEvents([]); return; }
    let alive = true;
    listMonth(month).then((g) => alive && setGEvents(g)).catch(() => alive && setConnected(false));
    return () => { alive = false; };
  }, [month, nonce]);

  const mine = new Set(events.map((e) => e.google_id).filter(Boolean));
  const googleOnly = gEvents.filter((g) => !mine.has(g.google_id));
  const dayItems = (d: string): any[] => ([
    ...events.filter((e) => e.date === d).map((e) => ({ ...e, src: 'app' })),
    ...googleOnly.filter((g) => g.date === d).map((g) => ({ ...g, id: g.google_id, src: 'google' })),
  ] as any[]).sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
  const unsynced = events.filter((e) => !e.google_id && e.date >= today());
  const syncAll = async () => {
    try {
      for (const e of unsynced) {
        const gid = await pushEvent(e);
        if (gid) await update('events', e.id, { google_id: gid });
      }
      setNonce((n) => n + 1);
      notify(`${unsynced.length}개 일정을 구글 캘린더에 보냈습니다.`);
    } catch (e: any) { notify(e.message); setConnected(false); }
  };
  return (
    <>
      <div className="row">
        <MonthNav month={month} onChange={setMonth} />
        <span className="grow" />
        <button className="btn" onClick={() => ed.open()}><Plus size={16} />일정 추가</button>
      </div>
      {!isLocal && !connected && (
        <div className="banner row">
          <span className="grow">구글 캘린더 연결이 만료되었습니다. 다시 연결하면 일정이 구글 캘린더와 함께 움직입니다.</span>
          <button className="btn small" onClick={() => googleSignIn()}>구글 다시 연결</button>
        </div>
      )}
      {connected && unsynced.length > 0 && (
        <div className="banner row">
          <span className="grow">아직 구글 캘린더에 없는 일정이 {unsynced.length}개 있습니다.</span>
          <button className="btn small" onClick={syncAll}>지금 보내기</button>
        </div>
      )}
      {isLocal && <p className="small muted">체험 모드에서는 구글 캘린더와 연결되지 않습니다.</p>}
      <div className="grid2">
        <Card>
          <MonthGrid month={month} selected={sel} onPick={setSel} render={(d) => {
            const items = dayItems(d);
            const due = todos.filter((t) => t.due === d && !t.done).length;
            return (
              <>
                {items.slice(0, 2).map((e) => <span key={e.id} className={'cal-ev' + (e.src === 'google' ? ' g' : '')}>{e.title}</span>)}
                {items.length > 2 && <span className="cal-ev g">+{items.length - 2}</span>}
                {due > 0 && <span className="cal-ev g">할 일 {due}</span>}
              </>
            );
          }} />
        </Card>
        <Card title={fmtDate(sel)} action={<button className="btn ghost small" onClick={() => ed.open({ date: sel })}><Plus size={14} />이 날 일정</button>}>
          {!dayItems(sel).length && <Empty>이 날은 일정이 없습니다.</Empty>}
          <ul className="list">
            {dayItems(sel).map((e) => (
              <li key={e.id} className={e.src === 'app' ? 'click' : ''} onClick={() => e.src === 'app' && ed.open(events.find((x) => x.id === e.id))}>
                <span className="tag">{e.start_time ? `${e.start_time}${e.end_time ? '~' + e.end_time : ''}` : '하루 종일'}</span>
                <div className="body"><span>{e.title}</span><span className="sub">{e.src === 'google' ? '구글 캘린더에서 만든 일정 (구글에서 고칠 수 있습니다)' : e.memo}</span></div>
              </li>
            ))}
          </ul>
          {todos.filter((t) => t.due === sel).map((t) => (
            <div key={t.id} className="row" style={{ flexWrap: 'nowrap' }}>
              <button className={'check' + (t.done ? ' on' : '')} onClick={() => toggleTodo(t)} aria-label="완료 표시">{t.done && <Check size={14} />}</button>
              <span className={t.done ? 'done' : ''}>{t.title}</span>
            </div>
          ))}
        </Card>
      </div>
      {ed.modal}
    </>
  );
}

function Todos() {
  const todos = useTable('todos');
  const goals = useTable('goals');
  const ed = useEditor('todos', '할 일', todoFields(goals), { defaults: () => ({ done: false }) });
  const t = today();
  const open = todos.filter((x) => !x.done).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
  const done = todos.filter((x) => x.done).sort((a, b) => (b.done_at || '').localeCompare(a.done_at || '')).slice(0, 30);
  const Item = ({ x }: { x: any }) => (
    <li>
      <button className={'check' + (x.done ? ' on' : '')} onClick={() => toggleTodo(x)} aria-label="완료 표시">{x.done && <Check size={14} />}</button>
      <div className="body click" onClick={() => ed.open(x)}>
        <span className={x.done ? 'done' : ''}>{x.title}</span>
        <span className={'sub' + (!x.done && x.due && x.due < t ? ' neg' : '')}>
          {[x.due && (x.due < t && !x.done ? `${fmtDate(x.due)} 기한 지남` : fmtDate(x.due)), goals.find((g) => g.id === x.goal_id)?.title].filter(Boolean).join(' · ')}
        </span>
      </div>
    </li>
  );
  return (
    <>
      <div className="row"><span className="grow" /><button className="btn" onClick={() => ed.open()}><Plus size={16} />할 일 추가</button></div>
      <Card title={`남은 일 ${open.length}개`}>
        {!open.length && <Empty>남은 할 일이 없습니다.</Empty>}
        <ul className="list">{open.map((x) => <Item key={x.id} x={x} />)}</ul>
      </Card>
      {done.length > 0 && <Card title="끝낸 일"><ul className="list">{done.map((x) => <Item key={x.id} x={x} />)}</ul></Card>}
      {ed.modal}
    </>
  );
}

function Habits() {
  const habits = useTable('habits');
  const checks = useTable('habit_checks');
  const goals = useTable('goals');
  const ed = useEditor('habits', '습관', [
    { key: 'name', label: '습관', required: true, placeholder: '예: 물 2L 마시기, 30분 걷기' },
    { key: 'goal_id', label: '연결할 목표', type: 'select', options: goals.map((g) => ({ value: g.id, label: g.title })) },
    { key: 'active', label: '사용 중 (끄면 목록에서 숨깁니다)', type: 'checkbox' },
  ], { defaults: () => ({ active: true }) });
  const days = lastDays(7);
  const dow = ['일', '월', '화', '수', '목', '금', '토'];
  const active = habits.filter((h) => h.active !== false);
  const paused = habits.filter((h) => h.active === false);
  const rate = habitRate(active, checks, addDays(today(), -6), today());
  return (
    <>
      <div className="row">
        <span className="grow muted small">{rate !== null && `최근 7일 달성률 ${Math.round(rate * 100)}%`}</span>
        <button className="btn" onClick={() => ed.open()}><Plus size={16} />습관 추가</button>
      </div>
      <Card>
        {!active.length && <Empty>매일 지키고 싶은 습관을 추가해 보세요.</Empty>}
        {active.length > 0 && (
          <div className="habit-grid">
            <span />
            {days.map((d) => <span key={d} className="hd">{dow[parse(d).getDay()]}<br />{Number(d.slice(8))}</span>)}
            {active.map((h) => (
              <FragmentRow key={h.id} h={h} days={days} checks={checks} onEdit={() => ed.open(h)} />
            ))}
          </div>
        )}
      </Card>
      {paused.length > 0 && (
        <Card title="쉬는 습관">
          <ul className="list">{paused.map((h) => <li key={h.id} className="click" onClick={() => ed.open(h)}><span className="done">{h.name}</span></li>)}</ul>
        </Card>
      )}
      {ed.modal}
    </>
  );
}

function FragmentRow({ h, days, checks, onEdit }: { h: any; days: string[]; checks: any[]; onEdit: () => void }) {
  const s = streak(h.id, checks);
  return (
    <>
      <div className="click" onClick={onEdit} style={{ minWidth: 0 }}>
        <div style={{ overflowWrap: 'anywhere' }}>{h.name}</div>
        {s > 1 && <span className="small muted">{s}일 연속</span>}
      </div>
      {days.map((d) => {
        const on = checks.some((c) => c.habit_id === h.id && c.date === d);
        return (
          <button key={d} className={'check' + (on ? ' on' : '')} style={{ width: 30, height: 30, justifySelf: 'center' }} onClick={() => toggleHabit(h.id, d)} aria-label={`${h.name} ${d}`}>
            {on && <Check size={16} />}
          </button>
        );
      })}
    </>
  );
}

function Goals() {
  const goals = useTable('goals');
  const todos = useTable('todos');
  const habits = useTable('habits');
  const checks = useTable('habit_checks');
  const ed = useEditor('goals', '목표', [
    { key: 'title', label: '목표', required: true, placeholder: '예: 올해 책 24권 읽기' },
    { key: 'deadline', label: '기한', type: 'date' },
    { key: 'memo', label: '왜 이루고 싶은가요?', type: 'textarea', rows: 3 },
    { key: 'done', label: '목표를 이뤘습니다', type: 'checkbox' },
  ]);
  const todoEd = useEditor('todos', '할 일', todoFields(goals), { defaults: () => ({ done: false }) });
  return (
    <>
      <div className="row">
        <p className="small muted grow">할 일과 습관을 목표에 연결하면 진행률이 자동으로 계산됩니다.</p>
        <button className="btn" onClick={() => ed.open()}><Plus size={16} />목표 추가</button>
      </div>
      {!goals.length && <Empty>이루고 싶은 장기 목표를 적어 보세요.</Empty>}
      <div className="grid2">
        {goals.map((g) => {
          const p = goalProgress(g, todos, habits, checks);
          const gt = todos.filter((t) => t.goal_id === g.id), gh = habits.filter((h) => h.goal_id === g.id);
          return (
            <Card key={g.id}
              title={<b className={'click' + (g.done ? ' done' : '')} style={{ color: 'var(--fg)', fontSize: 16 }} onClick={() => ed.open(g)}>{g.title}</b>}
              action={<b className="num">{Math.round(p * 100)}%</b>}>
              <Progress value={p} max={1} />
              <p className="small muted">{[g.deadline && `${fmtDate(g.deadline)}까지`, `할 일 ${gt.filter((t) => t.done).length}/${gt.length}`, `습관 ${gh.length}개`].filter(Boolean).join(' · ')}</p>
              {g.memo && <p className="small pre">{g.memo}</p>}
              <ul className="list">
                {gt.filter((t) => !t.done).slice(0, 5).map((t) => (
                  <li key={t.id}>
                    <button className="check" onClick={() => toggleTodo(t)} aria-label="완료 표시" />
                    <div className="body"><span>{t.title}</span></div>
                  </li>
                ))}
              </ul>
              <button className="btn ghost small" style={{ alignSelf: 'flex-start' }} onClick={() => todoEd.open({ goal_id: g.id })}><Plus size={14} />이 목표의 할 일</button>
            </Card>
          );
        })}
      </div>
      {ed.modal}{todoEd.modal}
    </>
  );
}
