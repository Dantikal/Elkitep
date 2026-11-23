import { useEffect, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, BackHandler, Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { api, API_URL } from '../../shared/api';
import { confirmDelete } from '../../shared/components/AdminActions';

type AchievementFile = { id: number; kind: 'image' | 'pdf'; name: string };
type Achievement = { id: number; text: string; files: AchievementFile[]; created_at: string };
type Attachment = { uri: string; name: string; mimeType?: string; kind: 'image' | 'pdf'; file?: Blob };

const MAX_FILES = 10;

export function AchievementsScreen({ token, onBack }: { token: string; onBack: () => void }) {
  const [items, setItems] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [text, setText] = useState('');
  const [files, setFiles] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true); setError('');
    try { setItems(await api<Achievement[]>('achievements', {}, token)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Ката кетти.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [token]);

  function back() {
    if (busy) return;
    if (formOpen) { setFormOpen(false); setText(''); setFiles([]); setError(''); }
    else onBack();
  }
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { back(); return true; });
    return () => listener.remove();
  });

  function addFiles(next: Attachment[]) {
    setFiles(previous => {
      const merged = [...previous, ...next];
      if (merged.length > MAX_FILES) setError(`Бир жолу ${MAX_FILES} файлга чейин жүктөөгө болот.`);
      return merged.slice(0, MAX_FILES);
    });
  }

  function pickWeb(accept: string, kind: Attachment['kind']) {
    const input = document.createElement('input'); input.type = 'file'; input.multiple = true; input.accept = accept;
    input.onchange = () => addFiles(Array.from(input.files ?? []).map(file => ({ uri: '', name: file.name, mimeType: file.type, kind, file })));
    input.click();
  }

  async function pickPhotos() {
    setError('');
    if (Platform.OS === 'web') return pickWeb('image/*', 'image');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: MAX_FILES, quality: 0.8 });
      if (!result.canceled) addFiles(result.assets.map((asset, index) => ({ uri: asset.uri, name: asset.fileName || `photo-${Date.now()}-${index}.jpg`, mimeType: asset.mimeType || 'image/jpeg', kind: 'image' })));
    } catch { setError('Сүрөт тандоо мүмкүн болгон жок.'); }
  }

  async function pickPdf() {
    setError('');
    if (Platform.OS === 'web') return pickWeb('application/pdf', 'pdf');
    try {
      const picker = requireOptionalNativeModule<{ getDocumentAsync: (options: { multiple: boolean; copyToCacheDirectory: boolean; type: string[] }) => Promise<{ canceled: boolean; assets: { uri: string; name: string; mimeType?: string }[] }> }>('ExpoDocumentPicker');
      if (!picker) throw new Error('Document picker unavailable');
      const result = await picker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true, type: ['application/pdf'] });
      if (!result.canceled) addFiles(result.assets.map(asset => ({ ...asset, mimeType: asset.mimeType || 'application/pdf', kind: 'pdf' })));
    } catch { setError('Файл тандоо мүмкүн болгон жок. Тиркемени кайра жаңыртыңыз.'); }
  }

  async function save() {
    if (busy) return;
    if (!text.trim() && !files.length) { setError('Текст, сүрөт же PDF кошуңуз.'); return; }
    setBusy(true); setError('');
    try {
      const body = new FormData();
      body.append('text', text.trim());
      for (const file of files) {
        if (Platform.OS === 'web' && file.file) body.append('files', file.file, file.name);
        else body.append('files', { uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' } as unknown as Blob);
      }
      const created = await api<Achievement>('achievements', { method: 'POST', body }, token);
      setItems(previous => [created, ...previous]);
      setFormOpen(false); setText(''); setFiles([]);
    } catch (e) { setError(e instanceof Error ? e.message : 'Ката кетти.'); }
    finally { setBusy(false); }
  }

  async function remove(item: Achievement) {
    if (!(await confirmDelete('Жетишкендикти өчүрөсүзбү?'))) return;
    try { await api(`achievements/${item.id}`, { method: 'DELETE' }, token); setItems(previous => previous.filter(value => value.id !== item.id)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Ката кетти.'); }
  }

  async function openFile(file: AchievementFile) {
    try { const result = await api<{ url: string }>(`achievements/files/${file.id}/link`, {}, token); await Linking.openURL(result.url); }
    catch (e) { setError(e instanceof Error ? e.message : 'Файл ачылган жок.'); }
  }

  return <ScrollView style={s.root} contentContainerStyle={s.content}>
    <Pressable accessibilityRole="button" disabled={busy} onPress={back} style={s.back}><Text style={s.link}>← {formOpen ? 'Артка' : 'Башкы бет'}</Text></Pressable>
    <Text accessibilityRole="header" style={s.title}>Менин жетишкендиктерим</Text>
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    {formOpen ? <View style={s.card}>
      <Text style={s.label}>Жетишкендиктин сүрөттөмөсү</Text>
      <TextInput accessibilityLabel="Жетишкендиктин сүрөттөмөсү" editable={!busy} multiline maxLength={5000} value={text} onChangeText={setText} placeholder="Мисалы: Аткычтык боюнча мелдеште 1-орун" style={[s.input, s.multiline]} />
      <View style={s.row}>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => { void pickPhotos(); }} style={[s.outline, { flex: 1 }]}><MaterialCommunityIcons name="image-plus" size={20} color="#193f31" /><Text style={s.link}>Сүрөт</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => { void pickPdf(); }} style={[s.outline, { flex: 1 }]}><MaterialCommunityIcons name="file-pdf-box" size={20} color="#193f31" /><Text style={s.link}>PDF</Text></Pressable>
      </View>
      {files.map((file, index) => <View key={`${file.name}/${index}`} style={s.fileRow}>
        {file.kind === 'image' && file.uri ? <Image source={{ uri: file.uri }} style={s.thumbSmall} /> : <MaterialCommunityIcons name={file.kind === 'pdf' ? 'file-pdf-box' : 'image-outline'} size={28} color="#b3473e" />}
        <Text numberOfLines={1} style={[s.body, { flex: 1 }]}>{file.name}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`${file.name} өчүрүү`} hitSlop={10} disabled={busy} onPress={() => setFiles(previous => previous.filter((_, i) => i !== index))}><MaterialCommunityIcons name="close" size={22} color="#a04435" /></Pressable>
      </View>)}
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => { void save(); }} style={s.button}>{busy ? <ActivityIndicator color="white" /> : <Text style={s.buttonText}>Сактоо</Text>}</Pressable>
    </View> : <>
      <Pressable accessibilityRole="button" onPress={() => { setError(''); setFormOpen(true); }} style={s.button}><Text style={s.buttonText}>+ Жетишкендик кошуу</Text></Pressable>
      {loading && <ActivityIndicator color="#193f31" />}
      {!loading && !items.length && !error && <Text style={s.body}>Жетишкендиктер азырынча жок. Дипломдорду, сертификаттарды, грамоталарды жүктөңүз.</Text>}
      {items.map(item => <View key={item.id} style={s.card}>
        <View style={s.cardHeader}>
          <Text style={s.date}>{new Date(item.created_at).toLocaleDateString('ru-RU')}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Жетишкендикти өчүрүү" hitSlop={10} onPress={() => { void remove(item); }}><MaterialCommunityIcons name="trash-can-outline" size={22} color="#a04435" /></Pressable>
        </View>
        {!!item.text && <Text selectable style={s.body}>{item.text}</Text>}
        {item.files.some(file => file.kind === 'image') && <View style={s.gallery}>
          {item.files.filter(file => file.kind === 'image').map(file => <Pressable key={file.id} accessibilityRole="imagebutton" accessibilityLabel={file.name} onPress={() => { void openFile(file); }}>
            <Image source={{ uri: `${API_URL}/achievements/files/${file.id}/`, headers: { Authorization: `Token ${token}` } }} style={s.thumb} />
          </Pressable>)}
        </View>}
        {item.files.filter(file => file.kind === 'pdf').map(file => <Pressable key={file.id} accessibilityRole="button" onPress={() => { void openFile(file); }} style={s.fileRow}>
          <MaterialCommunityIcons name="file-pdf-box" size={28} color="#b3473e" /><Text numberOfLines={1} style={[s.link, { flex: 1 }]}>{file.name}</Text>
        </Pressable>)}
      </View>)}
    </>}
  </ScrollView>;
}

