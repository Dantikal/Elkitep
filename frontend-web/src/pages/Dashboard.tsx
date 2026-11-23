import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, Category, categoryLabel, fetchBlobUrl, Profile, Role, roleLabel, Status, statusLabel } from '../api';
import { navigate } from '../router';
import { appName } from './Landing';
import { CommandTraining } from './CommandTraining';
import { CancelledReferrals } from './CancelledReferrals';
import { CourseBrowser, MyCourses, Section as CourseSection, Tab as CourseTab, tabs as courseTabs } from './Courses';

type Application = { id: number; email: string; study_number: string; military_unit: string; status: Status; date_joined: string; has_photo: boolean; training_category: Category; role: Role };
type Page = { count: number; next: string | null; results: Application[] };
type Deputy = { id: number; study_number: string; email: string; status: Status };
type DeputyGroup = { military_unit: string; deputies: Deputy[] };
type UnitUser = { id: number; email: string; study_number: string; role: Role; training_category: Category; status: Status };
type QuizReportUser = { id: number; email: string; study_number: string; submitted: boolean };
type QuizHistory = { user: { id: number; email: string; study_number: string; military_unit: string; training_category: Category }; attempts: { id: number; title: string; topic: string; date: string; status: string; grade: number; correct_answers: number; total: number }[] };
type Section = 'overview' | 'applications' | 'users' | 'quizzes' | 'command' | 'courses' | 'my-courses' | 'cancelled';

type NavItem = { id: Section; label: string; icon: string; hint: string };
// Администратор видит всё; курстун башчысы — только курсы (как в мобильном приложении).
const adminSections: NavItem[] = [
  { id: 'overview', label: 'Шолуу', icon: '◎', hint: '' },
  { id: 'applications', label: 'Өтүнмөлөр', icon: '✉', hint: 'Каттоо өтүнмөлөрүн карап чыгуу' },
  { id: 'command', label: 'Командирдик даярдоо', icon: '★', hint: 'Предметтер, темалар, материалдар жана тесттер' },
  { id: 'courses', label: 'Окуу курстары', icon: '▥', hint: 'Бардык курстар, бөлүмдөр жана материалдар' },
  { id: 'users', label: 'Колдонуучулар', icon: '☰', hint: 'Аскер бөлүктөр жана колдонуучулар' },
  { id: 'quizzes', label: 'Тест жыйынтыктары', icon: '✓', hint: 'Колдонуучулардын тест тарыхы' },
  { id: 'cancelled', label: 'Жокко чыгарылган жолдомолор', icon: '✕', hint: 'Курстун башчылары жокко чыгарган жолдомолор жана себептери' },
];
const courseHeadSections: NavItem[] = [
  { id: 'my-courses', label: 'Менин курстарым', icon: '★', hint: '' },
  { id: 'courses', label: 'Окуу курстары', icon: '▥', hint: '' },
];
const filters: { value: Status | 'all'; label: string }[] = [
  { value: 'pending', label: 'Күтүүдө' }, { value: 'approved', label: 'Ырасталган' }, { value: 'rejected', label: 'Четке кагылган' }, { value: 'all', label: 'Баары' },
];
const fmtDate = (iso: string) => new Date(iso).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });

type Ctx = { token: string; call: <T>(path: string, init?: RequestInit) => Promise<T> };

