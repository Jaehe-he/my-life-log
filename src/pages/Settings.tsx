import { useEffect, useRef, useState } from 'react';
import { Card, PageHead } from '../components/ui';
import { add, isLocal, load, notify, setSetting, supabase, TABLES, useSettings } from '../lib/db';
import { gcalConnected, googleSignIn } from '../lib/gcal';
import { photoUsage } from '../lib/photos';
import { today } from '../lib/util';

function ListSetting({ label, k, value }: { label: string; k: 'expenseCats' | 'incomeCats' | 'methods'; value: string[] }) {
  const [text, setText] = useState(value.join(', '));
  useEffect(() => setText(value.join(', ')), [value.join(',')]);
  const save = () => {
    const list = [...new Set(text.split(',').map((x) => x.trim()).filter(Boolean))];
    if (list.length && list.join(',') !== value.join(',')) setSetting(k, list);
  };
  return (
    <div className="field">
      <label htmlFor={'set-' + k}>{label} (쉼표로 구분)</label>
      <input id={'set-' + k} value={text} onChange={(e) => setText(e.target.value)} onBlur={save} />
    </div>
  );
}

function NumSetting({ label, k, value }: { label: string; k: 'targetWeight' | 'waterGoal'; value: number | null }) {
  const [text, setText] = useState(value ?? '');
  useEffect(() => setText(value ?? ''), [value]);
  return (
    <div className="field half">
      <label htmlFor={'set-' + k}>{label}</label>
      <input id={'set-' + k} type="number" inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)}
        onBlur={() => { const n = text === '' ? null : Number(text); if (n !== value) setSetting(k, n); }} />
    </div>
  );
}

export default function Settings() {
  const s = useSettings();
  const [theme, setTheme] = useState(localStorage.getItem('ml:theme') || 'system');
  const [email, setEmail] = useState('');
  const [usage, setUsage] = useState<number | null>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase?.auth.getUser().then(({ data }) => setEmail(data.user?.email || ''));
    photoUsage().then(setUsage);
  }, []);

  const applyTheme = (t: string) => {
    setTheme(t);
    if (t === 'system') { localStorage.removeItem('ml:theme'); delete document.documentElement.dataset.theme; }
    else { localStorage.setItem('ml:theme', t); document.documentElement.dataset.theme = t; }
  };

  const exportAll = async () => {
    const out: Record<string, any[]> = {};
    for (const t of TABLES) out[t] = await load(t);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' }));
    a.download = `mylife-backup-${today()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importAll = async (f?: File) => {
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      let n = 0;
      for (const t of TABLES) {
        if (!Array.isArray(data[t])) continue;
        const have = new Set((await load(t)).map((r) => r.id));
        for (const row of data[t]) {
          if (have.has(row.id)) continue;
          const { user_id, ...clean } = row;
          await add(t, clean);
          n++;
        }
      }
      notify(`${n}개 기록을 가져왔습니다.`);
    } catch {
      notify('백업 파일을 읽지 못했습니다. 이 앱에서 내보낸 파일인지 확인하세요.');
    }
  };

  return (
    <>
      <PageHead title="설정" />
      <Card title="화면">
        <div className="chips">
          {[['system', '기기 설정 따름'], ['light', '밝게'], ['dark', '어둡게']].map(([v, l]) => (
            <button key={v} className={'chip' + (theme === v ? ' on' : '')} onClick={() => applyTheme(v)}>{l}</button>
          ))}
        </div>
      </Card>
      <Card title="가계부 분류">
        <ListSetting label="지출 카테고리" k="expenseCats" value={s.expenseCats} />
        <ListSetting label="수입 카테고리" k="incomeCats" value={s.incomeCats} />
        <ListSetting label="결제 수단" k="methods" value={s.methods} />
        <p className="small muted">이름을 바꿔도 이미 적은 내역의 카테고리는 그대로 남습니다.</p>
      </Card>
      <Card title="건강 목표">
        <div className="form">
          <NumSetting label="목표 체중(kg)" k="targetWeight" value={s.targetWeight} />
          <NumSetting label="하루 물 목표(ml)" k="waterGoal" value={s.waterGoal} />
        </div>
      </Card>
      <Card title="백업">
        <p className="small muted">모든 기록을 파일 하나로 내려받습니다. 사진 파일은 포함되지 않습니다. 가져오기는 이미 있는 기록을 건너뛰고 없는 것만 더합니다.</p>
        <div className="row">
          <button className="btn" onClick={exportAll}>전체 기록 내보내기</button>
          <button className="btn ghost" onClick={() => file.current?.click()}>백업 파일 가져오기</button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => { importAll(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
      </Card>
      {isLocal ? (
        <Card title="계정">
          <p className="small muted">체험 모드입니다. 기록이 이 기기의 브라우저에만 저장됩니다. README의 설정을 마치면 구글 로그인과 기기 간 동기화가 켜집니다. 그 전에 적은 기록은 내보내기 후 가져오기로 옮길 수 있습니다.</p>
        </Card>
      ) : (
        <Card title="계정">
          <p>{email}</p>
          <p className="small muted">구글 캘린더: {gcalConnected() ? '연결됨' : '연결이 만료되었습니다'}</p>
          {usage !== null && <p className="small muted">사진 저장 공간: {(usage / 1024 / 1024).toFixed(1)}MB / 1,024MB 사용</p>}
          <div className="row">
            {!gcalConnected() && <button className="btn" onClick={() => googleSignIn()}>구글 다시 연결</button>}
            <button className="btn ghost" onClick={() => supabase!.auth.signOut()}>로그아웃</button>
          </div>
        </Card>
      )}
    </>
  );
}
