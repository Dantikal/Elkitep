import { FormEvent, useEffect, useRef, useState } from 'react';

export type Call = <T>(path: string, init?: RequestInit) => Promise<T>;
export type Topic = { id: number; title: string };
export type Material = { id: number; text: string; links: string[]; has_file: boolean; file_name: string };

/** Открывает файл по подписанной ссылке (ссылка живёт 5 минут). */
export async function openSignedFile(call: Call, linkRoute: string) {
  // Вкладку открываем сразу, иначе браузер заблокирует всплывающее окно.
  const tabWin = window.open('', '_blank');
  try {
    const { url } = await call<{ url: string }>(linkRoute);
    const u = new URL(url, window.location.origin);
    const target = `${u.pathname}${u.search}`; // тот же домен (через прокси/nginx)
    if (tabWin) tabWin.location.href = target; else window.location.href = target;
  } catch (e) { tabWin?.close(); throw e; }
}

export const errText = (e: unknown, fallback: string) => e instanceof Error ? e.message : fallback;

/** Общий хук загрузки списка с перезагрузкой. */
export function useList<T>(call: Call, route: string | null) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const [rev, setRev] = useState(0);
  useEffect(() => {
    if (!route) { setItems([]); return; }
    let active = true; setLoading(true); setError(''); setItems([]);
    call<T[]>(route).then(d => { if (active) setItems(d); }).catch(e => { if (active) setError(errText(e, 'Жүктөлгөн жок.')); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [call, route, rev]);
  return { items, loading, error, reload: () => setRev(r => r + 1) };
}

/** Модальное окно для ввода названия (добавление/переименование). */
export function TitleModal({ heading, label, initial, onSubmit, onClose }: { heading: string; label: string; initial: string; onSubmit: (title: string) => Promise<void>; onClose: () => void }) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!value.trim()) { setError('Аталышты киргизиңиз.'); return; }
    setBusy(true); setError('');
    try { await onSubmit(value.trim()); } catch (err) { setError(errText(err, 'Ката кетти.')); setBusy(false); }
  }
  return <div className="modal-bg" onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
    <form className="modal modal-sm" onSubmit={submit}>
      <div className="modal-head"><h2>{heading}</h2><button type="button" className="link-btn" disabled={busy} onClick={onClose}>✕</button></div>
      <label>{label}<input autoFocus maxLength={250} disabled={busy} value={value} onChange={e => setValue(e.target.value)} placeholder="Аталышын киргизиңиз" /></label>
      {error && <div className="alert" role="alert">{error}</div>}
      <div className="modal-actions"><button type="button" className="btn btn-ghost" disabled={busy} onClick={onClose}>Жокко чыгаруу</button><button className="btn btn-primary" disabled={busy}>{busy ? 'Сакталууда…' : initial ? 'Өзгөртүүлөрдү сактоо' : 'Кошуу'}</button></div>
    </form>
  </div>;
}

/** Форма материала: текст, ссылки, файлы (как в мобильном приложении). */
export function MaterialModal({ material, onSubmit, onClose }: { material: Material | null; onSubmit: (body: FormData) => Promise<void>; onClose: () => void }) {
  const [text, setText] = useState(material?.text ?? '');
  const [links, setLinks] = useState(material?.links.join('\n') ?? '');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const urls = links.split('\n').map(v => v.trim()).filter(Boolean);
    if (!text.trim() && !urls.length && !files.length && !material?.has_file) { setError('Текст, шилтеме же файл кошуңуз.'); return; }
    if (urls.some(v => !/^https?:\/\/\S+$/i.test(v))) { setError('Шилтемелерди https:// же http:// менен киргизиңиз.'); return; }
    const body = new FormData();
    body.append('text', text.trim()); body.append('links', JSON.stringify(urls));
    files.forEach(f => body.append('files', f, f.name));
    setBusy(true); setError('');
    try { await onSubmit(body); } catch (err) { setError(errText(err, 'Материал сакталган жок.')); setBusy(false); }
  }
  return <div className="modal-bg" onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
    <form className="modal" onSubmit={submit}>
      <div className="modal-head"><h2>{material ? 'Материалды өзгөртүү' : 'Материал кошуу'}</h2><button type="button" className="link-btn" disabled={busy} onClick={onClose}>✕</button></div>
      <label>Тексттик мазмун<textarea rows={6} disabled={busy} value={text} onChange={e => setText(e.target.value)} placeholder="Материалдын мазмунун киргизиңиз" /></label>
      <label>Шилтемелер (ар бирин жаңы сапка)<textarea rows={3} disabled={busy} value={links} onChange={e => setLinks(e.target.value)} placeholder="https://..." /></label>
      <div className="files">
        <input ref={fileInput} type="file" hidden multiple={!material} onChange={e => { const picked = Array.from(e.target.files ?? []); setFiles(prev => material ? picked.slice(0, 1) : [...prev, ...picked]); e.target.value = ''; }} />
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => fileInput.current?.click()}>📎 Файлдарды тандоо</button>
        {material?.file_name && !files.length && <span className="muted small">Учурдагы файл: {material.file_name}</span>}
        {files.map((f, i) => <span key={`${f.name}/${i}`} className="chip">{f.name}<button type="button" disabled={busy} aria-label="Алып салуу" onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}>×</button></span>)}
      </div>
      {!material && files.length > 1 && <p className="muted small">Ар бир кошумча файл өзүнчө материал болуп сакталат.</p>}
      {error && <div className="alert" role="alert">{error}</div>}
      <div className="modal-actions"><button type="button" className="btn btn-ghost" disabled={busy} onClick={onClose}>Жокко чыгаруу</button><button className="btn btn-primary" disabled={busy}>{busy ? 'Сакталууда…' : material ? 'Өзгөртүүлөрдү сактоо' : 'Кошуу'}</button></div>
    </form>
  </div>;
}

export function RowActions({ onEdit, onDelete, disabled }: { onEdit: () => void; onDelete: () => void; disabled?: boolean }) {
  return <span className="row-actions">
    <button className="icon-btn" title="Өзгөртүү" aria-label="Өзгөртүү" disabled={disabled} onClick={e => { e.stopPropagation(); onEdit(); }}>✎</button>
    <button className="icon-btn danger" title="Өчүрүү" aria-label="Өчүрүү" disabled={disabled} onClick={e => { e.stopPropagation(); onDelete(); }}>⌫</button>
  </span>;
}

