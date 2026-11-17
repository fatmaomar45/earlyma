import { useMemo, useState } from 'react'
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Divider,
  Grid,
  Group,
  Modal,
  Paper,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { PageHeader } from '../components/PageHeader.jsx'
import { EmptyState } from '../components/EmptyState.jsx'
import { ConfirmModal } from '../components/ConfirmModal.jsx'
import { SendNotificationModal } from '../components/SendNotificationModal.jsx'
import { CallSimulationModal } from '../components/CallSimulationModal.jsx'
import { CategoryBadge, NotificationStatusBadge, VisitStatusBadge } from '../components/StatusBadge.jsx'
import { Icon } from '../components/Icon.jsx'
import { formatDate, formatDateTime, todayInput } from '../lib/dates.js'
import { getVisitById, visitClientPath } from '../lib/visits.js'

function Detail({ label, value }) {
  return (
    <Stack gap={2}>
      <Text size="xs" tt="uppercase" fw={700} c="dimmed">{label}</Text>
      <Text size="sm">{value || '—'}</Text>
    </Stack>
  )
}

export function VisitDetailsPage() {
  const params = useParams()
  const navigate = useNavigate()
  const {
    t, db, currentUser, isAdmin, language, locale,
    completeVisit, cancelVisit, reopenVisit, saveVisitNotes,
  } = useApp()
  const [completeOpen, setCompleteOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [notifyOpen, setNotifyOpen] = useState(false)
  const [callOpen, setCallOpen] = useState(false)
  const [completionDate, setCompletionDate] = useState(todayInput())
  const [completionNotes, setCompletionNotes] = useState('')
  const [followUpRequired, setFollowUpRequired] = useState(false)
  const [draftNotes, setDraftNotes] = useState(null)
  const [draftFollowUp, setDraftFollowUp] = useState(false)

  let visitId = params.visitId ?? ''
  try {
    visitId = decodeURIComponent(visitId)
  } catch {
    // Keep the raw parameter if it is not valid percent-encoding.
  }

  const visit = useMemo(() => getVisitById(db, visitId), [db, visitId])
  const allowed = visit && (isAdmin || visit.workerId === currentUser?.id)

  const client = useMemo(() => {
    if (!visit) return null
    const source = visit.clientType === 'baby' ? (db.babies ?? []) : (db.mothers ?? [])
    const found = source.find((entry) => entry.id === visit.clientId)
    return found ? { ...found, type: visit.clientType } : null
  }, [db.babies, db.mothers, visit])

  const worker = (db.workers ?? []).find((entry) => entry.id === visit?.workerId)

  const notifications = useMemo(() => (db.notifications ?? [])
    .filter((entry) => entry.clientId === visit?.clientId)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 5), [db.notifications, visit?.clientId])

  const calls = useMemo(() => (db.callLogs ?? [])
    .filter((log) => log.clientId === visit?.clientId)
    .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0))
    .slice(0, 5), [db.callLogs, visit?.clientId])

  if (!allowed) {
    return (
      <EmptyState
        icon="alert"
        title={t('visits.notFound')}
        description={t('visits.scheduleNote')}
        actionLabel={t('common.back')}
        onAction={() => navigate('/visits')}
      />
    )
  }

  const actionable = !['completed', 'cancelled'].includes(visit.status)
  const notesValue = draftNotes ?? visit.notes ?? ''

  const openComplete = () => {
    setCompletionDate(todayInput())
    setCompletionNotes(visit.notes ?? '')
    setFollowUpRequired(Boolean(visit.followUpRequired))
    setCompleteOpen(true)
  }

  const handleComplete = () => {
    completeVisit(visit, {
      completedDate: completionDate || todayInput(),
      notes: completionNotes,
      followUpRequired,
    })
    setCompleteOpen(false)
    setDraftNotes(null)
  }

  const handleCancel = () => {
    cancelVisit(visit)
    setCancelOpen(false)
  }

  const handleReopen = () => {
    reopenVisit(visit)
    setDraftNotes(null)
  }

  const handleSaveNotes = () => {
    saveVisitNotes(visit, notesValue, draftFollowUp ?? visit.followUpRequired)
    setDraftNotes(null)
    setDraftFollowUp(null)
  }

  return (
    <>
      <PageHeader
        title={visit.name?.[language] ?? visit.name?.en}
        subtitle={`${visit.clientName} · ${visit.clientCode}`}
        actions={(
          <>
            <Button variant="default" leftSection={<Icon name="back" size={16} />} onClick={() => navigate('/visits')}>
              {t('common.back')}
            </Button>
            {actionable ? (
              <>
                <Button variant="light" leftSection={<Icon name="bell" size={16} />} onClick={() => setNotifyOpen(true)} disabled={!client?.consentReminders}>
                  {t('notifications.sendReminder')}
                </Button>
                <Button variant="light" color="blue" leftSection={<Icon name="phone" size={16} />} onClick={() => setCallOpen(true)} disabled={!client}>
                  {t('calls.simulate')}
                </Button>
                <Button leftSection={<Icon name="check" size={16} />} onClick={openComplete}>
                  {t('visits.markCompleted')}
                </Button>
                <Button variant="subtle" color="red" onClick={() => setCancelOpen(true)}>
                  {t('visits.markCancelled')}
                </Button>
              </>
            ) : (
              <Button variant="light" color="blue" leftSection={<Icon name="refresh" size={16} />} onClick={handleReopen}>
                {t('visits.reopen')}
              </Button>
            )}
          </>
        )}
      />

      {actionable ? (
        <Alert color="orange" variant="light" mb="md" icon={<Icon name="clock" size={18} />}>
          {t('visits.actionNeeded')} · {t(`visit.status.${visit.status}`)}
        </Alert>
      ) : null}

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Card mb="md">
            <Group justify="space-between" align="flex-start" mb="md" wrap="wrap">
              <Group gap="xs" wrap="wrap">
                <VisitStatusBadge status={visit.status} size="md" />
                <CategoryBadge category={visit.category} />
                {visit.followUpRequired ? <Badge color="orange" variant="light">{t('visits.followUp')}</Badge> : null}
              </Group>
              <Text size="sm" c="dimmed">{formatDate(visit.scheduledDate, locale)}</Text>
            </Group>

            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
              <Detail
                label={t('visits.client')}
                value={<Anchor component={Link} to={visitClientPath(visit)}>{visit.clientName}</Anchor>}
              />
              <Detail label={t('common.id')} value={visit.clientCode} />
              <Detail label={t('common.worker')} value={worker?.fullName ?? t('workers.none')} />
              <Detail label={t('visits.scheduled')} value={formatDate(visit.scheduledDate, locale)} />
              <Detail label={t('visits.category')} value={t(`visit.category.${visit.category}`)} />
              <Detail label={t('common.village')} value={visit.village} />
              <Detail label={t('visits.completion')} value={visit.completedDate ? formatDate(new Date(`${visit.completedDate}T12:00:00`), locale) : ''} />
              <Detail label={t('common.status')} value={t(`visit.status.${visit.status}`)} />
              <Detail label={t('notifications.client')} value={client?.phone ?? ''} />
            </SimpleGrid>

            {visit.notes ? (
              <>
                <Divider my="md" />
                <Text size="xs" tt="uppercase" fw={700} c="dimmed" mb={4}>{t('visits.notes')}</Text>
                <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{visit.notes}</Text>
              </>
            ) : null}
          </Card>

          <Card mb="md">
            <Title order={3} mb="sm">{t('visits.visitNotes')}</Title>
            <Stack>
              <Textarea
                value={notesValue}
                onChange={(event) => setDraftNotes(event.currentTarget.value)}
                minRows={4}
                autosize
                maxLength={1000}
                description={t('visits.visitNotesHint')}
              />
              <Switch
                checked={draftFollowUp ?? visit.followUpRequired}
                onChange={(event) => setDraftFollowUp(event.currentTarget.checked)}
                label={t('visits.followUpRequired')}
              />
              <Group justify="flex-end">
                <Button variant="light" leftSection={<Icon name="check" size={16} />} onClick={handleSaveNotes}>
                  {t('common.saveChanges')}
                </Button>
              </Group>
            </Stack>
          </Card>

          <Card>
            <Title order={3} mb="sm">{t('visits.schedule')}</Title>
            <Stack gap="xs">
              <Group justify="space-between" wrap="wrap">
                <Text size="sm" fw={600}>{visit.source?.title?.[language] ?? visit.source?.title?.en ?? t('schedule.note')}</Text>
                {visit.source?.url ? (
                  <Anchor href={visit.source.url} target="_blank" rel="noreferrer" size="sm">
                    {t('schedule.source')} ({t('schedule.opensInNewTab')})
                  </Anchor>
                ) : null}
              </Group>
              <Text size="xs" c="dimmed">{t('visits.sourceNote')}</Text>
              <Text size="xs" c="dimmed">{t('visits.reopenHint')}</Text>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Card mb="md">
            <Group justify="space-between" mb="sm">
              <Title order={3}>{t('visits.linkedNotifications')}</Title>
              <Button size="compact-xs" variant="subtle" onClick={() => navigate('/notifications')}>{t('common.viewAll')}</Button>
            </Group>
            {notifications.length === 0 ? (
              <Text size="sm" c="dimmed">{t('visits.noLinkedNotifications')}</Text>
            ) : (
              <Stack gap="xs">
                {notifications.map((entry) => (
                  <Paper key={entry.id} withBorder p="xs">
                    <Group justify="space-between" gap="xs" wrap="wrap">
                      <NotificationStatusBadge status={entry.status} />
                      <Text size="xs" c="dimmed">{formatDateTime(entry.createdAt, locale)}</Text>
                    </Group>
                    <Text size="xs" mt={4} lineClamp={2}>{entry.message}</Text>
                  </Paper>
                ))}
              </Stack>
            )}
          </Card>

          <Card>
            <Group justify="space-between" mb="sm">
              <Title order={3}>{t('visits.linkedCalls')}</Title>
              <Button size="compact-xs" variant="subtle" onClick={() => navigate('/calls')}>{t('common.viewAll')}</Button>
            </Group>
            {calls.length === 0 ? (
              <Text size="sm" c="dimmed">{t('visits.noLinkedCalls')}</Text>
            ) : (
              <Stack gap="xs">
                {calls.map((log) => (
                  <Paper key={log.id} withBorder p="xs">
                    <Group justify="space-between" gap="xs" wrap="wrap">
                      <Badge color={log.outcome === 'confirmed' ? 'green' : log.outcome === 'failed' ? 'red' : 'orange'} variant="light">
                        {t(`calls.outcome.${log.outcome}`)}
                      </Badge>
                      <Text size="xs" c="dimmed">{formatDateTime(log.at, locale)}</Text>
                    </Group>
                    <Text size="xs" mt={4} lineClamp={2}>{log.notes || log.message}</Text>
                  </Paper>
                ))}
              </Stack>
            )}
          </Card>
        </Grid.Col>
      </Grid>

      <Modal opened={completeOpen} onClose={() => setCompleteOpen(false)} title={t('visits.completeTitle')} size="md">
        <Stack>
          <TextInput
            type="date"
            label={t('visits.completionDate')}
            value={completionDate}
            onChange={(event) => setCompletionDate(event.currentTarget.value)}
            required
          />
          <Textarea
            label={t('visits.visitNotes')}
            description={t('visits.visitNotesHint')}
            value={completionNotes}
            onChange={(event) => setCompletionNotes(event.currentTarget.value)}
            minRows={3}
            autosize
            maxLength={1000}
          />
          <Switch
            checked={followUpRequired}
            onChange={(event) => setFollowUpRequired(event.currentTarget.checked)}
            label={t('visits.followUpRequired')}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setCompleteOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleComplete}>{t('visits.markCompleted')}</Button>
          </Group>
        </Stack>
      </Modal>

      <ConfirmModal
        opened={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={handleCancel}
        title={t('visits.markCancelled')}
        body={t('visits.confirmCancelBody')}
        confirmLabel={t('visits.markCancelled')}
        color="red"
      />

      {client ? (
        <>
          <SendNotificationModal
            opened={notifyOpen}
            onClose={() => setNotifyOpen(false)}
            clients={[client]}
            defaultClientId={client.id}
            defaultVisitId={visit.id}
            defaultType={visit.status === 'overdue' ? 'missed' : 'remind'}
          />
          <CallSimulationModal
            opened={callOpen}
            onClose={() => setCallOpen(false)}
            client={client}
            visit={visit}
          />
        </>
      ) : null}
    </>
  )
}
