import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { api } from '../../shared/api';
import { formatDeadline } from './CourseQuizScreen';

type Passer = {
  id: number; study_number: string; email: string; military_unit: string; correct_answers: number; total: number; grade: number;
  state: 'pending' | 'sent' | 'cancelled'; auto_sent: boolean; decision_deadline: string; referral_sent_at: string | null; cancelled_at: string | null; cancel_reason: string;
  tests: { quiz_id: number; title: string; module: number | null; status: string; correct_answers: number; total: number; grade: number }[];
};
type Data = { required_tests: number; decision_hours: number; server_now: string; users: Passer[] };

/** Калган убакыт: «23 саат 15 мүнөт». */
function remaining(ms: number) {
  if (ms <= 0) return '0 мүнөт';
  const minutes = Math.ceil(ms / 60000);
  const h = Math.floor(minutes / 60); const m = minutes % 60;
  return h ? `${h} саат ${m} мүнөт` : `${m} мүнөт`;
}

/** «Тесттен өткөн колдонуучулар»: 24 саат ичинде жолдомо жөнөтүү же себеби менен жокко чыгаруу. */
export function CoursePassers({ token, courseId }: { token: string; courseId: number }) {
  const [data, setData] = useState<Data | null>(null);
  const [offset, setOffset] = useState(0); // сервер менен түзмөктүн убакыт айырмасы
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState<number | null>(null);
  const [cancelFor, setCancelFor] = useState<Passer | null>(null);
  const [reason, setReason] = useState(''); const [reasonError, setReasonError] = useState('');

  useEffect(() => {
    let active = true; setLoading(true); setError('');
    api<Data>(`courses/sections/${courseId}/test-passers`, {}, token)
      .then(d => { if (!active) return; setData(d); setOffset(new Date(d.server_now).getTime() - Date.now()); })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : 'Ката кетти.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [courseId, token, revision]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(timer); }, []);

  // Мөөнөт бүткөн «күтүүдөгү» жолдомо серверде автоматтык жөнөтүлөт — тизмени жаңылайбыз.
  const serverNow = now + offset;
  const expiredPending = data?.users.some(u => u.state === 'pending' && new Date(u.decision_deadline).getTime() <= serverNow);
  useEffect(() => { if (expiredPending && !loading) setRevision(v => v + 1); }, [expiredPending]);

  function replace(row: Passer) { setData(d => d && { ...d, users: d.users.map(u => u.id === row.id ? row : u) }); }

  function send(item: Passer) {
    const run = async () => {
      setBusy(item.id); setError('');
      try { replace(await api<Passer>(`courses/sections/${courseId}/referrals`, { method: 'POST', body: JSON.stringify({ user_id: item.id }) }, token)); }
      catch (e) { setError(e instanceof Error ? e.message : 'Жолдомо жөнөтүлгөн жок.'); setRevision(v => v + 1); }
      finally { setBusy(null); }
    };
    Alert.alert('Жолдомо жөнөтүү', `Окуу номери: ${item.study_number}\n${item.email}`, [{ text: 'Артка', style: 'cancel' }, { text: 'Жөнөтүү', onPress: () => { void run(); } }]);
  }

  async function confirmCancel() {
    if (!cancelFor) return;
    if (!reason.trim()) { setReasonError('Жокко чыгаруунун себебин жазыңыз.'); return; }
    setBusy(cancelFor.id); setReasonError('');
    try {
      replace(await api<Passer>(`courses/sections/${courseId}/referrals/cancel`, { method: 'POST', body: JSON.stringify({ user_id: cancelFor.id, reason: reason.trim() }) }, token));
      setCancelFor(null); setReason('');
    } catch (e) { setReasonError(e instanceof Error ? e.message : 'Жокко чыгарылган жок.'); }
    finally { setBusy(null); }
  }

  if (loading && !data) return <ActivityIndicator color="#193f31" />;
  return <View style={{ gap: 14 }}>
    {data && <Text style={s.hint}>Курстун {data.required_tests} модулдук тестинен өткөн колдонуучулар: {data.users.length}. Тест аяктагандан кийин {data.decision_hours} саат ичинде жолдомону жөнөтүңүз же жокко чыгарыңыз. Мөөнөт өтсө, жолдомо автоматтык түрдө жөнөтүлөт.</Text>}
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    {data?.users.map(item => {
      const left = new Date(item.decision_deadline).getTime() - serverNow;
      return <View key={item.id} style={s.card}>
        <View style={s.row}><Text style={[s.heading, { flex: 1 }]}>{item.study_number}</Text><View style={s.grade}><Text style={s.gradeText}>{item.grade}</Text></View></View>
        <Text style={s.body}>{item.email}</Text>
        <Text style={s.hint}>Аскер бөлүк: {item.military_unit}</Text>
        <Text style={s.body}>Туура жооптор: {item.correct_answers} / {item.total} · Баасы: {item.grade}</Text>
        {item.tests.map(t => <Text key={t.quiz_id} style={t.status === 'failed' ? s.error : s.hint}>• {t.module ? `${t.module} модуль · ` : ''}{t.title}: {t.correct_answers}/{t.total} · баасы {t.grade}{t.status === 'failed' ? ' · провал' : ''}</Text>)}

        {item.state === 'pending' && <>
          <View style={s.timer}><Text style={s.timerText}>⏳ Калган убакыт: {remaining(left)}</Text><Text style={s.hint}>Мөөнөтү: {formatDeadline(item.decision_deadline)}</Text></View>
          <Pressable accessibilityRole="button" disabled={busy !== null} onPress={() => send(item)} style={[s.button, busy !== null && s.dim]}>{busy === item.id ? <ActivityIndicator color="white" /> : <Text style={s.buttonText}>Жолдомо жөнөтүү</Text>}</Pressable>
          <Pressable accessibilityRole="button" disabled={busy !== null} onPress={() => { setCancelFor(item); setReason(''); setReasonError(''); }} style={[s.outlineDanger, busy !== null && s.dim]}><Text style={s.dangerText}>Жокко чыгаруу</Text></Pressable>
        </>}
        {item.state === 'sent' && <Text style={s.ok}>✓ Жолдомо жөнөтүлдү{item.auto_sent ? ' (автоматтык түрдө)' : ''} · {formatDeadline(item.referral_sent_at)}</Text>}
        {item.state === 'cancelled' && <View style={s.cancelled}><Text style={s.dangerText}>✕ Жолдомо жокко чыгарылды · {formatDeadline(item.cancelled_at)}</Text><Text style={s.body}>Себеби: {item.cancel_reason}</Text></View>}
      </View>;
    })}
    {data && !error && !data.users.length && <Text style={s.body}>Азырынча {data.required_tests} модулдук тесттен өткөн колдонуучулар жок.</Text>}
    <Pressable accessibilityRole="button" onPress={() => setRevision(v => v + 1)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={s.link}>Жаңылоо</Text></Pressable>

    <Modal visible={!!cancelFor} transparent animationType="slide" onRequestClose={() => { if (busy === null) setCancelFor(null); }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.sheetWrap}>
        <Pressable style={{ flex: 1 }} onPress={() => { if (busy === null) setCancelFor(null); }} />
        <View style={s.sheet}>
          <View style={s.handle} />
          <Text style={s.heading}>Жолдомону жокко чыгаруу</Text>
          {cancelFor && <Text style={s.hint}>Окуу номери: {cancelFor.study_number} · {cancelFor.email}</Text>}
          <Text style={s.label}>Жокко чыгаруунун себеби</Text>
          <TextInput accessibilityLabel="Жокко чыгаруунун себеби" editable={busy === null} multiline autoFocus maxLength={2000} value={reason} onChangeText={setReason} placeholder="Себебин жазыңыз" style={s.input} />
          <Text style={s.hint}>Себеби администраторго жөнөтүлөт.</Text>
          {!!reasonError && <Text accessibilityRole="alert" style={s.error}>{reasonError}</Text>}
          <Pressable accessibilityRole="button" disabled={busy !== null} onPress={() => { void confirmCancel(); }} style={[s.danger, busy !== null && s.dim]}>{busy !== null ? <ActivityIndicator color="white" /> : <Text style={s.buttonText}>Жокко чыгаруу</Text>}</Pressable>
          <Pressable accessibilityRole="button" disabled={busy !== null} onPress={() => setCancelFor(null)} style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center' }}><Text style={s.link}>Артка</Text></Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  </View>;
}

const s = StyleSheet.create({
  card: { gap: 10, padding: 20, backgroundColor: 'white', borderRadius: 16, borderWidth: 1, borderColor: '#d8e1d3' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 }, heading: { color: '#193f31', fontSize: 18, fontWeight: '700' },
  body: { color: '#334b3c', fontSize: 16, lineHeight: 24 }, hint: { color: '#647560', fontSize: 13, lineHeight: 20 }, link: { color: '#193f31', fontWeight: '600' },
  error: { color: '#a04435', lineHeight: 22 }, ok: { color: '#1e6b43', fontWeight: '700', lineHeight: 22 }, label: { color: '#334b3c', fontWeight: '600' },
  grade: { minWidth: 36, height: 36, borderRadius: 10, backgroundColor: '#e3ebdc', alignItems: 'center', justifyContent: 'center' }, gradeText: { color: '#193f31', fontWeight: '800', fontSize: 17 },
  timer: { backgroundColor: '#fff7e6', borderRadius: 12, padding: 12, gap: 2 }, timerText: { color: '#7a5300', fontWeight: '700' },
  button: { backgroundColor: '#193f31', borderRadius: 12, padding: 16, alignItems: 'center' }, buttonText: { color: 'white', fontWeight: '700' },
  outlineDanger: { borderWidth: 1, borderColor: '#a04435', borderRadius: 12, padding: 15, alignItems: 'center' }, dangerText: { color: '#a04435', fontWeight: '700' },
  danger: { backgroundColor: '#a04435', borderRadius: 12, padding: 16, alignItems: 'center' }, dim: { opacity: 0.5 },
  cancelled: { backgroundColor: '#fbefed', borderRadius: 12, padding: 12, gap: 4 },
  sheetWrap: { flex: 1, backgroundColor: 'rgba(12,25,18,0.45)' },
  sheet: { backgroundColor: 'white', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 22, paddingBottom: 34, gap: 12 },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: '#d8e1d3', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#d8e1d3', borderRadius: 12, padding: 14, fontSize: 16, color: '#193f31', minHeight: 110, textAlignVertical: 'top' },
});
