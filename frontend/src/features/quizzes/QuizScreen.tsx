import { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { api } from '../../shared/api';
import { QuizDraft, QuizEditor } from './QuizEditor';
import { QuizNotice } from './QuizNotice';
import { QuizRunner } from './QuizRunner';
import { Quiz, QuizScope, failureReasons } from './types';
import { s } from './styles';
import { AdminActions, confirmDelete } from '../../shared/components/AdminActions';

export function QuizScreen({ token, isAdmin, scope, onBack }: { token: string; isAdmin: boolean; scope: QuizScope; onBack: () => void }) {
  const [pendingQuiz, setPendingQuiz] = useState<Quiz | null>(null);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [editing, setEditing] = useState(false); const [running, setRunning] = useState<number | null>(null);
  const [editingQuiz, setEditingQuiz] = useState<QuizDraft | undefined>();
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [revision, setRevision] = useState(0);
  const route = `training/topics/${scope.topic.id}/quizzes`;
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
  async function closeInterrupted(id: number) {
    if (busy) return; setBusy(true); setError('');
    try { await api(`training/attempts/${id}`, { method: 'POST', body: JSON.stringify({ action: 'violation', reason: 'app_exit' }) }, token); setRevision(value => value + 1); }
    catch (e) { setError(e instanceof Error ? e.message : 'Ката кетти.'); } finally { setBusy(false); }
  }
  async function edit(quiz: Quiz) {
    if (busy) return; setBusy(true); setError('');
    try { setEditingQuiz(await api<QuizDraft>(`training/quizzes/${quiz.id}`, {}, token)); setEditing(true); }
    catch (e) { setError(e instanceof Error ? e.message : 'Тест жүктөлгөн жок.'); }
    finally { setBusy(false); }
  }
  async function remove(quiz: Quiz) {
    if (!await confirmDelete(`«${quiz.title}» тестин өчүрөсүзбү? Эгер тесттен өтүү тарыхы болсо, өчүрүү мүмкүн эмес.`)) return;
    if (busy) return; setBusy(true); setError('');
    try { await api(`training/quizzes/${quiz.id}`, { method: 'DELETE' }, token); setRevision(value => value + 1); }
    catch (e) { setError(e instanceof Error ? e.message : 'Тест өчүрүлгөн жок.'); }
    finally { setBusy(false); }
  }
  if (pendingQuiz) return <QuizNotice quiz={pendingQuiz} onBack={() => setPendingQuiz(null)} onStart={() => { setRunning(pendingQuiz.id); setPendingQuiz(null); }} />;
  if (editing) return <QuizEditor key={editingQuiz?.id ?? 'new'} token={token} route={route} topicTitle={scope.topic.title} initialQuiz={editingQuiz} onBack={() => { setEditing(false); setEditingQuiz(undefined); }} onSaved={() => { setEditing(false); setEditingQuiz(undefined); setRevision(value => value + 1); }} />;
  if (running !== null) return <QuizRunner quizId={running} token={token} onBack={() => { setRunning(null); setRevision(value => value + 1); }} />;
  return <ScrollView style={s.root} contentContainerStyle={s.content}>
    <Pressable accessibilityRole="button" disabled={busy} onPress={onBack} style={s.secondary}><Text style={s.link}>← Темага кайтуу</Text></Pressable>
    <Text style={s.hint}>{scope.section === 'command' ? 'Командирдик даярдоо' : 'Өз алдынча даярдануу'} · {scope.category === 'officers' ? 'Офицерлер' : 'Прапорщиктер жана сержанттар'} · {scope.month.title}</Text>
    <Text accessibilityRole="header" style={s.title}>{scope.topic.title} · Тесттер</Text>
    {isAdmin ? <Pressable accessibilityRole="button" onPress={() => setEditing(true)} style={s.button}><Text style={s.white}>Тест кошуу</Text></Pressable> : <View style={s.card}>
      <Text style={s.body}>Суроолор жана жооптор ар бир аракетте аралашат. Ар бир суроо бирдей бааланат, жооп берилбеген суроо 0 балл болот.</Text>
      <Text style={s.error}>Тиркемеден чыгуу, башка экранга өтүү же аныкталган скриншот — тест провал, 0%. Убакыт бүтсө сакталган жооптор боюнча пайыз эсептелет.</Text>
      <Text style={s.hint}>Туруктуу интернет керек. Байланыш 30 секунддан ашык үзүлсө аракет провал болот. Тестте текст көчүрүлбөйт.</Text>
      {Platform.OS === 'web' && <Text style={s.error}>Корголгон тестти Android же iOS тиркемесинен өтүңүз.</Text>}
    </View>}
    {loading && <ActivityIndicator color="#193f31" />}
    {!loading && !quizzes.length && !error && <Text style={s.body}>Тесттер азырынча жок.</Text>}
    {quizzes.map(quiz => <View key={quiz.id} style={s.card}>
      {isAdmin && <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}><AdminActions disabled={busy} onEdit={() => void edit(quiz)} onDelete={() => void remove(quiz)} /></View>}
      <Text style={s.heading}>{quiz.title}</Text><Text style={s.body}>{quiz.question_count} суроо · {Math.ceil(quiz.duration_seconds / 60)} мүнөт</Text>
      {quiz.latest_result && quiz.latest_result.status !== 'active' && <Text style={quiz.latest_result.status === 'failed' ? s.error : s.link}>Акыркы аракет: {quiz.latest_result.percentage}% · {failureReasons[quiz.latest_result.reason]}</Text>}
      {quiz.latest_result?.status === 'active' ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => { void closeInterrupted(quiz.latest_result!.id); }} style={s.secondary}><Text style={s.error}>Үзүлгөн аракетти аяктоо (0%)</Text></Pressable> : !isAdmin && <Pressable accessibilityRole="button" disabled={Platform.OS === 'web' || busy} onPress={() => setPendingQuiz(quiz)} style={[s.button, Platform.OS === 'web' && s.disabled]}><Text style={s.white}>{quiz.latest_result ? 'Кайра тест өтүү' : 'Тест өтүү'}</Text></Pressable>}
    </View>)}
    {!!error && <View><Text accessibilityRole="alert" style={s.error}>{error}</Text><Pressable accessibilityRole="button" disabled={loading} onPress={() => setRevision(value => value + 1)} style={s.secondary}><Text style={s.link}>Кайра аракет кылуу</Text></Pressable></View>}
  </ScrollView>;
}
