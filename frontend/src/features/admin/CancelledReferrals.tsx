import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '../../shared/api';

export type CancelledReferral = {
  id: number; course_title: string; reason: string; cancelled_at: string; is_read: boolean;
  course_head: { email: string; study_number: string } | null;
  user: { id: number; study_number: string; email: string; military_unit: string };
  correct_answers: number | null; total: number | null; grade: number | null;
  tests: { quiz_id: number; title: string; module: number | null; correct_answers: number; total: number; grade: number }[];
};
const pad = (v: number) => String(v).padStart(2, '0');
const fmt = (iso: string) => { const d = new Date(iso); return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };

/** Администратор: курстун башчылары жокко чыгарган жолдомолор жана себептери. */
export function CancelledReferrals({ token, onBack }: { token: string; onBack: () => void }) {
  const [items, setItems] = useState<CancelledReferral[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [revision, setRevision] = useState(0);
  const [deleting, setDeleting] = useState<number | null>(null);
  function remove(item: CancelledReferral) {
    const run = async () => {
      setDeleting(item.id); setError('');
      try { await api(`admin/cancelled-referrals/${item.id}`, { method: 'DELETE' }, token); setItems(prev => prev.filter(x => x.id !== item.id)); }
      catch (e) { setError(e instanceof Error ? e.message : 'Өчүрүлгөн жок.'); } finally { setDeleting(null); }
    };
    Alert.alert('Өчүрүүнү ырастоо', `Окуу номери ${item.user.study_number} боюнча жокко чыгарылган жолдомону бул бөлүмдөн өчүрөсүзбү? Жолдомо жокко чыгарылган бойдон калат.`, [
      { text: 'Артка', style: 'cancel' }, { text: 'Өчүрүү', style: 'destructive', onPress: () => { void run(); } },
    ]);
  }
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    api<{ unread: number; items: CancelledReferral[] }>('admin/cancelled-referrals', {}, token)
      .then(d => { if (!active) return; setItems(d.items); if (d.unread) void api('admin/cancelled-referrals', { method: 'POST' }, token).catch(() => undefined); })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : 'Жүктөлгөн жок.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, revision]);
  return <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 30 }}>
    <Pressable accessibilityRole="button" onPress={onBack}><Text style={s.back}>← Башкаруу панели</Text></Pressable>
    <Text style={s.title}>Жокко чыгарылган жолдомолор</Text>
    {loading && <ActivityIndicator color="#193f31" />}
    {!!error && <View><Text accessibilityRole="alert" style={s.error}>{error}</Text><Pressable onPress={() => setRevision(v => v + 1)}><Text style={s.link}>Кайра аракет кылуу</Text></Pressable></View>}
    {!loading && !error && !items.length && <Text style={s.hint}>Жокко чыгарылган жолдомолор жок.</Text>}
    {items.map(item => <View key={item.id} style={[s.card, !item.is_read && s.unread]}>
      <View style={s.row}><Text style={[s.heading, { flex: 1 }]}>Окуу номери: {item.user.study_number}</Text>{!item.is_read && <View style={s.dot} />}</View>
      <Text style={s.hint}>{item.user.email} · {item.user.military_unit}</Text>
      <Text style={s.body}>Курс: {item.course_title}</Text>
      {item.total != null && <Text style={s.body}>Туура жооптор: {item.correct_answers} / {item.total} · Баасы: {item.grade}</Text>}
      <View style={s.reason}><Text style={s.reasonLabel}>Себеби</Text><Text style={s.body}>{item.reason}</Text></View>
      <Text style={s.hint}>Жокко чыгарган: {item.course_head ? `${item.course_head.email} (${item.course_head.study_number})` : '—'} · {fmt(item.cancelled_at)}</Text>
      <Pressable accessibilityRole="button" disabled={deleting !== null} onPress={() => remove(item)} style={[s.delete, deleting !== null && { opacity: 0.5 }]}>{deleting === item.id ? <ActivityIndicator color="#a04435" /> : <Text style={s.deleteText}>⌫ Өчүрүү</Text>}</Pressable>
    </View>)}
    {!loading && <Pressable accessibilityRole="button" onPress={() => setRevision(v => v + 1)}><Text style={s.link}>Жаңылоо</Text></Pressable>}
  </ScrollView>;
}
const s = StyleSheet.create({
  back: { color: '#193f31', fontWeight: '600', paddingVertical: 10 }, title: { fontSize: 24, fontWeight: '700', color: '#193f31' },
  card: { backgroundColor: 'white', borderRadius: 16, padding: 18, gap: 8, borderWidth: 1, borderColor: '#d8e1d3' }, unread: { borderColor: '#c3b071', backgroundColor: '#fffdf5' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 }, dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#d93025' },
  heading: { color: '#193f31', fontSize: 17, fontWeight: '700' }, body: { color: '#334b3c', fontSize: 15, lineHeight: 22 }, hint: { color: '#647560', fontSize: 13, lineHeight: 19 },
  reason: { backgroundColor: '#fbefed', borderRadius: 12, padding: 12, gap: 4 }, reasonLabel: { color: '#a04435', fontWeight: '700', fontSize: 13 },
  delete: { alignSelf: 'flex-end', minHeight: 40, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#fbe9e7', alignItems: 'center', justifyContent: 'center' }, deleteText: { color: '#a04435', fontWeight: '700' },
  link: { color: '#193f31', fontWeight: '600', paddingVertical: 10 }, error: { color: '#a04435' },
});
