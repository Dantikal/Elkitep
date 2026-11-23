import { Fragment, useEffect, useState } from 'react';
import { QuizDraft, QuizEditor } from './QuizEditor';
import { Call, errText, Material, MaterialModal, openSignedFile, RowActions, TitleModal, useList } from './ui';

export type Section = { id: number; title: string; parent: number | null; can_manage: boolean; is_enrolled: boolean };
type CourseMaterial = Material & { topic: number; topic_title: string };
type Member = { id: number; study_number: string; email: string; military_unit: string; enrolled_at: string };
type LatestResult = { status: string; percentage: number; reason: string } | null;
type Quiz = { id: number; title: string; duration_seconds: number; question_count: number; deadline?: string | null; module?: 1 | 2 | null; latest_result: LatestResult };

const pad = (v: number) => String(v).padStart(2, '0');
export function formatDeadline(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const expired = (q: Quiz) => !!q.deadline && new Date(q.deadline).getTime() <= Date.now();
const failureReasons: Record<string, string> = { screenshot: 'Скриншот аныкталды.', app_exit: 'Тиркемеден чыктыңыз.', navigation: 'Тесттен чыктыңыз.', connection_lost: 'Байланыш үзүлдү.', time_limit: 'Убакыт бүттү.', submitted: 'Тест аяктады.' };

const Spinner = () => <div className="loading"><div className="spinner" /></div>;
function ErrorLine({ message, retry }: { message: string; retry?: () => void }) {
  return <div className="alert" role="alert">{message}{retry && <button className="link-btn" onClick={retry}>Кайра аракет кылуу</button>}</div>;
}
function MaterialView({ m, canEdit, busy, onEdit, onDelete, onFile }: { m: Material; canEdit: boolean; busy?: boolean; onEdit?: () => void; onDelete?: () => void; onFile: () => void }) {
  return <div className="material">
    {canEdit && onEdit && onDelete && <RowActions disabled={busy} onEdit={onEdit} onDelete={onDelete} />}
    {m.text && <p className="material-text">{m.text}</p>}
    {m.links.map((u, i) => <a key={`${u}/${i}`} href={u} target="_blank" rel="noreferrer noopener" className="material-link">🔗 {u}</a>)}
    {m.has_file && <button className="file-btn" onClick={onFile}>📎 {m.file_name}</button>}
  </div>;
}

/* ───────────── Тесты курса (как CourseQuizScreen) ───────────── */
export function CourseQuizzes({ call, course, canManage, startCreating = false, onBack }: { call: Call; course: Section; canManage: boolean; startCreating?: boolean; onBack?: () => void }) {
  const route = `courses/sections/${course.id}/quizzes`;
  const [editor, setEditor] = useState<{ quiz?: QuizDraft } | null>(startCreating && canManage ? {} : null);
  const quizzes = useList<Quiz>(call, editor ? null : route);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [module, setModule] = useState<1 | 2>(1);
  const shown = quizzes.items.filter(q => (q.module ?? 1) === module);

  async function edit(q: Quiz) {
    setBusy(true); setError('');
    try { setEditor({ quiz: await call<QuizDraft>(`courses/quizzes/${q.id}`) }); } catch (e) { setError(errText(e, 'Тест жүктөлгөн жок.')); } finally { setBusy(false); }
  }
  async function remove(q: Quiz) {
    if (!window.confirm(`«${q.title}» тестин өчүрөсүзбү? Эгер тесттен өтүү тарыхы болсо, өчүрүү мүмкүн эмес.`)) return;
    setBusy(true); setError('');
    try { await call(`courses/quizzes/${q.id}`, { method: 'DELETE' }); quizzes.reload(); } catch (e) { setError(errText(e, 'Тест өчүрүлгөн жок.')); } finally { setBusy(false); }
  }

  if (editor) return <QuizEditor key={editor.quiz?.id ?? 'new'} call={call} route={route} topicTitle={course.title} initialQuiz={editor.quiz} withDeadline withModule initialModule={module} itemRoute={id => `courses/quizzes/${id}`}
    onBack={() => setEditor(null)} onSaved={() => setEditor(null)} />;

  return <>
    {onBack && <button className="link-btn back" onClick={onBack}>← Курска кайтуу</button>}
    <div className="block-head"><h2>Тесттер</h2>{canManage && <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => setEditor({})}>+ {module} модулга тест кошуу</button>}</div>
    <div className="segmented tabs">{([1, 2] as const).map(v => <button key={v} className={module === v ? 'active' : ''} onClick={() => setModule(v)}>{v} модуль ({quizzes.items.filter(q => (q.module ?? 1) === v).length})</button>)}</div>
    {!canManage && <div className="note">Тест дедлайнга чейин гана кабыл алынат. Корголгон тестти Android же iOS тиркемесинен өтүңүз.</div>}
    {error && <ErrorLine message={error} />}
    {quizzes.error && <ErrorLine message={quizzes.error} retry={quizzes.reload} />}
    {quizzes.loading ? <Spinner /> : !quizzes.error && (shown.length === 0 ? <p className="empty">{module} модулда тесттер азырынча жок.</p> :
      <div className="list">{shown.map(q => <div key={q.id} className="list-row static">
        <span className="nav-icon light">✓</span>
        <div className="grow">
          <strong>{q.title}</strong>
          <small>{q.question_count} суроо · {Math.ceil(q.duration_seconds / 60)} мүнөт</small>
          <small className={expired(q) ? 'bad' : ''}>Дедлайн: {formatDeadline(q.deadline)}{expired(q) ? ' · мөөнөтү бүттү' : ''}</small>
          {q.latest_result && q.latest_result.status !== 'active' && <small className={q.latest_result.status === 'failed' ? 'bad' : ''}>Акыркы аракет: {q.latest_result.percentage}% · {failureReasons[q.latest_result.reason] ?? ''}</small>}
        </div>
        {canManage && <RowActions disabled={busy} onEdit={() => void edit(q)} onDelete={() => void remove(q)} />}
      </div>)}</div>)}
  </>;
}

