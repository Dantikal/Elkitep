import { appName } from '../../shared/branding';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, API_URL, Profile } from '../../shared/api';
import { CancelledReferrals } from './CancelledReferrals';

type Application = { role: Profile['role']; id: number; email: string; study_number: string; military_unit: string; training_category: Profile['training_category']; status: 'pending' | 'approved' | 'rejected'; date_joined: string; has_photo: boolean };
type Page = { count: number; next: string | null; results: Application[] };
type Deputy = { id: number; study_number: string; email: string; status: 'pending' | 'approved' | 'rejected' };
type DeputyGroup = { military_unit: string; deputies: Deputy[] };
type UnitUser = { id: number; email: string; study_number: string; role: Profile['role']; training_category: Profile['training_category']; status: 'pending' | 'approved' | 'rejected' };
type QuizReportUser = { id: number; email: string; study_number: string; submitted: boolean };
type QuizHistory = { user: { id: number; email: string; study_number: string; military_unit: string; training_category: string }; attempts: { id: number; title: string; topic: string; date: string; status: string; grade: number; correct_answers: number; total: number }[] };
const filters = [{ value: 'pending', label: 'Күтүүдө' }, { value: 'approved', label: 'Ырасталган' }, { value: 'rejected', label: 'Четке кагылган' }, { value: 'all', label: 'Баары' }] as const;

