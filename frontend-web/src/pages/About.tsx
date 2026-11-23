import { CSSProperties, MouseEvent, ReactNode, RefObject, useEffect, useRef, useState } from 'react';
import { api, API_URL } from '../api';
import { navigate } from '../router';
import { AnimatedBackground, appName, platformTitle } from './Landing';
import './about.css';

type Member = { id: number; role: string; full_name: string; position: string; has_photo: boolean };
type AboutData = { title: string; team_title: string; members: Member[] };

// Material Design иконкалары (SVG жолдору).
const icons = {
  back: 'M20,11V13H8L13.5,18.5L12.08,19.92L4.16,12L12.08,4.08L13.5,5.5L8,11H20Z',
  target: 'M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M12,6A6,6 0 0,0 6,12A6,6 0 0,0 12,18A6,6 0 0,0 18,12A6,6 0 0,0 12,6M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8M12,10A2,2 0 0,0 10,12A2,2 0 0,0 12,14A2,2 0 0,0 14,12A2,2 0 0,0 12,10Z',
  list: 'M3,5H9V11H3V5M5,7V9H7V7H5M11,7H21V9H11V7M11,15H21V17H11V15M5,20L1.5,16.5L2.91,15.09L5,17.17L9.59,12.59L11,14L5,20Z',
  grid: 'M3,11H11V3H3M3,21H11V13H3M13,21H21V13H13M13,3V11H21V3',
  shield: 'M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M12,7C13.4,7 14.8,8.1 14.8,9.5V11C15.4,11 16,11.6 16,12.3V15.8C16,16.4 15.4,17 14.7,17H9.2C8.6,17 8,16.4 8,15.7V12.2C8,11.6 8.6,11 9.2,11V9.5C9.2,8.1 10.6,7 12,7M12,8.2C11.2,8.2 10.5,8.7 10.5,9.5V11H13.5V9.5C13.5,8.7 12.8,8.2 12,8.2Z',
  flag: 'M14.4,6L14,4H5V21H7V14H12.6L13,16H20V6H14.4Z',
  check: 'M12 2C6.5 2 2 6.5 2 12S6.5 22 12 22 22 17.5 22 12 17.5 2 12 2M10 17L5 12L6.41 10.59L10 14.17L17.59 6.58L19 8L10 17Z',
  star: 'M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.45,13.97L5.82,21L12,17.27Z',
  run: 'M13.5,5.5C14.59,5.5 15.5,4.58 15.5,3.5C15.5,2.38 14.59,1.5 13.5,1.5C12.39,1.5 11.5,2.38 11.5,3.5C11.5,4.58 12.39,5.5 13.5,5.5M9.89,19.38L10.89,15L13,17V23H15V15.5L12.89,13.5L13.5,10.5C14.79,12 16.79,13 19,13V11C17.09,11 15.5,10 14.69,8.58L13.69,7C13.29,6.38 12.69,6 12,6C11.69,6 11.5,6.08 11.19,6.08L6,8.28V13H8V9.58L9.79,8.88L8.19,17L3.29,16L2.89,18L9.89,19.38Z',
  book: 'M12,21.5C10.65,20.65 8.2,20 6.5,20C4.85,20 3.15,20.3 1.75,21.05C1.65,21.1 1.6,21.1 1.5,21.1C1.25,21.1 1,20.85 1,20.6V6C1.6,5.55 2.25,5.25 3,5C4.11,4.65 5.33,4.5 6.5,4.5C8.45,4.5 10.55,4.9 12,6C13.45,4.9 15.55,4.5 17.5,4.5C18.67,4.5 19.89,4.65 21,5C21.75,5.25 22.4,5.55 23,6V20.6C23,20.85 22.75,21.1 22.5,21.1C22.4,21.1 22.35,21.1 22.25,21.05C20.85,20.3 19.15,20 17.5,20C15.8,20 13.35,20.65 12,21.5M12,8V19.5C13.35,18.65 15.8,18 17.5,18C18.7,18 19.9,18.15 21,18.5V7C19.9,6.65 18.7,6.5 17.5,6.5C15.8,6.5 13.35,7.15 12,8Z',
  clipboard: 'M19,3H14.82C14.4,1.84 13.3,1 12,1C10.7,1 9.6,1.84 9.18,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5A2,2 0 0,0 19,3M12,3A1,1 0 0,1 13,4A1,1 0 0,1 12,5A1,1 0 0,1 11,4A1,1 0 0,1 12,3M10,17L6,13L7.41,11.59L10,14.17L16.59,7.58L18,9L10,17Z',
  medical: 'M10,3H14V10H21V14H14V21H10V14H3V10H10V3Z',
  tune: 'M3,17V19H9V17H3M3,5V7H13V5H3M13,21V19H21V17H13V15H11V21H13M7,9V11H3V13H7V15H9V9H7M21,13V11H11V13H21M15,9H17V7H21V5H17V3H15V9Z',
  certificate: 'M13,21L15,20L17,21V14H13M17,9V7L15,8L13,7V9L11,10L13,11V13L15,12L17,13V11L19,10M20,3A1,1 0 0,1 21,4V16A1,1 0 0,1 20,17H19V15H19V5H5V15H11V17H4A1,1 0 0,1 3,16V4A1,1 0 0,1 4,3H20M11,8H5V6H11V8M9,11H5V9H9V11M11,14H5V12H11V14Z',
  account: 'M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z',
};
type IconName = keyof typeof icons;

