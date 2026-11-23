import { useState } from 'react';

type Call = <T>(path: string, init?: RequestInit) => Promise<T>;
type Draft = { key: number; text: string; options: string[]; correct_index: number | null };
export type QuizDraft = { id: number; title: string; duration_seconds: number; deadline?: string | null; module?: 1 | 2 | null; questions: { text: string; options: string[]; correct_index: number }[] };

let nextKey = 0;
const newQuestion = (): Draft => ({ key: nextKey++, text: '', options: ['', ''], correct_index: null });
const letter = (i: number) => String.fromCharCode(65 + i);
const pad = (v: number) => String(v).padStart(2, '0');
/** ISO → значение для <input type="datetime-local"> в локальном времени. По умолчанию: через неделю, 23:59. */
function toLocalInput(iso?: string | null) {
  const d = iso ? new Date(iso) : new Date(Date.now() + 7 * 24 * 3600 * 1000);
  if (!iso) d.setHours(23, 59, 0, 0);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Та же форма, что и в мобильном QuizEditor: название, время, 2–10 вариантов, один правильный. */
export function QuizEditor({ call, route, topicTitle, initialQuiz, onBack, onSaved, withDeadline = false, withModule = false, initialModule = 1, itemRoute = id => `training/quizzes/${id}` }: { call: Call; route: string; topicTitle: string; initialQuiz?: QuizDraft; onBack: () => void; onSaved: () => void; withDeadline?: boolean; withModule?: boolean; initialModule?: 1 | 2; itemRoute?: (id: number) => string }) {
  const [module, setModule] = useState<1 | 2>(initialQuiz?.module ?? initialModule);
  const [deadline, setDeadline] = useState(() => toLocalInput(initialQuiz?.deadline));
  const [title, setTitle] = useState(initialQuiz?.title ?? `${topicTitle} — тест`.slice(0, 250));
  const [minutes, setMinutes] = useState(String(initialQuiz ? initialQuiz.duration_seconds / 60 : 30));
  const [questions, setQuestions] = useState<Draft[]>(initialQuiz ? initialQuiz.questions.map(q => ({ key: nextKey++, text: q.text, options: q.options, correct_index: q.correct_index })) : [newQuestion()]);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');

  const update = (key: number, change: Partial<Draft>) => setQuestions(prev => prev.map(q => q.key === key ? { ...q, ...change } : q));

  async function save() {
    if (busy) return;
    setError('');
    if (!title.trim() || !/^\d+$/.test(minutes) || Number(minutes) < 1 || Number(minutes) > 1440) { setError('Аталышты жана убакытты туура киргизиңиз (1–1440 мүнөт).'); return; }
    if (questions.some(q => !q.text.trim() || q.options.some(o => !o.trim()) || q.correct_index === null)) { setError('Ар бир суроону жана жоопторун толтуруп, бир туура жоопту тандаңыз.'); return; }
    // Поле datetime-local хранит только минуты: если дедлайн не меняли, отправляем исходное значение.
    const unchanged = withDeadline && !!initialQuiz?.deadline && deadline === toLocalInput(initialQuiz.deadline);
    const deadlineDate = withDeadline ? (unchanged ? new Date(initialQuiz!.deadline!) : new Date(deadline)) : null;
    if (deadlineDate && Number.isNaN(deadlineDate.getTime())) { setError('Мөөнөттү (дедлайнды) киргизиңиз.'); return; }
    if (deadlineDate && !unchanged && deadlineDate.getTime() <= Date.now()) { setError('Мөөнөт келечектеги күн болушу керек.'); return; }
    setBusy(true);
    try {
      const body = JSON.stringify({ title: title.trim(), duration_seconds: Number(minutes) * 60, ...(deadlineDate ? { deadline: deadlineDate.toISOString() } : {}), ...(withModule ? { module } : {}), questions: questions.map(({ key: _key, ...q }) => ({ ...q, text: q.text.trim(), options: q.options.map(v => v.trim()) })) });
      await call(initialQuiz ? itemRoute(initialQuiz.id) : route, { method: initialQuiz ? 'PATCH' : 'POST', body });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'Тест сакталган жок.'); }
    finally { setBusy(false); }
  }

  return <div className="editor">
    <button className="link-btn back" disabled={busy} onClick={onBack}>← Артка</button>
    <h1 className="page-title">{initialQuiz ? 'Тестти өзгөртүү' : 'Тест кошуу'}</h1>
    <div className="form-card">
      <div className="form-row">
        <label className="grow">Тесттин аталышы<input maxLength={250} disabled={busy} value={title} onChange={e => setTitle(e.target.value)} /></label>
        <label className="narrow">Убакыт (мүнөт)<input inputMode="numeric" disabled={busy} value={minutes} onChange={e => setMinutes(e.target.value.replace(/\D/g, ''))} /></label>
      </div>
      {withModule && <div className="field"><span className="field-label">Модуль</span><div className="segmented">{([1, 2] as const).map(v => <button key={v} type="button" className={module === v ? 'active' : ''} disabled={busy} onClick={() => setModule(v)}>{v} модуль</button>)}</div></div>}
      {withDeadline && <label>Дедлайн — тест ушул убакытка чейин кабыл алынат<input type="datetime-local" disabled={busy} value={deadline} onChange={e => setDeadline(e.target.value)} /></label>}
      <p className="muted small">Ар бир суроодо 2ден 10го чейин жооп жана бир туура жооп болот. Бардык суроолор бирдей бааланат. Туура жоопту сол жактагы тегерекче менен белгилеңиз.</p>
    </div>
    {questions.map((q, index) => <div className="form-card" key={q.key}>
      <div className="q-head"><strong>Суроо {index + 1}</strong>{questions.length > 1 && <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => setQuestions(prev => prev.filter(i => i.key !== q.key))}>Өчүрүү</button>}</div>
      <textarea rows={2} disabled={busy} value={q.text} onChange={e => update(q.key, { text: e.target.value })} placeholder="Суроону жазыңыз" />
      <div className="options">{q.options.map((opt, oi) => <div key={oi} className={`option ${q.correct_index === oi ? 'correct' : ''}`}>
        <button type="button" className="radio" disabled={busy} aria-label={`${letter(oi)} туура жооп`} aria-pressed={q.correct_index === oi} onClick={() => update(q.key, { correct_index: oi })}>{q.correct_index === oi ? '●' : '○'} {letter(oi)}</button>
        <input disabled={busy} value={opt} placeholder="Жооп" onChange={e => update(q.key, { options: q.options.map((v, i) => i === oi ? e.target.value : v) })} />
        {q.options.length > 2 && <button type="button" className="icon-btn danger" aria-label="Жоопту өчүрүү" disabled={busy} onClick={() => update(q.key, { options: q.options.filter((_, i) => i !== oi), correct_index: q.correct_index === oi ? null : q.correct_index !== null && q.correct_index > oi ? q.correct_index - 1 : q.correct_index })}>×</button>}
      </div>)}</div>
      {q.options.length < 10 && <button className="link-btn" disabled={busy} onClick={() => update(q.key, { options: [...q.options, ''] })}>+ Жооп кошуу ({q.options.length}/10)</button>}
    </div>)}
    {questions.length < 500 && <button className="btn btn-ghost" disabled={busy} onClick={() => setQuestions(prev => [...prev, newQuestion()])}>+ Суроо кошуу</button>}
    {error && <div className="alert" role="alert">{error}</div>}
    <div className="editor-foot"><button className="btn btn-primary" disabled={busy} onClick={() => void save()}>{busy ? 'Сакталууда…' : initialQuiz ? 'Өзгөртүүлөрдү сактоо' : 'Тестти кошуу'}</button></div>
  </div>;
}
