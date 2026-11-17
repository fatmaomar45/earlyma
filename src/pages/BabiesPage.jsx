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
import { VisitStatusBadge } from '../components/StatusBadge.jsx'
import { Icon } from '../components/Icon.jsx'
import { filterClients, paginate, sortClients, uniqueVillages } from '../lib/clients.js'
import { buildAllVisits, nextActionableVisit } from '../lib/visits.js'
import { ageParts, formatDate, todayInput } from '../lib/dates.js'
import { csvDocument, downloadTextFile } from '../lib/csv.js'

function ageLabel(baby, t) {
  const parts = ageParts(new Date(`${baby.dateOfBirth}T12:00:00`))
  if (!parts) return '—'
  if (parts.years > 0) return `${parts.years} ${t('common.years')} ${parts.months} ${t('common.months')}`
  return `${parts.months} ${t('common.months')} ${parts.days} d`
}

export function BabiesPage() {
  const { t, db, scopedBabies, locale, isAdmin, setPageSize } = useApp()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [village, setVillage] = useState('')
  const [workerId, setWorkerId] = useState('')
  const [sortKey, setSortKey] = useState('name')
  const [direction, setDirection] = useState('asc')
  const [page, setPage] = useState(1)
  const pageSize = db.preferences?.pageSize ?? 10

  const visits = useMemo(() => buildAllVisits(db), [db])
  const nextVisits = useMemo(() => {
    const byClient = new Map()
    for (const visit of visits) {
      if (visit.clientType !== 'baby') continue
      const list = byClient.get(visit.clientId) ?? []
      list.push(visit)
      byClient.set(visit.clientId, list)
    }
    return new Map([...byClient.entries()].map(([clientId, list]) => [clientId, nextActionableVisit(list)]))
  }, [visits])

  const filtered = useMemo(
    () => sortClients(filterClients(scopedBabies, { query, village, workerId }), sortKey, direction),
    [scopedBabies, query, village, workerId, sortKey, direction],
  )
  const paged = paginate(filtered, page, pageSize)
  const villages = useMemo(() => uniqueVillages(scopedBabies), [scopedBabies])
  const workers = db.workers ?? []

  useEffect(() => { setPage(1) }, [query, village, workerId, sortKey, direction, pageSize])

  const exportCsv = () => {
    const rows = filtered.map((baby) => {
      const next = nextVisits.get(baby.id)
      return {
        code: baby.code,
        name: baby.fullName,
        mother: baby.motherName,
        dob: baby.dateOfBirth,
        sex: t(`sex.${baby.sex ?? 'unknown'}`),
        village: baby.village,
        weight: baby.currentWeightKg,
        nextVisit: next?.scheduledDateInput ?? '',
        worker: workers.find((worker) => worker.id === baby.workerId)?.fullName ?? '',
      }
    })
    const csv = csvDocument(rows, [
      { key: 'code', label: t('common.id') },
      { key: 'name', label: t('common.name') },
      { key: 'mother', label: t('babies.linkedMother') },
      { key: 'dob', label: t('babies.dateOfBirth') },
      { key: 'sex', label: t('babies.sex') },
      { key: 'village', label: t('common.village') },
      { key: 'weight', label: t('babies.currentWeight') },
      { key: 'nextVisit', label: t('babies.nextVisit') },
      { key: 'worker', label: t('common.worker') },
    ])
    downloadTextFile(`earlyma-babies-${todayInput()}.csv`, csv, 'text/csv;charset=utf-8')
  }

  return (
    <>
      <PageHeader
        title={t('babies.title')}
        subtitle={t('babies.subtitle')}
        actions={(
          <>
            <Button variant="light" leftSection={<Icon name="download" size={16} />} onClick={exportCsv} disabled={!filtered.length}>
              {t('common.export')}
            </Button>
            <Button leftSection={<Icon name="plus" size={16} />} onClick={() => navigate('/babies/new')}>
              {t('babies.add')}
            </Button>
          </>
        )}
      />

      <Card mb="md">
        <Group align="flex-end" gap="sm" wrap="wrap">
          <TextInput
            label={t('common.search')}
            placeholder={t('babies.searchPlaceholder')}
            leftSection={<Icon name="search" size={16} />}
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            style={{ flex: '1 1 260px' }}
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
              { value: 'date', label: t('babies.dateOfBirth') },
              { value: 'village', label: t('common.village') },
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
          <ActionIcon variant="light" size="lg" aria-label={t('common.sortBy')} onClick={() => setDirection((current) => (current === 'asc' ? 'desc' : 'asc'))}>
            <Icon name="filter" size={17} />
          </ActionIcon>
        </Group>
      </Card>

      {!filtered.length ? (
        <Card>
          <EmptyState
            icon="baby"
            title={t('babies.empty')}
            description={t('babies.emptyHint')}
            actionLabel={t('babies.add')}
            onAction={() => navigate('/babies/new')}
          />
        </Card>
      ) : (
        <Card p={0}>
          <ScrollArea>
            <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md" miw={900}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('common.name')}</Table.Th>
                  <Table.Th>{t('babies.linkedMother')}</Table.Th>
                  <Table.Th>{t('babies.dateOfBirth')}</Table.Th>
                  <Table.Th>{t('babies.age')}</Table.Th>
                  <Table.Th>{t('babies.sex')}</Table.Th>
                  <Table.Th>{t('babies.currentWeight')}</Table.Th>
                  <Table.Th>{t('babies.nextVisit')}</Table.Th>
                  <Table.Th>{t('common.actions')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {paged.items.map((baby) => {
                  const next = nextVisits.get(baby.id)
                  return (
                    <Table.Tr key={baby.id}>
                      <Table.Td>
                        <Stack gap={0}>
                          <Anchor component={Link} to={`/babies/${baby.id}`} fw={650}>{baby.fullName}</Anchor>
                          <Text size="xs" c="dimmed">{baby.code} · {baby.village}</Text>
                        </Stack>
                      </Table.Td>
                      <Table.Td>
                        {baby.motherId ? (
                          <Anchor component={Link} to={`/mothers/${baby.motherId}`} size="sm">{baby.motherName}</Anchor>
                        ) : (
                          <Text size="sm">{baby.motherName || <Text span c="dimmed" size="xs">{t('babies.unlinkedMother')}</Text>}</Text>
                        )}
                      </Table.Td>
                      <Table.Td>{formatDate(new Date(`${baby.dateOfBirth}T12:00:00`), locale)}</Table.Td>
                      <Table.Td>{ageLabel(baby, t)}</Table.Td>
                      <Table.Td>{t(`sex.${baby.sex ?? 'unknown'}`)}</Table.Td>
                      <Table.Td>{baby.currentWeightKg ? `${baby.currentWeightKg} kg` : '—'}</Table.Td>
                      <Table.Td>
                        {next ? (
                          <Stack gap={2}>
                            <Text size="xs">{formatDate(next.scheduledDate, locale)}</Text>
                            <VisitStatusBadge status={next.status} />
                          </Stack>
                        ) : <Text size="xs" c="dimmed">—</Text>}
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4} wrap="nowrap">
                          <Tooltip label={t('babies.viewProfile')}>
                            <ActionIcon variant="subtle" component={Link} to={`/babies/${baby.id}`} aria-label={t('babies.viewProfile')}>
                              <Icon name="eye" size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label={t('common.edit')}>
                            <ActionIcon variant="subtle" component={Link} to={`/babies/${baby.id}/edit`} aria-label={t('common.edit')}>
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
