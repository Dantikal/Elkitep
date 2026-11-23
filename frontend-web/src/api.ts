export const API_URL = (import.meta.env.VITE_API_URL || '/api/auth').replace(/\/$/, '');
export const APK_URL: string = import.meta.env.VITE_APK_URL || '';
export const IOS_URL: string = import.meta.env.VITE_IOS_URL || '';

export type Role = 'user' | 'doctor' | 'deputy' | 'course_head';
export type Category = 'officers' | 'warrant-sergeants';
export type Status = 'pending' | 'approved' | 'rejected';
export type Profile = { id: number; role: Role; email: string; study_number: string; military_unit: string; is_superuser: boolean; training_category: Category };

/** В веб-кабинет входят администратор и курстун башчысы. */
export const canUseWeb = (p: Profile) => p.is_superuser || p.role === 'course_head';

const TOKEN_KEY = 'kutbilim_admin_token';
export const tokenStore = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (t: string) => { try { localStorage.setItem(TOKEN_KEY, t); } catch { /* ignore */ } },
  clear: () => { try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } },
};

export class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }

function url(path: string) {
  const [route, query] = path.split('?');
  return `${API_URL}/${route.replace(/^\/|\/$/g, '')}/${query ? `?${query}` : ''}`;
}

export async function api<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url(path), {
      ...options,
      headers: { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Token ${token}` } : {}), ...options.headers },
    });
  } catch {
    throw new ApiError('Серверге туташуу мүмкүн болгон жок.', 0);
  }
  const body = response.status === 204 ? '' : await response.text();
  let data: unknown = null;
  if (body.trim()) { try { data = JSON.parse(body); } catch { if (response.ok) throw new ApiError('Серверден туура эмес жооп келди.', response.status); } }
  if (!response.ok) {
    const message = data && typeof data === 'object' ? Object.values(data).flat().join('\n') : '';
    throw new ApiError(message || 'Ката кетти. Кайра аракет кылыңыз.', response.status);
  }
  return data as T;
}

/** Фото доступны только с токеном, поэтому загружаем их как blob. */
export async function fetchBlobUrl(path: string, token: string): Promise<string> {
  const response = await fetch(url(path), { headers: { Authorization: `Token ${token}` } });
  if (!response.ok) throw new ApiError('Сүрөт жүктөлгөн жок.', response.status);
  return URL.createObjectURL(await response.blob());
}

export const roleLabel = (role: Role, category?: Category) =>
  role === 'doctor' ? 'Дарыгер'
  : role === 'deputy' ? 'Күжүрмөн даярдоо боюнча орун басары'
  : role === 'course_head' ? 'Курстун башчысы'
  : category ? (category === 'officers' ? 'Офицер' : 'Прапорщик / сержант') : 'Колдонуучу';
export const categoryLabel = (c: Category) => c === 'officers' ? 'Офицерлер' : 'Прапорщиктер жана сержанттар';
export const statusLabel: Record<Status, string> = { pending: 'Күтүүдө', approved: 'Ырасталган', rejected: 'Четке кагылган' };
