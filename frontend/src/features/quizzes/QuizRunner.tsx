import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, BackHandler, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { api } from '../../shared/api';
import { protectTest } from './protection';
import { AttemptResult, StartedAttempt, failureReasons } from './types';
import { s } from './styles';

type EndAction = { action: 'finish' } | { action: 'violation'; reason: 'screenshot' | 'app_exit' | 'navigation' };
export function QuizRunner({ token, quizId, onBack }: { token: string; quizId: number; onBack: () => void }) {
  const [attempt, setAttempt] = useState<StartedAttempt | null>(null);
  const [terminal, setTerminal] = useState<AttemptResult | null>(null);
  const [phase, setPhase] = useState<'starting' | 'running' | 'ending' | 'result' | 'error'>('starting');
  const [error, setError] = useState(''); const [remaining, setRemaining] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const mounted = useRef(true); const cancelled = useRef(false);
  const current = useRef<StartedAttempt | null>(null);
  const finished = useRef(false); const requestedEnd = useRef<EndAction | null>(null);
  const endingInFlight = useRef(false); const answerInFlight = useRef(false); const heartbeatInFlight = useRef(false);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const clock = useRef({ started: 0, available: 0 });
  const cleanupProtection = useRef<(() => void) | null>(null);
  const backRef = useRef(onBack); backRef.current = onBack;

  function send(data: object): Promise<AttemptResult> {
    const id = current.current?.id;
    if (!id) return Promise.reject(new Error('Тест баштала элек.'));
    const request = queue.current.catch(() => {}).then(() => api<AttemptResult>(`training/attempts/${id}`, { method: 'POST', body: JSON.stringify(data) }, token));
    queue.current = request;
    return request;
  }
  function showResult(value: AttemptResult) {
    if (value.status === 'active') return;
    finished.current = true;
    cleanupProtection.current?.(); cleanupProtection.current = null;
    if (mounted.current) { setTerminal(value); setPhase('result'); setError(''); }
  }
  async function flushEnd() {
    if (!requestedEnd.current || !current.current || endingInFlight.current || finished.current) return;
    endingInFlight.current = true;
    try { showResult(await send(requestedEnd.current)); }
    catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : 'Жыйынтык сакталган жок.'); }
    finally { endingInFlight.current = false; }
  }
  function end(action: EndAction) {
    if (finished.current) return;
    // A detected violation takes priority over a submission waiting for the network.
    if (!requestedEnd.current || action.action === 'violation') requestedEnd.current = action;
    if (mounted.current) { setPhase('ending'); setAttempt(null); }
    void flushEnd();
  }
  useEffect(() => {
    mounted.current = true;
    const appSubscription = AppState.addEventListener('change', state => {
      if (state !== 'active' && !finished.current) {
        if (current.current) end({ action: 'violation', reason: 'app_exit' });
        else { cancelled.current = true; backRef.current(); }
      }
    });
    const blurSubscription = Platform.OS === 'android' ? AppState.addEventListener('blur', () => {
      if (current.current && !finished.current) end({ action: 'violation', reason: 'app_exit' });
    }) : null;
    const backSubscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (current.current && !finished.current) end({ action: 'violation', reason: 'navigation' });
      else { cancelled.current = true; backRef.current(); }
      return true;
    });
    async function start() {
      try {
        const release = await protectTest(() => {
          if (current.current && !finished.current) end({ action: 'violation', reason: 'screenshot' });
        });
        if (!mounted.current || cancelled.current) { release(); return; }
        cleanupProtection.current = release;
        const value = await api<StartedAttempt>(`training/quizzes/${quizId}/start`, { method: 'POST' }, token);
        current.current = value;
        if (!mounted.current || cancelled.current || AppState.currentState !== 'active') {
          end({ action: 'violation', reason: 'app_exit' }); return;
        }
        clock.current = { started: performance.now(), available: Math.max(0, Date.parse(value.deadline) - Date.parse(value.server_now)) };
        setRemaining(Math.ceil(clock.current.available / 1000));
        setAttempt(value); setPhase('running');
      } catch (e) {
        cleanupProtection.current?.(); cleanupProtection.current = null;
        if (mounted.current) { setError(e instanceof Error ? e.message : 'Тест башталган жок.'); setPhase('error'); cancelled.current = true; }
      }
    }
    void start();
    const timer = setInterval(() => {
      if (!current.current || finished.current) return;
      if (requestedEnd.current) { void flushEnd(); return; }
      const seconds = Math.max(0, Math.ceil((clock.current.available - (performance.now() - clock.current.started)) / 1000));
      if (mounted.current) setRemaining(seconds);
      if (seconds === 0) end({ action: 'finish' });
    }, 1000);
    const heartbeat = setInterval(() => {
      if (!current.current || finished.current || requestedEnd.current || heartbeatInFlight.current || answerInFlight.current) return;
      heartbeatInFlight.current = true;
      void send({ action: 'heartbeat' }).then(showResult).catch(e => { if (mounted.current) setError(e.message); }).finally(() => { heartbeatInFlight.current = false; });
    }, 5000);
    return () => {
      mounted.current = false; cancelled.current = true;
      appSubscription.remove(); blurSubscription?.remove(); backSubscription.remove();
      clearInterval(timer); clearInterval(heartbeat);
      if (current.current && !finished.current) {
        requestedEnd.current = { action: 'violation', reason: 'navigation' }; void flushEnd();
      }
      cleanupProtection.current?.(); cleanupProtection.current = null;
    };
  }, [quizId, token]);

  async function choose(questionId: string, optionId: string) {
    if (answerInFlight.current || requestedEnd.current || finished.current) return;
    answerInFlight.current = true; setSaving(true); setError('');
    try {
      const value = await send({ action: 'answer', question_id: questionId, option_id: optionId });
      if (value.status !== 'active') showResult(value);
      else if (mounted.current) setAnswers(previous => ({ ...previous, [questionId]: optionId }));
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : 'Жооп сакталган жок. Кайра тандаңыз.'); }
    finally { answerInFlight.current = false; if (mounted.current) setSaving(false); }
  }
  const question = attempt?.questions[questionIndex];
  return <ScrollView style={s.root} contentContainerStyle={s.content}>
    {phase === 'starting' ? <><ActivityIndicator color="#193f31" /><Text style={s.body}>Экранды коргоо текшерилүүдө. Тест башталууда…</Text><Pressable accessibilityRole="button" onPress={() => { cancelled.current = true; onBack(); }} style={s.secondary}><Text style={s.link}>Баштоону жокко чыгаруу</Text></Pressable></> : phase === 'ending' ? <>
      <ActivityIndicator color="#193f31" /><Text style={s.title}>{requestedEnd.current?.action === 'violation' ? 'Тест токтотулду' : 'Тест аяктады'}</Text>
      <Text style={s.body}>Жыйынтык серверде сакталууда. Интернет байланышын сактаңыз.</Text>
    </> : terminal ? <View style={s.card}>
      <Text accessibilityRole="header" style={s.title}>{terminal.status === 'failed' ? 'Тесттен өтпөдүңүз' : 'Тесттин жыйынтыгы'}</Text>
      <Text style={s.score}>{terminal.percentage}%</Text><Text style={s.body}>{failureReasons[terminal.reason] ?? terminal.reason}</Text>
      <Text style={s.body}>Жооп берилди: {terminal.answered}/{terminal.total}</Text>
      <Pressable accessibilityRole="button" onPress={onBack} style={s.button}><Text style={s.white}>Артка</Text></Pressable>
    </View> : phase === 'error' ? <Pressable accessibilityRole="button" onPress={onBack} style={s.secondary}><Text style={s.link}>← Артка</Text></Pressable> : question && <>
      <View style={s.row}><Text style={[s.heading, { flex: 1 }]}>Суроо {questionIndex + 1}/{attempt!.questions.length}</Text><Text accessibilityLabel="Калган убакыт" style={s.timer}>{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</Text></View>
      <Text selectable={false} style={s.title}>{question.text}</Text>
      {question.options.map((option, index) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: answers[question.id] === option.id, disabled: saving }} disabled={saving} key={option.id} onPress={() => { void choose(question.id, option.id); }} style={[s.option, answers[question.id] === option.id && s.selected, saving && s.disabled]}><Text selectable={false} style={s.link}>{String.fromCharCode(65 + index)}</Text><Text selectable={false} style={[s.body, { flex: 1 }]}>{option.text}</Text></Pressable>)}
      {saving && <Text style={s.hint}>Жооп сакталууда…</Text>}
      <Text style={s.hint}>Сакталган жооптор: {Object.keys(answers).length}/{attempt!.questions.length}</Text>
      <View style={s.row}>
        <Pressable accessibilityRole="button" disabled={questionIndex === 0 || saving} onPress={() => setQuestionIndex(value => value - 1)} style={[s.secondary, (questionIndex === 0 || saving) && s.disabled]}><Text style={s.link}>← Мурунку</Text></Pressable>
        {questionIndex < attempt!.questions.length - 1 && <Pressable accessibilityRole="button" disabled={saving} onPress={() => setQuestionIndex(value => value + 1)} style={[s.button, { flex: 1 }, saving && s.disabled]}><Text style={s.white}>Кийинки →</Text></Pressable>}
      </View>
      <Pressable accessibilityRole="button" disabled={saving} onPress={() => end({ action: 'finish' })} style={[s.button, saving && s.disabled]}><Text style={s.white}>Тестти бүтүрүү</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => end({ action: 'violation', reason: 'navigation' })} style={s.secondary}><Text style={s.error}>Тесттен чыгуу (аракет провал болот)</Text></Pressable>
    </>}
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    {phase === 'ending' && !!error && <Pressable onPress={() => { void flushEnd(); }} style={s.secondary}><Text style={s.link}>Кайра жөнөтүү</Text></Pressable>}
  </ScrollView>;
}
