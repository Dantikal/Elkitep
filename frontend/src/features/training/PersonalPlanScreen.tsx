import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { api } from '../../shared/api';

type Activity = { action: string; until: string };
type Day = { id: number; number: number; activities: Activity[] };
const route = 'training/physical/personal-plan/days';
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Ката кетти. Кайра аракет кылыңыз.';

export function PersonalPlanScreen({ token }: { token: string }) {
  const [days, setDays] = useState<Day[]>([]);
  const [selected, setSelected] = useState<Day | null>(null);
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);

  async function load() {
    setLoading(true); setLoadError('');
    try { setDays(await api<Day[]>(route, {}, token)); }
    catch (e) { setLoadError(errorMessage(e)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [token]);
  function enter(day: Day, edit = false) {
    setEditing(edit);
    setSelected(day); setRows(day.activities.map(row => ({ ...row }))); setError('');
  }
  async function addDay() {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError('');
    try {
      const day = await api<Day>(route, { method: 'POST', body: '{}' }, token);
      setDays(previous => [...previous, day]); enter(day, true);
    } catch (e) { setError(errorMessage(e)); }
    finally { locked.current = false; setBusy(false); }
  }
  function update(index: number, key: keyof Activity, value: string) {
    setRows(previous => previous.map((row, i) => i === index ? { ...row, [key]: value } : row));
  }
  async function save() {
    if (!selected || locked.current) return;
    if (rows.some(row => !row.action.trim() || !row.until.trim())) {
      setError('Ар бир сапта «Эмне кылуу» жана «Канчага чейин» талааларын толтуруңуз.'); return;
    }
    locked.current = true; setBusy(true); setError('');
    try {
      const day = await api<Day>(`${route}/${selected.id}`, { method: 'PATCH', body: JSON.stringify({ activities: rows.map(row => ({ action: row.action.trim(), until: row.until.trim() })) }) }, token);
      setDays(previous => previous.map(item => item.id === day.id ? day : item));
      setSelected(null); setRows([]);
    } catch (e) { setError(errorMessage(e)); }
    finally { locked.current = false; setBusy(false); }
  }
  const button = (title: string, action: () => void, primary = false, disabled = false) => <Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{ disabled }} onPress={action} style={[s.button, primary && s.primary, disabled && s.disabled]}><Text style={[s.buttonText, primary && s.white]}>{title}</Text></Pressable>;

  if (loading) return <ActivityIndicator color="#193f31" />;
  if (loadError) return <View style={s.container}><Text accessibilityRole="alert" style={s.error}>{loadError}</Text>{button('Кайра аракет кылуу', () => void load())}</View>;
  return <View style={s.container}>
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    {selected ? <>
      {button('← Күндөрдүн тизмеси', () => { setSelected(null); setError(''); }, false, busy)}
      <Text accessibilityRole="header" style={s.heading}>Күн {selected.number}</Text>
      {editing ? <>
      {rows.length === 0 && <Text style={s.description}>Машыгуу кошуу үчүн «Кошуу» баскычын басыңыз.</Text>}
      {rows.map((row, index) => <View key={index} style={s.card}>
        <Text style={s.label}>{index + 1}. Машыгуу</Text>
        <View style={s.row}>
          <TextInput accessibilityLabel={`Эмне кылуу, ${index + 1}`} placeholder="Эмне кылуу" placeholderTextColor="#899287" value={row.action} onChangeText={value => update(index, 'action', value)} editable={!busy} multiline maxLength={500} style={s.input} />
          <TextInput accessibilityLabel={`Канчага чейин, ${index + 1}`} placeholder="Канчага чейин" placeholderTextColor="#899287" value={row.until} onChangeText={value => update(index, 'until', value)} editable={!busy} multiline maxLength={200} style={s.input} />
        </View>
        {button('Сапты алып салуу', () => setRows(previous => previous.filter((_, i) => i !== index)), false, busy)}
      </View>)}
      {button('Кошуу', () => setRows(previous => [...previous, { action: '', until: '' }]), false, busy || rows.length >= 200)}
      {button(busy ? 'Сакталууда…' : 'Сактоо', () => void save(), true, busy)}
      {button('Жокко чыгаруу', () => enter(selected), false, busy)}
      </> : <>
        {selected.activities.length === 0 && <Text style={s.description}>Машыгуулар азырынча жок.</Text>}
        {selected.activities.map((activity, index) => <View key={index} style={s.card}>
          <Text style={s.label}>{index + 1}. Машыгуу</Text>
          <View style={s.row}>
            <View style={s.value}><Text style={s.label}>Эмне кылуу</Text><Text style={s.description}>{activity.action}</Text></View>
            <View style={s.value}><Text style={s.label}>Канчага чейин</Text><Text style={s.description}>{activity.until}</Text></View>
          </View>
        </View>)}
        {button('Өзгөртүү', () => enter(selected, true), true)}
      </>}
    </> : <>
      {button(busy ? 'Кошулууда…' : 'Күн кошуу', () => void addDay(), true, busy)}
      {days.length === 0 && <Text style={s.description}>Азырынча күндөр жок. Биринчи күнүңүздү кошуңуз.</Text>}
      {days.map(day => <Pressable key={day.id} accessibilityRole="button" onPress={() => enter(day)} disabled={busy} style={s.card}>
        <View style={s.dayRow}><Text style={s.heading}>Күн {day.number}</Text><Text style={s.heading}>→</Text></View>
        <Text style={s.description}>Машыгуулар: {day.activities.length}</Text>
      </Pressable>)}
    </>}
  </View>;
}
const s = StyleSheet.create({
  container: { gap: 14 }, card: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#d8e1d3', padding: 16, gap: 12 },
  heading: { color: '#193f31', fontWeight: '700', fontSize: 20 }, label: { color: '#193f31', fontWeight: '600', fontSize: 14 }, description: { color: '#5f705b', fontSize: 14, lineHeight: 22 },
  value: { flex: 1, minWidth: 0, gap: 6 },
  row: { flexDirection: 'row', gap: 10 }, dayRow: { flexDirection: 'row', justifyContent: 'space-between' },
  input: { flex: 1, minWidth: 0, minHeight: 56, borderWidth: 1, borderColor: '#cbd7c5', borderRadius: 10, padding: 12, color: '#193f31', fontSize: 15, textAlignVertical: 'top' },
  button: { minHeight: 46, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#b6c5ae', justifyContent: 'center', alignItems: 'center', backgroundColor: '#edf3e9' },
  primary: { backgroundColor: '#193f31', borderColor: '#193f31' }, buttonText: { color: '#193f31', fontWeight: '600', fontSize: 14 }, white: { color: '#fff' }, disabled: { opacity: 0.5 }, error: { color: '#a02f28', lineHeight: 22 },
});