/* ───────────── Окуу курстары (как CoursesScreen) ───────────── */
type ModalState = { kind: 'section'; editing: Section | null } | { kind: 'material'; material: Material | null } | null;

export function CourseBrowser({ call, isAdmin, isCourseHead, initialPath = [], onBack, onMyCourses }: { call: Call; isAdmin: boolean; isCourseHead: boolean; initialPath?: Section[]; onBack?: () => void; onMyCourses?: () => void }) {
  const [path, setPath] = useState<Section[]>(initialPath);
  const [showTests, setShowTests] = useState(false);
  const current = path[path.length - 1];
  const course = path[0];
  const canAddMaterials = path.length >= 2;
  const canEdit = current ? current.can_manage : isAdmin || isCourseHead;
  const sectionRoute = current ? `courses/sections/${current.id}/children` : 'courses/sections';
  const sections = useList<Section>(call, showTests ? null : sectionRoute);
  const materials = useList<Material>(call, !showTests && canAddMaterials && current ? `courses/sections/${current.id}/materials` : null);
  const [modal, setModal] = useState<ModalState>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => setError(''), [current?.id, showTests]);

  function goTo(depth: number) {
    if (depth < initialPath.length) { onBack?.(); return; }
    setShowTests(false); setPath(prev => prev.slice(0, depth));
  }
  async function toggleEnrollment() {
    if (!course) return;
    setBusy(true); setError('');
    try {
      await call(`courses/sections/${course.id}/enroll`, { method: course.is_enrolled ? 'DELETE' : 'POST' });
      setPath(prev => prev.map((it, i) => i === 0 ? { ...it, is_enrolled: !it.is_enrolled } : it));
    } catch (e) { setError(errText(e, 'Ката кетти.')); } finally { setBusy(false); }
  }
  function removeSection(item: Section) {
    if (!window.confirm(`«${item.title}» бөлүмүн жана анын ичиндеги мазмунду өчүрөсүзбү?`)) return;
    setBusy(true); setError('');
    call(`courses/sections/item/${item.id}`, { method: 'DELETE' }).then(sections.reload).catch(e => setError(errText(e, 'Бөлүм өчүрүлгөн жок.'))).finally(() => setBusy(false));
  }
  function removeMaterial(item: Material) {
    if (!window.confirm('Бул материалды өчүрөсүзбү?')) return;
    setBusy(true); setError('');
    call(`courses/materials/${item.id}`, { method: 'DELETE' }).then(materials.reload).catch(e => setError(errText(e, 'Материал өчүрүлгөн жок.'))).finally(() => setBusy(false));
  }
  const openFile = (id: number) => openSignedFile(call, `courses/materials/${id}/file-link`).catch(e => setError(errText(e, 'Файл ачылган жок.')));

  const crumbs = [{ label: 'Окуу курстары', depth: 0 }, ...path.map((p, i) => ({ label: p.title, depth: i + 1 }))];
  if (showTests) crumbs.push({ label: 'Тесттер', depth: -1 });
  const backDepth = showTests ? path.length : path.length - 1;

  return <>
    <nav className="crumbs">{crumbs.map((c, i) => <span key={i}>{i > 0 && <span className="sep">/</span>}{i < crumbs.length - 1 && c.depth >= 0 ? <button className="link-btn" onClick={() => goTo(c.depth)}>{c.label}</button> : <span>{c.label}</span>}</span>)}</nav>
    <div className="page-head">
      {(path.length > 0 || showTests) && <button className="icon-btn" aria-label="Артка" onClick={() => showTests ? setShowTests(false) : goTo(backDepth)}>←</button>}
      <h1 className="page-title">{showTests ? 'Тесттер' : current?.title ?? 'Окуу курстары'}</h1>
      {!current && isCourseHead && onMyCourses && <button className="btn btn-primary btn-sm" onClick={onMyCourses}>Менин курстарым</button>}
    </div>
    {error && <ErrorLine message={error} />}

    {showTests && course ? <CourseQuizzes call={call} course={course} canManage={course.can_manage} /> : <>
      {path.length === 1 && <div className="course-actions">
        {!current.can_manage && <button className={`btn ${current.is_enrolled ? 'btn-ghost' : 'btn-primary'}`} disabled={busy} onClick={() => void toggleEnrollment()}>{current.is_enrolled ? '✓ Курска жазылдыңыз · Жокко чыгаруу' : 'Курска жазылуу'}</button>}
        {(current.can_manage || current.is_enrolled) && <button className="btn btn-ghost" onClick={() => setShowTests(true)}>Тесттер →</button>}
      </div>}

      {!canAddMaterials && <>
        <div className="block-head"><h2>{current ? 'Ички бөлүмдөр' : 'Курстар'}</h2>{canEdit && <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => setModal({ kind: 'section', editing: null })}>+ Кошуу</button>}</div>
        {sections.error && <ErrorLine message={sections.error} retry={sections.reload} />}
        {sections.loading ? <Spinner /> : !sections.error && (sections.items.length === 0 ? <p className="empty">Бөлүмдөр азырынча жок.</p> :
          <div className="list">{sections.items.map(item => <div key={item.id} className="list-row" role="button" tabIndex={0} onClick={() => setPath(prev => [...prev, item])} onKeyDown={e => { if (e.key === 'Enter') setPath(prev => [...prev, item]); }}>
            <span className="nav-icon light">▥</span>
            <strong className="grow">{item.title}</strong>
            {item.parent === null && item.is_enrolled && <span className="pill pill-approved">Жазылгансыз</span>}
            {item.can_manage && <RowActions disabled={busy} onEdit={() => setModal({ kind: 'section', editing: item })} onDelete={() => removeSection(item)} />}
            <span className="arrow">→</span>
          </div>)}</div>)}
      </>}

      {canAddMaterials && <>
        <div className="block-head"><h2>Материалдар</h2>{canEdit && <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => setModal({ kind: 'material', material: null })}>+ Материал кошуу</button>}</div>
        {materials.error && <ErrorLine message={materials.error} retry={materials.reload} />}
        {materials.loading ? <Spinner /> : !materials.error && (materials.items.length === 0 ? <p className="empty">Материалдар азырынча жок.</p> :
          <div className="materials">{materials.items.map(m => <MaterialView key={m.id} m={m} canEdit={canEdit} busy={busy} onEdit={() => setModal({ kind: 'material', material: m })} onDelete={() => removeMaterial(m)} onFile={() => void openFile(m.id)} />)}</div>)}
      </>}
    </>}

    {modal?.kind === 'section' && <TitleModal heading={modal.editing ? 'Бөлүмдү өзгөртүү' : 'Бөлүм кошуу'} label="Бөлүмдүн аталышы" initial={modal.editing?.title ?? ''} onClose={() => setModal(null)} onSubmit={async title => {
      if (modal.editing) { await call(`courses/sections/item/${modal.editing.id}`, { method: 'PATCH', body: JSON.stringify({ title }) }); setModal(null); sections.reload(); }
      else { const created = await call<Section>(sectionRoute, { method: 'POST', body: JSON.stringify({ title }) }); setModal(null); setPath(prev => [...prev, created]); }
    }} />}
    {modal?.kind === 'material' && current && <MaterialModal material={modal.material} onClose={() => setModal(null)} onSubmit={async body => {
      if (modal.material) await call(`courses/materials/${modal.material.id}`, { method: 'PATCH', body });
      else await call(`courses/sections/${current.id}/materials`, { method: 'POST', body });
      setModal(null); materials.reload();
    }} />}
  </>;
}