export function Dashboard({ token, user, onLogout, onUnauthorized }: { token: string; user: Profile; onLogout: () => Promise<void>; onUnauthorized: () => void }) {
  const isAdmin = user.is_superuser;
  const sections = isAdmin ? adminSections : courseHeadSections;
  const [section, setSection] = useState<Section>(isAdmin ? 'overview' : 'my-courses');
  const [coursesKey, setCoursesKey] = useState(0);
  const [myCourse, setMyCourse] = useState<CourseSection | null>(null);
  const [myTab, setMyTab] = useState<CourseTab>('topics');
  const [cancelledUnread, setCancelledUnread] = useState(0);
  const open = (id: Section) => { setSection(id); setCoursesKey(k => k + 1); setMyCourse(null); setMyTab('topics'); setMenuOpen(false); };
  // При переименовании того же курса вкладку не сбрасываем.
  const openMyCourse = (c: CourseSection | null) => { if (!c || c.id !== myCourse?.id) setMyTab('topics'); setMyCourse(c); };
  const [menuOpen, setMenuOpen] = useState(false);
  const call = useCallback(async <T,>(path: string, init?: RequestInit) => {
    try { return await api<T>(path, init, token); }
    catch (e) { if (e instanceof ApiError && e.status === 401) onUnauthorized(); throw e; }
  }, [token, onUnauthorized]);
  const ctx: Ctx = { token, call };
  useEffect(() => {
    if (!isAdmin || section === 'cancelled') return;
    const load = () => call<{ unread: number }>('admin/cancelled-referrals').then(d => setCancelledUnread(d.unread)).catch(() => undefined);
    void load(); const t = window.setInterval(load, 30000); return () => window.clearInterval(t);
  }, [isAdmin, section, call]);
  const markCancelledRead = useCallback(() => setCancelledUnread(0), []);

  return <div className="dash">
    <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
      <button className="brand brand-btn" onClick={() => navigate('home')}><img src="/logo.webp" alt="" /><span>{appName}</span></button>
      <nav>{sections.map(s => <div key={s.id}>
        <button className={`nav-item ${section === s.id && !(s.id === 'my-courses' && myCourse) ? 'active' : ''}`} onClick={() => open(s.id)}><span className="nav-icon">{s.icon}</span><span className="grow">{s.label}</span>{s.id === 'cancelled' && cancelledUnread > 0 && <span className="nav-badge">{cancelledUnread}</span>}</button>
        {s.id === 'my-courses' && section === 'my-courses' && myCourse && <div className="nav-sub">
          <div className="nav-sub-title" title={myCourse.title}>{myCourse.title}</div>
          {courseTabs.map(t => <button key={t.id} className={`nav-subitem ${myTab === t.id ? 'active' : ''}`} onClick={() => { setMyTab(t.id); setMenuOpen(false); }}>{t.title}</button>)}
        </div>}
      </div>)}</nav>
      <div className="sidebar-foot">
        <div className="who"><strong>{isAdmin ? 'Администратор' : roleLabel(user.role)}</strong><span>{user.email}</span></div>
        <button className="btn btn-ghost btn-block" onClick={() => void onLogout()}>Чыгуу</button>
      </div>
    </aside>
    {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} />}
    <main className="dash-main">
      <div className="mobile-bar"><button className="btn btn-ghost" onClick={() => setMenuOpen(true)} aria-label="Меню">☰</button><strong>{section === 'my-courses' && myCourse ? `${myCourse.title} · ${courseTabs.find(t => t.id === myTab)?.title}` : sections.find(s => s.id === section)?.label}</strong></div>
      {isAdmin && section === 'overview' && <Overview ctx={ctx} go={open} />}
      {isAdmin && section === 'applications' && <Applications ctx={ctx} />}
      {isAdmin && section === 'users' && <Users ctx={ctx} />}
      {isAdmin && section === 'quizzes' && <QuizResults ctx={ctx} />}
      {isAdmin && section === 'command' && <CommandTraining call={call} />}
      {isAdmin && section === 'cancelled' && <CancelledReferrals call={call} onRead={markCancelledRead} />}
      {section === 'courses' && <CourseBrowser key={coursesKey} call={call} isAdmin={isAdmin} isCourseHead={user.role === 'course_head'} onMyCourses={user.role === 'course_head' ? () => open('my-courses') : undefined} />}
      {section === 'my-courses' && <MyCourses key={coursesKey} call={call} onAllCourses={() => open('courses')} course={myCourse} setCourse={openMyCourse} tab={myTab} setTab={setMyTab} />}
    </main>
  </div>;
}

function ErrorBox({ message, retry }: { message: string; retry?: () => void }) {
  return <div className="alert" role="alert">{message}{retry && <button className="link-btn" onClick={retry}>Кайра аракет кылуу</button>}</div>;
}
const Loading = () => <div className="loading"><div className="spinner" /></div>;

