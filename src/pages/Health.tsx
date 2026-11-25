import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Bars, Lines } from '../components/Charts';
import { Card, Empty, PageHead, Progress, Stat, Tabs, useEditor } from '../components/ui';
import { add, remove, update, useSettings, useTable } from '../lib/db';
import { weightFields } from '../lib/forms';
import { addDays, byDateDesc, fmtDate, fmtMin, lastDays, md, sleepHours, sum, today, weekStart } from '../lib/util';

const TABS = ['체중', '운동', '수면', '식단·물'];

export default function Health() {
  const [tab, setTab] = useState(TABS[0]);
  return (
    <>
      <PageHead title="건강" />
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      {tab === '체중' && <Weight />}
      {tab === '운동' && <Workout />}
      {tab === '수면' && <Sleep />}
      {tab === '식단·물' && <Meals />}
    </>
  );
}

function Weight() {
  const s = useSettings();
  const rows = useTable('weights');
  const ed = useEditor('weights', '체중', weightFields, { defaults: () => ({ date: today() }) });
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const last = sorted[sorted.length - 1], first = sorted[0];
  const data = sorted.slice(-60).map((r) => ({ d: md(r.date), kg: Number(r.kg) }));
  return (
    <>
      <div className="row"><span className="grow" /><button className="btn" onClick={() => ed.open()}><Plus size={16} />체중 기록</button></div>
      <div className="tiles">
        <Stat label="현재" value={last ? `${last.kg}kg` : '-'} sub={last && fmtDate(last.date)} />
        <Stat label="처음 기록보다" value={last && first !== last ? `${(last.kg - first.kg > 0 ? '+' : '') + (last.kg - first.kg).toFixed(1)}kg` : '-'} />
        <Stat label="목표 체중" value={s.targetWeight ? `${s.targetWeight}kg` : '설정에서 지정'} sub={s.targetWeight && last ? `${Math.abs(last.kg - s.targetWeight).toFixed(1)}kg 남음` : undefined} />
      </div>
      <Card title="체중 변화">
        {data.length > 1 ? <Lines data={data} x="d" series={[{ key: 'kg', name: '체중' }]} fmt={(n) => n + 'kg'} target={s.targetWeight} />
          : <Empty>두 번 이상 기록하면 그래프가 그려집니다.</Empty>}
      </Card>
      <Card title="기록">
        <ul className="list">
          {[...rows].sort(byDateDesc).slice(0, 30).map((r) => (
            <li key={r.id} className="click" onClick={() => ed.open(r)}><div className="body"><span>{fmtDate(r.date)}</span></div><span className="amt">{r.kg}kg</span></li>
          ))}
        </ul>
      </Card>
      {ed.modal}
    </>
  );
}

function Workout() {
  const rows = useTable('workouts');
  const kinds = [...new Set(['걷기', '달리기', '헬스', '수영', '자전거', '요가', '등산', ...rows.map((r) => r.kind).filter(Boolean)])];
  const ed = useEditor('workouts', '운동', [
    { key: 'date', label: '날짜', type: 'date', required: true, half: true },
    { key: 'minutes', label: '운동 시간(분)', type: 'number', half: true, step: '1' },
    { key: 'kind', label: '운동 종류 (목록에 없으면 직접 입력)', required: true, placeholder: kinds.slice(0, 5).join(', ') },
    { key: 'memo', label: '메모', type: 'textarea', rows: 2 },
  ], { defaults: () => ({ date: today() }) });
  const t = today(), ws = weekStart(t);
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(ws, (i - 7) * 7)).map((w) => ({
    w: md(w) + ' 주', 횟수: rows.filter((r) => r.date >= w && r.date < addDays(w, 7)).length,
  }));
  return (
    <>
      <div className="row"><span className="grow" /><button className="btn" onClick={() => ed.open()}><Plus size={16} />운동 기록</button></div>
      <div className="tiles">
        <Stat label="이번 주 운동" value={`${rows.filter((r) => r.date >= ws).length}회`} />
        <Stat label="이번 주 시간" value={fmtMin(sum(rows.filter((r) => r.date >= ws), (r) => r.minutes))} />
        <Stat label="이번 달 운동" value={`${rows.filter((r) => (r.date || '').startsWith(t.slice(0, 7))).length}회`} />
      </div>
      <Card title="주별 운동 횟수"><Bars data={weeks} x="w" series={[{ key: '횟수', name: '운동 횟수' }]} fmt={(n) => n + '회'} height={160} /></Card>
      <Card title="기록">
        {!rows.length && <Empty>오늘 한 운동을 기록해 보세요.</Empty>}
        <ul className="list">
          {[...rows].sort(byDateDesc).slice(0, 40).map((r) => (
            <li key={r.id} className="click" onClick={() => ed.open(r)}>
              <span className="tag">{r.kind}</span>
              <div className="body"><span>{r.memo || r.kind}</span><span className="sub">{fmtDate(r.date)}</span></div>
              <span className="amt">{r.minutes ? fmtMin(r.minutes) : ''}</span>
            </li>
          ))}
        </ul>
      </Card>
      {ed.modal}
    </>
  );
}

