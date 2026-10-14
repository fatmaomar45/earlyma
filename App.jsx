import { useEffect, useMemo, useState } from 'react'
import { useLocalStorage } from '@mantine/hooks'
import {
  Alert, Badge, Button, Card, Container, Group, Paper, SegmentedControl,
  Select, Stack, Text, TextInput, Title,
} from '@mantine/core'
import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { RULES, SMS, SCHEDULE_NOTE } from './data'
import { addDays, buildVisits, fillTemplate, formatDate, parseDate, parseDateOrToday, nextVisit as findNextPendingVisit, startOfToday, statusOf, toInput } from './logic'
import { createNotification, enqueueNotification, dispatchQueue, getDefaultProvider, NOTIFICATION_STORAGE_KEY } from './notifications'

const EMPTY_FORM = { label: '', phone: '', village: '', mode: 'baby', date: '', lang: 'sw' }
const EMPTY_WORKER = { name: '', phone: '', facility: '', email: '' }
const EMPTY_AUTH = { name: '', phone: '', facility: '', email: '', password: '', confirmPassword: '' }

const defaultDateFor = (mode, today) =>
  mode === 'baby' ? toInput(addDays(today, -30)) : toInput(addDays(today, 70))

export default function App() {
  const location = useLocation()
  const today = useMemo(startOfToday, [])

  const [workers, setWorkers] = useLocalStorage({ key: 'earlyma-workers', defaultValue: [] })
  const [clients, setClients] = useLocalStorage({ key: 'earlyma-clients', defaultValue: [] })
  const [history, setHistory] = useLocalStorage({ key: 'earlyma-history', defaultValue: [] })
  const [selectedWorkerId, setSelectedWorkerId] = useLocalStorage({ key: 'earlyma-selected-worker', defaultValue: null })
  const [currentUserId, setCurrentUserId] = useLocalStorage({ key: 'earlyma-current-user-id', defaultValue: null })
  const [form, setForm] = useState({ ...EMPTY_FORM, mode: 'baby', date: defaultDateFor('baby', today) })
  const [workerForm, setWorkerForm] = useState({ ...EMPTY_WORKER })
  const [authForm, setAuthForm] = useState({ ...EMPTY_AUTH })
  const [authError, setAuthError] = useState('')
  const [authMode, setAuthMode] = useState('login')
  const [editingId, setEditingId] = useState(null)
  const [selectedClientId, setSelectedClientId] = useState(null)
  const [callType, setCallType] = useState('remind')
  const [callLog, setCallLog] = useState([])
  const [sentReminders, setSentReminders] = useLocalStorage({ key: 'earlyma-sent-reminders', defaultValue: [] })
  const [notifications, setNotifications] = useLocalStorage({ key: 'earlyma-notifications', defaultValue: [] })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const hasLegacyDemoData = workers.some((worker) => !worker.email && !worker.password)

  useEffect(() => {
    if (!hasLegacyDemoData) return

    setWorkers([])
    setClients([])
    setHistory([])
    setSelectedWorkerId(null)
    setCurrentUserId(null)
    setSelectedClientId(null)
    setCallLog([])
  }, [hasLegacyDemoData, setClients, setCurrentUserId, setHistory, setSelectedClientId, setSelectedWorkerId, setWorkers, setCallLog])

  const currentWorker =
    workers.find((worker) => worker.id === currentUserId || worker.id === selectedWorkerId) ?? null

  const activeWorkerId = currentWorker?.id ?? selectedWorkerId ?? null
  const visibleClients = useMemo(
    () => clients.filter((client) => !activeWorkerId || client.workerId === activeWorkerId),
    [clients, activeWorkerId],
  )

  const rows = useMemo(
    () =>
      visibleClients
        .map((client) => {
          const visits = buildVisits(parseDateOrToday(client.date), RULES[client.mode]).map((visit, index) => ({
            ...visit,
            status: statusOf(visit.date, today, Boolean(client.attended?.[index])),
          }))
          const pending = findNextPendingVisit(visits, client.attended ?? {})
          const nextVisit = (pending?.visit && pending.visit.status.label !== 'Attended' ? pending.visit : visits.find((visit) => visit.status.label !== 'Date passed' && visit.status.label !== 'Attended')) ?? visits[visits.length - 1] ?? null
          return {
            client,
            visits,
            nextVisit,
            status: nextVisit ? nextVisit.status : { label: 'No visit', color: 'gray' },
          }
        })
        .sort((a, b) => (a.nextVisit?.date ?? Infinity) - (b.nextVisit?.date ?? Infinity)),
    [today, visibleClients],
  )

  const selectedRow = rows.find((row) => row.client.id === selectedClientId) ?? rows[0] ?? null
  const selectedClient = selectedRow?.client ?? null
  const followUpQueue = rows.filter((row) => row.status.label === 'Date passed')
  const workerNotifications = useMemo(
    () => notifications.filter((entry) => !activeWorkerId || entry.workerId === activeWorkerId),
    [notifications, activeWorkerId],
  )
  const monthlyHistory = useMemo(() => {
    const filtered = history.filter((entry) => !activeWorkerId || entry.workerId === activeWorkerId)
    return filtered.reduce((acc, entry) => {
      const monthKey = new Date(entry.date).toLocaleString('default', { month: 'long', year: 'numeric' })
      acc[monthKey] = [...(acc[monthKey] ?? []), entry]
      return acc
    }, {})
  }, [history, activeWorkerId])

  const callMessage = selectedClient && selectedRow
    ? fillTemplate(SMS[selectedClient.lang][selectedClient.mode][callType], { date: formatDate(selectedRow.nextVisit.date) })
    : ''

  const addHistoryEntry = (client, action, summary) => {
    if (!currentWorker || !client) return

    setHistory((current) => [{
      id: crypto.randomUUID(),
      workerId: currentWorker.id,
      clientId: client.id,
      clientLabel: client.label,
      action,
      date: toInput(today),
      summary,
    }, ...current])
  }

  const addLog = (text) =>
    setCallLog((current) => [`${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${text}`, ...current])

  const saveClient = () => {
    if (!form.label.trim() || !form.phone.trim() || !form.date) return

    const payload = {
      ...form,
      label: form.label.trim(),
      phone: form.phone.trim(),
      village: form.village.trim(),
      attended: editingId ? (clients.find((client) => client.id === editingId)?.attended ?? {}) : {},
      workerId: activeWorkerId,
    }

    setClients((current) => {
      if (editingId) {
        return current.map((client) => (client.id === editingId ? { ...client, ...payload } : client))
      }

      const newClient = { ...payload, id: crypto.randomUUID() }
      return [...current, newClient]
    })

    if (editingId) {
      setSelectedClientId(editingId)
    }

    setEditingId(null)
    setForm({ ...EMPTY_FORM, mode: form.mode, date: defaultDateFor(form.mode, today) })
  }

  const startEdit = (client) => {
    setEditingId(client.id)
    setSelectedClientId(client.id)
    setForm({
      label: client.label,
      phone: client.phone,
      village: client.village,
      mode: client.mode,
      date: client.date,
      lang: client.lang,
    })
  }

  const resetForm = () => {
    setEditingId(null)
    setForm({ ...EMPTY_FORM, mode: 'baby', date: defaultDateFor('baby', today) })
  }

  const removeClient = (id) => {
    setClients((current) => current.filter((client) => client.id !== id))
    if (selectedClientId === id) {
      const next = clients.find((client) => client.id !== id)
      setSelectedClientId(next?.id ?? null)
    }
  }

  const markAttended = (clientId, visitIndex) => {
    const client = clients.find((entry) => entry.id === clientId)
    if (!client) return

    setClients((current) => current.map((entry) => {
      if (entry.id !== clientId) return entry
      return {
        ...entry,
        attended: { ...entry.attended, [visitIndex]: true },
      }
    }))
    addHistoryEntry(client, 'visit', 'Client attended visit')
    addLog(`${client.label}: marked attended.`)
  }

  const speakMessage = () => {
    if (!selectedClient || !callMessage) {
      addLog('No message to play for the selected client.')
      return
    }

    if (!('speechSynthesis' in window)) {
      addLog('Speech synthesis is not available on this device.')
      return
    }

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(callMessage)
    utterance.lang = selectedClient.lang === 'sw' ? 'sw-KE' : 'en-US'
    window.speechSynthesis.speak(utterance)
    addLog(`Voice reminder played for ${selectedClient.label}.`)
  }

  const lastSentReminder = selectedClient
    ? [...sentReminders].filter((entry) => entry.clientId === selectedClient.id).sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt))[0] ?? null
    : null

  const sendReminder = async () => {
    if (!selectedClient || !callMessage) {
      addLog('No reminder message available for the selected mother.')
      return
    }

    const notification = createNotification(selectedClient, callMessage, callType, activeWorkerId)
    const queued = enqueueNotification(notifications, notification)
    setNotifications(queued)
    addLog(`Queued ${callType} reminder for ${selectedClient.label}.`)

    try {
      const { queue: updated, results } = await dispatchQueue(queued, getDefaultProvider())
      setNotifications(updated)

      const delivered = results[0] || updated.find((entry) => entry.id === notification.id)
      if (delivered?.status === 'sent') {
        const reminderEntry = {
          id: crypto.randomUUID(),
          workerId: activeWorkerId,
          clientId: selectedClient.id,
          clientLabel: selectedClient.label,
          sentAt: delivered.sentAt || new Date().toISOString(),
          phone: selectedClient.phone || 'No phone number saved',
          message: callMessage,
        }
        setSentReminders((current) => [reminderEntry, ...current])
        addHistoryEntry(selectedClient, 'reminder', `Reminder delivered (${delivered.providerMessageId || 'provider ack'})`)
        addLog(`SMS reminder delivered to ${selectedClient.label} on ${selectedClient.phone || 'mobile number'}.`)
      } else {
        addHistoryEntry(selectedClient, 'reminder', `Reminder queued/failed: ${delivered?.error || 'unknown error'}`)
        addLog(`SMS reminder not delivered yet: ${delivered?.error || 'unknown error'}`)
      }
    } catch (error) {
      addLog(`SMS provider error: ${error?.message || 'unknown error'}`)
    }
  }

  const logout = () => {
    setCurrentUserId(null)
    setSelectedWorkerId(null)
    setSelectedClientId(null)
    setCallLog([])
    setAuthForm({ ...EMPTY_AUTH })
    setAuthError('')
  }

  const dashboardPage = (
    <>
      <Alert color="blue" mb="lg">{SCHEDULE_NOTE}</Alert>
      <Card withBorder mb="lg">
        <Title order={3} mb="sm">Overview</Title>
        <Group>
          <Badge color="blue" variant="filled">Workers: {workers.length}</Badge>
          <Badge color="blue" variant="filled">Clients: {visibleClients.length}</Badge>
          <Badge color="orange" variant="filled">Missed visits: {followUpQueue.length}</Badge>
          <Badge color="grape" variant="filled">Queued messages: {workerNotifications.filter((entry) => entry.status !== 'sent').length}</Badge>
        </Group>
      </Card>

      <Card withBorder mb="lg">
        <Title order={4} mb="sm">Worker profile</Title>
        <Select
          label="Community health worker"
          value={activeWorkerId}
          onChange={(value) => {
            const nextWorkerId = value ?? null
            setSelectedWorkerId(nextWorkerId)
            if (nextWorkerId) {
              setCurrentUserId(nextWorkerId)
            }
          }}
          data={workers.map((worker) => ({ value: worker.id, label: `${worker.name} · ${worker.facility}` }))}
        />
        {currentWorker && (
          <Stack gap={4} mt="sm">
            <Text><strong>{currentWorker.name}</strong></Text>
            <Text>{currentWorker.facility}</Text>
            <Text c="dimmed">{currentWorker.phone || 'No phone provided'}</Text>
            <Text c="dimmed">{currentWorker.email || 'No email provided'}</Text>
          </Stack>
        )}
      </Card>

      <Card withBorder>
        <Title order={4} mb="sm">Monthly history</Title>
        {Object.keys(monthlyHistory).length === 0 ? (
          <Text c="dimmed">No monthly history for this worker yet.</Text>
        ) : (
          <Stack gap="md">
            {Object.entries(monthlyHistory).map(([month, entries]) => (
              <div key={month}>
                <Text fw={600} mb="xs">{month}</Text>
                {entries.map((entry) => (
                  <Paper key={entry.id} bg="gray.1" p="xs" radius="sm" mb="xs">
                    <Text size="sm"><strong>{entry.clientLabel}</strong> · {entry.summary}</Text>
                    <Text size="xs" c="dimmed">{entry.action} · {formatDate(parseDateOrToday(entry.date))}</Text>
                  </Paper>
                ))}
              </div>
            ))}
          </Stack>
        )}
      </Card>
    </>
  )

  const clientsPage = (
    <Card withBorder>
      <Title order={3} mb="sm">Client list</Title>
      <Stack gap="sm">
        {rows.length === 0 && <Text c="dimmed">No clients yet.</Text>}
        {rows.map(({ client, nextVisit, status, visits }) => (
          <Card key={client.id} withBorder p="sm">
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <div>
                <Text fw={700}>{client.label}</Text>
                <Text size="sm" c="dimmed">{client.village || 'No village'} · {client.phone}</Text>
                <Text size="sm">{client.mode === 'baby' ? 'Baby' : 'Pregnant mother'} · {nextVisit ? `${nextVisit.en} · ${formatDate(nextVisit.date)}` : 'No visit scheduled'}</Text>
              </div>
              <Stack gap={4}>
                <Badge color={status.color}>{status.label}</Badge>
                {sentReminders.some((entry) => entry.clientId === client.id) && (
                  <Badge color="green" variant="light">Reminder sent</Badge>
                )}
              </Stack>
            </Group>
            <Group mt="sm">
              <Button size="xs" variant={selectedClient?.id === client.id ? 'filled' : 'default'} onClick={() => setSelectedClientId(client.id)}>Select</Button>
              <Button size="xs" variant="default" onClick={() => startEdit(client)}>Edit</Button>
              <Button size="xs" variant="subtle" color="red" onClick={() => removeClient(client.id)}>Delete</Button>
            </Group>
            <Stack gap={4} mt="sm">
              {visits.map((visit, index) => (
                <Group key={`${client.id}-${visit.en}`} justify="space-between">
                  <Text size="sm">{visit.en}</Text>
                  <Group gap="xs">
                    <Badge size="sm" color={visit.status.color}>{visit.status.label}</Badge>
                    {visit.status.label !== 'Date passed' && (
                      <Button size="compact-xs" variant="subtle" onClick={() => markAttended(client.id, index)}>Mark attended</Button>
                    )}
                  </Group>
                </Group>
              ))}
            </Stack>
          </Card>
        ))}
      </Stack>
    </Card>
  )

  const registerPage = (
    <Card withBorder>
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Title order={3}>{editingId ? 'Edit client' : 'Add client'}</Title>
          {editingId && <Button variant="subtle" onClick={resetForm}>Cancel edit</Button>}
        </Group>

        <TextInput size="lg" label="Client code or initials" value={form.label} onChange={(event) => setForm((current) => ({ ...current, label: event.currentTarget.value }))} />
        <TextInput size="lg" label="Mother's phone number" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.currentTarget.value }))} />
        <TextInput size="lg" label="Village" value={form.village} onChange={(event) => setForm((current) => ({ ...current, village: event.currentTarget.value }))} />
        <SegmentedControl
          value={form.mode}
          onChange={(value) => setForm((current) => ({ ...current, mode: value, date: defaultDateFor(value, today) }))}
          data={[
            { label: 'Baby', value: 'baby' },
            { label: 'Pregnant mother', value: 'preg' },
          ]}
        />
        <TextInput size="lg" type="date" label={form.mode === 'baby' ? "Baby's date of birth" : 'Expected delivery date'} value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.currentTarget.value }))} />
        <Select
          label="Language"
          value={form.lang}
          onChange={(value) => setForm((current) => ({ ...current, lang: value || 'sw' }))}
          data={[
            { value: 'sw', label: 'Swahili' },
            { value: 'en', label: 'English' },
          ]}
        />
        <Group>
          <Button onClick={saveClient}>{editingId ? 'Save changes' : 'Save client'}</Button>
          <Button variant="default" onClick={() => setClients((current) => [
            ...current,
            {
              id: crypto.randomUUID(),
              label: 'Demo A',
              phone: '0700 111 222',
              village: 'Sample village',
              mode: 'baby',
              lang: 'sw',
              date: defaultDateFor('baby', today),
              attended: {},
              workerId: activeWorkerId,
            },
          ])}>Add sample client</Button>
        </Group>
      </Stack>
    </Card>
  )

  const schedulePage = (
    <Card withBorder>
      <Title order={3} mb="sm">Visit schedule</Title>
      {selectedClient ? (
        <Stack gap="sm">
          {buildVisits(parseDateOrToday(selectedClient.date), RULES[selectedClient.mode]).map((visit, index) => {
            const attended = Boolean(selectedClient.attended?.[index])
            const status = statusOf(visit.date, today, attended)
            return (
              <Group key={`${selectedClient.id}-${visit.en}-${index}`} justify="space-between" align="center">
                <div>
                  <Text fw={600}>{visit.en}</Text>
                  <Text size="sm" c="dimmed">{formatDate(visit.date)}</Text>
                </div>
                <Badge color={status.color}>{status.label}</Badge>
              </Group>
            )
          })}
        </Stack>
      ) : (
        <Text c="dimmed">Select a client to view the schedule.</Text>
      )}
    </Card>
  )

  const callPage = (
    <Card withBorder>
      <Title order={3} mb="sm">Simulated call</Title>
      {selectedClient ? (
        <>
          <Text size="sm" c="dimmed" mb="sm">Selected mother: {selectedClient.label} · {selectedClient.village} · {selectedClient.phone || 'No phone saved'}</Text>
          <Select
            label="Call type"
            value={callType}
            onChange={(value) => setCallType(value || 'remind')}
            data={[
              { value: 'remind', label: 'Reminder' },
              { value: 'missed', label: 'Missed-visit follow-up' },
            ]}
            mb="sm"
          />
          <Paper bg="gray.1" p="md" radius="md" mb="md">
            <Text fw={600}>SMS preview</Text>
            <Text size="xs" c="dimmed" mb="xs">To: {selectedClient.phone || 'No phone number saved'}</Text>
            {lastSentReminder ? (
              <Text size="xs" c="green" mb="xs">Last reminder sent: {new Date(lastSentReminder.sentAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</Text>
            ) : null}
            <Text style={{ whiteSpace: 'pre-line' }}>
              {callMessage || 'Select a client to generate the call message.'}
            </Text>
          </Paper>
          <Group mb="md">
            <Button onClick={sendReminder} variant={lastSentReminder ? 'filled' : 'default'}>
              {lastSentReminder ? 'Send again' : 'Send SMS reminder'}
            </Button>
            <Button variant="default" onClick={speakMessage}>Play voice</Button>
            <Button variant="default" onClick={() => {
              addHistoryEntry(selectedClient, 'reminder', 'Mother pressed 1 and confirmed the visit')
              addLog(`${selectedClient.label}: mother pressed 1 and confirmed the visit.`)
            }}>Press 1</Button>
            <Button variant="subtle" color="red" onClick={() => {
              addHistoryEntry(selectedClient, 'missed', 'No answer; follow-up queued')
              addLog(`${selectedClient.label}: no answer. Follow-up call queued.`)
            }}>No answer</Button>
          </Group>
        </>
      ) : (
        <Text c="dimmed">No client selected yet.</Text>
      )}

      <Title order={5} mb="xs">Demo call log</Title>
      {callLog.length === 0 ? (
        <Text c="dimmed" size="sm">No call activity yet.</Text>
      ) : (
        <Stack gap={4}>
          {callLog.map((entry, index) => (
            <Text key={`${entry}-${index}`} size="sm">{entry}</Text>
          ))}
        </Stack>
      )}
    </Card>
  )

  const reminderHistory = useMemo(
    () =>
      [...sentReminders]
        .filter((entry) => !activeWorkerId || entry.workerId === activeWorkerId)
        .sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt)),
    [activeWorkerId, sentReminders],
  )

  const monthlyReminderSummary = useMemo(() => {
    const groups = reminderHistory.reduce((acc, entry) => {
      const monthKey = new Date(entry.sentAt).toLocaleString('default', { month: 'long', year: 'numeric' })
      acc[monthKey] = (acc[monthKey] ?? 0) + 1
      return acc
    }, {})

    return Object.entries(groups)
  }, [reminderHistory])

  const historyPage = (
    <Card withBorder>
      <Title order={3} mb="sm">Reminder history</Title>
      <Title order={5} mb="xs" mt="md">Delivery queue</Title>
      {workerNotifications.length === 0 ? (
        <Text c="dimmed" size="sm" mb="md">No queued messages.</Text>
      ) : (
        <Stack gap="xs" mb="lg">
          {workerNotifications.map((entry) => (
            <Paper key={entry.id} bg="gray.1" p="xs" radius="sm">
              <Group justify="space-between" align="flex-start">
                <div>
                  <Text size="sm"><strong>{entry.clientLabel}</strong> · {entry.type}</Text>
                  <Text size="xs" c="dimmed">{entry.phone} · attempts {entry.attempts}/{entry.maxAttempts}</Text>
                  {entry.error && <Text size="xs" c="red">{entry.error}</Text>}
                </div>
                <Badge color={entry.status === 'sent' ? 'green' : entry.status === 'failed' ? 'red' : entry.status === 'sending' ? 'blue' : 'yellow'}>
                  {entry.status}
                </Badge>
              </Group>
              <Text size="xs" c="dimmed" mt="xs">
                {entry.status === 'sent'
                  ? `Delivered ${entry.sentAt ? new Date(entry.sentAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : ''}`
                  : entry.nextRetryAt
                    ? `Next retry ${new Date(entry.nextRetryAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}`
                    : 'No further retries'}
              </Text>
            </Paper>
          ))}
        </Stack>
      )}
      {reminderHistory.length === 0 ? (
        <Text c="dimmed">No reminder history yet.</Text>
      ) : (
        <Stack gap="lg">
          {monthlyReminderSummary.map(([month, count]) => (
            <div key={month}>
              <Text fw={600} mb="xs">{month} · {count} messages</Text>
              <Stack gap="xs">
                {reminderHistory
                  .filter((entry) => new Date(entry.sentAt).toLocaleString('default', { month: 'long', year: 'numeric' }) === month)
                  .map((entry) => (
                    <Paper key={entry.id} bg="gray.1" p="xs" radius="sm">
                      <Text size="sm"><strong>{entry.clientLabel}</strong> · {entry.phone}</Text>
                      <Text size="xs" c="dimmed">{new Date(entry.sentAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</Text>
                      <Text size="sm" mt="xs">{entry.message}</Text>
                    </Paper>
                  ))}
              </Stack>
            </div>
          ))}
        </Stack>
      )}
    </Card>
  )

  const profilePage = (
    <Card withBorder>
      <Title order={3} mb="sm">Worker profile</Title>
      <Stack gap="md">
        <TextInput
          size="lg"
          label="Full name"
          value={workerForm.name || currentWorker.name}
          onChange={(event) => setWorkerForm((current) => ({ ...current, name: event.currentTarget.value }))}
        />
        <TextInput
          size="lg"
          label="Phone number"
          value={workerForm.phone || currentWorker.phone}
          onChange={(event) => setWorkerForm((current) => ({ ...current, phone: event.currentTarget.value }))}
        />
        <TextInput
          size="lg"
          label="Facility"
          value={workerForm.facility || currentWorker.facility}
          onChange={(event) => setWorkerForm((current) => ({ ...current, facility: event.currentTarget.value }))}
        />
        <TextInput
          size="lg"
          label="Email"
          value={workerForm.email || currentWorker.email}
          onChange={(event) => setWorkerForm((current) => ({ ...current, email: event.currentTarget.value }))}
        />
        <Button
          onClick={() => {
            if (!workerForm.name && !workerForm.phone && !workerForm.facility && !workerForm.email) {
              return
            }

            setWorkers((current) => current.map((worker) => worker.id === currentWorker.id ? {
              ...worker,
              name: (workerForm.name || currentWorker.name).trim(),
              phone: (workerForm.phone || currentWorker.phone).trim(),
              facility: (workerForm.facility || currentWorker.facility).trim(),
              email: (workerForm.email || currentWorker.email).trim().toLowerCase(),
            } : worker))

            setWorkerForm({ ...EMPTY_WORKER })
          }}
        >
          Save profile
        </Button>
        <Button variant="default" color="red" onClick={logout}>Log out</Button>
      </Stack>
    </Card>
  )

  const handleAuth = () => {
      const email = authForm.email.trim().toLowerCase()
      const password = authForm.password

      if (authMode === 'login') {
        const account = workers.find((worker) => worker.email === email && worker.password === password)

        if (!account) {
          setAuthError('Invalid email or password. Please register first.')
          return
        }

        setCurrentUserId(account.id)
        setSelectedWorkerId(account.id)
        setAuthError('')
        return
      }

      if (!authForm.name.trim()) {
        setAuthError('Please enter your full name.')
        return
      }

      if (!email || !authForm.password || !authForm.facility.trim()) {
        setAuthError('Please complete all required profile details.')
        return
      }

      if (authForm.password !== authForm.confirmPassword) {
        setAuthError('Passwords do not match.')
        return
      }

      if (workers.some((worker) => worker.email === email)) {
        setAuthError('This email is already registered.')
        return
      }

      const newWorker = {
        id: crypto.randomUUID(),
        name: authForm.name.trim(),
        phone: authForm.phone.trim(),
        facility: authForm.facility.trim(),
        email,
        password: authForm.password,
      }

      setWorkers((current) => [...current, newWorker])
      setCurrentUserId(newWorker.id)
      setSelectedWorkerId(newWorker.id)
      setAuthForm({ ...EMPTY_AUTH })
      setAuthError('')
    }

  const authPage = (
      <Container size="sm" py="xl">
        <Card withBorder p="lg" radius="md">
          <Title order={2} mb="xs">Earlyma</Title>
          <Text c="dimmed" mb="lg">Register and sign in to manage your community health work.</Text>

          <SegmentedControl
            fullWidth
            size="md"
            value={authMode}
            onChange={setAuthMode}
            data={[
              { label: 'Login', value: 'login' },
              { label: 'Register', value: 'register' },
            ]}
            mb="lg"
          />

          <Stack gap="md">
            {authMode === 'register' && (
              <>
                <TextInput
                  size="lg"
                  radius="md"
                  label="Full name"
                  placeholder="Enter your full name"
                  value={authForm.name}
                  onChange={(event) => setAuthForm((current) => ({ ...current, name: event.currentTarget.value }))}
                />
                <TextInput
                  size="lg"
                  radius="md"
                  label="Phone"
                  placeholder="0712 345 678"
                  value={authForm.phone}
                  onChange={(event) => setAuthForm((current) => ({ ...current, phone: event.currentTarget.value }))}
                />
                <TextInput
                  size="lg"
                  radius="md"
                  label="Facility"
                  placeholder="Clinic or health center"
                  value={authForm.facility}
                  onChange={(event) => setAuthForm((current) => ({ ...current, facility: event.currentTarget.value }))}
                />
              </>
            )}

            <TextInput
              size="lg"
              radius="md"
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={authForm.email}
              onChange={(event) => setAuthForm((current) => ({ ...current, email: event.currentTarget.value }))}
            />
            <TextInput
              size="lg"
              radius="md"
              label="Password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              value={authForm.password}
              onChange={(event) => setAuthForm((current) => ({ ...current, password: event.currentTarget.value }))}
              rightSection={
                <Button
                  variant="subtle"
                  size="compact-xs"
                  px="xs"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </Button>
              }
            />

            {authMode === 'register' && (
              <TextInput
                size="lg"
                radius="md"
                label="Confirm password"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Re-enter your password"
                value={authForm.confirmPassword}
                onChange={(event) => setAuthForm((current) => ({ ...current, confirmPassword: event.currentTarget.value }))}
                rightSection={
                  <Button
                    variant="subtle"
                    size="compact-xs"
                    px="xs"
                    onClick={() => setShowConfirmPassword((current) => !current)}
                    aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  >
                    {showConfirmPassword ? 'Hide' : 'Show'}
                  </Button>
                }
              />
            )}

            {authError && <Text c="red" fw={500}>{authError}</Text>}

            <Button size="lg" onClick={handleAuth}>{authMode === 'login' ? 'Login' : 'Create account'}</Button>
          </Stack>
        </Card>
    </Container>
  )

  if (!currentWorker) {
    return authPage
  }

  return (
    <Container size="lg" py="lg">
      <Title order={2}>Earlyma</Title>
      <Text c="dimmed" mb="md">Track mothers and babies, monitor visit timing, and manage follow-up calls.</Text>

      <Group mb="lg">
        {[
          ['/', 'Dashboard'],
          ['/clients', 'Clients'],
          ['/register', 'Register'],
          ['/schedule', 'Schedule'],
          ['/calls', 'Calls'],
          ['/history', 'History'],
          ['/profile', 'Profile'],
        ].map(([path, label]) => (
          <Button
            key={path}
            component={NavLink}
            to={path}
            variant={location.pathname === path ? 'filled' : 'default'}
          >
            {label}
          </Button>
        ))}
      </Group>

      <Routes>
        <Route path="/" element={dashboardPage} />
        <Route path="/clients" element={clientsPage} />
        <Route path="/register" element={registerPage} />
        <Route path="/schedule" element={schedulePage} />
        <Route path="/calls" element={callPage} />
        <Route path="/history" element={historyPage} />
        <Route path="/profile" element={profilePage} />
      </Routes>
    </Container>
  )
}
