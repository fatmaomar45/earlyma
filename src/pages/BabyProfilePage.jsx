import { useMemo, useState } from 'react'
import {
  ActionIcon,
  Alert,
  Avatar,
  Button,
  Card,
  Divider,
  Grid,
  Group,
  Modal,
  NumberInput,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
  Title,
  Tooltip,
} from '@mantine/core'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { PageHeader } from '../components/PageHeader.jsx'
import { EmptyState } from '../components/EmptyState.jsx'
import { ClientStatusBadge, NotificationStatusBadge } from '../components/StatusBadge.jsx'
import { VisitList } from '../components/VisitList.jsx'
import { ConfirmModal } from '../components/ConfirmModal.jsx'
import { SendNotificationModal } from '../components/SendNotificationModal.jsx'
import { CallSimulationModal } from '../components/CallSimulationModal.jsx'
import { Icon } from '../components/Icon.jsx'
import {
  ageParts, formatDate, formatDateTime, parseDate, todayInput,
} from '../lib/dates.js'
import { buildAllVisits, nextActionableVisit } from '../lib/visits.js'

function Info({ label, value }) {
  return (
    <Stack gap={1}>
      <Text size="xs" tt="uppercase" fw={700} c="dimmed">{label}</Text>
      <Text size="sm">{value || '—'}</Text>
    </Stack>
  )
}