function Sleep() {
  const rows = useTable('sleeps');
  const ed = useEditor('sleeps', '수면', [
    { key: 'date', label: '일어난 날', type: 'date', required: true },
    { key: 'bed_time', label: '잠든 시각', type: 'time', required: true, half: true },
    { key: 'wake_time', label: '일어난 시각', type: 'time', required: true, half: true },
  ], { defaults: () => ({ date: today(), bed_time: '23:30', wake_time: '07:00' }) });
  const hrs = (r: any) => sleepHours(r.bed_time, r.wake_time);
  const days = lastDays(14).map((d) => {
    const r = rows.find((x) => x.date === d);
    return { d: md(d), 시간: r ? hrs(r) : 0 };
  });
  const recent = rows.filter((r) => r.date >= addDays(today(), -6));
  const avg = recent.length ? (sum(recent, hrs) / recent.length).toFixed(1) : null;
  return (
    <>
      <div className="row"><span className="grow" /><button className="btn" onClick={() => ed.open(rows.find((r) => r.date === today()))}><Plus size={16} />수면 기록</button></div>
      <div className="tiles">
        <Stat label="최근 7일 평균" value={avg ? `${avg}시간` : '-'} />
        <Stat label="기록한 날" value={`${recent.length}일 / 7일`} />
      </div>
      <Card title="최근 14일 수면 시간"><Bars data={days} x="d" series={[{ key: '시간', name: '수면 시간' }]} fmt={(n) => n + '시간'} height={170} /></Card>
      <Card title="기록">
        {!rows.length && <Empty>잠든 시각과 일어난 시각을 적으면 수면 시간이 계산됩니다.</Empty>}
        <ul className="list">
          {[...rows].sort(byDateDesc).slice(0, 30).map((r) => (
            <li key={r.id} className="click" onClick={() => ed.open(r)}>
              <div className="body"><span>{fmtDate(r.date)}</span><span className="sub">{r.bed_time} ~ {r.wake_time}</span></div>
              <span className="amt">{hrs(r)}시간</span>
            </li>
          ))}
        </ul>
      </Card>
      {ed.modal}
    </>
  );
}

function Meals() {
  const s = useSettings();
  const meals = useTable('meals');
  const waters = useTable('waters');
  const [date, setDate] = useState(today());
  const ed = useEditor('meals', '식사', [
    { key: 'date', label: '날짜', type: 'date', required: true, half: true },
    { key: 'meal', label: '끼니', type: 'select', required: true, half: true, options: ['아침', '점심', '저녁', '간식'] },
    { key: 'content', label: '먹은 것', type: 'textarea', rows: 2, required: true },
  ], { defaults: () => ({ date, meal: '점심' }) });
  const water = waters.find((w) => w.date === date);
  const ml = Number(water?.ml) || 0;
  const addWater = (n: number) => {
    const next = Math.max(0, ml + n);
    if (water) next ? update('waters', water.id, { ml: next }) : remove('waters', water.id);
    else if (next) add('waters', { date, ml: next });
  };
  const order = ['아침', '점심', '저녁', '간식'];
  const list = meals.filter((m) => m.date === date).sort((a, b) => order.indexOf(a.meal) - order.indexOf(b.meal));
  return (
    <>
      <div className="row">
        <div className="month-nav">
          <button className="icon-btn" onClick={() => setDate(addDays(date, -1))} aria-label="전날"><ChevronLeft size={20} /></button>
          <b style={{ minWidth: 130 }}>{fmtDate(date)}</b>
          <button className="icon-btn" onClick={() => setDate(addDays(date, 1))} aria-label="다음 날"><ChevronRight size={20} /></button>
        </div>
        <span className="grow" />
        <button className="btn" onClick={() => ed.open()}><Plus size={16} />식사 기록</button>
      </div>
      <div className="grid2">
        <Card title="식단">
          {!list.length && <Empty>이 날 먹은 것을 끼니별로 적어 보세요.</Empty>}
          <ul className="list">
            {list.map((m) => (
              <li key={m.id} className="click" onClick={() => ed.open(m)}><span className="tag">{m.meal}</span><div className="body"><span className="pre">{m.content}</span></div></li>
            ))}
          </ul>
        </Card>
        <Card title={`물 (하루 목표 ${s.waterGoal}ml)`}>
          <div className="row"><b className="timer">{ml}</b><span className="muted">ml</span></div>
          <Progress value={ml} max={s.waterGoal} />
          <div className="row">
            <button className="btn" onClick={() => addWater(250)}>+ 한 컵 (250ml)</button>
            <button className="btn ghost" onClick={() => addWater(500)}>+ 500ml</button>
            <button className="btn ghost" disabled={!ml} onClick={() => addWater(-250)}>- 250ml</button>
          </div>
        </Card>
      </div>
      {ed.modal}
    </>
  );
}
