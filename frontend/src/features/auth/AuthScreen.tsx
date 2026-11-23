import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api, Profile } from '../../shared/api';
import { appName, logoSource, platformTitle } from '../../shared/branding';
import { AnimatedBackground } from '../../shared/components/AnimatedBackground';

import { militaryUnits } from '../../shared/units';
type Props = { onLogin: (token: string, user: Profile) => Promise<void> };
export function AuthScreen({ onLogin }: Props) {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const formAnimation = useRef(new Animated.Value(1)).current;
  const tabAnimation = useRef(new Animated.Value(0)).current;
  const [tabsWidth, setTabsWidth] = useState(0);
  useEffect(() => {
    formAnimation.setValue(0);
    const animation = Animated.parallel([
      Animated.timing(formAnimation, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(tabAnimation, { toValue: tab === 'login' ? 0 : 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [tab, formAnimation, tabAnimation]);
  const [trainingCategory, setTrainingCategory] = useState<Profile['training_category'] | 'doctor' | 'deputy' | 'course_head' | null>(null);
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [confirm, setConfirm] = useState(''); const [number, setNumber] = useState('');
  const [unit, setUnit] = useState(''); const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [success, setSuccess] = useState('');
  async function pickPhoto() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (!result.canceled) {
        const selected = result.assets[0];
        if (selected.fileSize && selected.fileSize > 5 * 1024 * 1024) { setError('Сүрөт 5 МБ ашпашы керек.'); return; }
        setPhoto(selected); setError('');
      }
    } catch { setError('Сүрөт тандоо мүмкүн болгон жок.'); }
  }
  async function submit() {
    if (busy) return;
    setError(''); setSuccess('');
    if (!(tab === 'register' ? /^[^\s@]+@gmail\.com$/i.test(email.trim()) : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) || !password) { setError('Gmail жана сырсөздү туура киргизиңиз.'); return; }
    if (tab === 'register' && (!number.trim() || !unit.trim() || !photo || !trainingCategory)) { setError('Бардык талааларды толтуруп, сүрөт тандаңыз.'); return; }
    if (tab === 'register' && (password.length < 8 || password !== confirm)) { setError('Сырсөз кеминде 8 белгиден туруп, эки талаада бирдей болушу керек.'); return; }
    setBusy(true);
    try {
      if (tab === 'login') {
        const result = await api<{ token: string; user: Profile }>('login', { method: 'POST', body: JSON.stringify({ email: email.trim(), password }) });
        await onLogin(result.token, result.user);
      } else {
        const form = new FormData();
        const isRole = trainingCategory === 'doctor' || trainingCategory === 'deputy' || trainingCategory === 'course_head';
        const role = isRole ? trainingCategory : 'user';
        const category = isRole ? 'officers' : trainingCategory!;
        form.append('role', role); form.append('training_category', category); form.append('email', email.trim()); form.append('password', password); form.append('study_number', number.trim()); form.append('military_unit', unit.trim());
        form.append('photo', { uri: photo!.uri, name: photo!.fileName || 'profile.jpg', type: photo!.mimeType || 'image/jpeg' } as unknown as Blob);
        const result = await api<{ message: string }>('register', { method: 'POST', body: form });
        setSuccess(result.message); setVisiblePasswords({}); setPassword(''); setConfirm(''); setPhoto(null); setNumber(''); setUnit(''); setTrainingCategory(null); setTab('login');
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Ката кетти.'); }
    finally { setBusy(false); }
  }
  const field = (label: string, value: string, update: (v: string) => void, secure = false, isEmail = false) => <View style={s.field}>
    <Text style={s.label}>{label}</Text>
    <View style={s.inputRow}>
      <TextInput accessibilityLabel={label} editable={!busy} style={[s.input, secure && s.passwordInput]} value={value} onChangeText={update} secureTextEntry={secure && !visiblePasswords[label]} autoCapitalize="none" autoCorrect={false} keyboardType={isEmail ? 'email-address' : 'default'} placeholder={isEmail ? 'example@gmail.com' : label} placeholderTextColor="#91a097" />
      {secure && <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${visiblePasswords[label] ? 'Сырсөздү жашыруу' : 'Сырсөздү көрсөтүү'}`} accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => setVisiblePasswords(previous => ({ ...previous, [label]: !previous[label] }))} style={s.visibilityButton}><Text style={s.visibilityText}>{visiblePasswords[label] ? 'Жашыруу' : 'Көрсөтүү'}</Text></Pressable>}
    </View>
  </View>;
  return <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><AnimatedBackground /><ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
    <Text style={s.eyebrow}>КЫРГЫЗ РЕСПУБЛИКАСЫ</Text>
    <View style={s.logoWrap}>
    {logoSource ? <Image source={logoSource} style={s.logo} resizeMode="contain" /> : <View style={s.emblem}><Text style={s.emblemText}>КР</Text><Text style={s.placeholder}>ЛОГОТИП</Text></View>}
    </View>
    <Text style={s.brand}>{appName}</Text>
    <Text style={s.title}>{platformTitle}</Text><View style={s.line} />
    <View style={s.card}><View style={s.tabs} onLayout={event => setTabsWidth(event.nativeEvent.layout.width)}>
      <Animated.View pointerEvents="none" style={[s.tabIndicator, { width: Math.max(0, (tabsWidth - 8) / 2), transform: [{ translateX: tabAnimation.interpolate({ inputRange: [0, 1], outputRange: [0, Math.max(0, (tabsWidth - 8) / 2)] }) }] }]} />{(['login', 'register'] as const).map(t => <Pressable accessibilityRole="tab" accessibilityState={{ selected: tab === t }} disabled={busy} key={t} onPress={() => { setTab(t); setVisiblePasswords({}); setError(''); setSuccess(''); }} style={s.tab}><Text style={[s.tabText, tab === t && s.activeText]}>{t === 'login' ? 'Кирүү' : 'Каттоо'}</Text></Pressable>)}</View>
      <Animated.View style={{ opacity: formAnimation, transform: [{ translateY: formAnimation.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
      <Text style={s.heading}>{tab === 'login' ? 'Кош келиңиз!' : 'Каттоо өтүнмөсү'}</Text><Text style={s.hint}>{tab === 'login' ? 'Билим берүү платформаңызга кириңиз' : 'Өтүнмөңүз администраторго жөнөтүлөт'}</Text>
      {success ? <Text accessibilityRole="alert" style={s.success}>{success}</Text> : null}
      {tab === 'register' && <><View style={s.field}><Text style={s.label}>Категория</Text>{([{ id: 'officers', title: 'Офицерлер' }, { id: 'warrant-sergeants', title: 'Прапорщиктер жана сержанттар' }, { id: 'doctor', title: 'Дарыгер' }, { id: 'deputy', title: 'Күжүрмөн даярдоо боюнча орун басары' }, { id: 'course_head', title: 'Курстун башчысы' }] as const).map(item => <Pressable key={item.id} accessibilityRole="radio" accessibilityState={{ checked: trainingCategory === item.id }} disabled={busy} onPress={() => setTrainingCategory(item.id)} style={[s.input, { marginBottom: 8 }, trainingCategory === item.id && { borderColor: '#193f31', backgroundColor: '#e3ebdc' }]}><Text style={s.label}>{trainingCategory === item.id ? '●' : '○'} {item.title}</Text></Pressable>)}</View>{field('Окуу номери', number, setNumber)}<View style={s.field}><Text style={s.label}>Аскер бөлүгүн тандаңыз</Text><ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>{militaryUnits.map(item => <Pressable accessibilityRole="radio" accessibilityState={{ checked: unit === item }} key={item} disabled={busy} onPress={() => setUnit(item)} style={[s.input, { marginBottom: 6 }, unit === item && { backgroundColor: '#e3ebdc' }]}><Text>{unit === item ? '●' : '○'} {item}</Text></Pressable>)}</ScrollView></View><Text style={s.label}>Сүрөт коюу</Text><Pressable disabled={busy} accessibilityRole="button" onPress={pickPhoto} style={s.photo}>{photo ? <Image source={{ uri: photo.uri }} style={s.avatar} /> : <Text style={s.plus}>＋</Text>}<View><Text style={s.photoText}>{photo ? 'Сүрөттү өзгөртүү' : 'Профиль сүрөтүн тандоо'}</Text><Text style={s.hint}>JPEG, PNG, WebP · 5 МБ чейин</Text></View></Pressable></>}
      {field('Gmail', email, setEmail, false, true)}{field('Сырсөз', password, setPassword, true)}{tab === 'register' && field('Сырсөздү кайталаңыз', confirm, setConfirm, true)}
      {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
      <Pressable accessibilityRole="button" disabled={busy} onPress={submit} style={[s.button, busy && { opacity: 0.6 }]}>{busy ? <ActivityIndicator color="white" /> : <Text style={s.buttonText}>{tab === 'login' ? 'Кирүү' : 'Өтүнмөнү жөнөтүү'}  →</Text>}</Pressable>
      <Text style={s.note}>Кирүү администратор өтүнмөнү жактыргандан кийин жеткиликтүү.</Text>
      </Animated.View>
    </View><Text style={s.footer}>БИЛИМ · ТАРТИП · ДАЯРДЫК</Text>
  </ScrollView></KeyboardAvoidingView>;
}
const s = StyleSheet.create({ root: { flex: 1, backgroundColor: '#f1f4ef' }, content: { padding: 24, paddingTop: 28, alignItems: 'center', flexGrow: 1 }, eyebrow: { color: '#526749', fontSize: 10, letterSpacing: 3, fontWeight: '700' }, emblem: { width: 102, height: 102, borderRadius: 51, backgroundColor: '#173c30', borderWidth: 3, borderColor: '#b7a168', alignItems: 'center', justifyContent: 'center', }, emblemText: { color: '#e8d7a5', fontSize: 32, fontWeight: '800' }, placeholder: { color: '#e8d7a5', fontSize: 8, letterSpacing: 1 }, logoWrap: { width: 110, height: 110, marginTop: 22, marginBottom: 22, alignItems: 'center', justifyContent: 'center' }, logo: { width: 110, height: 110 }, brand: { fontSize: 22, fontWeight: '800', letterSpacing: 2, color: '#193f31', textAlign: 'center', marginBottom: 12 }, title: { fontSize: 13, lineHeight: 19, fontWeight: '500', textAlign: 'center', color: '#20392d', maxWidth: 440 }, line: { width: 46, height: 3, backgroundColor: '#b7a168', marginVertical: 22 }, card: { width: '100%', maxWidth: 460, backgroundColor: '#fff', borderRadius: 22, padding: 22, borderWidth: 1, borderColor: '#e2e9df' }, tabs: { flexDirection: 'row', backgroundColor: '#f0f3ee', padding: 4, borderRadius: 12, marginBottom: 25 }, tab: { flex: 1, padding: 12, borderRadius: 9, alignItems: 'center' }, tabIndicator: { position: 'absolute', top: 4, bottom: 4, left: 4, borderRadius: 9, backgroundColor: '#193f31' }, tabText: { fontWeight: '600', color: '#637264' }, activeText: { color: '#fff' }, heading: { fontSize: 24, fontWeight: '700', color: '#20392d' }, hint: { fontSize: 12, color: '#7a877c', marginTop: 5, lineHeight: 18 }, field: { marginTop: 18 }, label: { fontSize: 13, fontWeight: '600', color: '#334b3c', marginBottom: 8 }, inputRow: { position: 'relative' }, passwordInput: { paddingRight: 100 }, visibilityButton: { position: 'absolute', right: 0, top: 0, bottom: 0, paddingHorizontal: 12, minWidth: 90, justifyContent: 'center', alignItems: 'center' }, visibilityText: { color: '#193f31', fontSize: 12, fontWeight: '600' }, input: { borderWidth: 1, borderColor: '#dde5da', borderRadius: 12, padding: 14, fontSize: 15, color: '#20392d', backgroundColor: '#fafcf9' }, photo: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: '#b8c6b2', borderRadius: 12 }, plus: { fontSize: 30, color: '#526749' }, photoText: { fontSize: 13, color: '#334b3c' }, avatar: { width: 48, height: 48, borderRadius: 24 }, button: { backgroundColor: '#193f31', padding: 17, borderRadius: 12, alignItems: 'center', marginTop: 24 }, buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 }, note: { fontSize: 11, lineHeight: 17, color: '#869084', textAlign: 'center', marginTop: 16 }, error: { color: '#a32e2e', marginTop: 16, lineHeight: 20 }, success: { backgroundColor: '#edf6e9', padding: 12, borderRadius: 8, color: '#27532e', marginTop: 16, lineHeight: 20 }, footer: { color: '#8a987f', fontSize: 9, letterSpacing: 2, marginTop: 26, marginBottom: 10 } });
