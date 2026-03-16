/**
 * ArcadeVerse Sound Engine
 * Web Audio API — zero dependencies, works in all modern browsers.
 * All sounds are synthesized procedurally (no audio files needed).
 */

let ctx: AudioContext | null = null
let masterGain: GainNode | null = null
let muted = false

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    masterGain = ctx.createGain()
    masterGain.gain.value = 0.35
    masterGain.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function play(fn: (c: AudioContext, g: GainNode) => void) {
  if (muted || typeof window === 'undefined') return
  try { fn(getCtx(), masterGain!) } catch {}
}

export function setMuted(m: boolean) { muted = m }
export function isMuted() { return muted }

// ── Card flip sound ──────────────────────────────────────────────────────────
export function sfxCardFlip() {
  play((c, g) => {
    const buf = c.createBuffer(1, c.sampleRate * 0.08, c.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3) * 0.4
    }
    const src = c.createBufferSource()
    src.buffer = buf
    const f = c.createBiquadFilter()
    f.type = 'bandpass'; f.frequency.value = 3000; f.Q.value = 0.5
    src.connect(f); f.connect(g)
    src.start()
  })
}

// ── Card place / lay down ────────────────────────────────────────────────────
export function sfxCardPlay() {
  play((c, g) => {
    const osc = c.createOscillator()
    const env = c.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(320, c.currentTime)
    osc.frequency.exponentialRampToValueAtTime(180, c.currentTime + 0.1)
    env.gain.setValueAtTime(0.3, c.currentTime)
    env.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.15)
    osc.connect(env); env.connect(g)
    osc.start(); osc.stop(c.currentTime + 0.15)
  })
}

// ── Win / trick won ──────────────────────────────────────────────────────────
export function sfxWin() {
  play((c, g) => {
    const freqs = [523, 659, 784, 1047]
    freqs.forEach((f, i) => {
      const osc = c.createOscillator()
      const env = c.createGain()
      osc.type = 'sine'
      osc.frequency.value = f
      const t = c.currentTime + i * 0.1
      env.gain.setValueAtTime(0, t)
      env.gain.linearRampToValueAtTime(0.25, t + 0.05)
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
      osc.connect(env); env.connect(g)
      osc.start(t); osc.stop(t + 0.35)
    })
  })
}

// ── Lose / trick lost ────────────────────────────────────────────────────────
export function sfxLose() {
  play((c, g) => {
    const osc = c.createOscillator()
    const env = c.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(300, c.currentTime)
    osc.frequency.exponentialRampToValueAtTime(80, c.currentTime + 0.4)
    env.gain.setValueAtTime(0.2, c.currentTime)
    env.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.4)
    osc.connect(env); env.connect(g)
    osc.start(); osc.stop(c.currentTime + 0.4)
  })
}

// ── Button click ─────────────────────────────────────────────────────────────
export function sfxClick() {
  play((c, g) => {
    const osc = c.createOscillator()
    const env = c.createGain()
    osc.type = 'square'
    osc.frequency.value = 800
    env.gain.setValueAtTime(0.08, c.currentTime)
    env.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.06)
    osc.connect(env); env.connect(g)
    osc.start(); osc.stop(c.currentTime + 0.06)
  })
}

// ── Slap / hit ───────────────────────────────────────────────────────────────
export function sfxSlap() {
  play((c, g) => {
    const buf = c.createBuffer(1, c.sampleRate * 0.12, c.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 1.5) * 0.8
    }
    const src = c.createBufferSource()
    src.buffer = buf
    const f = c.createBiquadFilter()
    f.type = 'lowpass'; f.frequency.value = 1200
    src.connect(f); f.connect(g)
    src.start()
  })
}

// ── Deal / shuffle ───────────────────────────────────────────────────────────
export function sfxDeal() {
  play((c, g) => {
    const buf = c.createBuffer(1, c.sampleRate * 0.05, c.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2) * 0.3
    }
    const src = c.createBufferSource()
    src.buffer = buf
    const f = c.createBiquadFilter()
    f.type = 'highpass'; f.frequency.value = 2000
    src.connect(f); f.connect(g)
    src.start()
  })
}

// ── UNO / OONO call ──────────────────────────────────────────────────────────
export function sfxUno() {
  play((c, g) => {
    [440, 660, 880].forEach((f, i) => {
      const osc = c.createOscillator()
      const env = c.createGain()
      osc.type = 'triangle'
      osc.frequency.value = f
      const t = c.currentTime + i * 0.07
      env.gain.setValueAtTime(0.3, t)
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.2)
      osc.connect(env); env.connect(g)
      osc.start(t); osc.stop(t + 0.2)
    })
  })
}

// ── Dice roll ────────────────────────────────────────────────────────────────
export function sfxDice() {
  play((c, g) => {
    const buf = c.createBuffer(1, c.sampleRate * 0.3, c.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) {
      const env = Math.sin(Math.PI * i / d.length)
      d[i] = (Math.random() * 2 - 1) * env * 0.3
    }
    const src = c.createBufferSource()
    src.buffer = buf
    src.connect(g); src.start()
  })
}

// ── Game over ────────────────────────────────────────────────────────────────
export function sfxGameOver() {
  play((c, g) => {
    const freqs = [400, 350, 300, 200]
    freqs.forEach((f, i) => {
      const osc = c.createOscillator()
      const env = c.createGain()
      osc.type = 'sawtooth'
      osc.frequency.value = f
      const t = c.currentTime + i * 0.15
      env.gain.setValueAtTime(0.2, t)
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
      osc.connect(env); env.connect(g)
      osc.start(t); osc.stop(t + 0.3)
    })
  })
}

// ── Victory fanfare ──────────────────────────────────────────────────────────
export function sfxVictory() {
  play((c, g) => {
    const melody = [523, 659, 784, 659, 784, 1047]
    melody.forEach((f, i) => {
      const osc = c.createOscillator()
      const env = c.createGain()
      osc.type = 'square'
      osc.frequency.value = f
      const t = c.currentTime + i * 0.12
      env.gain.setValueAtTime(0, t)
      env.gain.linearRampToValueAtTime(0.15, t + 0.02)
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
      osc.connect(env); env.connect(g)
      osc.start(t); osc.stop(t + 0.25)
    })
  })
}

// ── Notification / bid ───────────────────────────────────────────────────────
export function sfxNotify() {
  play((c, g) => {
    const osc = c.createOscillator()
    const env = c.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, c.currentTime)
    osc.frequency.setValueAtTime(1100, c.currentTime + 0.1)
    env.gain.setValueAtTime(0.2, c.currentTime)
    env.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.25)
    osc.connect(env); env.connect(g)
    osc.start(); osc.stop(c.currentTime + 0.25)
  })
}
