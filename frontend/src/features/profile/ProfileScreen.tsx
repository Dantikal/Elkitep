import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, Profile } from '../../shared/api';
import { UserAvatar } from '../../shared/components/UserAvatar';

type UnitUser = { id: number; email: string; study_number: string; role: Profile['role']; training_category: Profile['training_category']; status: 'pending' | 'approved' };
export function ProfileScreen({ user, token, onLogout, onBack }: { user: Profile; token: string; onLogout: () => Promise<void>; onBack: () => void }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [unitUsers, setUnitUsers] = useState<UnitUser[]>([]); const [usersLoading, setUsersLoading] = useState(user.role === 'deputy'); const [usersError, setUsersError] = useState('');
  async function loadUnitUsers() {
    setUsersLoading(true); setUsersError('');
    try { setUnitUsers(await api<UnitUser[]>('unit/users', {}, token)); }
    catch (e) { setUsersError(e instanceof Error ? e.message : 'Колдонуучулар жүктөлгөн жок.'); }
    finally { setUsersLoading(false); }
  }
  useEffect(() => { if (user.role === 'deputy') void loadUnitUsers(); }, [user.role, token]);
  async function logout() { setBusy(true); try { await onLogout(); } catch { setError('Чыгуу мүмкүн болгон жок. Кайра аракет кылыңыз.'); } finally { setBusy(false); } }
  function roleTitle(item: UnitUser) {
    if (item.role === 'deputy') return 'Күжүрмөн даярдоо боюнча орун басары';
    if (item.role === 'doctor') return 'Дарыгер';
        return item.training_category === 'officers' ? 'Офицер' : 'Прапорщик / сержант';
  }
  return <View style={s.page}>
    <View style={s.header}><Pressable accessibilityRole="button" accessibilityLabel="Башкы бетке кайтуу" onPress={onBack} style={s.backButton} hitSlop={8}><Text style={s.back}>← Артка</Text></Pressable><Text style={s.headerTitle}>Менин профилим</Text></View>
    <ScrollView contentContainerStyle={s.content}><View style={s.identity}><UserAvatar user={user} token={token} size={104} /><Text style={s.title}>Менин профилим</Text><Text style={s.badge}>Аккаунт ырасталган</Text></View>
      <View style={s.card}>{[{ label: 'Gmail', value: user.email }, { label: 'Окуу номери', value: user.study_number }, { label: 'Аскер бөлүк', value: user.military_unit }].map(field => <View key={field.label} style={s.field}><Text style={s.label}>{field.label}</Text><Text selectable style={s.value}>{field.value}</Text></View>)}</View>
      {user.role === 'deputy' && <View style={s.usersSection}>
        <Text style={s.usersHeading}>Колдонуучулар · {user.military_unit}</Text>
        {usersLoading ? <ActivityIndicator color="#193f31" /> : usersError ? <View><Text accessibilityRole="alert" style={s.error}>{usersError}</Text><Pressable accessibilityRole="button" onPress={() => void loadUnitUsers()} style={s.retry}><Text style={s.back}>Кайра жүктөө</Text></Pressable></View> : unitUsers.length === 0 ? <Text style={s.userMeta}>Бул аскер бөлүктө колдонуучулар жок.</Text> : unitUsers.map(item => <View key={item.id} style={s.userCard}><Text style={s.userTitle}>{item.study_number}</Text><Text selectable style={s.userMeta}>{item.email}</Text><Text style={s.userMeta}>{roleTitle(item)} · {item.status === 'approved' ? 'Ырасталган' : 'Күтүүдө'}</Text></View>)}
        {!usersLoading && !usersError && <Pressable accessibilityRole="button" onPress={() => void loadUnitUsers()} style={s.retry}><Text style={s.back}>Жаңылоо</Text></Pressable>}
      </View>}
      {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}<Pressable disabled={busy} accessibilityRole="button" onPress={logout} style={[s.button, busy && { opacity: 0.6 }]}>{busy ? <ActivityIndicator color="white" /> : <Text style={s.buttonText}>Чыгуу</Text>}</Pressable>
    </ScrollView>
  </View>;
}
const s = StyleSheet.create({ page: { flex: 1, backgroundColor: '#f1f4ef' }, header: { flexDirection: 'row', alignItems: 'center', gap: 24, padding: 22, borderBottomWidth: 1, borderBottomColor: '#d8e1d3' }, backButton: { minWidth: 88, minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 }, back: { color: '#193f31', fontWeight: '600', fontSize: 15 }, headerTitle: { color: '#193f31', fontWeight: '700', fontSize: 17, flexShrink: 1 }, content: { padding: 24, paddingBottom: 40 }, identity: { alignItems: 'center', paddingTop: 16 }, title: { fontSize: 25, color: '#193f31', fontWeight: '700', marginTop: 20, marginBottom: 10 }, badge: { color: '#28523f', backgroundColor: '#e3ebdc', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, fontSize: 12 }, card: { backgroundColor: '#ffffff', paddingHorizontal: 22, borderRadius: 18, marginVertical: 28 }, field: { paddingVertical: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#d8e1d3' }, label: { color: '#647560', fontSize: 12, marginBottom: 6 }, value: { color: '#193f31', fontSize: 16, fontWeight: '600' }, usersSection: { gap: 12, marginBottom: 26 }, usersHeading: { color: '#193f31', fontSize: 19, fontWeight: '700', marginBottom: 4 }, userCard: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#d8e1d3', padding: 16, gap: 5 }, userTitle: { color: '#193f31', fontSize: 16, fontWeight: '700' }, userMeta: { color: '#647560', fontSize: 13, lineHeight: 19 }, retry: { paddingVertical: 10 }, button: { backgroundColor: '#28523f', padding: 17, borderRadius: 12, alignItems: 'center' }, buttonText: { color: 'white', fontWeight: '600' }, error: { color: '#a33224', marginBottom: 16 } });
