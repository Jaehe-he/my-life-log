import { useEffect, useState } from 'react';
import { Play, Plus, Square } from 'lucide-react';
import { Bars } from '../components/Charts';
import { Card, Empty, Field, PageHead, Progress, Stat, useEditor } from '../components/ui';
import { add, getRows, remove, update, useTable } from '../lib/db';
import { byDateDesc, fmtDate, fmtMin, lastDays, md, sum, today, weekStart } from '../lib/util';

const TIMER = 'ml:timer';

function Timer({ subjects }: { subjects: any[] }) {
  const [state, setState] = useState<{ subject_id: string; start: number } | null>(() => JSON.parse(localStorage.getItem(TIMER) || 'null'));
  const [subject, setSubject] = useState('');
  const [, tick] = useState(0);
  useEffect(() => {
    if (!state) return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [state]);
  const start = () => {
    const sid = subject || subjects[0]?.id;
    if (!sid) return;
    const s = { subject_id: sid, start: Date.now() };
    localStorage.setItem(TIMER, JSON.stringify(s));
    setState(s);
  };
  const stop = async () => {
    if (!state) return;
    const minutes = Math.round((Date.now() - state.start) / 60000);
    localStorage.removeItem(TIMER);
    setState(null);
    if (minutes >= 1) await add('study_logs', { subject_id: state.subject_id, date: today(), minutes, memo: null });
  };
  const sec = state ? Math.floor((Date.now() - state.start) / 1000) : 0;
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    <Card title="공부 타이머">
      {state ? (
        <div className="row">
          <span className="timer">{p(Math.floor(sec / 3600))}:{p(Math.floor(sec / 60) % 60)}:{p(sec % 60)}</span>
          <span className="tag">{subjects.find((s) => s.id === state.subject_id)?.name || '과목'}</span>
          <span className="grow" />
          <button className="btn" onClick={stop}><Square size={16} />끝내고 기록</button>
        </div>
      ) : subjects.length ? (
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <select value={subject || subjects[0].id} onChange={(e) => setSubject(e.target.value)} aria-label="과목">
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button className="btn" onClick={start}><Play size={16} />시작</button>
        </div>
      ) : <Empty>과목을 먼저 추가하면 타이머를 쓸 수 있습니다.</Empty>}
      <p className="small muted">앱을 닫아도 시간은 계속 흐릅니다. 1분 미만은 기록하지 않습니다.</p>
    </Card>
  );
}

