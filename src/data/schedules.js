// Configurable visit schedules and message templates.
//
// IMPORTANT CLINICAL SAFETY NOTE
// ------------------------------
// These schedules are *configuration*, not clinical advice. They are based on
// publicly documented WHO guidance and common Mother and Child Health booklet
// patterns. A deploying organisation MUST review them against the current
// national Ministry of Health guidance and replace/confirm the values before
// using the system with real clients.
//
// Sources used for the defaults:
// - WHO 2016 ANC recommendations: 8 antenatal contacts (weeks 12, 20, 26,
//   30, 34, 36, 38 and 40).
// - WHO postnatal care guidance: contacts within 24 hours, day 3, days 7-14
//   and week 6 (represented here as days 0, 3, 7 and 42 to avoid ambiguity).
// - WHO/UNICEF routine immunisation guidance and typical MCH booklet visits:
//   birth, 6 weeks, 10 weeks, 14 weeks, 9 months and 18 months. The exact
//   antigens used in a country programme are configured by the health team.
// - Growth monitoring contacts at birth, 1, 3, 6, 9, 12 and 18 months.

export const SCHEDULE_VERSION = '2026.1'

export const SCHEDULE_SOURCES = {
  anc: {
    title: { en: 'WHO ANC contacts (2016)', sw: 'Mikutano ya kliniki ya wajawazito (WHO 2016)' },
    url: 'https://www.who.int/publications/i/item/9789241549912',
  },
  pnc: {
    title: { en: 'WHO postnatal care contacts', sw: 'Mikutano ya baada ya kujifungua (WHO)' },
    url: 'https://www.who.int/publications/i/item/9789241550406',
  },
  immunization: {
    title: { en: 'WHO/UNICEF routine immunisation guidance', sw: 'Mwongozo wa chanjo (WHO/UNICEF)' },
    url: 'https://www.who.int/teams/immunization-vaccines-and-biologicals',
  },
  growth: {
    title: { en: 'WHO child growth standards and monitoring', sw: 'Viwango vya ukuaji wa mtoto (WHO)' },
    url: 'https://www.who.int/tools/child-growth-standards',
  },
}

export const VISIT_CATEGORIES = {
  anc: { en: 'Antenatal care', sw: 'Huduma kabla ya kujifungua', color: 'teal' },
  pnc: { en: 'Postnatal care', sw: 'Huduma baada ya kujifungua', color: 'blue' },
  immunization: { en: 'Immunization', sw: 'Chanjo', color: 'grape' },
  growth: { en: 'Growth monitoring', sw: 'Ufuatiliaji wa ukuaji', color: 'orange' },
  child_health: { en: 'Child health', sw: 'Afya ya mtoto', color: 'cyan' },
}

const ancWeeks = [12, 20, 26, 30, 34, 36, 38, 40]

