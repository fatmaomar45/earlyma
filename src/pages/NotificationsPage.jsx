import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  TextInput,
  Timeline,
  Title,
} from '@mantine/core'
import { useApp } from '../context/AppContext.jsx'
import { PageHeader } from '../components/PageHeader.jsx'
import { PaginationBar } from '../components/PaginationBar.jsx'
import { EmptyState } from '../components/EmptyState.jsx'
import { SendNotificationModal } from '../components/SendNotificationModal.jsx'
import { NotificationListItem } from '../components/NotificationListItem.jsx'
import { NotificationStatusBadge } from '../components/StatusBadge.jsx'
import { Icon } from '../components/Icon.jsx'
import { clientName, paginate } from '../lib/clients.js'
import { formatDateTime } from '../lib/dates.js'

const TYPE_OPTIONS = ['remind', 'missed', 'followUp', 'test', 'reply']
const STATUS_OPTIONS = ['queued', 'processing', 'sent', 'delivered', 'failed', 'cancelled', 'received']

export function NotificationsPage() {
  const {
    t, db, currentUser, isAdmin, locale, busy, notificationSummary,
    processQueue, retryNotificationAction, retryAllNotifications,
    cancelNotificationAction, simulateInboundReply, ingestDeliveryReceipt,
    scopedMothers, scopedBabies, setPageSize, toast,
  } = useApp()
  const [tab, setTab] = useState('queue')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [detailId, setDetailId] = useState(null)
  const [composeOpen, setComposeOpen] = useState(false)
  const [replyOpen, setReplyOpen] = useState(false)
  const [replyClientId, setReplyClientId] = useState('')
  const [replyBody, setReplyBody] = useState('1')
  const [replyRelatedId, setReplyRelatedId] = useState(null)
  const pageSize = db.preferences?.pageSize ?? 10

  const clients = useMemo(() => [
    ...(scopedMothers ?? []).map((client) => ({ ...client, type: 'mother' })),
    ...(scopedBabies ?? []).map((client) => ({ ...client, type: 'baby' })),
  ], [scopedMothers, scopedBabies])

  const scoped = useMemo(() => (db.notifications ?? [])
    .filter((entry) => isAdmin || entry.workerId === currentUser?.id)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)), [db.notifications, currentUser?.id, isAdmin])

  const queueEntries = useMemo(() => scoped.filter((entry) => (
    entry.direction !== 'inbound' && ['queued', 'processing', 'failed'].includes(entry.status)
  )), [scoped])

  const historyEntries = useMemo(() => scoped.filter((entry) => (
    entry.direction === 'inbound' || !['queued', 'processing', 'failed'].includes(entry.status)
  )), [scoped])

  const filtered = useMemo(() => {
    const base = tab === 'queue' ? queueEntries : historyEntries
    const needle = query.trim().toLocaleLowerCase()
    return base.filter((entry) => {
      if (statusFilter !== 'all' && entry.status !== statusFilter) return false
      if (typeFilter !== 'all' && entry.type !== typeFilter) return false
      if (!needle) return true
      const haystack = `${entry.clientLabel ?? ''} ${entry.phone ?? ''} ${entry.message ?? ''} ${entry.type ?? ''}`.toLocaleLowerCase()
      return haystack.includes(needle)
    })
  }, [historyEntries, query, queueEntries, statusFilter, tab, typeFilter])

  const paged = paginate(filtered, page, pageSize)
  const detail = detailId ? (db.notifications ?? []).find((entry) => entry.id === detailId) ?? null : null
  const failedCount = queueEntries.filter((entry) => entry.status === 'failed').length
  const replyClient = clients.find((client) => client.id === replyClientId) ?? null

  useEffect(() => { setPage(1) }, [tab, query, statusFilter, typeFilter, pageSize])

  useEffect(() => {
    if (detailId && !(db.notifications ?? []).some((entry) => entry.id === detailId)) setDetailId(null)
  }, [db.notifications, detailId])

  const openReply = (clientId = '', relatedId = null) => {
    setReplyClientId(clientId || clients[0]?.id || '')
    setReplyBody('1')
    setReplyRelatedId(relatedId)
    setReplyOpen(true)
  }

  const submitReply = async () => {
    if (!replyClient) return
    await simulateInboundReply({ client: replyClient, body: replyBody, relatedId: replyRelatedId })
    setReplyOpen(false)
  }

  const simulateReceipt = (entry) => {
    const result = ingestDeliveryReceipt({
      providerMessageId: entry.providerMessageId,
      status: 'delivered',
      deliveredAt: new Date().toISOString(),
      demoVerified: true,
    }, (receipt) => receipt?.demoVerified === true)
    if (result.ok) toast({ title: t('notifications.receiptApplied'), color: 'teal' })
    else toast({ title: t('notifications.receiptRejected'), message: result.error, color: 'red' })
  }

  return (
    <>
      <PageHeader
        title={t('notifications.title')}
        subtitle={t('notifications.subtitle')}
        actions={(
          <>
            <Button variant="default" leftSection={<Icon name="message" size={16} />} onClick={() => openReply()}>
              {t('notifications.inboundSimulator')}
            </Button>
            <Button variant="light" leftSection={<Icon name="refresh" size={16} />} onClick={() => processQueue()} loading={Boolean(busy.queue)}>
              {t('notifications.processQueue')}
            </Button>
            <Button leftSection={<Icon name="bell" size={16} />} onClick={() => setComposeOpen(true)} disabled={!clients.length}>
              {t('notifications.newReminder')}
            </Button>
          </>
        )}
      />

      <SimpleGrid cols={{ base: 2, sm: 3, lg: 5 }} spacing="sm" mb="md">
        <Card padding="sm" className="mini-stat">
          <Text size="xs" c="dimmed" fw={600}>{t('notifications.pending')}</Text>
          <Text fw={800} fz="xl">{notificationSummary.pending}</Text>
        </Card>
        <Card padding="sm" className="mini-stat">
          <Text size="xs" c="dimmed" fw={600}>{t('notifications.status.sent')}</Text>
          <Text fw={800} fz="xl">{notificationSummary.sent}</Text>
        </Card>
        <Card padding="sm" className="mini-stat">
          <Text size="xs" c="dimmed" fw={600}>{t('notifications.status.delivered')}</Text>
          <Text fw={800} fz="xl">{notificationSummary.delivered}</Text>
        </Card>
        <Card padding="sm" className="mini-stat">
          <Text size="xs" c="dimmed" fw={600}>{t('notifications.status.failed')}</Text>
          <Text fw={800} fz="xl" c={failedCount > 0 ? 'red' : undefined}>{notificationSummary.failed}</Text>
        </Card>
        <Card padding="sm" className="mini-stat">
          <Text size="xs" c="dimmed" fw={600}>{t('notifications.status.received')}</Text>
          <Text fw={800} fz="xl">{notificationSummary.received}</Text>
        </Card>
      </SimpleGrid>

      <Tabs value={tab} onChange={(value) => setTab(value ?? 'queue')} mb="md">
        <Tabs.List>
          <Tabs.Tab value="queue" leftSection={<Icon name="clock" size={15} />}>
            {t('notifications.queue')} ({queueEntries.length})
          </Tabs.Tab>
          <Tabs.Tab value="history" leftSection={<Icon name="list" size={15} />}>
            {t('notifications.history')} ({historyEntries.length})
          </Tabs.Tab>
        </Tabs.List>
      </Tabs>

      <Card mb="md">
        <Group align="flex-end" gap="sm" wrap="wrap">
          <TextInput
            label={t('common.search')}
            placeholder={t('notifications.searchPlaceholder')}
            leftSection={<Icon name="search" size={16} />}
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            style={{ flex: '1 1 240px' }}
          />
          <Select
            label={t('notifications.filterStatus')}
            value={statusFilter}
            onChange={(value) => setStatusFilter(value ?? 'all')}
            data={[
              { value: 'all', label: t('notifications.allStatuses') },
              ...STATUS_OPTIONS.map((value) => ({ value, label: t(`notifications.status.${value}`) })),
            ]}
            allowDeselect={false}
            w={180}
          />
          <Select
            label={t('notifications.filterType')}
            value={typeFilter}
            onChange={(value) => setTypeFilter(value ?? 'all')}
            data={[
              { value: 'all', label: t('notifications.allTypes') },
              ...TYPE_OPTIONS.map((value) => ({ value, label: t(`notifications.type.${value}`) })),
            ]}
            allowDeselect={false}
            w={170}
          />
          <Select
            label={t('common.page')}
            value={String(pageSize)}
            onChange={(value) => setPageSize(value)}
            data={['5', '10', '20', '50'].map((value) => ({ value, label: value }))}
            allowDeselect={false}
            w={90}
          />
          {tab === 'queue' && failedCount > 0 ? (
            <Button
              variant="light"
              color="orange"
              leftSection={<Icon name="refresh" size={16} />}
              onClick={() => retryAllNotifications()}
              loading={Boolean(busy.retryAll)}
            >
              {t('notifications.retryAll')}
            </Button>
          ) : null}
        </Group>
        {tab === 'queue' ? <Text size="xs" c="dimmed" mt="sm">{t('notifications.queueHelp')}</Text> : null}
      </Card>

      {!filtered.length ? (
        <Card>
          <EmptyState
            icon="bell"
            title={tab === 'queue' ? t('notifications.noQueue') : t('notifications.empty')}
            description={tab === 'queue' ? t('notifications.noQueueHint') : t('notifications.emptyHint')}
          />
        </Card>
      ) : (
        <Card>
          <Stack gap="sm">
            {paged.items.map((entry) => (
              <NotificationListItem
                key={entry.id}
                entry={entry}
                onView={(item) => setDetailId(item.id)}
                onRetry={(item) => retryNotificationAction(item.id)}
                onCancel={(item) => cancelNotificationAction(item.id)}
                busy={Boolean(busy[`retry:${entry.id}`])}
              />
            ))}
          </Stack>
          <PaginationBar
            page={paged.page}
            totalPages={paged.totalPages}
            total={paged.total}
            from={paged.from}
            to={paged.to}
            onChange={setPage}
          />
        </Card>
      )}

      <Modal opened={Boolean(detail)} onClose={() => setDetailId(null)} title={t('notifications.detailTitle')} size="lg">
        {detail ? (
          <Stack>
            <Group justify="space-between" align="flex-start" wrap="wrap">
              <Group gap="xs" wrap="wrap">
                <NotificationStatusBadge status={detail.status} size="md" />
                <Badge variant="outline" color="gray">
                  {detail.direction === 'inbound' ? t('notifications.inbound') : t('notifications.outbound')}
                </Badge>
                <Badge variant="outline" color="blue">{t(`notifications.type.${detail.type}`)}</Badge>
              </Group>
              <Text size="xs" c="dimmed">{formatDateTime(detail.createdAt, locale)}</Text>
            </Group>

            <Stack gap={4}>
              <Text size="xs" tt="uppercase" fw={700} c="dimmed">{detail.direction === 'inbound' ? t('notifications.sender') : t('notifications.client')}</Text>
              <Text size="sm" fw={650}>{detail.clientLabel}</Text>
              <Text size="sm">{detail.phone}</Text>
            </Stack>

            <Stack gap={4}>
              <Text size="xs" tt="uppercase" fw={700} c="dimmed">{t('notifications.message')}</Text>
              <Card padding="sm" bg="gray.0" withBorder={false}>
                <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{detail.message || '—'}</Text>
              </Card>
            </Stack>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <Text size="sm"><b>{t('common.status')}:</b> {t(`notifications.status.${detail.status}`)}</Text>
              <Text size="sm"><b>{t('notifications.attempts', { attempts: detail.attempts ?? 0, max: detail.maxAttempts ?? 3 })}</b></Text>
              <Text size="sm"><b>{t('notifications.provider')}:</b> {detail.provider || t('settings.notConfigured')}</Text>
              <Text size="sm"><b>{t('notifications.providerId')}:</b> {detail.providerMessageId || '—'}</Text>
              <Text size="sm"><b>{t('notifications.sentAt')}:</b> {detail.sentAt ? formatDateTime(detail.sentAt, locale) : '—'}</Text>
              <Text size="sm"><b>{t('notifications.deliveredAt')}:</b> {detail.deliveredAt ? formatDateTime(detail.deliveredAt, locale) : '—'}</Text>
              <Text size="sm"><b>{t('notifications.nextRetry')}:</b> {detail.nextRetryAt ? formatDateTime(detail.nextRetryAt, locale) : '—'}</Text>
              <Text size="sm"><b>{t('notifications.deliveryReceipt')}:</b> {detail.deliveryReceipt?.verified ? t('notifications.verified') : t('notifications.notVerified')}</Text>
            </SimpleGrid>

            {detail.error ? <Alert color="red" variant="light">{detail.error}</Alert> : null}
            {detail.reply ? (
              <Alert color="teal" variant="light">
                {t('activity.notification.reply', { name: detail.clientLabel, intent: detail.reply.intent })}
              </Alert>
            ) : null}

            <Stack gap="xs">
              <Title order={4}>{t('notifications.eventTimeline')}</Title>
              <Timeline bulletSize={20} lineWidth={2} active={(detail.events ?? []).length}>
                {(detail.events ?? []).map((event, index) => (
                  <Timeline.Item key={`${event.at}-${index}`} title={t(`notifications.status.${event.status === 'reply' ? 'received' : event.status}`, { defaultValue: event.status })}>
                    <Text size="xs" c="dimmed">{formatDateTime(event.at, locale)}</Text>
                    {event.detail ? <Text size="sm">{event.detail}</Text> : null}
                  </Timeline.Item>
                ))}
              </Timeline>
            </Stack>

            {detail.status === 'sent' && detail.providerMessageId ? (
              <Alert color="blue" variant="light" icon={<Icon name="shield" size={18} />}>
                <Stack gap="xs">
                  <Text size="sm">{t('notifications.simulateDeliveryHint')}</Text>
                  <Button size="compact-sm" variant="light" onClick={() => simulateReceipt(detail)}>
                    {t('notifications.simulateDelivery')}
                  </Button>
                </Stack>
              </Alert>
            ) : null}

            <Group justify="flex-end" wrap="wrap">
              {detail.direction !== 'inbound' ? (
                <Button
                  variant="default"
                  leftSection={<Icon name="message" size={16} />}
                  onClick={() => openReply(detail.clientId, detail.id)}
                >
                  {t('notifications.inboundSimulator')}
                </Button>
              ) : null}
              {['queued', 'failed', 'processing'].includes(detail.status) ? (
                <Button
                  variant="light"
                  leftSection={<Icon name="refresh" size={16} />}
                  onClick={() => retryNotificationAction(detail.id)}
                  loading={Boolean(busy[`retry:${detail.id}`])}
                >
                  {t('notifications.retry')}
                </Button>
              ) : null}
              {!['sent', 'delivered', 'cancelled', 'received'].includes(detail.status) ? (
                <Button variant="subtle" color="gray" onClick={() => cancelNotificationAction(detail.id)}>
                  {t('notifications.cancel')}
                </Button>
              ) : null}
              <Button variant="default" onClick={() => setDetailId(null)}>{t('common.close')}</Button>
            </Group>
          </Stack>
        ) : null}
      </Modal>

      <Modal opened={replyOpen} onClose={() => setReplyOpen(false)} title={t('notifications.inboundSimulator')} size="md">
        <Stack>
          <Alert color="blue" variant="light" icon={<Icon name="shield" size={18} />}>
            {t('notifications.inboundSimulatorHint')}
          </Alert>
          <Select
            label={t('notifications.client')}
            value={replyClientId}
            onChange={(value) => setReplyClientId(value ?? '')}
            data={clients.map((client) => ({ value: client.id, label: `${clientName(client)} · ${client.code ?? ''}` }))}
            searchable
            allowDeselect={false}
          />
          <TextInput
            label={t('notifications.replyBody')}
            value={replyBody}
            onChange={(event) => setReplyBody(event.currentTarget.value)}
            placeholder="1 / 2 / STOP / HELP"
            maxLength={200}
          />
          <Text size="xs" c="dimmed">{t('notifications.replyPrompt')}</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setReplyOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={submitReply} disabled={!replyClient || !replyBody.trim()}>{t('notifications.recordReply')}</Button>
          </Group>
        </Stack>
      </Modal>

      <SendNotificationModal
        opened={composeOpen}
        onClose={() => setComposeOpen(false)}
        clients={clients}
      />
    </>
  )
}
