import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Bars, Donut, Lines } from '../components/Charts';
import { Card, Empty, Field, MonthNav, PageHead, Progress, Stat, Tabs, useEditor } from '../components/ui';
import { add, update, useSettings, useTable } from '../lib/db';
import { applyRecurring, bankOf, dday, maturity, netWorth, paidRounds, roundOf, syncSnapshot } from '../lib/finance';
import { savingFields, TX_TYPES } from '../lib/forms';
import { useTxEditor } from '../lib/txEditor';
import { byDateDesc, fmtDate, lastMonths, sum, thisMonth, won } from '../lib/util';

const TABS = ['가계부', '예산', '고정 항목', '자산', '투자'];

export default function Finance() {
  const [tab, setTab] = useState(TABS[0]);
  return (
    <>
      <PageHead title="경제" />
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      {tab === '가계부' && <Ledger />}
      {tab === '예산' && <Budgets />}
      {tab === '고정 항목' && <Recurring />}
      {tab === '자산' && <Assets />}
      {tab === '투자' && <Investments />}
    </>
  );
}

function Ledger() {
  const txs = useTable('transactions');
  const [month, setMonth] = useState(thisMonth());
  const accounts = useTable('accounts');
  const ed = useTxEditor();
  const savingText = (r: any) => {
    const a = accounts.find((x) => x.id === r.account_id);
    if (!a) return { name: '삭제된 통장', sub: '' };
    return { name: a.name, sub: `${bankOf(a)} · ${roundOf(r, txs, a)}회차${a.term_months ? ` / ${a.term_months}` : ''}` };
  };
  const rows = useMemo(() => txs.filter((t) => (t.date || '').startsWith(month)).sort(byDateDesc), [txs, month]);
  const income = sum(rows.filter((r) => r.type === 'income'), (r) => r.amount);
  const expense = sum(rows.filter((r) => r.type === 'expense'), (r) => r.amount);
  const saving = sum(rows.filter((r) => r.type === 'saving'), (r) => r.amount);
  const byCat = useMemo(() => {
    const m: Record<string, number> = {};
    rows.filter((r) => r.type === 'expense').forEach((r) => (m[r.category || '기타'] = (m[r.category || '기타'] || 0) + Number(r.amount)));
    return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [rows]);
  const trend = lastMonths(6).map((m) => {
    const r = txs.filter((t) => (t.date || '').startsWith(m));
    return { m: Number(m.slice(5)) + '월', 수입: sum(r.filter((x) => x.type === 'income'), (x) => x.amount), 지출: sum(r.filter((x) => x.type === 'expense'), (x) => x.amount), 저축: sum(r.filter((x) => x.type === 'saving'), (x) => x.amount) };
  });
  const dates = [...new Set(rows.map((r) => r.date))];
  return (
    <>
      <div className="row">
        <MonthNav month={month} onChange={setMonth} />
        <span className="grow" />
        <button className="btn" onClick={() => ed.open()}><Plus size={16} />내역 추가</button>
      </div>
      <div className="tiles">
        <Stat label="수입" value={won(income)} tone="pos" />
        <Stat label="지출" value={won(expense)} tone="neg" />
        <Stat label="저축" value={won(saving)} sub={income ? `저축률 ${Math.round((saving / income) * 100)}%` : undefined} />
        <Stat label="남은 돈" value={won(income - expense - saving)} sub="수입 - 지출 - 저축" />
      </div>
      <div className="grid2">
        <Card title="카테고리별 지출">
          {byCat.length ? <Donut data={byCat} fmt={won} height={170} /> : <Empty>이 달의 지출 내역이 없습니다.</Empty>}
        </Card>
        <Card title="최근 6개월">
          <Bars data={trend} x="m" fmt={won} series={[{ key: '수입', name: '수입', color: 'var(--pos)' }, { key: '지출', name: '지출', color: 'var(--neg)' }, { key: '저축', name: '저축', color: 'var(--accent)' }]} height={190} />
        </Card>
      </div>
      <Card title="내역">
        {!rows.length && <Empty>내역 추가 버튼으로 첫 수입이나 지출을 적어 보세요.</Empty>}
        {dates.map((d) => (
          <div key={d}>
            <div className="date-head">
              <span>{fmtDate(d)}</span>
              <span className="num">{won(sum(rows.filter((r) => r.date === d), (r) => (r.type === 'income' ? r.amount : r.type === 'expense' ? -r.amount : 0)))}</span>
            </div>
            <ul className="list">
              {rows.filter((r) => r.date === d).map((r) => (
                <li key={r.id} className="click" onClick={() => ed.open(r)}>
                  <span className="tag">{r.type === 'saving' ? '저축' : r.category}</span>
                  <div className="body"><span>{r.type === 'saving' ? savingText(r).name : r.memo || r.category}</span><span className="sub">{r.type === 'saving' ? [savingText(r).sub, r.memo].filter(Boolean).join(' · ') : r.method}{r.recurring_id ? ' · 고정' : ''}</span></div>
                  <span className={'amt ' + (r.type === 'income' ? 'pos' : '')}>{r.type === 'income' ? '+' : r.type === 'saving' ? '→ ' : '-'}{won(r.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Card>
      {ed.modal}
    </>
  );
}

function Budgets() {
  const s = useSettings();
  const txs = useTable('transactions');
  const budgets = useTable('budgets');
  const [month, setMonth] = useState(thisMonth());
  const [draft, setDraft] = useState<Record<string, string>>({});
  const spent = (c: string) => sum(txs.filter((t) => t.type === 'expense' && t.category === c && (t.date || '').startsWith(month)), (t) => t.amount);
  const save = (c: string) => {
    if (!(c in draft)) return;
    const amount = Number(draft[c]) || 0;
    const cur = budgets.find((b) => b.category === c);
    if (cur) update('budgets', cur.id, { amount });
    else if (amount) add('budgets', { category: c, amount });
    setDraft(({ [c]: _, ...rest }) => rest);
  };
  const totalB = sum(budgets.filter((b) => s.expenseCats.includes(b.category)), (b) => b.amount);
  const totalS = sum(s.expenseCats, (c) => spent(c));
  return (
    <>
      <MonthNav month={month} onChange={setMonth} />
      <div className="tiles">
        <Stat label="월 예산 합계" value={won(totalB)} />
        <Stat label="쓴 돈" value={won(totalS)} />
        <Stat label="남은 예산" value={won(totalB - totalS)} tone={totalB - totalS < 0 ? 'neg' : 'pos'} />
      </div>
      <Card title="카테고리별 예산">
        <p className="small muted">예산 칸에 금액을 적으면 매달 같은 금액이 적용됩니다.</p>
        <ul className="list">
          {s.expenseCats.map((c) => {
            const b = Number(budgets.find((x) => x.category === c)?.amount) || 0;
            const sp = spent(c);
            return (
              <li key={c}>
                <div className="body" style={{ gap: 6 }}>
                  <div className="row">
                    <b>{c}</b><span className="grow" />
                    <span className={'small num ' + (b && sp > b ? 'neg' : 'muted')}>{won(sp)}{b ? ` / ${won(b)}` : ''}{b && sp > b ? ` (${won(sp - b)} 초과)` : ''}</span>
                  </div>
                  {b > 0 && <Progress value={sp} max={b} over={sp > b} />}
                </div>
                <input
                  type="number" inputMode="numeric" style={{ width: 120 }} placeholder="예산" aria-label={`${c} 예산`}
                  value={c in draft ? draft[c] : b || ''} onChange={(e) => setDraft({ ...draft, [c]: e.target.value })} onBlur={() => save(c)}
                />
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
}

function Recurring() {
  const s = useSettings();
  const recs = useTable('recurring');
  const accounts = useTable('accounts');
  const txs = useTable('transactions');
  const fields = (v: any): Field[] => [
    { key: 'name', label: '이름', required: true, placeholder: '예: 월세, 통신비, 월급, 청년 적금' },
    { key: 'type', label: '구분', type: 'select', required: true, half: true, options: TX_TYPES },
    { key: 'amount', label: '금액(원)', type: 'number', required: true, half: true, step: '1' },
    ...(v.type === 'saving'
      ? savingFields(accounts, txs, recs, v, 'recurring')
      : [
          { key: 'category', label: '카테고리', type: 'select', required: true, half: true, options: v.type === 'income' ? s.incomeCats : s.expenseCats } as Field,
          { key: 'method', label: '결제 수단', type: 'select', half: true, options: s.methods } as Field,
        ]),
    { key: 'day', label: '매달 며칠', type: 'number', required: true, half: true, step: '1' },
    { key: 'start_month', label: '시작하는 달', type: 'month', required: true, half: true },
    { key: 'active', label: '사용 중 (끄면 더 이상 등록하지 않습니다)', type: 'checkbox' },
  ];
  const ed = useEditor('recurring', '고정 항목', fields, {
    defaults: () => ({ type: 'expense', day: 1, start_month: thisMonth(), active: true }),
    afterSave: () => applyRecurring(),
  });
  const active = recs.filter((r) => r.active !== false);
  const accOf = (r: any) => accounts.find((a) => a.id === r.account_id);
  const savingSub = (r: any) => {
    const a = accOf(r);
    if (!a) return '저축 · 삭제된 통장';
    const paid = paidRounds(a, txs), term = Number(a.term_months) || 0;
    return `저축 · ${bankOf(a)} ${a.name} · ${paid}${term ? `/${term}` : ''}회 납입${term && paid >= term ? ' · 납입 완료' : ''}`;
  };
  return (
    <>
      <div className="row">
        <p className="small muted grow">등록해 두면 매달 정한 날짜에 가계부에 자동으로 들어갑니다. 구분을 저축으로 하면 적금 잔액도 함께 늘어나고, 기간이 정해진 적금은 총 회차를 채우면 자동으로 멈춥니다.</p>
        <button className="btn" onClick={() => ed.open()}><Plus size={16} />고정 항목 추가</button>
      </div>
      <div className="tiles">
        <Stat label="매달 고정 지출" value={won(sum(active.filter((r) => r.type === 'expense'), (r) => r.amount))} />
        <Stat label="매달 고정 수입" value={won(sum(active.filter((r) => r.type === 'income'), (r) => r.amount))} />
        <Stat label="매달 고정 저축" value={won(sum(active.filter((r) => r.type === 'saving'), (r) => r.amount))} />
      </div>
      <Card>
        {!recs.length && <Empty>월세, 통신비, 구독료, 월급처럼 매달 반복되는 항목을 등록해 보세요.</Empty>}
        <ul className="list">
          {recs.map((r) => (
            <li key={r.id} className="click" onClick={() => ed.open({ ...r, _bank: accOf(r) ? bankOf(accOf(r)) : undefined })}>
              <span className="tag">매달 {r.day}일</span>
              <div className="body"><span className={r.active === false ? 'done' : ''}>{r.name}</span><span className="sub">{r.type === 'saving' ? savingSub(r) : `${r.category} · ${r.method || '수단 없음'}`}</span></div>
              <span className={'amt ' + (r.type === 'income' ? 'pos' : '')}>{r.type === 'income' ? '+' : r.type === 'saving' ? '→ ' : '-'}{won(r.amount)}</span>
            </li>
          ))}
        </ul>
      </Card>
      {ed.modal}
    </>
  );
}

const ACCOUNT_CATS = ['입출금', '예금', '적금', '현금', '연금', '부동산', '보증금', '기타 자산'];
const DEBT_CATS = ['신용대출', '담보대출', '학자금', '카드값', '기타 부채'];
const TERM_CATS = ['적금', '예금', '연금'];
const BANKS = ['국민은행', '신한은행', '우리은행', '하나은행', '농협은행', '기업은행', '카카오뱅크', '토스뱅크', '케이뱅크', '새마을금고', '우체국', '신협', 'SC제일은행', '부산은행', '대구은행', '수협은행', '저축은행'];

function Assets() {
  const accounts = useTable('accounts');
  const investments = useTable('investments');
  const snaps = useTable('net_worth_snapshots');
  const txs = useTable('transactions');
  useEffect(() => { syncSnapshot(); }, [accounts, investments]);
  const fields = (v: any): Field[] => [
    { key: 'kind', label: '구분', type: 'select', required: true, half: true, options: [{ value: 'asset', label: '자산' }, { value: 'debt', label: '부채' }] },
    { key: 'category', label: '종류', type: 'select', half: true, options: v.kind === 'debt' ? DEBT_CATS : ACCOUNT_CATS },
    { key: 'bank', label: v.kind === 'debt' ? '금융기관' : '은행', half: true, suggest: BANKS, placeholder: '예: 국민은행' },
    { key: 'name', label: v.kind === 'debt' ? '이름' : '통장명', required: true, half: true, placeholder: v.kind === 'debt' ? '예: 전세자금대출' : '예: 청년도약계좌' },
    ...(v.kind === 'debt' ? [] : [{ key: 'account_no', label: '계좌번호', placeholder: '예: 123-456-789012' } as Field]),
    { key: 'balance', label: v.kind === 'debt' ? '남은 금액(원)' : '현재 잔액(원)', type: 'number', required: true, step: '1' },
    ...(v.kind !== 'debt' && TERM_CATS.includes(v.category) ? [
      { key: 'start_date', label: '가입일', type: 'date', half: true } as Field,
      { key: 'term_months', label: '기간(개월) 예: 5년은 60', type: 'number', half: true, step: '1' } as Field,
      { key: 'monthly_amount', label: '월 납입액(원)', type: 'number', half: true, step: '1' } as Field,
      { key: 'rate', label: '금리(연 %)', type: 'number', half: true, step: '0.01' } as Field,
      { key: 'prior_rounds', label: '앱에 적기 전에 이미 납입한 횟수', type: 'number', step: '1', placeholder: '새로 가입했다면 비워 두세요' } as Field,
    ] : []),
    { key: 'memo', label: '메모' },
  ];
  const ed = useEditor('accounts', '자산·부채', fields, { defaults: () => ({ kind: 'asset' }) });
  const { assets, debts, net } = netWorth(accounts, investments);
  const invTotal = sum(investments, (i) => i.current_value);
  const trend = [...snaps].sort((a, b) => a.month.localeCompare(b.month)).slice(-24)
    .map((x) => ({ m: x.month.slice(2).replace('-', '.'), 순자산: Number(x.assets) - Number(x.debts) }));
  const group = (kind: string) => accounts.filter((a) => (kind === 'debt' ? a.kind === 'debt' : a.kind !== 'debt'));
  return (
    <>
      <div className="row">
        <p className="small muted grow">가계부에 저축을 기록하면 고른 계좌의 잔액이 자동으로 늘어납니다. 이자나 만기처럼 달라진 금액은 계좌를 눌러 잔액을 직접 고치세요.</p>
        <button className="btn" onClick={() => ed.open()}><Plus size={16} />자산·부채 추가</button>
      </div>
      <div className="tiles">
        <Stat label="순자산" value={won(net)} />
        <Stat label="자산" value={won(assets)} sub={invTotal ? `투자 ${won(invTotal)} 포함` : undefined} tone="pos" />
        <Stat label="부채" value={won(debts)} tone="neg" />
      </div>
      <Card title="순자산 추이">
        {trend.length > 1 ? <Lines data={trend} x="m" fmt={won} series={[{ key: '순자산', name: '순자산' }]} />
          : <Empty>잔액이 바뀌면 그 달의 순자산이 기록됩니다. 두 달 이상 쌓이면 그래프가 그려집니다.</Empty>}
      </Card>
      <div className="grid2">
        {(['asset', 'debt'] as const).map((k) => (
          <Card key={k} title={k === 'asset' ? '자산' : '부채'}>
            {!group(k).length && <Empty>{k === 'asset' ? '통장, 적금, 현금 등을 등록하세요.' : '대출이나 카드값을 등록하세요.'}</Empty>}
            <ul className="list">
              {group(k).map((a) => {
                const term = Number(a.term_months) || 0, paid = paidRounds(a, txs), end = maturity(a);
                return (
                  <li key={a.id} className="click" onClick={() => ed.open(a)}>
                    <div className="body" style={{ gap: 3 }}>
                      <span>{a.name}</span>
                      <span className="sub">{[a.bank, a.category, a.account_no, a.memo].filter(Boolean).join(' · ')}</span>
                      {(term > 0 || end) && (
                        <span className="sub">
                          {[term ? `${paid}/${term}회차` : paid ? `${paid}회 납입` : '', end && `만기 ${end} (${dday(end)})`, a.monthly_amount && `월 ${won(a.monthly_amount)}`, a.rate && `연 ${a.rate}%`].filter(Boolean).join(' · ')}
                        </span>
                      )}
                      {term > 0 && <Progress value={paid} max={term} />}
                    </div>
                    <span className="amt">{won(a.balance)}</span>
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
      </div>
      {ed.modal}
    </>
  );
}

function Investments() {
  const rows = useTable('investments');
  useEffect(() => { syncSnapshot(); }, [rows]);
  const ed = useEditor('investments', '투자', [
    { key: 'name', label: '종목·상품 이름', required: true },
    { key: 'kind', label: '종류', type: 'select', options: ['국내 주식', '해외 주식', 'ETF', '펀드', '채권', '코인', '기타'] },
    { key: 'invested', label: '넣은 돈(원)', type: 'number', required: true, half: true, step: '1' },
    { key: 'current_value', label: '현재 평가액(원)', type: 'number', required: true, half: true, step: '1' },
    { key: 'memo', label: '메모' },
  ]);
  const inv = sum(rows, (r) => r.invested), cur = sum(rows, (r) => r.current_value);
  const pct = (a: number, b: number) => (a ? `${b - a >= 0 ? '+' : ''}${(((b - a) / a) * 100).toFixed(1)}%` : '-');
  return (
    <>
      <div className="row">
        <p className="small muted grow">평가액은 직접 고쳐 적습니다. 시세를 자동으로 가져오지 않습니다.</p>
        <button className="btn" onClick={() => ed.open()}><Plus size={16} />투자 추가</button>
      </div>
      <div className="tiles">
        <Stat label="넣은 돈" value={won(inv)} />
        <Stat label="평가액" value={won(cur)} />
        <Stat label="수익" value={won(cur - inv)} sub={pct(inv, cur)} tone={cur - inv >= 0 ? 'pos' : 'neg'} />
      </div>
      <Card>
        {!rows.length && <Empty>주식, 펀드, 코인 등을 등록해 수익률을 확인하세요.</Empty>}
        <ul className="list">
          {rows.map((r) => (
            <li key={r.id} className="click" onClick={() => ed.open(r)}>
              <div className="body"><span>{r.name}</span><span className="sub">{r.kind || '기타'} · 넣은 돈 {won(r.invested)}</span></div>
              <div className="body" style={{ flex: 'none', alignItems: 'flex-end' }}>
                <span className="amt">{won(r.current_value)}</span>
                <span className={'sub ' + (r.current_value - r.invested >= 0 ? 'pos' : 'neg')}>{pct(r.invested, r.current_value)}</span>
              </div>
            </li>
          ))}
        </ul>
      </Card>
      {ed.modal}
    </>
  );
}