export default function Study() {
  const subjects = useTable('study_subjects');
  const materials = useTable('study_materials');
  const logs = useTable('study_logs');
  const subjOpts = subjects.map((s) => ({ value: s.id, label: s.name }));

  const subjEd = useEditor('study_subjects', '과목', [
    { key: 'name', label: '과목 이름', required: true, placeholder: '예: 영어, 정보처리기사' },
    { key: 'start_date', label: '공부 시작일', type: 'date', half: true },
    { key: 'end_date', label: '끝내는 날(시험일)', type: 'date', half: true },
    { key: 'goal', label: '목표', placeholder: '예: 토익 850점' },
    { key: 'done', label: '공부를 마쳤습니다', type: 'checkbox' },
  ], {
    defaults: () => ({ start_date: today() }),
    afterDelete: (s) => {
      getRows('study_materials').filter((m) => m.subject_id === s.id).forEach((m) => remove('study_materials', m.id));
      getRows('study_logs').filter((l) => l.subject_id === s.id).forEach((l) => remove('study_logs', l.id));
    },
  });
  const matEd = useEditor('study_materials', '강의·교재', [
    { key: 'subject_id', label: '과목', type: 'select', required: true, options: subjOpts },
    { key: 'name', label: '이름', required: true },
    { key: 'kind', label: '종류', type: 'select', required: true, half: true, options: ['강의', '교재'] },
    { key: 'total_units', label: '전체 분량 (강 또는 단원 수)', type: 'number', required: true, half: true, step: '1' },
    { key: 'done_units', label: '끝낸 분량', type: 'number', half: true, step: '1' },
  ], { defaults: () => ({ kind: '강의', done_units: 0 }) });
  const logFields = (v: any): Field[] => [
    { key: 'subject_id', label: '과목', type: 'select', required: true, options: subjOpts },
    { key: 'material_id', label: '강의·교재', type: 'select', options: materials.filter((m) => m.subject_id === v.subject_id).map((m) => ({ value: m.id, label: m.name })) },
    { key: 'date', label: '날짜', type: 'date', required: true, half: true },
    { key: 'minutes', label: '공부한 시간(분)', type: 'number', required: true, half: true, step: '1' },
    { key: 'memo', label: '공부한 내용', type: 'textarea', rows: 2 },
  ];
  const logEd = useEditor('study_logs', '공부 기록', logFields, { defaults: () => ({ date: today(), subject_id: subjects[0]?.id }) });

  const t = today(), ws = weekStart(t);
  const days = lastDays(14).map((d) => ({ d: md(d), 분: sum(logs.filter((l) => l.date === d), (l) => l.minutes) }));
  const name = (id: string) => subjects.find((s) => s.id === id)?.name || '삭제된 과목';
  const dday = (end?: string) => {
    if (!end) return '';
    const n = Math.round((new Date(end).getTime() - new Date(t).getTime()) / 86400000);
    return n > 0 ? `D-${n}` : n === 0 ? 'D-Day' : `D+${-n}`;
  };
  return (
    <>
      <PageHead title="공부">
        <button className="btn ghost" onClick={() => subjEd.open()}><Plus size={16} />과목</button>
        <button className="btn" disabled={!subjects.length} onClick={() => logEd.open()}><Plus size={16} />공부 기록</button>
      </PageHead>
      <div className="tiles">
        <Stat label="오늘" value={fmtMin(sum(logs.filter((l) => l.date === t), (l) => l.minutes))} />
        <Stat label="이번 주" value={fmtMin(sum(logs.filter((l) => l.date >= ws), (l) => l.minutes))} />
        <Stat label="이번 달" value={fmtMin(sum(logs.filter((l) => (l.date || '').startsWith(t.slice(0, 7))), (l) => l.minutes))} />
        <Stat label="전체 누적" value={fmtMin(sum(logs, (l) => l.minutes))} />
      </div>
      <div className="grid2">
        <Timer subjects={subjects.filter((s) => !s.done)} />
        <Card title="최근 14일 공부 시간"><Bars data={days} x="d" series={[{ key: '분', name: '공부 시간' }]} fmt={fmtMin} height={150} /></Card>
      </div>
      {!subjects.length && <Empty>과목 버튼으로 공부할 과목을 추가하고, 강의와 교재를 등록해 진도를 관리하세요.</Empty>}
      <div className="grid2">
        {subjects.map((s) => {
          const mats = materials.filter((m) => m.subject_id === s.id);
          return (
            <Card key={s.id}
              title={<span className="click" onClick={() => subjEd.open(s)}><b style={{ color: 'var(--fg)', fontSize: 16 }} className={s.done ? 'done' : ''}>{s.name}</b></span>}
              action={<span className="row">{s.end_date && !s.done && <span className="tag">{dday(s.end_date)}</span>}<button className="btn ghost small" onClick={() => matEd.open({ subject_id: s.id })}><Plus size={14} />강의·교재</button></span>}>
              <p className="small muted">
                {[s.start_date && `${s.start_date} ~ ${s.end_date || ''}`, s.goal, `누적 ${fmtMin(sum(logs.filter((l) => l.subject_id === s.id), (l) => l.minutes))}`].filter(Boolean).join(' · ')}
              </p>
              {mats.map((m) => (
                <div key={m.id} className="stack" style={{ gap: 4 }}>
                  <div className="row" style={{ flexWrap: 'nowrap' }}>
                    <span className="tag">{m.kind}</span>
                    <span className="grow click" onClick={() => matEd.open(m)}>{m.name}</span>
                    <span className="small muted num">{m.done_units || 0}/{m.total_units}</span>
                    <button className="btn ghost small" disabled={(m.done_units || 0) >= m.total_units} aria-label={`${m.name} 진도 하나 올리기`}
                      onClick={() => update('study_materials', m.id, { done_units: (m.done_units || 0) + 1 })}>+1</button>
                  </div>
                  <Progress value={m.done_units || 0} max={m.total_units} />
                </div>
              ))}
            </Card>
          );
        })}
      </div>
      <Card title="공부 기록">
        {!logs.length && <Empty>타이머를 쓰거나 공부 기록 버튼으로 시간을 직접 적으세요.</Empty>}
        <ul className="list">
          {[...logs].sort(byDateDesc).slice(0, 40).map((l) => (
            <li key={l.id} className="click" onClick={() => logEd.open(l)}>
              <span className="tag">{name(l.subject_id)}</span>
              <div className="body"><span>{l.memo || materials.find((m) => m.id === l.material_id)?.name || '공부'}</span><span className="sub">{fmtDate(l.date)}</span></div>
              <span className="amt">{fmtMin(l.minutes)}</span>
            </li>
          ))}
        </ul>
      </Card>
      {subjEd.modal}{matEd.modal}{logEd.modal}
    </>
  );
}
