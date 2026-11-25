import { ReactNode, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ImagePlus, Star, X } from 'lucide-react';
import { add, notify, remove, Row, update } from '../lib/db';
import { deletePhoto, uploadPhoto, usePhotoUrl } from '../lib/photos';
import { addMonths, daysIn, fmtMonth, MOODS, parse, today } from '../lib/util';

export type Opt = string | { value: string; label: string };
export type Field = {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'time' | 'month' | 'select' | 'textarea' | 'rating' | 'mood' | 'checkbox' | 'photos' | 'info';
  options?: Opt[];
  required?: boolean;
  placeholder?: string;
  half?: boolean;
  step?: string;
  rows?: number;
  /** type 'info': 입력 없이 보여 주기만 하는 안내 문구 */
  text?: string;
  /** 글자 입력 칸에 띄울 추천 목록 */
  suggest?: string[];
  /** 값을 고르면 다른 칸도 함께 바꾼다. 돌려준 값이 입력 내용에 덮어써진다 */
  onPick?: (value: any, current: any) => Record<string, any>;
};
export type Fields = Field[] | ((v: any) => Field[]);

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'modal' + (wide ? ' wide' : '')} role="dialog" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="닫기"><X size={20} /></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Rating({ value, onChange }: { value: number; onChange?: (n: number) => void }) {
  return (
    <span className="rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button type="button" key={n} disabled={!onChange} onClick={() => onChange?.(value === n ? 0 : n)} aria-label={`별점 ${n}`}>
          <Star size={onChange ? 26 : 14} fill={n <= (value || 0) ? 'currentColor' : 'none'} />
        </button>
      ))}
    </span>
  );
}

function Photo({ refPath, onRemove }: { refPath: string; onRemove?: () => void }) {
  const url = usePhotoUrl(refPath);
  return (
    <span className="photo">
      {url ? <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="첨부 사진" /></a> : <span className="photo-ph" />}
      {onRemove && <button type="button" onClick={onRemove} aria-label="사진 삭제"><X size={14} /></button>}
    </span>
  );
}

export function Photos({ value }: { value?: string[] }) {
  if (!value?.length) return null;
  return <div className="photos">{value.map((p) => <Photo key={p} refPath={p} />)}</div>;
}

function PhotoInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [busy, setBusy] = useState(false);
  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const added: string[] = [];
      for (const f of Array.from(files)) added.push(await uploadPhoto(f));
      onChange([...value, ...added]);
    } catch (e: any) {
      notify(`사진을 올리지 못했습니다: ${e.message || e}`);
    }
    setBusy(false);
  };
  return (
    <div className="photos">
      {value.map((p) => (
        <Photo key={p} refPath={p} onRemove={() => { deletePhoto(p); onChange(value.filter((x) => x !== p)); }} />
      ))}
      <label className="photo-add">
        <ImagePlus size={20} />
        <span>{busy ? '올리는 중' : '사진 추가'}</span>
        <input type="file" accept="image/*" multiple hidden disabled={busy} onChange={(e) => { pick(e.target.files); e.target.value = ''; }} />
      </label>
    </div>
  );
}

const optVal = (o: Opt) => (typeof o === 'string' ? o : o.value);
const optLabel = (o: Opt) => (typeof o === 'string' ? o : o.label);

export function FormModal({ title, fields, initial, onSave, onDelete, onClose }: {
  title: string; fields: Fields; initial: any; onSave: (v: any) => void; onDelete?: () => void; onClose: () => void;
}) {
  const [v, setV] = useState<any>(initial);
  const [confirm, setConfirm] = useState(false);
  const fs = typeof fields === 'function' ? fields(v) : fields;
  const set = (k: string, val: any, f?: Field) => setV((p: any) => ({ ...p, [k]: val, ...f?.onPick?.(val, p) }));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const out = { ...v };
    for (const f of fs) {
      if (f.type === 'info') continue;
      let x = out[f.key];
      if (x === '' || x === undefined) x = f.type === 'checkbox' ? false : f.type === 'photos' ? [] : null;
      else if (f.type === 'number') x = Number(x);
      out[f.key] = x;
    }
    onSave(out);
  };
  return (
    <Modal title={title} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        {fs.map((f) => {
          const val = v[f.key] ?? '';
          const id = 'f-' + f.key;
          let input: ReactNode;
          if (f.type === 'info')
            return <div key={f.key} className="field"><span className="field-label">{f.label}</span><p className="info">{f.text}</p></div>;
          if (f.type === 'select')
            input = (
              <select id={id} value={val} required={f.required} onChange={(e) => set(f.key, e.target.value, f)}>
                <option value="">선택</option>
                {val && !f.options!.some((o) => optVal(o) === val) && <option value={val}>{val}</option>}
                {f.options!.map((o) => <option key={optVal(o)} value={optVal(o)}>{optLabel(o)}</option>)}
              </select>
            );
          else if (f.type === 'textarea')
            input = <textarea id={id} value={val} rows={f.rows || 4} required={f.required} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value)} />;
          else if (f.type === 'rating') input = <Rating value={Number(val) || 0} onChange={(n) => set(f.key, n)} />;
          else if (f.type === 'mood')
            input = (
              <div className="mood">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button type="button" key={n} className={Number(val) === n ? 'on' : ''} onClick={() => set(f.key, n)}>
                    <b>{n}</b><span>{MOODS[n]}</span>
                  </button>
                ))}
              </div>
            );
          else if (f.type === 'checkbox')
            return (
              <label key={f.key} className="check-row">
                <input type="checkbox" checked={!!v[f.key]} onChange={(e) => set(f.key, e.target.checked)} /> {f.label}
              </label>
            );
          else if (f.type === 'photos') input = <PhotoInput value={v[f.key] || []} onChange={(x) => set(f.key, x)} />;
          else
            input = (
              <>
                <input
                  id={id} type={f.type || 'text'} value={val} required={f.required} placeholder={f.placeholder}
                  step={f.type === 'number' ? f.step || 'any' : undefined}
                  inputMode={f.type === 'number' ? 'decimal' : undefined}
                  list={f.suggest ? id + '-list' : undefined}
                  onChange={(e) => set(f.key, e.target.value)}
                />
                {f.suggest && <datalist id={id + '-list'}>{f.suggest.map((o) => <option key={o} value={o} />)}</datalist>}
              </>
            );
          return (
            <div key={f.key} className={'field' + (f.half ? ' half' : '')}>
              <label htmlFor={id}>{f.label}</label>
              {input}
            </div>
          );
        })}
        <div className="form-foot">
          {onDelete && (confirm
            ? <button type="button" className="btn danger" onClick={onDelete}>정말 삭제</button>
            : <button type="button" className="btn ghost danger-text" onClick={() => setConfirm(true)}>삭제</button>)}
          <span className="grow" />
          <button type="button" className="btn ghost" onClick={onClose}>취소</button>
          <button type="submit" className="btn">저장</button>
        </div>
      </form>
    </Modal>
  );
}

