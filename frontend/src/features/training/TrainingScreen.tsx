import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DietScreen } from '../diet/DietScreen';
import { PersonalPlanScreen } from './PersonalPlanScreen';
import { CorrectionScreen } from './CorrectionScreen';
import { trainingSections } from './sections';

export function TrainingScreen({ section, categoryId, onCategory, onBack, token }: {
  token: string; section: typeof trainingSections[number]; categoryId: string | null;
  onCategory: (id: string) => void; onBack: () => void;
}) {
  const [parentId, childId] = categoryId?.split('/') ?? [];
  const parent = section.categories.find(item => item.id === parentId);
  const category = childId && parent && 'children' in parent ? parent.children.find(item => item.id === childId) : parent;
  const options = category && 'children' in category ? category.children : category ? [] : section.categories;
  function back() { if (childId && parentId) onCategory(parentId); else onBack(); }
  return <View>
    <Pressable accessibilityRole="button" onPress={back} style={s.back}><Text style={s.backText}>← {category ? section.title : 'Башкы бет'}</Text></Pressable>
    <Text style={s.eyebrow}>{category ? section.title : 'ДАЯРДОО'}</Text>
    <Text accessibilityRole="header" style={s.title}>{category?.title ?? section.title}</Text>
    {section.categories.length === 0 ? null : category && options.length === 0 ? category.id === 'diet' ? <DietScreen token={token} /> : category.id === 'correction' ? <CorrectionScreen token={token} /> : category.id === 'personal-plan' ? <PersonalPlanScreen token={token} /> : <View style={s.empty}><Text style={s.emptyTitle}>Материалдар азырынча жок</Text><Text style={s.description}>Бул бөлүмгө материалдар кошулганда, алар ушул жерде көрсөтүлөт.</Text></View> : <>
      <Text style={s.description}>{section.description}</Text>
      <View style={s.cards}>{options.map((item, index) => <Pressable accessibilityRole="button" accessibilityLabel={item.title} onPress={() => onCategory(parent ? `${parentId}/${item.id}` : item.id)} key={item.id} style={({ pressed }) => [s.card, pressed && s.pressed]}><View style={s.number}><Text style={s.numberText}>{String(index + 1).padStart(2, '0')}</Text></View><Text style={s.cardTitle}>{item.title}</Text><Text style={s.arrow}>→</Text></Pressable>)}</View>
    </>}
  </View>;
}
const s = StyleSheet.create({ back: { minHeight: 44, justifyContent: 'center', marginBottom: 16 }, backText: { color: '#39533e', fontSize: 14, fontWeight: '600' }, eyebrow: { color: '#647560', fontSize: 11, letterSpacing: 1, lineHeight: 18 }, title: { color: '#193f31', fontSize: 27, fontWeight: '700', marginTop: 10, marginBottom: 14 }, description: { color: '#5f705b', fontSize: 14, lineHeight: 22 }, cards: { gap: 14, marginTop: 24 }, card: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#ffffff', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#d8e1d3', minHeight: 90 }, pressed: { backgroundColor: '#e7eedf' }, number: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#e3ebdc', alignItems: 'center', justifyContent: 'center' }, numberText: { color: '#75622e', fontWeight: '700' }, cardTitle: { color: '#193f31', fontWeight: '600', fontSize: 16, flex: 1, lineHeight: 23 }, arrow: { color: '#806c32', fontSize: 23 }, empty: { padding: 24, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d8e1d3', borderRadius: 18, marginTop: 14 }, emptyTitle: { color: '#193f31', fontWeight: '600', fontSize: 17, marginBottom: 10 } });
