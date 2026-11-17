import { useEffect, useMemo, useState } from 'react'
import {
  ActionIcon,
  Anchor,
  Button,
  Card,
  Group,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { PageHeader } from '../components/PageHeader.jsx'
import { PaginationBar } from '../components/PaginationBar.jsx'
import { EmptyState } from '../components/EmptyState.jsx'
import { CategoryBadge, VisitStatusBadge } from '../components/StatusBadge.jsx'
import { Icon } from '../components/Icon.jsx'
import {
  buildAllVisits, filterVisits, sortVisits, summarizeVisits,
} from '../lib/visits.js'
import { paginate, uniqueVillages } from '../lib/clients.js'
import { formatDate, todayInput } from '../lib/dates.js'
import { csvDocument, downloadTextFile } from '../lib/csv.js'

const STATUS_OPTIONS = ['all', 'due_today', 'due_soon', 'overdue', 'upcoming', 'completed', 'cancelled']
const CATEGORY_OPTIONS = ['all', 'anc', 'pnc', 'immunization', 'growth', 'child_health']

export function VisitsPage() {
  const { t, db, currentUser, isAdmin, locale, language, setPageSize } = useApp()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState(searchParams.get('status') ?? 'all')
  const [category, setCategory] = useState(searchParams.get('category') ?? 'all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [village, setVillage] = useState('')
  const [workerId, setWorkerId] = useState(isAdmin ? '' : (currentUser?.id ?? ''))
  const [sortKey, setSortKey] = useState('date')
  const [direction, setDirection] = useState('asc')
  const [page, setPage] = useState(1)
  const clientId = searchParams.get('client') ?? ''
  const pageSize = db.preferences?.pageSize ?? 10

  const accessibleVisits = useMemo(() => {
    const all = buildAllVisits(db)
    if (isAdmin) return all
    return all.filter((visit) => visit.workerId === currentUser?.id)
  }, [db, isAdmin, currentUser?.id])

  const filtered = useMemo(() => sortVisits(filterVisits(accessibleVisits, {
    query, status, category, dateFrom, dateTo, village, workerId, clientId,
  }), sortKey, direction), [accessibleVisits, query, status, category, dateFrom, dateTo, village, workerId, clientId, sortKey, direction])

  const paged = paginate(filtered, page, pageSize)
  const summary = summarizeVisits(filtered)
  const villages = useMemo(() => uniqueVillages([...(db.mothers ?? []), ...(db.babies ?? [])]), [db.mothers, db.babies])
  const workers = db.workers ?? []

  useEffect(() => { setPage(1) }, [query, status, category, dateFrom, dateTo, village, workerId, sortKey, direction, pageSize, clientId])

  const exportCsv = () => {
    const csv = csvDocument(filtered.map((visit) => ({
      client: visit.clientName,
      code: visit.clientCode,
      visit: visit.name?.[language] ?? visit.name?.en,
      category: t(`visit.category.${visit.category}`),
      date: visit.scheduledDateInput,
      status: t(`visit.status.${visit.status}`),
      worker: workers.find((worker) => worker.id === visit.workerId)?.fullName ?? '',
      completed: visit.completedDate ?? '',
      notes: visit.notes ?? '',
    })), [
      { key: 'client', label: t('visits.client') },
      { key: 'code', label: t('common.id') },
      { key: 'visit', label: t('visits.title') },
      { key: 'category', label: t('visits.category') },
      { key: 'date', label: t('visits.scheduled') },
      { key: 'status', label: t('common.status') },
      { key: 'worker', label: t('common.worker') },
      { key: 'completed', label: t('visits.completedOn') },
      { key: 'notes', label: t('visits.notes') },
    ])
    downloadTextFile(`earlyma-visits-${todayInput()}.csv`, csv, 'text/csv;charset=utf-8')
  }

  const resetFilters = () => {
    setQuery('')
    setStatus('all')
    setCategory('all')
    setDateFrom('')
    setDateTo('')
    setVillage('')
    setWorkerId(isAdmin ? '' : (currentUser?.id ?? ''))
  }

  return (
    <>
      <PageHeader
        title={t('visits.title')}
        subtitle={t('visits.subtitle')}
        actions={(
          <>
            <Button variant="light" leftSection={<Icon name="download" size={16} />} onClick={exportCsv} disabled={!filtered.length}>
              {t('common.export')}
            </Button>
            <Button variant="default" leftSection={<Icon name="refresh" size={16} />} onClick={resetFilters}>{t('common.reset')}</Button>
          </>
        )}
      />

      <SimpleGrid cols={{ base: 2, sm: 3, lg: 6 }} spacing="sm" mb="md">
        {[
          { key: 'due_today', color: 'orange' },
          { key: 'overdue', color: 'red' },
          { key: 'due_soon', color: 'yellow' },
          { key: 'upcoming', color: 'blue' },
          { key: 'completed', color: 'green' },
          { key: 'cancelled', color: 'gray' },
        ].map((item) => (
          <Card key={item.key} padding="sm" className="mini-stat" onClick={() => setStatus(item.key)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter') setStatus(item.key) }}>
            <Group justify="space-between" gap="xs" wrap="nowrap">
              <Stack gap={0}>
                <Text size="xs" c="dimmed" fw={600}>{t(`visit.status.${item.key}`)}</Text>
                <Text fw={800} fz="xl">{summary[item.key] ?? 0}</Text>
              </Stack>
              <VisitStatusBadge status={item.key} />
            </Group>
          </Card>
        ))}
      </SimpleGrid>

      <Card mb="md">
        <Stack gap="sm">
          <Group align="flex-end" gap="sm" wrap="wrap">
            <TextInput
              label={t('common.search')}
              placeholder={t('visits.searchPlaceholder')}
              leftSection={<Icon name="search" size={16} />}
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              style={{ flex: '1 1 240px' }}
            />
            <Select
              label={t('common.status')}
              value={status}
              onChange={(value) => setStatus(value ?? 'all')}
              data={STATUS_OPTIONS.map((value) => ({ value, label: value === 'all' ? t('visits.allStatuses') : t(`visit.status.${value}`) }))}
              allowDeselect={false}
              w={165}
            />
            <Select
              label={t('visits.category')}
              value={category}
              onChange={(value) => setCategory(value ?? 'all')}
              data={CATEGORY_OPTIONS.map((value) => ({ value, label: value === 'all' ? t('visits.allCategories') : t(`visit.category.${value}`) }))}
              allowDeselect={false}
              w={190}
            />
            <TextInput type="date" label={t('visits.dateFrom')} value={dateFrom} onChange={(event) => setDateFrom(event.currentTarget.value)} w={160} />
            <TextInput type="date" label={t('visits.dateTo')} value={dateTo} onChange={(event) => setDateTo(event.currentTarget.value)} w={160} />
            <Select
              label={t('reports.village')}
              value={village}
              onChange={(value) => setVillage(value ?? '')}
              data={[{ value: '', label: t('common.all') }, ...villages.map((entry) => ({ value: entry, label: entry }))]}
              allowDeselect={false}
              w={160}
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
                w={200}
                searchable
              />
            ) : null}
            <Select
              label={t('common.sortBy')}
              value={sortKey}
              onChange={(value) => setSortKey(value ?? 'date')}
              data={[
                { value: 'date', label: t('visits.sortDate') },
                { value: 'client', label: t('visits.sortClient') },
                { value: 'status', label: t('visits.sortStatus') },
                { value: 'category', label: t('visits.sortCategory') },
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
            <ActionIcon variant="light" size="lg" aria-label={t('common.sortBy')} onClick={() => setDirection((current) => (current === 'asc' ? 'desc' : 'asc'))}>
              <Icon name="filter" size={17} />
            </ActionIcon>
          </Group>
          <Text size="xs" c="dimmed">{t('visits.scheduleNote')}</Text>
        </Stack>
      </Card>

      {!filtered.length ? (
        <Card>
          <EmptyState icon="calendar" title={t('visits.empty')} description={t('visits.emptyHint')} />
        </Card>
      ) : (
        <Card p={0}>
          <ScrollArea>
            <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md" miw={920}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('visits.scheduled')}</Table.Th>
                  <Table.Th>{t('visits.client')}</Table.Th>
                  <Table.Th>{t('visits.title')}</Table.Th>
                  <Table.Th>{t('visits.category')}</Table.Th>
                  <Table.Th>{t('common.status')}</Table.Th>
                  <Table.Th>{t('common.worker')}</Table.Th>
                  <Table.Th>{t('common.actions')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {paged.items.map((visit) => (
                  <Table.Tr key={visit.id}>
                    <Table.Td>{formatDate(visit.scheduledDate, locale)}</Table.Td>
                    <Table.Td>
                      <Stack gap={0}>
                        <Anchor component={Link} to={`/visits/${encodeURIComponent(visit.id)}`} fw={600}>{visit.clientName}</Anchor>
                        <Text size="xs" c="dimmed">{visit.clientCode}</Text>
                      </Stack>
                    </Table.Td>
                    <Table.Td>{visit.name?.[language] ?? visit.name?.en}</Table.Td>
                    <Table.Td><CategoryBadge category={visit.category} /></Table.Td>
                    <Table.Td><VisitStatusBadge status={visit.status} /></Table.Td>
                    <Table.Td>{workers.find((worker) => worker.id === visit.workerId)?.fullName ?? <Text size="xs" c="dimmed">{t('workers.none')}</Text>}</Table.Td>
                    <Table.Td>
                      <Tooltip label={t('common.view')}>
                        <ActionIcon variant="subtle" component={Link} to={`/visits/${encodeURIComponent(visit.id)}`} aria-label={t('common.view')}>
                          <Icon name="eye" size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
          <PaginationBar page={paged.page} totalPages={paged.totalPages} total={paged.total} from={paged.from} to={paged.to} onChange={setPage} />
        </Card>
      )}
    </>
  )
}
