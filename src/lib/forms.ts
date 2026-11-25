import type { Field } from '../components/ui';
import type { Settings } from './db';
import { bankOf, dday, maturity, paidRounds, roundOf } from './finance';
import { today, won } from './util';

/** 여러 화면(홈의 빠른 입력 포함)에서 함께 쓰는 입력 항목 정의 */

export const TX_TYPES = [{ value: 'expense', label: '지출' }, { value: 'income', label: '수입' }, { value: 'saving', label: '저축' }];
/**
 * 저축할 통장을 고르는 칸: 은행 > 통장명 > 넣는 계좌(자동).
 * 은행을 고르면 그 은행의 통장만 나오고, 통장명을 고르면 계좌번호와 월 납입액이 채워진다.
 */
export function savingFields(accounts: any[], txs: any[], recs: any[], v: any, mode: 'tx' | 'recurring'): Field[] {
  const targets = accounts.filter((a) => a.kind !== 'debt');
  if (!targets.length) return [{ key: '_none', label: '넣는 계좌', type: 'info', text: '경제 > 자산 탭에서 적금·예금 통장을 먼저 등록하세요.' }];
  const acc = targets.find((a) => a.id === v.account_id);
  const bank = v._bank || (acc ? bankOf(acc) : '');
  const out: Field[] = [
    { key: '_bank', label: '은행', type: 'select', required: true, half: true, options: [...new Set(targets.map(bankOf))], onPick: () => ({ account_id: null }) },
    {
      key: 'account_id', label: '통장명', type: 'select', required: true, half: true,
      options: targets.filter((a) => !bank || bankOf(a) === bank).map((a) => ({ value: a.id, label: a.name })),
      onPick: (id, cur) => {
        const a = targets.find((x) => x.id === id);
        return a ? { _bank: bankOf(a), ...(a.monthly_amount && !cur.amount ? { amount: a.monthly_amount } : {}) } : {};
      },
    },
    {
      key: '_no', label: '넣는 계좌', type: 'info',
      text: !acc ? '통장명을 고르면 자동으로 채워집니다.'
        : acc.account_no ? `${bankOf(acc)} ${acc.account_no}` : '계좌번호가 등록되지 않았습니다. 자산 탭에서 적어 두면 여기에 나옵니다.',
    },
  ];
  if (!acc) return out;
  const term = Number(acc.term_months) || 0, end = maturity(acc);
  const round = mode === 'tx' && v.id ? roundOf(v, txs, acc) : paidRounds(acc, txs) + (mode === 'tx' ? 1 : 0);
  out.push({
    key: '_round', label: '회차', type: 'info',
    text: (mode === 'tx' ? `${v.id ? '' : '이번이 '}${round}회차` : `지금까지 ${round}회 납입`)
      + (term ? ` / 총 ${term}회차 (${Math.floor(term / 12) ? Math.floor(term / 12) + '년' : ''}${term % 12 ? ' ' + (term % 12) + '개월' : ''})` : '')
      + (end ? ` · 만기 ${end} (${dday(end)})` : '')
      + (term && round > term ? ' · 총 회차를 넘었습니다' : ''),
  });
  if (mode === 'tx') {
    const rec = recs.find((r) => r.type === 'saving' && r.account_id === acc.id && r.active !== false);
    if (rec)
      out.push({
        key: '_fixedinfo', label: '고정 적금', type: 'info',
        text: `고정 적금입니다. 매달 ${rec.day}일에 ${won(rec.amount)}이 자동으로 기록됩니다.` + (v.recurring_id ? ' 이 내역이 이번 달의 고정 납입분입니다.' : v.id ? '' : ' 지금 적는 것은 추가 납입으로 기록됩니다.'),
      });
    else out.push({ key: '_fixed', label: '고정 적금으로 등록 (매달 같은 날, 같은 금액을 자동으로 기록)', type: 'checkbox' });
  }
  return out;
}

export const txFields = (s: Settings, accounts: any[], txs: any[], recs: any[]) => (v: any): Field[] => [
  { key: 'type', label: '구분', type: 'select', required: true, half: true, options: TX_TYPES },
  { key: 'date', label: '날짜', type: 'date', required: true, half: true },
  ...(v.type === 'saving'
    ? [
        ...savingFields(accounts, txs, recs, v, 'tx').slice(0, 3),
        { key: 'amount', label: '금액(원)', type: 'number', required: true, half: true, step: '1' } as Field,
        { key: 'memo', label: '메모', half: true } as Field,
        ...savingFields(accounts, txs, recs, v, 'tx').slice(3),
      ]
    : [
        { key: 'amount', label: '금액(원)', type: 'number', required: true, half: true, step: '1' } as Field,
        { key: 'category', label: '카테고리', type: 'select', required: true, half: true, options: v.type === 'income' ? s.incomeCats : s.expenseCats } as Field,
        { key: 'method', label: '결제 수단', type: 'select', half: true, options: s.methods } as Field,
        { key: 'memo', label: '메모', half: true } as Field,
      ]),
];
export const txDefaults = () => ({ type: 'expense', date: today() });

export const diaryFields: Field[] = [
  { key: 'date', label: '날짜', type: 'date', required: true },
  { key: 'mood', label: '오늘의 기분', type: 'mood' },
  { key: 'good', label: '잘한 일', type: 'textarea', rows: 2 },
  { key: 'bad', label: '아쉬운 일', type: 'textarea', rows: 2 },
  { key: 'thanks', label: '감사한 일', type: 'textarea', rows: 2 },
  { key: 'content', label: '자유롭게 쓰기', type: 'textarea', rows: 7 },
  { key: 'photos', label: '사진', type: 'photos' },
];

export const noteFields: Field[] = [
  { key: 'title', label: '제목', required: true },
  { key: 'content', label: '내용', type: 'textarea', rows: 7 },
  { key: 'tag', label: '분류', placeholder: '예: 아이디어, 위시리스트, 가보고 싶은 곳' },
  { key: 'pinned', label: '맨 위에 고정', type: 'checkbox' },
];

export const todoFields = (goals: any[]): Field[] => [
  { key: 'title', label: '할 일', required: true },
  { key: 'due', label: '기한', type: 'date', half: true },
  { key: 'goal_id', label: '연결할 목표', type: 'select', half: true, options: goals.map((g) => ({ value: g.id, label: g.title })) },
  { key: 'memo', label: '메모', type: 'textarea', rows: 2 },
];

export const weightFields: Field[] = [
  { key: 'date', label: '날짜', type: 'date', required: true, half: true },
  { key: 'kg', label: '체중(kg)', type: 'number', required: true, half: true, step: '0.1' },
];

export const eventFields: Field[] = [
  { key: 'title', label: '일정', required: true },
  { key: 'date', label: '날짜', type: 'date', required: true },
  { key: 'start_time', label: '시작 시각 (비우면 하루 종일)', type: 'time', half: true },
  { key: 'end_time', label: '끝 시각', type: 'time', half: true },
  { key: 'memo', label: '메모', type: 'textarea', rows: 2 },
];
