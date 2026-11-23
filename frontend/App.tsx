import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SecureStore from 'expo-secure-store';
import { AuthScreen } from './src/features/auth/AuthScreen';
import { UserHomeScreen } from './src/features/home/UserHomeScreen';
import { api, Profile } from './src/shared/api';
export default function App() {
  const [session, setSession] = useState<{ token: string; user: Profile } | null>(null);
  const [loading, setLoading] = useState(true); const [restoreError, setRestoreError] = useState(false);
  async function restore() {
    setLoading(true); setRestoreError(false);
    try { const token = await SecureStore.getItemAsync('session'); if (token) { const user = await api<Profile>('me', {}, token); await api('training/attempts/recover', { method: 'POST' }, token); setSession({ token, user }); } }
    catch { setRestoreError(true); } finally { setLoading(false); }
  }
  useEffect(() => { void restore(); }, []);
  async function login(token: string, user: Profile) { await api('training/attempts/recover', { method: 'POST' }, token); await SecureStore.setItemAsync('session', token); setSession({ token, user }); }
  async function logout() { if (session) await api('logout', { method: 'POST' }, session.token); await SecureStore.deleteItemAsync('session'); setSession(null); }
  return <SafeAreaProvider><SafeAreaView style={{ flex: 1, backgroundColor: '#f1f4ef' }}><StatusBar style="dark" />{loading ? <ActivityIndicator style={{ flex: 1 }} color="#193f31" /> : restoreError ? <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 24 }}><Text>Сессияны калыбына келтирүү мүмкүн болгон жок.</Text><Pressable onPress={restore}><Text>Кайра аракет кылуу</Text></Pressable><Pressable onPress={async () => { await SecureStore.deleteItemAsync('session'); setRestoreError(false); }}><Text>Кирүү экранына өтүү</Text></Pressable></View> : session ? <UserHomeScreen user={session.user} token={session.token} onLogout={logout} /> : <AuthScreen onLogin={login} />}</SafeAreaView></SafeAreaProvider>;
}
