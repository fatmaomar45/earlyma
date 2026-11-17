import { buildVisitsForClient } from './visits.js'
import { addDays, diffDays, startOfToday, toInput } from './dates.js'
import { createBaby, createMother } from './clients.js'
import { createCallLog } from './calls.js'
import { hashPassword, randomId } from './crypto.js'
import { createNotification, NOTIFICATION_STATUS } from './notifications.js'

export const DEMO_EMAIL = 'demo@earlyma.local'
export const DEMO_PASSWORD = 'demo1234'

export function demoUserExists(db) {
  return (db?.workers ?? []).some((worker) => worker.email === DEMO_EMAIL)
}

export async function buildDemoWorker(now = new Date()) {
  const passwordHash = await hashPassword(DEMO_PASSWORD)
  return {
    id: randomId('chw'),
    type: 'worker',
    code: 'CHW-0001',
    fullName: 'Demo Administrator',
    phone: '+255700000001',
    village: 'Demo Village',
    facility: 'Earlyma Demo Clinic',
    email: DEMO_EMAIL,
    role: 'admin',
    active: true,
    approvalStatus: 'active',
    notes: 'Fictional demo account. Not linked to a real person.',
    passwordHash,
    requiresPasswordReset: false,
    isDemo: true,
    registrationDate: toInput(now),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }
}

function completedRecords(client, today, count, notes) {
  const visits = buildVisitsForClient(client, { today })
  const records = {}
  const past = visits
    .filter((visit) => diffDays(today, visit.scheduledDate) < 0)
    .sort((a, b) => a.scheduledDate - b.scheduledDate)
    .slice(0, count)
  for (const visit of past) {
    records[visit.id] = {
      completedDate: visit.scheduledDateInput,
      cancelled: false,
      notes,
      followUpRequired: false,
      updatedAt: today.toISOString(),
    }
  }
  return records
}

/**
 * Builds clearly fictional demo records. Do not use real patient details.
 */
