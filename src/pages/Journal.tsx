import { useMemo, useState } from 'react';
import { Pin, Plus } from 'lucide-react';
import { Lines } from '../components/Charts';
import { Card, Empty, MonthGrid, MonthNav, PageHead, Photos, Tabs, useEditor } from '../components/ui';
import { useTable } from '../lib/db';
import { diaryFields, noteFields } from '../lib/forms';
import { byDateDesc, fmtDate, MOODS, thisMonth, today } from '../lib/util';

export default function Journal() {
  const [tab, setTab] = useState('일기');
  return (
    <>
      <PageHead title="일기·메모" />
      <Tabs tabs={['일기', '메모']} value={tab} onChange={setTab} />
      {tab === '일기' ? <Diary /> : <Notes />}
    </>
  );
}

function Diary() {
  const rows = useTable('diary');
  const [month, setMonth] = useState(thisMonth());
  const ed = useEditor('diary', '일기', diaryFields);
  const byDate = useMemo(() => Object.fromEntries(rows.map((r) => [r.date, r])), [rows]);
  const openDate = (date: string) => ed.open(byDate[date] || { date });
  const list = rows.filter((r) => (r.date || '').startsWith(month)).sort(byDateDesc);
  const moods = [...list].reverse().filter((r) => r.mood).map((r) => ({ d: Number(r.date.slice(8)) + '일', 기분: r.mood }));
  return (
    <>
      <div className="row">
        <MonthNav month={month} onChange={setMonth} />
        <span className="grow" />
        <button className="btn" onClick={() => openDate(today())}><Plus size={16} />오늘 일기</button>
      </div>
      <div className="grid2">
        <Card title="날짜를 눌러 쓰거나 고칩니다">
          <MonthGrid month={month} onPick={openDate} render={(d) => byDate[d] && <i className={`dot mood-${byDate[d].mood || 3}`} />} />
        </Card>
        <Card title="기분 변화 (1 매우 나쁨 ~ 5 매우 좋음)">
          {moods.length > 1 ? <Lines data={moods} x="d" series={[{ key: '기분', name: '기분' }]} domain={[1, 5]} height={220} />
            : <Empty>기분을 이틀 이상 기록하면 그래프가 그려집니다.</Empty>}
        </Card>
      </div>
      {!list.length && <Empty>이 달에 쓴 일기가 없습니다.</Empty>}
      {list.map((r) => (
        <Card key={r.id} className="click" title={<span onClick={() => ed.open(r)}>{fmtDate(r.date)}{r.mood ? ` · ${MOODS[r.mood]}` : ''}</span>}
          action={<button className="btn ghost small" onClick={() => ed.open(r)}>고치기</button>}>
          {r.good && <p className="small"><b>잘한 일</b> {r.good}</p>}
          {r.bad && <p className="small"><b>아쉬운 일</b> {r.bad}</p>}
          {r.thanks && <p className="small"><b>감사한 일</b> {r.thanks}</p>}
          {r.content && <p className="pre">{r.content}</p>}
          <Photos value={r.photos} />
        </Card>
      ))}
      {ed.modal}
    </>
  );
}

function Notes() {
  const rows = useTable('notes');
  const [q, setQ] = useState('');
  const [tag, setTag] = useState('');
  const ed = useEditor('notes', '메모', noteFields);
  const tags = [...new Set(rows.map((r) => r.tag).filter(Boolean))];
  const list = rows
    .filter((r) => (!tag || r.tag === tag) && (!q || `${r.title} ${r.content || ''}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || (b.created_at || '').localeCompare(a.created_at || ''));
  return (
    <>
      <div className="row">
        <input type="search" placeholder="메모 검색" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 260 }} aria-label="메모 검색" />
        <span className="grow" />
        <button className="btn" onClick={() => ed.open(tag ? { tag } : undefined)}><Plus size={16} />메모 추가</button>
      </div>
      {tags.length > 0 && (
        <div className="chips">
          <button className={'chip' + (!tag ? ' on' : '')} onClick={() => setTag('')}>전체</button>
          {tags.map((t) => <button key={t} className={'chip' + (tag === t ? ' on' : '')} onClick={() => setTag(t)}>{t}</button>)}
        </div>
      )}
      {!list.length && <Empty>떠오른 생각, 위시리스트, 가보고 싶은 곳을 적어 두세요.</Empty>}
      <div className="notes">
        {list.map((r) => (
          <button key={r.id} className="note" onClick={() => ed.open(r)}>
            <div className="row">{r.pinned && <Pin size={14} />}<b>{r.title}</b></div>
            {r.content && <p>{r.content}</p>}
            {r.tag && <span className="tag" style={{ alignSelf: 'flex-start' }}>{r.tag}</span>}
          </button>
        ))}
      </div>
      {ed.modal}
    </>
  );
}
