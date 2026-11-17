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
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { PageHeader } from '../components/PageHeader.jsx'
import { EmptyState } from '../components/EmptyState.jsx'
import { Icon } from '../components/Icon.jsx'

const EMPTY = {
  fullName: '',
  motherId: '',
  motherName: '',
  dateOfBirth: '',
  sex: 'unknown',
  birthWeightKg: '',
  currentWeightKg: '',
  village: '',
  language: 'sw',
  consentReminders: false,
  notes: '',
  workerId: '',
}

function fromBaby(baby) {
  return {
    fullName: baby.fullName ?? '',
    motherId: baby.motherId ?? '',
    motherName: baby.motherName ?? '',
    dateOfBirth: baby.dateOfBirth ?? '',
    sex: baby.sex ?? 'unknown',
    birthWeightKg: baby.birthWeightKg ?? '',
    currentWeightKg: baby.currentWeightKg ?? '',
    village: baby.village ?? '',
    language: baby.language ?? 'sw',
    consentReminders: Boolean(baby.consentReminders),
    notes: baby.notes ?? '',
    workerId: baby.workerId ?? '',
  }
}

export function BabyFormPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const motherIdParam = searchParams.get('motherId') ?? ''
  const editing = Boolean(id)
  const {
    t, db, currentUser, isAdmin, addBaby, updateBaby,
  } = useApp()
  const navigate = useNavigate()
  const existing = editing ? (db.babies ?? []).find((baby) => baby.id === id) : null
  const mothers = useMemo(
    () => (db.mothers ?? []).filter((mother) => mother.status !== 'inactive'),
    [db.mothers],
  )
  const workers = useMemo(
    () => (db.workers ?? []).filter((worker) => worker.active),
    [db.workers],
  )
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (existing) {
      setForm(fromBaby(existing))
      return
    }
    const linked = mothers.find((mother) => mother.id === motherIdParam)
    setForm({
      ...EMPTY,
      motherId: linked?.id ?? '',
      motherName: linked?.fullName ?? '',
      village: linked?.village ?? '',
      language: linked?.language ?? 'sw',
      consentReminders: linked?.consentReminders ?? false,
      workerId: currentUser?.id ?? '',
    })
  }, [id, motherIdParam]) // eslint-disable-line react-hooks/exhaustive-deps

  if (editing && (!existing || (!isAdmin && existing.workerId !== currentUser?.id))) {
    return (
      <EmptyState
        icon="alert"
        title={t('babies.notFound')}
        actionLabel={t('common.back')}
        onAction={() => navigate('/babies')}
      />
    )
  }

  const set = (key) => (value) => setForm((current) => ({ ...current, [key]: value }))

  const onMotherChange = (motherId) => {
    const mother = mothers.find((entry) => entry.id === motherId)
    setForm((current) => ({
      ...current,
      motherId: motherId ?? '',
      motherName: mother?.fullName ?? current.motherName,
      village: current.village || mother?.village || '',
      language: mother?.language ?? current.language,
      consentReminders: mother ? mother.consentReminders : current.consentReminders,
      workerId: current.workerId || mother?.workerId || '',
    }))
  }

  const submit = (event) => {
    event.preventDefault()
    setErrors({})
    const payload = { ...form, workerId: form.workerId || currentUser?.id || null }
    const result = editing ? updateBaby(id, payload) : addBaby(payload)
    if (!result.ok) {
      setErrors(result.errors ?? { form: 'toast.error' })
      return
    }
    navigate(`/babies/${result.client.id}`)
  }

  const errorFor = (key) => (errors[key] ? t(errors[key]) : undefined)

  return (
    <>
      <PageHeader
        title={editing ? t('babies.edit') : t('babies.add')}
        subtitle={t('babies.subtitle')}
        actions={<Button variant="default" onClick={() => navigate(-1)}>{t('common.cancel')}</Button>}
      />

      <Card component="form" onSubmit={submit} maw={980}>
        <Stack gap="lg">
          {errors.form ? <Alert color="red">{t(errors.form)}</Alert> : null}
          {errors.duplicate ? <Alert color="orange">{errorFor('duplicate')}</Alert> : null}

          <Stack gap="sm">
            <Title order={3}>{t('babies.profile')}</Title>
            <Grid gutter="md">
              <Grid.Col span={{ base: 12, sm: 8 }}>
                <TextInput
                  label={t('babies.fullName')}
                  value={form.fullName}
                  onChange={(event) => set('fullName')(event.currentTarget.value)}
                  error={errorFor('fullName')}
                  required
                  autoFocus
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 4 }}>
                <Select
                  label={t('babies.sex')}
                  value={form.sex}
                  onChange={(value) => set('sex')(value ?? 'unknown')}
                  data={[
                    { value: 'female', label: t('sex.female') },
                    { value: 'male', label: t('sex.male') },
                    { value: 'unknown', label: t('sex.unknown') },
                  ]}
                  allowDeselect={false}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Select
                  label={t('babies.linkedMother')}
                  description={t('babies.motherLinkHint')}
                  value={form.motherId}
                  onChange={onMotherChange}
                  data={mothers.map((mother) => ({ value: mother.id, label: `${mother.fullName} · ${mother.code}` }))}
                  searchable
                  clearable
                  nothingFoundMessage={t('common.noData')}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  label={t('babies.motherName')}
                  value={form.motherName}
                  onChange={(event) => set('motherName')(event.currentTarget.value)}
                  error={errorFor('motherName')}
                  required
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 4 }}>
                <TextInput
                  type="date"
                  label={t('babies.dateOfBirth')}
                  value={form.dateOfBirth}
                  onChange={(event) => set('dateOfBirth')(event.currentTarget.value)}
                  error={errorFor('dateOfBirth')}
                  required
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 4 }}>
                <NumberInput
                  label={`${t('babies.birthWeight')} (kg)`}
                  value={form.birthWeightKg}
                  onChange={(value) => set('birthWeightKg')(value)}
                  min={0.3}
                  max={8}
                  step={0.1}
                  decimalScale={2}
                  error={errorFor('birthWeightKg')}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 4 }}>
                <NumberInput
                  label={`${t('babies.currentWeight')} (kg)`}
                  value={form.currentWeightKg}
                  onChange={(value) => set('currentWeightKg')(value)}
                  min={0.3}
                  max={50}
                  step={0.1}
                  decimalScale={2}
                  error={errorFor('currentWeightKg')}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  label={t('babies.village')}
                  value={form.village}
                  onChange={(event) => set('village')(event.currentTarget.value)}
                  error={errorFor('village')}
                  required
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
                  label={t('babies.notes')}
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
            <Button type="submit" leftSection={<Icon name="check" size={16} />}>
              {editing ? t('common.saveChanges') : t('common.save')}
            </Button>
          </Group>
        </Stack>
      </Card>
      <Text size="xs" c="dimmed" mt="sm">{t('privacy.note')}</Text>
    </>
  )
}
