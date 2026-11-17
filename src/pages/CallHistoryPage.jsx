import { useEffect, useMemo, useState } from 'react'
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Modal,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { useApp } from '../context/AppContext.jsx'
import { PageHeader } from '../components/PageHeader.jsx'
import { PaginationBar } from '../components/PaginationBar.jsx'
import { EmptyState } from '../components/EmptyState.jsx'
import { CallSimulationModal } from '../components/CallSimulationModal.jsx'
import { Icon } from '../components/Icon.jsx'
import { clientName, paginate } from '../lib/clients.js'
import {
  CALL_OUTCOME_VALUES,
  filterCalls,
  summarizeCalls,
} from '../lib/calls.js'
import { formatDateTime } from '../lib/dates.js'

const OUTCOME_COLORS = {
  confirmed: 'teal',
  no_answer: 'orange',
  failed: 'red',
  completed: 'blue',
  rescheduled: 'grape',
}

function CallOutcomeBadge({ outcome }) {
  const { t } = useApp()
  return (
    <Badge color={OUTCOME_COLORS[outcome] ?? 'gray'} variant="light">
      {t(`calls.outcome.${outcome}`)}
    </Badge>
  )
}

export function CallHistoryPage() {
  const {
    t,
    db,
    currentUser,
    isAdmin,
    locale,
    setPageSize,
    updateCallNotes,
    markCallFollowUp,
    queueCallFollowUp,
    toast,
  } = useApp()
  const [query, setQuery] = useState('')
  const [outcome, setOutcome] = useState('all')
  const [workerFilter, setWorkerFilter] = useState('')
  const [page, setPage] = useState(1)
  const [detailId, setDetailId] = useState(null)
  const [notes, setNotes] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerClientId, setPickerClientId] = useState('')
  const [simClient, setSimClient] = useState(null)
  const pageSize = db.preferences?.pageSize ?? 10

  const clients = useMemo(() => [
    ...(db.mothers ?? []).map((client) => ({ ...client, type: 'mother' })),
    ...(db.babies ?? []).map((client) => ({ ...client, type: 'baby' })),
  ], [db.mothers, db.babies])

  const scopedLogs = useMemo(() => {
    const logs = db.callLogs ?? []
    const visible = isAdmin ? logs : logs.filter((log) => log.workerId === currentUser?.id)
    return [...visible].sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0))
  }, [db.callLogs, isAdmin, currentUser?.id])

  const filtered = useMemo(() => filterCalls(scopedLogs, {
    workerId: workerFilter,
    outcome: outcome === 'all' ? '' : outcome,
    query,
  }), [scopedLogs, workerFilter, outcome, query])

  const paged = paginate(filtered, page, pageSize)
  const summary = useMemo(() => summarizeCalls(filtered), [filtered])
  const detail = detailId ? scopedLogs.find((log) => log.id === detailId) ?? null : null
  const detailClient = detail ? clients.find((client) => client.id === detail.clientId) ?? null : null
  const pickerClient = clients.find((client) => client.id === pickerClientId) ?? null
  const workers = db.workers ?? []

  useEffect(() => { setPage(1) }, [query, outcome, workerFilter, pageSize])
  useEffect(() => {
    if (detailId && !scopedLogs.some((log) => log.id === detailId)) setDetailId(null)
  }, [detailId, scopedLogs])
  useEffect(() => {
    setNotes(detail?.notes ?? '')
  }, [detail?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const openNewCall = () => {
    setPickerClientId(clients[0]?.id ?? '')
    setPickerOpen(true)
  }

  const startSimulation = () => {
    if (!pickerClient) return
    setPickerOpen(false)
    setSimClient(pickerClient)
  }

  const saveNotes = () => {
    if (!detail) return
    updateCallNotes(detail.id, notes)
    toast({ title: t('calls.notesSaved'), color: 'teal' })
  }

  const handleQueueFollowUp = () => {
    if (!detail || !detailClient) return
    queueCallFollowUp(detail, detailClient)
  }

  return (
    <>
      <PageHeader
        title={t('calls.title')}
        subtitle={t('calls.subtitle')}
        actions={(
          <>
            <Button variant="light" leftSection={<Icon name="phone" size={16} />} onClick={openNewCall} disabled={!clients.length}>
              {t('calls.newCall')}
            </Button>
          </>
        )}
      />

      <SimpleGrid cols={{ base: 2, sm: 3, lg: 5 }} spacing="sm" mb="md">
        <Card padding="sm" className="mini-stat">
          <Text size="xs" c="dimmed" fw={600}>{t('calls.count')}</Text>
          <Text fw={800} fz="xl">{summary.total}</Text>
        </Card>
        <Card padding="sm" className="mini-stat">
          <Text size="xs" c="dimmed" fw={600}>{t('calls.outcome.confirmed')}</Text>
          <Text fw={800} fz="xl">{summary.confirmed}</Text>
        </Card>
        <Card padding="sm" className="mini-stat">
          <Text size="xs" c="dimmed" fw={600}>{t('calls.outcome.no_answer')}</Text>
          <Text fw={800} fz="xl">{summary.no_answer}</Text>
        </Card>
        <Card padding="sm" className="mini-stat">
          <Text size="xs" c="dimmed" fw={600}>{t('calls.outcome.failed')}</Text>
          <Text fw={800} fz="xl" c={summary.failed > 0 ? 'red' : undefined}>{summary.failed}</Text>
        </Card>
        <Card padding="sm" className="mini-stat">
          <Text size="xs" c="dimmed" fw={600}>{t('calls.followUpOpen')}</Text>
          <Text fw={800} fz="xl" c={summary.followUpOpen > 0 ? 'orange' : undefined}>{summary.followUpOpen}</Text>
        </Card>
      </SimpleGrid>

      <Card mb="md">
        <Group align="flex-end" gap="sm" wrap="wrap">
          <TextInput
            label={t('common.search')}
            placeholder={t('calls.searchPlaceholder')}
            leftSection={<Icon name="search" size={16} />}
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            style={{ flex: '1 1 240px' }}
          />
          <Select
            label={t('calls.outcomeFilter')}
            value={outcome}
            onChange={(value) => setOutcome(value ?? 'all')}
            data={[
              { value: 'all', label: t('calls.allOutcomes') },
              ...CALL_OUTCOME_VALUES.map((value) => ({ value, label: t(`calls.outcome.${value}`) })),
            ]}
            allowDeselect={false}
            w={190}
          />
          {isAdmin ? (
            <Select
              label={t('common.worker')}
              value={workerFilter}
              onChange={(value) => setWorkerFilter(value ?? '')}
              data={[
                { value: '', label: t('dashboard.allWorkers') },
                ...workers.map((worker) => ({ value: worker.id, label: worker.fullName })),
              ]}
              allowDeselect={false}
              w={220}
              searchable
            />
          ) : null}
          <Select
            label={t('common.page')}
            value={String(pageSize)}
            onChange={(value) => setPageSize(value)}
            data={['5', '10', '20', '50'].map((value) => ({ value, label: value }))}
            allowDeselect={false}
            w={90}
          />
        </Group>
        <Text size="xs" c="dimmed" mt="sm">{t('calls.demoWarning')}</Text>
      </Card>

      {!filtered.length ? (
        <Card>
          <EmptyState icon="phone" title={t('calls.noCalls')} description={t('calls.noCallsHint')} />
        </Card>
      ) : (
        <Card p={0}>
          <ScrollArea>
            <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md" miw={900}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('calls.dateTime')}</Table.Th>
                  <Table.Th>{t('calls.client')}</Table.Th>
                  <Table.Th>{t('calls.type')}</Table.Th>
                  <Table.Th>{t('calls.outcome')}</Table.Th>
                  <Table.Th>{t('common.worker')}</Table.Th>
                  <Table.Th>{t('calls.followUp')}</Table.Th>
                  <Table.Th>{t('common.actions')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {paged.items.map((log) => {
                  const worker = workers.find((entry) => entry.id === log.workerId)
                  return (
                    <Table.Tr key={log.id}>
                      <Table.Td>{formatDateTime(log.at, locale)}</Table.Td>
                      <Table.Td>
                        <Stack gap={0}>
                          <Text size="sm" fw={600}>{log.clientName}</Text>
                          <Text size="xs" c="dimmed">{log.phone || t('common.notAvailable')}</Text>
                        </Stack>
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="outline" color="gray">
                          {t(log.type === 'missed' ? 'calls.missed' : 'calls.reminder')}
                        </Badge>
                      </Table.Td>
                      <Table.Td><CallOutcomeBadge outcome={log.outcome} /></Table.Td>
                      <Table.Td>{worker?.fullName ?? <Text size="xs" c="dimmed">{t('workers.none')}</Text>}</Table.Td>
                      <Table.Td>
                        {log.followUp?.completedAt ? (
                          <Text size="xs" c="teal">{t('calls.followUpDoneStatus')}</Text>
                        ) : (log.outcome === 'no_answer' || log.outcome === 'failed') ? (
                          <Text size="xs" c="orange">{t('calls.followUpNeeded')}</Text>
                        ) : (
                          <Text size="xs" c="dimmed">{t('calls.noFollowUp')}</Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Tooltip label={t('common.details')}>
                          <ActionIcon variant="subtle" onClick={() => setDetailId(log.id)} aria-label={t('calls.details')}>
                            <Icon name="eye" size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Table.Td>
                    </Table.Tr>
                  )
                })}
              </Table.Tbody>
            </Table>
          </ScrollArea>
          <PaginationBar page={paged.page} totalPages={paged.totalPages} total={paged.total} from={paged.from} to={paged.to} onChange={setPage} />
        </Card>
      )}

      <Modal opened={Boolean(detail)} onClose={() => setDetailId(null)} title={t('calls.details')} size="lg">
        {detail ? (
          <Stack>
            <Group justify="space-between" align="flex-start" wrap="wrap">
              <Group gap="xs" wrap="wrap">
                <CallOutcomeBadge outcome={detail.outcome} />
                <Badge variant="outline" color="gray">
                  {t(detail.type === 'missed' ? 'calls.missed' : 'calls.reminder')}
                </Badge>
                <Badge variant="outline" color="blue">
                  {t(`language.${detail.language ?? 'sw'}`)}
                </Badge>
                {detail.isDemo ? <Badge variant="outline" color="grape">{t('calls.demo')}</Badge> : null}
              </Group>
              <Text size="xs" c="dimmed">{formatDateTime(detail.at, locale)}</Text>
            </Group>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <Stack gap={1}>
                <Text size="xs" tt="uppercase" fw={700} c="dimmed">{t('calls.client')}</Text>
                <Text size="sm" fw={650}>{detail.clientName}</Text>
                <Text size="sm">{detail.phone}</Text>
              </Stack>
              <Stack gap={1}>
                <Text size="xs" tt="uppercase" fw={700} c="dimmed">{t('common.worker')}</Text>
                <Text size="sm">
                  {workers.find((worker) => worker.id === detail.workerId)?.fullName ?? t('workers.none')}
                </Text>
                <Text size="xs" c="dimmed">{detail.simulated ? t('calls.simulated') : t('common.unknown')}</Text>
              </Stack>
            </SimpleGrid>

            <Divider />

            <Stack gap={4}>
              <Text size="xs" tt="uppercase" fw={700} c="dimmed">{t('calls.message')}</Text>
              <Card padding="sm" bg="gray.0" withBorder={false}>
                <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{detail.message || '—'}</Text>
              </Card>
            </Stack>

            <Stack gap={4}>
              <Text size="xs" tt="uppercase" fw={700} c="dimmed">{t('calls.followUp')}</Text>
              {detail.followUp?.completedAt ? (
                <Text size="sm" c="teal">
                  {t('calls.followUpDoneStatus')} · {formatDateTime(detail.followUp.completedAt, locale)}
                </Text>
              ) : (detail.outcome === 'no_answer' || detail.outcome === 'failed') ? (
                <Text size="sm" c="orange">{t('calls.followUpNeeded')}</Text>
              ) : (
                <Text size="sm" c="dimmed">{t('calls.noFollowUp')}</Text>
              )}
              {detail.followUp?.note ? <Text size="sm">{detail.followUp.note}</Text> : null}
            </Stack>

            <Textarea
              label={t('calls.notes')}
              value={notes}
              onChange={(event) => setNotes(event.currentTarget.value)}
              minRows={3}
              autosize
              maxLength={500}
            />

            {!detailClient ? (
              <Text size="xs" c="orange">{t('calls.resolveClient')}</Text>
            ) : null}

            <Group justify="flex-end" wrap="wrap">
              <Button variant="default" onClick={() => setDetailId(null)}>{t('common.close')}</Button>
              <Button variant="light" onClick={saveNotes}>{t('calls.saveNotes')}</Button>
              {(detail.outcome === 'no_answer' || detail.outcome === 'failed') && !detail.followUp?.completedAt ? (
                <>
                  <Button
                    variant="light"
                    leftSection={<Icon name="bell" size={16} />}
                    onClick={handleQueueFollowUp}
                    disabled={!detailClient}
                  >
                    {t('calls.queueFollowUp')}
                  </Button>
                  <Button onClick={() => markCallFollowUp(detail.id)}>{t('calls.markFollowUpDone')}</Button>
                </>
              ) : null}
            </Group>
          </Stack>
        ) : null}
      </Modal>

      <Modal opened={pickerOpen} onClose={() => setPickerOpen(false)} title={t('calls.newCall')} size="md">
        <Stack>
          <AlertBox text={t('calls.demoWarning')} />
          <Select
            label={t('calls.selectClient')}
            value={pickerClientId}
            onChange={(value) => setPickerClientId(value ?? '')}
            data={clients.map((client) => ({
              value: client.id,
              label: `${clientName(client)} · ${client.code ?? ''}`,
            }))}
            searchable
            allowDeselect={false}
            nothingFoundMessage={t('common.noData')}
          />
          <Text size="xs" c="dimmed">{t('calls.selectClientFirst')}</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setPickerOpen(false)}>{t('common.cancel')}</Button>
            <Button leftSection={<Icon name="phone" size={16} />} onClick={startSimulation} disabled={!pickerClient}>
              {t('calls.openSimulator')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <CallSimulationModal
        opened={Boolean(simClient)}
        onClose={() => setSimClient(null)}
        client={simClient}
      />

      <Text size="xs" c="dimmed" mt="lg">{t('calls.demoWarning')}</Text>
    </>
  )
}

function AlertBox({ text }) {
  return (
    <Card padding="sm" bg="blue.0" withBorder={false}>
      <Group gap="xs" wrap="nowrap" align="flex-start">
        <Icon name="shield" size={18} />
        <Text size="sm">{text}</Text>
      </Group>
    </Card>
  )
}