export const SCHEDULES = {
  anc: {
    id: 'anc',
    clientType: 'mother',
    category: 'anc',
    anchor: 'expectedDeliveryDate',
    source: SCHEDULE_SOURCES.anc,
    visits: ancWeeks.map((week, index) => ({
      id: `anc-${week}`,
      name: {
        en: `Antenatal contact ${index + 1} (week ${week})`,
        sw: `Kliniki ya wajawazito ${index + 1} (wiki ${week})`,
      },
      category: 'anc',
      offset: { weeks: week - 40 },
      followUpRequired: true,
    })),
  },

  pnc: {
    id: 'pnc',
    clientType: 'mother',
    category: 'pnc',
    anchor: 'deliveryDate',
    source: SCHEDULE_SOURCES.pnc,
    visits: [
      { id: 'pnc-0', name: { en: 'Postnatal contact within 24 hours', sw: 'Kliniki ya baada ya kujifungua saa 24' }, offset: { days: 0 }, followUpRequired: true },
      { id: 'pnc-3', name: { en: 'Postnatal contact day 3', sw: 'Kliniki ya baada ya kujifungua siku 3' }, offset: { days: 3 }, followUpRequired: true },
      { id: 'pnc-7', name: { en: 'Postnatal contact day 7', sw: 'Kliniki ya baada ya kujifungua siku 7' }, offset: { days: 7 }, followUpRequired: true },
      { id: 'pnc-42', name: { en: 'Postnatal contact week 6', sw: 'Kliniki ya baada ya kujifungua wiki 6' }, offset: { days: 42 }, followUpRequired: true },
    ],
  },

  babyImmunization: {
    id: 'babyImmunization',
    clientType: 'baby',
    category: 'immunization',
    anchor: 'dateOfBirth',
    source: SCHEDULE_SOURCES.immunization,
    visits: [
      { id: 'epi-birth', name: { en: 'Birth immunizations (BCG, OPV0)', sw: 'Chanjo za kuzaliwa (BCG, OPV0)' }, offset: { days: 0 }, followUpRequired: true },
      { id: 'epi-6w', name: { en: '6-week immunizations', sw: 'Chanjo za wiki 6' }, offset: { weeks: 6 }, followUpRequired: true },
      { id: 'epi-10w', name: { en: '10-week immunizations', sw: 'Chanjo za wiki 10' }, offset: { weeks: 10 }, followUpRequired: true },
      { id: 'epi-14w', name: { en: '14-week immunizations', sw: 'Chanjo za wiki 14' }, offset: { weeks: 14 }, followUpRequired: true },
      { id: 'epi-9m', name: { en: '9-month immunizations (measles-rubella 1)', sw: 'Chanjo za miezi 9 (surua-rubella 1)' }, offset: { months: 9 }, followUpRequired: true },
      { id: 'epi-18m', name: { en: '18-month immunizations (measles-rubella 2)', sw: 'Chanjo za miezi 18 (surua-rubella 2)' }, offset: { months: 18 }, followUpRequired: true },
    ],
  },

  babyGrowth: {
    id: 'babyGrowth',
    clientType: 'baby',
    category: 'growth',
    anchor: 'dateOfBirth',
    source: SCHEDULE_SOURCES.growth,
    visits: [
      { id: 'growth-birth', name: { en: 'Birth growth check', sw: 'Kipimo cha ukuaji cha kuzaliwa' }, offset: { days: 0 }, followUpRequired: false },
      { id: 'growth-1m', name: { en: 'Growth check 1 month', sw: 'Kipimo cha ukuaji mwezi 1' }, offset: { months: 1 }, followUpRequired: false },
      { id: 'growth-3m', name: { en: 'Growth check 3 months', sw: 'Kipimo cha ukuaji miezi 3' }, offset: { months: 3 }, followUpRequired: false },
      { id: 'growth-6m', name: { en: 'Growth check 6 months', sw: 'Kipimo cha ukuaji miezi 6' }, offset: { months: 6 }, followUpRequired: false },
      { id: 'growth-9m', name: { en: 'Growth check 9 months', sw: 'Kipimo cha ukuaji miezi 9' }, offset: { months: 9 }, followUpRequired: false },
      { id: 'growth-12m', name: { en: 'Growth check 12 months', sw: 'Kipimo cha ukuaji miezi 12' }, offset: { months: 12 }, followUpRequired: false },
      { id: 'growth-18m', name: { en: 'Growth check 18 months', sw: 'Kipimo cha ukuaji miezi 18' }, offset: { months: 18 }, followUpRequired: false },
    ],
  },
}

// Compatibility export for the original prototype tests and any older code.
// New code should use SCHEDULES directly.
export const RULES = {
  baby: SCHEDULES.babyImmunization.visits.map((visit, index) => ({
    // The first entry keeps the original prototype wording for backwards
    // compatibility with older code and tests.
    en: index === 0 ? 'Birth visit' : visit.name.en,
    sw: index === 0 ? 'Kuzaliwa' : visit.name.sw,
    ...(visit.offset.days !== undefined ? { days: visit.offset.days } : {}),
    ...(visit.offset.months !== undefined ? { months: visit.offset.months } : {}),
    ...(visit.offset.weeks !== undefined ? { days: visit.offset.weeks * 7 } : {}),
  })),
  preg: SCHEDULES.anc.visits.map((visit) => ({
    en: visit.name.en,
    sw: visit.name.sw,
    week: 40 + visit.offset.weeks,
  })),
}

export const SCHEDULE_NOTE =
  'Visit schedules are configurable defaults based on WHO guidance. They are not a substitute for the current national Ministry of Health schedule. Review src/data/schedules.js before using this app with real clients.'

