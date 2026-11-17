import { SegmentedControl } from '@mantine/core'
import { useApp } from '../context/AppContext.jsx'

export function LanguageSwitch({ size = 'sm' }) {
  const { language, setLanguage, t } = useApp()
  return (
    <SegmentedControl
      size={size}
      value={language}
      onChange={setLanguage}
      aria-label={t('settings.interfaceLanguage')}
      data={[
        { value: 'en', label: 'EN' },
        { value: 'sw', label: 'SW' },
      ]}
    />
  )
}