function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true"><path fill="currentColor" d={icons[name]} /></svg>;
}

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
  { icon: 'star', color: '#193f31', title: 'Командирдик даярдоо', text: 'Офицерлер, прапорщиктер жана сержанттар үчүн өзүнчө окуу материалдары жана тесттер. Тесттер кызматкердин билимин калыс баалоо үчүн коргоо тутуму менен жабдылган.' },
  { icon: 'run', color: '#2f8a5b', title: 'Дене-тарбия даярдыгы', text: 'Кызматкер өзүнүн анатомиялык маалыматтарын (бою, салмагы, жашы ж.б.) толтурат. Ошол маалыматтардын негизинде тиркеме:', points: ['жашына жана көрсөткүчтөрүнө жараша түзөтүүлөрдү (поправка) эсептейт', 'жеке машыгуу планын түзөт', 'туура тамактануу боюнча диета сунуштайт'] },
  { icon: 'book', color: '#3a6ea5', title: 'Окуу курстары', text: 'Кесиптик билимди тереңдетүү үчүн курстар. Курсту ийгиликтүү аяктаган кызматкерлердин тизмеси автоматтык түрдө түзүлөт.' },
  { icon: 'clipboard', color: '#c08a2b', title: 'Тесттердин жыйынтыгы', text: 'Ар бир кызматкер өзүнүн бардык тесттеринин жыйынтыктарын көрүп, жетишкендиктерин жана өнүктүрүүчү жактарын байкай алат.' },
  { icon: 'medical', color: '#b3473e', title: 'Дарыгер', text: 'Кызматкерлер медициналык кызматкер менен түздөн-түз байланышып, ден соолук жана машыгуу боюнча кеңеш ала алышат.' },
  { icon: 'tune', color: '#5b5f97', title: 'Башкаруу панели', text: 'Жооптуу адамдар катталуу өтүнүчтөрүн карап чыгат, тесттерди жана курстарды түзөт, натыйжаларды талдайт.' },
];

const security = 'Тиркемеге кирүү администратор тарабынан ырасталгандан кийин гана мүмкүн. Ар бир колдонуучу өзүнүн жеке окуу номери менен катталат. Бул кызматтык маалыматтын корголушун камсыз кылат.';