const s = StyleSheet.create({
  root: { flex: 1 }, content: { gap: 14, paddingBottom: 32 }, back: { minHeight: 44, justifyContent: 'center' },
  title: { fontSize: 25, fontWeight: '700', color: '#193f31', lineHeight: 34 },
  card: { gap: 14, padding: 20, backgroundColor: 'white', borderRadius: 16, borderWidth: 1, borderColor: '#d8e1d3' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, date: { color: '#647560', fontSize: 12 },
  body: { color: '#334b3c', fontSize: 16, lineHeight: 25 }, link: { color: '#193f31', fontWeight: '600', lineHeight: 24 },
  label: { color: '#334b3c', fontWeight: '600' }, input: { borderWidth: 1, borderColor: '#d8e1d3', borderRadius: 10, padding: 14, fontSize: 16, color: '#193f31' },
  multiline: { minHeight: 130, textAlignVertical: 'top' }, row: { flexDirection: 'row', gap: 10 },
  button: { backgroundColor: '#193f31', borderRadius: 12, padding: 17, alignItems: 'center' }, buttonText: { color: 'white', fontWeight: '700' },
  outline: { flexDirection: 'row', gap: 6, justifyContent: 'center', borderWidth: 1, borderColor: '#193f31', borderRadius: 12, padding: 13, alignItems: 'center' },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumb: { width: 96, height: 96, borderRadius: 10, backgroundColor: '#e3ebdc' }, thumbSmall: { width: 36, height: 36, borderRadius: 6 },
  error: { color: '#a04435', lineHeight: 22 },
});
