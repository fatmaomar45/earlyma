import { useMemo } from 'react'
import {
  Alert,
  Button,
  Card,
  Grid,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { buildDashboardData } from '../lib/reports.js'
import { monthLabel, startOfToday } from '../lib/dates.js'
import { PageHeader } from '../components/PageHeader.jsx'
import { StatCard } from '../components/StatCard.jsx'
import { DonutChart, TrendChart } from '../components/Charts.jsx'
import { VisitList } from '../components/VisitList.jsx'
import { ActivityList } from '../components/ActivityList.jsx'
import { Icon } from '../components/Icon.jsx'

export function DashboardPage() {
  const {
    t,
    db,
    language,
    locale,
    currentUser,
    isAdmin,
    visibleWorkerId,
    setScopeWorkerId,
    processQueue,
    busy,
  } = useApp()
  const navigate = useNavigate()

  const data = useMemo(
    () => buildDashboardData(db, { workerId: visibleWorkerId, today: startOfToday() }),
    [db, visibleWorkerId],
  )

  const workerOptions = [
    { value: '', label: t('dashboard.allWorkers') },
    ...(db.workers ?? []).filter((worker) => worker.active).map((worker) => ({
      value: worker.id,
      label: `${worker.fullName} · ${t(worker.role === 'admin' ? 'role.admin' : 'role.chw')}`,
    })),
  ]

  const registrationSeries = [
    { name: t('dashboard.mothersLegend'), color: 'teal', values: data.registrations.map((entry) => entry.mothers) },
    { name: t('dashboard.babiesLegend'), color: 'blue', values: data.registrations.map((entry) => entry.babies) },
  ]

  const visitOutcomeData = [
    { label: t('visit.status.completed'), value: data.visitStatusCounts.completed, color: 'green' },
    { label: t('visit.status.overdue'), value: data.visitStatusCounts.overdue, color: 'red' },
    { label: t('visit.status.due_today'), value: data.visitStatusCounts.due_today, color: 'orange' },
    { label: t('visit.status.due_soon'), value: data.visitStatusCounts.due_soon, color: 'yellow' },
    { label: t('visit.status.upcoming'), value: data.visitStatusCounts.upcoming, color: 'blue' },
    { label: t('visit.status.cancelled'), value: data.visitStatusCounts.cancelled, color: 'gray' },
  ]

  const notificationData = [
    { label: t('notifications.status.queued'), value: data.notificationSummary.queued, color: 'blue' },
    { label: t('notifications.status.processing'), value: data.notificationSummary.processing, color: 'cyan' },
    { label: t('notifications.status.sent'), value: data.notificationSummary.sent, color: 'teal' },
    { label: t('notifications.status.delivered'), value: data.notificationSummary.delivered, color: 'green' },
    { label: t('notifications.status.failed'), value: data.notificationSummary.failed, color: 'red' },
  ]

  const labels = data.registrations.map((entry) => monthLabel(entry.key, locale))

  return (
    <>
      <PageHeader
        title={t('dashboard.welcome', { name: currentUser?.fullName ?? '' })}
        subtitle={t('dashboard.welcomeDesc')}
        actions={(
          <>
            <Button variant="light" leftSection={<Icon name="mother" size={16} />} onClick={() => navigate('/mothers/new')}>
              {t('dashboard.registerMother')}
            </Button>
            <Button variant="light" leftSection={<Icon name="baby" size={16} />} onClick={() => navigate('/babies/new')}>
              {t('dashboard.registerBaby')}
            </Button>
          </>
        )}
      />

      {isAdmin ? (
        <Group mb="md" gap="sm" align="flex-end" wrap="wrap">
          <Select
            label={t('dashboard.scopeWorker')}
            value={visibleWorkerId ?? ''}
            onChange={(value) => setScopeWorkerId(value || null)}
            data={workerOptions}
            allowDeselect={false}
            w={300}
            searchable
          />
        </Group>
      ) : null}

      <SimpleGrid cols={{ base: 2, sm: 3, xl: 3 }} spacing="md" mb="lg">
        <StatCard label={t('dashboard.totalMothers')} value={data.stats.totalMothers} icon="mother" color="pink" to="/mothers" />
        <StatCard label={t('dashboard.totalBabies')} value={data.stats.totalBabies} icon="baby" color="blue" to="/babies" />
        <StatCard label={t('dashboard.dueToday')} value={data.stats.dueToday} icon="calendar" color="orange" to="/visits?status=due_today" emphasis={data.stats.dueToday > 0} />
        <StatCard label={t('dashboard.overdue')} value={data.stats.overdue} icon="alert" color="red" to="/visits?status=overdue" emphasis={data.stats.overdue > 0} />
        <StatCard label={t('dashboard.upcoming')} value={data.stats.upcoming} icon="clock" color="blue" to="/visits?status=upcoming" />
        <StatCard label={t('dashboard.mothersFollowUp')} value={data.stats.mothersFollowUp} icon="mother" color="orange" to="/visits" emphasis={data.stats.mothersFollowUp > 0} />
        <StatCard label={t('dashboard.babiesFollowUp')} value={data.stats.babiesFollowUp} icon="baby" color="orange" to="/visits" emphasis={data.stats.babiesFollowUp > 0} />
        <StatCard label={t('dashboard.pendingReminders')} value={data.stats.pendingReminders} icon="bell" color="teal" to="/notifications" />
        <StatCard label={t('dashboard.completionRate')} value={`${data.stats.completionRate}%`} icon="check" color="green" to="/reports" />
      </SimpleGrid>

      {db.mothers.length === 0 && db.babies.length === 0 ? (
        <Alert color="blue" variant="light" mb="lg" icon={<Icon name="clipboard" size={18} />}>
          {t('mothers.emptyHint')}
        </Alert>
      ) : null}

      <Grid gutter="md" mb="lg">
        <Grid.Col span={{ base: 12, lg: 7 }}>
          <Card h="100%">
            <Group justify="space-between" mb="sm">
              <Title order={3}>{t('dashboard.registrationsChart')}</Title>
            </Group>
            <TrendChart series={registrationSeries} labels={labels} emptyLabel={t('dashboard.noChartData')} />
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 5 }}>
          <Card h="100%">
            <Title order={3} mb="sm">{t('dashboard.visitOutcomes')}</Title>
            <DonutChart
              data={visitOutcomeData}
              centerValue={data.summary.total}
              centerLabel={t('visits.all')}
              emptyLabel={t('dashboard.noChartData')}
            />
          </Card>
        </Grid.Col>
      </Grid>

      <Grid gutter="md" mb="lg">
        <Grid.Col span={{ base: 12, lg: 7 }}>
          <Card h="100%">
            <Group justify="space-between" mb="sm" wrap="wrap">
              <Title order={3}>{t('visits.today')}</Title>
              <Button size="compact-sm" variant="subtle" onClick={() => navigate('/visits?status=due_today')}>
                {t('dashboard.viewTodayVisits')}
              </Button>
            </Group>
            <VisitList visits={data.dueToday} limit={5} emptyTitle={t('dashboard.noVisits')} />
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 5 }}>
          <Card h="100%">
            <Group justify="space-between" mb="sm" wrap="wrap">
              <Title order={3}>{t('dashboard.overdue')}</Title>
              <Button size="compact-sm" variant="subtle" color="red" onClick={() => navigate('/visits?status=overdue')}>
                {t('dashboard.viewOverdue')}
              </Button>
            </Group>
            <VisitList visits={data.overdueVisits} limit={5} emptyTitle={t('dashboard.noVisits')} dense />
          </Card>
        </Grid.Col>
      </Grid>

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, lg: 5 }}>
          <Card h="100%">
            <Title order={3}>{t('dashboard.quickActions')}</Title>
            <Text size="xs" c="dimmed" mb="sm">{t('dashboard.quickActionsHint')}</Text>
            <SimpleGrid cols={2} spacing="sm" mb="sm">
              <Button size="lg" leftSection={<Icon name="mother" size={18} />} onClick={() => navigate('/mothers/new')}>
                {t('dashboard.registerMother')}
              </Button>
              <Button size="lg" leftSection={<Icon name="baby" size={18} />} onClick={() => navigate('/babies/new')}>
                {t('dashboard.registerBaby')}
              </Button>
              <Button size="lg" variant="light" leftSection={<Icon name="calendar" size={18} />} onClick={() => navigate('/visits')}>
                {t('dashboard.recordVisit')}
              </Button>
              <Button size="lg" variant="light" leftSection={<Icon name="refresh" size={18} />} onClick={() => navigate('/visits')}>
                {t('dashboard.scheduleFollowUp')}
              </Button>
              <Button size="lg" variant="light" leftSection={<Icon name="phone" size={18} />} onClick={() => navigate('/mothers')}>
                {t('dashboard.contactClient')}
              </Button>
              <Button size="lg" variant="light" leftSection={<Icon name="list" size={18} />} onClick={() => navigate('/visits?status=due_today')}>
                {t('dashboard.todayTasks')}
              </Button>
            </SimpleGrid>
            <Stack gap="xs">
              <Button
                variant="subtle"
                justify="flex-start"
                leftSection={<Icon name="bell" size={18} />}
                onClick={() => processQueue()}
                loading={Boolean(busy.queue)}
              >
                {t('notifications.processQueue')}
              </Button>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 7 }}>
          <Card h="100%">
            <Title order={3} mb="sm">{t('dashboard.notificationStatus')}</Title>
            <DonutChart
              data={notificationData}
              centerValue={data.notificationSummary.total}
              centerLabel={t('notifications.title')}
              emptyLabel={t('dashboard.noChartData')}
            />
            <Alert mt="md" color="blue" variant="light" icon={<Icon name="shield" size={18} />}>
              {t('dashboard.deliveryNote')}
            </Alert>
          </Card>
        </Grid.Col>

        <Grid.Col span={12}>
          <Card>
            <Group justify="space-between" mb="sm">
              <Title order={3}>{t('dashboard.recentActivity')}</Title>
              <Button size="compact-sm" variant="subtle" onClick={() => navigate('/reports')}>{t('common.viewAll')}</Button>
            </Group>
            <ActivityList activities={data.activities} />
          </Card>
        </Grid.Col>
      </Grid>
      <Text size="xs" c="dimmed" mt="lg">{t('schedule.note')}</Text>
    </>
  )
}
