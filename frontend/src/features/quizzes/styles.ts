import { StyleSheet } from 'react-native';
export const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f1f4ef' }, content: { padding: 24, gap: 18, paddingBottom: 40 },
  title: { color: '#193f31', fontSize: 25, fontWeight: '700', lineHeight: 33 },
  heading: { color: '#193f31', fontSize: 18, fontWeight: '700', lineHeight: 26 },
  body: { color: '#334b3c', fontSize: 16, lineHeight: 25 }, hint: { color: '#647560', lineHeight: 21, fontSize: 13 },
  card: { backgroundColor: 'white', borderWidth: 1, borderColor: '#d8e1d3', borderRadius: 16, padding: 18, gap: 14 },
  input: { borderWidth: 1, borderColor: '#d8e1d3', borderRadius: 10, padding: 14, fontSize: 16, color: '#193f31', backgroundColor: 'white' },
  multiline: { minHeight: 100, textAlignVertical: 'top' }, row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  button: { minHeight: 48, justifyContent: 'center', alignItems: 'center', padding: 14, borderRadius: 12, backgroundColor: '#193f31' },
  white: { color: 'white', fontWeight: '700' }, secondary: { minHeight: 48, justifyContent: 'center', padding: 10 },
  link: { color: '#193f31', fontWeight: '600', lineHeight: 23 }, error: { color: '#a04435', lineHeight: 23 },
  option: { padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#cbd6c5', backgroundColor: 'white', flexDirection: 'row', gap: 12 },
  selected: { borderColor: '#193f31', backgroundColor: '#e3ebdc' }, disabled: { opacity: 0.5 },
  modules: { flexDirection: 'row', backgroundColor: '#e3ebdc', borderRadius: 12, padding: 4, gap: 4 }, moduleTab: { flex: 1, minHeight: 42, borderRadius: 9, alignItems: 'center', justifyContent: 'center' }, moduleTabActive: { backgroundColor: 'white' }, moduleText: { color: '#647560', fontWeight: '700' }, moduleTextActive: { color: '#193f31' },
  score: { color: '#193f31', fontSize: 44, fontWeight: '800' }, timer: { color: '#193f31', fontSize: 22, fontWeight: '700' },
});
