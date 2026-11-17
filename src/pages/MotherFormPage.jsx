import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Grid,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core'
import { useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { PageHeader } from '../components/PageHeader.jsx'
import { EmptyState } from '../components/EmptyState.jsx'
import { Icon } from '../components/Icon.jsx'
import { todayInput } from '../lib/dates.js'

const EMPTY = {
  fullName: '',
  age: '',
  phone: '',
  village: '',
  address: '',
  expectedDeliveryDate: '',
  registrationDate: todayInput(),
  actualDeliveryDate: '',
  status: 'pregnant',
  language: 'sw',
  consentReminders: false,
  notes: '',
  workerId: '',
}

function fromMother(mother) {
  return {
    fullName: mother.fullName ?? '',
    age: mother.age ?? '',
    phone: mother.phone ?? '',
    village: mother.village ?? '',
    address: mother.address ?? '',
    expectedDeliveryDate: mother.expectedDeliveryDate ?? '',
    registrationDate: mother.registrationDate ?? todayInput(),
    actualDeliveryDate: mother.actualDeliveryDate ?? '',
    status: mother.status ?? 'pregnant',
    language: mother.language ?? 'sw',
    consentReminders: Boolean(mother.consentReminders),
    notes: mother.notes ?? '',
    workerId: mother.workerId ?? '',
  }
}

export function MotherFormPage() {
  const { id } = useParams()
  const editing = Boolean(id)
  const {
    t, db, currentUser, isAdmin, addMother, updateMother, busy,
  } = useApp()
  const navigate = useNavigate()
  const existing = editing ? (db.mothers ?? []).find((mother) => mother.id === id) : null
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (existing) setForm(fromMother(existing))
    else setForm({ ...EMPTY, workerId: currentUser?.id ?? '', registrationDate: todayInput() })
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const workers = useMemo(
    () => (db.workers ?? []).filter((worker) => worker.active),
    [db.workers],
  )

  if (editing && (!existing || (!isAdmin && existing.workerId !== currentUser?.id))) {
    return (
      <EmptyState
        icon="alert"
        title={t('mothers.notFound')}
        actionLabel={t('common.back')}
        onAction={() => navigate('/mothers')}
      />
    )
  }

  const set = (key) => (value) => setForm((current) => ({ ...current, [key]: value }))

  const submit = (event) => {
    event.preventDefault()
    setErrors({})
    const payload = { ...form, workerId: form.workerId || currentUser?.id || null }
    const result = editing ? updateMother(id, payload) : addMother(payload)
    if (!result.ok) {
      setErrors(result.errors ?? { form: 'toast.error' })
      return
    }
    navigate(`/mothers/${result.client.id}`)
  }

  const errorFor = (key) => (errors[key] ? t(errors[key]) : undefined)

  return (
    <>
      <PageHeader
        title={editing ? t('mothers.edit') : t('mothers.add')}
        subtitle={t('mothers.subtitle')}
        actions={<Button variant="default" onClick={() => navigate(-1)}>{t('common.cancel')}</Button>}
      />

      <Card component="form" onSubmit={submit} maw={980}>
        <Stack gap="lg">
          {errors.form ? <Alert color="red">{t(errors.form)}</Alert> : null}
          {errors.duplicate ? <Alert color="orange">{errorFor('duplicate')}</Alert> : null}

          <Stack gap="sm">
            <Title order={3}>{t('mothers.profileDetails')}</Title>
            <Grid gutter="md">
              <Grid.Col span={{ base: 12, sm: 8 }}>
                <TextInput
                  label={t('mothers.fullName')}
                  value={form.fullName}
                  onChange={(event) => set('fullName')(event.currentTarget.value)}
                  error={errorFor('fullName')}
                  required
                  autoFocus
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 4 }}>
                <NumberInput
                  label={t('mothers.age')}
                  value={form.age}
                  onChange={(value) => set('age')(value)}
                  min={10}
                  max={60}
                  error={errorFor('age')}
                  required
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  label={t('mothers.phone')}
                  value={form.phone}
                  onChange={(event) => set('phone')(event.currentTarget.value)}
                  error={errorFor('phone')}
                  placeholder="+255…"
                  required
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  label={t('mothers.village')}
                  value={form.village}
                  onChange={(event) => set('village')(event.currentTarget.value)}
                  error={errorFor('village')}
                  required
                />
              </Grid.Col>
              <Grid.Col span={12}>
                <Textarea
                  label={`${t('mothers.address')} (${t('common.optional')})`}
                  value={form.address}
                  onChange={(event) => set('address')(event.currentTarget.value)}
                  autosize
                  minRows={2}
                  maxLength={240}
                />
              </Grid.Col>
            </Grid>
          </Stack>

          <Stack gap="sm">
            <Title order={3}>{t('mothers.pregnancyStatus')}</Title>
            <Grid gutter="md">
              <Grid.Col span={{ base: 12, sm: 4 }}>
                <TextInput
                  type="date"
                  label={t('mothers.expectedDelivery')}
                  value={form.expectedDeliveryDate}
                  onChange={(event) => set('expectedDeliveryDate')(event.currentTarget.value)}
                  error={errorFor('expectedDeliveryDate')}
                  required
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 4 }}>
                <TextInput
                  type="date"
                  label={t('mothers.registrationDate')}
                  value={form.registrationDate}
                  onChange={(event) => set('registrationDate')(event.currentTarget.value)}
                  error={errorFor('registrationDate')}
                  required
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 4 }}>
                <Select
                  label={t('mothers.pregnancyStatus')}
                  value={form.status}
                  onChange={(value) => set('status')(value ?? 'pregnant')}
                  data={[
                    { value: 'pregnant', label: t('mother.status.pregnant') },
                    { value: 'postnatal', label: t('mother.status.postnatal') },
                    { value: 'inactive', label: t('mother.status.inactive') },
                  ]}
                  allowDeselect={false}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  type="date"
                  label={t('mothers.actualDelivery')}
                  description={t('mothers.actualDeliveryHint')}
                  value={form.actualDeliveryDate}
                  onChange={(event) => set('actualDeliveryDate')(event.currentTarget.value)}
                  error={errorFor('actualDeliveryDate')}
                />
              </Grid.Col>
              {isAdmin ? (
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Select
                    label={t('mothers.assignedWorker')}
                    value={form.workerId}
                    onChange={(value) => set('workerId')(value ?? '')}
                    data={workers.map((worker) => ({ value: worker.id, label: worker.fullName }))}
                    clearable
                    searchable
                  />
                </Grid.Col>
              ) : null}
            </Grid>
          </Stack>

          <Stack gap="sm">
            <Title order={3}>{t('mothers.contact')}</Title>
            <Grid gutter="md">
              <Grid.Col span={{ base: 12, sm: 4 }}>
                <Select
                  label={t('mothers.notificationLanguage')}
                  value={form.language}
                  onChange={(value) => set('language')(value ?? 'sw')}
                  data={[
                    { value: 'en', label: t('language.en') },
                    { value: 'sw', label: t('language.sw') },
                  ]}
                  allowDeselect={false}
                />
              </Grid.Col>
              <Grid.Col span={12}>
                <Checkbox
                  label={t('mothers.consent')}
                  description={t('mothers.consentHint')}
                  checked={form.consentReminders}
                  onChange={(event) => set('consentReminders')(event.currentTarget.checked)}
                />
              </Grid.Col>
              <Grid.Col span={12}>
                <Textarea
                  label={t('mothers.notes')}
                  value={form.notes}
                  onChange={(event) => set('notes')(event.currentTarget.value)}
                  autosize
                  minRows={3}
                  maxLength={1000}
                />
              </Grid.Col>
            </Grid>
          </Stack>

          <Group justify="flex-end">
            <Button variant="default" onClick={() => navigate(-1)}>{t('common.cancel')}</Button>
            <Button type="submit" loading={Boolean(busy.mother)} leftSection={<Icon name="check" size={16} />}>
              {editing ? t('common.saveChanges') : t('common.save')}
            </Button>
          </Group>
        </Stack>
      </Card>
      <Text size="xs" c="dimmed" mt="sm">{t('privacy.note')}</Text>
    </>
  )
}
