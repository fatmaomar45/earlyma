import { Group, Stack, Text, Title } from '@mantine/core'

export function PageHeader({ title, subtitle, actions, meta }) {
  return (
    <Group justify="space-between" align="flex-start" gap="md" mb="lg" wrap="wrap">
      <Stack gap={4} style={{ minWidth: 0 }}>
        <Title order={1} className="page-title">{title}</Title>
        {subtitle ? <Text c="dimmed" maw={760}>{subtitle}</Text> : null}
        {meta}
      </Stack>
      {actions ? <Group gap="sm" wrap="wrap">{actions}</Group> : null}
    </Group>
  )
}
