import { Platform } from 'react-native';
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || (Platform.OS === 'android' ? 'http://10.0.2.2:8000/api/auth' : 'http://localhost:8000/api/auth')).replace(/\/$/, '');
export type Profile = { id: number; role: 'user' | 'doctor' | 'deputy' | 'course_head'; email: string; study_number: string; military_unit: string; is_superuser: boolean; training_category: 'officers' | 'warrant-sergeants' };
export async function api<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const [route, query] = path.split('?');
  const url = `${API_URL}/${route.replace(/\/$/, '')}/${query ? `?${query}` : ''}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal, headers: { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Token ${token}` } : {}), ...options.headers } });
    const body = response.status === 204 ? '' : await response.text();
    let data: unknown = null;
    if (body.trim()) {
      try { data = JSON.parse(body); }
      catch { throw new Error('Серверден туура эмес жооп келди. Кайра аракет кылыңыз.'); }
    }
    if (!response.ok) throw new Error((data && typeof data === 'object' ? Object.values(data).flat().join('\n') : '') || 'Ката кетти. Кайра аракет кылыңыз.');
    return data as T;
  } catch (error) {
    if (error instanceof TypeError || (error instanceof Error && error.name === 'AbortError')) throw new Error('Серверге туташуу мүмкүн болгон жок. Интернетти текшериңиз.');
    throw error;
  } finally { clearTimeout(timeout); }
}
