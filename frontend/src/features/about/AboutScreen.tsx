import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AccessibilityInfo, ActivityIndicator, Animated, BackHandler, Easing, Image, NativeScrollEvent, NativeSyntheticEvent, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { api, API_URL } from '../../shared/api';
import { logoSource, platformTitle } from '../../shared/branding';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
type Member = { id: number; role: string; full_name: string; position: string; has_photo: boolean };
type About = { title: string; team_title: string; members: Member[] };

const intro = 'Кыргыз Республикасынын Мамлекеттик чек ара кызматынын Күжүрмөн даярдоо башкармалыгы тарабынан иштелип чыккан санариптик билим берүү платформасы.';

const decree = { lead: 'Кыргыз Республикасынын Мамлекеттик чек ара кызматынын төрагасы генерал-майор А.K.Алимбаевдин ', strong: '2026-жылдын 17-августундагы №691 буйругунун', rest: ' негизинде күжүрмөн даярдоону санариптештирүүгө багытталган электрондук платформа ишке киргизилди.' };

const goal = 'Тиркеме чек ара кызматынын аскер кызматкерлеринин күжүрмөн даярдыгын санариптештирүү, окуу процессин заманбап технологиялардын негизинде уюштуруу жана анын сапатын жогорулатуу максатында түзүлгөн. Платформа кагаз түрүндөгү окуу материалдарын, тесттерди жана эсептерди бирдиктүү санариптик чөйрөгө бириктирип, кызматкерлердин даярдыгын системалуу түрдө пландаштырууга жана көзөмөлдөөгө шарт түзөт.';

const tasks = [
  'Аскер кызматкерлерине окуу материалдарына каалаган убакта жана каалаган жерден жеткиликтүүлүктү камсыз кылуу',
  'Билимди баалоонун калыс жана ачык-айкын тутумун түзүү',
  'Дене-тарбия даярдыгын ар бир кызматкердин жеке көрсөткүчтөрүнө ылайыкташтыруу',
  'Командирлерге кол алдындагы кызматкерлердин даярдык деңгээлин тез жана так көзөмөлдөөгө мүмкүнчүлүк берүү',
  'Кагаз иштерин кыскартуу жана убакытты үнөмдөө',
];

const sections: { icon: IconName; color: string; title: string; text: string; points?: string[] }[] = [
  { icon: 'star-four-points-outline', color: '#193f31', title: 'Командирдик даярдоо', text: 'Офицерлер, прапорщиктер жана сержанттар үчүн өзүнчө окуу материалдары жана тесттер. Тесттер кызматкердин билимин калыс баалоо үчүн коргоо тутуму менен жабдылган.' },
  { icon: 'run-fast', color: '#2f8a5b', title: 'Дене-тарбия даярдыгы', text: 'Кызматкер өзүнүн анатомиялык маалыматтарын (бою, салмагы, жашы ж.б.) толтурат. Ошол маалыматтардын негизинде тиркеме:', points: ['жашына жана көрсөткүчтөрүнө жараша түзөтүүлөрдү (поправка) эсептейт', 'жеке машыгуу планын түзөт', 'туура тамактануу боюнча диета сунуштайт'] },
  { icon: 'book-open-page-variant-outline', color: '#3a6ea5', title: 'Окуу курстары', text: 'Кесиптик билимди тереңдетүү үчүн курстар. Курсту ийгиликтүү аяктаган кызматкерлердин тизмеси автоматтык түрдө түзүлөт.' },
  { icon: 'clipboard-check-outline', color: '#c08a2b', title: 'Тесттердин жыйынтыгы', text: 'Ар бир кызматкер өзүнүн бардык тесттеринин жыйынтыктарын көрүп, жетишкендиктерин жана өнүктүрүүчү жактарын байкай алат.' },
  { icon: 'stethoscope', color: '#b3473e', title: 'Дарыгер', text: 'Кызматкерлер медициналык кызматкер менен түздөн-түз байланышып, ден соолук жана машыгуу боюнча кеңеш ала алышат.' },
  { icon: 'cog-outline', color: '#5b5f97', title: 'Башкаруу панели', text: 'Жооптуу адамдар катталуу өтүнүчтөрүн карап чыгат, тесттерди жана курстарды түзөт, натыйжаларды талдайт.' },
];

