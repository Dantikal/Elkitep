import { useEffect, useState } from 'react';
import { formatDeadline } from './Courses';
import { Call, errText } from './ui';

type Item = {
  id: number; course_title: string; reason: string; cancelled_at: string; is_read: boolean;
  course_head: { email: string; study_number: string } | null;
  user: { id: number; study_number: string; email: string; military_unit: string };
  correct_answers: number | null; total: number | null; grade: number | null;
  tests: { quiz_id: number; title: string; module: number | null; correct_answers: number; total: number; grade: number }[];
};

/** Администратор: курстун башчылары жокко чыгарган жолдомолор жана себептери. */
export function CancelledReferrals({ call, onRead }: { call: Call; onRead: () => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [rev, setRev] = useState(0);
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState<number | null>(null);

  async function remove(i: Item) {
    if (!window.confirm(`Окуу номери ${i.user.study_number} боюнча жокко чыгарылган жолдомону бул бөлүмдөн өчүрөсүзбү?\nЖолдомо жокко чыгарылган бойдон калат.`)) return;
    setDeleting(i.id); setError('');
    try { await call(`admin/cancelled-referrals/${i.id}`, { method: 'DELETE' }); setItems(prev => prev.filter(x => x.id !== i.id)); }
    catch (e) { setError(errText(e, 'Өчүрүлгөн жок.')); } finally { setDeleting(null); }
  }
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    call<{ unread: number; items: Item[] }>('admin/cancelled-referrals')
      .then(d => { if (!active) return; setItems(d.items); if (d.unread) call('admin/cancelled-referrals', { method: 'POST' }).then(onRead).catch(() => undefined); })
      .catch(e => { if (active) setError(errText(e, 'Жүктөлгөн жок.')); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [call, rev, onRead]);
  const q = search.trim().toLowerCase();
  const shown = q ? items.filter(i => [i.user.study_number, i.user.email, i.course_title, i.reason, i.course_head?.email ?? ''].some(v => v.toLowerCase().includes(q))) : items;

  return <>
    <div className="page-head"><h1 className="page-title">Жокко чыгарылган жолдомолор</h1><span className="badge">{items.length}</span><button className="btn btn-ghost btn-sm" onClick={() => setRev(r => r + 1)}>Жаңылоо</button></div>
    <p className="muted">Курстун башчылары жокко чыгарган жолдомолор жана алардын себептери.</p>
    <div className="toolbar"><input className="search" placeholder="Издөө: окуу номери, email, курс, себеп" value={search} onChange={e => setSearch(e.target.value)} /></div>
    {error && <div className="alert" role="alert">{error}<button className="link-btn" onClick={() => setRev(r => r + 1)}>Кайра аракет кылуу</button></div>}
    {loading ? <div className="loading"><div className="spinner" /></div> : !error && (shown.length === 0 ? <p className="empty">Жокко чыгарылган жолдомолор жок.</p> :
      <div className="cancel-list">{shown.map(i => <article key={i.id} className={`cancel-card ${i.is_read ? '' : 'unread'}`}>
        <header>
          <div><strong className="num">Окуу номери: {i.user.study_number}</strong><small>{i.user.email} · {i.user.military_unit}</small></div>
          <span className="row-actions">{!i.is_read && <span className="pill pill-pending">Жаңы</span>}<button className="btn btn-sm btn-danger" disabled={deleting !== null} onClick={() => void remove(i)}>{deleting === i.id ? 'Өчүрүлүүдө…' : '⌫ Өчүрүү'}</button></span>
        </header>
        <div className="cancel-meta">
          <span>Курс: <strong>{i.course_title}</strong></span>
          {i.total != null && <span>Туура жооптор: <strong>{i.correct_answers} / {i.total}</strong></span>}
          {i.grade != null && <span>Баасы: <span className={`grade grade-${i.grade}`}>{i.grade}</span></span>}
        </div>
        <div className="cancel-reason"><span>Себеби</span><p>{i.reason}</p></div>
        <small>Жокко чыгарган: {i.course_head ? `${i.course_head.email} (${i.course_head.study_number})` : '—'} · {formatDeadline(i.cancelled_at)}</small>
      </article>)}</div>)}
  </>;
}