/** 표 하나를 추가·수정·삭제하는 입력 창. open()은 새로 만들기, open(row)는 고치기 */
export function useEditor(table: string, title: string, fields: Fields, opts?: {
  defaults?: () => Record<string, any>;
  /** raw: 저장하지 않는 임시 칸(이름이 _로 시작)까지 포함한 입력 내용 */
  afterSave?: (row: Row, prev?: Row, raw?: any) => void;
  afterDelete?: (row: Row) => void;
}) {
  const [cur, setCur] = useState<any>(null);
  const close = () => setCur(null);
  const modal = cur && (
    <FormModal
      title={cur.id ? `${title} 수정` : `${title} 추가`}
      fields={fields}
      initial={cur}
      onClose={close}
      onSave={async (raw) => {
        close();
        const v = Object.fromEntries(Object.entries(raw).filter(([k]) => !k.startsWith('_')));
        if (cur.id) {
          await update(table, cur.id, v);
          opts?.afterSave?.({ ...cur, ...v }, cur, raw);
        } else {
          const row = await add(table, v);
          opts?.afterSave?.(row, undefined, raw);
        }
      }}
      onDelete={cur.id ? async () => { close(); await remove(table, cur.id); opts?.afterDelete?.(cur); } : undefined}
    />
  );
  return { open: (row?: Record<string, any>) => setCur({ ...(row?.id ? {} : opts?.defaults?.()), ...row }), modal };
}

export function Card({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={'card ' + (className || '')}>
      {(title || action) && <div className="card-head"><h3>{title}</h3>{action}</div>}
      {children}
    </section>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'pos' | 'neg' }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <b className={tone || ''}>{value}</b>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  );
}

export function Tabs({ tabs, value, onChange }: { tabs: string[]; value: string; onChange: (t: string) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t} role="tab" aria-selected={t === value} className={t === value ? 'on' : ''} onClick={() => onChange(t)}>{t}</button>
      ))}
    </div>
  );
}

export const Empty = ({ children }: { children: ReactNode }) => <p className="empty">{children}</p>;

export function Progress({ value, max, over }: { value: number; max: number; over?: boolean }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return <div className="progress"><div className={over ? 'over' : ''} style={{ width: pct + '%' }} /></div>;
}

export function MonthNav({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  return (
    <div className="month-nav">
      <button className="icon-btn" onClick={() => onChange(addMonths(month, -1))} aria-label="이전 달"><ChevronLeft size={20} /></button>
      <b>{fmtMonth(month)}</b>
      <button className="icon-btn" onClick={() => onChange(addMonths(month, 1))} aria-label="다음 달"><ChevronRight size={20} /></button>
    </div>
  );
}

export function PageHead({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="page-head"><h1>{title}</h1><div className="row">{children}</div></div>;
}

/** 월 달력. render는 날짜 칸 안에 넣을 내용을 돌려준다 */
export function MonthGrid({ month, selected, onPick, render }: {
  month: string; selected?: string; onPick: (date: string) => void; render?: (date: string) => ReactNode;
}) {
  const lead = (parse(month + '-01').getDay() + 6) % 7;
  const t = today();
  return (
    <div className="cal">
      {['월', '화', '수', '목', '금', '토', '일'].map((d) => <div key={d} className="cal-dow">{d}</div>)}
      {Array.from({ length: lead }, (_, i) => <div key={'b' + i} />)}
      {Array.from({ length: daysIn(month) }, (_, i) => {
        const date = `${month}-${String(i + 1).padStart(2, '0')}`;
        return (
          <button key={date} className={'cal-day' + (date === t ? ' today' : '') + (date === selected ? ' sel' : '')} onClick={() => onPick(date)}>
            <span className="cal-num">{i + 1}</span>
            {render?.(date)}
          </button>
        );
      })}
    </div>
  );
}