const security = 'Тиркемеге кирүү администратор тарабынан ырасталгандан кийин гана мүмкүн. Ар бир колдонуучу өзүнүн жеке окуу номери менен катталат. Бул кызматтык маалыматтын корголушун камсыз кылат.';

const results = '«КУТ БИЛИМ 1.0» платформасын колдонуу кызматкерлердин кесиптик жана дене-тарбия даярдыгынын деңгээлин жогорулатууга, окуу процессин ачык-айкын жана натыйжалуу кылууга, ошондой эле Мамлекеттик чек ара кызматында санариптик трансформацияны ишке ашырууга салым кошот.';

type RevealCtx = {
  offset: { current: number };
  height: number;
  reduceMotion: { current: boolean };
  subscribe: (fn: (offset: number) => void) => () => void;
  nextDelay: () => number;
};
const RevealContext = createContext<RevealCtx | null>(null);

type From = 'up' | 'left' | 'right' | 'zoom';

function Reveal({ children, from = 'up', style, onShow }: { children: ReactNode; from?: From; style?: object; onShow?: () => void }) {
  const ctx = useContext(RevealContext)!;
  const progress = useRef(new Animated.Value(0)).current;
  const y = useRef<number | null>(null);
  const shown = useRef(false);

  const check = (offset: number) => {
    if (shown.current || y.current === null || y.current > offset + ctx.height * 0.9) return;
    shown.current = true;
    if (ctx.reduceMotion.current) { progress.setValue(1); onShow?.(); return; }
    const delay = ctx.nextDelay();
    Animated.spring(progress, { toValue: 1, delay, damping: 16, stiffness: 110, mass: 0.9, useNativeDriver: true }).start();
    if (onShow) setTimeout(onShow, delay + 120);
  };
  useEffect(() => ctx.subscribe(check), []);

  const distance = 46;
  const transform = from === 'zoom'
    ? [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }) }]
    : from === 'up'
      ? [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }, { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }]
      : [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [from === 'left' ? -distance * 2 : distance * 2, 0] }) }, { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: [from === 'left' ? '-4deg' : '4deg', '0deg'] }) }];

  return <Animated.View
    onLayout={e => { y.current = e.nativeEvent.layout.y; check(ctx.offset.current); }}
    style={[style, { opacity: progress.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0.9, 1], extrapolate: 'clamp' }), transform }]}>
    {children}
  </Animated.View>;
}

function usePop() {
  const value = useRef(new Animated.Value(0)).current;
  const play = () => Animated.spring(value, { toValue: 1, damping: 7, stiffness: 140, useNativeDriver: true }).start();
  const style = { transform: [{ scale: value }, { rotate: value.interpolate({ inputRange: [0, 1], outputRange: ['-180deg', '0deg'] }) }] };
  return { play, style };
}

function SectionHeader({ icon, title }: { icon: IconName; title: string }) {
  const pop = usePop();
  return <Reveal from="left" style={s.sectionHeader} onShow={pop.play}>
    <Animated.View style={[s.sectionHeaderIcon, pop.style]}><MaterialCommunityIcons name={icon} size={18} color="#ffffff" /></Animated.View>
    <Text style={s.sectionHeaderText}>{title}</Text>
  </Reveal>;
}

function Card({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[s.card, style]}>{children}</View>;
}

function FeatureCard({ item, index }: { item: typeof sections[number]; index: number }) {
  const pop = usePop();
  return <Reveal from={index % 2 ? 'right' : 'left'} style={{ marginBottom: 12 }} onShow={pop.play}>
    <Card style={s.featureCard}>
      <View style={[s.featureAccent, { backgroundColor: item.color }]} />
      <View style={s.featureTop}>
        <Animated.View style={[s.featureIcon, { backgroundColor: item.color }, pop.style]}><MaterialCommunityIcons name={item.icon} size={22} color="#ffffff" /></Animated.View>
        <View style={{ flex: 1 }}>
          <Text style={s.featureNumber}>{index + 1}-бөлүм</Text>
          <Text style={s.featureTitle}>{item.title}</Text>
        </View>
      </View>
      <Text style={s.body}>{item.text}</Text>
      {item.points?.map(point => <View key={point} style={s.pointRow}>
        <View style={[s.dot, { backgroundColor: item.color }]} />
        <Text style={[s.body, { flex: 1 }]}>{point}</Text>
      </View>)}
    </Card>
  </Reveal>;
}

