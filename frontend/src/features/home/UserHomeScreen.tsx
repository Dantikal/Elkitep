import { ReactNode, useEffect, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BackHandler, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DoctorScreen } from '../diet/DietScreen';
import { api, Profile } from '../../shared/api';
import { appName, logoSource, platformTitle } from '../../shared/branding';
import { AdminDashboard } from '../admin/AdminDashboard';
import { AboutScreen } from '../about/AboutScreen';
import { AchievementsScreen } from '../achievements/AchievementsScreen';
import { ProfileScreen } from '../profile/ProfileScreen';
import { ReferralsScreen } from '../referrals/ReferralsScreen';
import { QuizScreen } from '../quizzes/QuizScreen';
import { MyQuizResultsScreen } from '../quizzes/MyQuizResultsScreen';
import { QuizScope } from '../quizzes/types';
import { TrainingPlanScreen } from '../training/TrainingPlanScreen';
import { CoursesScreen, Section as CourseSection } from '../courses/CoursesScreen';
import { CourseQuizScreen } from '../courses/CourseQuizScreen';
import { MyCoursesScreen } from '../courses/MyCoursesScreen';
import { TrainingScreen } from '../training/TrainingScreen';
import { SectionId, trainingSections } from '../training/sections';

export function UserHomeScreen({ user, token, onLogout }: { user: Profile; token: string; onLogout: () => Promise<void> }) {
  const [doctorOpen, setDoctorOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [referralsOpen, setReferralsOpen] = useState(false);
  const [referralsUnread, setReferralsUnread] = useState(0);
  async function refreshReferrals() { try { const result = await api<{ unread: number }>('referrals/unread', {}, token); setReferralsUnread(result.unread); } catch {} }
  useEffect(() => { void refreshReferrals(); const timer = setInterval(() => void refreshReferrals(), 15000); return () => clearInterval(timer); }, [token]);
  async function refreshNotifications() { try { const result = await api<{ unread: number }>('diet/notifications', {}, token); setUnread(result.unread); } catch {} }
  useEffect(() => { void refreshNotifications(); const timer = setInterval(() => void refreshNotifications(), 15000); return () => clearInterval(timer); }, [token]);
  const [quizScope, setQuizScope] = useState<QuizScope | null>(null);
  const [courseQuiz, setCourseQuiz] = useState<{ course: CourseSection; create: boolean } | null>(null);
  const [myCoursesOpen, setMyCoursesOpen] = useState(false);
  const [courseTestsRevision, setCourseTestsRevision] = useState(0);
  const fullScreen = !!quizScope || !!courseQuiz;
  const [adminOpen, setAdminOpen] = useState(false);
  const [personalResultsOpen, setPersonalResultsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const [sectionId, setSectionId] = useState<SectionId>('home');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const planCategory = user.is_superuser ? categoryId : user.training_category;
  const section = trainingSections.find(item => item.id === sectionId);
  function selectSection(id: SectionId) { setSectionId(id); setCategoryId(null); setMyCoursesOpen(false); }
  function goBack() {
    if (doctorOpen) setDoctorOpen(false);
    else if (adminOpen) setAdminOpen(false);
    else if (personalResultsOpen) setPersonalResultsOpen(false);
    else if (profileOpen) setProfileOpen(false);
    else if (categoryId) setCategoryId(null);
    else selectSection('home');
  }
  useEffect(() => {
    if (fullScreen || (sectionId === 'courses' && !profileOpen && !adminOpen)) return;
    if (sectionId === 'command' && (planCategory === 'officers' || planCategory === 'warrant-sergeants') && !profileOpen && !adminOpen) return;
    if (!doctorOpen && !adminOpen && !profileOpen && !personalResultsOpen && sectionId === 'home') return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (doctorOpen) setDoctorOpen(false);
      else if (adminOpen) setAdminOpen(false);
      else if (personalResultsOpen) setPersonalResultsOpen(false);
      else if (profileOpen) setProfileOpen(false);
      else if (categoryId) setCategoryId(null);
      else { setSectionId('home'); setCategoryId(null); }
      return true;
    });
    return () => listener.remove();
  }, [doctorOpen, adminOpen, profileOpen, personalResultsOpen, sectionId, categoryId, planCategory, fullScreen]);

  if (adminOpen && user.is_superuser) return <AdminDashboard user={user} token={token} onLogout={onLogout} onBack={() => setAdminOpen(false)} />;

  if (profileOpen) return <ProfileScreen user={user} token={token} onLogout={onLogout} onBack={goBack} />;
  if (referralsOpen) return <ReferralsScreen token={token} onBack={() => { setReferralsOpen(false); setReferralsUnread(0); void refreshReferrals(); }} />;
  if (achievementsOpen) return <View style={[s.root, { paddingHorizontal: 24, paddingTop: 8 }]}><AchievementsScreen token={token} onBack={() => setAchievementsOpen(false)} /></View>;
  if (aboutOpen) return <AboutScreen token={token} onBack={() => setAboutOpen(false)} />;
  if (personalResultsOpen) return <MyQuizResultsScreen token={token} onBack={() => setPersonalResultsOpen(false)} />;

  return <View style={s.root}>
    {quizScope && <QuizScreen token={token} isAdmin={user.is_superuser} scope={quizScope} onBack={() => setQuizScope(null)} />}
    {courseQuiz && <CourseQuizScreen key={`${courseQuiz.course.id}/${courseQuiz.create}`} token={token} course={courseQuiz.course} canManage={courseQuiz.course.can_manage} startCreating={courseQuiz.create} onBack={() => { setCourseQuiz(null); setCourseTestsRevision(value => value + 1); }} />}
    <View style={[s.header, fullScreen && { display: 'none' }]}><Pressable accessibilityRole="button" accessibilityLabel={referralsUnread > 0 ? `Билдирүүлөр, ${referralsUnread} жаңы` : 'Билдирүүлөр'} hitSlop={10} onPress={() => setReferralsOpen(true)} style={({ pressed }) => [s.bell, pressed && { opacity: 0.6 }]}><MaterialCommunityIcons name={referralsUnread > 0 ? 'bell-ring-outline' : 'bell-outline'} size={26} color="#193f31" />{referralsUnread > 0 && <View style={s.bellBadge}><Text style={s.badgeText}>{referralsUnread > 9 ? '9+' : referralsUnread}</Text></View>}</Pressable><Image source={logoSource} resizeMode="contain" style={s.logo} /><Text style={s.brandText}>{appName}</Text></View>
    <ScrollView key={`${sectionId}/${categoryId ?? ''}`} style={{ flex: 1, display: fullScreen ? 'none' : 'flex' }} contentContainerStyle={s.content}>
      {doctorOpen ? <><Pressable onPress={() => setDoctorOpen(false)} style={{ paddingVertical: 16 }}><Text>← Башкы бет</Text></Pressable><DoctorScreen token={token} isDoctor={user.role === 'doctor'} onChanged={() => void refreshNotifications()} /></> : sectionId === 'command' && (planCategory === 'officers' || planCategory === 'warrant-sergeants') ? <TrainingPlanScreen isVisible={!quizScope} onTests={(month, topic) => setQuizScope({ section: sectionId, category: planCategory, month, topic })} section={sectionId} key={`${sectionId}/${planCategory}`} category={planCategory} token={token} isAdmin={user.is_superuser} onBack={() => user.is_superuser ? setCategoryId(null) : selectSection('home')} /> : sectionId === 'courses' ? (myCoursesOpen ? <MyCoursesScreen token={token} isVisible={!fullScreen} testsRevision={courseTestsRevision} onBack={() => setMyCoursesOpen(false)} onTests={(course, create) => setCourseQuiz({ course, create })} /> : <CoursesScreen token={token} isAdmin={user.is_superuser} isCourseHead={user.role === 'course_head'} isVisible={!fullScreen} onBack={() => selectSection('home')} onTests={course => setCourseQuiz({ course, create: false })} onMyCourses={() => setMyCoursesOpen(true)} />) : section ? <TrainingScreen token={token} section={section} categoryId={categoryId} onCategory={setCategoryId} onBack={goBack} /> : <>
        <Text style={s.eyebrow}>БАШКЫ БЕТ</Text><Text style={s.title}>Кош келиңиз!</Text><Text style={s.description}>{platformTitle}</Text>
        <Text style={s.sectionHeading}>Даярдоо бөлүмдөрү</Text>
        <View style={s.grid}>
          {user.is_superuser && <IconTile icon="cog-outline" color="#193f31" label="Башкаруу панели" onPress={() => setAdminOpen(true)} />}
          <IconTile icon="clipboard-check-outline" color="#2f8a5b" label="Тесттердин жыйынтыгы" onPress={() => setPersonalResultsOpen(true)} />
          <IconTile icon="trophy-outline" color="#c08a2b" label="Менин жетишкендиктерим" onPress={() => setAchievementsOpen(true)} />
          {trainingSections.map(item => <IconTile key={item.id} icon={sectionIcons[item.id].icon} color={sectionIcons[item.id].color} label={item.title} onPress={() => selectSection(item.id)} />)}
          <IconTile icon="stethoscope" color="#b3473e" label={user.role === 'doctor' ? 'Пациенттер' : 'Дарыгер'} badge={unread} onPress={() => setDoctorOpen(true)} />
          <IconTile icon="information-outline" color="#3a7d7b" label="Тиркеме жөнүндө" onPress={() => setAboutOpen(true)} />
        </View>
      </>}
    </ScrollView>
    <View style={[s.bottomBar, fullScreen && { display: 'none' }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Профилди ачуу" hitSlop={10} onPress={() => setProfileOpen(true)} style={({ pressed }) => [s.bottomItem, pressed && { opacity: 0.6 }]}>
        <MaterialCommunityIcons name="account-circle-outline" size={30} color="#193f31" />
        <Text style={s.bottomLabel}>Профиль</Text>
      </Pressable>
    </View>
  </View>;
}
type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
const sectionIcons: Record<typeof trainingSections[number]['id'], { icon: IconName; color: string }> = {
  command: { icon: 'shield-star-outline', color: '#806c32' },
  physical: { icon: 'run-fast', color: '#2d6f9e' },
  courses: { icon: 'school-outline', color: '#6b4fa0' },
};

function IconTile({ icon, color, label, badge = 0, onPress }: { icon: IconName; color: string; label: string; badge?: number; onPress: () => void }): ReactNode {
  return <Pressable accessibilityRole="button" accessibilityLabel={badge > 0 ? `${label}, ${badge} жаңы` : label} onPress={onPress} style={({ pressed }) => [s.tile, pressed && { opacity: 0.6, transform: [{ scale: 0.96 }] }]}>
    <View style={[s.tileIcon, { backgroundColor: `${color}1f` }]}>
      <MaterialCommunityIcons name={icon} size={34} color={color} />
      {badge > 0 && <View style={s.badge}><Text style={s.badgeText}>{badge > 99 ? '99+' : badge}</Text></View>}
    </View>
    <Text style={s.tileLabel} numberOfLines={2}>{label}</Text>
  </Pressable>;
}

const s = StyleSheet.create({ grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 22 }, tile: { width: '33.33%', alignItems: 'center', paddingHorizontal: 4 }, tileIcon: { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' }, tileLabel: { marginTop: 8, color: '#193f31', fontSize: 12.5, fontWeight: '600', textAlign: 'center', lineHeight: 16 }, badge: { position: 'absolute', top: -4, right: -4, minWidth: 22, height: 22, paddingHorizontal: 5, borderRadius: 11, backgroundColor: '#d93025', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#f1f4ef' }, badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' }, root: { flex: 1, backgroundColor: '#f1f4ef' }, bell: { position: 'absolute', left: 16, top: 0, bottom: 0, width: 44, alignItems: 'center', justifyContent: 'center' }, bellBadge: { position: 'absolute', top: 10, right: 4, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: '#d93025', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#f8faf6' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 64, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#d8e1d3', backgroundColor: '#f8faf6' }, brand: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }, logo: { width: 40, height: 46 }, brandText: { color: '#193f31', fontSize: 18, fontWeight: '800', letterSpacing: 1, flexShrink: 1, textAlign: 'center' }, bottomBar: { alignItems: 'center', paddingTop: 8, paddingBottom: 10, borderTopWidth: 1, borderTopColor: '#d8e1d3', backgroundColor: '#f8faf6' }, bottomItem: { alignItems: 'center', paddingHorizontal: 24 }, bottomLabel: { color: '#193f31', fontSize: 11, fontWeight: '600', marginTop: 2 }, content: { padding: 24, paddingTop: 24, paddingBottom: 32 }, eyebrow: { color: '#647560', fontSize: 11, letterSpacing: 2 }, title: { color: '#193f31', fontWeight: '700', fontSize: 30, marginTop: 12, marginBottom: 16 }, description: { color: '#5f705b', fontSize: 14, lineHeight: 23 }, card: { backgroundColor: '#ffffff', borderRadius: 20, padding: 24, marginTop: 28, borderWidth: 1, borderColor: '#d8e1d3' }, cardTitle: { color: '#193f31', fontWeight: '700', fontSize: 18 }, sectionHeading: { color: '#193f31', fontSize: 18, fontWeight: '700', marginTop: 30, marginBottom: 16 }, sectionCards: { gap: 14 }, sectionCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, backgroundColor: '#ffffff', borderRadius: 18, borderWidth: 1, borderColor: '#d8e1d3' }, sectionSymbol: { width: 42, height: 42, backgroundColor: '#e3ebdc', borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, symbolText: { color: '#75622e', fontSize: 23 }, sectionHint: { fontSize: 12, color: '#647560', marginTop: 6 }, arrow: { fontSize: 23, color: '#806c32' } });
