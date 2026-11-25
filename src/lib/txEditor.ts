import { useEditor } from '../components/ui';
import { useSettings, useTable } from './db';
import { bankOf, txHooks } from './finance';
import { txDefaults, txFields } from './forms';

/** 가계부 내역 입력 창 (가계부 화면과 홈의 빠른 입력이 함께 쓴다) */
export function useTxEditor() {
  const s = useSettings();
  const accounts = useTable('accounts');
  const txs = useTable('transactions');
  const recs = useTable('recurring');
  const ed = useEditor('transactions', '내역', txFields(s, accounts, txs, recs), { defaults: txDefaults, ...txHooks });
  return {
    modal: ed.modal,
    // 고칠 때는 저장된 통장의 은행을 은행 칸에 미리 채운다
    open: (row?: Record<string, any>) => {
      const acc = row?.account_id && accounts.find((a) => a.id === row.account_id);
      ed.open(acc ? { ...row, _bank: bankOf(acc) } : row);
    },
  };
}
