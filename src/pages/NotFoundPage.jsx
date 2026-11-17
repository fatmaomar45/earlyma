import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { EmptyState } from '../components/EmptyState.jsx'

export function NotFoundPage() {
  const { t } = useApp()
  const navigate = useNavigate()
  return (
    <EmptyState
      icon="alert"
      title={t('notFound.title')}
      description={t('notFound.description')}
      actionLabel={t('notFound.backHome')}
      onAction={() => navigate('/')}
    />
  )
}
