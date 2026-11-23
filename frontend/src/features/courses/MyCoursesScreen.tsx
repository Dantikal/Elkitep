import { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { api } from '../../shared/api';
import { AdminActions, confirmDelete } from '../../shared/components/AdminActions';
import { Quiz } from '../quizzes/types';
import { CoursesScreen, Section } from './CoursesScreen';
import { formatDeadline } from './CourseQuizScreen';
import { CoursePassers } from './CoursePassers';

type Material = { id: number; text: string; links: string[]; has_file: boolean; file_name: string; topic: number; topic_title: string };
type Member = { id: number; study_number: string; email: string; military_unit: string; enrolled_at: string };
type Tab = 'topics' | 'materials' | 'members' | 'tests' | 'passers';
const tabs: { id: Tab; title: string }[] = [{ id: 'topics', title: 'Темалар' }, { id: 'materials', title: 'Материалдар' }, { id: 'members', title: 'Колдонуучулар' }, { id: 'tests', title: 'Тесттер' }, { id: 'passers', title: 'Тесттен өткөн колдонуучулар' }];

type Props = { token: string; isVisible: boolean; testsRevision: number; onBack: () => void; onTests: (course: Section, create: boolean) => void };
export function MyCoursesScreen({ token, isVisible, testsRevision, onBack, onTests }: Props) {
  const [courses, setCourses] = useState<Section[]>([]);
  const [course, setCourse] = useState<Section | null>(null);
  const [tab, setTab] = useState<Tab>('topics');
  const [topic, setTopic] = useState<Section | null>(null);
  const [topics, setTopics] = useState<Section[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [form, setForm] = useState<'course' | 'topic' | null>(null);
  const [editing, setEditing] = useState<Section | null>(null);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);

  function back() {
    if (busy) return;
    setError('');
    if (form) { setForm(null); setEditing(null); }
    else if (course) { setCourse(null); setTab('topics'); }
    else onBack();
  }
  useEffect(() => {
    if (!isVisible || topic) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { back(); return true; });
    return () => sub.remove();
  });
  useEffect(() => {
    if (topic) return;
    let active = true; setLoading(true); setError('');
    const load = async () => {
      if (!course) { setCourses(await api<Section[]>('courses/my', {}, token)); return; }
      const base = `courses/sections/${course.id}`;
      if (tab === 'topics' || tab === 'materials') {
        const [children, items] = await Promise.all([api<Section[]>(`${base}/children`, {}, token), tab === 'materials' ? api<Material[]>(`${base}/all-materials`, {}, token) : Promise.resolve([])]);
        if (active) { setTopics(children); setMaterials(items); }
      } else if (tab === 'members') { const rows = await api<Member[]>(`${base}/members`, {}, token); if (active) setMembers(rows); }
      else if (tab === 'passers') { /* CoursePassers өзү жүктөйт */ }
      else { const rows = await api<Quiz[]>(`${base}/quizzes`, {}, token); if (active) setQuizzes(rows); }
    };
    load().catch(e => { if (active) setError(e instanceof Error ? e.message : 'Ката кетти.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [course?.id, tab, topic, revision, testsRevision, token]);

  function openForm(kind: 'course' | 'topic', item?: Section) { setEditing(item ?? null); setTitle(item?.title ?? ''); setError(''); setForm(kind); }
  async function save() {
    if (busy) return;
    if (!title.trim()) { setError('Аталышын киргизиңиз.'); return; }
    setBusy(true); setError('');
    try {
      if (editing) {
        const updated = await api<Section>(`courses/sections/item/${editing.id}`, { method: 'PATCH', body: JSON.stringify({ title: title.trim() }) }, token);
        if (form === 'course' && course?.id === updated.id) setCourse(updated);
      } else if (form === 'course') {
        setCourse(await api<Section>('courses/sections', { method: 'POST', body: JSON.stringify({ title: title.trim() }) }, token)); setTab('topics');
      } else if (course) {
        await api(`courses/sections/${course.id}/children`, { method: 'POST', body: JSON.stringify({ title: title.trim() }) }, token);
      }
      setForm(null); setEditing(null); setRevision(value => value + 1);
    } catch (e) { setError(e instanceof Error ? e.message : 'Сакталган жок.'); } finally { setBusy(false); }
  }
  async function remove(item: Section, isCourse: boolean) {
    if (!await confirmDelete(`«${item.title}» ${isCourse ? 'курсун' : 'темасын'} жана анын ичиндеги мазмунду өчүрөсүзбү?`)) return;
    try {
      setError(''); await api(`courses/sections/item/${item.id}`, { method: 'DELETE' }, token);
      if (isCourse && course?.id === item.id) setCourse(null);
      setRevision(value => value + 1);
    } catch (e) { setError(e instanceof Error ? e.message : 'Өчүрүлгөн жок.'); }
  }
  async function openFile(id: number) {
    try { const result = await api<{ url: string }>(`courses/materials/${id}/file-link`, {}, token); await Linking.openURL(result.url); }
    catch (e) { setError(e instanceof Error ? e.message : 'Файл ачылган жок.'); }
  }

  if (course && topic) return <CoursesScreen key={topic.id} token={token} isAdmin={false} isVisible={isVisible} initialPath={[course, topic]} onBack={() => { setTopic(null); setRevision(value => value + 1); }} />;

  return <View style={s.root}>
    <Pressable accessibilityRole="button" disabled={busy} onPress={back} style={s.back}><Text style={s.link}>← Артка</Text></Pressable>
    <Text style={s.breadcrumb}>{['Окуу курстары', 'Менин курстарым', ...(course ? [course.title] : [])].join(' · ')}</Text>
    <View style={s.titleRow}>
      <Text accessibilityRole="header" style={[s.title, { flex: 1 }]}>{course?.title ?? 'Менин курстарым'}</Text>
      {course && !form && <AdminActions onEdit={() => openForm('course', course)} onDelete={() => void remove(course, true)} />}
    </View>

    {form ? <View style={s.card}>
      <Text style={s.label}>{form === 'course' ? 'Курстун аталышы' : 'Теманын аталышы'}</Text>
      <TextInput accessibilityLabel="Аталышы" editable={!busy} maxLength={250} value={title} onChangeText={setTitle} placeholder="Аталышын киргизиңиз" style={s.input} />
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => { void save(); }} style={s.button}>{busy ? <ActivityIndicator color="white" /> : <Text style={s.buttonText}>Сактоо</Text>}</Pressable>
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => { setForm(null); setEditing(null); }} style={s.back}><Text style={s.link}>Жокко чыгаруу</Text></Pressable>
    </View> : !course ? <>
      {loading && <ActivityIndicator color="#193f31" />}
      {!loading && courses.map(item => <Pressable key={item.id} accessibilityRole="button" onPress={() => { setCourse(item); setTab('topics'); }} style={s.row}><Text style={s.rowText}>{item.title}</Text><Text style={s.rowText}>→</Text></Pressable>)}
      {!loading && !error && !courses.length && <Text style={s.body}>Сиз азырынча курс түзө элексиз.</Text>}
      <Pressable accessibilityRole="button" onPress={() => openForm('course')} style={s.button}><Text style={s.buttonText}>Курс кошуу</Text></Pressable>
    </> : <>
      <View style={s.tabs}>{tabs.map(item => <Pressable key={item.id} accessibilityRole="tab" accessibilityState={{ selected: tab === item.id }} onPress={() => setTab(item.id)} style={[s.tab, tab === item.id && s.tabActive]}><Text style={[s.tabText, tab === item.id && s.tabTextActive]}>{item.title}</Text></Pressable>)}</View>
      {loading && <ActivityIndicator color="#193f31" />}

      {!loading && tab === 'topics' && <>
        {topics.map(item => <View key={item.id} style={s.itemRow}>
          <Pressable accessibilityRole="button" onPress={() => setTopic(item)} style={[s.row, { flex: 1 }]}><Text style={s.rowText}>{item.title}</Text><Text style={s.rowText}>→</Text></Pressable>
          <AdminActions onEdit={() => openForm('topic', item)} onDelete={() => void remove(item, false)} />
        </View>)}
        {!error && !topics.length && <Text style={s.body}>Темалар азырынча жок.</Text>}
        <Pressable accessibilityRole="button" onPress={() => openForm('topic')} style={s.button}><Text style={s.buttonText}>Тема кошуу</Text></Pressable>
      </>}

      {!loading && tab === 'materials' && <>
        {!error && !topics.length && <Text style={s.body}>Материал кошуу үчүн адегенде «Темалар» бөлүмүндө тема түзүңүз.</Text>}
        {topics.map(item => {
          const items = materials.filter(material => material.topic === item.id);
          return <View key={item.id} style={s.card}>
            <View style={s.itemRow}><Text style={[s.heading, { flex: 1 }]}>{item.title}</Text><Pressable accessibilityRole="button" onPress={() => setTopic(item)} style={s.back}><Text style={s.link}>+ Материал</Text></Pressable></View>
            {!items.length && <Text style={s.hint}>Материалдар жок.</Text>}
            {items.map(material => <View key={material.id} style={s.material}>
              {!!material.text && <Text selectable style={s.body}>{material.text}</Text>}
              {material.links.map((url, index) => <Pressable key={index} accessibilityRole="link" onPress={() => { void Linking.openURL(url).catch(() => setError('Шилтеме ачылган жок.')); }}><Text style={s.link}>{url}</Text></Pressable>)}
              {material.has_file && <Pressable accessibilityRole="button" onPress={() => { void openFile(material.id); }}><Text style={s.link}>📎 {material.file_name}</Text></Pressable>}
            </View>)}
          </View>;
        })}
      </>}

      {!loading && tab === 'members' && <>
        <Text style={s.hint}>Курска жазылгандар: {members.length}</Text>
        {members.map(member => <View key={member.id} style={s.card}>
          <Text style={s.heading}>{member.study_number}</Text>
          <Text style={s.body}>{member.email}</Text>
          <Text style={s.hint}>Аскер бөлүк: {member.military_unit} · Жазылган: {formatDeadline(member.enrolled_at)}</Text>
        </View>)}
        {!error && !members.length && <Text style={s.body}>Курска азырынча эч ким жазыла элек.</Text>}
      </>}

      {tab === 'passers' && <CoursePassers key={course.id} token={token} courseId={course.id} />}

      {!loading && tab === 'tests' && <>
        <Pressable accessibilityRole="button" onPress={() => onTests(course, true)} style={s.button}><Text style={s.buttonText}>Кошуу</Text></Pressable>
        {quizzes.map(quiz => <Pressable key={quiz.id} accessibilityRole="button" onPress={() => onTests(course, false)} style={s.card}>
          <Text style={s.heading}>{quiz.title}</Text>
          <Text style={s.link}>{quiz.module ?? 1} модуль</Text>
          <Text style={s.body}>{quiz.question_count} суроо · {Math.ceil(quiz.duration_seconds / 60)} мүнөт</Text>
          <Text style={quiz.deadline && new Date(quiz.deadline).getTime() <= Date.now() ? s.error : s.hint}>Дедлайн: {formatDeadline(quiz.deadline)}</Text>
        </Pressable>)}
        {!error && !quizzes.length && <Text style={s.body}>Тесттер азырынча жок.</Text>}
        {!!quizzes.length && <Pressable accessibilityRole="button" onPress={() => onTests(course, false)} style={s.back}><Text style={s.link}>Тесттерди өзгөртүү / өчүрүү →</Text></Pressable>}
      </>}
    </>}

    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    {!form && !loading && <Pressable accessibilityRole="button" onPress={() => setRevision(value => value + 1)} style={s.back}><Text style={s.link}>Жаңылоо</Text></Pressable>}
  </View>;
}

const s = StyleSheet.create({
  root: { gap: 14 }, back: { minHeight: 44, justifyContent: 'center' }, breadcrumb: { color: '#647560', lineHeight: 20, fontSize: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, title: { fontSize: 25, fontWeight: '700', color: '#193f31', lineHeight: 34 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, tab: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: '#d8e1d3', backgroundColor: 'white' },
  tabActive: { backgroundColor: '#193f31', borderColor: '#193f31' }, tabText: { color: '#193f31', fontWeight: '600' }, tabTextActive: { color: 'white' },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, row: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, padding: 20, backgroundColor: 'white', borderRadius: 16, borderWidth: 1, borderColor: '#d8e1d3' },
  rowText: { flexShrink: 1, color: '#193f31', fontSize: 17, fontWeight: '600' }, card: { gap: 10, padding: 20, backgroundColor: 'white', borderRadius: 16, borderWidth: 1, borderColor: '#d8e1d3' },
  material: { gap: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#edf3e9' }, heading: { color: '#193f31', fontSize: 18, fontWeight: '700' },
  body: { color: '#334b3c', fontSize: 16, lineHeight: 24 }, hint: { color: '#647560', fontSize: 13, lineHeight: 20 }, link: { color: '#193f31', fontWeight: '600', lineHeight: 24 },
  label: { color: '#334b3c', fontWeight: '600' }, input: { borderWidth: 1, borderColor: '#d8e1d3', borderRadius: 10, padding: 14, fontSize: 16, color: '#193f31' },
  grade: { minWidth: 36, height: 36, borderRadius: 10, backgroundColor: '#e3ebdc', alignItems: 'center', justifyContent: 'center' }, gradeText: { color: '#193f31', fontWeight: '800', fontSize: 17 },
  button: { backgroundColor: '#193f31', borderRadius: 12, padding: 17, alignItems: 'center' }, buttonText: { color: 'white', fontWeight: '700' }, error: { color: '#a04435', lineHeight: 22 },
});
