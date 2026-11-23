import { Pressable, ScrollView, Text, View } from 'react-native';
import { Quiz } from './types';
import { s } from './styles';

const noticeParagraphs = [
  'Командирдик даярдоо боюнча тест тапшыруу учурунда ChatGPT, Google жана башка тиркемелерге өтүп кеткен учурда, кайра тестирлөө платформасына кайтып келгенде тесттин суроолору автоматтык түрдө алмаштырылат.',
  'Эгерде башка тиркемелерге өтүү аракети кайра кайталанса, тестирлөө автоматтык түрдө токтотулат (жабылат). Ошол учурда канча суроого жооп берилген болсо, тестирлөөнүн жыйынтыгы боюнча баа автоматтык түрдө командирдик даярдоо боюнча ведомостко түшүрүлөт.',
  'Ар бир суроого жооп берүү үчүн белгиленген убакыт чектелүү болгондуктан, тестти өз алдынча, башка тиркемелерге өтпөстөн жана белгиленген убакыттын ичинде тапшыруу талап кылынат.',
];

export function QuizNotice({ quiz, onBack, onStart }: { quiz: Quiz; onBack: () => void; onStart: () => void }) {
  return <ScrollView style={s.root} contentContainerStyle={s.content}>
    <Pressable accessibilityRole="button" onPress={onBack} style={s.secondary}><Text style={s.link}>← Артка</Text></Pressable>
    <View style={s.card}>
      <Text accessibilityRole="header" style={[s.title, { color: '#a04435' }]}>ЭСКЕРТҮҮ! КОМАНДИРДИК ДАЯРДОО БОЮНЧА ТЕСТИРЛӨӨ ТАРТИБИ</Text>
      {noticeParagraphs.map(paragraph => <Text key={paragraph} style={s.body}>{paragraph}</Text>)}
    </View>
    <Text style={s.heading}>{quiz.title}</Text>
    <Text style={s.hint}>{quiz.question_count} суроо · {Math.ceil(quiz.duration_seconds / 60)} мүнөт</Text>
    <Pressable accessibilityRole="button" onPress={onStart} style={s.button}><Text style={[s.white, { textAlign: 'center' }]}>Түшүндүм, тестти баштоо</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={onBack} style={s.secondary}><Text style={s.link}>Жокко чыгаруу</Text></Pressable>
  </ScrollView>;
}
