import { Badge } from '@mantine/core'
import { useApp } from '../context/AppContext.jsx'

const VISIT_COLORS = {
  completed: 'green',
  cancelled: 'gray',
  overdue: 'red',
  due_today: 'orange',
  due_soon: 'yellow',
  upcoming: 'blue',
}

const NOTIFICATION_COLORS = {
  queued: 'blue',
  processing: 'cyan',
  sent: 'teal',
  delivered: 'green',
  failed: 'red',
  cancelled: 'gray',
  received: 'grape',
  sending: 'cyan',
}

const CLIENT_COLORS = {
  pregnant: 'pink',
  postnatal: 'teal',
  active: 'teal',
  inactive: 'gray',
  unknown: 'gray',
}

export function VisitStatusBadge({ status, size = 'sm' }) {
  const { t } = useApp()
  return (
    <Badge color={VISIT_COLORS[status] ?? 'gray'} size={size} variant="light">
      {t(`visit.status.${status ?? 'upcoming'}`)}
    </Badge>
  )
}

export function NotificationStatusBadge({ status, size = 'sm' }) {
  const { t } = useApp()
  const normalized = status === 'sending' ? 'processing' : status
  return (
    <Badge color={NOTIFICATION_COLORS[normalized] ?? 'gray'} size={size} variant="light">
      {t(`notifications.status.${normalized ?? 'unknown'}`)}
    </Badge>
  )
}

export function ClientStatusBadge({ status, type = 'mother', size = 'sm' }) {
  const { t } = useApp()
  if (type === 'baby') {
    return <Badge color={CLIENT_COLORS[status] ?? 'gray'} size={size} variant="light">{t(`baby.status.${status ?? 'active'}`)}</Badge>
  }
  return <Badge color={CLIENT_COLORS[status] ?? 'gray'} size={size} variant="light">{t(`mother.status.${status ?? 'pregnant'}`)}</Badge>
}

export function CategoryBadge({ category, language, size = 'sm' }) {
  const { t } = useApp()
  return <Badge color="gray" size={size} variant="outline">{t(`visit.category.${category ?? 'child_health'}`)}</Badge>
}