const results = 'платформасын колдонуу кызматкерлердин кесиптик жана дене-тарбия даярдыгынын деңгээлин жогорулатууга, окуу процессин ачык-айкын жана натыйжалуу кылууга, ошондой эле Мамлекеттик чек ара кызматында санариптик трансформацияны ишке ашырууга салым кошот.';

const vars = (v: Record<string, string | number>) => v as CSSProperties;

/** Элемент экранга киргенде `is-in` классын кошот. */
function useReveal(deps: unknown[]) {
  useEffect(() => {
    const items = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]:not(.is-in)'));
    if (!('IntersectionObserver' in window)) { items.forEach(el => el.classList.add('is-in')); return; }
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('is-in'); observer.unobserve(entry.target); }
    }), { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    items.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, deps);
}

/** Скролл абалын CSS өзгөрмөлөрүнө жазат (параллакс жана прогресс тилкеси үчүн). */
function useScrollVars(ref: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = ref.current; if (!el) return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      el.style.setProperty('--sy', String(window.scrollY));
      el.style.setProperty('--progress', String(max > 0 ? window.scrollY / max : 0));
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(frame); };
  }, [ref]);
}

/** Чычкандын артынан 3D бурулуп, жарык так жылган карточка. */
function TiltCard({ children, className = '', style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget; const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width; const y = (e.clientY - r.top) / r.height;
    el.style.setProperty('--mx', `${x * 100}%`); el.style.setProperty('--my', `${y * 100}%`);
    el.style.setProperty('--rx', `${(0.5 - y) * 10}deg`); el.style.setProperty('--ry', `${(x - 0.5) * 12}deg`);
  };
  const onLeave = (e: MouseEvent<HTMLDivElement>) => { e.currentTarget.style.setProperty('--rx', '0deg'); e.currentTarget.style.setProperty('--ry', '0deg'); };
  return <div className={`ab-tilt ${className}`} style={style} onMouseMove={onMove} onMouseLeave={onLeave}>{children}</div>;
}

function SectionTitle({ icon, title, kicker }: { icon: IconName; title: string; kicker: string }) {
  return <div className="ab-section-title" data-reveal>
    <span className="ab-section-icon"><Icon name={icon} /></span>
    <div><small>{kicker}</small><h2>{title}</h2></div>
  </div>;
}

function MemberPhoto({ member }: { member: Member }) {
  const [loaded, setLoaded] = useState(false);
  return <div className="ab-photo-ring">
    <div className={`ab-photo ${loaded ? 'is-loaded' : ''}`}>
      {member.has_photo
        ? <img src={`${API_URL}/about/photos/${member.id}/`} alt={member.full_name} onLoad={() => setLoaded(true)} />
        : <span className="ab-photo-empty"><Icon name="account" size={72} /></span>}
    </div>
  </div>;
}

