import { useEffect, useState } from 'react';
import { Category, categoryLabel } from '../api';
import { QuizDraft, QuizEditor } from './QuizEditor';
import { Call, errText, Material, MaterialModal, openSignedFile, RowActions, TitleModal, Topic, useList } from './ui';

type Quiz = { id: number; title: string; duration_seconds: number; question_count: number };
type Month = { id: number; title: string };

const SECTION = 'command';
const planTitle = '2026-жылдын окуу жылынын командирдик даярдоо планы';
const periods: { title: string; months: Month[] }[] = [
  { title: '1 - жарым жылдык', months: [{ id: 12, title: 'Декабрь' }, { id: 1, title: 'Январь' }, { id: 2, title: 'Февраль' }, { id: 3, title: 'Март' }, { id: 4, title: 'Апрель' }] },
  { title: '2 - жарым жылдык', months: [{ id: 6, title: 'Июнь' }, { id: 7, title: 'Июль' }, { id: 8, title: 'Август' }, { id: 9, title: 'Сентябрь' }, { id: 10, title: 'Октябрь' }] },
];

type Modal = { kind: 'title'; heading: string; label: string; initial: string; submit: (t: string) => Promise<void> } | { kind: 'material'; material: Material | null } | null;

export function CommandTraining({ call }: { call: Call }) {
  const [category, setCategory] = useState<Category | null>(null);
  const [period, setPeriod] = useState<number | null>(null);
  const [month, setMonth] = useState<Month | null>(null);
  const [subject, setSubject] = useState<Topic | null>(null);
  const [tab, setTab] = useState<'topics' | 'quizzes'>('topics');
  const [lesson, setLesson] = useState<Topic | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [quizEdit, setQuizEdit] = useState<{ quiz?: QuizDraft } | null>(null);
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);

  const subjects = useList<Topic>(call, category && month && !subject ? `training/2026/sections/${SECTION}/${category}/months/${month.id}/topics` : null);
  const lessons = useList<Topic>(call, subject && !lesson && tab === 'topics' ? `training/subjects/${subject.id}/topics` : null);
  const quizzes = useList<Quiz>(call, subject && !lesson && tab === 'quizzes' && !quizEdit ? `training/topics/${subject.id}/quizzes` : null);
  const materials = useList<Material>(call, lesson ? `training/subject-topics/${lesson.id}/materials` : null);

  useEffect(() => setActionError(''), [category, period, month, subject, lesson, tab]);

  async function run(fn: () => Promise<unknown>, after: () => void, fallback: string) {
    setBusy(true); setActionError('');
    try { await fn(); after(); } catch (e) { setActionError(errText(e, fallback)); } finally { setBusy(false); }
  }
  const confirmAndRun = (message: string, fn: () => Promise<unknown>, after: () => void, fallback: string) => { if (window.confirm(message)) void run(fn, after, fallback); };

  const openFile = (id: number) => openSignedFile(call, `training/materials/${id}/file-link`).catch(e => setActionError(errText(e, 'Файл ачылган жок.')));

  async function editQuiz(q: Quiz) {
    setBusy(true); setActionError('');
    try { setQuizEdit({ quiz: await call<QuizDraft>(`training/quizzes/${q.id}`) }); }
    catch (e) { setActionError(errText(e, 'Тест жүктөлгөн жок.')); }
    finally { setBusy(false); }
  }

  // Хлебные крошки
  const crumbs: { label: string; go: () => void }[] = [{ label: 'Командирдик даярдоо', go: () => { setCategory(null); setPeriod(null); setMonth(null); setSubject(null); setLesson(null); } }];
  if (category) crumbs.push({ label: categoryLabel(category), go: () => { setPeriod(null); setMonth(null); setSubject(null); setLesson(null); } });
  if (period !== null) crumbs.push({ label: periods[period].title, go: () => { setMonth(null); setSubject(null); setLesson(null); } });
  if (month) crumbs.push({ label: month.title, go: () => { setSubject(null); setLesson(null); } });
  if (subject) crumbs.push({ label: subject.title, go: () => { setLesson(null); setQuizEdit(null); } });
  if (lesson) crumbs.push({ label: lesson.title, go: () => undefined });

  if (quizEdit && subject) return <QuizEditor key={quizEdit.quiz?.id ?? 'new'} call={call} route={`training/topics/${subject.id}/quizzes`} topicTitle={subject.title} initialQuiz={quizEdit.quiz}
    onBack={() => setQuizEdit(null)} onSaved={() => { setQuizEdit(null); setTab('quizzes'); }} />;

  const back = crumbs.length > 1 ? crumbs[crumbs.length - 2] : null;
  const title = crumbs[crumbs.length - 1].label;

  return <>
    <nav className="crumbs">{crumbs.map((c, i) => <span key={i}>{i > 0 && <span className="sep">/</span>}{i < crumbs.length - 1 ? <button className="link-btn" onClick={c.go}>{c.label}</button> : <span>{c.label}</span>}</span>)}</nav>
    <div className="page-head">
      {back && <button className="icon-btn" aria-label="Артка" onClick={back.go}>←</button>}
      <h1 className="page-title">{title}</h1>
    </div>
    {actionError && <div className="alert" role="alert">{actionError}</div>}

    {!category ? <div className="tiles">
      {(['officers', 'warrant-sergeants'] as const).map((c, i) => <button key={c} className="tile" onClick={() => setCategory(c)}><span className="nav-icon">{String(i + 1).padStart(2, '0')}</span><div><strong>{categoryLabel(c)}</strong><small>{planTitle}</small></div><span className="arrow">→</span></button>)}
    </div>

    : period === null ? <>
      <p className="muted">{planTitle}</p>
      <div className="tiles">{periods.map((p, i) => <button key={p.title} className="tile" onClick={() => setPeriod(i)}><span className="nav-icon">{i + 1}</span><div><strong>{p.title}</strong><small>{p.months.map(m => m.title).join(', ')}</small></div><span className="arrow">→</span></button>)}</div>
    </>

    : !month ? <div className="month-grid">{periods[period].months.map(m => <button key={m.id} className="month-card" onClick={() => setMonth(m)}>{m.title}</button>)}</div>

    : !subject ? <ListBlock
        heading="Окуу предметтери" empty="Окуу предметтери азырынча жок." addLabel="Окуу предметин кошуу" state={subjects} busy={busy}
        onAdd={() => setModal({ kind: 'title', heading: 'Окуу предметин кошуу', label: 'Окуу предметинин аталышы', initial: '', submit: async t => { const created = await call<Topic>(`training/2026/sections/${SECTION}/${category}/months/${month.id}/topics`, { method: 'POST', body: JSON.stringify({ title: t }) }); setModal(null); setTab('topics'); setSubject(created); } })}
        onOpen={t => { setTab('topics'); setSubject(t); }}
        onEdit={t => setModal({ kind: 'title', heading: 'Предметти өзгөртүү', label: 'Окуу предметинин аталышы', initial: t.title, submit: async v => { await call(`training/topics/${t.id}`, { method: 'PATCH', body: JSON.stringify({ title: v }) }); setModal(null); subjects.reload(); } })}
        onDelete={t => confirmAndRun(`«${t.title}» предметин өчүрөсүзбү?`, () => call(`training/topics/${t.id}`, { method: 'DELETE' }), subjects.reload, 'Предмет өчүрүлгөн жок.')} />

    : !lesson ? <>
      <div className="segmented tabs">
        <button className={tab === 'topics' ? 'active' : ''} onClick={() => setTab('topics')}>Темалар</button>
        <button className={tab === 'quizzes' ? 'active' : ''} onClick={() => setTab('quizzes')}>Тесттер</button>
      </div>
      {tab === 'topics' ? <ListBlock
          heading="Темалар" empty="Темалар азырынча жок." addLabel="Тема кошуу" state={lessons} busy={busy}
          onAdd={() => setModal({ kind: 'title', heading: 'Тема кошуу', label: 'Теманын аталышы', initial: '', submit: async t => { await call(`training/subjects/${subject.id}/topics`, { method: 'POST', body: JSON.stringify({ title: t }) }); setModal(null); lessons.reload(); } })}
          onOpen={setLesson}
          onEdit={t => setModal({ kind: 'title', heading: 'Теманы өзгөртүү', label: 'Теманын аталышы', initial: t.title, submit: async v => { await call(`training/subject-topics/${t.id}`, { method: 'PATCH', body: JSON.stringify({ title: v }) }); setModal(null); lessons.reload(); } })}
          onDelete={t => confirmAndRun(`«${t.title}» темасын жана анын материалдарын өчүрөсүзбү?`, () => call(`training/subject-topics/${t.id}`, { method: 'DELETE' }), lessons.reload, 'Тема өчүрүлгөн жок.')} />
      : <>
        <div className="block-head"><h2>Тесттер</h2><button className="btn btn-primary btn-sm" disabled={busy} onClick={() => setQuizEdit({})}>+ Тест кошуу</button></div>
        {quizzes.error && <div className="alert" role="alert">{quizzes.error}<button className="link-btn" onClick={quizzes.reload}>Кайра аракет кылуу</button></div>}
        {quizzes.loading ? <div className="loading"><div className="spinner" /></div> : !quizzes.error && (quizzes.items.length === 0 ? <p className="empty">Тесттер азырынча жок.</p> :
          <div className="list">{quizzes.items.map(q => <div key={q.id} className="list-row static">
            <span className="nav-icon light">✓</span>
            <div className="grow"><strong>{q.title}</strong><small>{q.question_count} суроо · {Math.ceil(q.duration_seconds / 60)} мүнөт</small></div>
            <RowActions disabled={busy} onEdit={() => void editQuiz(q)} onDelete={() => confirmAndRun(`«${q.title}» тестин өчүрөсүзбү? Эгер тесттен өтүү тарыхы болсо, өчүрүү мүмкүн эмес.`, () => call(`training/quizzes/${q.id}`, { method: 'DELETE' }), quizzes.reload, 'Тест өчүрүлгөн жок.')} />
          </div>)}</div>)}
      </>}
    </>

    : <>
      <div className="block-head"><h2>Материалдар</h2><button className="btn btn-primary btn-sm" disabled={busy} onClick={() => setModal({ kind: 'material', material: null })}>+ Материал кошуу</button></div>
      {materials.error && <div className="alert" role="alert">{materials.error}<button className="link-btn" onClick={materials.reload}>Кайра аракет кылуу</button></div>}
      {materials.loading ? <div className="loading"><div className="spinner" /></div> : !materials.error && (materials.items.length === 0 ? <p className="empty">Материалдар азырынча жок.</p> :
        <div className="materials">{materials.items.map(m => <div key={m.id} className="material">
          <RowActions disabled={busy} onEdit={() => setModal({ kind: 'material', material: m })} onDelete={() => confirmAndRun('Бул материалды өчүрөсүзбү?', () => call(`training/materials/${m.id}`, { method: 'DELETE' }), materials.reload, 'Материал өчүрүлгөн жок.')} />
          {m.text && <p className="material-text">{m.text}</p>}
          {m.links.map((u, i) => <a key={`${u}/${i}`} href={u} target="_blank" rel="noreferrer noopener" className="material-link">🔗 {u}</a>)}
          {m.has_file && <button className="file-btn" onClick={() => void openFile(m.id)}>📎 {m.file_name}</button>}
        </div>)}</div>)}
    </>}

    {modal?.kind === 'title' && <TitleModal heading={modal.heading} label={modal.label} initial={modal.initial} onSubmit={modal.submit} onClose={() => setModal(null)} />}
    {modal?.kind === 'material' && lesson && <MaterialModal material={modal.material} onClose={() => setModal(null)} onSubmit={async body => {
      if (modal.material) await call(`training/materials/${modal.material.id}`, { method: 'PATCH', body });
      else await call(`training/subject-topics/${lesson.id}/materials`, { method: 'POST', body });
      setModal(null); materials.reload();
    }} />}
  </>;
}