// Draft SMS copy. Have a native Swahili speaker review before production use.
// {date}, {name}, {village} and {visit} are filled automatically.
export const SMS = {
  sw: {
    baby: {
      remind: 'Habari mama. Siku ya kliniki ya mtoto wako ni {date}. Tafadhali mlete mtoto na kadi yake ya kliniki. Jibu NDIO kama utaenda.',
      missed: 'Habari mama. Mtoto wako alikosa kliniki ya {date}. Bado unaweza kumpeleka sasa. Tafadhali nenda wiki hii. Jibu NDIO kama utaenda.',
      followUp: 'Habari mama. Tunakukumbusha kuhusu {visit} ya mtoto wako tarehe {date}. Tafadhali jibu NDIO kama utaenda.',
    },
    preg: {
      remind: 'Habari mama. Siku yako ya kliniki ya wajawazito ni {date}. Tafadhali kuja na kitabu chako cha afya ya mama na mtoto. Jibu NDIO kama utaenda.',
      missed: 'Habari mama. Ulikosa kliniki ya {date}. Bado unaweza kwenda sasa. Tafadhali nenda wiki hii. Jibu NDIO kama utaenda.',
      followUp: 'Habari mama. Tunakukumbusha kuhusu {visit} tarehe {date}. Tafadhali jibu NDIO kama utaenda.',
    },
  },
  en: {
    baby: {
      remind: "Hello mama. Your baby's clinic day is {date}. Please bring your baby and the clinic card. Reply YES if you will go.",
      missed: 'Hello mama. Your baby missed the clinic visit on {date}. You can still go now. Please go this week. Reply YES if you will go.',
      followUp: 'Hello mama. This is a reminder about the {visit} for your baby on {date}. Reply YES if you will go.',
    },
    preg: {
      remind: 'Hello mama. Your antenatal clinic day is {date}. Please bring your mother and child health booklet. Reply YES if you will go.',
      missed: 'Hello mama. You missed the clinic visit on {date}. You can still go now. Please go this week. Reply YES if you will go.',
      followUp: 'Hello mama. This is a reminder about your {visit} on {date}. Reply YES if you will go.',
    },
  },
}

export const CALL_SCRIPTS = {
  en: {
    reminder:
      'Good morning. This is your community health worker from Earlyma. I am calling to remind you about your clinic visit on {date}. Please press 1 to confirm that you will attend, or 2 if you need help.',
    missed:
      'Good morning. This is your community health worker from Earlyma. We noticed that you missed the clinic visit on {date}. It is still possible to attend this week. Please press 1 to confirm a new visit, or 2 to speak to a health worker.',
    confirmed:
      'Thank you. Your visit has been confirmed. Please remember to bring your clinic card. Goodbye.',
  },
  sw: {
    reminder:
      'Habari za asubuhi. Huyu ni mhudumu wako wa afya jamii kutoka Earlyma. Nakupigia simu kukukumbusha kuhusu kliniki yako tarehe {date}. Tafadhali bonyeza 1 kuthibitisha kuwa utahudhuria, au 2 kama unahitaji msaada.',
    missed:
      'Habari za asubuhi. Huyu ni mhudumu wako wa afya jamii kutoka Earlyma. Tuliona kuwa hukuhudhuria kliniki tarehe {date}. Bado unaweza kwenda wiki hii. Tafadhali bonyeza 1 kuthibitisha kliniki mpya, au 2 kuongea na mhudumu wa afya.',
    confirmed:
      'Asante. Ziara yako imethibitishwa. Tafadhali kumbuka kuleta kadi yako ya kliniki. Kwaheri.',
  },
}

export const CALL_OUTCOMES = {
  confirmed: { en: 'Client pressed 1 and confirmed', sw: 'Mteja alibonyeza 1 na kuthibitisha', color: 'green' },
  no_answer: { en: 'No answer', sw: 'Hakuna jibu', color: 'orange' },
  failed: { en: 'Call failed', sw: 'Simu imeshindikana', color: 'red' },
  completed: { en: 'Follow-up completed', sw: 'Ufuatiliaji umekamilika', color: 'teal' },
  rescheduled: { en: 'Visit rescheduled', sw: 'Ziara imepangwa upya', color: 'blue' },
}

export const CALL_OUTCOME_KEYS = Object.keys(CALL_OUTCOMES)

// Legacy free-text outcomes kept for compatibility.
export const OUTCOMES = [
  'Vaccinated or attended elsewhere',
  'Moved away',
  'Child unwell',
  'Refused',
  'Not found at home',
  'Home visit done, will attend',
]

export const VILLAGE_SUGGESTIONS = ['Kisumu', 'Mwanza', 'Dodoma', 'Mbeya', 'Kampala', 'Nairobi']