export function generateDemoData({ adminId, now = new Date() } = {}) {
  const today = startOfToday(now)
  const villageA = 'Demo Village'
  const villageB = 'Sample Ward'
  const phoneBase = '+255700100'

  const mothers = [
    createMother({
      fullName: 'Amina Demo',
      age: 24,
      phone: `${phoneBase}001`,
      village: villageA,
      address: 'Near the demo water point',
      expectedDeliveryDate: toInput(addDays(today, 30)),
      registrationDate: toInput(addDays(today, -120)),
      actualDeliveryDate: '',
      status: 'pregnant',
      language: 'sw',
      consentReminders: true,
      notes: 'Fictional record used to demonstrate antenatal contacts.',
      workerId: adminId,
      isDemo: true,
    }, { now }),
    createMother({
      fullName: 'Neema Sample',
      age: 29,
      phone: `${phoneBase}002`,
      village: villageA,
      address: 'Demo plot 12',
      expectedDeliveryDate: toInput(addDays(today, -12)),
      registrationDate: toInput(addDays(today, -190)),
      actualDeliveryDate: toInput(addDays(today, -10)),
      status: 'postnatal',
      language: 'sw',
      consentReminders: true,
      notes: 'Fictional postnatal record with a linked newborn.',
      workerId: adminId,
      isDemo: true,
    }, { now }),
    createMother({
      fullName: 'Zawadi Test',
      age: 21,
      phone: `${phoneBase}003`,
      village: villageB,
      address: 'Demo street 4',
      expectedDeliveryDate: toInput(addDays(today, 75)),
      registrationDate: toInput(addDays(today, -60)),
      status: 'pregnant',
      language: 'en',
      consentReminders: false,
      notes: 'Fictional record without reminder consent.',
      workerId: adminId,
      isDemo: true,
    }, { now }),
    createMother({
      fullName: 'Rehema Example',
      age: 33,
      phone: `${phoneBase}004`,
      village: villageB,
      expectedDeliveryDate: toInput(addDays(today, -50)),
      registrationDate: toInput(addDays(today, -220)),
      actualDeliveryDate: toInput(addDays(today, -45)),
      status: 'postnatal',
      language: 'sw',
      consentReminders: true,
      notes: 'Fictional record with an older baby.',
      workerId: adminId,
      isDemo: true,
    }, { now }),
    createMother({
      fullName: 'Halima Fiction',
      age: 26,
      phone: `${phoneBase}005`,
      village: villageA,
      expectedDeliveryDate: toInput(addDays(today, 5)),
      registrationDate: toInput(addDays(today, -150)),
      status: 'pregnant',
      language: 'en',
      consentReminders: true,
      notes: 'Fictional record with a visit due this week.',
      workerId: adminId,
      isDemo: true,
    }, { now }),
  ]

  const [amina, neema, , rehema] = mothers

  const babies = [
    createBaby({
      fullName: 'Baraka Demo',
      motherId: neema.id,
      motherName: neema.fullName,
      dateOfBirth: toInput(addDays(today, -10)),
      sex: 'male',
      birthWeightKg: 3.2,
      currentWeightKg: 3.5,
      village: villageA,
      workerId: adminId,
      language: 'sw',
      consentReminders: true,
      notes: 'Fictional newborn linked to a postnatal mother.',
      growthRecords: [
        { id: randomId('growth'), date: toInput(addDays(today, -10)), weightKg: 3.2, heightCm: 49, notes: 'Demo birth measurement', createdAt: now.toISOString() },
        { id: randomId('growth'), date: toInput(addDays(today, -3)), weightKg: 3.5, heightCm: 50, notes: 'Demo follow-up measurement', createdAt: now.toISOString() },
      ],
      isDemo: true,
    }, { now }),
    createBaby({
      fullName: 'Tumaini Demo',
      motherId: rehema.id,
      motherName: rehema.fullName,
      dateOfBirth: toInput(addDays(today, -300)),
      sex: 'female',
      birthWeightKg: 3.0,
      currentWeightKg: 8.4,
      village: villageB,
      workerId: adminId,
      language: 'sw',
      consentReminders: true,
      notes: 'Fictional older baby for immunization history.',
      growthRecords: [
        { id: randomId('growth'), date: toInput(addDays(today, -300)), weightKg: 3.0, heightCm: 48, notes: 'Demo birth measurement', createdAt: now.toISOString() },
        { id: randomId('growth'), date: toInput(addDays(today, -20)), weightKg: 8.4, heightCm: 71, notes: 'Demo recent measurement', createdAt: now.toISOString() },
      ],
      isDemo: true,
    }, { now }),
    createBaby({
      fullName: 'Amani Fiction',
      motherId: null,
      motherName: 'Fictional Mother',
      dateOfBirth: toInput(addDays(today, -55)),
      sex: 'female',
      birthWeightKg: 2.9,
      currentWeightKg: 4.6,
      village: villageA,
      workerId: adminId,
      language: 'en',
      consentReminders: true,
      notes: 'Fictional baby whose mother is not registered in the app.',
      growthRecords: [],
      isDemo: true,
    }, { now }),
  ]

  const visitRecords = {
    ...completedRecords(mothers[0], today, 5, 'Demo: antenatal contact completed.'),
    ...completedRecords(mothers[1], today, 6, 'Demo: postnatal contact completed.'),
    ...completedRecords(mothers[3], today, 5, 'Demo: postnatal contact completed.'),
    ...completedRecords(babies[1], today, 4, 'Demo: immunization visit completed.'),
    ...completedRecords(babies[0], today, 1, 'Demo: birth visit completed.'),
  }

  // Leave one overdue antenatal contact visible for the follow-up demo.
  const aminaVisits = buildVisitsForClient(amina, { today, visitRecords })
  const overdueVisit = aminaVisits.find((visit) => visit.status === 'overdue')
  if (overdueVisit) {
    delete visitRecords[overdueVisit.id]
  }

  const notifications = []
  const consenting = amina
  const queued = createNotification(consenting, 'Demo queued reminder: your clinic visit is coming up. Reply YES if you will attend.', 'remind', adminId, now, { provider: 'mock' })
  notifications.push({ ...queued, dedupeKey: `demo-queued-${queued.id}` })

  const sent = createNotification(neema, 'Demo sent reminder: your postnatal visit is due. Reply YES if you will attend.', 'remind', adminId, new Date(now.getTime() - 86_400_000), { provider: 'mock' })
  notifications.push({
    ...sent,
    status: NOTIFICATION_STATUS.SENT,
    attempts: 1,
    sentAt: new Date(now.getTime() - 86_400_000).toISOString(),
    nextRetryAt: null,
    providerMessageId: `mock-demo-${sent.id.slice(0, 8)}`,
    events: [
      ...sent.events,
      { at: new Date(now.getTime() - 86_400_000).toISOString(), status: NOTIFICATION_STATUS.SENT, detail: 'Demo provider accepted the message. Delivery not confirmed.' },
    ],
  })

  const failed = createNotification(babies[2], 'Demo failed reminder: the mock provider rejected this example message.', 'missed', adminId, new Date(now.getTime() - 2 * 86_400_000), { provider: 'mock' })
  notifications.push({
    ...failed,
    status: NOTIFICATION_STATUS.FAILED,
    attempts: 3,
    sentAt: null,
    nextRetryAt: null,
    error: 'Delivery failed: provider timeout (demo).',
    lastError: 'Delivery failed: provider timeout (demo).',
    events: [
      ...failed.events,
      { at: new Date(now.getTime() - 86_400_000).toISOString(), status: NOTIFICATION_STATUS.FAILED, detail: 'Delivery failed: provider timeout (demo).' },
    ],
  })

  const inbound = {
    id: randomId('inb'),
    clientId: neema.id,
    clientType: 'mother',
    clientLabel: neema.fullName,
    phone: neema.phone,
    message: '1',
    type: 'reply',
    direction: 'inbound',
    status: NOTIFICATION_STATUS.RECEIVED,
    intent: 'confirmed',
    code: '1',
    relatedId: null,
    providerMessageId: null,
    workerId: adminId,
    createdAt: new Date(now.getTime() - 82_800_000).toISOString(),
    updatedAt: new Date(now.getTime() - 82_800_000).toISOString(),
    events: [{ at: new Date(now.getTime() - 82_800_000).toISOString(), status: NOTIFICATION_STATUS.RECEIVED, detail: 'Demo inbound reply: confirmed.' }],
  }
  notifications.push(inbound)

  const callLogs = [
    createCallLog({
      client: mothers[4],
      workerId: adminId,
      type: 'reminder',
      language: 'en',
      message: 'Demo reminder call script.',
      outcome: 'confirmed',
      notes: 'Demo: client pressed 1.',
      isDemo: true,
    }, new Date(now.getTime() - 3_600_000)),
    createCallLog({
      client: babies[2],
      workerId: adminId,
      type: 'missed',
      language: 'sw',
      message: 'Demo missed-visit call script.',
      outcome: 'no_answer',
      notes: 'Demo: no answer, follow-up needed.',
      isDemo: true,
    }, new Date(now.getTime() - 7_200_000)),
    createCallLog({
      client: mothers[2],
      workerId: adminId,
      type: 'reminder',
      language: 'sw',
      message: 'Demo reminder call script.',
      outcome: 'failed',
      notes: 'Demo: simulated network failure.',
      isDemo: true,
    }, new Date(now.getTime() - 10_800_000)),
  ]

  const activities = [
    { id: randomId('act'), actorId: adminId, action: 'demo.loaded', entityType: 'system', entityId: null, meta: {}, at: now.toISOString(), isDemo: true },
    { id: randomId('act'), actorId: adminId, action: 'client.created', entityType: 'mother', entityId: amina.id, meta: { name: amina.fullName }, at: new Date(now.getTime() - 60_000).toISOString(), isDemo: true },
    { id: randomId('act'), actorId: adminId, action: 'client.created', entityType: 'baby', entityId: babies[0].id, meta: { name: babies[0].fullName }, at: new Date(now.getTime() - 120_000).toISOString(), isDemo: true },
    { id: randomId('act'), actorId: adminId, action: 'call.logged', entityType: 'call', entityId: callLogs[0].id, meta: { name: mothers[4].fullName, outcome: 'confirmed' }, at: new Date(now.getTime() - 240_000).toISOString(), isDemo: true },
  ]

  return { mothers, babies, visitRecords, notifications, callLogs, activities }
}
