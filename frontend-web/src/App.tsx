import { useCallback, useEffect, useState } from 'react';
import { api, canUseWeb, Profile, tokenStore } from './api';
import { navigate, readRoute, Route } from './router';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { About } from './pages/About';

export function App() {
  const [route, setRoute] = useState<Route>(readRoute);
  const [token, setToken] = useState<string | null>(tokenStore.get);
  const [user, setUser] = useState<Profile | null>(null);
  const [checking, setChecking] = useState(Boolean(token));

  useEffect(() => {
    const onHash = () => setRoute(readRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const signOut = useCallback(() => { tokenStore.clear(); setToken(null); setUser(null); setChecking(false); navigate('home'); }, []);

  // Проверяем сохранённый токен при загрузке страницы.
  useEffect(() => {
    if (!token || user) return;
    let active = true;
    api<Profile>('me', {}, token)
      .then(p => { if (!active) return; if (canUseWeb(p)) { setUser(p); setChecking(false); } else signOut(); })
      .catch(() => { if (active) signOut(); });
    return () => { active = false; };
  }, [token, user, signOut]);

  const authed = Boolean(token && user);
  useEffect(() => {
    if (checking) return;
    if (route === 'admin' && !authed) navigate('login');
    if (route === 'login' && authed) navigate('admin');
  }, [route, authed, checking]);

  function onLogin(t: string, p: Profile) { tokenStore.set(t); setToken(t); setUser(p); setChecking(false); navigate('admin'); }

  async function logout() {
    if (token) { try { await api('logout', { method: 'POST' }, token); } catch { /* токен всё равно удаляем */ } }
    signOut();
  }

  if (route === 'admin') {
    if (!token || !user) return <div className="center-screen"><div className="spinner" /></div>;
    return <Dashboard token={token} user={user} onLogout={logout} onUnauthorized={signOut} />;
  }
  if (route === 'login') return <Login onLogin={onLogin} />;
  if (route === 'about') return <About />;
  return <Landing loggedIn={authed} />;
}
