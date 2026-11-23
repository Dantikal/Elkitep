import { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Linking, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { api } from '../../shared/api';
import { AdminActions, confirmDelete } from '../../shared/components/AdminActions';

type Topic = { id: number; title: string };
type Material = { id: number; text: string; links: string[]; has_file: boolean; file_name: string };
type EditableMaterial = Material;
type Attachment = { uri: string; name: string; mimeType?: string; file?: Blob };
const periods = [
  { title: '1 - жарым жылдык', months: [{ id: 12, title: 'Декабрь' }, { id: 1, title: 'Январь' }, { id: 2, title: 'Февраль' }, { id: 3, title: 'Март' }, { id: 4, title: 'Апрель' }] },
  { title: '2 - жарым жылдык', months: [{ id: 6, title: 'Июнь' }, { id: 7, title: 'Июль' }, { id: 8, title: 'Август' }, { id: 9, title: 'Сентябрь' }, { id: 10, title: 'Октябрь' }] },
];
export function TrainingPlanScreen({ token, isAdmin, category, section, onTests, isVisible = true, onBack }: { token: string; isAdmin: boolean; category: 'officers' | 'warrant-sergeants'; section: 'command' | 'independent'; onTests: (month: { id: number; title: string }, topic: Topic) => void; isVisible?: boolean; onBack: () => void }) {
  const sectionTitle = section === 'command' ? 'Командирдик даярдоо' : 'Өз алдынча даярдануу';
  const planTitle = section === 'command' ? '2026-жылдын окуу жылынын командирдик даярдоо планы' : '2026-жылдын окуу жылынын өз алдынча даярдануу планы';
  const categoryTitle = category === 'officers' ? 'Офицерлер' : 'Прапорщиктер жана сержанттар';
  const [plan, setPlan] = useState(false);
  const [period, setPeriod] = useState<number | null>(null);
  const [month, setMonth] = useState<{ id: number; title: string } | null>(null);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [lessonTopic, setLessonTopic] = useState<Topic | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [subjectTopics, setSubjectTopics] = useState<Topic[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [form, setForm] = useState(false);
  const [editingTopic, setEditingTopic] = useState<number | null>(null);
  const [editingLessonTopic, setEditingLessonTopic] = useState<number | null>(null);
  const [editingMaterial, setEditingMaterial] = useState<EditableMaterial | null>(null);
  const [title, setTitle] = useState(''); const [text, setText] = useState(''); const [links, setLinks] = useState('');
  const [files, setFiles] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  function back() {
    if (busy) return;
    setError('');
    if (form) { setForm(false); setEditingTopic(null); setEditingLessonTopic(null); setEditingMaterial(null); }
    else if (lessonTopic) setLessonTopic(null);
    else if (topic) setTopic(null);
    else if (month) setMonth(null);
    else if (period !== null) setPeriod(null);
    else if (plan) setPlan(false);
    else onBack();
  }
  useEffect(() => { if (!isVisible) return; const sub = BackHandler.addEventListener('hardwareBackPress', () => { back(); return true; }); return () => sub.remove(); });
  useEffect(() => {
    if (!month) return;
    let active = true; setLoading(true); setError(''); setTopics([]); setSubjectTopics([]); setMaterials([]);
    const route = lessonTopic ? `training/subject-topics/${lessonTopic.id}/materials` : topic ? `training/subjects/${topic.id}/topics` : `training/2026/sections/${section}/${category}/months/${month.id}/topics`;
    api<Topic[] | Material[]>(route, {}, token).then(data => { if (active) { if (lessonTopic) setMaterials(data as Material[]); else if (topic) setSubjectTopics(data as Topic[]); else setTopics(data as Topic[]); } }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [month?.id, topic?.id, lessonTopic?.id, revision, token, category, section]);
  function openForm() { setTitle(''); setText(''); setLinks(''); setFiles([]); setEditingTopic(null); setEditingLessonTopic(null); setEditingMaterial(null); setError(''); setForm(true); }
  function editTopic(item: Topic) { setEditingTopic(item.id); setEditingLessonTopic(null); setEditingMaterial(null); setTitle(item.title); setError(''); setForm(true); }
  function editLessonTopic(item: Topic) { setEditingLessonTopic(item.id); setEditingTopic(null); setEditingMaterial(null); setTitle(item.title); setError(''); setForm(true); }
  function editMaterial(item: EditableMaterial) { setEditingMaterial(item); setEditingTopic(null); setEditingLessonTopic(null); setText(item.text); setLinks(item.links.join('\n')); setFiles([]); setError(''); setForm(true); }
  async function removeTopic(item: Topic) {
    if (!await confirmDelete(`«${item.title}» предметин өчүрөсүзбү?`)) return;
    try { setError(''); await api(`training/topics/${item.id}`, { method: 'DELETE' }, token); setRevision(value => value + 1); }
    catch (e) { setError(e instanceof Error ? e.message : 'Предмет өчүрүлгөн жок.'); }
  }
  async function removeLessonTopic(item: Topic) {
    if (!await confirmDelete(`«${item.title}» темасын жана анын материалдарын өчүрөсүзбү?`)) return;
    try { setError(''); await api(`training/subject-topics/${item.id}`, { method: 'DELETE' }, token); setRevision(value => value + 1); }
    catch (e) { setError(e instanceof Error ? e.message : 'Тема өчүрүлгөн жок.'); }
  }
  async function removeMaterial(item: Material) {
    if (!await confirmDelete('Бул материалды өчүрөсүзбү?')) return;
    try { setError(''); await api(`training/materials/${item.id}`, { method: 'DELETE' }, token); setRevision(value => value + 1); }
    catch (e) { setError(e instanceof Error ? e.message : 'Материал өчүрүлгөн жок.'); }
  }
  async function pickFiles() {
    try {
      if (Platform.OS === 'web') {
        const input = document.createElement('input'); input.type = 'file'; input.multiple = !editingMaterial;
        input.onchange = () => setFiles(previous => [...previous, ...Array.from(input.files ?? []).map(file => ({ uri: '', name: file.name, mimeType: file.type, file }))]);
        input.click(); return;
      }
      const picker = requireOptionalNativeModule<{ getDocumentAsync: (options: { multiple: boolean; copyToCacheDirectory: boolean; type: string[] }) => Promise<{ canceled: boolean; assets: Attachment[] }> }>('ExpoDocumentPicker');
      if (!picker) throw new Error('Document picker unavailable');
      const result = await picker.getDocumentAsync({ multiple: !editingMaterial, copyToCacheDirectory: true, type: ['*/*'] });
      if (!result.canceled) setFiles(previous => [...previous, ...result.assets]);
    } catch { setError('Файл тандоо мүмкүн болгон жок. Тиркемени кайра жаңыртыңыз.'); }
  }
  async function add() {
    if (busy || !month) return;
    setBusy(true); setError('');
    try {
      if (editingTopic !== null) {
        if (!title.trim()) throw new Error('Окуу предметинин аталышын киргизиңиз.');
        await api(`training/topics/${editingTopic}`, { method: 'PATCH', body: JSON.stringify({ title: title.trim() }) }, token);
        setForm(false); setEditingTopic(null); setRevision(value => value + 1);
      } else if (editingLessonTopic !== null) {
        if (!title.trim()) throw new Error('Теманын аталышын киргизиңиз.');
        await api(`training/subject-topics/${editingLessonTopic}`, { method: 'PATCH', body: JSON.stringify({ title: title.trim() }) }, token);
        setForm(false); setEditingLessonTopic(null); setRevision(value => value + 1);
      } else if (!topic || !lessonTopic) {
        if (!title.trim()) throw new Error(topic ? 'Теманын аталышын киргизиңиз.' : 'Окуу предметинин аталышын киргизиңиз.');
        if (!topic) {
          const created = await api<Topic>(`training/2026/sections/${section}/${category}/months/${month.id}/topics`, { method: 'POST', body: JSON.stringify({ title: title.trim() }) }, token);
          setForm(false); setTopic(created);
        } else {
          await api(`training/subjects/${topic.id}/topics`, { method: 'POST', body: JSON.stringify({ title: title.trim() }) }, token);
          setForm(false); setRevision(value => value + 1);
        }
      } else {
        const urls = links.split(/\n/).map(value => value.trim()).filter(Boolean);
        if (!text.trim() && !urls.length && !files.length && !editingMaterial?.has_file) throw new Error('Текст, шилтеме же файл кошуңуз.');
        if (urls.some(value => !/^https?:\/\/\S+$/i.test(value))) throw new Error('Шилтемелерди https:// же http:// менен киргизиңиз.');
        const body = new FormData(); body.append('text', text.trim()); body.append('links', JSON.stringify(urls));
        for (const file of files) {
          if (Platform.OS === 'web' && file.file) body.append('files', file.file, file.name);
          else body.append('files', { uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' } as unknown as Blob);
        }
        if (editingMaterial) await api(`training/materials/${editingMaterial.id}`, { method: 'PATCH', body }, token);
        else await api(`training/subject-topics/${lessonTopic.id}/materials`, { method: 'POST', body }, token);
        setForm(false); setEditingMaterial(null); setRevision(value => value + 1);
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Ката кетти.'); } finally { setBusy(false); }
  }
  async function openFile(id: number) {
    try { const result = await api<{ url: string }>(`training/materials/${id}/file-link`, {}, token); await Linking.openURL(result.url); }
    catch (e) { setError(e instanceof Error ? e.message : 'Файл ачылган жок.'); }
  }
  function card(label: string, action: () => void, key?: string | number) { return <Pressable key={key ?? label} accessibilityRole="button" onPress={action} style={s.card}><Text style={s.cardText}>{label}</Text><Text style={s.cardText}>→</Text></Pressable>; }
  return <View style={s.root}>
    <Pressable accessibilityRole="button" disabled={busy} onPress={back} style={s.back}><Text style={s.link}>← Артка</Text></Pressable>
    <Text style={s.breadcrumb}>{sectionTitle} · {categoryTitle}{period !== null ? ` · ${periods[period].title}` : ''}{month ? ` · ${month.title}` : ''}</Text>
    <Text accessibilityRole="header" style={s.title}>{lessonTopic?.title ?? topic?.title ?? month?.title ?? (period !== null ? periods[period].title : plan ? planTitle : categoryTitle)}</Text>
    {!plan ? card(planTitle, () => setPlan(true)) : period === null ? periods.map((item, index) => card(item.title, () => setPeriod(index))) : !month ? periods[period].months.map(item => card(item.title, () => setMonth(item))) : <>
      {topic && !lessonTopic && !form && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Text style={[s.label, { flex: 1 }]}>Темалар</Text>{isAdmin && <Pressable accessibilityRole="button" onPress={() => onTests(month, topic)} style={s.button}><Text style={s.buttonText}>Тест кошуу</Text></Pressable>}</View>}
      {loading && <ActivityIndicator color="#193f31" />}
      {!form && !loading && (lessonTopic ? materials.map(item => <View key={item.id} style={s.material}>
        {isAdmin && <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}><AdminActions onEdit={() => editMaterial(item)} onDelete={() => void removeMaterial(item)} /></View>}
        {!!item.text && <Text selectable style={s.body}>{item.text}</Text>}
        {item.links.map((url, index) => <Pressable key={`${url}/${index}`} accessibilityRole="link" onPress={() => { void Linking.openURL(url).catch(() => setError('Шилтеме ачылган жок.')); }}><Text selectable style={s.link}>{url}</Text></Pressable>)}
        {item.has_file && <Pressable accessibilityRole="button" onPress={() => { void openFile(item.id); }}><Text style={s.link}>📎 {item.file_name}</Text></Pressable>}
      </View>) : topic ? subjectTopics.map((item, index) => <View key={item.id} style={s.itemRow}><Pressable accessibilityRole="button" onPress={() => setLessonTopic(item)} style={[s.card, { flex: 1 }]}><Text style={s.cardText}>{index + 1}. {item.title}</Text><Text style={s.cardText}>→</Text></Pressable>{isAdmin && <AdminActions onEdit={() => editLessonTopic(item)} onDelete={() => void removeLessonTopic(item)} />}</View>) : topics.map((item, index) => <View key={item.id} style={s.itemRow}><Pressable accessibilityRole="button" onPress={() => setTopic(item)} style={[s.card, { flex: 1 }]}><Text style={s.cardText}>{index + 1}. {item.title}</Text><Text style={s.cardText}>→</Text></Pressable>{isAdmin && <AdminActions onEdit={() => editTopic(item)} onDelete={() => void removeTopic(item)} />}</View>))}
      {!form && !loading && !error && (lessonTopic ? materials.length === 0 : topic ? subjectTopics.length === 0 : topics.length === 0) && <Text style={s.body}>{lessonTopic ? 'Материалдар азырынча жок.' : topic ? 'Темалар азырынча жок.' : 'Окуу предметтери азырынча жок.'}</Text>}
      {!isAdmin && lessonTopic && !form && !loading && <Pressable accessibilityRole="button" onPress={() => onTests(month, topic!)} style={s.button}><Text style={s.buttonText}>Тест тапшыруу</Text></Pressable>}
      {isAdmin && !form && !loading && <Pressable accessibilityRole="button" onPress={openForm} style={s.button}><Text style={s.buttonText}>{lessonTopic ? 'Материал кошуу' : topic ? 'Тема кошуу' : 'Окуу предметин кошуу'}</Text></Pressable>}
      {isAdmin && form && <View style={s.material}>{editingMaterial || lessonTopic ? <>
        <Text style={s.label}>Тексттик мазмун</Text><TextInput editable={!busy} multiline value={text} onChangeText={setText} placeholder="Материалдын мазмунун киргизиңиз" style={[s.input, s.multiline]} />
        <Text style={s.label}>Шилтемелер (ар бирин жаңы сапка)</Text><TextInput editable={!busy} multiline autoCapitalize="none" value={links} onChangeText={setLinks} placeholder="https://..." style={[s.input, s.multiline]} />
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => { void pickFiles(); }} style={s.back}><Text style={s.link}>Файлдарды тандоо</Text></Pressable>
        {editingMaterial?.file_name ? <Text style={s.body}>Учурдагы файл: {editingMaterial.file_name}</Text> : null}
        {files.map((file, index) => <Pressable key={`${file.uri}/${index}`} disabled={busy} onPress={() => setFiles(previous => previous.filter((_, i) => i !== index))}><Text style={s.body}>{file.name} ×</Text></Pressable>)}
      </> : editingLessonTopic !== null || topic ? <><Text style={s.label}>Теманын аталышы</Text><TextInput editable={!busy} maxLength={250} value={title} onChangeText={setTitle} placeholder="Теманын аталышын киргизиңиз" style={s.input} /></> : <><Text style={s.label}>Окуу предметинин аталышы</Text><TextInput editable={!busy} maxLength={250} value={title} onChangeText={setTitle} placeholder="Окуу предметинин аталышын киргизиңиз" style={s.input} />
      </>}
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => { void add(); }} style={[s.button, busy && { opacity: 0.5 }]}>{busy ? <ActivityIndicator color="white" /> : <Text style={s.buttonText}>{editingTopic !== null || editingLessonTopic !== null || editingMaterial ? 'Өзгөртүүлөрдү сактоо' : 'Кошуу'}</Text>}</Pressable>
      </View>}
    </>}
    {!!error && <View><Text accessibilityRole="alert" style={s.error}>{error}</Text>{!form && month && <Pressable onPress={() => setRevision(value => value + 1)} style={s.back}><Text style={s.link}>Кайра аракет кылуу</Text></Pressable>}</View>}
  </View>;
}
const s = StyleSheet.create({ root: { gap: 14 }, back: { minHeight: 44, justifyContent: 'center' }, breadcrumb: { color: '#647560', lineHeight: 20, fontSize: 12 }, title: { fontSize: 25, fontWeight: '700', color: '#193f31', lineHeight: 34 }, card: { flexDirection: 'row', gap: 16, padding: 20, backgroundColor: 'white', borderRadius: 16, borderWidth: 1, borderColor: '#d8e1d3' }, itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, cardText: { flexShrink: 1, color: '#193f31', fontSize: 17, fontWeight: '600' }, material: { gap: 16, padding: 20, backgroundColor: 'white', borderRadius: 16 }, body: { color: '#334b3c', fontSize: 16, lineHeight: 25 }, link: { color: '#193f31', fontWeight: '600', lineHeight: 24 }, label: { color: '#334b3c', fontWeight: '600' }, input: { borderWidth: 1, borderColor: '#d8e1d3', borderRadius: 10, padding: 14, fontSize: 16, color: '#193f31' }, multiline: { minHeight: 130, textAlignVertical: 'top' }, button: { backgroundColor: '#193f31', borderRadius: 12, padding: 17, alignItems: 'center' }, buttonText: { color: 'white', fontWeight: '700' }, error: { color: '#a04435', lineHeight: 22 } });
