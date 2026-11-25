import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Card, Empty, PageHead, Photos, Rating, Stat, Tabs, useEditor } from '../components/ui';
import { useTable } from '../lib/db';
import { byDateDesc, fmtDate, fmtMin, sum, thisMonth, today } from '../lib/util';

const KINDS = ['영화', '드라마', '애니', '게임', '음악', '공연·전시', '기타'];

export default function Hobby() {
  const [tab, setTab] = useState('활동 일지');
  return (
    <>
      <PageHead title="취미" />
      <Tabs tabs={['활동 일지', '감상 기록']} value={tab} onChange={setTab} />
      {tab === '활동 일지' ? <Activities /> : <Media />}
    </>
  );
}

function Activities() {
  const hobbies = useTable('hobbies');
  const logs = useTable('hobby_logs');
  const [filter, setFilter] = useState('');
  const hobbyEd = useEditor('hobbies', '취미', [{ key: 'name', label: '취미 이름', required: true, placeholder: '예: 러닝, 기타 연주, 요리' }]);
  const logEd = useEditor('hobby_logs', '활동', [
    { key: 'hobby_id', label: '취미', type: 'select', required: true, options: hobbies.map((h) => ({ value: h.id, label: h.name })) },
    { key: 'date', label: '날짜', type: 'date', required: true, half: true },
    { key: 'minutes', label: '한 시간(분)', type: 'number', half: true, step: '1' },
    { key: 'memo', label: '메모', type: 'textarea', rows: 3 },
    { key: 'photos', label: '사진', type: 'photos' },
  ], { defaults: () => ({ date: today(), hobby_id: filter || hobbies[0]?.id }) });
  const list = logs.filter((l) => !filter || l.hobby_id === filter).sort(byDateDesc);
  const month = logs.filter((l) => (l.date || '').startsWith(thisMonth()));
  return (
    <>
      <div className="row">
        <div className="chips grow">
          <button className={'chip' + (!filter ? ' on' : '')} onClick={() => setFilter('')}>전체</button>
          {hobbies.map((h) => (
            <button key={h.id} className={'chip' + (filter === h.id ? ' on' : '')} onClick={() => setFilter(h.id)} onDoubleClick={() => hobbyEd.open(h)}>{h.name}</button>
          ))}
          <button className="chip" onClick={() => hobbyEd.open()}>+ 취미 추가</button>
        </div>
        <button className="btn" disabled={!hobbies.length} onClick={() => logEd.open()}><Plus size={16} />활동 기록</button>
      </div>
      {filter && <p className="small muted">선택한 취미 이름을 고치려면 <button className="btn ghost small" onClick={() => hobbyEd.open(hobbies.find((h) => h.id === filter))}>이름 고치기</button></p>}
      <div className="tiles">
        <Stat label="이번 달 활동" value={`${month.length}회`} />
        <Stat label="이번 달 시간" value={fmtMin(sum(month, (l) => l.minutes))} />
      </div>
      {!list.length && <Empty>{hobbies.length ? '활동 기록 버튼으로 오늘 한 취미를 남겨 보세요.' : '먼저 취미를 추가하세요.'}</Empty>}
      {list.slice(0, 60).map((l) => (
        <Card key={l.id}
          title={<span className="click" onClick={() => logEd.open(l)}>{hobbies.find((h) => h.id === l.hobby_id)?.name || '삭제된 취미'} · {fmtDate(l.date)}{l.minutes ? ` · ${fmtMin(l.minutes)}` : ''}</span>}
          action={<button className="btn ghost small" onClick={() => logEd.open(l)}>고치기</button>}>
          {l.memo && <p className="pre">{l.memo}</p>}
          <Photos value={l.photos} />
        </Card>
      ))}
      {hobbyEd.modal}{logEd.modal}
    </>
  );
}

function Media() {
  const rows = useTable('media');
  const [kind, setKind] = useState('');
  const ed = useEditor('media', '감상', [
    { key: 'title', label: '작품 이름', required: true },
    { key: 'kind', label: '종류', type: 'select', required: true, half: true, options: KINDS },
    { key: 'date', label: '본 날', type: 'date', half: true },
    { key: 'rating', label: '별점', type: 'rating' },
    { key: 'comment', label: '한 줄 평', type: 'textarea', rows: 2 },
  ], { defaults: () => ({ date: today(), kind: kind || '영화' }) });
  const list = rows.filter((r) => !kind || r.kind === kind).sort(byDateDesc);
  return (
    <>
      <div className="row">
        <div className="chips grow">
          <button className={'chip' + (!kind ? ' on' : '')} onClick={() => setKind('')}>전체</button>
          {KINDS.map((k) => <button key={k} className={'chip' + (kind === k ? ' on' : '')} onClick={() => setKind(k)}>{k}</button>)}
        </div>
        <button className="btn" onClick={() => ed.open()}><Plus size={16} />감상 추가</button>
      </div>
      <Card>
        {!list.length && <Empty>본 영화, 드라마, 게임 등을 별점과 한 줄 평으로 남겨 보세요.</Empty>}
        <ul className="list">
          {list.map((r) => (
            <li key={r.id} className="click" onClick={() => ed.open(r)}>
              <span className="tag">{r.kind}</span>
              <div className="body"><b>{r.title}</b>{r.comment && <span className="sub">{r.comment}</span>}<span className="sub">{fmtDate(r.date)}</span></div>
              <Rating value={r.rating} />
            </li>
          ))}
        </ul>
      </Card>
      {ed.modal}
    </>
  );
}