export function About() {
  const root = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<AboutData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => { window.scrollTo(0, 0); }, []);
  useEffect(() => {
    let active = true;
    api<AboutData>('about').then(d => { if (active) setData(d); }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'Ката кетти.'); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') navigate('home'); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useScrollVars(root);
  useReveal([data]);

  const title = data?.title || appName;

  return <div className="ab" ref={root}>
    <div className="ab-progress" />
    <div className="ab-bg"><AnimatedBackground /></div>

    <header className="ab-topbar">
      <button className="ab-back" onClick={() => navigate('home')}><Icon name="back" size={18} /><span>Башкы бет</span></button>
      <div className="brand"><img src="/logo.webp" alt="" /><span>{appName}</span></div>
    </header>

    <section className="ab-hero">
      <div className="ab-hero-inner">
        <div className="ab-orbit">
          <span className="ring ring-1" /><span className="ring ring-2" /><span className="ring ring-3" />
          <span className="ab-orbit-spin" />
          <span className="ab-orbit-dots"><i /><i /><i /></span>
          <img src="/logo.webp" alt="Чек ара кызматынын логотиби" />
        </div>
        <h1 className="ab-title" aria-label={title}>
          {Array.from(title).map((ch, i) => <span key={i} style={vars({ '--i': i })} aria-hidden="true">{ch === ' ' ? ' ' : ch}</span>)}
        </h1>
        <p className="ab-hero-sub">{platformTitle}</p>
        <div className="ab-scroll-cue" aria-hidden="true"><span /></div>
      </div>
    </section>

    <main className="ab-main">
      <div className="ab-intro" data-reveal onMouseMove={e => {
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`); e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
      }}>
        <span className="ab-intro-glow" />
        <span className="ab-intro-shine" />
        <p><strong>{title}</strong> — {intro}</p>
      </div>

      <div className="ab-decree" data-reveal>
        <span className="ab-decree-icon"><Icon name="certificate" size={30} /></span>
        <p>{decree.lead}<strong>{decree.strong}</strong>{decree.rest}</p>
      </div>

      <SectionTitle icon="target" kicker="01" title="Долбоордун максаты" />
      <div className="ab-card ab-quote" data-reveal>
        <span className="ab-quote-mark">“</span>
        <p>{goal}</p>
      </div>

      <SectionTitle icon="list" kicker="02" title="Долбоордун милдеттери" />
      <ol className="ab-timeline" data-reveal>
        {tasks.map((task, i) => <li key={task} style={vars({ '--d': `${0.15 + i * 0.12}s` })}>
          <span className="ab-timeline-check"><Icon name="check" size={22} /></span>
          <span>{task}</span>
        </li>)}
      </ol>

      <SectionTitle icon="grid" kicker="03" title="Тиркеменин негизги бөлүмдөрү" />
      <div className="ab-features">
        {sections.map((item, i) => <div key={item.title} className="ab-feature-wrap" data-reveal style={vars({ '--d': `${(i % 3) * 0.1}s`, '--c': item.color })}>
          <TiltCard className="ab-feature">
            <span className="ab-feature-num">{String(i + 1).padStart(2, '0')}</span>
            <span className="ab-feature-icon"><Icon name={item.icon} size={26} /></span>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
            {item.points && <ul>{item.points.map(p => <li key={p}>{p}</li>)}</ul>}
          </TiltCard>
        </div>)}
      </div>

      <div className="ab-split">
        <div>
          <SectionTitle icon="shield" kicker="04" title="Коопсуздук" />
          <div className="ab-card ab-security" data-reveal>
            <span className="ab-security-icon"><Icon name="shield" size={40} /></span>
            <p>{security}</p>
          </div>
        </div>
        <div>
          <SectionTitle icon="flag" kicker="05" title="Күтүлүүчү натыйжалар" />
          <div className="ab-card ab-results" data-reveal>
            <p><strong>«{title}»</strong> {results}</p>
          </div>
        </div>
      </div>

      <section className="ab-team">
        <div className="ab-team-head" data-reveal>
          <span className="ab-team-line" />
          <h2>{data?.team_title || 'Күжүрмөн даярдоону санариптештирүү боюнча долбоордук топтун курамы'}</h2>
          <span className="ab-team-line" />
        </div>
        {error && <p className="ab-error">{error}</p>}
        {!data && !error && <div className="ab-team-loading"><div className="spinner" /></div>}
        {data && <div className="ab-members">
          {data.members.map((m, i) => <div key={m.id} className="ab-member-wrap" data-reveal style={vars({ '--d': `${i * 0.18}s` })}>
            <div className="ab-member">
              {!!m.role && <div className="ab-member-role">{m.role}</div>}
              <MemberPhoto member={m} />
              {!!m.full_name && <div className="ab-member-name">{m.full_name}</div>}
              {!!m.position && <div className="ab-member-pos">{m.position}</div>}
            </div>
          </div>)}
        </div>}
      </section>
    </main>

    <footer className="footer">© {new Date().getFullYear()} {appName}</footer>
  </div>;
}
