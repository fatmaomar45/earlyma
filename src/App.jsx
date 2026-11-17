import { lazy, Suspense } from 'react'
import { Center, Loader, Stack, Text } from '@mantine/core'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useApp } from './context/AppContext.jsx'
import { AppShellLayout } from './layout/AppShellLayout.jsx'
import { ToastViewport } from './components/ToastViewport.jsx'
import { LoginPage } from './pages/LoginPage.jsx'

// Pages are code-split so a CHW on a slow connection only downloads the screen
// they open. Login stays eager because it is the first paint.
const DashboardPage = lazy(() => import('./pages/DashboardPage.jsx').then((m) => ({ default: m.DashboardPage })))
const MothersPage = lazy(() => import('./pages/MothersPage.jsx').then((m) => ({ default: m.MothersPage })))
const MotherFormPage = lazy(() => import('./pages/MotherFormPage.jsx').then((m) => ({ default: m.MotherFormPage })))
const MotherProfilePage = lazy(() => import('./pages/MotherProfilePage.jsx').then((m) => ({ default: m.MotherProfilePage })))
const BabiesPage = lazy(() => import('./pages/BabiesPage.jsx').then((m) => ({ default: m.BabiesPage })))
const BabyFormPage = lazy(() => import('./pages/BabyFormPage.jsx').then((m) => ({ default: m.BabyFormPage })))
const BabyProfilePage = lazy(() => import('./pages/BabyProfilePage.jsx').then((m) => ({ default: m.BabyProfilePage })))
const VisitsPage = lazy(() => import('./pages/VisitsPage.jsx').then((m) => ({ default: m.VisitsPage })))
const VisitDetailsPage = lazy(() => import('./pages/VisitDetailsPage.jsx').then((m) => ({ default: m.VisitDetailsPage })))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage.jsx').then((m) => ({ default: m.NotificationsPage })))
const CallHistoryPage = lazy(() => import('./pages/CallHistoryPage.jsx').then((m) => ({ default: m.CallHistoryPage })))
const ReportsPage = lazy(() => import('./pages/ReportsPage.jsx').then((m) => ({ default: m.ReportsPage })))
const WorkersPage = lazy(() => import('./pages/WorkersPage.jsx').then((m) => ({ default: m.WorkersPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx').then((m) => ({ default: m.SettingsPage })))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage.jsx').then((m) => ({ default: m.NotFoundPage })))

function PageFallback() {
  const { t } = useApp()
  return (
    <Center h="60vh">
      <Stack align="center" gap="sm">
        <Loader color="teal" />
        <Text c="dimmed">{t('common.loading')}</Text>
      </Stack>
    </Center>
  )
}

export default function App() {
  const { ready, currentUser, t } = useApp()

  return (
    <>
      <ToastViewport />
      {!ready ? (
        <Center h="100vh">
          <Stack align="center" gap="sm">
            <Loader color="teal" />
            <Text c="dimmed">{t('common.loading')}</Text>
          </Stack>
        </Center>
      ) : !currentUser ? (
        <LoginPage />
      ) : (
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route element={<AppShellLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="mothers" element={<MothersPage />} />
              <Route path="mothers/new" element={<MotherFormPage />} />
              <Route path="mothers/:id" element={<MotherProfilePage />} />
              <Route path="mothers/:id/edit" element={<MotherFormPage />} />
              <Route path="babies" element={<BabiesPage />} />
              <Route path="babies/new" element={<BabyFormPage />} />
              <Route path="babies/:id" element={<BabyProfilePage />} />
              <Route path="babies/:id/edit" element={<BabyFormPage />} />
              <Route path="visits" element={<VisitsPage />} />
              <Route path="visits/:visitId" element={<VisitDetailsPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="calls" element={<CallHistoryPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="workers" element={<WorkersPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="home" element={<Navigate to="/" replace />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </Suspense>
      )}
    </>
  )
}