function ListBlock({ heading, empty, addLabel, state, busy, onAdd, onOpen, onEdit, onDelete }: {
  heading: string; empty: string; addLabel: string; busy: boolean;
  state: { items: Topic[]; loading: boolean; error: string; reload: () => void };
  onAdd: () => void; onOpen: (t: Topic) => void; onEdit: (t: Topic) => void; onDelete: (t: Topic) => void;
}) {
  return <>
    <div className="block-head"><h2>{heading}</h2><button className="btn btn-primary btn-sm" disabled={busy} onClick={onAdd}>+ {addLabel}</button></div>
    {state.error && <div className="alert" role="alert">{state.error}<button className="link-btn" onClick={state.reload}>Кайра аракет кылуу</button></div>}
    {state.loading ? <div className="loading"><div className="spinner" /></div> : !state.error && (state.items.length === 0 ? <p className="empty">{empty}</p> :
      <div className="list">{state.items.map((t, i) => <div key={t.id} className="list-row" role="button" tabIndex={0} onClick={() => onOpen(t)} onKeyDown={e => { if (e.key === 'Enter') onOpen(t); }}>
        <span className="nav-icon light">{i + 1}</span>
        <strong className="grow">{t.title}</strong>
        <RowActions disabled={busy} onEdit={() => onEdit(t)} onDelete={() => onDelete(t)} />
        <span className="arrow">→</span>
      </div>)}</div>)}
  </>;
}
