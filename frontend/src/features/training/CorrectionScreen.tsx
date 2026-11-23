import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { api } from '../../shared/api';

type Correction = { id: number; age: number; altitude: number; sportswear: boolean; clothing_number: number | null; equipment: boolean; exercise_number: number; created_at: string };
const route = 'training/physical/corrections';
const message = (error: unknown) => error instanceof Error ? error.message : 'Ката кетти. Кайра аракет кылыңыз.';
export function CorrectionScreen({ token }: { token: string }) {
  const [items, setItems] = useState<Correction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [age, setAge] = useState('');
  const [altitude, setAltitude] = useState('');
  const [clothing, setClothing] = useState('');
  const [sportswear, setSportswear] = useState(false);
  const [equipment, setEquipment] = useState<boolean | null>(null);
  const [exercise, setExercise] = useState('');
  async function load() {
    setLoading(true); setLoadError('');
    try { setItems(await api<Correction[]>(route, {}, token)); }
    catch (e) { setLoadError(message(e)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [token]);
  async function save() {
    if (savingRef.current) return;
    const valid = (value: string, min: number, max: number) => /^\d+$/.test(value.trim()) && Number(value) >= min && Number(value) <= max;
    if (!valid(age, 1, 120) || !valid(altitude, 0, 9000) || (!sportswear && !valid(clothing, 1, 32767)) || !valid(exercise, 1, 32767) || equipment === null) {
      setError('Бардык талааларды толтуруңуз. Жаш: 1–120, бийиктик: 0–9000 м, номерлер: 1–32767.'); return;
    }
    savingRef.current = true; setSaving(true); setError('');
    try {
      const item = await api<Correction>(route, { method: 'POST', body: JSON.stringify({ age: Number(age), altitude: Number(altitude), sportswear, clothing_number: sportswear ? null : Number(clothing), equipment, exercise_number: Number(exercise) }) }, token);
      setItems(previous => [item, ...previous]); setOpen(false);
      setAge(''); setAltitude(''); setClothing(''); setSportswear(false); setEquipment(null); setExercise('');
    } catch (e) { setError(message(e)); }
    finally { savingRef.current = false; setSaving(false); }
  }
  const button = (title: string, action: () => void, selected = false, disabled = false) => <Pressable accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled} onPress={action} style={[s.button, selected && s.selected, disabled && { opacity: 0.5 }]}><Text style={[s.buttonText, selected && { color: '#fff' }]}>{title}</Text></Pressable>;
  const field = (label: string, value: string, change: (text: string) => void, placeholder: string, number = false) => <View style={s.field}><Text style={s.label}>{label}</Text><View style={s.inputRow}>{number && <Text style={s.label}>№</Text>}<TextInput accessibilityLabel={label} editable={!saving} keyboardType="number-pad" value={value} onChangeText={change} placeholder={placeholder} placeholderTextColor="#7b887d" style={s.input} maxLength={5} /></View></View>;
  return <View style={s.container}>
    {button(open ? 'Жабуу' : 'Түзөтүүнү кошуу', () => { setError(''); setOpen(!open); }, !open, saving)}
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    {open && <View style={s.card}>
      {field('Жаш курагы', age, setAge, 'Мисалы: 25')}
      {field('Деңиз деңгээлинен бийиктиги (м)', altitude, setAltitude, 'Мисалы: 400')}
      <Text style={s.label}>Кийим түрү</Text>
      <View style={s.row}>{button('Номер №', () => setSportswear(false), !sportswear, saving)}{button('Спорт кийими', () => setSportswear(true), sportswear, saving)}</View>
      {sportswear ? <Text style={s.detail}>Спорт кийими</Text> : field('Кийимдин номери', clothing, setClothing, 'Мисалы: 3', true)}
      <Text style={s.label}>Курал жана экипировка</Text>
      <View style={s.row}>{button('Бар', () => setEquipment(true), equipment === true, saving)}{button('Жок', () => setEquipment(false), equipment === false, saving)}</View>
      {field('Көнүгүү', exercise, setExercise, 'Мисалы: 4', true)}
      {button(saving ? 'Сакталууда…' : 'Түзөтүүнү чыгаруу', () => void save(), true, saving)}
    </View>}
    <Text style={s.heading}>Сакталган түзөтүүлөр</Text>
    {loading ? <ActivityIndicator color="#193f31" /> : loadError ? <View><Text style={s.error}>{loadError}</Text>{button('Кайра аракет кылуу', () => void load())}</View> : <>
      {items.length === 0 ? <Text style={s.detail}>Азырынча түзөтүүлөр жок. Жаңы түзөтүү кошуңуз.</Text> : <>
        {items.map(item => <View key={item.id} style={s.card}>
          <Text style={s.label}>Көнүгүү №{item.exercise_number}</Text>
          <Text style={s.detail}>Жаш курагы: {item.age}</Text>
          <Text style={s.detail}>Деңиз деңгээлинен бийиктиги: {item.altitude} м</Text>
          <Text style={s.detail}>Кийим түрү: {item.sportswear ? 'Спорт кийими' : `№${item.clothing_number}`}</Text>
          <Text style={s.detail}>Курал жана экипировка: {item.equipment ? 'Бар' : 'Жок'}</Text>
        </View>)}
      </>}
    </>}
  </View>;
}
const s = StyleSheet.create({ container: { gap: 14 }, card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d8e1d3', borderRadius: 18, padding: 18, gap: 12 }, heading: { color: '#193f31', fontSize: 19, fontWeight: '700', marginTop: 10 }, label: { color: '#193f31', fontWeight: '600', fontSize: 15 }, detail: { color: '#5f705b', fontSize: 14, lineHeight: 22 }, field: { gap: 8 }, inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#cbd7c5', borderRadius: 10, paddingHorizontal: 12 }, input: { flex: 1, minHeight: 48, color: '#193f31', fontSize: 16 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, button: { minHeight: 46, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#b6c5ae', justifyContent: 'center', alignItems: 'center', backgroundColor: '#edf3e9' }, selected: { backgroundColor: '#193f31', borderColor: '#193f31' }, buttonText: { color: '#193f31', fontWeight: '600', fontSize: 14 }, error: { color: '#a02f28', lineHeight: 22 } });
