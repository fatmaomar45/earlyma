// Placeholder rules. Replace with the current Ministry of Health schedule
// and the Mother and Child Health booklet before any real use.
export const SCHEDULE_NOTE =
  'Prototype with placeholder schedule and draft Swahili. Use sample data only. Client data is kept in this browser and is not secure. Nothing is really sent.'

export const RULES = {
  baby: [
    { en: 'Birth visit', sw: 'Kuzaliwa', days: 0 },
    { en: '6 weeks', sw: 'Wiki 6', days: 42 },
    { en: '10 weeks', sw: 'Wiki 10', days: 70 },
    { en: '14 weeks', sw: 'Wiki 14', days: 98 },
    { en: '9 months', sw: 'Miezi 9', months: 9 },
    { en: '18 months', sw: 'Miezi 18', months: 18 },
  ],
  preg: [12, 20, 26, 30, 34, 36, 38, 40].map((w, i) => ({
    en: `Antenatal visit ${i + 1} (week ${w})`,
    sw: `Kliniki ya wajawazito ${i + 1} (wiki ${w})`,
    week: w,
  })),
}

// Draft SMS text. {date} is filled in automatically. Have a native Swahili speaker check it.
export const SMS = {
  sw: {
    baby: {
      remind: 'Habari mama. Siku ya kliniki ya mtoto wako ni {date}. Tafadhali mlete mtoto na kadi yake ya kliniki. Jibu NDIO kama utaenda.',
      missed: 'Habari mama. Mtoto wako alikosa kliniki ya {date}. Bado unaweza kumpeleka sasa. Tafadhali nenda wiki hii. Jibu NDIO kama utaenda.',
    },
    preg: {
      remind: 'Habari mama. Siku yako ya kliniki ya wajawazito ni {date}. Tafadhali kuja na kitabu chako cha afya ya mama na mtoto. Jibu NDIO kama utaenda.',
      missed: 'Habari mama. Ulikosa kliniki ya {date}. Bado unaweza kwenda sasa. Tafadhali nenda wiki hii. Jibu NDIO kama utaenda.',
    },
  },
  en: {
    baby: {
      remind: 'Hello mama. Your baby\'s clinic day is {date}. Please bring your baby and the clinic card. Reply YES if you will go.',
      missed: 'Hello mama. Your baby missed the clinic visit on {date}. You can still go now. Please go this week. Reply YES if you will go.',
    },
    preg: {
      remind: 'Hello mama. Your antenatal clinic day is {date}. Please bring your mother and child health booklet. Reply YES if you will go.',
      missed: 'Hello mama. You missed the clinic visit on {date}. You can still go now. Please go this week. Reply YES if you will go.',
    },
  },
}

export const OUTCOMES = [
  'Vaccinated or attended elsewhere',
  'Moved away',
  'Child unwell',
  'Refused',
  'Not found at home',
  'Home visit done, will attend',
]
