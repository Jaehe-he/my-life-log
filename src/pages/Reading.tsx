import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { Bars } from '../components/Charts';
import { Card, Empty, Field, Modal, PageHead, Progress, Rating, Stat, Tabs, useEditor } from '../components/ui';
import { BookHit, findPages, searchBooks } from '../lib/books';
import { add, getRows, notify, remove, update, useTable } from '../lib/db';
import { lastDays, md, sum, thisMonth, today } from '../lib/util';

const STATUS = ['읽는 중', '읽고 싶은', '완독'];
const fields: Field[] = [
  { key: 'title', label: '제목', required: true },
  { key: 'author', label: '저자', half: true },
  { key: 'publisher', label: '출판사', half: true },
  { key: 'status', label: '상태', type: 'select', required: true, half: true, options: STATUS },
  { key: 'total_pages', label: '전체 쪽수', type: 'number', half: true, step: '1' },
  { key: 'started', label: '읽기 시작한 날', type: 'date', half: true },
  { key: 'finished', label: '다 읽은 날', type: 'date', half: true },
  { key: 'rating', label: '별점', type: 'rating' },
  { key: 'review', label: '감상문', type: 'textarea', rows: 6 },
];

export default function Reading() {
  const books = useTable('books');
  const logs = useTable('reading_logs');
  const [tab, setTab] = useState(STATUS[0]);
  const [searching, setSearching] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const ed = useEditor('books', '책', fields, {
    defaults: () => ({ status: '읽고 싶은', current_page: 0 }),
    afterDelete: (b) => {
      getRows('book_quotes').filter((q) => q.book_id === b.id).forEach((q) => remove('book_quotes', q.id));
      getRows('reading_logs').filter((l) => l.book_id === b.id).forEach((l) => remove('reading_logs', l.id));
    },
  });
  const year = today().slice(0, 4);
  const list = books.filter((b) => b.status === tab).sort((a, b) => (b.finished || b.created_at || '').localeCompare(a.finished || a.created_at || ''));
  const days = lastDays(14).map((d) => ({ d: md(d), 쪽: sum(logs.filter((l) => l.date === d), (l) => l.pages) }));
  const cur = books.find((b) => b.id === detail);
  return (
    <>
      <PageHead title="독서">
        <button className="btn ghost" onClick={() => ed.open()}>직접 입력</button>
        <button className="btn" onClick={() => setSearching(true)}><Search size={16} />책 검색</button>
      </PageHead>
      <div className="tiles">
        <Stat label={`${year}년 완독`} value={`${books.filter((b) => b.status === '완독' && (b.finished || '').startsWith(year)).length}권`} />
        <Stat label="이번 달 읽은 쪽수" value={`${sum(logs.filter((l) => (l.date || '').startsWith(thisMonth())), (l) => l.pages)}쪽`} />
        <Stat label="읽는 중" value={`${books.filter((b) => b.status === '읽는 중').length}권`} />
      </div>
      <Card title="최근 14일 읽은 쪽수"><Bars data={days} x="d" series={[{ key: '쪽', name: '읽은 쪽수' }]} height={160} fmt={(n) => n + '쪽'} /></Card>
      <Tabs tabs={STATUS} value={tab} onChange={setTab} />
      {!list.length && <Empty>{tab === '읽는 중' ? '책 검색으로 읽고 있는 책을 등록해 보세요.' : `${tab} 책이 없습니다.`}</Empty>}
      <div className="books">
        {list.map((b) => (
          <button key={b.id} className="book" onClick={() => setDetail(b.id)}>
            {b.cover ? <img className="cover" src={b.cover} alt="" /> : <span className="cover" />}
            <div className="stack" style={{ gap: 4, flex: 1 }}>
              <b>{b.title}</b>
              <span className="small muted">{b.author}</span>
              {b.status === '완독' ? <Rating value={b.rating} /> : b.total_pages ? (
                <><Progress value={b.current_page || 0} max={b.total_pages} /><span className="small muted num">{b.current_page || 0} / {b.total_pages}쪽</span></>
              ) : null}
            </div>
          </button>
        ))}
      </div>
      {searching && <SearchModal onClose={() => setSearching(false)} onPick={(h) => { setSearching(false); ed.open({ ...h, status: '읽고 싶은', current_page: 0 }); }} />}
      {cur && <Detail book={cur} onClose={() => setDetail(null)} onEdit={() => { setDetail(null); ed.open(cur); }} />}
      {ed.modal}
    </>
  );
}