/* ───────────── Менин курстарым (как MyCoursesScreen) ───────────── */
type Passer = {
  id: number; study_number: string; email: string; military_unit: string; correct_answers: number; total: number; grade: number;
  state: 'pending' | 'sent' | 'cancelled'; auto_sent: boolean; decision_deadline: string; referral_sent_at: string | null; cancelled_at: string | null; cancel_reason: string;
  tests: { quiz_id: number; title: string; module: number | null; status: string; correct_answers: number; total: number; grade: number }[];
};
type PassersData = { required_tests: number; decision_hours: number; server_now: string; users: Passer[] };
export type Tab = 'topics' | 'materials' | 'members' | 'tests' | 'passers';
export const tabs: { id: Tab; title: string }[] = [{ id: 'topics', title: 'Темалар' }, { id: 'materials', title: 'Материалдар' }, { id: 'members', title: 'Колдонуучулар' }, { id: 'tests', title: 'Тесттер' }, { id: 'passers', title: 'Тесттен өткөн колдонуучулар' }];

/** Открытый курс и вкладка управляются снаружи: вкладки показываются в боковом меню дашборда. */
export function MyCourses({ call, onAllCourses, course, setCourse, tab, setTab }: { call: Call; onAllCourses: () => void; course: Section | null; setCourse: (c: Section | null) => void; tab: Tab; setTab: (t: Tab) => void }) {
  const [topic, setTopic] = useState<Section | null>(null);
  useEffect(() => setTopic(null), [course?.id, tab]);
  const courses = useList<Section>(call, !course ? 'courses/my' : null);
  const base = course ? `courses/sections/${course.id}` : '';
  const topics = useList<Section>(call, course && !topic && (tab === 'topics' || tab === 'materials') ? `${base}/children` : null);
  const allMaterials = useList<CourseMaterial>(call, course && !topic && tab === 'materials' ? `${base}/all-materials` : null);
  const members = useList<Member>(call, course && !topic && tab === 'members' ? `${base}/members` : null);
  const [modal, setModal] = useState<{ kind: 'course' | 'topic'; editing: Section | null } | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => setError(''), [course?.id, tab, topic?.id]);

  function remove(item: Section, isCourse: boolean) {
    if (!window.confirm(`«${item.title}» ${isCourse ? 'курсун' : 'темасын'} жана анын ичиндеги мазмунду өчүрөсүзбү?`)) return;
    setBusy(true); setError('');
    call(`courses/sections/item/${item.id}`, { method: 'DELETE' })
      .then(() => { if (isCourse) setCourse(null); else topics.reload(); })
      .catch(e => setError(errText(e, 'Өчүрүлгөн жок.'))).finally(() => setBusy(false));
  }
  const openFile = (id: number) => openSignedFile(call, `courses/materials/${id}/file-link`).catch(e => setError(errText(e, 'Файл ачылган жок.')));

  if (course && topic) return <CourseBrowser key={topic.id} call={call} isAdmin={false} isCourseHead initialPath={[course, topic]} onBack={() => setTopic(null)} />;

  const crumbs = [{ label: 'Окуу курстары', go: onAllCourses }, { label: 'Менин курстарым', go: () => setCourse(null) }, ...(course ? [{ label: course.title, go: () => undefined }] : [])];

  return <>
    <nav className="crumbs">{crumbs.map((c, i) => <span key={i}>{i > 0 && <span className="sep">/</span>}{i < crumbs.length - 1 ? <button className="link-btn" onClick={c.go}>{c.label}</button> : <span>{c.label}</span>}</span>)}</nav>
    <div className="page-head">
      {course && <button className="icon-btn" aria-label="Артка" onClick={() => setCourse(null)}>←</button>}
      <h1 className="page-title">{course?.title ?? 'Менин курстарым'}</h1>
      {course ? <RowActions disabled={busy} onEdit={() => setModal({ kind: 'course', editing: course })} onDelete={() => remove(course, true)} />
        : <button className="btn btn-primary btn-sm" onClick={() => setModal({ kind: 'course', editing: null })}>+ Курс кошуу</button>}
    </div>
    {error && <ErrorLine message={error} />}

    {!course ? <>
      {courses.error && <ErrorLine message={courses.error} retry={courses.reload} />}
      {courses.loading ? <Spinner /> : !courses.error && (courses.items.length === 0 ? <p className="empty">Сиз азырынча курс түзө элексиз.</p> :
        <div className="list">{courses.items.map(c => <div key={c.id} className="list-row" role="button" tabIndex={0} onClick={() => { setCourse(c); setTab('topics'); }} onKeyDown={e => { if (e.key === 'Enter') { setCourse(c); setTab('topics'); } }}>
          <span className="nav-icon light">▥</span><strong className="grow">{c.title}</strong><span className="arrow">→</span>
        </div>)}</div>)}
    </> : <>
      {tab === 'topics' && <>
        <div className="block-head"><h2>Темалар</h2><button className="btn btn-primary btn-sm" disabled={busy} onClick={() => setModal({ kind: 'topic', editing: null })}>+ Тема кошуу</button></div>
        {topics.error && <ErrorLine message={topics.error} retry={topics.reload} />}
        {topics.loading ? <Spinner /> : !topics.error && (topics.items.length === 0 ? <p className="empty">Темалар азырынча жок.</p> :
          <div className="list">{topics.items.map((t, i) => <div key={t.id} className="list-row" role="button" tabIndex={0} onClick={() => setTopic(t)} onKeyDown={e => { if (e.key === 'Enter') setTopic(t); }}>
            <span className="nav-icon light">{i + 1}</span><strong className="grow">{t.title}</strong>
            <RowActions disabled={busy} onEdit={() => setModal({ kind: 'topic', editing: t })} onDelete={() => remove(t, false)} />
            <span className="arrow">→</span>
          </div>)}</div>)}
      </>}

      {tab === 'materials' && <>
        {(topics.error || allMaterials.error) && <ErrorLine message={topics.error || allMaterials.error} retry={() => { topics.reload(); allMaterials.reload(); }} />}
        {topics.loading || allMaterials.loading ? <Spinner /> : !topics.error && !allMaterials.error && (topics.items.length === 0 ? <p className="empty">Материал кошуу үчүн адегенде «Темалар» бөлүмүндө тема түзүңүз.</p> :
          <div className="materials">{topics.items.map(t => {
            const items = allMaterials.items.filter(m => m.topic === t.id);
            return <div key={t.id} className="topic-group">
              <div className="block-head"><h2>{t.title}</h2><button className="btn btn-ghost btn-sm" onClick={() => setTopic(t)}>+ Материал</button></div>
              {items.length === 0 ? <p className="muted small">Материалдар жок.</p> : items.map(m => <MaterialView key={m.id} m={m} canEdit={false} onFile={() => void openFile(m.id)} />)}
            </div>;
          })}</div>)}
      </>}

      {tab === 'members' && <>
        {members.error && <ErrorLine message={members.error} retry={members.reload} />}
        {members.loading ? <Spinner /> : !members.error && <>
          <p className="muted">Курска жазылгандар: {members.items.length}</p>
          {members.items.length === 0 ? <p className="empty">Курска азырынча эч ким жазыла элек.</p> :
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Окуу номери</th><th>Email</th><th>Аскер бөлүк</th><th>Жазылган</th></tr></thead>
              <tbody>{members.items.map(m => <tr key={m.id}><td><strong>{m.study_number}</strong></td><td>{m.email}</td><td>{m.military_unit}</td><td>{formatDeadline(m.enrolled_at)}</td></tr>)}</tbody>
            </table></div>}
        </>}
      </>}

      {tab === 'passers' && <Passers call={call} course={course} />}

      {tab === 'tests' && <CourseQuizzes key={course.id} call={call} course={course} canManage />}
    </>}

    {modal && <TitleModal heading={modal.editing ? (modal.kind === 'course' ? 'Курсту өзгөртүү' : 'Теманы өзгөртүү') : (modal.kind === 'course' ? 'Курс кошуу' : 'Тема кошуу')}
      label={modal.kind === 'course' ? 'Курстун аталышы' : 'Теманын аталышы'} initial={modal.editing?.title ?? ''} onClose={() => setModal(null)}
      onSubmit={async title => {
        if (modal.editing) {
          const updated = await call<Section>(`courses/sections/item/${modal.editing.id}`, { method: 'PATCH', body: JSON.stringify({ title }) });
          if (modal.kind === 'course') setCourse(updated); else topics.reload();
        } else if (modal.kind === 'course') {
          setCourse(await call<Section>('courses/sections', { method: 'POST', body: JSON.stringify({ title }) })); setTab('topics');
        } else if (course) {
          await call(`courses/sections/${course.id}/children`, { method: 'POST', body: JSON.stringify({ title }) }); topics.reload();
        }
        setModal(null);
      }} />}
  </>;
}

