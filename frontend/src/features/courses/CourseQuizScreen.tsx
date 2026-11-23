import { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { api } from '../../shared/api';
import { AdminActions, confirmDelete } from '../../shared/components/AdminActions';
import { QuizDraft, QuizEditor } from '../quizzes/QuizEditor';
import { QuizNotice } from '../quizzes/QuizNotice';
import { QuizRunner } from '../quizzes/QuizRunner';
import { Quiz, failureReasons } from '../quizzes/types';
import { s } from '../quizzes/styles';

export type CourseRef = { id: number; title: string };
export function formatDeadline(iso?: string | null) {
  if (!iso) return '';
  const date = new Date(iso); const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
const expired = (quiz: Quiz) => !!quiz.deadline && new Date(quiz.deadline).getTime() <= Date.now();

export function CourseQuizScreen({ token, course, canManage, startCreating = false, onBack }: { token: string; course: CourseRef; canManage: boolean; startCreating?: boolean; onBack: () => void }) {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [editing, setEditing] = useState(startCreating && canManage);
  const [editingQuiz, setEditingQuiz] = useState<QuizDraft | undefined>();
  const [module, setModule] = useState<1 | 2>(1);
  const shown = quizzes.filter(quiz => (quiz.module ?? 1) === module);
  const [pendingQuiz, setPendingQuiz] = useState<Quiz | null>(null);
  const [running, setRunning] = useState<number | null>(null);
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [revision, setRevision] = useState(0);
  const route = `courses/sections/${course.id}/quizzes`;
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    api<Quiz[]>(route, {}, token).then(data => { if (active) setQuizzes(data); }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [route, token, revision]);
  useEffect(() => {
    if (running !== null || editing) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { if (pendingQuiz) setPendingQuiz(null); else if (!busy) onBack(); return true; });
    return () => subscription.remove();
  }, [running, editing, busy, onBack, pendingQuiz]);
  async function edit(quiz: Quiz) {
    if (busy) return; setBusy(true); setError('');
    try { setEditingQuiz(await api<QuizDraft>(`courses/quizzes/${quiz.id}`, {}, token)); setEditing(true); }
    catch (e) { setError(e instanceof Error ? e.message : 'Тест жүктөлгөн жок.'); } finally { setBusy(false); }
  }
  async function remove(quiz: Quiz) {
    if (!await confirmDelete(`«${quiz.title}» тестин өчүрөсүзбү? Эгер тесттен өтүү тарыхы болсо, өчүрүү мүмкүн эмес.`)) return;
    if (busy) return; setBusy(true); setError('');
    try { await api(`courses/quizzes/${quiz.id}`, { method: 'DELETE' }, token); setRevision(value => value + 1); }
    catch (e) { setError(e instanceof Error ? e.message : 'Тест өчүрүлгөн жок.'); } finally { setBusy(false); }
  }
  async function closeInterrupted(id: number) {
    if (busy) return; setBusy(true); setError('');
    try { await api(`training/attempts/${id}`, { method: 'POST', body: JSON.stringify({ action: 'violation', reason: 'app_exit' }) }, token); setRevision(value => value + 1); }
    catch (e) { setError(e instanceof Error ? e.message : 'Ката кетти.'); } finally { setBusy(false); }
  }
  function closeEditor(saved: boolean) {
    setEditing(false); setEditingQuiz(undefined);
    if (saved) setRevision(value => value + 1);
    if (startCreating && !editingQuiz) onBack();
  }
  if (pendingQuiz) return <QuizNotice quiz={pendingQuiz} onBack={() => setPendingQuiz(null)} onStart={() => { setRunning(pendingQuiz.id); setPendingQuiz(null); }} />;
  if (editing) return <QuizEditor key={editingQuiz?.id ?? 'new'} token={token} route={route} topicTitle={course.title} initialQuiz={editingQuiz} withDeadline withModule initialModule={module} itemRoute={id => `courses/quizzes/${id}`} onBack={() => closeEditor(false)} onSaved={() => closeEditor(true)} />;
  if (running !== null) return <QuizRunner quizId={running} token={token} onBack={() => { setRunning(null); setRevision(value => value + 1); }} />;
  return <ScrollView style={s.root} contentContainerStyle={s.content}>
    <Pressable accessibilityRole="button" disabled={busy} onPress={onBack} style={s.secondary}><Text style={s.link}>← Курска кайтуу</Text></Pressable>
    <Text style={s.hint}>Окуу курстары · {course.title}</Text>
    <Text accessibilityRole="header" style={s.title}>Тесттер</Text>
    <View accessibilityRole="tablist" style={s.modules}>{([1, 2] as const).map(value => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: module === value }} onPress={() => setModule(value)} style={[s.moduleTab, module === value && s.moduleTabActive]}><Text style={[s.moduleText, module === value && s.moduleTextActive]}>{value} модуль ({quizzes.filter(quiz => (quiz.module ?? 1) === value).length})</Text></Pressable>)}</View>
    {canManage ? <Pressable accessibilityRole="button" onPress={() => setEditing(true)} style={s.button}><Text style={s.white}>{module} модулга тест кошуу</Text></Pressable> : <View style={s.card}>
      <Text style={s.body}>Тест дедлайнга чейин гана кабыл алынат. Суроолор жана жооптор ар бир аракетте аралашат.</Text>
      <Text style={s.error}>Тиркемеден чыгуу, башка экранга өтүү же аныкталган скриншот — тест провал, 0%.</Text>
      {Platform.OS === 'web' && <Text style={s.error}>Корголгон тестти Android же iOS тиркемесинен өтүңүз.</Text>}
    </View>}
    {loading && <ActivityIndicator color="#193f31" />}
    {!loading && !shown.length && !error && <Text style={s.body}>{module} модулда тесттер азырынча жок.</Text>}
    {shown.map(quiz => <View key={quiz.id} style={s.card}>
      {canManage && <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}><AdminActions disabled={busy} onEdit={() => void edit(quiz)} onDelete={() => void remove(quiz)} /></View>}
      <Text style={s.heading}>{quiz.title}</Text>
      <Text style={s.body}>{quiz.question_count} суроо · {Math.ceil(quiz.duration_seconds / 60)} мүнөт</Text>
      <Text style={expired(quiz) ? s.error : s.hint}>Дедлайн: {formatDeadline(quiz.deadline)}{expired(quiz) ? ' · мөөнөтү бүттү' : ''}</Text>
      {quiz.latest_result && quiz.latest_result.status !== 'active' && <Text style={quiz.latest_result.status === 'failed' ? s.error : s.link}>Акыркы аракет: {quiz.latest_result.percentage}% · {failureReasons[quiz.latest_result.reason]}</Text>}
      {quiz.latest_result?.status === 'active' ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => { void closeInterrupted(quiz.latest_result!.id); }} style={s.secondary}><Text style={s.error}>Үзүлгөн аракетти аяктоо (0%)</Text></Pressable>
        : !canManage && !expired(quiz) && <Pressable accessibilityRole="button" disabled={Platform.OS === 'web' || busy} onPress={() => setPendingQuiz(quiz)} style={[s.button, Platform.OS === 'web' && s.disabled]}><Text style={s.white}>{quiz.latest_result ? 'Кайра тест өтүү' : 'Тест өтүү'}</Text></Pressable>}
    </View>)}
    {!!error && <View><Text accessibilityRole="alert" style={s.error}>{error}</Text><Pressable accessibilityRole="button" disabled={loading} onPress={() => setRevision(value => value + 1)} style={s.secondary}><Text style={s.link}>Кайра аракет кылуу</Text></Pressable></View>}
  </ScrollView>;
}