function Overview({ ctx, go }: { ctx: Ctx; go: (s: Section) => void }) {
  const [counts, setCounts] = useState<Record<string, number | null>>({ pending: null, approved: null, rejected: null });
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    Promise.all((['pending', 'approved', 'rejected'] as const).map(s => ctx.call<Page>(`admin/applications?status=${s}&page=1`).then(p => [s, p.count] as const)))
      .then(r => { if (active) setCounts(Object.fromEntries(r)); })
      .catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [ctx.call]);
  const cards = [
    { key: 'pending', label: 'Күтүүдөгү өтүнмөлөр', tone: 'warn' },
    { key: 'approved', label: 'Ырасталган колдонуучулар', tone: 'ok' },
    { key: 'rejected', label: 'Четке кагылган', tone: 'bad' },
  ];
  return <>
    <h1 className="page-title">Башкаруу панели</h1>
    {error && <ErrorBox message={error} />}
    <div className="stats">{cards.map(c => <button key={c.key} className={`stat stat-${c.tone}`} onClick={() => go('applications')}><span>{c.label}</span><strong>{counts[c.key] ?? '—'}</strong></button>)}</div>
    <div className="tiles">
      {adminSections.filter(s => s.id !== 'overview').map(s => <button key={s.id} className="tile" onClick={() => go(s.id)}><span className="nav-icon">{s.icon}</span><div><strong>{s.label}</strong><small>{s.hint}</small></div><span className="arrow">→</span></button>)}
    </div>
  </>;
}

function Photo({ id, token, email }: { id: number; token: string; email: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let url: string | null = null; let active = true;
    fetchBlobUrl(`admin/applications/${id}/photo`, token).then(u => { url = u; if (active) setSrc(u); else URL.revokeObjectURL(u); }).catch(() => undefined);
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [id, token]);
  if (!src) return <div className="avatar">{email.charAt(0).toUpperCase()}</div>;
  return <>
    <img className="avatar" src={src} alt="" onClick={() => setOpen(true)} />
    {open && <div className="modal-bg" onClick={() => setOpen(false)}><img className="photo-full" src={src} alt={email} /></div>}
  </>;
}

function Applications({ ctx }: { ctx: Ctx }) {
  const [filter, setFilter] = useState<Status | 'all'>('pending');
  const [items, setItems] = useState<Application[]>([]);
  const [count, setCount] = useState(0); const [page, setPage] = useState(1); const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const [saving, setSaving] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const reqId = useRef(0);

  const load = useCallback(async (next = 1) => {
    const id = ++reqId.current;
    setLoading(true); setError('');
    try {
      const r = await ctx.call<Page>(`admin/applications?status=${filter}&page=${next}`);
      if (id !== reqId.current) return;
      setItems(prev => next === 1 ? r.results : [...prev, ...r.results]);
      setCount(r.count); setPage(next); setHasNext(Boolean(r.next));
    } catch (e) { if (id === reqId.current) setError(e instanceof Error ? e.message : 'Ката кетти.'); }
    finally { if (id === reqId.current) setLoading(false); }
  }, [ctx.call, filter]);
  useEffect(() => { setItems([]); void load(1); }, [load]);

  async function decide(item: Application, decision: 'approved' | 'rejected') {
    const text = decision === 'approved' ? `Өтүнмөнү ырастоо?\n${item.email}` : `Өтүнмөнү четке кагуу?\n${item.email}\nКолдонуучу системадан чыгарылат.`;
    if (!window.confirm(text)) return;
    setSaving(item.id); setError('');
    try { await ctx.call(`admin/applications/${item.id}/decision`, { method: 'POST', body: JSON.stringify({ decision }) }); await load(1); }
    catch (e) { setError(e instanceof Error ? e.message : 'Ката кетти.'); }
    finally { setSaving(null); }
  }

  const q = search.trim().toLowerCase();
  const visible = q ? items.filter(i => [i.email, i.study_number, i.military_unit].some(v => v.toLowerCase().includes(q))) : items;

  return <>
    <div className="page-head"><h1 className="page-title">Өтүнмөлөр</h1><span className="badge">{count}</span></div>
    <div className="toolbar">
      <div className="segmented">{filters.map(f => <button key={f.value} className={filter === f.value ? 'active' : ''} disabled={saving !== null} onClick={() => setFilter(f.value)}>{f.label}</button>)}</div>
      <input className="search" placeholder="Издөө: email, окуу номери, бөлүк" value={search} onChange={e => setSearch(e.target.value)} />
    </div>
    {error && <ErrorBox message={error} retry={() => void load(1)} />}
    <div className="table-wrap"><table className="table">
      <thead><tr><th></th><th>Email / Окуу номери</th><th>Аскер бөлүк</th><th>Роль / Категория</th><th>Катталган</th><th>Абалы</th><th></th></tr></thead>
      <tbody>{visible.map(i => <tr key={i.id}>
        <td>{i.has_photo ? <Photo id={i.id} token={ctx.token} email={i.email} /> : <div className="avatar">{i.email.charAt(0).toUpperCase()}</div>}</td>
        <td><strong>{i.email}</strong><small>№ {i.study_number}</small></td>
        <td>{i.military_unit}</td>
        <td>{roleLabel(i.role)}<small>{categoryLabel(i.training_category)}</small></td>
        <td>{fmtDate(i.date_joined)}</td>
        <td><span className={`pill pill-${i.status}`}>{statusLabel[i.status]}</span></td>
        <td className="actions">{saving === i.id ? <div className="spinner sm" /> : <>
          {i.status !== 'approved' && <button className="btn btn-sm btn-primary" disabled={saving !== null || loading} onClick={() => void decide(i, 'approved')}>Ырастоо</button>}
          {i.status !== 'rejected' && <button className="btn btn-sm btn-danger" disabled={saving !== null || loading} onClick={() => void decide(i, 'rejected')}>Четке кагуу</button>}
        </>}</td>
      </tr>)}</tbody>
    </table></div>
    {!loading && !error && visible.length === 0 && <p className="empty">Бул бөлүмдө өтүнмөлөр жок.</p>}
    {loading && <Loading />}
    {hasNext && !loading && <button className="btn btn-ghost more" onClick={() => void load(page + 1)}>Дагы көрсөтүү</button>}
  </>;
}