function SearchModal({ onClose, onPick }: { onClose: () => void; onPick: (h: BookHit) => void }) {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ hits: BookHit[]; source: string } | null>(null);
  const go = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true);
    try { setRes(await searchBooks(q.trim())); } catch (err: any) { notify(err.message); }
    setBusy(false);
  };
  const pick = async (h: BookHit) => onPick(h.total_pages ? h : { ...h, total_pages: await findPages(h.isbn) });
  return (
    <Modal title="책 검색" onClose={onClose} wide>
      <form className="row" onSubmit={go}>
        <input type="search" autoFocus placeholder="제목이나 저자" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1 }} aria-label="책 검색어" />
        <button className="btn" disabled={busy}>{busy ? '검색 중' : '검색'}</button>
      </form>
      {res && <p className="small muted">{res.source} 검색 결과 {res.hits.length}건. 쪽수가 비어 있으면 직접 적어 주세요.</p>}
      {res && !res.hits.length && <Empty>결과가 없습니다. 닫고 직접 입력을 눌러 등록할 수 있습니다.</Empty>}
      <ul className="list">
        {res?.hits.map((h, i) => (
          <li key={i} className="click" onClick={() => pick(h)}>
            {h.cover ? <img className="cover" src={h.cover} alt="" /> : <span className="cover" />}
            <div className="body"><b>{h.title}</b><span className="sub">{h.author} · {h.publisher}</span></div>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

function Detail({ book, onClose, onEdit }: { book: any; onClose: () => void; onEdit: () => void }) {
  const quotes = useTable('book_quotes').filter((q) => q.book_id === book.id);
  const [page, setPage] = useState('');
  const [qt, setQt] = useState('');
  const [qp, setQp] = useState('');
  const record = async () => {
    const p = Number(page);
    if (!p || p <= 0) return;
    const delta = p - (book.current_page || 0);
    if (delta > 0) await add('reading_logs', { book_id: book.id, date: today(), pages: delta });
    const done = book.total_pages && p >= book.total_pages;
    await update('books', book.id, {
      current_page: p,
      status: done ? '완독' : '읽는 중',
      started: book.started || today(),
      ...(done ? { finished: today() } : {}),
    });
    setPage('');
    if (done) notify('완독을 축하합니다. 별점과 감상문을 남겨 보세요.');
  };
  const addQuote = async () => {
    if (!qt.trim()) return;
    await add('book_quotes', { book_id: book.id, text: qt.trim(), page: qp ? Number(qp) : null });
    setQt(''); setQp('');
  };
  return (
    <Modal title={book.title} onClose={onClose} wide>
      <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
        {book.cover ? <img className="cover" src={book.cover} alt="" /> : <span className="cover" />}
        <div className="stack" style={{ gap: 4, flex: 1 }}>
          <span className="small muted">{[book.author, book.publisher].filter(Boolean).join(' · ')}</span>
          <div className="row"><span className="tag">{book.status}</span><Rating value={book.rating} /></div>
          {book.total_pages ? <><Progress value={book.current_page || 0} max={book.total_pages} /><span className="small muted num">{book.current_page || 0} / {book.total_pages}쪽</span></> : null}
        </div>
        <button className="btn ghost small" onClick={onEdit}>정보·감상문 고치기</button>
      </div>
      {book.status !== '완독' && (
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <input type="number" inputMode="numeric" placeholder="오늘 몇 쪽까지 읽었나요?" value={page} onChange={(e) => setPage(e.target.value)} aria-label="읽은 쪽" />
          <button className="btn" onClick={record}>기록</button>
        </div>
      )}
      {book.review && <Card title="감상문"><p className="pre">{book.review}</p></Card>}
      <Card title="인상 깊은 문장">
        {!quotes.length && <Empty>기억하고 싶은 문장을 옮겨 적어 보세요.</Empty>}
        <ul className="list">
          {quotes.map((q) => (
            <li key={q.id}>
              <div className="body"><span className="pre">{q.text}</span>{q.page && <span className="sub">{q.page}쪽</span>}</div>
              <button className="btn ghost small danger-text" onClick={() => remove('book_quotes', q.id)}>삭제</button>
            </li>
          ))}
        </ul>
        <textarea rows={2} placeholder="문장" value={qt} onChange={(e) => setQt(e.target.value)} aria-label="인상 깊은 문장" />
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <input type="number" inputMode="numeric" placeholder="쪽" value={qp} onChange={(e) => setQp(e.target.value)} style={{ width: 90 }} aria-label="쪽수" />
          <span className="grow" />
          <button className="btn ghost" onClick={addQuote}><Plus size={16} />문장 추가</button>
        </div>
      </Card>
    </Modal>
  );
}
