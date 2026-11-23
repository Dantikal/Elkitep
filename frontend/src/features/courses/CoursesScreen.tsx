import { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Linking, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { api } from '../../shared/api';
import { AdminActions, confirmDelete } from '../../shared/components/AdminActions';
export type Section = { id: number; title: string; parent: number | null; can_manage: boolean; is_enrolled: boolean };
type Material = { id: number; text: string; links: string[]; has_file: boolean; file_name: string };
type Attachment = { uri: string; name: string; mimeType?: string; file?: Blob };
type Props = { token: string; isAdmin: boolean; isCourseHead?: boolean; isVisible?: boolean; initialPath?: Section[]; onBack: () => void; onTests?: (course: Section) => void; onMyCourses?: () => void };
export function CoursesScreen({ token, isAdmin, isCourseHead = false, isVisible = true, initialPath = [], onBack, onTests, onMyCourses }: Props) {
  const [path, setPath] = useState<Section[]>(initialPath);
  const current = path[path.length - 1];
  const canAddMaterials = path.length >= 2;
  const canEdit = current ? current.can_manage : isAdmin || isCourseHead;
  const course = path[0];
  const [enrolling, setEnrolling] = useState(false);
  const [sections, setSections] = useState<Section[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [form, setForm] = useState<'section' | 'material' | null>(null);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [title, setTitle] = useState(''); const [text, setText] = useState(''); const [links, setLinks] = useState('');
  const [files, setFiles] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const sectionRoute = current ? `courses/sections/${current.id}/children` : 'courses/sections';
  function back() {
    if (busy) return;
    setError('');
    if (form) { setForm(null); setEditingSection(null); setEditingMaterial(null); }
    else if (path.length > initialPath.length) setPath(previous => previous.slice(0, -1));
    else onBack();
  }
  useEffect(() => { if (!isVisible) return; const sub = BackHandler.addEventListener('hardwareBackPress', () => { back(); return true; }); return () => sub.remove(); });
  useEffect(() => {
    let active = true; setLoading(true); setError(''); setSections([]); setMaterials([]);
    Promise.all([api<Section[]>(sectionRoute, {}, token), canAddMaterials && current ? api<Material[]>(`courses/sections/${current.id}/materials`, {}, token) : Promise.resolve([] as Material[])])
      .then(([children, items]) => { if (active) { setSections(children); setMaterials(items); } })
      .catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [current?.id, revision, token]);
  function openForm(kind: 'section' | 'material') { setTitle(''); setText(''); setLinks(''); setFiles([]); setEditingSection(null); setEditingMaterial(null); setError(''); setForm(kind); }
  function editSection(item: Section) { setEditingSection(item); setEditingMaterial(null); setTitle(item.title); setError(''); setForm('section'); }
  function editMaterial(item: Material) { setEditingMaterial(item); setEditingSection(null); setText(item.text); setLinks(item.links.join('\n')); setFiles([]); setError(''); setForm('material'); }
  async function removeSection(item: Section) {
    if (!await confirmDelete(`«${item.title}» бөлүмүн жана анын ичиндеги мазмунду өчүрөсүзбү?`)) return;
    try { setError(''); await api(`courses/sections/item/${item.id}`, { method: 'DELETE' }, token); setRevision(value => value + 1); }
    catch (e) { setError(e instanceof Error ? e.message : 'Бөлүм өчүрүлгөн жок.'); }
  }
  async function removeMaterial(item: Material) {
    if (!await confirmDelete('Бул материалды өчүрөсүзбү?')) return;
    try { setError(''); await api(`courses/materials/${item.id}`, { method: 'DELETE' }, token); setRevision(value => value + 1); }
    catch (e) { setError(e instanceof Error ? e.message : 'Материал өчүрүлгөн жок.'); }
  }
  async function toggleEnrollment() {
    if (!course || enrolling) return;
    setEnrolling(true); setError('');
    try {
      await api(`courses/sections/${course.id}/enroll`, { method: course.is_enrolled ? 'DELETE' : 'POST' }, token);
      setPath(previous => previous.map((item, index) => index === 0 ? { ...item, is_enrolled: !item.is_enrolled } : item));
    } catch (e) { setError(e instanceof Error ? e.message : 'Ката кетти.'); } finally { setEnrolling(false); }
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
    if (busy) return;
    setBusy(true); setError('');
    try {
      if (form === 'section') {
        if (!title.trim()) throw new Error('Бөлүмдүн аталышын киргизиңиз.');
        if (editingSection) {
          await api(`courses/sections/item/${editingSection.id}`, { method: 'PATCH', body: JSON.stringify({ title: title.trim() }) }, token);
          setForm(null); setEditingSection(null); setRevision(value => value + 1);
        } else {
          const created = await api<Section>(sectionRoute, { method: 'POST', body: JSON.stringify({ title: title.trim() }) }, token);
          setForm(null); setPath(previous => [...previous, created]);
        }
      } else if (canAddMaterials && current) {
        const urls = links.split(/\n/).map(value => value.trim()).filter(Boolean);
        if (!text.trim() && !urls.length && !files.length && !editingMaterial?.has_file) throw new Error('Текст, шилтеме же файл кошуңуз.');
        if (urls.some(value => !/^https?:\/\/\S+$/i.test(value))) throw new Error('Шилтемелерди https:// же http:// менен киргизиңиз.');
        const body = new FormData(); body.append('text', text.trim()); body.append('links', JSON.stringify(urls));
        for (const file of files) {
          if (Platform.OS === 'web' && file.file) body.append('files', file.file, file.name);
          else body.append('files', { uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' } as unknown as Blob);
        }
        if (editingMaterial) await api(`courses/materials/${editingMaterial.id}`, { method: 'PATCH', body }, token);
        else await api(`courses/sections/${current.id}/materials`, { method: 'POST', body }, token);
        setForm(null); setEditingMaterial(null); setRevision(value => value + 1);
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Ката кетти.'); } finally { setBusy(false); }
  }
  async function openFile(id: number) {
    try { const result = await api<{ url: string }>(`courses/materials/${id}/file-link`, {}, token); await Linking.openURL(result.url); }
    catch (e) { setError(e instanceof Error ? e.message : 'Файл ачылган жок.'); }
  }
  return <View style={s.root}>
    <Pressable accessibilityRole="button" disabled={busy} onPress={back} style={s.back}><Text style={s.link}>← Артка</Text></Pressable>
    <Text style={s.breadcrumb}>{['Окуу курстары', ...path.map(item => item.title)].join(' · ')}</Text>
    <Text accessibilityRole="header" style={s.title}>{current?.title ?? 'Окуу курстары'}</Text>
    {loading && <ActivityIndicator color="#193f31" />}
    {!form && !loading && <>
      {!current && isCourseHead && onMyCourses && <Pressable accessibilityRole="button" onPress={onMyCourses} style={s.button}><Text style={s.buttonText}>Менин курстарым</Text></Pressable>}
      {path.length === 1 && !current.can_manage && <Pressable accessibilityRole="button" disabled={enrolling} onPress={() => { void toggleEnrollment(); }} style={current.is_enrolled ? s.outline : s.button}>{enrolling ? <ActivityIndicator color={current.is_enrolled ? '#193f31' : 'white'} /> : <Text style={current.is_enrolled ? s.link : s.buttonText}>{current.is_enrolled ? '✓ Курска жазылдыңыз · Жокко чыгаруу' : 'Курска жазылуу'}</Text>}</Pressable>}
      {path.length === 1 && (current.can_manage || current.is_enrolled) && onTests && <Pressable accessibilityRole="button" onPress={() => onTests(current)} style={s.outline}><Text style={s.link}>Тесттер →</Text></Pressable>}
      {sections.map(item => <View key={item.id} style={s.itemRow}><Pressable accessibilityRole="button" onPress={() => setPath(previous => [...previous, item])} style={[s.card, { flex: 1 }]}><Text style={s.cardText}>{item.title}</Text><Text style={s.cardText}>→</Text></Pressable>{item.can_manage && <AdminActions onEdit={() => editSection(item)} onDelete={() => void removeSection(item)} />}</View>)}
      {canAddMaterials && <Text style={s.label}>Материалдар</Text>}
      {materials.map(item => <View key={item.id} style={s.material}>
        {canEdit && <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}><AdminActions onEdit={() => editMaterial(item)} onDelete={() => void removeMaterial(item)} /></View>}
        {!!item.text && <Text selectable style={s.body}>{item.text}</Text>}
        {item.links.map((url, index) => <Pressable key={index} accessibilityRole="link" onPress={() => { void Linking.openURL(url).catch(() => setError('Шилтеме ачылган жок.')); }}><Text selectable style={s.link}>{url}</Text></Pressable>)}
        {item.has_file && <Pressable accessibilityRole="button" onPress={() => { void openFile(item.id); }}><Text style={s.link}>📎 {item.file_name}</Text></Pressable>}
      </View>)}
      {!error && !sections.length && !materials.length && <Text style={s.body}>{canAddMaterials ? 'Материалдар азырынча жок.' : 'Бөлүмдөр азырынча жок.'}</Text>}
      {canEdit && !canAddMaterials && <Pressable accessibilityRole="button" onPress={() => openForm('section')} style={s.button}><Text style={s.buttonText}>Кошуу</Text></Pressable>}
      {canEdit && canAddMaterials && <Pressable accessibilityRole="button" onPress={() => openForm('material')} style={s.button}><Text style={s.buttonText}>Материал кошуу</Text></Pressable>}
    </>}
    {canEdit && form && <View style={s.material}>{form === 'section' ? <>
      <Text style={s.label}>Бөлүмдүн аталышы</Text><TextInput accessibilityLabel="Бөлүмдүн аталышы" editable={!busy} maxLength={250} value={title} onChangeText={setTitle} placeholder="Бөлүмдүн аталышын киргизиңиз" style={s.input} />
    </> : <>
      <Text style={s.label}>Тексттик мазмун</Text><TextInput accessibilityLabel="Тексттик мазмун" editable={!busy} multiline value={text} onChangeText={setText} placeholder="Материалдын мазмунун киргизиңиз" style={[s.input, s.multiline]} />
      <Text style={s.label}>Шилтемелер (ар бирин жаңы сапка)</Text><TextInput accessibilityLabel="Шилтемелер" editable={!busy} multiline autoCapitalize="none" value={links} onChangeText={setLinks} placeholder="https://..." style={[s.input, s.multiline]} />
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => { void pickFiles(); }} style={s.back}><Text style={s.link}>Файл, сүрөт, видео тандоо</Text></Pressable>
      {editingMaterial?.file_name ? <Text style={s.body}>Учурдагы файл: {editingMaterial.file_name}</Text> : null}
      {files.map((file, index) => <Pressable accessibilityRole="button" accessibilityLabel={`${file.name} алып салуу`} key={index} disabled={busy} onPress={() => setFiles(previous => previous.filter((_, i) => i !== index))}><Text style={s.body}>{file.name} ×</Text></Pressable>)}
    </>}
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => { void add(); }} style={s.button}>{busy ? <ActivityIndicator color="white" /> : <Text style={s.buttonText}>Сактоо</Text>}</Pressable>
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => { setForm(null); setEditingSection(null); setEditingMaterial(null); }} style={s.back}><Text style={s.link}>Жокко чыгаруу</Text></Pressable>
    </View>}
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    {!form && !loading && <Pressable accessibilityRole="button" onPress={() => setRevision(value => value + 1)} style={s.back}><Text style={s.link}>Жаңылоо</Text></Pressable>}
  </View>;
}
const s = StyleSheet.create({ root: { gap: 14 }, back: { minHeight: 44, justifyContent: 'center' }, breadcrumb: { color: '#647560', lineHeight: 20, fontSize: 12 }, title: { fontSize: 25, fontWeight: '700', color: '#193f31', lineHeight: 34 }, itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, card: { flexDirection: 'row', gap: 16, padding: 20, backgroundColor: 'white', borderRadius: 16, borderWidth: 1, borderColor: '#d8e1d3' }, cardText: { flexShrink: 1, color: '#193f31', fontSize: 17, fontWeight: '600' }, material: { gap: 16, padding: 20, backgroundColor: 'white', borderRadius: 16 }, body: { color: '#334b3c', fontSize: 16, lineHeight: 25 }, link: { color: '#193f31', fontWeight: '600', lineHeight: 24 }, label: { color: '#334b3c', fontWeight: '600' }, input: { borderWidth: 1, borderColor: '#d8e1d3', borderRadius: 10, padding: 14, fontSize: 16, color: '#193f31' }, multiline: { minHeight: 130, textAlignVertical: 'top' }, button: { backgroundColor: '#193f31', borderRadius: 12, padding: 17, alignItems: 'center' }, outline: { borderWidth: 1, borderColor: '#193f31', borderRadius: 12, padding: 15, alignItems: 'center' }, buttonText: { color: 'white', fontWeight: '700' }, error: { color: '#a04435', lineHeight: 22 } });
