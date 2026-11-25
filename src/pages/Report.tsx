import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Donut } from '../components/Charts';
import { Card, Empty, PageHead, Tabs } from '../components/ui';
import { useTable } from '../lib/db';
import { metrics, REPORT_TABLES } from '../lib/report';
import { addDays, addMonths, daysIn, fmtMonth, md, sum, thisMonth, today, weekStart, won } from '../lib/util';

export default function Report() {
  // 필요한 표를 모두 불러온다 (표 개수가 고정이라 훅 순서가 바뀌지 않는다)
  const tables = REPORT_TABLES.map((t) => useTable(t));
  const [mode, setMode] = useState('주간');
  const [week, setWeek] = useState(weekStart(today()));
  const [month, setMonth] = useState(thisMonth());

  const weekly = mode === '주간';
  const from = weekly ? week : `${month}-01`;
  const to = weekly ? addDays(week, 6) : `${month}-${daysIn(month)}`;
  const pFrom = weekly ? addDays(week, -7) : `${addMonths(month, -1)}-01`;
  const pTo = weekly ? addDays(week, -1) : `${addMonths(month, -1)}-${daysIn(addMonths(month, -1))}`;
  const cur = metrics(from, to), prev = metrics(pFrom, pTo);
  const move = (n: number) => (weekly ? setWeek(addDays(week, 7 * n)) : setMonth(addMonths(month, n)));

  const tx = tables[0].filter((t) => t.type === 'expense' && t.date >= from && t.date <= to);
  const cats: Record<string, number> = {};
  tx.forEach((t) => (cats[t.category || '기타'] = (cats[t.category || '기타'] || 0) + Number(t.amount)));
  const catData = Object.entries(cats).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  return (
    <>
      <PageHead title="리포트" />
      <Tabs tabs={['주간', '월간']} value={mode} onChange={setMode} />
      <div className="month-nav">
        <button className="icon-btn" onClick={() => move(-1)} aria-label="이전"><ChevronLeft size={20} /></button>
        <b style={{ minWidth: 150 }}>{weekly ? `${md(from)} ~ ${md(to)}` : fmtMonth(month)}</b>
        <button className="icon-btn" onClick={() => move(1)} aria-label="다음"><ChevronRight size={20} /></button>
      </div>
      <Card title={weekly ? '이번 주와 지난주' : '이번 달과 지난달'}>
        <table className="report">
          <thead><tr><th>항목</th><th>{weekly ? '이 주' : '이 달'}</th><th>{weekly ? '전 주' : '전 달'}</th><th>변화</th></tr></thead>
          <tbody>
            {cur.map((m, i) => {
              const p = prev[i].value;
              const diff = m.value !== null && p !== null ? m.value - p : null;
              const tone = !diff ? 'muted' : diff > 0 === m.goodUp ? 'pos' : 'neg';
              return (
                <tr key={m.label}>
                  <td>{m.label}</td>
                  <td><b>{m.value === null ? '-' : m.fmt(m.value)}</b></td>
                  <td className="muted">{p === null ? '-' : m.fmt(p)}</td>
                  <td className={tone}>{diff === null || diff === 0 ? '-' : (diff > 0 ? '+' : '-') + m.fmt(Math.abs(diff))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <Card title={`카테고리별 지출 (합계 ${won(sum(tx, (t) => t.amount))})`}>
        {catData.length ? <Donut data={catData} fmt={won} height={180} /> : <Empty>이 기간에 지출 내역이 없습니다.</Empty>}
      </Card>
    </>
  );
}
