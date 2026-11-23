import { FormEvent, useState } from 'react';
import { api, canUseWeb, Profile } from '../api';
import { navigate } from '../router';
import { AnimatedBackground, appName } from './Landing';

export function Login({ onLogin }: { onLogin: (token: string, user: Profile) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await api<{ token: string; user: Profile }>('login', { method: 'POST', body: JSON.stringify({ email, password }) });
      if (!canUseWeb(res.user)) {
        await api('logout', { method: 'POST' }, res.token).catch(() => undefined);
        setError('Веб-кабинет администратор жана курстун башчысы үчүн гана жеткиликтүү.');
        return;
      }
      onLogin(res.token, res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ката кетти.');
    } finally { setLoading(false); }
  }

  return <div className="landing">
    <AnimatedBackground />
    <header className="topbar">
      <button className="brand brand-btn" onClick={() => navigate('home')}><img src="/logo.webp" alt="" /><span>{appName}</span></button>
      <button className="btn btn-ghost" onClick={() => navigate('home')}>← Башкы бет</button>
    </header>
    <main className="login-page">
      <form className="login-card" onSubmit={submit}>
        <img src="/logo.webp" alt="" className="login-logo" />
        <h1>{appName}</h1>
        <p className="muted">Администратор жана курстун башчысы үчүн кирүү</p>
        <label>Gmail / Email<input type="email" autoComplete="username" autoFocus required value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label>Сырсөз<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label>
        {error && <div className="alert" role="alert">{error}</div>}
        <button className="btn btn-primary" disabled={loading}>{loading ? 'Күтө туруңуз…' : 'Кирүү'}</button>
      </form>
    </main>
    <footer className="footer">© {new Date().getFullYear()} {appName}</footer>
  </div>;
}
