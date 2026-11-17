import { useCallback, useEffect, useState } from 'react'

export function useInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState(null)
  const [installed, setInstalled] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator?.standalone === true
  })

  useEffect(() => {
    const onPrompt = (event) => {
      event.preventDefault()
      setPromptEvent(event)
    }
    const onInstalled = () => {
      setInstalled(true)
      setPromptEvent(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const promptInstall = useCallback(async () => {
    if (!promptEvent) return { outcome: 'unavailable' }
    promptEvent.prompt()
    const choice = await promptEvent.userChoice
    if (choice?.outcome === 'accepted') setInstalled(true)
    setPromptEvent(null)
    return choice ?? { outcome: 'dismissed' }
  }, [promptEvent])

  return { canInstall: Boolean(promptEvent), installed, promptInstall }
}
