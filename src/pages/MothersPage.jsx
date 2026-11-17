import { useEffect, useMemo, useState } from 'react'
import {
  ActionIcon,
  Anchor,
  Button,
  Card,
  Group,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { PageHeader } from '../components/PageHeader.jsx'
import { PaginationBar } from '../components/PaginationBar.jsx'
import { EmptyState } from '../components/EmptyState.jsx'
import { ClientStatusBadge, VisitStatusBadge } from '../components/StatusBadge.jsx'
import { Icon } from '../components/Icon.jsx'
import {
  filterClients,
  motherStatus,
  paginate,
  sortClients,
  uniqueVillages,
} from '../lib/clients.js'
import { buildAllVisits, nextActionableVisit } from '../lib/visits.js'
import { formatDate, todayInput } from '../lib/dates.js'
import { csvDocument, downloadTextFile } from '../lib/csv.js'

export function MothersPage() {
  const { t, db, scopedMothers, locale, isAdmin, setPageSize } = useApp()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [village, setVillage] = useState('')
  const [status, setStatus] = useState('')
  const [workerId, setWorkerId] = useState('')
  const [sortKey, setSortKey] = useState('name')
  const [direction, setDirection] = useState('asc')
  const [page, setPage] = useState(1)
  const pageSize = db.preferences?.pageSize ?? 10

  const visits = useMemo(() => buildAllVisits(db), [db])
  const nextVisits = useMemo(() => {
    const byClient = new Map()
    for (const visit of visits) {
      if (visit.clientType !== 'mother') continue
      const list = byClient.get(visit.clientId) ?? []
      list.push(visit)
      byClient.set(visit.clientId, list)
    }
    const result = new Map()
    for (const [clientId, list] of byClient.entries()) {
      result.set(clientId, nextActionableVisit(list))
    }
    return result
  }, [visits])

  const filtered = useMemo(() => {
    const base = filterClients(scopedMothers, { query, village, status, workerId })
    return sortClients(base, sortKey, direction)
  }, [scopedMothers, query, village, status, workerId, sortKey, direction])

  const paged = paginate(filtered, page, pageSize)

  useEffect(() => { setPage(1) }, [query, village, status, workerId, sortKey, direction, pageSize])

  const villages = useMemo(() => uniqueVillages(scopedMothers), [scopedMothers])
  const workers = db.workers ?? []

  const exportCsv = () => {
    const rows = filtered.map((mother) => {
      const next = nextVisits.get(mother.id)
      return {
        code: mother.code,
        name: mother.fullName,
        age: mother.age,
        phone: mother.phone,
        village: mother.village,
        edd: mother.expectedDeliveryDate,
        status: t(`mother.status.${motherStatus(mother)}`),
        nextVisit: next?.scheduledDateInput ?? '',
        worker: workers.find((worker) => worker.id === mother.workerId)?.fullName ?? '',
      }
    })
    const csv = csvDocument(rows, [
      { key: 'code', label: t('common.id') },
      { key: 'name', label: t('common.name') },
      { key: 'age', label: t('common.age') },
      { key: 'phone', label: t('common.phone') },
      { key: 'village', label: t('common.village') },
      { key: 'edd', label: t('mothers.expectedDelivery') },
      { key: 'status', label: t('common.status') },
      { key: 'nextVisit', label: t('mothers.nextVisit') },
      { key: 'worker', label: t('common.worker') },
    ])
    downloadTextFile(`earlyma-mothers-${todayInput()}.csv`, csv, 'text/csv;charset=utf-8')
  }

  return (
    <>
      <PageHeader
        title={t('mothers.title')}
        subtitle={t('mothers.subtitle')}
        actions={(
          <>
            <Button variant="light" leftSection={<Icon name="download" size={16} />} onClick={exportCsv} disabled={!filtered.length}>
              {t('common.export')}
            </Button>
            <Button leftSection={<Icon name="plus" size={16} />} onClick={() => navigate('/mothers/new')}>
              {t('mothers.add')}
            </Button>
          </>
        )}
      />

      <Card mb="md">
        <Stack gap="sm">
          <Group align="flex-end" gap="sm" wrap="wrap">
            <TextInput
              label={t('common.search')}
              placeholder={t('mothers.searchPlaceholder')}
              leftSection={<Icon name="search" size={16} />}
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              style={{ flex: '1 1 260px' }}
            />
            <Select
              label={t('mothers.statusFilter')}
              value={status}
              onChange={(value) => setStatus(value ?? '')}
              data={[
                { value: '', label: t('common.all') },
                { value: 'pregnant', label: t('mother.status.pregnant') },
                { value: 'postnatal', label: t('mother.status.postnatal') },
                { value: 'inactive', label: t('mother.status.inactive') },
              ]}
              allowDeselect={false}
              w={180}
            />
            <Select
              label={t('reports.village')}
              value={village}
              onChange={(value) => setVillage(value ?? '')}
              data={[{ value: '', label: t('common.all') }, ...villages.map((entry) => ({ value: entry, label: entry }))]}
              allowDeselect={false}
              w={180}
              searchable
            />
            {isAdmin ? (
              <Select
                label={t('common.worker')}
                value={workerId}
                onChange={(value) => setWorkerId(value ?? '')}
                data={[
                  { value: '', label: t('dashboard.allWorkers') },
                  ...workers.map((worker) => ({ value: worker.id, label: worker.fullName })),
                ]}
                allowDeselect={false}
                w={210}
                searchable
              />
            ) : null}
            <Select
              label={t('common.sortBy')}
              value={sortKey}
              onChange={(value) => setSortKey(value ?? 'name')}
              data={[
                { value: 'name', label: t('common.name') },
                { value: 'date', label: t('mothers.expectedDelivery') },
                { value: 'village', label: t('common.village') },
                { value: 'status', label: t('common.status') },
                { value: 'created', label: t('common.created') },
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
            <ActionIcon
              variant="light"
              size="lg"
              aria-label={t('common.sortBy')}
              onClick={() => setDirection((current) => (current === 'asc' ? 'desc' : 'asc'))}
            >
              <Icon name="filter" size={17} />
            </ActionIcon>
          </Group>
          <Text size="xs" c="dimmed">{t('common.showing', { from: paged.from, to: paged.to, total: paged.total })}</Text>
        </Stack>
      </Card>

      {!filtered.length ? (
        <Card>
          <EmptyState
            icon="mother"
            title={t('mothers.empty')}
            description={t('mothers.emptyHint')}
            actionLabel={t('mothers.add')}
            onAction={() => navigate('/mothers/new')}
          />
        </Card>
      ) : (
        <Card p={0}>
          <ScrollArea>
            <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md" miw={900}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('common.name')}</Table.Th>
                  <Table.Th>{t('common.phone')}</Table.Th>
                  <Table.Th>{t('mothers.village')}</Table.Th>
                  <Table.Th>{t('mothers.expectedDelivery')}</Table.Th>
                  <Table.Th>{t('common.status')}</Table.Th>
                  <Table.Th>{t('mothers.nextVisit')}</Table.Th>
                  <Table.Th>{t('common.worker')}</Table.Th>
                  <Table.Th>{t('common.actions')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {paged.items.map((mother) => {
                  const next = nextVisits.get(mother.id)
                  const worker = workers.find((entry) => entry.id === mother.workerId)
                  return (
                    <Table.Tr key={mother.id}>
                      <Table.Td>
                        <Stack gap={0}>
                          <Anchor component={Link} to={`/mothers/${mother.id}`} fw={650}>{mother.fullName}</Anchor>
                          <Text size="xs" c="dimmed">{mother.code} · {mother.age} {t('common.years')}</Text>
                        </Stack>
                      </Table.Td>
                      <Table.Td><Text size="sm">{mother.phone}</Text></Table.Td>
                      <Table.Td>{mother.village}</Table.Td>
                      <Table.Td>{mother.expectedDeliveryDate ? formatDate(new Date(`${mother.expectedDeliveryDate}T12:00:00`), locale) : '—'}</Table.Td>
                      <Table.Td><ClientStatusBadge status={motherStatus(mother)} type="mother" /></Table.Td>
                      <Table.Td>
                        {next ? (
                          <Stack gap={2}>
                            <Text size="xs">{formatDate(next.scheduledDate, locale)}</Text>
                            <VisitStatusBadge status={next.status} />
                          </Stack>
                        ) : <Text size="xs" c="dimmed">{t('mothers.noUpcomingVisit')}</Text>}
                      </Table.Td>
                      <Table.Td>{worker?.fullName ?? <Text size="xs" c="dimmed">{t('workers.none')}</Text>}</Table.Td>
                      <Table.Td>
                        <Group gap={4} wrap="nowrap">
                          <Tooltip label={t('mothers.viewProfile')}>
                            <ActionIcon variant="subtle" component={Link} to={`/mothers/${mother.id}`} aria-label={t('mothers.viewProfile')}>
                              <Icon name="eye" size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label={t('common.edit')}>
                            <ActionIcon variant="subtle" component={Link} to={`/mothers/${mother.id}/edit`} aria-label={t('common.edit')}>
                              <Icon name="edit" size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
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
    </>
  )
}
