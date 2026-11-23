import type { ReactNode } from 'react';
import { APK_URL, IOS_URL } from '../api';
import { navigate } from '../router';

export const appName = 'КУТ БИЛИМ 1.0';
export const platformTitle = 'Кыргыз республикасынын мамлекеттик чек ара кызматынын күжүрмөн даярдоо башкармалыгынын билим берүү платформасы';

function AndroidIcon() {
  return <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="currentColor" d="M17.6 9.48l1.84-3.18a.38.38 0 00-.66-.38l-1.86 3.22A11.4 11.4 0 0012 8.1c-1.77 0-3.43.38-4.92 1.04L5.22 5.92a.38.38 0 10-.66.38L6.4 9.48A10.8 10.8 0 001 18h22a10.8 10.8 0 00-5.4-8.52zM7 15.25a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5zm10 0a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5z" /></svg>;
}
function AppleIcon() {
  return <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="currentColor" d="M16.37 12.6c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.47.83-.72 0-1.82-.81-3-.79a4.43 4.43 0 00-3.74 2.27c-1.6 2.77-.41 6.87 1.15 9.12.76 1.1 1.67 2.33 2.86 2.29 1.15-.05 1.58-.74 2.97-.74 1.38 0 1.78.74 2.99.72 1.24-.02 2.02-1.12 2.77-2.22a9.9 9.9 0 001.26-2.58 3.98 3.98 0 01-2.43-3.64zM14.1 5.86A3.97 3.97 0 0015.03 3a4.05 4.05 0 00-2.62 1.36 3.8 3.8 0 00-.95 2.77 3.35 3.35 0 002.64-1.27z" /></svg>;
}

function StoreButton({ href, icon, small, big }: { href: string; icon: ReactNode; small: string; big: string }) {
  const ready = Boolean(href);
  const content = <>{icon}<span className="store-text"><small>{ready ? small : 'Жакында'}</small><strong>{big}</strong></span></>;
  return ready
    ? <a className="store-btn" href={href} download={href.endsWith('.apk') ? '' : undefined}>{content}</a>
    : <button className="store-btn" disabled title="Жакында жеткиликтүү болот">{content}</button>;
}

// Декоративные частицы: позиция, размер, длительность и задержка анимации.
const particles = Array.from({ length: 28 }, (_, i) => ({
  left: (i * 37) % 100,
  size: 4 + ((i * 7) % 9),
  duration: 14 + ((i * 5) % 16),
  delay: -((i * 3.7) % 20),
}));

export function AnimatedBackground() {
  return <div className="bg-anim" aria-hidden="true">
    <div className="blob blob-1" />
    <div className="blob blob-2" />
    <div className="blob blob-3" />
    <div className="grid-lines" />
    <svg className="waves" viewBox="0 0 1440 320" preserveAspectRatio="none">
      <path className="wave wave-1" d="M0,224 C240,160 480,288 720,224 C960,160 1200,288 1440,224 L1440,320 L0,320 Z" />
      <path className="wave wave-2" d="M0,256 C240,208 480,304 720,256 C960,208 1200,304 1440,256 L1440,320 L0,320 Z" />
    </svg>
    {particles.map((p, i) => <span key={i} className="particle" style={{ left: `${p.left}%`, width: p.size, height: p.size, animationDuration: `${p.duration}s`, animationDelay: `${p.delay}s` }} />)}
  </div>;
}

export function Landing({ loggedIn }: { loggedIn: boolean }) {
  return <div className="landing">
    <AnimatedBackground />
    <header className="topbar">
      <div className="brand"><img src="/logo.webp" alt="" /><span>{appName}</span></div>
      <div className="topbar-actions">
        <button className="btn btn-about" onClick={() => navigate('about')}><span className="btn-about-dot" />Тиркеме боюнча</button>
        <button className="btn btn-ghost" onClick={() => navigate(loggedIn ? 'admin' : 'login')}>{loggedIn ? 'Башкаруу панели' : 'Кирүү'}</button>
      </div>
    </header>
    <main className="hero">
      <div className="logo-wrap">
        <span className="ring ring-1" /><span className="ring ring-2" /><span className="ring ring-3" />
        <img className="hero-logo" src="/logo.webp" alt="Чек ара кызматынын логотиби" />
      </div>
      <h1>{appName}</h1>
      <p className="hero-sub">{platformTitle}</p>
      <div className="store-row">
        <StoreButton href={APK_URL} icon={<AndroidIcon />} small="APK жүктөп алуу" big="Android" />
        <StoreButton href={IOS_URL} icon={<AppleIcon />} small="Жүктөп алуу" big="iOS" />
      </div>
      {!APK_URL && !IOS_URL && <p className="muted">Колдонмо жакында жүктөп алууга жеткиликтүү болот.</p>}
    </main>
    <footer className="footer">© {new Date().getFullYear()} {appName}</footer>
  </div>;
}
