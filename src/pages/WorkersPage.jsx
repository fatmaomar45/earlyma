import { useEffect, useMemo, useState } from 'react'
import {
  ActionIcon,
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  Group,
  Modal,
  PasswordInput,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { PageHeader } from '../components/PageHeader.jsx'
import { PaginationBar } from '../components/PaginationBar.jsx'
import { EmptyState } from '../components/EmptyState.jsx'
import { ConfirmModal } from '../components/ConfirmModal.jsx'
import { Icon } from '../components/Icon.jsx'
import { clientName, paginate } from '../lib/clients.js'
import { formatDate } from '../lib/dates.js'

const EMPTY_FORM = {
  fullName: '',
  phone: '',
  village: '',
  facility: '',
  email: '',
  role: 'chw',
  notes: '',
  password: '',
  active: true,
}

export function WorkersPage() {
  const {
    t,
    db,
    locale,
    currentUser,
    isAdmin,
    busy,
    addWorker,
    updateWorker,
    deleteWorker,
    toggleWorkerActive,
    assignClients,
  } = useApp()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [deleteId, setDeleteId] = useState(null)
  const [assignId, setAssignId] = useState(null)
  const [assignedMotherIds, setAssignedMotherIds] = useState([])
  const [assignedBabyIds, setAssignedBabyIds] = useState([])
  const pageSize = db.preferences?.pageSize ?? 10

  const workers = useMemo(() => {
    const list = [...(db.workers ?? [])].sort((a, b) => a.fullName.localeCompare(b.fullName))
    const needle = query.trim().toLocaleLowerCase()
    if (!needle) return list
    return list.filter((worker) => (
      `${worker.fullName} ${worker.email} ${worker.phone} ${worker.village} ${worker.code}`.toLocaleLowerCase().includes(needle)
    ))
  }, [db.workers, query])

  const paged = paginate(workers, page, pageSize)
  const editingWorker = editingId ? (db.workers ?? []).find((worker) => worker.id === editingId) ?? null : null
  const deleteWorkerRecord = deleteId ? (db.workers ?? []).find((worker) => worker.id === deleteId) ?? null : null
  const assignWorker = assignId ? (db.workers ?? []).find((worker) => worker.id === assignId) ?? null : null

  const clientCount = (workerId) => (
    (db.mothers ?? []).filter((client) => client.workerId === workerId).length
    + (db.babies ?? []).filter((client) => client.workerId === workerId).length
  )

  useEffect(() => { setPage(1) }, [query, pageSize])

  useEffect(() => {
    if (!formOpen) return
    if (editingWorker) {
      setForm({
        fullName: editingWorker.fullName ?? '',
        phone: editingWorker.phone ?? '',
        village: editingWorker.village ?? '',
        facility: editingWorker.facility ?? '',
        email: editingWorker.email ?? '',
        role: editingWorker.role ?? 'chw',
        notes: editingWorker.notes ?? '',
        password: '',
        active: editingWorker.active !== false,
      })
    } else {
      setForm(EMPTY_FORM)
    }
    setErrors({})
  }, [formOpen, editingId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!assignWorker) return
    setAssignedMotherIds((db.mothers ?? []).filter((client) => client.workerId === assignWorker.id).map((client) => client.id))
    setAssignedBabyIds((db.babies ?? []).filter((client) => client.workerId === assignWorker.id).map((client) => client.id))
  }, [assignWorker?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!isAdmin) {
    return (
      <EmptyState
        icon="shield"
        title={t('workers.accessDenied')}
        actionLabel={t('notFound.backHome')}
        onAction={() => navigate('/')}
      />
    )
  }

  const openCreate = () => {
    setEditingId(null)
    setFormOpen(true)
  }

  const openEdit = (worker) => {
    setEditingId(worker.id)
    setFormOpen(true)
  }

  const setField = (key) => (event) => setForm((current) => ({
    ...current,
    [key]: event?.currentTarget ? event.currentTarget.value : event,
  }))

  const submit = async () => {
    const payload = { ...form }
    if (!payload.password) delete payload.password
    const result = editingId
      ? await updateWorker(editingId, payload)
      : await addWorker(payload)
    if (!result.ok) {
      setErrors(result.errors ?? {})
      return
    }
    setFormOpen(false)
    setEditingId(null)
  }

  const confirmDelete = () => {
    if (!deleteWorkerRecord) return
    const result = deleteWorker(deleteWorkerRecord.id)
    if (!result.ok && result.error === 'self') {
      // The hook surfaces a translated message through the delete button guard.
      setDeleteId(null)
      return
    }
    setDeleteId(null)
  }

  const saveAssignments = () => {
    if (!assignWorker) return
    assignClients(assignWorker.id, { motherIds: assignedMotherIds, babyIds: assignedBabyIds })
    setAssignId(null)
  }

  const toggleIds = (setter) => (id) => {
    setter((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]))
  }

  return (
    <>
      <PageHeader
        title={t('workers.title')}
        subtitle={t('workers.subtitle')}
        actions={(
          <Button leftSection={<Icon name="plus" size={16} />} onClick={openCreate}>
            {t('workers.add')}
          </Button>
        )}
      />

      <Card mb="md">
        <Group align="flex-end" gap="sm" wrap="wrap">
          <TextInput
            label={t('common.search')}
            placeholder={t('workers.searchPlaceholder')}
            leftSection={<Icon name="search" size={16} />}
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            style={{ flex: '1 1 260px' }}
          />
          <Text size="xs" c="dimmed" style={{ flex: '1 1 220px' }}>
            {t('workers.activeHint')}
          </Text>
        </Group>
      </Card>

      {!workers.length ? (
        <Card>
          <EmptyState
            icon="users"
            title={t('workers.empty')}
            description={t('workers.emptyHint')}
            actionLabel={t('workers.add')}
            onAction={openCreate}
          />
        </Card>
      ) : (
        <Card p={0}>
          <ScrollArea>
            <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md" miw={980}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('workers.fullName')}</Table.Th>
                  <Table.Th>{t('workers.village')}</Table.Th>
                  <Table.Th>{t('workers.phone')}</Table.Th>
                  <Table.Th>{t('workers.role')}</Table.Th>
                  <Table.Th>{t('workers.assignedClients')}</Table.Th>
                  <Table.Th>{t('common.status')}</Table.Th>
                  <Table.Th>{t('workers.registrationDate')}</Table.Th>
                  <Table.Th>{t('common.actions')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {paged.items.map((worker) => {
                  const self = worker.id === currentUser?.id
                  const isBusy = Boolean(busy.worker || busy[`worker:${worker.id}`])
                  return (
                    <Table.Tr key={worker.id}>
                      <Table.Td>
                        <Group gap="sm" wrap="nowrap">
                          <Avatar color={worker.role === 'admin' ? 'grape' : 'teal'} radius="xl" size={32}>
                            {worker.fullName.slice(0, 1)}
                          </Avatar>
                          <Stack gap={0} style={{ minWidth: 0 }}>
                            <Text size="sm" fw={650}>{worker.fullName}</Text>
                            <Text size="xs" c="dimmed">{worker.email}</Text>
                            {worker.requiresPasswordReset ? <Text size="xs" c="orange">{t('workers.passwordReset')}</Text> : null}
                          </Stack>
                        </Group>
                      </Table.Td>
                      <Table.Td>{worker.village || <Text size="xs" c="dimmed">—</Text>}</Table.Td>
                      <Table.Td>{worker.phone || '—'}</Table.Td>
                      <Table.Td>
                        <Badge color={worker.role === 'admin' ? 'grape' : 'teal'} variant="light">
                          {t(worker.role === 'admin' ? 'role.admin' : 'role.chw')}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Button
                          size="compact-xs"
                          variant="subtle"
                          onClick={() => setAssignId(worker.id)}
                        >
                          {t('workers.assignedCount', { count: clientCount(worker.id) })}
                        </Button>
                      </Table.Td>
                      <Table.Td>
                        <Badge color={worker.active ? 'teal' : 'gray'} variant="light">
                          {t(worker.active ? 'workers.statusActive' : 'workers.statusInactive')}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{worker.registrationDate ? formatDate(new Date(`${worker.registrationDate}T12:00:00`), locale) : '—'}</Table.Td>
                      <Table.Td>
                        <Group gap={4} wrap="nowrap">
                          <Tooltip label={t('common.edit')}>
                            <ActionIcon variant="subtle" onClick={() => openEdit(worker)} aria-label={t('common.edit')}>
                              <Icon name="edit" size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label={t('workers.assign')}>
                            <ActionIcon variant="subtle" onClick={() => setAssignId(worker.id)} aria-label={t('workers.assign')}>
                              <Icon name="users" size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label={worker.active ? t('workers.deactivate') : t('workers.activate')}>
                            <ActionIcon
                              variant="subtle"
                              color={worker.active ? 'orange' : 'teal'}
                              onClick={() => toggleWorkerActive(worker.id)}
                              disabled={self || isBusy}
                              aria-label={worker.active ? t('workers.deactivate') : t('workers.activate')}
                            >
                              <Icon name={worker.active ? 'close' : 'check'} size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label={self ? t('workers.cannotDeleteSelf') : t('common.delete')}>
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              onClick={() => setDeleteId(worker.id)}
                              disabled={self}
                              aria-label={t('common.delete')}
                            >
                              <Icon name="trash" size={16} />
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

      <Modal
        opened={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingId ? t('workers.edit') : t('workers.add')}
        size="lg"
      >
        <Stack>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <TextInput
              label={t('workers.fullName')}
              value={form.fullName}
              onChange={setField('fullName')}
              error={errors.fullName ? t(errors.fullName) : undefined}
              required
            />
            <TextInput
              label={t('workers.phone')}
              value={form.phone}
              onChange={setField('phone')}
              error={errors.phone ? t(errors.phone) : undefined}
              required
            />
            <TextInput
              label={t('workers.village')}
              value={form.village}
              onChange={setField('village')}
              error={errors.village ? t(errors.village) : undefined}
              required
            />
            <TextInput
              label={t('workers.facility')}
              value={form.facility}
              onChange={setField('facility')}
            />
            <TextInput
              label={t('workers.email')}
              type="email"
              value={form.email}
              onChange={setField('email')}
              error={errors.email ? t(errors.email) : undefined}
              required
            />
            <Select
              label={t('workers.role')}
              value={form.role}
              onChange={(value) => setForm((current) => ({ ...current, role: value ?? 'chw' }))}
              data={[
                { value: 'chw', label: t('role.chw') },
                { value: 'admin', label: t('role.admin') },
              ]}
              allowDeselect={false}
              description={t('workers.roleHint')}
            />
          </SimpleGrid>

          <PasswordInput
            label={t('workers.password')}
            value={form.password}
            onChange={setField('password')}
            error={errors.password ? t(errors.password) : undefined}
            description={t('workers.passwordHint')}
            autoComplete="new-password"
          />

          <Textarea
            label={t('workers.notes')}
            value={form.notes}
            onChange={setField('notes')}
            minRows={2}
            autosize
            maxLength={500}
          />

          <Switch
            checked={form.active}
            onChange={(event) => setForm((current) => ({ ...current, active: event.currentTarget.checked }))}
            label={t('workers.active')}
            description={t('workers.activeHint')}
            disabled={editingWorker?.id === currentUser?.id}
          />

          <Group justify="flex-end">
            <Button variant="default" onClick={() => setFormOpen(false)} disabled={Boolean(busy.worker)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={submit} loading={Boolean(busy.worker)}>{t('common.save')}</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={Boolean(assignWorker)}
        onClose={() => setAssignId(null)}
        title={`${t('workers.assignClients')} · ${assignWorker?.fullName ?? ''}`}
        size="xl"
      >
        <Stack>
          <Text size="sm" c="dimmed">{t('workers.assignHint')}</Text>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            <Card withBorder>
              <Group justify="space-between" mb="xs">
                <Text fw={650}>{t('workers.assignedMothers')}</Text>
                <Badge>{assignedMotherIds.length}</Badge>
              </Group>
              <Divider mb="xs" />
              <ScrollArea h={260}>
                <Stack gap={6}>
                  {(db.mothers ?? []).map((mother) => (
                    <Checkbox
                      key={mother.id}
                      checked={assignedMotherIds.includes(mother.id)}
                      onChange={() => toggleIds(setAssignedMotherIds)(mother.id)}
                      label={`${clientName(mother)} · ${mother.code ?? ''}${mother.village ? ` · ${mother.village}` : ''}`}
                    />
                  ))}
                  {!(db.mothers ?? []).length ? <Text size="xs" c="dimmed">{t('workers.noClients')}</Text> : null}
                </Stack>
              </ScrollArea>
            </Card>
            <Card withBorder>
              <Group justify="space-between" mb="xs">
                <Text fw={650}>{t('workers.assignedBabies')}</Text>
                <Badge>{assignedBabyIds.length}</Badge>
              </Group>
              <Divider mb="xs" />
              <ScrollArea h={260}>
                <Stack gap={6}>
                  {(db.babies ?? []).map((baby) => (
                    <Checkbox
                      key={baby.id}
                      checked={assignedBabyIds.includes(baby.id)}
                      onChange={() => toggleIds(setAssignedBabyIds)(baby.id)}
                      label={`${clientName(baby)} · ${baby.code ?? ''}${baby.village ? ` · ${baby.village}` : ''}`}
                    />
                  ))}
                  {!(db.babies ?? []).length ? <Text size="xs" c="dimmed">{t('workers.noClients')}</Text> : null}
                </Stack>
              </ScrollArea>
            </Card>
          </SimpleGrid>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setAssignId(null)}>{t('common.cancel')}</Button>
            <Button onClick={saveAssignments}>{t('common.saveChanges')}</Button>
          </Group>
        </Stack>
      </Modal>

      <ConfirmModal
        opened={Boolean(deleteWorkerRecord)}
        onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete}
        title={t('workers.deleteConfirm')}
        body={`${deleteWorkerRecord?.fullName ?? ''} — ${t('workers.deleteWarning')}`}
        confirmLabel={t('common.yesDelete')}
      />
    </>
  )
}
