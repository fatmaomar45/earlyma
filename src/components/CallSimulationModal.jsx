import { useEffect, useState } from 'react'
import { Alert, Button, Group, Modal, Select, Stack, Switch, Text, Textarea } from '@mantine/core'
import { useApp } from '../context/AppContext.jsx'
import { useSpeech } from '../hooks/useSpeech.js'
import { buildCallScript } from '../lib/templates.js'
import { Icon } from './Icon.jsx'

export function CallSimulationModal({ opened, onClose, client, visit = null }) {
  const { t, language, recordCall, queueCallFollowUp, toast } = useApp()
  const { speak, stop, speaking, supported } = useSpeech()
  const [type, setType] = useState(visit?.status === 'overdue' ? 'missed' : 'reminder')
  const [callLanguage, setCallLanguage] = useState(client?.language ?? language)
  const [outcome, setOutcome] = useState('confirmed')
  const [notes, setNotes] = useState('')
  const [queueFollowUp, setQueueFollowUp] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!opened) return
    setType(visit?.status === 'overdue' ? 'missed' : 'reminder')
    setCallLanguage(client?.language ?? language)
    setOutcome('confirmed')
    setNotes('')
    setQueueFollowUp(false)
  }, [opened, client?.id, visit?.status, client?.language, language])

  const message = client ? buildCallScript(client, type, visit, callLanguage) : ''

  const handleSave = async () => {
    if (!client) return
    setSaving(true)
    try {
      const result = recordCall({
        client,
        type,
        language: callLanguage,
        message,
        outcome,
        notes,
        simulated: true,
        isDemo: Boolean(client.isDemo),
      })
      if (result.ok && queueFollowUp && result.call) {
        queueCallFollowUp(result.call, client)
      }
      stop()
      onClose?.()
    } finally {
      setSaving(false)
    }
  }

  const handlePlay = () => {
    const result = speak(message, callLanguage)
    if (!result.ok && result.error === 'unsupported') toast({ title: t('calls.noSpeech'), color: 'orange' })
  }

  return (
    <Modal opened={opened} onClose={() => { stop(); onClose?.() }} title={t('calls.title')} size="lg">
      <Stack>
        <Alert color="blue" variant="light" icon={<Icon name="shield" size={18} />}>
          {t('calls.demoWarning')}
        </Alert>

        <Group grow align="flex-start">
          <Select
            label={t('calls.callType')}
            value={type}
            onChange={(value) => setType(value ?? 'reminder')}
            data={[
              { value: 'reminder', label: t('calls.reminder') },
              { value: 'missed', label: t('calls.missed') },
            ]}
            allowDeselect={false}
          />
          <Select
            label={t('calls.language')}
            value={callLanguage}
            onChange={(value) => setCallLanguage(value ?? 'en')}
            data={[
              { value: 'en', label: t('language.en') },
              { value: 'sw', label: t('language.sw') },
            ]}
            allowDeselect={false}
          />
        </Group>

        <Stack gap={4}>
          <Text size="sm" fw={600}>{t('calls.preview')}</Text>
          <Alert variant="light" color="gray">{message || t('calls.noMessage')}</Alert>
          <Group>
            <Button
              variant="light"
              leftSection={<Icon name="message" size={16} />}
              onClick={handlePlay}
              disabled={!supported || !message}
            >
              {t('calls.play')}
            </Button>
            {speaking ? <Button variant="subtle" color="gray" onClick={stop}>{t('calls.stop')}</Button> : null}
          </Group>
          {!supported ? <Text size="xs" c="orange">{t('calls.noSpeech')}</Text> : null}
        </Stack>

        <Select
          label={t('calls.outcome')}
          value={outcome}
          onChange={(value) => setOutcome(value ?? 'completed')}
          data={[
            { value: 'confirmed', label: t('calls.outcome.confirmed') },
            { value: 'no_answer', label: t('calls.outcome.no_answer') },
            { value: 'failed', label: t('calls.outcome.failed') },
            { value: 'rescheduled', label: t('calls.outcome.rescheduled') },
            { value: 'completed', label: t('calls.outcome.completed') },
          ]}
          allowDeselect={false}
        />

        <Textarea
          label={t('calls.notes')}
          value={notes}
          onChange={(event) => setNotes(event.currentTarget.value)}
          minRows={2}
          autosize
          maxLength={500}
        />

        {['no_answer', 'failed'].includes(outcome) ? (
          <Switch
            checked={queueFollowUp}
            onChange={(event) => setQueueFollowUp(event.currentTarget.checked)}
            label={t('calls.queueFollowUp')}
          />
        ) : null}

        <Group justify="flex-end">
          <Button variant="default" onClick={() => { stop(); onClose?.() }}>{t('common.cancel')}</Button>
          <Button onClick={handleSave} loading={saving} disabled={!client}>{t('common.save')}</Button>
        </Group>
      </Stack>
    </Modal>
  )
}