function TasksCard() {
  const values = useRef(tasks.map(() => new Animated.Value(0))).current;
  const play = () => Animated.stagger(140, values.map(v => Animated.spring(v, { toValue: 1, damping: 9, stiffness: 150, useNativeDriver: true }))).start();
  return <Reveal onShow={play}>
    <Card style={{ gap: 12 }}>
      {tasks.map((task, i) => <Animated.View key={task} style={[s.taskRow, { opacity: values[i], transform: [{ translateX: values[i].interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }]}>
        <Animated.View style={{ marginTop: 1, transform: [{ scale: values[i] }] }}><MaterialCommunityIcons name="check-circle" size={20} color="#2f8a5b" /></Animated.View>
        <Text style={[s.body, { flex: 1 }]}>{task}</Text>
      </Animated.View>)}
    </Card>
  </Reveal>;
}

function IntroCard({ title }: { title: string }) {
  const shimmer = useRef(new Animated.Value(0)).current;
  const ctx = useContext(RevealContext)!;
  useEffect(() => {
    if (ctx.reduceMotion.current) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(1400),
      Animated.timing(shimmer, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(shimmer, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  return <Reveal from="zoom">
    <Card style={s.introCard}>
      <Animated.View pointerEvents="none" style={[s.shimmer, { transform: [{ translateX: shimmer.interpolate({ inputRange: [0, 1], outputRange: [-160, 520] }) }, { rotate: '20deg' }] }]} />
      <Text style={s.introText}><Text style={s.introStrong}>{title}</Text> — {intro}</Text>
    </Card>
  </Reveal>;
}

function MemberCard({ member, index, token }: { member: Member; index: number; token: string }) {
  const photo = useRef(new Animated.Value(0)).current;
  const play = () => Animated.spring(photo, { toValue: 1, damping: 12, stiffness: 90, useNativeDriver: true }).start();
  return <Reveal from={index % 2 ? 'right' : 'left'} style={{ marginBottom: 18 }} onShow={play}>
    <View style={s.photoItem}>
      {!!member.role && <Text style={s.role}>{member.role}</Text>}
      <Animated.View style={{ opacity: photo, transform: [{ scale: photo.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }}>
        {member.has_photo
          ? <Image source={{ uri: `${API_URL}/about/photos/${member.id}/`, headers: { Authorization: `Token ${token}` } }} resizeMode="cover" style={s.photo} />
          : <View style={[s.photo, s.photoEmpty]}><MaterialCommunityIcons name="account" size={64} color="#9fb09a" /></View>}
      </Animated.View>
      <View style={s.memberInfo}>
        {!!member.full_name && <Text style={s.name}>{member.full_name}</Text>}
        {!!member.position && <Text style={s.position}>{member.position}</Text>}
      </View>
    </View>
  </Reveal>;
}

function Hero({ title, scrollY, reduceMotion }: { title: string; scrollY: Animated.Value; reduceMotion: boolean }) {
  const enter = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const text = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) return;
    Animated.spring(enter, { toValue: 1, damping: 9, stiffness: 80, useNativeDriver: true }).start();
    Animated.timing(text, { toValue: 1, duration: 700, delay: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, []);

  const parallax = {
    opacity: scrollY.interpolate({ inputRange: [0, 220], outputRange: [1, 0.15], extrapolate: 'clamp' }),
    transform: [
      { translateY: scrollY.interpolate({ inputRange: [-200, 0, 300], outputRange: [-60, 0, 120], extrapolate: 'clamp' }) },
      { scale: scrollY.interpolate({ inputRange: [-200, 0, 300], outputRange: [1.25, 1, 0.85], extrapolate: 'clamp' }) },
    ],
  };
  const ring = (offset: number) => {
    const v = Animated.modulo(Animated.add(pulse, offset), 1);
    return { opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }), transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.9] }) }] };
  };

  return <Animated.View style={[s.hero, parallax]}>
    <View style={s.logoWrap}>
      {!reduceMotion && <><Animated.View style={[s.ring, ring(0)]} /><Animated.View style={[s.ring, ring(0.5)]} /></>}
      <Animated.Image source={logoSource} resizeMode="contain" style={[s.logo, {
        opacity: enter.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
        transform: [
          { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
          { rotate: enter.interpolate({ inputRange: [0, 1], outputRange: ['-25deg', '0deg'] }) },
        ],
      }]} />
    </View>
    <Animated.Text style={[s.title, { opacity: text, transform: [{ translateY: text.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>{title}</Animated.Text>
    <Animated.Text style={[s.subtitle, { opacity: text, transform: [{ translateY: text.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }] }]}>{platformTitle}</Animated.Text>
  </Animated.View>;
}

export function AboutScreen({ token, onBack }: { token: string; onBack: () => void }) {
  const [about, setAbout] = useState<About | null>(null);
  const [error, setError] = useState('');
  const { height } = useWindowDimensions();
  const scrollY = useRef(new Animated.Value(0)).current;
  const offset = useRef(0);
  const reduceMotion = useRef(false);
  const [motionChecked, setMotionChecked] = useState(false);
  const subscribers = useRef(new Set<(offset: number) => void>()).current;
  const lastStart = useRef(0);
  const readyAt = useRef(Date.now() + 450);

  const ctx = useMemo<RevealCtx>(() => ({
    offset,
    height,
    reduceMotion,
    subscribe: fn => { subscribers.add(fn); return () => { subscribers.delete(fn); }; },
    nextDelay: () => {
      const now = Date.now();
      const start = Math.max(now, readyAt.current, lastStart.current + 110);
      lastStart.current = start;
      return start - now;
    },
  }), [height]);

  async function load() {
    setError('');
    try { setAbout(await api<About>('about', {}, token)); readyAt.current = Date.now() + 450; }
    catch (e) { setError(e instanceof Error ? e.message : 'Ката кетти.'); }
  }
  useEffect(() => { void load(); }, [token]);
  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(v => { reduceMotion.current = v; }).catch(() => {}).finally(() => setMotionChecked(true)); }, []);
  useEffect(() => { const listener = BackHandler.addEventListener('hardwareBackPress', () => { onBack(); return true; }); return () => listener.remove(); }, [onBack]);

  const onScroll = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
    useNativeDriver: true,
    listener: (e: NativeSyntheticEvent<NativeScrollEvent>) => { offset.current = e.nativeEvent.contentOffset.y; subscribers.forEach(fn => fn(offset.current)); },
  });

  return <RevealContext.Provider value={ctx}>
    <Animated.ScrollView style={s.root} contentContainerStyle={s.content} onScroll={onScroll} scrollEventThrottle={16}>
      <Pressable onPress={onBack} style={{ paddingVertical: 8, marginBottom: 8 }}><Text style={s.back}>← Башкы бет</Text></Pressable>
      {error ? <View style={{ gap: 12 }}><Text style={s.error}>{error}</Text><Pressable onPress={load}><Text style={s.back}>Кайра аракет кылуу</Text></Pressable></View>
        : !about || !motionChecked ? <ActivityIndicator color="#193f31" style={{ marginTop: 40 }} />
        : <>
          <Hero title={about.title} scrollY={scrollY} reduceMotion={reduceMotion.current} />

          <IntroCard title={about.title} />

          <Reveal><Card style={s.decreeCard}>
            <View style={s.decreeIcon}><MaterialCommunityIcons name="certificate-outline" size={24} color="#ffffff" /></View>
            <Text style={s.decreeText}>{decree.lead}<Text style={s.decreeStrong}>{decree.strong}</Text>{decree.rest}</Text>
          </Card></Reveal>

          <SectionHeader icon="target" title="Долбоордун максаты" />
          <Reveal><Card><Text style={s.body}>{goal}</Text></Card></Reveal>

          <SectionHeader icon="format-list-checks" title="Долбоордун милдеттери" />
          <TasksCard />

          <SectionHeader icon="view-grid-outline" title="Тиркеменин негизги бөлүмдөрү" />
          {sections.map((item, index) => <FeatureCard key={item.title} item={item} index={index} />)}

          <SectionHeader icon="shield-lock-outline" title="Коопсуздук" />
          <Reveal from="zoom"><Card><Text style={s.body}>{security}</Text></Card></Reveal>

          <SectionHeader icon="flag-checkered" title="Күтүлүүчү натыйжалар" />
          <Reveal from="zoom"><Card style={s.resultCard}><Text style={s.resultText}>{results}</Text></Card></Reveal>

          <Reveal from="zoom"><View style={s.teamDivider} /></Reveal>
          <Reveal><Text style={s.teamTitle}>{about.team_title}</Text></Reveal>
          {about.members.map((member, index) => <MemberCard key={member.id} member={member} index={index} token={token} />)}
        </>}
    </Animated.ScrollView>
  </RevealContext.Provider>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f1f4ef' },
  content: { padding: 20, paddingBottom: 48 },
  back: { color: '#193f31', fontWeight: '600' },
  error: { color: '#b3473e' },
  hero: { alignItems: 'center', gap: 10, marginBottom: 20, paddingHorizontal: 8 },
  logoWrap: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 120, height: 120, borderRadius: 60, borderWidth: 2, borderColor: '#2f8a5b', backgroundColor: 'rgba(47,138,91,0.08)' },
  logo: { width: 88, height: 100 },
  title: { color: '#193f31', fontSize: 28, fontWeight: '800', textAlign: 'center', letterSpacing: 0.5 },
  subtitle: { color: '#5d6e59', fontSize: 13, textAlign: 'center', lineHeight: 19 },
  card: { backgroundColor: '#ffffff', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#d8e1d3' },
  introCard: { backgroundColor: '#193f31', borderColor: '#193f31', overflow: 'hidden' },
  shimmer: { position: 'absolute', top: -60, bottom: -60, width: 70, backgroundColor: 'rgba(255,255,255,0.10)' },
  introText: { color: '#e8f0e4', fontSize: 15, lineHeight: 24 },
  introStrong: { color: '#ffffff', fontWeight: '800' },
  decreeCard: { marginTop: 16, flexDirection: 'row', gap: 14, alignItems: 'flex-start', backgroundColor: '#fbf4e2', borderColor: '#e6cf98', borderLeftWidth: 5, borderLeftColor: '#c08a2b' },
  decreeIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#c08a2b', alignItems: 'center', justifyContent: 'center' },
  decreeText: { flex: 1, color: '#3d3420', fontSize: 15, lineHeight: 23, fontWeight: '500' },
  decreeStrong: { color: '#193f31', fontWeight: '800' },
  body: { color: '#3d4f3a', fontSize: 15, lineHeight: 23 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 28, marginBottom: 12 },
  sectionHeaderIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#193f31', alignItems: 'center', justifyContent: 'center' },
  sectionHeaderText: { color: '#193f31', fontSize: 18, fontWeight: '800', flex: 1 },
  taskRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  featureCard: { gap: 10, overflow: 'hidden', paddingLeft: 22 },
  featureAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  featureTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  featureNumber: { color: '#7c8b78', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  featureTitle: { color: '#193f31', fontSize: 16, fontWeight: '700' },
  pointRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingLeft: 4 },
  dot: { width: 7, height: 7, borderRadius: 4, marginTop: 9 },
  resultCard: { backgroundColor: '#e6efe1', borderColor: '#c5d6bd' },
  resultText: { color: '#193f31', fontSize: 15, lineHeight: 23, fontWeight: '500' },
  teamDivider: { height: 1, backgroundColor: '#c5d6bd', marginTop: 36 },
  teamTitle: { color: '#193f31', fontSize: 18, fontWeight: '800', textAlign: 'center', marginTop: 24, marginBottom: 18, lineHeight: 25 },
  photoItem: { backgroundColor: '#ffffff', borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#d8e1d3', alignItems: 'center', paddingVertical: 18, paddingHorizontal: 16 },
  role: { color: '#193f31', fontSize: 14, fontWeight: '800', textAlign: 'center', letterSpacing: 0.5, marginBottom: 14, textTransform: 'uppercase' },
  photo: { width: 180, height: 220, borderRadius: 14, backgroundColor: '#e3ebdc' },
  photoEmpty: { alignItems: 'center', justifyContent: 'center' },
  memberInfo: { marginTop: 14, gap: 6, alignItems: 'center' },
  name: { color: '#193f31', fontSize: 17, fontWeight: '700', textAlign: 'center' },
  position: { color: '#3d4f3a', fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