/* ───────────── Тесттен өткөн колдонуучулар + жолдомо (24 саат) ───────────── */
function remaining(ms: number) {
  if (ms <= 0) return '0 мүнөт';
  const minutes = Math.ceil(ms / 60000);
  const h = Math.floor(minutes / 60); const m = minutes % 60;
  return h ? `${h} саат ${m} мүнөт` : `${m} мүнөт`;
}

function Passers({ call, course }: { call: Call; course: Section }) {
  const [data, setData] = useState<PassersData | null>(null);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [rev, setRev] = useState(0);
  const [busy, setBusy] = useState<number | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [cancelFor, setCancelFor] = useState<Passer | null>(null);
  const [reason, setReason] = useState(''); const [reasonError, setReasonError] = useState('');

  useEffect(() => {
    let active = true; setLoading(true); setError('');
    call<PassersData>(`courses/sections/${course.id}/test-passers`)
      .then(d => { if (!active) return; setData(d); setOffset(new Date(d.server_now).getTime() - Date.now()); })
      .catch(e => { if (active) setError(errText(e, 'Жүктөлгөн жок.')); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [call, course.id, rev]);
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 30000); return () => window.clearInterval(t); }, []);
  const serverNow = now + offset;
  // Мөөнөтү бүткөн күтүүдөгү жолдомолор серверде автоматтык жөнөтүлөт — тизмени жаңылайбыз.
  const expiredPending = !!data?.users.some(u => u.state === 'pending' && new Date(u.decision_deadline).getTime() <= serverNow);
  useEffect(() => { if (expiredPending) setRev(r => r + 1); }, [expiredPending]);

  const replace = (row: Passer) => setData(d => d && { ...d, users: d.users.map(u => u.id === row.id ? row : u) });

  async function send(p: Passer) {
    if (!window.confirm(`Жолдомо жөнөтүлсүнбү?\nОкуу номери: ${p.study_number}\n${p.email}`)) return;
    setBusy(p.id); setError('');
    try { replace(await call<Passer>(`courses/sections/${course.id}/referrals`, { method: 'POST', body: JSON.stringify({ user_id: p.id }) })); }
    catch (e) { setError(errText(e, 'Жолдомо жөнөтүлгөн жок.')); setRev(r => r + 1); } finally { setBusy(null); }
  }
  async function confirmCancel() {
    if (!cancelFor) return;
    if (!reason.trim()) { setReasonError('Жокко чыгаруунун себебин жазыңыз.'); return; }
    setBusy(cancelFor.id); setReasonError('');
    try {
      replace(await call<Passer>(`courses/sections/${course.id}/referrals/cancel`, { method: 'POST', body: JSON.stringify({ user_id: cancelFor.id, reason: reason.trim() }) }));
      setCancelFor(null); setReason('');
    } catch (e) { setReasonError(errText(e, 'Жокко чыгарылган жок.')); } finally { setBusy(null); }
  }

  return <>
    <div className="block-head"><h2>Тесттен өткөн колдонуучулар</h2><button className="btn btn-ghost btn-sm" onClick={() => setRev(r => r + 1)}>Жаңылоо</button></div>
    {data && <div className="note">Курстун {data.required_tests} модулдук тестинен өткөн колдонуучулар: <strong>{data.users.length}</strong>. Тест аяктагандан кийин {data.decision_hours} саат ичинде жолдомону жөнөтүңүз же жокко чыгарыңыз. Мөөнөт өтсө, жолдомо автоматтык түрдө жөнөтүлөт жана аны жокко чыгарууга болбойт.</div>}
    {error && <ErrorLine message={error} retry={() => setRev(r => r + 1)} />}
    {loading && !data ? <Spinner /> : data && (data.users.length === 0 ? <p className="empty">Азырынча {data.required_tests} модулдук тесттен өткөн колдонуучулар жок.</p> :
      <div className="table-wrap"><table className="table">
        <thead><tr><th>Окуу номери</th><th>Email / Аскер бөлүк</th><th>Туура жооптор</th><th>Баасы</th><th>Жолдомо</th></tr></thead>
        <tbody>{data.users.map(p => <Fragment key={p.id}>
          <tr>
            <td><strong>{p.study_number}</strong><button className="link-btn small" onClick={() => setOpen(o => o === p.id ? null : p.id)}>{open === p.id ? 'Жашыруу ▴' : `Тесттер (${p.tests.length}) ▾`}</button></td>
            <td>{p.email}<small>{p.military_unit}</small></td>
            <td><strong>{p.correct_answers}</strong> / {p.total}</td>
            <td><span className={`grade grade-${p.grade}`}>{p.grade}</span></td>
            <td className="referral-cell">
              {p.state === 'pending' && <>
                <span className="countdown" title={`Мөөнөтү: ${formatDeadline(p.decision_deadline)}`}>⏳ Калды: {remaining(new Date(p.decision_deadline).getTime() - serverNow)}</span>
                <span className="referral-actions">
                  <button className="btn btn-sm btn-primary" disabled={busy !== null} onClick={() => void send(p)}>{busy === p.id ? '…' : 'Жолдомо жөнөтүү'}</button>
                  <button className="btn btn-sm btn-danger" disabled={busy !== null} onClick={() => { setCancelFor(p); setReason(''); setReasonError(''); }}>Жокко чыгаруу</button>
                </span>
              </>}
              {p.state === 'sent' && <span className="pill pill-approved" title={formatDeadline(p.referral_sent_at)}>✓ Жөнөтүлдү{p.auto_sent ? ' (автоматтык)' : ''}</span>}
              {p.state === 'cancelled' && <><span className="pill pill-rejected" title={formatDeadline(p.cancelled_at)}>✕ Жокко чыгарылды</span><small>Себеби: {p.cancel_reason}</small></>}
            </td>
          </tr>
          {open === p.id && <tr className="sub-row"><td colSpan={5}>
            {p.tests.map(t => <div key={t.quiz_id} className="sub-test"><span className="grow">{t.module ? `${t.module} модуль · ` : ''}{t.title}{t.status === 'failed' && <span className="bad"> · провал</span>}</span><span>{t.correct_answers}/{t.total}</span><span className={`grade grade-${t.grade}`}>{t.grade}</span></div>)}
          </td></tr>}
        </Fragment>)}</tbody>
      </table></div>)}

    {cancelFor && <div className="sheet-bg" onMouseDown={e => { if (e.target === e.currentTarget && busy === null) setCancelFor(null); }}>
      <form className="sheet" onSubmit={e => { e.preventDefault(); void confirmCancel(); }}>
        <div className="sheet-handle" />
        <h2>Жолдомону жокко чыгаруу</h2>
        <p className="muted small">Окуу номери: <strong>{cancelFor.study_number}</strong> · {cancelFor.email}</p>
        <label>Жокко чыгаруунун себеби<textarea autoFocus rows={4} maxLength={2000} disabled={busy !== null} value={reason} onChange={e => setReason(e.target.value)} placeholder="Себебин жазыңыз" /></label>
        <p className="muted small">Себеби администраторго жөнөтүлөт.</p>
        {reasonError && <div className="alert" role="alert">{reasonError}</div>}
        <div className="modal-actions"><button type="button" className="btn btn-ghost" disabled={busy !== null} onClick={() => setCancelFor(null)}>Артка</button><button className="btn btn-danger-solid" disabled={busy !== null}>{busy !== null ? 'Күтө туруңуз…' : 'Жокко чыгаруу'}</button></div>
      </form>
    </div>}
  </>;
}
