import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { translate, localeFor } from '../lib/i18n.js'
import { randomId } from '../lib/crypto.js'
import {
  createBaby as makeBaby,
  createMother as makeMother,
  deleteBabyFromDb,
  deleteMotherFromDb,
  updateBaby as patchBaby,
  updateMother as patchMother,
  addGrowthRecord as patchGrowth,
} from '../lib/clients.js'
import {
  clearAllData,
  clearSession,
  createEmptyDatabase,
  databaseCounts,
  exportDatabase,
  importDatabase,
  loadDatabase,
  loadSession,
  normalizeDatabase,
  nextWorkerCode,
  removeDemoData as stripDemoData,
  saveDatabase,
  saveSession,
  STORAGE_KEY,
} from '../lib/storage.js'
import {
  applyDeliveryReceipt,
  cancelNotification as cancelQueueEntry,
  createNotification,
  dispatchQueue,
  enqueueNotification,
  getDefaultProvider,
  recordInboundReply,
  retryAllFailed,
  retryNotification,
  selectDispatchable,
  summarizeNotifications,
} from '../lib/notifications.js'
import {
  createCallLog,
  markCallFollowUpDone,
  attachFollowUpNotification,
} from '../lib/calls.js'
import { buildDedupeKey, buildNotificationMessage } from '../lib/templates.js'
import { hashPassword, passwordIssues, verifyPassword } from '../lib/crypto.js'
import { normalizeEmail, normalizePhone, validateBaby, validateMother, validateWorker } from '../lib/validation.js'
import { toInput } from '../lib/dates.js'
import { buildDemoWorker, DEMO_EMAIL, DEMO_PASSWORD, generateDemoData } from '../lib/demo.js'
import {
  isRemoteAuthEnabled,
  remoteApprove,
  remoteLogin,
  remoteLogout,
  remoteRecover,
  remoteRegister,
  remoteReject,
} from '../lib/authApi.js'
import { clientName } from '../lib/clients.js'

const AppContext = createContext(null)

function appendActivity(db, actorId, activity) {
  return {
    ...db,
    activities: [
      {
        id: randomId('act'),
        actorId,
        at: new Date().toISOString(),
        ...activity,
      },
      ...(db.activities ?? []),
    ].slice(0, 1000),
  }
}

function mergeQueue(currentQueue = [], updatedQueue = []) {
  const map = new Map((currentQueue ?? []).map((entry) => [entry.id, entry]))
  for (const entry of updatedQueue ?? []) {
    if (entry?.id) map.set(entry.id, entry)
  }
  return [...map.values()].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
}

