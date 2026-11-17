import { Group, Pagination, Text } from '@mantine/core'
import { useApp } from '../context/AppContext.jsx'

export function PaginationBar({ page, totalPages, total, from, to, onChange }) {
  const { t } = useApp()
  if (!total) return null
  return (
    <Group justify="space-between" mt="md" wrap="wrap" gap="sm">
      <Text size="sm" c="dimmed">{t('common.showing', { from, to, total })}</Text>
      <Group gap="xs">
        <Text size="sm" c="dimmed">{t('common.page')}</Text>
        <Pagination total={totalPages} value={page} onChange={onChange} size="sm" withEdges={totalPages > 5} />
      </Group>
    </Group>
  )
}
