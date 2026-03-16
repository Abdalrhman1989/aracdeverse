import { useEffect, useRef, useCallback } from 'react'

type KeyHandler = (key: string, event: KeyboardEvent) => void
const GAME_KEYS = new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'])

export function useKeyboard(onKeyDown?: KeyHandler, onKeyUp?: KeyHandler) {
  const keysPressed = useRef(new Set<string>())

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (GAME_KEYS.has(e.code)) e.preventDefault()
      keysPressed.current.add(e.code)
      onKeyDown?.(e.code, e)
    }
    const up = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.code)
      onKeyUp?.(e.code, e)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup',   up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [onKeyDown, onKeyUp])

  const isPressed = useCallback((key: string) => keysPressed.current.has(key), [])
  return { isPressed, keysPressed }
}
