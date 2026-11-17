import { useMemo, useState } from 'react'
import {
  ActionIcon,
  Avatar,
  Badge,
  Button,
  Card,
  Divider,
  Grid,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { PageHeader } from '../components/PageHeader.jsx'
import { EmptyState } from '../components/EmptyState.jsx'
import { ClientStatusBadge } from '../components/StatusBadge.jsx'
import { VisitList } from '../components/VisitList.jsx'
import { NotificationStatusBadge } from '../components/StatusBadge.jsx'
import { ConfirmModal } from '../components/ConfirmModal.jsx'
import { SendNotificationModal } from '../components/SendNotificationModal.jsx'
import { CallSimulationModal } from '../components/CallSimulationModal.jsx'
import { Icon } from '../components/Icon.jsx'
import { formatDate, formatDateTime } from '../lib/dates.js'
import { buildAllVisits, nextActionableVisit } from '../lib/visits.js'
import { motherStatus } from '../lib/clients.js'

function Info({ label, value }) {
  return (
    <Stack gap={1}>
      <Text size="xs" tt="uppercase" fw={700} c="dimmed">{label}</Text>
      <Text size="sm">{value || '—'}</Text>
    </Stack>
  )
}

export function MotherProfilePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const {
    t, db, currentUser, isAdmin, locale, language, deleteMother, simulateInboundReply,
  } = useApp()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [notifyOpen, setNotifyOpen] = useState(false)
  const [callOpen, setCallOpen] = useState(false)

  const mother = (db.mothers ?? []).find((entry) => entry.id === id)
  const allowed = mother && (isAdmin || mother.workerId === currentUser?.id)

  const visits = useMemo(
    () => (allowed ? buildAllVisits(db).filter((visit) => visit.clientType === 'mother' && visit.clientId === id) : []),
    [db, id, allowed],
  )
  const nextVisit = useMemo(() => nextActionableVisit(visits), [visits])
  const babies = (db.babies ?? []).filter((baby) => baby.motherId === id)
  const notifications = (db.notifications ?? [])
    .filter((entry) => entry.clientId === id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5)
  const calls = (db.callLogs ?? [])
    .filter((log) => log.clientId === id)
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 5)
  const worker = (db.workers ?? []).find((entry) => entry.id === mother?.workerId)

  if (!allowed) {
    return (
      <EmptyState
        icon="alert"
        title={t('mothers.notFound')}
        actionLabel={t('common.back')}
        onAction={() => navigate('/mothers')}
      />
    )
  }

  const handleDelete = () => {
    deleteMother(mother.id)
    setConfirmDelete(false)
    navigate('/mothers')
  }

  return (
    <>
      <PageHeader
        title={mother.fullName}
        subtitle={`${mother.code} · ${mother.village}`}
        actions={(
          <>
            <Button variant="default" leftSection={<Icon name="edit" size={16} />} onClick={() => navigate(`/mothers/${mother.id}/edit`)}>
              {t('common.edit')}
            </Button>
            <Button variant="light" leftSection={<Icon name="phone" size={16} />} onClick={() => setCallOpen(true)}>
              {t('calls.reminder')}
            </Button>
            <Button leftSection={<Icon name="bell" size={16} />} onClick={() => setNotifyOpen(true)} disabled={!mother.consentReminders}>
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
                <Avatar color="pink" size={54} radius="xl">{mother.fullName.slice(0, 1)}</Avatar>
                <Stack gap={2}>
                  <Group gap="xs">
                    <Title order={2}>{mother.fullName}</Title>
                    <ClientStatusBadge status={motherStatus(mother)} type="mother" />
                  </Group>
                  <Text size="sm" c="dimmed">{mother.code} · {t('mothers.age')}: {mother.age}</Text>
                </Stack>
              </Group>
              {nextVisit ? (
                <Paper withBorder p="xs" className="next-visit-box">
                  <Text size="xs" c="dimmed">{t('mothers.nextVisit')}</Text>
                  <Text size="sm" fw={650}>{nextVisit.name?.[language] ?? nextVisit.name?.en}</Text>
                  <Text size="xs">{formatDate(nextVisit.scheduledDate, locale)}</Text>
                </Paper>
              ) : null}
            </Group>
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
              <Info label={t('mothers.phone')} value={<a href={`tel:${mother.phone}`}>{mother.phone}</a>} />
              <Info label={t('mothers.village')} value={mother.village} />
              <Info label={t('mothers.address')} value={mother.address} />
              <Info label={t('mothers.expectedDelivery')} value={formatDate(new Date(`${mother.expectedDeliveryDate}T12:00:00`), locale)} />
              <Info label={t('mothers.actualDelivery')} value={mother.actualDeliveryDate ? formatDate(new Date(`${mother.actualDeliveryDate}T12:00:00`), locale) : ''} />
              <Info label={t('mothers.registrationDate')} value={mother.registrationDate ? formatDate(new Date(`${mother.registrationDate}T12:00:00`), locale) : ''} />
              <Info label={t('mothers.assignedWorker')} value={worker?.fullName ?? t('workers.none')} />
              <Info label={t('mothers.notificationLanguage')} value={t(`language.${mother.language ?? 'sw'}`)} />
              <Info label={t('mothers.consent')} value={mother.consentReminders ? t('common.yes') : t('common.no')} />
            </SimpleGrid>
            {mother.notes ? (
              <>
                <Divider my="md" />
                <Text size="xs" tt="uppercase" fw={700} c="dimmed" mb={4}>{t('mothers.notes')}</Text>
                <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{mother.notes}</Text>
              </>
            ) : null}
          </Card>

          <Card mb="md">
            <Group justify="space-between" mb="sm">
              <Title order={3}>{t('mothers.visits')}</Title>
              <Button size="compact-sm" variant="subtle" component={Link} to={`/visits?client=${mother.id}`}>{t('common.viewAll')}</Button>
            </Group>
            <VisitList visits={visits} showClient={false} dense />
          </Card>

          <Card>
            <Group justify="space-between" mb="sm">
              <Title order={3}>{t('mothers.linkedBabies')}</Title>
              <Button size="compact-sm" variant="light" leftSection={<Icon name="plus" size={14} />} onClick={() => navigate(`/babies/new?motherId=${mother.id}`)}>
                {t('mothers.addBaby')}
              </Button>
            </Group>
            {babies.length === 0 ? (
              <Text size="sm" c="dimmed">{t('mothers.noBabies')}</Text>
            ) : (
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                {babies.map((baby) => (
                  <Paper key={baby.id} withBorder p="sm">
                    <Group justify="space-between">
                      <Stack gap={2}>
                        <Text fw={650} component={Link} to={`/babies/${baby.id}`}>{baby.fullName}</Text>
                        <Text size="xs" c="dimmed">{baby.code} · {formatDate(new Date(`${baby.dateOfBirth}T12:00:00`), locale)}</Text>
                      </Stack>
                      <ClientStatusBadge status="active" type="baby" />
                    </Group>
                  </Paper>
                ))}
              </SimpleGrid>
            )}
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>
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
                <Button
                  variant="subtle"
                  size="compact-xs"
                  onClick={() => simulateInboundReply({ client: { ...mother, type: 'mother' }, body: '1' })}
                >
                  {t('notifications.simulateReply')}
                </Button>
              </Stack>
            )}
          </Card>

          <Card mb="md">
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
                      <Badge color={log.outcome === 'confirmed' ? 'green' : log.outcome === 'failed' ? 'red' : 'orange'} size="sm">
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

          <Card>
            <Title order={3} mb="sm">{t('mothers.profile')}</Title>
            <Stack gap="xs">
              <Info label={t('common.id')} value={mother.code} />
              <Info label={t('common.created')} value={formatDateTime(mother.createdAt, locale)} />
              <Info label={t('common.updated')} value={formatDateTime(mother.updatedAt, locale)} />
              <Info label={t('common.status')} value={t(`mother.status.${motherStatus(mother)}`)} />
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      <Text size="xs" c="dimmed" mt="md">{t('privacy.note')}</Text>

      <ConfirmModal
        opened={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title={t('mothers.deleteConfirm')}
        body={t('mothers.deleteWarning')}
        confirmLabel={t('common.delete')}
      />

      <SendNotificationModal
        opened={notifyOpen}
        onClose={() => setNotifyOpen(false)}
        clients={[{ ...mother, type: 'mother' }]}
        defaultClientId={mother.id}
        defaultVisitId={nextVisit?.id ?? ''}
      />

      <CallSimulationModal
        opened={callOpen}
        onClose={() => setCallOpen(false)}
        client={{ ...mother, type: 'mother' }}
        visit={nextVisit}
      />
    </>
  )
}
