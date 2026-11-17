import { useCallback, useEffect, useRef, useState } from 'react'

export function useSpeech() {
  const [speaking, setSpeaking] = useState(false)
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const utteranceRef = useRef(null)

  const stop = useCallback(() => {
    if (!supported) return
    window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [supported])

  const speak = useCallback((text, language = 'en') => {
    if (!supported) return { ok: false, error: 'unsupported' }
    if (!text) return { ok: false, error: 'empty' }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = language === 'sw' ? 'sw-KE' : 'en-US'
    utterance.rate = 0.95
    utterance.pitch = 1
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    utteranceRef.current = utterance
    setSpeaking(true)
    window.speechSynthesis.speak(utterance)
    return { ok: true }
  }, [supported])

  useEffect(() => () => {
    if (supported) window.speechSynthesis.cancel()
  }, [supported])

  return { speak, stop, speaking, supported }
}
