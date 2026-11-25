import { add, getRows, load, Row, update } from './db';
import { addMonths, daysIn, pad, parse, sum, thisMonth, today, ymd } from './util';

export const NO_BANK = '은행 미지정';
export const bankOf = (a: any) => a?.bank || NO_BANK;
/** 만기일: 가입일 + 기간(개월). 둘 중 하나라도 없으면 null */
export function maturity(a: any): string | null {
  if (!a?.start_date || !a?.term_months) return null;
  const d = parse(a.start_date);
  d.setMonth(d.getMonth() + Number(a.term_months));
  return ymd(d);
}
const savingsOf = (accountId: string, txs: any[]) =>
  txs.filter((t) => t.type === 'saving' && t.account_id === accountId)
    .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.created_at || '').localeCompare(b.created_at || ''));
/** 지금까지 납입한 횟수 = 앱에 적기 전 횟수 + 가계부의 저축 기록 수 */
export const paidRounds = (a: any, txs: any[]) => (Number(a?.prior_rounds) || 0) + savingsOf(a.id, txs).length;
/** 이 저축 기록이 몇 회차인지 */
export const roundOf = (tx: any, txs: any[], a: any) => (Number(a?.prior_rounds) || 0) + savingsOf(tx.account_id, txs).findIndex((t) => t.id === tx.id) + 1;
export const dday = (date: string) => {
  const n = Math.round((parse(date).getTime() - parse(today()).getTime()) / 86400000);
  return n > 0 ? `D-${n}` : n === 0 ? 'D-Day' : '만기 지남';
};

let applying: Promise<void> | null = null;

/** 고정 지출·수입을 정해진 날짜가 지나면 가계부에 한 번씩 등록한다 */
export function applyRecurring() {
  return (applying ??= (async () => {
    const [recs] = await Promise.all([load('recurring'), load('transactions'), load('accounts')]);
    const t = today(), cur = thisMonth();
    for (const r of recs) {
      if (r.active === false) continue;
      let m: string = r.start_month || (r.created_at || t).slice(0, 7);
      for (let guard = 0; m <= cur && guard < 240; guard++, m = addMonths(m, 1)) {
        const date = `${m}-${pad(Math.min(r.day || 1, daysIn(m)))}`;
        if (date > t) continue;
        if (r.type === 'saving') {
          // 기간이 정해진 적금은 모든 회차를 채우면 더 등록하지 않는다
          const acc = getRows('accounts').find((a) => a.id === r.account_id);
          if (acc?.term_months && paidRounds(acc, getRows('transactions')) >= Number(acc.term_months)) continue;
        }
        const exists = getRows('transactions').some((x) => x.recurring_id === r.id && (x.date || '').slice(0, 7) === m);
        if (!exists)
          await applySaving(await add('transactions', {
            date, type: r.type, amount: r.amount, category: r.category, method: r.method,
            account_id: r.type === 'saving' ? r.account_id : null,
            memo: r.name || r.memo || null, recurring_id: r.id,
          }), 1);
      }
    }
  })().finally(() => { applying = null; }));
}

/** 저축 내역만큼 넣는 계좌의 잔액을 늘리거나(sign 1) 되돌린다(sign -1) */
export async function applySaving(tx: any, sign: 1 | -1) {
  if (!tx || tx.type !== 'saving' || !tx.account_id) return;
  const acc = (await load('accounts')).find((a) => a.id === tx.account_id);
  if (acc) await update('accounts', acc.id, { balance: (Number(acc.balance) || 0) + sign * (Number(tx.amount) || 0) });
}

/** 가계부 입력 창에 붙이는 동작: 저축을 저장·수정·삭제하면 계좌 잔액도 맞춘다 */
export const txHooks = {
  afterSave: async (row: Row, prev?: Row, raw?: any) => {
    await applySaving(prev, -1);
    await applySaving(row, 1);
    // '고정 적금으로 등록'을 켰으면 같은 날짜·금액으로 고정 항목을 만든다
    if (raw?._fixed && row.type === 'saving' && row.account_id) {
      const recs = await load('recurring');
      if (!recs.some((r) => r.type === 'saving' && r.account_id === row.account_id && r.active !== false)) {
        const acc = (await load('accounts')).find((a) => a.id === row.account_id);
        const rec = await add('recurring', {
          name: acc?.name || '적금', type: 'saving', amount: row.amount, account_id: row.account_id,
          day: Number(row.date.slice(8)), start_month: row.date.slice(0, 7), active: true,
        });
        await update('transactions', row.id, { recurring_id: rec.id });
        await applyRecurring();
      }
    }
  },
  afterDelete: (row: Row) => { applySaving(row, -1); },
};

export function netWorth(accounts: any[], investments: any[]) {
  const assets =
    sum(accounts.filter((a) => a.kind !== 'debt'), (a) => a.balance) + sum(investments, (i) => i.current_value);
  const debts = sum(accounts.filter((a) => a.kind === 'debt'), (a) => a.balance);
  return { assets, debts, net: assets - debts };
}

/** 이번 달 순자산 기록을 현재 잔액으로 맞춘다 (월별 추이 그래프용) */
export async function syncSnapshot() {
  const [accounts, investments, snaps] = await Promise.all([load('accounts'), load('investments'), load('net_worth_snapshots')]);
  if (!accounts.length && !investments.length) return;
  const { assets, debts } = netWorth(accounts, investments);
  const month = thisMonth();
  const cur = snaps.find((s) => s.month === month);
  if (!cur) await add('net_worth_snapshots', { month, assets, debts });
  else if (Number(cur.assets) !== assets || Number(cur.debts) !== debts)
    await update('net_worth_snapshots', cur.id, { assets, debts });
}
