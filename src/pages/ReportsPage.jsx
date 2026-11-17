import { useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Grid,
  Group,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { useApp } from '../context/AppContext.jsx'
import { PageHeader } from '../components/PageHeader.jsx'
import { StatCard } from '../components/StatCard.jsx'
import { BarChart, DonutChart, TrendChart } from '../components/Charts.jsx'
import { EmptyState } from '../components/EmptyState.jsx'
import { Icon } from '../components/Icon.jsx'
import { buildReport, reportSummaryRows, reportVisitRows } from '../lib/reports.js'
import { csvDocument, downloadTextFile } from '../lib/csv.js'
import { monthLabel, todayInput, validateDateRange } from '../lib/dates.js'
import { translate } from '../lib/i18n.js'
import { uniqueVillages } from '../lib/clients.js'

const CATEGORY_OPTIONS = ['all', 'mother', 'baby']
const STATUS_OPTIONS = [
  'all', 'completed', 'cancelled', 'overdue', 'due_today', 'due_soon', 'upcoming',
]

export function ReportsPage() {
  const { t, db, currentUser, isAdmin, language, locale, toast } = useApp()
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [village, setVillage] = useState('')
  const [workerId, setWorkerId] = useState('')
  const [category, setCategory] = useState('all')
  const [status, setStatus] = useState('all')

  const effectiveWorkerId = isAdmin ? workerId : (currentUser?.id ?? '')
  const filters = { dateFrom, dateTo, village, workerId: effectiveWorkerId, category, status }
  const dateError = validateDateRange(dateFrom, dateTo)
  const report = useMemo(
    () => buildReport(db, filters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db, dateFrom, dateTo, village, effectiveWorkerId, category, status],
  )

  const villages = useMemo(
    () => uniqueVillages([...(db.mothers ?? []), ...(db.babies ?? [])]),
    [db.mothers, db.babies],
  )

  const resetFilters = () => {
    setDateFrom('')
    setDateTo('')
    setVillage('')
    setWorkerId('')
    setCategory('all')
    setStatus('all')
  }

  const exportVisits = () => {
    const rows = reportVisitRows(report, language)
    const csv = csvDocument(rows, [
      { key: 'client', label: t('reports.clientCategory.all') },
      { key: 'clientId', label: t('common.id') },
      { key: 'clientType', label: t('reports.category') },
      { key: 'village', label: t('reports.village') },
      { key: 'worker', label: t('common.worker') },
      { key: 'visit', label: t('visits.title') },
      { key: 'category', label: t('visits.category') },
      { key: 'scheduledDate', label: t('visits.scheduled') },
      { key: 'status', label: t('common.status') },
      { key: 'completedDate', label: t('visits.completedOn') },
      { key: 'followUpRequired', label: t('calls.followUpNeeded') },
      { key: 'notes', label: t('common.notes') },
    ])
    downloadTextFile(`earlyma-visits-${todayInput()}.csv`, csv, 'text/csv;charset=utf-8')
    toast({ title: t('reports.exported'), color: 'teal' })
  }

  const exportSummary = () => {
    const rows = reportSummaryRows(report).map((row) => ({
      metric: translate(language, `reports.${row.metric}`) === `reports.${row.metric}`
        ? row.metric
        : translate(language, `reports.${row.metric}`),
      value: row.value,
    }))
    const csv = csvDocument(rows, [
      { key: 'metric', label: t('common.summary') },
      { key: 'value', label: t('common.total') },
    ])
    downloadTextFile(`earlyma-summary-${todayInput()}.csv`, csv, 'text/csv;charset=utf-8')
    toast({ title: t('reports.exported'), color: 'teal' })
  }

  const notificationData = [
    { label: t('notifications.status.queued'), value: report.notificationSummary.queued, color: 'blue' },
    { label: t('notifications.status.processing'), value: report.notificationSummary.processing, color: 'cyan' },
    { label: t('notifications.status.sent'), value: report.notificationSummary.sent, color: 'teal' },
    { label: t('notifications.status.delivered'), value: report.notificationSummary.delivered, color: 'green' },
    { label: t('notifications.status.failed'), value: report.notificationSummary.failed, color: 'red' },
    { label: t('notifications.status.cancelled'), value: report.notificationSummary.cancelled, color: 'gray' },
  ]

  const categoryData = report.visitsByCategory.map((row) => ({
    label: t(`visit.category.${row.category}`),
    value: row.total,
    color: 'teal',
  }))

  const workerData = report.visitsByWorker.map((row) => ({
    label: row.name,
    value: row.total,
    color: 'blue',
  }))

  return (
    <>
      <PageHeader
        title={t('reports.title')}
        subtitle={t('reports.subtitle')}
        meta={<Text size="xs" c="dimmed">{t('reports.generatedOn')}: {report.generatedAt ? new Date(report.generatedAt).toLocaleString(locale) : '—'}</Text>}
        actions={(
          <>
            <Button variant="light" leftSection={<Icon name="printer" size={16} />} onClick={() => window.print()}>
              {t('reports.print')}
            </Button>
            <Button variant="light" leftSection={<Icon name="file" size={16} />} onClick={exportSummary}>
              {t('reports.exportSummary')}
            </Button>
            <Button leftSection={<Icon name="download" size={16} />} onClick={exportVisits} disabled={!report.visits.length}>
              {t('reports.exportVisits')}
            </Button>
          </>
        )}
      />

      <Card mb="md">
        <Stack gap="sm">
          <Group align="flex-end" gap="sm" wrap="wrap">
            <TextInput
              type="date"
              label={t('reports.dateFrom')}
              value={dateFrom}
              onChange={(event) => setDateFrom(event.currentTarget.value)}
              error={Boolean(dateError)}
              w={165}
            />
            <TextInput
              type="date"
              label={t('reports.dateTo')}
              value={dateTo}
              onChange={(event) => setDateTo(event.currentTarget.value)}
              error={Boolean(dateError)}
              w={165}
            />
            <Select
              label={t('reports.village')}
              value={village}
              onChange={(value) => setVillage(value ?? '')}
              data={[{ value: '', label: t('common.all') }, ...villages.map((entry) => ({ value: entry, label: entry }))]}
              allowDeselect={false}
              searchable
              w={170}
            />
            {isAdmin ? (
              <Select
                label={t('reports.worker')}
                value={workerId}
                onChange={(value) => setWorkerId(value ?? '')}
                data={[
                  { value: '', label: t('dashboard.allWorkers') },
                  ...(db.workers ?? []).map((worker) => ({ value: worker.id, label: worker.fullName })),
                ]}
                allowDeselect={false}
                searchable
                w={220}
              />
            ) : null}
            <Select
              label={t('reports.category')}
              value={category}
              onChange={(value) => setCategory(value ?? 'all')}
              data={CATEGORY_OPTIONS.map((value) => ({
                value,
                label: t(`reports.clientCategory.${value}`),
              }))}
              allowDeselect={false}
              w={190}
            />
            <Select
              label={t('reports.status')}
              value={status}
              onChange={(value) => setStatus(value ?? 'all')}
              data={STATUS_OPTIONS.map((value) => ({
                value,
                label: value === 'all' ? t('common.all') : t(`visit.status.${value}`),
              }))}
              allowDeselect={false}
              w={180}
            />
            <Button variant="default" leftSection={<Icon name="refresh" size={16} />} onClick={resetFilters}>
              {t('reports.resetFilters')}
            </Button>
          </Group>
          <Text size="xs" c="dimmed">{t('reports.filtersHint')} {t('reports.description')}</Text>
          {dateError ? <Alert color="red" variant="light">{t(dateError)}</Alert> : null}
        </Stack>
      </Card>

      <SimpleGrid cols={{ base: 2, sm: 3, lg: 4 }} spacing="md" mb="lg">
        <StatCard label={t('reports.totalClients')} value={report.metrics.totalClients} icon="users" color="teal" />
        <StatCard label={t('reports.totalVisits')} value={report.metrics.totalVisits} icon="calendar" color="blue" />
        <StatCard label={t('reports.completedAppointments')} value={report.metrics.completedVisits} icon="check" color="green" />
        <StatCard label={t('reports.missedAppointments')} value={report.metrics.overdueVisits} icon="alert" color="red" emphasis={report.metrics.overdueVisits > 0} />
        <StatCard label={t('reports.completionRate')} value={`${report.metrics.completionRate}%`} icon="chart" color="teal" />
        <StatCard label={t('reports.notificationsSent')} value={report.metrics.notificationsSent} icon="bell" color="blue" />
        <StatCard label={t('reports.deliveryRate')} value={`${report.metrics.deliveryRate}%`} icon="shield" color="green" />
        <StatCard label={t('reports.calls')} value={report.metrics.calls} icon="phone" color="grape" />
      </SimpleGrid>

      {!report.clients.length && !report.visits.length ? (
        <Card mb="lg">
          <EmptyState icon="chart" title={t('reports.noData')} description={t('reports.filtersHint')} />
        </Card>
      ) : null}

      <Grid gutter="md" mb="lg">
        <Grid.Col span={{ base: 12, lg: 7 }}>
          <Card h="100%">
            <Title order={3} mb="sm">{t('reports.registrationsByMonth')}</Title>
            <TrendChart
              labels={report.registrationsByMonth.map((entry) => monthLabel(entry.key, locale))}
              series={[
                { name: t('reports.clientCategory.mother'), color: 'teal', values: report.registrationsByMonth.map((entry) => entry.mothers) },
                { name: t('reports.clientCategory.baby'), color: 'blue', values: report.registrationsByMonth.map((entry) => entry.babies) },
              ]}
              emptyLabel={t('dashboard.noChartData')}
            />
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 5 }}>
          <Card h="100%">
            <Title order={3} mb="sm">{t('reports.visitsByCategory')}</Title>
            <BarChart data={categoryData} emptyLabel={t('dashboard.noChartData')} />
          </Card>
        </Grid.Col>
      </Grid>

      <Grid gutter="md" mb="lg">
        <Grid.Col span={{ base: 12, lg: 6 }}>
          <Card h="100%">
            <Title order={3} mb="sm">{t('reports.notificationPerformance')}</Title>
            <DonutChart
              data={notificationData}
              centerValue={report.notificationSummary.total}
              centerLabel={t('notifications.title')}
              emptyLabel={t('dashboard.noChartData')}
            />
            <Group gap="lg" mt="md" wrap="wrap">
              <Text size="sm">{t('reports.successRate')}: <b>{report.metrics.notificationSuccessRate}%</b></Text>
              <Text size="sm">{t('reports.deliveryRate')}: <b>{report.metrics.deliveryRate}%</b></Text>
            </Group>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 6 }}>
          <Card h="100%">
            <Title order={3} mb="sm">{t('reports.visitsByWorker')}</Title>
            <BarChart data={workerData} emptyLabel={t('dashboard.noChartData')} />
          </Card>
        </Grid.Col>
      </Grid>

      {report.workerActivity.length ? (
        <Card mb="lg">
          <Title order={3} mb="sm">{t('reports.chwActivity')}</Title>
          <ScrollArea>
            <Table highlightOnHover verticalSpacing="sm" miw={760}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('reports.workerActivity')}</Table.Th>
                  <Table.Th>{t('reports.clientsAssigned')}</Table.Th>
                  <Table.Th>{t('reports.visitsCompleted')}</Table.Th>
                  <Table.Th>{t('reports.missedAppointments')}</Table.Th>
                  <Table.Th>{t('reports.callsMade')}</Table.Th>
                  <Table.Th>{t('reports.notificationsQueued')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {report.workerActivity.map((row) => (
                  <Table.Tr key={row.workerId}>
                    <Table.Td>
                      <Stack gap={0}>
                        <Text size="sm" fw={600}>{row.name}</Text>
                        <Text size="xs" c="dimmed">{row.village || t('common.notAvailable')}</Text>
                      </Stack>
                    </Table.Td>
                    <Table.Td>{row.assignedClients}</Table.Td>
                    <Table.Td>{row.completedVisits}</Table.Td>
                    <Table.Td>{row.overdueVisits}</Table.Td>
                    <Table.Td>{row.calls}</Table.Td>
                    <Table.Td>{row.notifications}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Card>
      ) : null}

      {report.visits.length ? (
        <Card>
          <Title order={3} mb="sm">{t('reports.visitRows')}</Title>
          <ScrollArea>
            <Table striped highlightOnHover verticalSpacing="xs" miw={900}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('calls.client')}</Table.Th>
                  <Table.Th>{t('visits.title')}</Table.Th>
                  <Table.Th>{t('visits.scheduled')}</Table.Th>
                  <Table.Th>{t('common.status')}</Table.Th>
                  <Table.Th>{t('common.worker')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {report.visits.slice(0, 50).map((visit) => (
                  <Table.Tr key={visit.id}>
                    <Table.Td>{visit.clientName}</Table.Td>
                    <Table.Td>{visit.name?.[language] ?? visit.name?.en}</Table.Td>
                    <Table.Td>{visit.scheduledDateInput}</Table.Td>
                    <Table.Td>{t(`visit.status.${visit.status}`)}</Table.Td>
                    <Table.Td>{visit.workerName || t('workers.none')}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
          {report.visits.length > 50 ? (
            <Text size="xs" c="dimmed" mt="sm">{t('common.showing', { from: 1, to: 50, total: report.visits.length })}</Text>
          ) : null}
        </Card>
      ) : null}
    </>
  )
}
