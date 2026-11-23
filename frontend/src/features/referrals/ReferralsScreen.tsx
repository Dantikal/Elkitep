import { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '../../shared/api';
import { logoSource } from '../../shared/branding';
import { printReferral, regLabel, shareReferralPdf } from './referralPdf';

type Referral = {
  id: number; reg_number: number | null; course_title: string; study_number: string; sender: string; auto_sent: boolean; created_at: string; is_read: boolean; message: string;
  test_date: string | null; passed: boolean; grade: number | null; correct_answers: number | null; total: number | null;
  issued_at: string; valid_months: number; exam_deadline: string;
};
const pad = (v: number) => String(v).padStart(2, '0');
const day = (iso: string | null) => { if (!iso) return '—'; const d = new Date(iso); return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`; };
const daysLeft = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);

function Field({ icon, label, value, accent }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value: string; accent?: 'ok' | 'bad' | 'warn' }) {
  return <View style={s.field}>
    <MaterialCommunityIcons name={icon} size={18} color="#7d8c78" />
    <Text style={s.fieldLabel}>{label}</Text>
    <Text style={[s.fieldValue, accent === 'ok' && s.ok, accent === 'bad' && s.bad, accent === 'warn' && s.warn]}>{value}</Text>
  </View>;
}

/** Электрондук жолдомо — документ түрүндө. */
function ReferralDocument({ item }: { item: Referral }) {
  const [busy, setBusy] = useState<'pdf' | 'print' | null>(null);
  const [actionError, setActionError] = useState('');
  async function run(kind: 'pdf' | 'print') {
    if (busy) return;
    setBusy(kind); setActionError('');
    try { if (kind === 'pdf') await shareReferralPdf(item); else await printReferral(item); }
    catch (e) { setActionError(e instanceof Error ? e.message : 'PDF түзүлгөн жок.'); }
    finally { setBusy(null); }
  }
  const left = daysLeft(item.exam_deadline);
  const expired = left < 0;
  return <View style={[s.doc, !item.is_read && s.docNew]}>
    <View style={s.docHead}>
      <Image source={logoSource} resizeMode="contain" style={s.logo} />
      <View style={{ flex: 1 }}>
        <Text style={s.docTitle}>ЭЛЕКТРОНДУК ЖОЛДОМО</Text>
        <Text style={s.docCourse} numberOfLines={2}>{item.course_title}</Text>
        <Text style={s.reg}>Каттоо номери: {regLabel(item.reg_number)}</Text>
      </View>
      {!item.is_read && <View style={s.newBadge}><Text style={s.newText}>ЖАҢЫ</Text></View>}
    </View>

    <View style={s.numberBox}>
      <Text style={s.numberLabel}>Окуу номери</Text>
      <Text style={s.number}>{item.study_number}</Text>
    </View>

    <View style={[s.result, item.passed ? s.resultOk : s.resultBad]}>
      <MaterialCommunityIcons name={item.passed ? 'check-decagram' : 'close-octagon'} size={34} color={item.passed ? '#1e6b43' : '#a04435'} />
      <View><Text style={[s.resultLabel, item.passed ? s.ok : s.bad]}>Тесттин жыйынтыгы</Text><Text style={[s.resultValue, item.passed ? s.ok : s.bad]}>{item.passed ? 'ӨТТҮ' : 'ӨТПӨДҮ'}</Text></View>
    </View>

    <View style={s.fields}>
      <Field icon="calendar-check-outline" label="Тест тапшырган күнү" value={day(item.test_date)} />
      {item.total != null && <Field icon="format-list-checks" label="Туура жооптор / баасы" value={`${item.correct_answers} / ${item.total} · ${item.grade}`} />}
      <Field icon="file-sign" label="Жолдомо берилген күнү" value={day(item.issued_at)} />
      <Field icon="timer-sand" label="Жолдомонун жарактуу мөөнөтү" value={`${item.valid_months} ай`} />
      <Field icon="flag-checkered" label="Практикалык экзамен тапшыруунун акыркы күнү" value={day(item.exam_deadline)} accent={expired ? 'bad' : left <= 7 ? 'warn' : undefined} />
    </View>

    <View style={[s.footer, expired ? s.footerBad : s.footerOk]}>
      <MaterialCommunityIcons name={expired ? 'alert-circle-outline' : 'clock-outline'} size={18} color={expired ? '#a04435' : '#1e6b43'} />
      <Text style={[s.footerText, expired ? s.bad : s.ok]}>{expired ? 'Жолдомонун мөөнөтү бүттү' : left === 0 ? 'Бүгүн акыркы күн' : `Экзаменге чейин ${left} күн калды`}</Text>
    </View>

    <View style={s.actions}>
      <Pressable accessibilityRole="button" disabled={busy !== null} onPress={() => { void run('pdf'); }} style={[s.action, s.actionPrimary, busy !== null && s.dim]}>
        {busy === 'pdf' ? <ActivityIndicator color="white" /> : <><MaterialCommunityIcons name="file-pdf-box" size={20} color="white" /><Text style={s.actionPrimaryText}>PDF бөлүшүү</Text></>}
      </Pressable>
      <Pressable accessibilityRole="button" disabled={busy !== null} onPress={() => { void run('print'); }} style={[s.action, s.actionGhost, busy !== null && s.dim]}>
        {busy === 'print' ? <ActivityIndicator color="#193f31" /> : <><MaterialCommunityIcons name="printer-outline" size={20} color="#193f31" /><Text style={s.actionGhostText}>Басып чыгаруу (A4)</Text></>}
      </Pressable>
    </View>
    {!!actionError && <Text accessibilityRole="alert" style={[s.bad, { textAlign: 'center', paddingHorizontal: 18 }]}>{actionError}</Text>}
    <Text style={s.meta}>{item.auto_sent ? 'Автоматтык түрдө берилди' : item.sender ? `Берген: ${item.sender}` : ''}</Text>
  </View>;
}

/** Билдирүүлөр: электрондук жолдомолор. Ачканда окулду деп белгиленет. */
export function ReferralsScreen({ token, onBack }: { token: string; onBack: () => void }) {
  const [items, setItems] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [revision, setRevision] = useState(0);
  useEffect(() => { const sub = BackHandler.addEventListener('hardwareBackPress', () => { onBack(); return true; }); return () => sub.remove(); }, [onBack]);
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    api<Referral[]>('referrals', {}, token)
      .then(rows => { if (!active) return; setItems(rows); if (rows.some(r => !r.is_read)) void api('referrals/unread', { method: 'POST' }, token).catch(() => undefined); })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : 'Билдирүүлөр жүктөлгөн жок.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, revision]);
  return <ScrollView style={s.root} contentContainerStyle={s.content}>
    <Pressable accessibilityRole="button" onPress={onBack} style={s.back}><Text style={s.link}>← Башкы бет</Text></Pressable>
    <Text accessibilityRole="header" style={s.title}>Билдирүүлөр</Text>
    {loading && <ActivityIndicator color="#193f31" />}
    {!loading && !error && !items.length && <View style={s.empty}><MaterialCommunityIcons name="bell-outline" size={40} color="#9aab95" /><Text style={s.hint}>Азырынча билдирүүлөр жок.</Text></View>}
    {items.map(item => <ReferralDocument key={item.id} item={item} />)}
    {!!error && <View><Text accessibilityRole="alert" style={s.bad}>{error}</Text><Pressable onPress={() => setRevision(v => v + 1)} style={s.back}><Text style={s.link}>Кайра аракет кылуу</Text></Pressable></View>}
  </ScrollView>;
}

const s = StyleSheet.create({
  root: { flex: 1 }, content: { padding: 20, gap: 18, paddingBottom: 40 }, back: { minHeight: 44, justifyContent: 'center' }, link: { color: '#193f31', fontWeight: '600' },
  title: { fontSize: 27, fontWeight: '700', color: '#193f31' }, hint: { color: '#647560', fontSize: 13 }, empty: { alignItems: 'center', gap: 10, paddingVertical: 40 },

  doc: { backgroundColor: '#fffdf7', borderRadius: 20, borderWidth: 1, borderColor: '#e2dcc6', overflow: 'hidden', shadowColor: '#193f31', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  docNew: { borderColor: '#c3b071', borderWidth: 2 },
  docHead: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#193f31', paddingHorizontal: 18, paddingVertical: 16 },
  logo: { width: 44, height: 50 },
  docTitle: { color: '#f3e7b5', fontSize: 16, fontWeight: '800', letterSpacing: 1.5 },
  docCourse: { color: '#cfe0d6', fontSize: 13, marginTop: 3 },
  newBadge: { backgroundColor: '#d93025', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }, newText: { color: 'white', fontSize: 11, fontWeight: '800' },

  numberBox: { alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#ece6d2', borderStyle: 'dashed' },
  numberLabel: { color: '#7d8c78', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
  number: { color: '#193f31', fontSize: 28, fontWeight: '900', letterSpacing: 2, marginTop: 2 },

  fields: { paddingHorizontal: 18, paddingVertical: 8 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#f0ebda' },
  fieldLabel: { flex: 1, color: '#5f705b', fontSize: 14, lineHeight: 19 },
  fieldValue: { color: '#193f31', fontSize: 15, fontWeight: '800', textAlign: 'right', maxWidth: '45%' },
  ok: { color: '#1e6b43' }, bad: { color: '#a04435' }, warn: { color: '#a86b00' },

  footer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 18, marginTop: 6, marginBottom: 6, padding: 12, borderRadius: 12 },
  footerOk: { backgroundColor: '#e6f4ec' }, footerBad: { backgroundColor: '#fbefed' }, footerText: { fontWeight: '700', flex: 1 },

  reg: { color: '#f3e7b5', fontSize: 13, fontWeight: '800', marginTop: 4, letterSpacing: 0.5 },
  result: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, marginHorizontal: 18, marginTop: 16, paddingVertical: 16, borderRadius: 16, borderWidth: 2 },
  resultOk: { backgroundColor: '#e6f4ec', borderColor: '#1e6b43' }, resultBad: { backgroundColor: '#fbefed', borderColor: '#a04435' },
  resultLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  resultValue: { fontSize: 38, fontWeight: '900', letterSpacing: 4, lineHeight: 44 },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 6 },
  action: { flex: 1, minHeight: 48, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 8 },
  actionPrimary: { backgroundColor: '#193f31' }, actionPrimaryText: { color: 'white', fontWeight: '700' },
  actionGhost: { backgroundColor: '#e3ebdc' }, actionGhostText: { color: '#193f31', fontWeight: '700' }, dim: { opacity: 0.5 },
  meta: { color: '#9aa596', fontSize: 12, textAlign: 'center', paddingBottom: 14, paddingTop: 4 },
});
