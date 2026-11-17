import { Button, Group, Modal, Stack, Text } from '@mantine/core'
import { useApp } from '../context/AppContext.jsx'

export function ConfirmModal({
  opened,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel,
  cancelLabel,
  color = 'red',
  loading = false,
}) {
  const { t } = useApp()
  return (
    <Modal opened={opened} onClose={onClose} title={title ?? t('common.confirm')} size="md">
      <Stack>
        <Text size="sm" c="dimmed">{body}</Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={loading}>{cancelLabel ?? t('common.cancel')}</Button>
          <Button color={color} loading={loading} onClick={onConfirm}>{confirmLabel ?? t('common.confirm')}</Button>
        </Group>
      </Stack>
    </Modal>
  )
}
