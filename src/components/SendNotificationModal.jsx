import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Group, Modal, Select, Stack, Switch, Text, Textarea } from '@mantine/core'
import { useApp } from '../context/AppContext.jsx'
import { formatDate } from '../lib/dates.js'
import { buildNotificationMessage } from '../lib/templates.js'
import { clientName } from '../lib/clients.js'
import { buildAllVisits } from '../lib/visits.js'
import { Icon } from './Icon.jsx'

function withType(client) {
  return client?.type ? client : { ...client, type: client?.motherId ? 'baby' : 'mother' }
}

export function SendNotificationModal({
  opened,
  onClose,
  clients = [],
  defaultClientId = '',
  defaultVisitId = '',
  defaultType = 'remind',
}) {
  const { t, language, locale, db, sendNotification, queueNotification, toast, busy } = useApp()
  const [clientId, setClientId] = useState(defaultClientId)
  const [type, setType] = useState(defaultType)
  const [visitId, setVisitId] = useState(defaultVisitId)
  const [noteLanguage, setNoteLanguage] = useState(language === 'sw' ? 'sw' : 'en')
  const [message, setMessage] = useState('')
  const [allowDuplicate, setAllowDuplicate] = useState(false)

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === clientId) ?? null,
    [clientId, clients],
  )

  useEffect(() => {
    if (!opened) return
    setClientId(defaultClientId || clients[0]?.id || '')
    setType(defaultType)
    setVisitId(defaultVisitId)
    setNoteLanguage(clients.find((client) => client.id === defaultClientId)?.language ?? (language === 'sw' ? 'sw' : 'en'))
    setMessage('')
    setAllowDuplicate(false)
  }, [opened, defaultClientId, defaultVisitId, defaultType]) // eslint-disable-line react-hooks/exhaustive-deps

  const clientVisits = useMemo(() => {
    if (!selectedClient) return []
    return buildAllVisits(db).filter((visit) => visit.clientId === selectedClient.id)
  }, [selectedClient, db])

  const selectedVisit = clientVisits.find((visit) => visit.id === visitId) ?? null

  useEffect(() => {
    if (!selectedClient) {
      setMessage('')
      return
    }
    const generated = buildNotificationMessage(withType(selectedClient), type === 'test' ? 'remind' : type, selectedVisit, noteLanguage)
    setMessage(type === 'test' ? `${t('notifications.type.test')}: ${generated}` : generated)
  }, [selectedClient, selectedVisit, type, noteLanguage, t])

  useEffect(() => {
    if (!selectedClient) return
    setNoteLanguage(selectedClient.language ?? (language === 'sw' ? 'sw' : 'en'))
    setVisitId(defaultVisitId || selectedClient.__visits?.find((visit) => !['completed', 'cancelled'].includes(visit.status))?.id || '')
  }, [selectedClient?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const consent = selectedClient?.consentReminders !== false
  const sending = Boolean(busy[`send:${clientId}`])
  const canSubmit = Boolean(selectedClient && consent && message.trim())

  const submit = async (mode) => {
    if (!canSubmit) return
    const draft = {
      client: withType(selectedClient),
      type,
      visit: selectedVisit,
      language: noteLanguage,
      message,
      allowDuplicate,
    }
    const result = mode === 'queue'
      ? queueNotification(draft)
      : await sendNotification(draft)
    if (result?.duplicate) {
      toast({ title: t('notifications.duplicate'), color: 'orange' })
      return
    }
    if (result?.ok) onClose?.()
  }

  return (
    <Modal opened={opened} onClose={onClose} title={t('notifications.sendReminder')} size="lg">
      <Stack>
        <Select
          label={t('notifications.client')}
          searchable
          value={clientId}
          onChange={(value) => setClientId(value ?? '')}
          data={clients.map((client) => ({
            value: client.id,
            label: `${clientName(client)} · ${client.code ?? ''}`,
          }))}
          nothingFoundMessage={t('common.noData')}
          required
        />

        <Group grow align="flex-start">
          <Select
            label={t('notifications.type')}
            value={type}
            onChange={(value) => setType(value ?? 'remind')}
            data={[
              { value: 'remind', label: t('notifications.type.remind') },
              { value: 'missed', label: t('notifications.type.missed') },
              { value: 'followUp', label: t('notifications.type.followUp') },
              { value: 'test', label: t('notifications.type.test') },
            ]}
            allowDeselect={false}
          />
          <Select
            label={t('common.language')}
            value={noteLanguage}
            onChange={(value) => setNoteLanguage(value ?? 'en')}
            data={[
              { value: 'en', label: t('language.en') },
              { value: 'sw', label: t('language.sw') },
            ]}
            allowDeselect={false}
          />
        </Group>

        <Select
          label={t('visits.title')}
          value={visitId}
          onChange={(value) => setVisitId(value ?? '')}
          data={clientVisits.map((visit) => ({
            value: visit.id,
            label: `${visit.name?.[language] ?? visit.name?.en} · ${formatDate(visit.scheduledDate, locale)}`,
          }))}
          clearable
          searchable
          nothingFoundMessage={t('visits.empty')}
        />

        {!consent ? <Alert color="orange" variant="light" icon={<Icon name="alert" size={18} />}>{t('notifications.noConsent')}</Alert> : null}

        <Stack gap={4}>
          <Text size="sm" fw={600}>{t('notifications.message')}</Text>
          <Textarea
            value={message}
            onChange={(event) => setMessage(event.currentTarget.value)}
            minRows={4}
            maxLength={1000}
            autosize
          />
          <Text size="xs" c="dimmed">{message.length}/1000</Text>
        </Stack>

        <Switch
          checked={allowDuplicate}
          onChange={(event) => setAllowDuplicate(event.currentTarget.checked)}
          label={t('notifications.allowDuplicate')}
        />

        <Alert color="blue" variant="light" icon={<Icon name="shield" size={18} />}>{t('notifications.deliveryNote')}</Alert>

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="light" onClick={() => submit('queue')} disabled={!canSubmit}>{t('notifications.queue')}</Button>
          <Button onClick={() => submit('send')} loading={sending} disabled={!canSubmit}>{t('notifications.sendNow')}</Button>
        </Group>
      </Stack>
    </Modal>
  )
}
