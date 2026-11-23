import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '../../shared/api';

type Attempt = { id: number; title: string; topic: string; date: string; status: string; grade: number; correct_answers: number; total: number };

export function MyQuizResultsScreen({ token, onBack }: { token: string; onBack: () => void }) {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    api<Attempt[]>('training/my-quiz-results', {}, token)
      .then(value => { if (active) setAttempts(value); })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : 'Жыйынтыктар жүктөлгөн жок.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  return <View style={s.root}>
    <Pressable accessibilityRole="button" onPress={onBack}><Text style={s.back}>← Башкы бет</Text></Pressable>
    <Text style={s.title}>Тесттердин жыйынтыгы</Text>
    {loading ? <ActivityIndicator color="#193f31" /> : error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : <ScrollView contentContainerStyle={s.list}>
      {attempts.length === 0 ? <Text style={s.empty}>Сиз азырынча тест тапшырган жоксуз.</Text> : attempts.map(item => <View key={item.id} style={s.card}>
        <Text style={s.quizTitle}>{item.title}</Text>
        <Text style={s.detail}>{item.topic} · {new Date(item.date).toLocaleDateString('ru-RU')}</Text>
        <Text style={s.result}>Баасы: {item.grade} · Туура жооп: {item.correct_answers}/{item.total}</Text>
        {item.status !== 'completed' && <Text style={s.detail}>{item.status === 'timed_out' ? 'Убакыт бүттү' : 'Тест аягына чыккан жок'}</Text>}
      </View>)}
    </ScrollView>}
  </View>;
}

const s = StyleSheet.create({ root: { flex: 1, backgroundColor: '#f1f4ef', paddingHorizontal: 22 }, back: { color: '#53674a', paddingVertical: 10 }, title: { color: '#193f31', fontSize: 25, fontWeight: '700', marginBottom: 14 }, list: { gap: 10, paddingBottom: 24 }, card: { backgroundColor: 'white', borderRadius: 14, borderWidth: 1, borderColor: '#e1e8dd', padding: 14 }, quizTitle: { color: '#20392d', fontSize: 16, fontWeight: '700', marginBottom: 5 }, detail: { color: '#4a6046', fontSize: 13, marginTop: 4 }, result: { color: '#193f31', fontSize: 14, fontWeight: '700', marginTop: 8 }, empty: { textAlign: 'center', color: '#73816f', paddingVertical: 36 }, error: { color: '#a04435', lineHeight: 20 } });
