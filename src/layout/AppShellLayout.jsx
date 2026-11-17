import { useEffect } from 'react'
import {
  AppShell,
  Avatar,
  Box,
  Burger,
  Button,
  Divider,
  Group,
  Indicator,
  Menu,
  NavLink,
  ScrollArea,
  Stack,
  Text,
  ThemeIcon,
  UnstyledButton,
  useMantineTheme,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { Icon } from '../components/Icon.jsx'
import { LanguageSwitch } from '../components/LanguageSwitch.jsx'
import { ConnectionIndicator } from '../components/ConnectionIndicator.jsx'
import { OfflineBanner } from '../components/OfflineBanner.jsx'
import { BottomNav } from './BottomNav.jsx'

const MAIN_NAV = [
  { key: 'nav.dashboard', to: '/', icon: 'dashboard' },
  { key: 'nav.mothers', to: '/mothers', icon: 'mother' },
  { key: 'nav.babies', to: '/babies', icon: 'baby' },
  { key: 'nav.visits', to: '/visits', icon: 'calendar' },
  { key: 'nav.notifications', to: '/notifications', icon: 'bell' },
  { key: 'nav.calls', to: '/calls', icon: 'phone' },
  { key: 'nav.reports', to: '/reports', icon: 'chart' },
]

const MANAGE_NAV = [
  { key: 'nav.workers', to: '/workers', icon: 'users', adminOnly: true },
  { key: 'nav.settings', to: '/settings', icon: 'settings' },
]

function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'EA'
}

export function AppShellLayout() {
  const { t, currentUser, isAdmin, logout, notificationSummary } = useApp()
  const theme = useMantineTheme()
  const [opened, { toggle, close }] = useDisclosure(false)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    close()
  }, [location.pathname, close])

  const isActive = (to) => (to === '/' ? location.pathname === '/' : location.pathname.startsWith(to))
  const pending = notificationSummary.pending + notificationSummary.failed

  const renderNav = (items) => items
    .filter((item) => !item.adminOnly || isAdmin)
    .map((item) => (
      <NavLink
        key={item.to}
        label={t(item.key)}
        leftSection={<Icon name={item.icon} size={19} />}
        active={isActive(item.to)}
        onClick={() => navigate(item.to)}
        variant="light"
        color="brand"
        style={{ borderRadius: theme.radius.md, marginBottom: 4 }}
        rightSection={item.to === '/notifications' && pending > 0 ? (
          <Box className="nav-count">{pending}</Box>
        ) : null}
      />
    ))

  return (
    <AppShell
      header={{ height: 64 }}
      navbar={{ width: 264, breakpoint: 'md', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger opened={opened} onClick={toggle} hiddenFrom="md" size="sm" aria-label={t('nav.main')} />
            <UnstyledButton onClick={() => navigate('/')} className="brand-button">
              <Group gap="xs" wrap="nowrap">
                <ThemeIcon size={36} radius="md" variant="gradient" gradient={{ from: 'teal', to: 'cyan', deg: 135 }}>
                  <Icon name="heart" size={20} />
                </ThemeIcon>
                <Box visibleFrom="xs">
                  <Text fw={800} lh={1.05}>{t('app.name')}</Text>
                  <Text size="xs" c="dimmed" lh={1.1}>{t('app.tagline')}</Text>
                </Box>
              </Group>
            </UnstyledButton>
          </Group>

          <Group gap="xs" wrap="nowrap">
            <ConnectionIndicator />
            <LanguageSwitch />
            <Indicator disabled={pending === 0} label={pending} size={16} color="red" offset={4}>
              <Button variant="subtle" color="gray" size="compact-md" onClick={() => navigate('/notifications')} aria-label={t('nav.notifications')}>
                <Icon name="bell" size={19} />
              </Button>
            </Indicator>
            <Menu position="bottom-end" width={220} shadow="md">
              <Menu.Target>
                <UnstyledButton aria-label={t('common.profile')}>
                  <Group gap="xs" wrap="nowrap">
                    <Avatar color="teal" radius="xl" size={34}>{initials(currentUser?.fullName)}</Avatar>
                    <Box visibleFrom="sm">
                      <Text size="sm" fw={650} lh={1.1}>{currentUser?.fullName}</Text>
                      <Text size="xs" c="dimmed" lh={1.2}>{t(currentUser?.role === 'admin' ? 'role.admin' : 'role.chw')}</Text>
                    </Box>
                  </Group>
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>{t('common.signedInAs')}</Menu.Label>
                <Menu.Item disabled>{currentUser?.email}</Menu.Item>
                <Menu.Divider />
                <Menu.Item leftSection={<Icon name="settings" size={16} />} onClick={() => navigate('/settings')}>{t('nav.settings')}</Menu.Item>
                <Menu.Item leftSection={<Icon name="logout" size={16} />} color="red" onClick={logout}>{t('common.logout')}</Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        <AppShell.Section grow component={ScrollArea}>
          <Stack gap={2}>
            <Text className="nav-section-label">{t('nav.main')}</Text>
            {renderNav(MAIN_NAV)}
            <Divider my="sm" />
            <Text className="nav-section-label">{t('nav.manage')}</Text>
            {renderNav(MANAGE_NAV)}
          </Stack>
        </AppShell.Section>
        <AppShell.Section>
          <Divider mb="sm" />
          <Stack gap="xs">
            <Box hiddenFrom="sm">
              <LanguageSwitch />
            </Box>
            <UnstyledButton className="sidebar-user" onClick={() => navigate('/settings')}>
              <Group gap="sm" wrap="nowrap">
                <Avatar color="teal" radius="xl" size={34}>{initials(currentUser?.fullName)}</Avatar>
                <Box style={{ minWidth: 0 }}>
                  <Text size="sm" fw={650} truncate>{currentUser?.fullName}</Text>
                  <Text size="xs" c="dimmed" truncate>{t(currentUser?.role === 'admin' ? 'role.admin' : 'role.chw')}</Text>
                </Box>
              </Group>
            </UnstyledButton>
            <Text size="xs" c="dimmed" px={4}>{t('app.demoNotice')}</Text>
          </Stack>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main className="app-main">
        <OfflineBanner />
        <Box className="page-container">
          <Outlet />
        </Box>
      </AppShell.Main>

      <BottomNav />
    </AppShell>
  )
}
