import { ActionIcon, Card, Group, Stack, Text } from '@mantine/core'
import { useApp } from '../context/AppContext.jsx'
import { Icon } from './Icon.jsx'

const BORDER = {
  teal: '#0d9488',
  green: '#16a34a',
  blue: '#2563eb',
  orange: '#ea580c',
  red: '#dc2626',
  gray: '#64748b',
}

export function ToastViewport() {
  const { toasts, dismissToast } = useApp()

  if (!toasts.length) return null

  return (
    <div className="toast-viewport" role="status" aria-live="polite">
      <Stack gap="sm">
        {toasts.map((toast) => (
          <Card
            key={toast.id}
            className="toast-card"
            padding="sm"
            style={{ borderLeft: `4px solid ${BORDER[toast.color] ?? BORDER.teal}` }}
          >
            <Group align="flex-start" wrap="nowrap" gap="xs">
              <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                <Text fw={600} size="sm">{toast.title}</Text>
                {toast.message ? <Text size="xs" c="dimmed">{toast.message}</Text> : null}
              </Stack>
              <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => dismissToast(toast.id)} aria-label="Dismiss">
                <Icon name="close" size={14} />
              </ActionIcon>
            </Group>
          </Card>
        ))}
      </Stack>
    </div>
  )
}
