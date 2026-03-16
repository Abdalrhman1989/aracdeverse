'use client'
import { useEffect, useRef } from 'react'

export function Starfield() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return

    const count = 100
    el.innerHTML = ''
    for (let i = 0; i < count; i++) {
      const s = document.createElement('div')
      const sz = Math.random() * 2 + 0.5
      s.style.cssText = `
        position:absolute;
        border-radius:50%;
        background:#fff;
        width:${sz}px; height:${sz}px;
        left:${Math.random()*100}%;
        top:${Math.random()*100}%;
        opacity:${Math.random()*0.5+0.1};
        animation: twinkle ${2+Math.random()*4}s ${Math.random()*4}s infinite alternate ease-in-out;
      `
      el.appendChild(s)
    }
  }, [])

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="fixed inset-0 z-0 overflow-hidden pointer-events-none"
    />
  )
}
