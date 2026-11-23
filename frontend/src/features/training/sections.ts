export const trainingSections = [
  {
    id: 'command', title: 'Командирдик даярдоо', symbol: '★',
    description: 'Даярдоо бөлүмүн тандаңыз.',
    categories: [
      { id: 'officers', title: 'Офицерлер' },
      { id: 'warrant-sergeants', title: 'Прапорщиктер жана сержанттар' },
    ],
  },
  {
    id: 'physical', title: 'Дене-тарбия даярдыгы', symbol: '↗',
    description: 'Дене-тарбия даярдыгы боюнча бөлүмдү тандаңыз.',
    categories: [
      { id: 'personal-info', title: 'Өзүң жөнүндө анатомиялык маалыматты толтур', children: [
        { id: 'correction', title: 'Түзөтүү (Поправка)' },
        { id: 'personal-plan', title: 'Жеке машыгуу планы' },
        { id: 'diet', title: 'Диета' },
      ] },
    ],
  },
  {
    id: 'courses', title: 'Окуу курстары', symbol: '▥',
    description: '',
    categories: [],
  },
] as const;
export type SectionId = 'home' | typeof trainingSections[number]['id'];
