import { useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useEffect } from 'react';
import { api } from '../../shared/api';
import { s } from './styles';

type Draft = { key: number; text: string; options: string[]; correct_index: number | null };
export type QuizDraft = { id: number; title: string; duration_seconds: number; deadline?: string | null; module?: 1 | 2 | null; questions: { text: string; options: string[]; correct_index: number }[] };
const pad = (value: number) => String(value).padStart(2, '0');
function deadlineParts(iso?: string | null) {
  const date = iso ? new Date(iso) : new Date(Date.now() + 7 * 24 * 3600 * 1000);
  return { day: `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`, time: iso ? `${pad(date.getHours())}:${pad(date.getMinutes())}` : '23:59' };
}
function parseDeadline(day: string, time: string): Date | null {
  const d = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(day.trim()); const t = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!d || !t) return null;
  const date = new Date(Number(d[3]), Number(d[2]) - 1, Number(d[1]), Number(t[1]), Number(t[2]));
  return date.getDate() === Number(d[1]) && date.getMonth() === Number(d[2]) - 1 && Number(t[1]) < 24 && Number(t[2]) < 60 ? date : null;
}
let nextKey = 0;
const newQuestion = (): Draft => ({ key: nextKey++, text: '', options: ['', ''], correct_index: null });
export function QuizEditor({ token, route, topicTitle, initialQuiz, onBack, onSaved, withDeadline = false, withModule = false, initialModule = 1, itemRoute = id => `training/quizzes/${id}` }: { token: string; route: string; topicTitle: string; initialQuiz?: QuizDraft; onBack: () => void; onSaved: () => void; withDeadline?: boolean; withModule?: boolean; initialModule?: 1 | 2; itemRoute?: (id: number) => string }) {
  const [module, setModule] = useState<1 | 2>(initialQuiz?.module ?? initialModule);
  const [deadlineDay, setDeadlineDay] = useState(() => deadlineParts(initialQuiz?.deadline).day);
  const [deadlineTime, setDeadlineTime] = useState(() => deadlineParts(initialQuiz?.deadline).time);
  const [title, setTitle] = useState(initialQuiz?.title ?? `${topicTitle} — тест`.slice(0, 250));
  const [minutes, setMinutes] = useState(String(initialQuiz ? initialQuiz.duration_seconds / 60 : 30));
  const [questions, setQuestions] = useState<Draft[]>(initialQuiz ? initialQuiz.questions.map(question => ({ key: nextKey++, text: question.text, options: question.options, correct_index: question.correct_index })) : [newQuestion()]);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => { const listener = BackHandler.addEventListener('hardwareBackPress', () => { if (!busy) onBack(); return true; }); return () => listener.remove(); }, [busy, onBack]);
  function update(key: number, change: Partial<Draft>) { setQuestions(previous => previous.map(q => q.key === key ? { ...q, ...change } : q)); }
  async function save() {
    if (busy) return;
    setError('');
    if (!title.trim() || !/^\d+$/.test(minutes) || Number(minutes) < 1 || Number(minutes) > 1440) { setError('Аталышты жана убакытты туура киргизиңиз (1–1440 мүнөт).'); return; }
    if (questions.some(q => !q.text.trim() || q.options.some(option => !option.trim()) || q.correct_index === null)) { setError('Ар бир суроону жана жоопторун толтуруп, бир туура жоопту тандаңыз.'); return; }
    const deadline = withDeadline ? parseDeadline(deadlineDay, deadlineTime) : null;
    if (withDeadline && !deadline) { setError('Мөөнөттү КК.АА.ЖЖЖЖ жана СС:ММ форматында киргизиңиз.'); return; }
    if (deadline && deadline.getTime() <= Date.now() && deadline.toISOString() !== (initialQuiz?.deadline && new Date(initialQuiz.deadline).toISOString())) { setError('Мөөнөт келечектеги күн болушу керек.'); return; }
    setBusy(true);
    try {
      const payload = JSON.stringify({ title: title.trim(), duration_seconds: Number(minutes) * 60, ...(deadline ? { deadline: deadline.toISOString() } : {}), ...(withModule ? { module } : {}), questions: questions.map(({ key, ...question }) => ({ ...question, text: question.text.trim(), options: question.options.map(value => value.trim()) })) });
      await api(initialQuiz ? itemRoute(initialQuiz.id) : route, { method: initialQuiz ? 'PATCH' : 'POST', body: payload }, token);
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'Тест сакталган жок.'); } finally { setBusy(false); }
  }
  return <ScrollView style={s.root} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
    <Pressable accessibilityRole="button" disabled={busy} onPress={onBack} style={s.secondary}><Text style={s.link}>← Артка</Text></Pressable>
    <Text accessibilityRole="header" style={s.title}>{initialQuiz ? 'Тестти өзгөртүү' : 'Тест кошуу'}</Text>
    <Text style={s.body}>Тесттин аталышы</Text><TextInput accessibilityLabel="Тесттин аталышы" editable={!busy} maxLength={250} value={title} onChangeText={setTitle} style={s.input} />
    <Text style={s.body}>Убакыт (мүнөт)</Text><TextInput accessibilityLabel="Убакыт (мүнөт)" editable={!busy} keyboardType="number-pad" value={minutes} onChangeText={setMinutes} style={s.input} />
    {withModule && <>
      <Text style={s.body}>Модуль</Text>
      <View style={s.modules}>{([1, 2] as const).map(value => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: module === value }} disabled={busy} onPress={() => setModule(value)} style={[s.moduleTab, module === value && s.moduleTabActive]}><Text style={[s.moduleText, module === value && s.moduleTextActive]}>{value} модуль</Text></Pressable>)}</View>
    </>}
    {withDeadline && <>
      <Text style={s.body}>Дедлайн — тест ушул убакытка чейин кабыл алынат</Text>
      <View style={s.row}>
        <TextInput accessibilityLabel="Дедлайн күнү" editable={!busy} keyboardType="numbers-and-punctuation" maxLength={10} value={deadlineDay} onChangeText={setDeadlineDay} placeholder="КК.АА.ЖЖЖЖ" style={[s.input, { flex: 2 }]} />
        <TextInput accessibilityLabel="Дедлайн убактысы" editable={!busy} keyboardType="numbers-and-punctuation" maxLength={5} value={deadlineTime} onChangeText={setDeadlineTime} placeholder="СС:ММ" style={[s.input, { flex: 1 }]} />
      </View>
    </>}
    <Text style={s.hint}>Ар бир суроодо 2ден 10го чейин жооп жана бир туура жооп болот. Бардык суроолор бирдей бааланат.</Text>
    {questions.map((q, index) => <View key={q.key} style={s.card}>
      <View style={s.row}><Text style={[s.heading, { flex: 1 }]}>Суроо {index + 1}</Text>{questions.length > 1 && <Pressable accessibilityRole="button" disabled={busy} onPress={() => setQuestions(previous => previous.filter(item => item.key !== q.key))} style={s.secondary}><Text style={s.error}>Өчүрүү</Text></Pressable>}</View>
      <TextInput accessibilityLabel={`Суроо ${index + 1}`} editable={!busy} multiline value={q.text} onChangeText={text => update(q.key, { text })} style={[s.input, s.multiline]} placeholder="Суроону жазыңыз" />
      {q.options.map((option, optionIndex) => <View key={optionIndex} style={s.row}>
        <Pressable accessibilityRole="radio" accessibilityLabel={`${String.fromCharCode(65 + optionIndex)} туура жооп`} accessibilityState={{ checked: q.correct_index === optionIndex }} disabled={busy} onPress={() => update(q.key, { correct_index: optionIndex })} style={s.secondary}><Text style={s.link}>{q.correct_index === optionIndex ? '●' : '○'} {String.fromCharCode(65 + optionIndex)}</Text></Pressable>
        <TextInput accessibilityLabel={`Суроо ${index + 1}, жооп ${optionIndex + 1}`} editable={!busy} multiline value={option} onChangeText={value => update(q.key, { options: q.options.map((item, i) => i === optionIndex ? value : item) })} style={[s.input, { flex: 1 }]} placeholder="Жооп" />
        {q.options.length > 2 && <Pressable accessibilityRole="button" accessibilityLabel="Жоопту өчүрүү" disabled={busy} onPress={() => update(q.key, { options: q.options.filter((_, i) => i !== optionIndex), correct_index: q.correct_index === optionIndex ? null : q.correct_index !== null && q.correct_index > optionIndex ? q.correct_index - 1 : q.correct_index })} style={s.secondary}><Text style={s.error}>×</Text></Pressable>}
      </View>)}
      {q.options.length < 10 && <Pressable accessibilityRole="button" disabled={busy} onPress={() => update(q.key, { options: [...q.options, ''] })} style={s.secondary}><Text style={s.link}>+ Жооп кошуу ({q.options.length}/10)</Text></Pressable>}
    </View>)}
    {questions.length < 500 && <Pressable accessibilityRole="button" disabled={busy} onPress={() => setQuestions(previous => [...previous, newQuestion()])} style={s.secondary}><Text style={s.link}>+ Суроо кошуу</Text></Pressable>}
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    <Pressable accessibilityRole="button" disabled={busy} onPress={() => { void save(); }} style={[s.button, busy && s.disabled]}>{busy ? <ActivityIndicator color="white" /> : <Text style={s.white}>{initialQuiz ? 'Өзгөртүүлөрдү сактоо' : 'Тестти кошуу'}</Text>}</Pressable>
  </ScrollView>;
}