function useLoad<T>(fn: (() => Promise<T>) | null, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const [rev, setRev] = useState(0);
  useEffect(() => {
    if (!fn) { setData(null); return; }
    let active = true; setLoading(true); setError('');
    fn().then(d => { if (active) setData(d); }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'Ката кетти.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, rev]);
  return { data, loading, error, reload: () => setRev(r => r + 1) };
}

function Users({ ctx }: { ctx: Ctx }) {
  const [unit, setUnit] = useState<string | null>(null);
  const groups = useLoad(() => ctx.call<DeputyGroup[]>('admin/unit-deputies'), [ctx.call]);
  const users = useLoad(unit ? () => ctx.call<UnitUser[]>(`admin/unit-users?military_unit=${encodeURIComponent(unit)}`) : null, [ctx.call, unit]);

  if (unit) return <>
    <button className="link-btn back" onClick={() => setUnit(null)}>← Аскер бөлүктөр</button>
    <div className="page-head"><h1 className="page-title">{unit}</h1>{users.data && <span className="badge">{users.data.length}</span>}</div>
    {users.error && <ErrorBox message={users.error} retry={users.reload} />}
    {users.loading ? <Loading /> : users.data && (users.data.length === 0 ? <p className="empty">Бул аскер бөлүктө катталган колдонуучулар жок.</p> :
      <div className="table-wrap"><table className="table">
        <thead><tr><th>Окуу номери</th><th>Email</th><th>Роль</th><th>Абалы</th></tr></thead>
        <tbody>{users.data.map(u => <tr key={u.id}><td><strong>{u.study_number}</strong></td><td>{u.email}</td><td>{roleLabel(u.role, u.training_category)}</td><td><span className={`pill pill-${u.status}`}>{statusLabel[u.status]}</span></td></tr>)}</tbody>
      </table></div>)}
  </>;

  return <>
    <div className="page-head"><h1 className="page-title">Колдонуучулар</h1><button className="btn btn-ghost btn-sm" onClick={groups.reload}>Жаңылоо</button></div>
    <p className="muted">Аскер бөлүктү тандап, анын колдонуучуларын көрүңүз.</p>
    {groups.error && <ErrorBox message={groups.error} retry={groups.reload} />}
    {groups.loading && !groups.data ? <Loading /> : <div className="unit-grid">{groups.data?.map(g => <button key={g.military_unit} className="unit-card" onClick={() => setUnit(g.military_unit)}>
      <strong>{g.military_unit}</strong>
      {g.deputies.length ? g.deputies.map(d => <small key={d.id}>Орун басар: № {d.study_number} · {statusLabel[d.status]}</small>) : <small className="muted">Орун басар жок</small>}
      <span className="arrow">→</span>
    </button>)}</div>}
  </>;
}

function QuizResults({ ctx }: { ctx: Ctx }) {
  const [unit, setUnit] = useState<string | null>(null);
  const [category, setCategory] = useState<Category>('officers');
  const [userId, setUserId] = useState<number | null>(null);
  const units = useLoad(() => ctx.call<string[]>('admin/quiz-results/units'), [ctx.call]);
  const users = useLoad(unit ? () => ctx.call<QuizReportUser[]>(`admin/quiz-results/unit/${encodeURIComponent(unit)}/${category}`) : null, [ctx.call, unit, category]);
  const history = useLoad(userId !== null ? () => ctx.call<QuizHistory>(`admin/quiz-results/user/${userId}/history`) : null, [ctx.call, userId]);

  return <>
    <h1 className="page-title">Тесттердин жыйынтыктары</h1>
    {units.error && <ErrorBox message={units.error} retry={units.reload} />}
    <div className="toolbar">
      <select value={unit ?? ''} onChange={e => setUnit(e.target.value || null)}>
        <option value="">Аскер бөлүктү тандаңыз</option>
        {units.data?.map(u => <option key={u} value={u}>{u}</option>)}
      </select>
      <div className="segmented">{(['officers', 'warrant-sergeants'] as const).map(c => <button key={c} className={category === c ? 'active' : ''} onClick={() => setCategory(c)}>{categoryLabel(c)}</button>)}</div>
    </div>
    {!unit ? <p className="empty">Жыйынтыктарды көрүү үчүн аскер бөлүктү тандаңыз.</p> : <>
      {users.error && <ErrorBox message={users.error} retry={users.reload} />}
      {users.loading ? <Loading /> : users.data && (users.data.length === 0 ? <p className="empty">Колдонуучулар жок.</p> :
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Окуу номери</th><th>Email</th><th>Тест</th><th></th></tr></thead>
          <tbody>{users.data.map(u => <tr key={u.id}><td><strong>{u.study_number}</strong></td><td>{u.email}</td>
            <td><span className={`pill ${u.submitted ? 'pill-approved' : 'pill-pending'}`}>{u.submitted ? 'Тапшырган' : 'Тапшыра элек'}</span></td>
            <td className="actions"><button className="btn btn-sm btn-ghost" onClick={() => setUserId(u.id)}>Тарых →</button></td></tr>)}</tbody>
        </table></div>)}
    </>}
    {userId !== null && <div className="modal-bg" onClick={() => setUserId(null)}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head"><h2>{history.data ? `№ ${history.data.user.study_number}` : 'Тест тарыхы'}</h2><button className="link-btn" onClick={() => setUserId(null)}>✕</button></div>
        {history.data && <p className="muted">{history.data.user.email} · {history.data.user.military_unit} · {categoryLabel(history.data.user.training_category)}</p>}
        {history.error && <ErrorBox message={history.error} retry={history.reload} />}
        {history.loading ? <Loading /> : history.data && (history.data.attempts.length === 0 ? <p className="empty">Тест тапшырылган эмес.</p> :
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Тест</th><th>Тема / Курс</th><th>Күнү</th><th>Туура</th><th>Баа</th></tr></thead>
            <tbody>{history.data.attempts.map(a => <tr key={a.id}><td><strong>{a.title}</strong>{a.status === 'failed' && <small className="bad">Өтпөй калды</small>}</td><td>{a.topic}</td><td>{fmtDate(a.date)}</td><td>{a.correct_answers}/{a.total}</td><td><span className={`grade grade-${a.grade}`}>{a.grade}</span></td></tr>)}</tbody>
          </table></div>)}
      </div>
    </div>}
  </>;
}