export function AppProvider({ children }) {
  const [db, setDb] = useState(() => createEmptyDatabase())
  const [ready, setReady] = useState(false)
  const [currentUserId, setCurrentUserId] = useState(null)
  const [session, setSession] = useState(null)
  const [storageAvailable, setStorageAvailable] = useState(true)
  const [storageError, setStorageError] = useState(null)
  const [scopeWorkerId, setScopeWorkerId] = useState(null)
  const [toasts, setToasts] = useState([])
  const [busy, setBusy] = useState({})
  const revisionRef = useRef(0)
  const toastTimers = useRef(new Map())

  const dismissToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
    const timer = toastTimers.current.get(id)
    if (timer) clearTimeout(timer)
    toastTimers.current.delete(id)
  }, [])

  const toast = useCallback((input) => {
    const id = randomId('toast')
    const entry = {
      id,
      title: input?.title ?? '',
      message: input?.message ?? '',
      color: input?.color ?? 'teal',
      duration: input?.duration ?? 4500,
    }
    setToasts((current) => [...current.slice(-3), entry])
    if (entry.duration > 0) {
      const timer = setTimeout(() => dismissToast(id), entry.duration)
      toastTimers.current.set(id, timer)
    }
    return id
  }, [dismissToast])

  useEffect(() => () => {
    for (const timer of toastTimers.current.values()) clearTimeout(timer)
  }, [])

  // Load the versioned database and restore a valid, unexpired session.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const loaded = await loadDatabase()
        if (cancelled) return
        revisionRef.current = loaded.revision ?? 0
        setDb(loaded)
        const currentSession = loadSession()
        if (currentSession) {
          const user = (loaded.workers ?? []).find((worker) => worker.id === currentSession.userId && worker.active && !worker.requiresPasswordReset)
          if (user) {
            setCurrentUserId(user.id)
            setSession(currentSession)
          } else {
            clearSession()
          }
        }
        setStorageAvailable(Boolean(globalThis.localStorage))
      } catch (error) {
        if (cancelled) return
        setStorageAvailable(false)
        setStorageError(error?.message ?? 'Storage unavailable')
        setDb(createEmptyDatabase())
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Persist changes after bootstrap. The storage layer never logs patient data.
  useEffect(() => {
    if (!ready) return
    try {
      saveDatabase(db)
      setStorageAvailable(true)
    } catch (error) {
      setStorageAvailable(false)
      setStorageError(error?.message ?? 'Could not save data.')
    }
  }, [db, ready])

  // Cross-tab protection: only accept a stored database if it is newer.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const onStorage = (event) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return
      try {
        const incoming = normalizeDatabase(JSON.parse(event.newValue))
        if ((incoming.revision ?? 0) > revisionRef.current) {
          revisionRef.current = incoming.revision ?? 0
          setDb(incoming)
          if (currentUserId && !(incoming.workers ?? []).some((worker) => worker.id === currentUserId)) {
            setCurrentUserId(null)
            clearSession()
          }
          toast({ title: translate(incoming.preferences?.language ?? 'en', 'common.saved'), message: '', color: 'blue', duration: 2500 })
        }
      } catch {
        // Ignore malformed cross-tab payloads.
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [currentUserId, toast])

  const currentUser = useMemo(
    () => (db.workers ?? []).find((worker) => worker.id === currentUserId) ?? null,
    [db.workers, currentUserId],
  )
  const isAdmin = currentUser?.role === 'admin'
  const language = db.preferences?.language ?? 'en'
  const locale = localeFor(language)
  const t = useCallback((key, vars) => translate(language, key, vars), [language])

  useEffect(() => {
    if (typeof document !== 'undefined') document.documentElement.lang = language
  }, [language])

  // Session expiry check.
  useEffect(() => {
    if (!currentUserId) return undefined
    const timer = setInterval(() => {
      const current = loadSession()
      if (!current) {
        setCurrentUserId(null)
        setSession(null)
        toast({ title: t('auth.sessionExpired'), color: 'orange' })
      }
    }, 60_000)
    return () => clearInterval(timer)
  }, [currentUserId, t, toast])

  const commit = useCallback((updater) => {
    setDb((previous) => {
      const next = typeof updater === 'function' ? updater(previous) : updater
      if (!next) return previous
      const stamped = {
        ...next,
        revision: (previous.revision ?? 0) + 1,
        updatedAt: new Date().toISOString(),
      }
      revisionRef.current = stamped.revision
      return stamped
    })
  }, [])

  const withBusy = useCallback(async (key, fn) => {
    setBusy((current) => ({ ...current, [key]: true }))
    try {
      return await fn()
    } finally {
      setBusy((current) => {
        const next = { ...current }
        delete next[key]
        return next
      })
    }
  }, [])

  const setLanguage = useCallback((nextLanguage) => {
    if (!['en', 'sw'].includes(nextLanguage)) return
    commit((previous) => ({ ...previous, preferences: { ...previous.preferences, language: nextLanguage } }))
  }, [commit])

  const setDefaultNotificationLanguage = useCallback((nextLanguage) => {
    if (!['en', 'sw'].includes(nextLanguage)) return
    commit((previous) => ({ ...previous, preferences: { ...previous.preferences, defaultNotificationLanguage: nextLanguage } }))
  }, [commit])

  const setPageSize = useCallback((size) => {
    const safe = [5, 10, 20, 50].includes(Number(size)) ? Number(size) : 10
    commit((previous) => ({ ...previous, preferences: { ...previous.preferences, pageSize: safe } }))
  }, [commit])

  const establishSession = useCallback((worker) => {
    setCurrentUserId(worker.id)
    const saved = saveSession(worker.id)
    setSession(saved ? loadSession() : { userId: worker.id })
    setScopeWorkerId(worker.role === 'admin' ? null : worker.id)
  }, [])

  // When the secure backend owns credentials, keep a local mirror of the
  // returned profile so the rest of the app (client lists, reminders) works.
  const mirrorRemoteUser = useCallback((user) => {
    if (!user?.id) return
    commit((previous) => {
      const matches = (worker) => worker.id === user.id || (
        user.email && normalizeEmail(worker.email) === normalizeEmail(user.email)
      )
      const exists = (previous.workers ?? []).some(matches)
      const workers = exists
        ? previous.workers.map((worker) => (matches(worker) ? { ...worker, ...user } : worker))
        : [...previous.workers, user]
      return { ...previous, workers }
    })
  }, [commit])

  const login = useCallback(async ({ email, password }) => {
    return withBusy('auth', async () => {
      if (isRemoteAuthEnabled()) {
        try {
          const result = await remoteLogin({ email, password })
          if (result.pending) return { ok: false, error: 'pending' }
          if (result.user) {
            mirrorRemoteUser(result.user)
            establishSession(result.user)
            return { ok: true, user: result.user }
          }
          return { ok: false, error: 'invalid' }
        } catch (error) {
          return { ok: false, error: error?.code === 'network' ? 'network' : (error?.code || 'invalid'), detail: error?.message }
        }
      }

      const normalizedEmail = String(email ?? '').trim().toLowerCase()
      const worker = (db.workers ?? []).find((entry) => entry.email === normalizedEmail)
      if (!worker) return { ok: false, error: 'invalid' }
      if (!worker.active) return { ok: false, error: 'inactive' }
      if (worker.requiresPasswordReset && !worker.passwordHash) return { ok: false, error: 'reset' }

      let valid = false
      if (worker.passwordHash) valid = await verifyPassword(password, worker.passwordHash)
      else if (worker.legacyPassword) valid = worker.legacyPassword === password

      if (!valid) return { ok: false, error: 'invalid' }

      if (worker.legacyPassword && !worker.passwordHash) {
        try {
          const passwordHash = await hashPassword(password)
          commit((previous) => ({
            ...previous,
            workers: previous.workers.map((entry) => {
              if (entry.id !== worker.id) return entry
              const { legacyPassword, ...rest } = entry
              return { ...rest, passwordHash }
            }),
          }))
        } catch {
          // Login still succeeds for a migrated legacy account; the password
          // will be upgraded the next time Web Crypto is available.
        }
      }

      // Self-heal: if there is no real (non-demo) administrator yet, promote the
      // account being used to sign in so the first real user is never locked out.
      const realAdmins = (db.workers ?? []).filter((entry) => entry.active && entry.role === 'admin' && !entry.isDemo)
      let sessionWorker = worker
      if (worker.role !== 'admin' && realAdmins.length === 0) {
        sessionWorker = { ...worker, role: 'admin', approvalStatus: 'active' }
        commit((previous) => ({
          ...previous,
          workers: previous.workers.map((entry) => (entry.id === worker.id
            ? { ...entry, role: 'admin', approvalStatus: 'active' }
            : entry)),
        }))
      }

      establishSession(sessionWorker)
      return { ok: true, user: sessionWorker }
    })
  }, [commit, db.workers, establishSession, mirrorRemoteUser, withBusy])

  const register = useCallback(async (input) => {
    return withBusy('auth', async () => {
      if (isRemoteAuthEnabled()) {
        try {
          const result = await remoteRegister({
            fullName: input.fullName,
            phone: input.phone,
            village: input.village,
            facility: input.facility,
            email: input.email,
            password: String(input.password ?? ''),
          })
          if (result.pending) return { ok: true, pending: true, user: result.user }
          if (result.user) {
            mirrorRemoteUser(result.user)
            establishSession(result.user)
            return { ok: true, user: result.user }
          }
          return { ok: false, error: 'invalid' }
        } catch (error) {
          if (error?.code === 'duplicate') return { ok: false, error: 'duplicate', issues: ['validation.duplicateEmail'] }
          if (error?.code === 'network') return { ok: false, error: 'network', detail: error?.message }
          return { ok: false, error: error?.code || 'invalid', detail: error?.message }
        }
      }

      const password = String(input.password ?? '')
      if (password !== input.confirmPassword) return { ok: false, error: 'passwords', issues: ['validation.passwordsMismatch'] }
      const issues = passwordIssues(password)
      if (issues.length > 0) return { ok: false, error: 'password', issues }

      const isFirst = (db.workers ?? []).length === 0
      const role = isFirst ? 'admin' : 'chw'
      const validation = validateWorker({
        fullName: input.fullName,
        phone: input.phone,
        village: input.village,
        facility: input.facility,
        email: input.email,
        role,
      }, { workers: db.workers })
      if (!validation.valid) return { ok: false, error: 'validation', errors: validation.errors }

      const passwordHash = await hashPassword(password)
      const now = new Date()
      // Approval is not required: every self-registered account is active
      // immediately. The first account still becomes the administrator.
      const approvalStatus = 'active'
      const worker = {
        id: randomId('chw'),
        type: 'worker',
        code: nextWorkerCode(db.workers),
        fullName: validation.value.fullName,
        phone: validation.value.phone,
        village: validation.value.village,
        facility: validation.value.facility,
        email: validation.value.email,
        role,
        active: true,
        approvalStatus,
        notes: '',
        passwordHash,
        requiresPasswordReset: false,
        isDemo: false,
        registrationDate: toInput(now),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      }
      commit((previous) => appendActivity({ ...previous, workers: [...previous.workers, worker] }, worker.id, {
        action: 'worker.created',
        entityType: 'worker',
        entityId: worker.id,
        meta: { name: worker.fullName, approvalStatus },
      }))
      if (approvalStatus === 'active') establishSession(worker)
      return { ok: true, pending: approvalStatus !== 'active', user: worker }
    })
  }, [commit, db.workers, establishSession, mirrorRemoteUser, withBusy])

  const loginDemo = useCallback(async () => {
    return withBusy('auth', async () => {
      try {
        const existing = (db.workers ?? []).find((worker) => worker.email === DEMO_EMAIL)
        if (existing) {
          if (existing.requiresPasswordReset) return { ok: false, error: 'reset' }
          const valid = existing.passwordHash ? await verifyPassword(DEMO_PASSWORD, existing.passwordHash) : false
          if (!valid) return { ok: false, error: 'demo' }
          establishSession(existing)
          return { ok: true, user: existing }
        }

        const worker = await buildDemoWorker()
        worker.code = nextWorkerCode(db.workers)
        worker.approvalStatus = 'active'
        const demo = generateDemoData({ adminId: worker.id })
        commit((previous) => {
          const cleaned = stripDemoData(previous)
          const next = {
            ...cleaned,
            workers: [...cleaned.workers, worker],
            mothers: [...cleaned.mothers, ...demo.mothers],
            babies: [...cleaned.babies, ...demo.babies],
            visitRecords: { ...cleaned.visitRecords, ...demo.visitRecords },
            notifications: [...demo.notifications, ...cleaned.notifications],
            callLogs: [...demo.callLogs, ...cleaned.callLogs],
            activities: [...demo.activities, ...cleaned.activities],
          }
          return appendActivity(next, worker.id, {
            action: 'demo.loaded',
            entityType: 'system',
            entityId: null,
            meta: {},
            isDemo: true,
          })
        })
        establishSession(worker)
        return { ok: true, user: worker }
      } catch (error) {
        return { ok: false, error: 'demo', detail: error?.message }
      }
    })
  }, [commit, db.workers, establishSession, withBusy])

  const logout = useCallback(() => {
    if (isRemoteAuthEnabled()) {
      // Best-effort server logout; local state is cleared regardless.
      remoteLogout().catch(() => {})
    }
    clearSession()
    setCurrentUserId(null)
    setSession(null)
    setScopeWorkerId(null)
    toast({ title: t('auth.loggedOut'), color: 'gray' })
  }, [t, toast])

  // Password recovery. The local build uses the registered email + phone as a
  // knowledge check (clearly a demo boundary). The secure backend performs the
  // same check server-side and owns the credential.
  const recoverPassword = useCallback(async ({ email, phone, password }) => {
    return withBusy('auth', async () => {
      const issues = passwordIssues(password)
      if (issues.length > 0) return { ok: false, error: 'password', issues }

      if (isRemoteAuthEnabled()) {
        try {
          await remoteRecover({ email, phone, password })
          toast({ title: t('auth.recoverSuccess'), color: 'teal' })
          return { ok: true }
        } catch (error) {
          return { ok: false, error: error?.code === 'network' ? 'network' : 'invalid' }
        }
      }

      const normalizedEmail = normalizeEmail(email)
      const worker = (db.workers ?? []).find((entry) => normalizeEmail(entry.email) === normalizedEmail)
      const matches = worker && normalizePhone(worker.phone) === normalizePhone(phone)
      if (!matches) return { ok: false, error: 'invalid' }
      if (worker.approvalStatus === 'pending') return { ok: false, error: 'pending' }

      const passwordHash = await hashPassword(password)
      commit((previous) => appendActivity({
        ...previous,
        workers: previous.workers.map((entry) => (
          entry.id === worker.id
            ? { ...entry, passwordHash, requiresPasswordReset: false, updatedAt: new Date().toISOString() }
            : entry
        )),
      }, currentUser?.id, {
        action: 'worker.updated',
        entityType: 'worker',
        entityId: worker.id,
        meta: { name: worker.fullName, recovered: true },
      }))
      toast({ title: t('auth.recoverSuccess'), color: 'teal' })
      return { ok: true }
    })
  }, [commit, currentUser?.id, db.workers, t, toast, withBusy])

  const approveWorker = useCallback(async (id) => {
    return withBusy(`worker:${id}`, async () => {
      try {
        if (isRemoteAuthEnabled()) await remoteApprove(id)
        const name = (db.workers ?? []).find((worker) => worker.id === id)?.fullName ?? ''
        commit((previous) => appendActivity({
          ...previous,
          workers: previous.workers.map((worker) => (
            worker.id === id
              ? { ...worker, approvalStatus: 'active', active: true, updatedAt: new Date().toISOString() }
              : worker
          )),
        }, currentUser?.id, {
          action: 'worker.approved',
          entityType: 'worker',
          entityId: id,
          meta: { name },
        }))
        toast({ title: t('workers.approved'), color: 'teal' })
        return { ok: true }
      } catch (error) {
        return { ok: false, error: error?.message }
      }
    })
  }, [commit, currentUser?.id, db.workers, t, toast, withBusy])

  const rejectWorker = useCallback(async (id) => {
    if (id === currentUser?.id) return { ok: false, error: 'self' }
    return withBusy(`worker:${id}`, async () => {
      try {
        if (isRemoteAuthEnabled()) await remoteReject(id)
        const name = (db.workers ?? []).find((worker) => worker.id === id)?.fullName ?? ''
        commit((previous) => appendActivity({
          ...previous,
          workers: previous.workers.filter((worker) => worker.id !== id),
        }, currentUser?.id, {
          action: 'worker.rejected',
          entityType: 'worker',
          entityId: id,
          meta: { name },
        }))
        toast({ title: t('workers.rejected'), color: 'gray' })
        return { ok: true }
      } catch (error) {
        return { ok: false, error: error?.message }
      }
    })
  }, [commit, currentUser?.id, db.workers, t, toast, withBusy])

  const visibleWorkerId = isAdmin ? scopeWorkerId : (currentUser?.id ?? null)

  const addMother = useCallback((input) => {
    const validation = validateMother(input, { mothers: db.mothers })
    if (!validation.valid) return { ok: false, errors: validation.errors }
    const now = new Date()
    const mother = makeMother({
      ...validation.value,
      workerId: validation.value.workerId ?? currentUser?.id ?? null,
    }, { existingMothers: db.mothers, now })
    commit((previous) => appendActivity({ ...previous, mothers: [...previous.mothers, mother] }, currentUser?.id, {
      action: 'client.created',
      entityType: 'mother',
      entityId: mother.id,
      meta: { name: mother.fullName },
    }))
    toast({ title: t('mothers.saveSuccess'), color: 'teal' })
    return { ok: true, client: mother }
  }, [commit, currentUser?.id, db.mothers, t, toast])

  const updateMother = useCallback((id, input) => {
    const existing = (db.mothers ?? []).find((mother) => mother.id === id)
    if (!existing) return { ok: false, errors: { form: 'mothers.notFound' } }
    const validation = validateMother({ ...existing, ...input }, { mothers: db.mothers, excludeId: id })
    if (!validation.valid) return { ok: false, errors: validation.errors }
    const mother = patchMother(existing, validation.value)
    commit((previous) => appendActivity({
      ...previous,
      mothers: previous.mothers.map((entry) => (entry.id === id ? mother : entry)),
    }, currentUser?.id, {
      action: 'client.updated',
      entityType: 'mother',
      entityId: id,
      meta: { name: mother.fullName },
    }))
    toast({ title: t('mothers.updateSuccess'), color: 'teal' })
    return { ok: true, client: mother }
  }, [commit, currentUser?.id, db.mothers, t, toast])

  const deleteMother = useCallback((id) => {
    const existing = (db.mothers ?? []).find((mother) => mother.id === id)
    if (!existing) return { ok: false }
    commit((previous) => appendActivity(deleteMotherFromDb(previous, id), currentUser?.id, {
      action: 'client.deleted',
      entityType: 'mother',
      entityId: id,
      meta: { name: existing.fullName },
    }))
    toast({ title: t('common.deleted'), color: 'gray' })
    return { ok: true }
  }, [commit, currentUser?.id, db.mothers, t, toast])

  const addBaby = useCallback((input) => {
    const mother = input.motherId ? (db.mothers ?? []).find((entry) => entry.id === input.motherId) : null
    const prepared = { ...input, motherName: input.motherName || mother?.fullName || '' }
    const validation = validateBaby(prepared, { babies: db.babies })
    if (!validation.valid) return { ok: false, errors: validation.errors }
    const now = new Date()
    const baby = makeBaby({
      ...validation.value,
      workerId: validation.value.workerId ?? currentUser?.id ?? null,
    }, { existingBabies: db.babies, now })
    commit((previous) => appendActivity({ ...previous, babies: [...previous.babies, baby] }, currentUser?.id, {
      action: 'client.created',
      entityType: 'baby',
      entityId: baby.id,
      meta: { name: baby.fullName },
    }))
    toast({ title: t('babies.saveSuccess'), color: 'teal' })
    return { ok: true, client: baby }
  }, [commit, currentUser?.id, db.babies, db.mothers, t, toast])

  const updateBaby = useCallback((id, input) => {
    const existing = (db.babies ?? []).find((baby) => baby.id === id)
    if (!existing) return { ok: false, errors: { form: 'babies.notFound' } }
    const mother = input.motherId ? (db.mothers ?? []).find((entry) => entry.id === input.motherId) : null
    const prepared = { ...existing, ...input, motherName: input.motherName || mother?.fullName || existing.motherName }
    const validation = validateBaby(prepared, { babies: db.babies, excludeId: id })
    if (!validation.valid) return { ok: false, errors: validation.errors }
    const baby = patchBaby(existing, validation.value)
    commit((previous) => appendActivity({
      ...previous,
      babies: previous.babies.map((entry) => (entry.id === id ? baby : entry)),
    }, currentUser?.id, {
      action: 'client.updated',
      entityType: 'baby',
      entityId: id,
      meta: { name: baby.fullName },
    }))
    toast({ title: t('babies.updateSuccess'), color: 'teal' })
    return { ok: true, client: baby }
  }, [commit, currentUser?.id, db.babies, db.mothers, t, toast])

  const deleteBaby = useCallback((id) => {
    const existing = (db.babies ?? []).find((baby) => baby.id === id)
    if (!existing) return { ok: false }
    commit((previous) => appendActivity(deleteBabyFromDb(previous, id), currentUser?.id, {
      action: 'client.deleted',
      entityType: 'baby',
      entityId: id,
      meta: { name: existing.fullName },
    }))
    toast({ title: t('common.deleted'), color: 'gray' })
    return { ok: true }
  }, [commit, currentUser?.id, db.babies, t, toast])

  const addGrowthRecord = useCallback((babyId, record) => {
    const existing = (db.babies ?? []).find((baby) => baby.id === babyId)
    if (!existing) return { ok: false }
    const updated = patchGrowth(existing, record)
    commit((previous) => ({
      ...previous,
      babies: previous.babies.map((entry) => (entry.id === babyId ? updated : entry)),
    }))
    toast({ title: t('babies.growthSaved'), color: 'teal' })
    return { ok: true, client: updated }
  }, [commit, db.babies, t, toast])

  const updateVisitRecord = useCallback((visitId, patch, activity) => {
    const now = new Date()
    commit((previous) => {
      const existing = previous.visitRecords?.[visitId] ?? {}
      const nextRecord = {
        completedDate: null,
        cancelled: false,
        notes: '',
        followUpRequired: false,
        ...existing,
        ...patch,
        updatedAt: now.toISOString(),
      }
      const withRecord = {
        ...previous,
        visitRecords: { ...previous.visitRecords, [visitId]: nextRecord },
      }
      return activity ? appendActivity(withRecord, currentUser?.id, activity) : withRecord
    })
  }, [commit, currentUser?.id])

  const completeVisit = useCallback((visit, { completedDate, notes, followUpRequired } = {}) => {
    if (!visit) return { ok: false }
    updateVisitRecord(visit.id, {
      completedDate: completedDate || toInput(new Date()),
      cancelled: false,
      notes: notes ?? visit.notes ?? '',
      followUpRequired: Boolean(followUpRequired),
    }, {
      action: 'visit.completed',
      entityType: 'visit',
      entityId: visit.id,
      meta: { name: visit.clientName, visit: visit.name?.[language] ?? visit.name?.en },
    })
    toast({ title: t('visits.completeSuccess'), color: 'teal' })
    return { ok: true }
  }, [language, t, toast, updateVisitRecord])

  const cancelVisit = useCallback((visit) => {
    if (!visit) return { ok: false }
    updateVisitRecord(visit.id, {
      completedDate: null,
      cancelled: true,
      notes: visit.notes ?? '',
      followUpRequired: false,
    }, {
      action: 'visit.cancelled',
      entityType: 'visit',
      entityId: visit.id,
      meta: { name: visit.clientName, visit: visit.name?.[language] ?? visit.name?.en },
    })
    toast({ title: t('visits.cancelSuccess'), color: 'gray' })
    return { ok: true }
  }, [language, t, toast, updateVisitRecord])

  const reopenVisit = useCallback((visit) => {
    if (!visit) return { ok: false }
    updateVisitRecord(visit.id, { completedDate: null, cancelled: false }, {
      action: 'visit.updated',
      entityType: 'visit',
      entityId: visit.id,
      meta: { name: visit.clientName, visit: visit.name?.[language] ?? visit.name?.en },
    })
    toast({ title: t('visits.updateSuccess'), color: 'blue' })
    return { ok: true }
  }, [language, t, toast, updateVisitRecord])

  const saveVisitNotes = useCallback((visit, notes, followUpRequired) => {
    if (!visit) return { ok: false }
    updateVisitRecord(visit.id, { notes, followUpRequired: Boolean(followUpRequired) }, {
      action: 'visit.updated',
      entityType: 'visit',
      entityId: visit.id,
      meta: { name: visit.clientName, visit: visit.name?.[language] ?? visit.name?.en },
    })
    toast({ title: t('visits.updateSuccess'), color: 'teal' })
    return { ok: true }
  }, [language, t, toast, updateVisitRecord])

  const buildNotificationDraft = useCallback((draft) => {
    const client = draft?.client
    if (!client) return null
    const notificationLanguage = draft.language ?? client.language ?? db.preferences?.defaultNotificationLanguage ?? 'sw'
    const message = draft.message || buildNotificationMessage(client, draft.type ?? 'remind', draft.visit ?? null, notificationLanguage)
    const notification = createNotification(client, message, draft.type ?? 'remind', currentUser?.id ?? client.workerId ?? null, new Date(), {
      provider: 'pending',
      language: notificationLanguage,
      dedupeKey: draft.dedupeKey ?? buildDedupeKey(client, draft.type ?? 'remind', draft.visit ?? null),
    })
    return notification
  }, [currentUser?.id, db.preferences?.defaultNotificationLanguage])

  const queueNotification = useCallback((draft) => {
    const notification = buildNotificationDraft(draft)
    if (!notification) return { ok: false, error: 'no-client' }
    const alreadyQueued = (db.notifications ?? []).some((entry) => (
      entry.dedupeKey === notification.dedupeKey &&
      entry.direction !== 'inbound' &&
      !['failed', 'cancelled'].includes(entry.status)
    ))
    if (alreadyQueued && !draft.allowDuplicate) {
      return { ok: false, duplicate: true, error: 'duplicate' }
    }
    commit((previous) => appendActivity({
      ...previous,
      notifications: enqueueNotification(previous.notifications, notification, { allowDuplicate: draft.allowDuplicate }),
    }, currentUser?.id, {
      action: 'notification.queued',
      entityType: 'notification',
      entityId: notification.id,
      meta: { name: notification.clientLabel },
    }))
    return { ok: true, notification }
  }, [buildNotificationDraft, commit, currentUser?.id, db.notifications])

  const processQueue = useCallback(async (options = {}) => {
    const due = selectDispatchable(db.notifications)
    if (due.length === 0) {
      if (!options.silent) toast({ title: t('notifications.noDue'), color: 'blue' })
      return { ok: true, processed: 0 }
    }
    return withBusy('queue', async () => {
      try {
        const { queue, results } = await dispatchQueue(db.notifications, getDefaultProvider())
        commit((previous) => {
          let next = { ...previous, notifications: mergeQueue(previous.notifications, queue) }
          for (const result of results) {
            if (result.status === 'sent' || result.status === 'delivered') {
              next = appendActivity(next, currentUser?.id, {
                action: 'notification.sent',
                entityType: 'notification',
                entityId: result.id,
                meta: { name: result.clientLabel },
              })
            } else if (result.status === 'failed') {
              next = appendActivity(next, currentUser?.id, {
                action: 'notification.failed',
                entityType: 'notification',
                entityId: result.id,
                meta: { name: result.clientLabel, error: result.error },
              })
            }
          }
          return next
        })
        if (!options.silent) {
          const sent = results.filter((result) => ['sent', 'delivered'].includes(result.status)).length
          const failed = results.filter((result) => result.status === 'failed').length
          toast({
            title: t('notifications.queueProcessed'),
            message: `${sent} sent · ${failed} failed`,
            color: failed > 0 ? 'orange' : 'teal',
          })
        }
        return { ok: true, processed: results.length }
      } catch (error) {
        if (!options.silent) toast({ title: t('toast.error'), message: error?.message, color: 'red' })
        return { ok: false, error: error?.message }
      }
    })
  }, [commit, currentUser?.id, db.notifications, t, toast, withBusy])

  const sendNotification = useCallback(async (draft) => {
    const notification = buildNotificationDraft(draft)
    if (!notification) return { ok: false, error: 'no-client' }
    const alreadyQueued = (db.notifications ?? []).some((entry) => (
      entry.dedupeKey === notification.dedupeKey &&
      entry.direction !== 'inbound' &&
      !['failed', 'cancelled'].includes(entry.status)
    ))
    if (alreadyQueued && !draft.allowDuplicate) return { ok: false, duplicate: true, error: 'duplicate' }

    return withBusy(`send:${notification.clientId}`, async () => {
      try {
        const queued = enqueueNotification(db.notifications, notification, { allowDuplicate: draft.allowDuplicate })
        const { queue, results } = await dispatchQueue(queued, getDefaultProvider())
        const result = results.find((entry) => entry.id === notification.id) ?? queue.find((entry) => entry.id === notification.id)
        commit((previous) => {
          let next = appendActivity({
            ...previous,
            notifications: mergeQueue(previous.notifications, queue),
          }, currentUser?.id, {
            action: 'notification.queued',
            entityType: 'notification',
            entityId: notification.id,
            meta: { name: notification.clientLabel },
          })
          if (result && ['sent', 'delivered'].includes(result.status)) {
            next = appendActivity(next, currentUser?.id, {
              action: 'notification.sent',
              entityType: 'notification',
              entityId: notification.id,
              meta: { name: notification.clientLabel },
            })
          } else if (result?.status === 'failed') {
            next = appendActivity(next, currentUser?.id, {
              action: 'notification.failed',
              entityType: 'notification',
              entityId: notification.id,
              meta: { name: notification.clientLabel, error: result.error },
            })
          }
          return next
        })
        if (result?.status === 'sent' || result?.status === 'delivered') {
          toast({ title: t('toast.notificationSent'), color: 'teal' })
        } else if (result?.status === 'failed') {
          toast({ title: t('toast.notificationFailed'), color: 'red' })
        } else {
          toast({ title: t('toast.notificationQueued'), color: 'blue' })
        }
        return { ok: true, notification: result, results }
      } catch (error) {
        // Persist the queued entry even if the provider call itself throws.
        commit((previous) => ({
          ...previous,
          notifications: enqueueNotification(previous.notifications, notification, { allowDuplicate: draft.allowDuplicate }),
        }))
        toast({ title: t('toast.notificationQueued'), message: error?.message, color: 'orange' })
        return { ok: false, error: error?.message }
      }
    })
  }, [buildNotificationDraft, commit, currentUser?.id, db.notifications, t, toast, withBusy])

  const retryNotificationAction = useCallback(async (id) => {
    const retried = retryNotification(db.notifications, id)
    return withBusy(`retry:${id}`, async () => {
      try {
        const { queue, results } = await dispatchQueue(retried, getDefaultProvider())
        const result = results.find((entry) => entry.id === id) ?? queue.find((entry) => entry.id === id)
        commit((previous) => appendActivity({
          ...previous,
          notifications: mergeQueue(previous.notifications, queue),
        }, currentUser?.id, {
          action: 'notification.retried',
          entityType: 'notification',
          entityId: id,
          meta: { name: result?.clientLabel ?? '' },
        }))
        toast({ title: t('notifications.retried'), color: 'blue' })
        return { ok: true, notification: result }
      } catch (error) {
        return { ok: false, error: error?.message }
      }
    })
  }, [commit, currentUser?.id, db.notifications, t, toast, withBusy])

  const cancelNotificationAction = useCallback((id) => {
    commit((previous) => ({ ...previous, notifications: cancelQueueEntry(previous.notifications, id) }))
    toast({ title: t('notifications.cancelled'), color: 'gray' })
    return { ok: true }
  }, [commit, t, toast])

  const retryAllNotifications = useCallback(async () => {
    const retried = retryAllFailed(db.notifications)
    if (selectDispatchable(retried).length === 0) {
      toast({ title: t('notifications.noDue'), color: 'blue' })
      return { ok: true, processed: 0 }
    }
    return withBusy('retryAll', async () => {
      try {
        const { queue, results } = await dispatchQueue(retried, getDefaultProvider())
        commit((previous) => appendActivity({
          ...previous,
          notifications: mergeQueue(previous.notifications, queue),
        }, currentUser?.id, {
          action: 'notification.retried',
          entityType: 'notification',
          entityId: null,
          meta: { count: results.length },
        }))
        const sent = results.filter((result) => ['sent', 'delivered'].includes(result.status)).length
        const failed = results.filter((result) => result.status === 'failed').length
        toast({
          title: t('notifications.retryAllDone'),
          message: `${sent} sent · ${failed} failed`,
          color: failed > 0 ? 'orange' : 'teal',
        })
        return { ok: true, processed: results.length }
      } catch (error) {
        toast({ title: t('toast.error'), message: error?.message, color: 'red' })
        return { ok: false, error: error?.message }
      }
    })
  }, [commit, currentUser?.id, db.notifications, t, toast, withBusy])

  const simulateInboundReply = useCallback(({ client, body = '1', relatedId = null }) => {
    if (!client) return { ok: false }
    const related = relatedId ?? (db.notifications ?? []).find((entry) => (
      entry.direction !== 'inbound' && entry.clientId === client.id
    ))?.id ?? null
    return recordInboundReply(db.notifications, {
      from: client.phone,
      body,
      trusted: true,
      relatedId: related,
    }).then((result) => {
      if (!result.ok) return result
      commit((previous) => appendActivity({
        ...previous,
        notifications: mergeQueue(previous.notifications, result.queue),
      }, currentUser?.id, {
        action: 'notification.reply',
        entityType: 'notification',
        entityId: result.inbound?.id,
        meta: { name: clientName(client), intent: result.inbound?.intent },
      }))
      toast({ title: t('notifications.replyRecorded'), color: 'teal' })
      return result
    })
  }, [commit, currentUser?.id, db.notifications, t, toast])

  const ingestDeliveryReceipt = useCallback((receipt, verify) => {
    const result = applyDeliveryReceipt(db.notifications, receipt, { verify })
    if (result.ok) {
      commit((previous) => ({
        ...previous,
        notifications: mergeQueue(previous.notifications, result.queue),
      }))
    }
    return result
  }, [commit, db.notifications])

  const recordCall = useCallback((input) => {
    const log = createCallLog({ ...input, workerId: currentUser?.id ?? input?.workerId }, new Date())
    commit((previous) => appendActivity({
      ...previous,
      callLogs: [log, ...previous.callLogs],
    }, currentUser?.id, {
      action: 'call.logged',
      entityType: 'call',
      entityId: log.id,
      meta: { name: log.clientName, outcome: log.outcome },
      isDemo: log.isDemo,
    }))
    toast({ title: t('calls.logged'), color: 'blue' })
    return { ok: true, call: log }
  }, [commit, currentUser?.id, t, toast])

  const updateCallNotes = useCallback((callId, notes) => {
    commit((previous) => ({
      ...previous,
      callLogs: previous.callLogs.map((log) => (log.id === callId ? { ...log, notes } : log)),
    }))
    return { ok: true }
  }, [commit])

  const markCallFollowUp = useCallback((callId) => {
    commit((previous) => ({
      ...previous,
      callLogs: previous.callLogs.map((log) => (log.id === callId ? markCallFollowUpDone(log) : log)),
    }))
    toast({ title: t('calls.followUpDone'), color: 'teal' })
    return { ok: true }
  }, [commit, t, toast])

  const queueCallFollowUp = useCallback((call, client) => {
    if (!call || !client) return { ok: false }
    const result = queueNotification({
      client,
      type: 'followUp',
      language: call.language,
      allowDuplicate: true,
    })
    if (result.ok) {
      commit((previous) => ({
        ...previous,
        callLogs: previous.callLogs.map((log) => (
          log.id === call.id ? attachFollowUpNotification(log, result.notification.id) : log
        )),
      }))
      toast({ title: t('calls.followUpQueued'), color: 'teal' })
    }
    return result
  }, [commit, queueNotification, t, toast])

  const addWorker = useCallback(async (input) => {
    return withBusy('worker', async () => {
      const validation = validateWorker(input, { workers: db.workers })
      if (!validation.valid) return { ok: false, errors: validation.errors }
      let passwordHash = null
      if (input.password) {
        const issues = passwordIssues(input.password)
        if (issues.length > 0) return { ok: false, errors: { password: issues[0] } }
        passwordHash = await hashPassword(input.password)
      }
      const now = new Date()
      const worker = {
        id: randomId('chw'),
        type: 'worker',
        code: nextWorkerCode(db.workers),
        ...validation.value,
        active: true,
        approvalStatus: 'active',
        passwordHash,
        requiresPasswordReset: !passwordHash,
        isDemo: false,
        registrationDate: toInput(now),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      }
      commit((previous) => appendActivity({ ...previous, workers: [...previous.workers, worker] }, currentUser?.id, {
        action: 'worker.created',
        entityType: 'worker',
        entityId: worker.id,
        meta: { name: worker.fullName },
      }))
      toast({ title: t('workers.saveSuccess'), color: 'teal' })
      return { ok: true, worker }
    })
  }, [commit, currentUser?.id, db.workers, t, toast, withBusy])

  const updateWorker = useCallback(async (id, input) => {
    return withBusy(`worker:${id}`, async () => {
      const existing = (db.workers ?? []).find((worker) => worker.id === id)
      if (!existing) return { ok: false }
      const validation = validateWorker({ ...existing, ...input }, { workers: db.workers, excludeId: id })
      if (!validation.valid) return { ok: false, errors: validation.errors }
      let passwordHash = existing.passwordHash
      let requiresPasswordReset = existing.requiresPasswordReset
      if (input.password) {
        const issues = passwordIssues(input.password)
        if (issues.length > 0) return { ok: false, errors: { password: issues[0] } }
        passwordHash = await hashPassword(input.password)
        requiresPasswordReset = false
      }
      const updated = {
        ...existing,
        ...validation.value,
        passwordHash,
        requiresPasswordReset,
        updatedAt: new Date().toISOString(),
      }
      commit((previous) => appendActivity({
        ...previous,
        workers: previous.workers.map((worker) => (worker.id === id ? updated : worker)),
        notifications: previous.notifications.map((entry) => (
          entry.workerId === id ? { ...entry, workerId: id } : entry
        )),
      }, currentUser?.id, {
        action: 'worker.updated',
        entityType: 'worker',
        entityId: id,
        meta: { name: updated.fullName },
      }))
      toast({ title: t('workers.saveSuccess'), color: 'teal' })
      return { ok: true, worker: updated }
    })
  }, [commit, currentUser?.id, db.workers, t, toast, withBusy])

  const deleteWorker = useCallback((id) => {
    if (id === currentUser?.id) return { ok: false, error: 'self' }
    const existing = (db.workers ?? []).find((worker) => worker.id === id)
    if (!existing) return { ok: false }
    const now = new Date().toISOString()
    commit((previous) => appendActivity({
      ...previous,
      workers: previous.workers.filter((worker) => worker.id !== id),
      mothers: previous.mothers.map((mother) => (mother.workerId === id ? { ...mother, workerId: null, updatedAt: now } : mother)),
      babies: previous.babies.map((baby) => (baby.workerId === id ? { ...baby, workerId: null, updatedAt: now } : baby)),
    }, currentUser?.id, {
      action: 'worker.deleted',
      entityType: 'worker',
      entityId: id,
      meta: { name: existing.fullName },
    }))
    toast({ title: t('common.deleted'), color: 'gray' })
    return { ok: true }
  }, [commit, currentUser?.id, db.workers, t, toast])

  const toggleWorkerActive = useCallback((id) => {
    commit((previous) => ({
      ...previous,
      workers: previous.workers.map((worker) => (
        worker.id === id ? { ...worker, active: !worker.active, updatedAt: new Date().toISOString() } : worker
      )),
    }))
    return { ok: true }
  }, [commit])

  const assignClients = useCallback((workerId, { motherIds = [], babyIds = [] } = {}) => {
    const now = new Date().toISOString()
    commit((previous) => appendActivity({
      ...previous,
      mothers: previous.mothers.map((mother) => (
        mother.workerId === workerId || motherIds.includes(mother.id)
          ? { ...mother, workerId: motherIds.includes(mother.id) ? workerId : null, updatedAt: now }
          : mother
      )),
      babies: previous.babies.map((baby) => (
        baby.workerId === workerId || babyIds.includes(baby.id)
          ? { ...baby, workerId: babyIds.includes(baby.id) ? workerId : null, updatedAt: now }
          : baby
      )),
    }, currentUser?.id, {
      action: 'worker.assigned',
      entityType: 'worker',
      entityId: workerId,
      meta: { name: (previous.workers ?? []).find((worker) => worker.id === workerId)?.fullName ?? '' },
    }))
    toast({ title: t('workers.assignSaved'), color: 'teal' })
    return { ok: true }
  }, [commit, currentUser?.id, t, toast])

  const exportData = useCallback(() => exportDatabase(db), [db])

  const importData = useCallback((contents) => {
    try {
      const imported = importDatabase(contents)
      setDb(imported)
      revisionRef.current = imported.revision ?? 0
      const stillExists = (imported.workers ?? []).find((worker) => worker.id === currentUserId && worker.active)
      if (!stillExists) {
        setCurrentUserId(null)
        clearSession()
      }
      toast({ title: t('settings.importSuccess'), color: 'teal' })
      return { ok: true }
    } catch (error) {
      toast({ title: t('settings.importError'), message: error?.message, color: 'red' })
      return { ok: false, error }
    }
  }, [currentUserId, t, toast])

  const clearData = useCallback(() => {
    clearAllData()
    const empty = createEmptyDatabase()
    setDb(empty)
    revisionRef.current = 0
    setCurrentUserId(null)
    setSession(null)
    setScopeWorkerId(null)
  }, [])

  const loadDemoData = useCallback(() => {
    if (!currentUser) return { ok: false }
    const demo = generateDemoData({ adminId: currentUser.id })
    commit((previous) => {
      const cleaned = stripDemoData(previous)
      return appendActivity({
        ...cleaned,
        mothers: [...cleaned.mothers, ...demo.mothers],
        babies: [...cleaned.babies, ...demo.babies],
        visitRecords: { ...cleaned.visitRecords, ...demo.visitRecords },
        notifications: [...demo.notifications, ...cleaned.notifications],
        callLogs: [...demo.callLogs, ...cleaned.callLogs],
        activities: [...demo.activities, ...cleaned.activities],
      }, currentUser.id, {
        action: 'demo.loaded',
        entityType: 'system',
        entityId: null,
        meta: {},
        isDemo: true,
      })
    })
    toast({ title: t('settings.demoLoaded'), color: 'teal' })
    return { ok: true }
  }, [commit, currentUser, t, toast])

  const removeDemoData = useCallback(() => {
    commit((previous) => stripDemoData(previous))
    toast({ title: t('settings.demoRemoved'), color: 'gray' })
    return { ok: true }
  }, [commit, t, toast])

  // Automatic retry processing. It only runs when notifications are due and
  // the browser is online, and never requires a user to keep a page open.
  useEffect(() => {
    if (!ready || !currentUser) return undefined
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return undefined
    const timer = setInterval(() => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return
      if (selectDispatchable(db.notifications).length > 0) processQueue({ silent: true })
    }, 60_000)
    return () => clearInterval(timer)
  }, [currentUser, db.notifications, processQueue, ready])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const onOnline = () => {
      if (selectDispatchable(db.notifications).length > 0) processQueue({ silent: true })
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [db.notifications, processQueue])

  const scopedMothers = useMemo(
    () => (isAdmin ? db.mothers : (db.mothers ?? []).filter((mother) => mother.workerId === currentUser?.id)),
    [currentUser?.id, db.mothers, isAdmin],
  )
  const scopedBabies = useMemo(
    () => (isAdmin ? db.babies : (db.babies ?? []).filter((baby) => baby.workerId === currentUser?.id)),
    [currentUser?.id, db.babies, isAdmin],
  )

  const notificationSummary = useMemo(() => summarizeNotifications(db.notifications), [db.notifications])
  const counts = useMemo(() => databaseCounts(db), [db])

  const value = useMemo(() => ({
    db,
    ready,
    currentUser,
    isAdmin,
    language,
    locale,
    t,
    session,
    storageAvailable,
    storageError,
    scopeWorkerId,
    visibleWorkerId,
    setScopeWorkerId,
    toasts,
    toast,
    dismissToast,
    busy,
    counts,
    scopedMothers,
    scopedBabies,
    notificationSummary,
    login,
    register,
    loginDemo,
    logout,
    recoverPassword,
    approveWorker,
    rejectWorker,
    addMother,
    updateMother,
    deleteMother,
    addBaby,
    updateBaby,
    deleteBaby,
    addGrowthRecord,
    completeVisit,
    cancelVisit,
    reopenVisit,
    saveVisitNotes,
    queueNotification,
    sendNotification,
    processQueue,
    retryNotificationAction,
    retryAllNotifications,
    cancelNotificationAction,
    simulateInboundReply,
    ingestDeliveryReceipt,
    recordCall,
    updateCallNotes,
    markCallFollowUp,
    queueCallFollowUp,
    addWorker,
    updateWorker,
    deleteWorker,
    toggleWorkerActive,
    assignClients,
    setLanguage,
    setDefaultNotificationLanguage,
    setPageSize,
    exportData,
    importData,
    clearData,
    loadDemoData,
    removeDemoData,
  }), [
    addBaby, addGrowthRecord, addMother, addWorker, approveWorker, assignClients, busy, cancelNotificationAction,
    cancelVisit, clearData, completeVisit, counts, currentUser, db, deleteBaby, deleteMother,
    deleteWorker, dismissToast, exportData, importData, ingestDeliveryReceipt, isAdmin, language,
    loadDemoData, locale, login, loginDemo, logout, markCallFollowUp, notificationSummary, processQueue,
    queueCallFollowUp, queueNotification, ready, recordCall, recoverPassword, register, rejectWorker, removeDemoData, reopenVisit,
    retryNotificationAction, retryAllNotifications, saveVisitNotes, scopeWorkerId, scopedBabies, scopedMothers, sendNotification,
    session, setDefaultNotificationLanguage, setLanguage, setPageSize, simulateInboundReply, storageAvailable,
    storageError, t, toast, toasts, toggleWorkerActive, updateBaby, updateCallNotes, updateMother,
    updateWorker, visibleWorkerId,
  ])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used inside AppProvider')
  return context
}