export function AdminDashboard({ token, user, onLogout, onBack }: { token: string; user: Profile; onLogout: () => Promise<void>; onBack: () => void }) {
  const [section, setSection] = useState(false);
  const [cancelledOpen, setCancelledOpen] = useState(false);
  const [cancelledUnread, setCancelledUnread] = useState(0);
  useEffect(() => { if (cancelledOpen) return; api<{ unread: number }>('admin/cancelled-referrals', {}, token).then(d => setCancelledUnread(d.unread)).catch(() => undefined); }, [cancelledOpen, token]);
  const [usersSectionOpen, setUsersSectionOpen] = useState(false);
  const [quizResultsOpen, setQuizResultsOpen] = useState(false);
  const [quizUnits, setQuizUnits] = useState<string[]>([]);
  const [quizUnit, setQuizUnit] = useState<string | null>(null);
  const [quizCategory, setQuizCategory] = useState<'officers' | 'warrant-sergeants' | null>(null);
  const [quizReportUsers, setQuizReportUsers] = useState<QuizReportUser[]>([]);
  const [quizReportUserId, setQuizReportUserId] = useState<number | null>(null);
  const [quizHistory, setQuizHistory] = useState<QuizHistory | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [deputyGroups, setDeputyGroups] = useState<DeputyGroup[]>([]);
  const [unitUsers, setUnitUsers] = useState<UnitUser[]>([]);
  const [unitUsersLoading, setUnitUsersLoading] = useState(false); const [unitUsersError, setUnitUsersError] = useState(''); const [unitUsersRevision, setUnitUsersRevision] = useState(0);
  const [filter, setFilter] = useState<string>('pending');
  const [items, setItems] = useState<Application[]>([]);
  const [count, setCount] = useState(0); const [page, setPage] = useState(1); const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const [saving, setSaving] = useState<number | null>(null); const [loggingOut, setLoggingOut] = useState(false);
  const requestId = useRef(0); const decisionInProgress = useRef(false);
  const load = useCallback(async (nextPage = 1) => {
    const id = ++requestId.current;
    setLoading(true); setError('');
    if (nextPage === 1) setPage(1);
    try {
      const result = await api<Page>(`admin/applications?status=${filter}&page=${nextPage}`, {}, token);
      if (id !== requestId.current) return;
      setItems(previous => nextPage === 1 ? result.results : [...previous, ...result.results]);
      setCount(result.count); setPage(nextPage); setHasNext(Boolean(result.next));
    } catch (e) { if (id === requestId.current) setError(e instanceof Error ? e.message : 'Ката кетти.'); }
    finally { if (id === requestId.current) setLoading(false); }
  }, [filter, token]);
  useEffect(() => {
    if (section) { setItems([]); setHasNext(false); void load(); }
    return () => { requestId.current++; };
  }, [load, section]);
  useEffect(() => {
    if (!usersSectionOpen) return;
    let active = true; setUnitUsersLoading(true); setUnitUsersError('');
    const route = selectedUnit ? `admin/unit-users?military_unit=${encodeURIComponent(selectedUnit)}` : 'admin/unit-deputies';
    api<DeputyGroup[] | UnitUser[]>(route, {}, token).then(result => {
      if (!active) return;
      if (selectedUnit) setUnitUsers(result as UnitUser[]); else setDeputyGroups(result as DeputyGroup[]);
    }).catch(e => { if (active) setUnitUsersError(e instanceof Error ? e.message : 'Колдонуучулар жүктөлгөн жок.'); }).finally(() => { if (active) setUnitUsersLoading(false); });
    return () => { active = false; };
  }, [usersSectionOpen, selectedUnit, token, unitUsersRevision]);
  useEffect(() => {
    if (!quizResultsOpen || quizUnit !== null) return;
    api<string[]>('admin/quiz-results/units', {}, token).then(setQuizUnits).catch(e => setError(e instanceof Error ? e.message : 'Жыйынтыктар жүктөлгөн жок.'));
  }, [quizResultsOpen, quizUnit, token]);
  useEffect(() => {
    if (!quizResultsOpen || quizUnit === null || quizCategory === null || quizReportUserId !== null) return;
    api<QuizReportUser[]>(`admin/quiz-results/unit/${encodeURIComponent(quizUnit)}/${quizCategory}`, {}, token).then(setQuizReportUsers).catch(e => setError(e instanceof Error ? e.message : 'Жыйынтыктар жүктөлгөн жок.'));
  }, [quizResultsOpen, quizUnit, quizCategory, quizReportUserId, token]);
  useEffect(() => {
    if (!quizResultsOpen || quizReportUserId === null) return;
    api<QuizHistory>(`admin/quiz-results/user/${quizReportUserId}/history`, {}, token).then(setQuizHistory).catch(e => setError(e instanceof Error ? e.message : 'Тест тарыхы жүктөлгөн жок.'));
  }, [quizResultsOpen, quizReportUserId, token]);

  async function decide(item: Application, decision: 'approved' | 'rejected') {
    if (decisionInProgress.current) return;
    decisionInProgress.current = true; setSaving(item.id); setError('');
    try {
      await api(`admin/applications/${item.id}/decision`, { method: 'POST', body: JSON.stringify({ decision }) }, token);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Ката кетти.'); }
    finally { decisionInProgress.current = false; setSaving(null); }
  }
  function confirmDecision(item: Application, decision: 'approved' | 'rejected') {
    Alert.alert(decision === 'approved' ? 'Өтүнмөнү ырастоо' : 'Өтүнмөнү четке кагуу', item.email, [
      { text: 'Жокко чыгаруу', style: 'cancel' },
      { text: decision === 'approved' ? 'Ырастоо' : 'Четке кагуу', style: decision === 'approved' ? 'default' : 'destructive', onPress: () => { void decide(item, decision); } },
    ]);
  }
  async function logout() { setLoggingOut(true); try { await onLogout(); } catch { setError('Чыгуу мүмкүн болгон жок. Кайра аракет кылыңыз.'); } finally { setLoggingOut(false); } }
  function roleTitle(item: UnitUser) {
    if (item.role === 'doctor') return 'Дарыгер';
    if (item.role === 'deputy') return 'Күжүрмөн даярдоо боюнча орун басары';
    if (item.role === 'course_head') return 'Курстун башчысы';
    return item.training_category === 'officers' ? 'Офицер' : 'Прапорщик / сержант';
  }
  return <View style={s.root}>
    <View style={s.header}><View style={{ flex: 1 }}><Text style={s.brand}>{appName}</Text><Text style={s.subtitle}>Администратор</Text></View><Pressable accessibilityRole="button" disabled={loggingOut || saving !== null} onPress={logout} style={s.logout}>{loggingOut ? <ActivityIndicator color="#193f31" /> : <Text style={s.link}>Чыгуу</Text>}</Pressable></View>
    <Pressable accessibilityRole="button" disabled={saving !== null} onPress={onBack}><Text style={s.back}>← Даярдоо бөлүмдөрү</Text></Pressable>
    {cancelledOpen ? <CancelledReferrals token={token} onBack={() => setCancelledOpen(false)} /> : section ? <>
      <Pressable accessibilityRole="button" disabled={saving !== null} onPress={() => setSection(false)}><Text style={s.back}>← Башкы бет</Text></Pressable>
      <Text style={s.title}>Өтүнмөлөр</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar} contentContainerStyle={{ gap: 8 }}>{filters.map(f => <Pressable accessibilityRole="tab" accessibilityState={{ selected: filter === f.value }} disabled={saving !== null} key={f.value} onPress={() => setFilter(f.value)} style={[s.filter, filter === f.value && s.selected]}><Text style={filter === f.value ? s.white : s.link}>{f.label}</Text></Pressable>)}</ScrollView>
      {error ? <View style={s.errorBox}><Text accessibilityRole="alert" style={s.error}>{error}</Text><Pressable disabled={loading || saving !== null} onPress={() => load()}><Text style={s.link}>Кайра аракет кылуу</Text></Pressable></View> : null}
      <Text style={s.total}>Өтүнмөлөрдүн саны: {count}</Text>
      <FlatList data={items} keyExtractor={item => String(item.id)} contentContainerStyle={s.list} refreshControl={<RefreshControl refreshing={loading && page === 1} onRefresh={() => { if (saving === null) void load(); }} tintColor="#193f31" />} ListEmptyComponent={!loading && !error ? <Text style={s.empty}>Бул бөлүмдө өтүнмөлөр жок.</Text> : null} ListFooterComponent={loading ? <ActivityIndicator color="#193f31" style={{ padding: 16 }} /> : hasNext ? <Pressable disabled={saving !== null} onPress={() => load(page + 1)} style={s.more}><Text style={s.link}>Дагы көрсөтүү</Text></Pressable> : null} renderItem={({ item }) => <View style={s.card}>
        <View style={s.person}>{item.has_photo ? <Image source={{ uri: `${API_URL}/admin/applications/${item.id}/photo/`, headers: { Authorization: `Token ${token}` } }} style={s.photo} /> : <View style={[s.photo, s.initial]}><Text style={s.link}>{item.email.charAt(0).toUpperCase()}</Text></View>}<View style={{ flex: 1 }}><Text style={s.email}>{item.email}</Text><Text style={s.date}>{new Date(item.date_joined).toLocaleDateString('ru-RU')}</Text></View></View>
        <Text style={s.detail}>Роль: {item.role === 'doctor' ? 'Дарыгер' : item.role === 'deputy' ? 'Күжүрмөн даярдоо боюнча орун басары' : item.role === 'course_head' ? 'Курстун башчысы' : 'Колдонуучу'}</Text><Text style={s.detail}>Категория: {item.training_category === 'officers' ? 'Офицерлер' : 'Прапорщиктер жана сержанттар'}</Text><Text style={s.detail}>Окуу номери: {item.study_number}</Text><Text style={s.detail}>Аскер бөлүк: {item.military_unit}</Text><Text style={[s.status, item.status === 'rejected' && s.error]}>{filters.find(f => f.value === item.status)?.label}</Text>
        {saving === item.id ? <ActivityIndicator color="#193f31" style={{ padding: 12 }} /> : <View style={s.actions}>{item.status !== 'approved' && <Pressable accessibilityRole="button" disabled={saving !== null || loading} onPress={() => confirmDecision(item, 'approved')} style={[s.action, s.approve, (saving !== null || loading) && s.disabled]}><Text style={s.white}>Ырастоо</Text></Pressable>}{item.status !== 'rejected' && <Pressable accessibilityRole="button" disabled={saving !== null || loading} onPress={() => confirmDecision(item, 'rejected')} style={[s.action, s.reject, (saving !== null || loading) && s.disabled]}><Text style={s.rejectText}>Четке кагуу</Text></Pressable>}</View>}
      </View>} />
    </> : quizResultsOpen ? <View style={s.unitUsersPage}>
      <Pressable accessibilityRole="button" onPress={() => { if (quizReportUserId !== null) { setQuizReportUserId(null); setQuizHistory(null); } else if (quizCategory) setQuizCategory(null); else if (quizUnit !== null) setQuizUnit(null); else setQuizResultsOpen(false); }}><Text style={s.back}>← {quizReportUserId !== null ? 'Колдонуучуларга кайтуу' : quizCategory ? 'Аскер бөлүктөрүнө кайтуу' : quizUnit !== null ? 'Аскер бөлүктөрүнө кайтуу' : 'Башкаруу панели'}</Text></Pressable>
      <Text style={s.title}>{quizReportUserId !== null ? quizHistory?.user.study_number ?? 'Колдонуучунун тест тарыхы' : quizCategory ? (quizCategory === 'officers' ? 'Офицерлер' : 'Прапорщиктер жана сержанттар') : quizUnit ?? 'Тесттердин жыйынтыктары'}</Text>
      {quizReportUserId !== null ? <ScrollView contentContainerStyle={s.unitList}>{quizHistory?.attempts.length ? quizHistory.attempts.map(item => <View key={item.id} style={s.card}><Text style={s.email}>{item.title}</Text><Text style={s.detail}>{item.topic} · {new Date(item.date).toLocaleDateString('ru-RU')}</Text><Text style={s.detail}>Баасы: {item.grade} · Туура жооп: {item.correct_answers}/{item.total}</Text><Text style={s.detail}>Абалы: {item.status === 'failed' ? 'Аяктаган жок' : item.status === 'timed_out' ? 'Убакыт бүттү' : 'Тапшырылды'}</Text></View>) : <Text style={s.empty}>Бул колдонуучу тест тапшыра элек.</Text>}</ScrollView> : quizUnit === null ? <ScrollView contentContainerStyle={s.unitList}>{quizUnits.map(unit => <Pressable key={unit} onPress={() => setQuizUnit(unit)} style={s.section}><Text style={s.sectionTitle}>{unit}</Text><Text style={s.arrow}>→</Text></Pressable>)}</ScrollView> : quizCategory === null ? <View style={{ gap: 12 }}><Pressable onPress={() => setQuizCategory('officers')} style={s.section}><Text style={s.sectionTitle}>Офицерлер</Text><Text style={s.arrow}>→</Text></Pressable><Pressable onPress={() => setQuizCategory('warrant-sergeants')} style={s.section}><Text style={s.sectionTitle}>Прапорщиктер жана сержанттар</Text><Text style={s.arrow}>→</Text></Pressable></View> : <ScrollView contentContainerStyle={s.quizUserGrid}>{quizReportUsers.map(item => <Pressable key={item.id} onPress={() => { setQuizHistory(null); setQuizReportUserId(item.id); }} style={[s.card, s.quizUserCard]}><Text style={s.email}>{item.study_number}</Text><Text style={s.detail}>{item.email}</Text><Text style={{ color: item.submitted ? '#22834b' : '#b23c32', fontWeight: '700' }}>{item.submitted ? 'Тапшырылды' : 'Тапшырылган эмес'}</Text></Pressable>)}</ScrollView>}
    </View> : usersSectionOpen ? <View style={s.unitUsersPage}>
      <Pressable accessibilityRole="button" onPress={() => { if (selectedUnit) setSelectedUnit(null); else setUsersSectionOpen(false); }}><Text style={s.back}>← {selectedUnit ? 'Аскер бөлүктөрүнө кайтуу' : 'Башкаруу панели'}</Text></Pressable>
      <Text style={s.title}>{selectedUnit ?? 'Колдонуучулар'}</Text>
      {unitUsersLoading ? <ActivityIndicator color="#193f31" /> : unitUsersError ? <View style={s.errorBox}><Text accessibilityRole="alert" style={s.error}>{unitUsersError}</Text><Pressable accessibilityRole="button" onPress={() => setUnitUsersRevision(value => value + 1)}><Text style={s.link}>Кайра жүктөө</Text></Pressable></View> : selectedUnit ? <ScrollView contentContainerStyle={s.unitList}>
        {unitUsers.length === 0 ? <Text style={s.empty}>Бул аскер бөлүктө катталган колдонуучулар жок.</Text> : unitUsers.map(item => <View key={item.id} style={s.card}><Text style={s.email}>{item.study_number}</Text><Text style={s.detail}>{item.email}</Text><Text style={s.detail}>{roleTitle(item)}</Text><Text style={s.status}>{filters.find(f => f.value === item.status)?.label}</Text></View>)}
      </ScrollView> : <ScrollView contentContainerStyle={s.unitList}>
        {deputyGroups.map(group => <View key={group.military_unit} style={s.card}><Text style={s.sectionTitle}>{group.military_unit}</Text>{group.deputies.length ? group.deputies.map(deputy => <Pressable key={deputy.id} accessibilityRole="button" onPress={() => setSelectedUnit(group.military_unit)} style={s.deputyRow}><View style={{ flex: 1 }}><Text style={s.email}>Окуу номери: {deputy.study_number}</Text><Text style={s.detail}>{deputy.email} · {filters.find(f => f.value === deputy.status)?.label}</Text></View><Text style={s.arrow}>→</Text></Pressable>) : <Text style={s.detail}>Орун басарлар катталган эмес</Text>}</View>)}
      </ScrollView>}
      {!unitUsersLoading && !unitUsersError && <Pressable accessibilityRole="button" onPress={() => setUnitUsersRevision(value => value + 1)} style={s.more}><Text style={s.link}>Жаңылоо</Text></Pressable>}
    </View> : <View style={s.home}><Text style={s.title}>Башкаруу панели</Text><Text style={s.subtitle}>{user.email}</Text><Pressable accessibilityRole="button" onPress={() => setSection(true)} style={s.section}><View style={{ flex: 1 }}><Text style={s.sectionTitle}>Өтүнмөлөр</Text><Text style={s.subtitle}>Каттоо өтүнмөлөрүн карап чыгуу</Text></View><Text style={s.arrow}>→</Text></Pressable><Pressable accessibilityRole="button" onPress={() => { setSelectedUnit(null); setUsersSectionOpen(true); }} style={s.section}><View style={{ flex: 1 }}><Text style={s.sectionTitle}>Колдонуучулар</Text><Text style={s.subtitle}>Аскер бөлүгү жана орун басар боюнча кароо</Text></View><Text style={s.arrow}>→</Text></Pressable><Pressable accessibilityRole="button" onPress={() => { setQuizUnit(null); setQuizCategory(null); setQuizReportUserId(null); setQuizResultsOpen(true); }} style={s.section}><View style={{ flex: 1 }}><Text style={s.sectionTitle}>Тесттердин жыйынтыктары</Text><Text style={s.subtitle}>Аскер бөлүгү жана категория боюнча тесттин жыйынтыгы</Text></View><Text style={s.arrow}>→</Text></Pressable><Pressable accessibilityRole="button" onPress={() => setCancelledOpen(true)} style={s.section}><View style={{ flex: 1 }}><Text style={s.sectionTitle}>Жокко чыгарылган жолдомолор{cancelledUnread > 0 ? ` (${cancelledUnread} жаңы)` : ''}</Text><Text style={s.subtitle}>Курстун башчылары жокко чыгарган жолдомолор жана себептери</Text></View><Text style={s.arrow}>→</Text></Pressable>{error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}</View>}
  </View>;
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f1f4ef', paddingHorizontal: 22 }, header: { flexDirection: 'row', alignItems: 'center', paddingVertical: 22, gap: 12 }, brand: { fontSize: 17, fontWeight: '800', letterSpacing: 1, color: '#193f31' }, subtitle: { fontSize: 13, color: '#73816f', marginTop: 6 }, logout: { padding: 12, backgroundColor: '#e4ebdf', borderRadius: 10 }, link: { color: '#193f31', fontWeight: '600' }, home: { paddingTop: 28 }, unitUsersPage: { flex: 1 }, unitList: { paddingBottom: 18, gap: 8 }, quizUserGrid: { paddingBottom: 18, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }, quizUserCard: { width: '48%' }, deputyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#d8e1d3', paddingTop: 14, marginTop: 12 }, title: { fontSize: 24, fontWeight: '700', color: '#193f31', marginBottom: 6 }, section: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'white', paddingHorizontal: 16, paddingVertical: 13, borderRadius: 14, marginTop: 10, borderWidth: 1, borderColor: '#dfe8da' }, sectionTitle: { color: '#193f31', fontSize: 17, fontWeight: '700' }, arrow: { fontSize: 22, color: '#b59b56' }, back: { color: '#53674a', paddingVertical: 8 }, filterBar: { flexGrow: 0, marginTop: 12, marginBottom: 14 }, filter: { paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, backgroundColor: '#e4ebdf' }, selected: { backgroundColor: '#193f31' }, white: { color: 'white', fontWeight: '600' }, total: { fontSize: 12, color: '#73816f', marginBottom: 12 }, list: { paddingBottom: 24, gap: 14 }, card: { backgroundColor: 'white', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#e1e8dd' }, person: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 14 }, photo: { width: 54, height: 54, borderRadius: 27 }, initial: { backgroundColor: '#e4ebdf', alignItems: 'center', justifyContent: 'center' }, email: { color: '#20392d', fontWeight: '700', fontSize: 14 }, date: { fontSize: 11, color: '#819078', marginTop: 4 }, detail: { color: '#4a6046', fontSize: 13, marginBottom: 8 }, status: { color: '#637748', fontWeight: '600', fontSize: 12, marginVertical: 6 }, actions: { flexDirection: 'row', gap: 10, marginTop: 12 }, action: { flex: 1, alignItems: 'center', paddingVertical: 13, borderRadius: 10 }, approve: { backgroundColor: '#193f31' }, reject: { backgroundColor: '#f9ece8' }, rejectText: { color: '#a04435', fontWeight: '600' }, error: { color: '#a04435', lineHeight: 20 }, errorBox: { gap: 12, marginBottom: 12 }, empty: { textAlign: 'center', color: '#73816f', paddingVertical: 36 }, more: { padding: 18, alignItems: 'center' }, disabled: { opacity: 0.5 },
});
