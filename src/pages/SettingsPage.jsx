import { useRef, useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
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
import { PageHeader } from '../components/PageHeader.jsx'
import { ConfirmModal } from '../components/ConfirmModal.jsx'
import { Icon } from '../components/Icon.jsx'
import { useInstallPrompt } from '../hooks/useInstallPrompt.js'
import {
  backupFilename,
  databaseCounts,
  SCHEMA_VERSION,
  storageBytes,
  STORAGE_KEY,
} from '../lib/storage.js'
import { getProviderInfo } from '../lib/notifications.js'
import { SCHEDULE_VERSION } from '../data/schedules.js'
import { formatDateTime } from '../lib/dates.js'
import { downloadTextFile } from '../lib/csv.js'

const APP_VERSION = '1.0.0'
const MAX_IMPORT_BYTES = 5 * 1024 * 1024

function InfoRow({ label, value }) {
  return (
    <Group justify="space-between" wrap="nowrap" gap="sm">
      <Text size="sm" c="dimmed">{label}</Text>
      <Text size="sm" fw={600} ta="right" style={{ wordBreak: 'break-word' }}>{value}</Text>
    </Group>
  )
}

export function SettingsPage() {
  const {
    t,
    db,
    currentUser,
    session,
    language,
    locale,
    storageAvailable,
    storageError,
    setLanguage,
    setDefaultNotificationLanguage,
    setPageSize,
    exportData,
    importData,
    clearData,
    loadDemoData,
    removeDemoData,
    logout,
    toast,
  } = useApp()
  const navigate = useNavigate()
  const fileRef = useRef(null)
  const { canInstall, installed, promptInstall } = useInstallPrompt()
  const [pendingImport, setPendingImport] = useState(null)
  const [clearOpen, setClearOpen] = useState(false)
  const [removeDemoOpen, setRemoveDemoOpen] = useState(false)
  const counts = databaseCounts(db)
  const provider = getProviderInfo()
  const size = storageBytes(db)
  const sizeLabel = size >= 1024 * 1024
    ? `${(size / (1024 * 1024)).toFixed(2)} MB`
    : `${Math.max(1, Math.round(size / 1024))} KB`
  const pageSize = db.preferences?.pageSize ?? 10
  const hasDemo = [
    ...(db.mothers ?? []),
    ...(db.babies ?? []),
    ...(db.workers ?? []),
    ...(db.notifications ?? []),
    ...(db.callLogs ?? []),
  ].some((entry) => entry?.isDemo)

  const handleExport = () => {
    const content = exportData()
    const ok = downloadTextFile(backupFilename(), content, 'application/json;charset=utf-8')
    if (ok) toast({ title: t('settings.exportSuccess'), color: 'teal' })
  }

  const handleFile = async (event) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    if (file.size > MAX_IMPORT_BYTES) {
      toast({ title: t('settings.fileTooLarge'), color: 'red' })
      return
    }
    try {
      const content = await file.text()
      setPendingImport({ name: file.name, content })
    } catch {
      toast({ title: t('settings.importError'), color: 'red' })
    }
  }

  const confirmImport = () => {
    if (!pendingImport) return
    const result = importData(pendingImport.content)
    setPendingImport(null)
    if (!result.ok) return
  }

  const confirmClear = () => {
    clearData()
    setClearOpen(false)
    navigate('/')
  }

  const confirmRemoveDemo = () => {
    removeDemoData()
    setRemoveDemoOpen(false)
  }

  return (
    <>
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />

      {!storageAvailable ? (
        <Alert color="red" variant="light" mb="md" icon={<Icon name="alert" size={18} />}>
          {storageError || t('settings.storageUnavailable')}
        </Alert>
      ) : null}

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, lg: 6 }}>
          <Card h="100%">
            <Group gap="xs" mb="sm">
              <Icon name="globe" size={18} />
              <Title order={3}>{t('settings.language')}</Title>
            </Group>
            <Stack gap="sm">
              <Select
                label={t('settings.interfaceLanguage')}
                value={language}
                onChange={(value) => setLanguage(value ?? 'en')}
                data={[
                  { value: 'en', label: t('language.en') },
                  { value: 'sw', label: t('language.sw') },
                ]}
                allowDeselect={false}
              />
              <Select
                label={t('settings.notificationLanguage')}
                value={db.preferences?.defaultNotificationLanguage ?? 'sw'}
                onChange={(value) => setDefaultNotificationLanguage(value ?? 'sw')}
                data={[
                  { value: 'sw', label: t('language.sw') },
                  { value: 'en', label: t('language.en') },
                ]}
                description={t('settings.defaultNotificationLanguageHint')}
                allowDeselect={false}
              />
              <Select
                label={t('common.page')}
                value={String(pageSize)}
                onChange={(value) => setPageSize(value)}
                data={['5', '10', '20', '50'].map((value) => ({ value, label: value }))}
                allowDeselect={false}
                w={120}
              />
              <Text size="xs" c="dimmed">{t('settings.languageHint')}</Text>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 6 }}>
          <Card h="100%">
            <Group gap="xs" mb="sm">
              <Icon name="shield" size={18} />
              <Title order={3}>{t('settings.session')}</Title>
            </Group>
            <Stack gap="xs">
              <InfoRow label={t('common.name')} value={currentUser?.fullName ?? '—'} />
              <InfoRow label={t('auth.email')} value={currentUser?.email ?? '—'} />
              <InfoRow label={t('workers.role')} value={t(currentUser?.role === 'admin' ? 'role.admin' : 'role.chw')} />
              <InfoRow label={t('settings.sessionStarted')} value={session?.startedAt ? formatDateTime(session.startedAt, locale) : '—'} />
              <InfoRow label={t('settings.sessionExpires')} value={session?.expiresAt ? formatDateTime(session.expiresAt, locale) : '—'} />
              <Divider my="xs" />
              <Button variant="light" color="red" leftSection={<Icon name="logout" size={16} />} onClick={logout}>
                {t('settings.logout')}
              </Button>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 7 }}>
          <Card h="100%">
            <Group gap="xs" mb="sm">
              <Icon name="download" size={18} />
              <Title order={3}>{t('settings.data')}</Title>
            </Group>
            <Stack gap="sm">
              <Alert color="orange" variant="light" icon={<Icon name="info" size={18} />}>
                {t('settings.exportNote')}
              </Alert>
              <Group wrap="wrap">
                <Button variant="light" leftSection={<Icon name="download" size={16} />} onClick={handleExport}>
                  {t('settings.downloadBackup')}
                </Button>
                <Button variant="default" leftSection={<Icon name="upload" size={16} />} onClick={() => fileRef.current?.click()}>
                  {t('settings.import')}
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json,.json"
                  hidden
                  onChange={handleFile}
                />
              </Group>
              <Text size="xs" c="dimmed">{t('settings.importHint')}</Text>

              <Divider />

              <Group justify="space-between" align="center" wrap="wrap">
                <Stack gap={2}>
                  <Text fw={650}>{t('settings.demoData')}</Text>
                  <Text size="xs" c="dimmed">{t('settings.demoHint')}</Text>
                </Stack>
                <Group gap="xs" wrap="wrap">
                  <Button variant="light" leftSection={<Icon name="clipboard" size={16} />} onClick={() => loadDemoData()}>
                    {t('settings.loadDemo')}
                  </Button>
                  {hasDemo ? (
                    <Button variant="subtle" color="orange" onClick={() => setRemoveDemoOpen(true)}>
                      {t('settings.removeDemo')}
                    </Button>
                  ) : null}
                </Group>
              </Group>

              <Divider />

              <Stack gap="xs">
                <Text fw={650} c="red">{t('settings.dangerZone')}</Text>
                <Text size="xs" c="dimmed">{t('settings.clearHint')}</Text>
                <Button variant="light" color="red" leftSection={<Icon name="trash" size={16} />} onClick={() => setClearOpen(true)}>
                  {t('settings.clear')}
                </Button>
              </Stack>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 5 }}>
          <Card h="100%">
            <Group gap="xs" mb="sm">
              <Icon name="file" size={18} />
              <Title order={3}>{t('settings.versionInfo')}</Title>
            </Group>
            <Stack gap="xs">
              <InfoRow label={t('settings.appVersion')} value={APP_VERSION} />
              <InfoRow label={t('settings.schema')} value={String(SCHEMA_VERSION)} />
              <InfoRow label={t('settings.scheduleConfig')} value={SCHEDULE_VERSION} />
              <InfoRow label={t('settings.lastSaved')} value={db.updatedAt ? formatDateTime(db.updatedAt, locale) : '—'} />
              <InfoRow label={t('settings.size')} value={sizeLabel} />
              <InfoRow label={t('settings.storageKey')} value={STORAGE_KEY} />
              <Divider my="xs" />
              <SimpleGrid cols={2} spacing="xs">
                <InfoRow label={t('nav.mothers')} value={counts.mothers} />
                <InfoRow label={t('nav.babies')} value={counts.babies} />
                <InfoRow label={t('nav.visits')} value={counts.visits} />
                <InfoRow label={t('nav.notifications')} value={counts.notifications} />
                <InfoRow label={t('nav.calls')} value={counts.calls} />
                <InfoRow label={t('nav.workers')} value={counts.workers} />
              </SimpleGrid>
              <Text size="xs" c="dimmed">{t('settings.lastSavedHint')}</Text>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card h="100%">
            <Group gap="xs" mb="sm">
              <Icon name="phone" size={18} />
              <Title order={3}>{t('settings.smsTitle')}</Title>
            </Group>
            <Stack gap="sm">
              <Group gap="xs" wrap="wrap">
                <Badge color={provider.mode === 'http' ? 'teal' : 'blue'} variant="light">
                  {t('settings.mode')}: {provider.mode === 'http' ? 'HTTP' : 'Mock'}
                </Badge>
              </Group>
              <Text size="sm">{provider.mode === 'http' ? t('settings.smsHttp') : t('settings.smsMock')}</Text>
              {provider.endpoint ? <InfoRow label={t('settings.endpoint')} value={provider.endpoint} /> : null}
              <Alert color="blue" variant="light" icon={<Icon name="shield" size={18} />}>
                {t('settings.noSecrets')}
              </Alert>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card h="100%">
            <Group gap="xs" mb="sm">
              <Icon name="home" size={18} />
              <Title order={3}>{t('settings.pwaTitle')}</Title>
            </Group>
            <Stack gap="sm">
              <Text size="sm">{t('settings.pwaText')}</Text>
              {installed ? (
                <Alert color="teal" variant="light">{t('settings.installed')}</Alert>
              ) : canInstall ? (
                <Button leftSection={<Icon name="download" size={16} />} onClick={() => promptInstall()}>
                  {t('settings.install')}
                </Button>
              ) : (
                <Text size="xs" c="dimmed">{t('settings.installUnavailable')}</Text>
              )}
              <Text size="xs" c="dimmed">{t('settings.offlineHint')}</Text>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={12}>
          <Card>
            <Group gap="xs" mb="sm">
              <Icon name="shield" size={18} />
              <Title order={3}>{t('settings.privacyTitle')}</Title>
            </Group>
            <Stack gap="sm">
              <Text size="sm">{t('settings.privacyText')}</Text>
              <Divider />
              <Title order={4}>{t('settings.securityTitle')}</Title>
              <Text size="sm">{t('settings.securityText')}</Text>
              <Divider />
              <Title order={4}>{t('settings.about')}</Title>
              <Text size="sm">{t('settings.aboutText')}</Text>
              <Text size="xs" c="dimmed">{t('settings.scheduleConfigText')}</Text>
              <Text size="xs" c="dimmed">{t('schedule.note')}</Text>
              <Text size="xs" c="dimmed">{t('app.demoNotice')}</Text>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      <ConfirmModal
        opened={Boolean(pendingImport)}
        onClose={() => setPendingImport(null)}
        onConfirm={confirmImport}
        title={t('settings.importReplaceConfirm')}
        body={`${t('settings.importFileReady', { name: pendingImport?.name ?? '' })} ${t('settings.importWarning')}`}
        confirmLabel={t('common.import')}
        color="orange"
      />

      <ConfirmModal
        opened={clearOpen}
        onClose={() => setClearOpen(false)}
        onConfirm={confirmClear}
        title={t('settings.clearConfirm')}
        body={`${t('settings.clearConfirmBody')} ${t('settings.clearHint')}`}
        confirmLabel={t('common.yesDelete')}
      />

      <ConfirmModal
        opened={removeDemoOpen}
        onClose={() => setRemoveDemoOpen(false)}
        onConfirm={confirmRemoveDemo}
        title={t('settings.removeDemoConfirm')}
        body={t('settings.removeDemoWarning')}
        confirmLabel={t('common.confirm')}
        color="orange"
      />
    </>
  )
}