export function BabyProfilePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const {
    t, db, currentUser, isAdmin, locale, language, deleteBaby, addGrowthRecord,
  } = useApp()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [notifyOpen, setNotifyOpen] = useState(false)
  const [callOpen, setCallOpen] = useState(false)
  const [growthOpen, setGrowthOpen] = useState(false)
  const [growth, setGrowth] = useState({ date: todayInput(), weightKg: '', heightCm: '', notes: '' })
  const [growthError, setGrowthError] = useState(null)

  const baby = (db.babies ?? []).find((entry) => entry.id === id)
  const allowed = baby && (isAdmin || baby.workerId === currentUser?.id)
  const mother = baby?.motherId ? (db.mothers ?? []).find((entry) => entry.id === baby.motherId) : null
  const worker = (db.workers ?? []).find((entry) => entry.id === baby?.workerId)

  const visits = useMemo(
    () => (allowed ? buildAllVisits(db).filter((visit) => visit.clientType === 'baby' && visit.clientId === id) : []),
    [db, id, allowed],
  )
  const nextVisit = useMemo(() => nextActionableVisit(visits), [visits])
  const notifications = (db.notifications ?? [])
    .filter((entry) => entry.clientId === id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5)
  const calls = (db.callLogs ?? [])
    .filter((log) => log.clientId === id)
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 4)

  if (!allowed) {
    return (
      <EmptyState
        icon="alert"
        title={t('babies.notFound')}
        actionLabel={t('common.back')}
        onAction={() => navigate('/babies')}
      />
    )
  }

  const age = ageParts(new Date(`${baby.dateOfBirth}T12:00:00`))
  const growthRecords = [...(baby.growthRecords ?? [])].sort((a, b) => String(b.date).localeCompare(String(a.date)))

  const handleDelete = () => {
    deleteBaby(baby.id)
    setConfirmDelete(false)
    navigate('/babies')
  }

  const saveGrowth = () => {
    const date = parseDate(growth.date)
    const weight = Number(growth.weightKg)
    const height = Number(growth.heightCm)
    if (!date) {
      setGrowthError(t('validation.measurementDate'))
      return
    }
    if (growth.weightKg !== '' && (!Number.isFinite(weight) || weight < 0.3 || weight > 50)) {
      setGrowthError(t('validation.weightCurrent'))
      return
    }
    if (growth.heightCm !== '' && (!Number.isFinite(height) || height < 20 || height > 150)) {
      setGrowthError(t('validation.height'))
      return
    }
    addGrowthRecord(baby.id, {
      date: growth.date,
      weightKg: growth.weightKg === '' ? null : weight,
      heightCm: growth.heightCm === '' ? null : height,
      notes: growth.notes,
    })
    setGrowthError(null)
    setGrowthOpen(false)
    setGrowth({ date: todayInput(), weightKg: '', heightCm: '', notes: '' })
  }

  return (
    <>
      <PageHeader
        title={baby.fullName}
        subtitle={`${baby.code} · ${baby.village}`}
        actions={(
          <>
            <Button variant="default" leftSection={<Icon name="edit" size={16} />} onClick={() => navigate(`/babies/${baby.id}/edit`)}>
              {t('common.edit')}
            </Button>
            <Button variant="light" leftSection={<Icon name="phone" size={16} />} onClick={() => setCallOpen(true)}>
              {t('calls.reminder')}
            </Button>
            <Button leftSection={<Icon name="bell" size={16} />} onClick={() => setNotifyOpen(true)} disabled={!baby.consentReminders}>
              {t('notifications.sendReminder')}
            </Button>
            <Tooltip label={t('common.delete')}>
              <ActionIcon color="red" variant="light" size="lg" onClick={() => setConfirmDelete(true)} aria-label={t('common.delete')}>
                <Icon name="trash" size={18} />
              </ActionIcon>
            </Tooltip>
          </>
        )}
      />

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Card mb="md">
            <Group justify="space-between" align="flex-start" mb="md" wrap="wrap">
              <Group>
                <Avatar color="blue" size={54} radius="xl">{baby.fullName.slice(0, 1)}</Avatar>
                <Stack gap={2}>
                  <Group gap="xs">
                    <Title order={2}>{baby.fullName}</Title>
                    <ClientStatusBadge status="active" type="baby" />
                  </Group>
                  <Text size="sm" c="dimmed">
                    {baby.code} · {t(`sex.${baby.sex ?? 'unknown'}`)}
                    {age ? ` · ${age.years > 0 ? `${age.years}y ${age.months}m` : `${age.months}m ${age.days}d`}` : ''}
                  </Text>
                </Stack>
              </Group>
              {nextVisit ? (
                <Paper withBorder p="xs" className="next-visit-box">
                  <Text size="xs" c="dimmed">{t('babies.nextVisit')}</Text>
                  <Text size="sm" fw={650}>{nextVisit.name?.[language] ?? nextVisit.name?.en}</Text>
                  <Text size="xs">{formatDate(nextVisit.scheduledDate, locale)}</Text>
                </Paper>
              ) : null}
            </Group>
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
              <Info label={t('babies.dateOfBirth')} value={formatDate(new Date(`${baby.dateOfBirth}T12:00:00`), locale)} />
              <Info label={t('babies.linkedMother')} value={baby.motherName} />
              <Info label={t('babies.village')} value={baby.village} />
              <Info label={t('babies.birthWeight')} value={baby.birthWeightKg ? `${baby.birthWeightKg} kg` : ''} />
              <Info label={t('babies.currentWeight')} value={baby.currentWeightKg ? `${baby.currentWeightKg} kg` : ''} />
              <Info label={t('mothers.assignedWorker')} value={worker?.fullName ?? t('workers.none')} />
              <Info label={t('mothers.notificationLanguage')} value={t(`language.${baby.language ?? 'sw'}`)} />
              <Info label={t('mothers.consent')} value={baby.consentReminders ? t('common.yes') : t('common.no')} />
              <Info label={t('common.created')} value={formatDateTime(baby.createdAt, locale)} />
            </SimpleGrid>
            {baby.notes ? (
              <>
                <Divider my="md" />
                <Text size="xs" tt="uppercase" fw={700} c="dimmed" mb={4}>{t('babies.notes')}</Text>
                <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{baby.notes}</Text>
              </>
            ) : null}
          </Card>

          <Card mb="md">
            <Group justify="space-between" mb="sm">
              <Title order={3}>{t('babies.visits')}</Title>
              <Button size="compact-sm" variant="subtle" component={Link} to={`/visits?client=${baby.id}`}>{t('common.viewAll')}</Button>
            </Group>
            <VisitList visits={visits} showClient={false} dense />
          </Card>

          <Card>
            <Group justify="space-between" mb="sm" wrap="wrap">
              <Title order={3}>{t('babies.growthRecords')}</Title>
              <Button size="compact-sm" variant="light" leftSection={<Icon name="plus" size={14} />} onClick={() => setGrowthOpen(true)}>
                {t('babies.addGrowth')}
              </Button>
            </Group>
            <Alert color="blue" variant="light" mb="sm">{t('babies.growthInfo')}</Alert>
            {growthRecords.length === 0 ? (
              <Text size="sm" c="dimmed">{t('babies.noGrowth')}</Text>
            ) : (
              <Table verticalSpacing="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t('babies.recordDate')}</Table.Th>
                    <Table.Th>{t('babies.weightKg')}</Table.Th>
                    <Table.Th>{t('babies.heightCm')}</Table.Th>
                    <Table.Th>{t('common.notes')}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {growthRecords.map((record) => (
                    <Table.Tr key={record.id}>
                      <Table.Td>{formatDate(new Date(`${record.date}T12:00:00`), locale)}</Table.Td>
                      <Table.Td>{record.weightKg ? `${record.weightKg} kg` : '—'}</Table.Td>
                      <Table.Td>{record.heightCm ? `${record.heightCm} cm` : '—'}</Table.Td>
                      <Table.Td>{record.notes || '—'}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Card mb="md">
            <Group justify="space-between" mb="sm">
              <Title order={3}>{t('babies.linkedMother')}</Title>
            </Group>
            {mother ? (
              <Stack gap="xs">
                <Text fw={650} component={Link} to={`/mothers/${mother.id}`}>{mother.fullName}</Text>
                <Text size="sm" c="dimmed">{mother.code} · {mother.village}</Text>
                <Text size="sm">{mother.phone}</Text>
                <Button size="compact-sm" variant="light" component={Link} to={`/mothers/${mother.id}`}>{t('mothers.viewProfile')}</Button>
              </Stack>
            ) : (
              <Text size="sm" c="dimmed">{t('babies.unlinkedMother')} · {baby.motherName}</Text>
            )}
          </Card>

          <Card mb="md">
            <Group justify="space-between" mb="sm">
              <Title order={3}>{t('notifications.history')}</Title>
              <Button size="compact-xs" variant="subtle" onClick={() => navigate('/notifications')}>{t('common.viewAll')}</Button>
            </Group>
            {notifications.length === 0 ? (
              <Text size="sm" c="dimmed">{t('notifications.noHistory')}</Text>
            ) : (
              <Stack gap="xs">
                {notifications.map((entry) => (
                  <Paper key={entry.id} withBorder p="xs">
                    <Group justify="space-between" gap="xs" wrap="nowrap">
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
              <Title order={3}>{t('calls.history')}</Title>
              <Button size="compact-xs" variant="subtle" onClick={() => navigate('/calls')}>{t('common.viewAll')}</Button>
            </Group>
            {calls.length === 0 ? (
              <Text size="sm" c="dimmed">{t('calls.empty')}</Text>
            ) : (
              <Stack gap="xs">
                {calls.map((log) => (
                  <Paper key={log.id} withBorder p="xs">
                    <Group justify="space-between" gap="xs">
                      <Text size="xs" fw={600}>{t(`calls.outcome.${log.outcome}`)}</Text>
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

      <Text size="xs" c="dimmed" mt="md">{t('privacy.note')}</Text>

      <ConfirmModal
        opened={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title={t('babies.deleteConfirm')}
        body={t('babies.deleteWarning')}
        confirmLabel={t('common.delete')}
      />

      <SendNotificationModal
        opened={notifyOpen}
        onClose={() => setNotifyOpen(false)}
        clients={[{ ...baby, type: 'baby' }]}
        defaultClientId={baby.id}
        defaultVisitId={nextVisit?.id ?? ''}
      />

      <CallSimulationModal
        opened={callOpen}
        onClose={() => setCallOpen(false)}
        client={{ ...baby, type: 'baby' }}
        visit={nextVisit}
      />

      <Modal opened={growthOpen} onClose={() => setGrowthOpen(false)} title={t('babies.addGrowth')} size="md">
        <Stack>
          {growthError ? <Alert color="red">{growthError}</Alert> : null}
          <TextInput
            type="date"
            label={t('babies.recordDate')}
            value={growth.date}
            onChange={(event) => setGrowth((current) => ({ ...current, date: event.currentTarget.value }))}
            required
          />
          <Group grow>
            <NumberInput
              label={t('babies.weightKg')}
              value={growth.weightKg}
              onChange={(value) => setGrowth((current) => ({ ...current, weightKg: value }))}
              min={0.3}
              max={50}
              step={0.1}
              decimalScale={2}
            />
            <NumberInput
              label={t('babies.heightCm')}
              value={growth.heightCm}
              onChange={(value) => setGrowth((current) => ({ ...current, heightCm: value }))}
              min={20}
              max={150}
              step={0.5}
              decimalScale={1}
            />
          </Group>
          <Textarea
            label={t('common.notes')}
            value={growth.notes}
            onChange={(event) => setGrowth((current) => ({ ...current, notes: event.currentTarget.value }))}
            minRows={2}
            autosize
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setGrowthOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={saveGrowth}>{t('common.save')}</Button>
          </Group>
        </Stack>
      </Modal>
    </>
  )
}
