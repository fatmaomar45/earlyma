import { Badge, Box, UnstyledButton } from '@mantine/core'
import { useLocation, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { Icon } from '../components/Icon.jsx'

const ITEMS = [
  { key: 'nav.dashboard', to: '/', icon: 'dashboard' },
  { key: 'nav.mothers', to: '/mothers', icon: 'mother' },
  { key: 'nav.babies', to: '/babies', icon: 'baby' },
  { key: 'nav.visits', to: '/visits', icon: 'calendar' },
  { key: 'nav.notifications', to: '/notifications', icon: 'bell' },
]

// One-hand, thumb-reachable primary navigation for phone screens. Hidden from
// md and up, where the collapsible sidebar takes over.
export function BottomNav() {
  const { t, notificationSummary } = useApp()
  const location = useLocation()
  const navigate = useNavigate()
  const pending = notificationSummary.pending + notificationSummary.failed

  const isActive = (to) => (to === '/' ? location.pathname === '/' : location.pathname.startsWith(to))

  return (
    <Box hiddenFrom="md" className="bottom-nav" role="navigation" aria-label={t('nav.main')}>
      {ITEMS.map((item) => {
        const active = isActive(item.to)
        return (
          <UnstyledButton
            key={item.to}
            className={`bottom-nav-item${active ? ' bottom-nav-item-active' : ''}`}
            onClick={() => navigate(item.to)}
            aria-current={active ? 'page' : undefined}
          >
            <Box className="bottom-nav-icon" pos="relative">
              <Icon name={item.icon} size={22} />
              {item.to === '/notifications' && pending > 0 ? (
                <Badge className="bottom-nav-badge" color="red" size="xs" circle>
                  {pending > 99 ? '99+' : pending}
                </Badge>
              ) : null}
            </Box>
            <Box component="span" className="bottom-nav-label">{t(item.key)}</Box>
          </UnstyledButton>
        )
      })}
    </Box>
  )
}