import { Card, Group, Stack, Text, ThemeIcon } from '@mantine/core'
import { Link } from 'react-router-dom'
import { Icon } from './Icon.jsx'

export function StatCard({ label, value, hint, icon = 'chart', color = 'teal', to, onClick, emphasis = false }) {
  const content = (
    <Card
      className={`stat-card${emphasis ? ' stat-card-emphasis' : ''}`}
      padding="md"
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick(event)
        }
      } : undefined}
    >
      <Group align="flex-start" wrap="nowrap" justify="space-between">
        <Stack gap={2} style={{ minWidth: 0 }}>
          <Text size="xs" tt="uppercase" fw={700} c="dimmed" lh={1.2}>{label}</Text>
          <Text fw={800} fz={30} lh={1.1}>{value}</Text>
          {hint ? <Text size="xs" c="dimmed">{hint}</Text> : null}
        </Stack>
        <ThemeIcon variant="light" color={color} size={42} radius="md">
          <Icon name={icon} size={22} />
        </ThemeIcon>
      </Group>
    </Card>
  )

  if (to) return <Link to={to} className="stat-card-link">{content}</Link>
  return content
}
