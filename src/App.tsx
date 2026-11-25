import { useEffect, useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import {
  BarChart3, BookOpen, CalendarDays, GraduationCap, HeartPulse, Home as HomeIcon, Menu, NotebookPen, Palette, Settings as SettingsIcon, Wallet,
} from 'lucide-react';
import { clearCache, isLocal, onNotify, supabase } from './lib/db';
import { applyRecurring } from './lib/finance';
import { clearGoogleToken, googleSignIn, saveGoogleToken } from './lib/gcal';
import Home from './pages/Home';
import Finance from './pages/Finance';
import Journal from './pages/Journal';
import Reading from './pages/Reading';
import Study from './pages/Study';
import Hobby from './pages/Hobby';
import Health from './pages/Health';
import Plan from './pages/Plan';
import Report from './pages/Report';
import Settings from './pages/Settings';

const NAV = [
  { to: '/', label: '홈', icon: HomeIcon },
  { to: '/finance', label: '경제', icon: Wallet },
  { to: '/journal', label: '일기·메모', icon: NotebookPen },
  { to: '/reading', label: '독서', icon: BookOpen },
  { to: '/study', label: '공부', icon: GraduationCap },
  { to: '/hobby', label: '취미', icon: Palette },
  { to: '/health', label: '건강', icon: HeartPulse },
  { to: '/plan', label: '계획', icon: CalendarDays },
  { to: '/report', label: '리포트', icon: BarChart3 },
  { to: '/settings', label: '설정', icon: SettingsIcon },
];
const BOTTOM = [NAV[0], NAV[1], NAV[2], NAV[7], { to: '/more', label: '더보기', icon: Menu }];
const MORE = [NAV[3], NAV[4], NAV[5], NAV[6], NAV[8], NAV[9]];

function Toasts() {
  const [items, setItems] = useState<{ id: number; m: string }[]>([]);
  useEffect(() => onNotify((m) => {
    const id = Date.now() + Math.random();
    setItems((p) => [...p, { id, m }]);
    setTimeout(() => setItems((p) => p.filter((x) => x.id !== id)), 4500);
  }), []);
  return <div className="toasts" aria-live="polite">{items.map((t) => <div key={t.id} className="toast">{t.m}</div>)}</div>;
}

function Login() {
  return (
    <div className="login">
      <h1>마이라이프</h1>
      <p className="muted">경제, 독서, 공부, 취미, 일기, 건강, 계획을 한곳에서 기록합니다.</p>
      <button className="btn" onClick={() => googleSignIn()}>Google 계정으로 로그인</button>
    </div>
  );
}

function More() {
  return (
    <>
      <h1>더보기</h1>
      <div className="more-list">
        {MORE.map((n) => <NavLink key={n.to} to={n.to}><n.icon size={20} />{n.label}</NavLink>)}
      </div>
    </>
  );
}

export default function App() {
  // undefined: 확인 중, null: 로그아웃 상태
  const [user, setUser] = useState<string | null | undefined>(isLocal ? 'local' : undefined);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      saveGoogleToken(data.session?.provider_token);
      setUser(data.session?.user.id ?? null);
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      saveGoogleToken(session?.provider_token);
      if (event === 'SIGNED_OUT') {
        clearCache();
        clearGoogleToken();
      }
      setUser(session?.user.id ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) applyRecurring();
  }, [user]);

  if (user === undefined) return <div className="login"><p className="muted">불러오는 중</p></div>;
  if (user === null) return <Login />;

  return (
    <div className="shell">
      <nav className="side">
        <div className="brand">마이라이프</div>
        {NAV.map((n) => <NavLink key={n.to} to={n.to} end={n.to === '/'}><n.icon size={18} />{n.label}</NavLink>)}
      </nav>
      <main className="main">
        {isLocal && <div className="banner">체험 모드입니다. 기록이 이 기기의 브라우저에만 저장됩니다. README의 설정을 마치면 폰과 PC에서 함께 쓸 수 있습니다.</div>}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/finance" element={<Finance />} />
          <Route path="/journal" element={<Journal />} />
          <Route path="/reading" element={<Reading />} />
          <Route path="/study" element={<Study />} />
          <Route path="/hobby" element={<Hobby />} />
          <Route path="/health" element={<Health />} />
          <Route path="/plan" element={<Plan />} />
          <Route path="/report" element={<Report />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/more" element={<More />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
      <nav className="bottom">
        {BOTTOM.map((n) => <NavLink key={n.to} to={n.to} end={n.to === '/'}><n.icon size={20} />{n.label}</NavLink>)}
      </nav>
      <Toasts />
    </div>
  );
}
