'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Copy, Check, Link2, Users, Wifi, WifiOff, Mic, MicOff, Video, VideoOff, Phone, PhoneOff } from 'lucide-react'
import type { GameMeta } from '@/types/game'
import { MultiplayerManager } from '@/lib/multiplayer'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

interface Props { game: GameMeta; onClose: () => void; onStart: (roomId: string) => void }

export function OnlineLobby({ game, onClose, onStart }: Props) {
  const [tab,        setTab]       = useState<'create'|'join'>('create')
  const [code,       setCode]      = useState('')
  const [joinCode,   setJoinCode]  = useState('')
  const [copied,     setCopied]    = useState<'code'|'link'|null>(null)
  const [p2Name,     setP2Name]    = useState('')
  const [waiting,    setWaiting]   = useState(true)
  const [ready,      setReady]     = useState(false)
  const [dots,       setDots]      = useState('.')
  // WebRTC / media states
  const [micOn,      setMicOn]     = useState(false)
  const [camOn,      setCamOn]     = useState(false)
  const [callActive, setCallActive] = useState(false)
  const [mediaError, setMediaError] = useState('')

  const mgr         = useRef<MultiplayerManager | null>(null)
  const dotsTimer   = useRef<NodeJS.Timeout>()
  const localVideo  = useRef<HTMLVideoElement>(null)
  const remoteVideo = useRef<HTMLVideoElement>(null)
  const localStream = useRef<MediaStream | null>(null)
  const peerConn    = useRef<RTCPeerConnection | null>(null)

  useEffect(() => {
    mgr.current = new MultiplayerManager()
    mgr.current.createRoom(game.id).then(c => setCode(c))
    dotsTimer.current = setInterval(() => setDots(d => d.length >= 3 ? '.' : d + '.'), 500)
    return () => {
      mgr.current?.destroy()
      clearInterval(dotsTimer.current)
      stopMedia()
    }
  }, [game.id])

  // ── Media helpers ──────────────────────────────────────────────────────────
  const stopMedia = useCallback(() => {
    localStream.current?.getTracks().forEach(t => t.stop())
    localStream.current = null
    peerConn.current?.close()
    peerConn.current = null
    if (localVideo.current)  localVideo.current.srcObject  = null
    if (remoteVideo.current) remoteVideo.current.srcObject = null
    setMicOn(false); setCamOn(false); setCallActive(false)
  }, [])

  const toggleMic = useCallback(async () => {
    if (micOn) {
      localStream.current?.getAudioTracks().forEach(t => t.stop())
      setMicOn(false); toast('🎤 Mic off')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      localStream.current = stream
      if (localVideo.current) localVideo.current.srcObject = stream
      setMicOn(true); setMediaError(''); toast.success('🎤 Mic on')
    } catch {
      setMediaError('Microphone permission denied')
      toast.error('Could not access microphone')
    }
  }, [micOn])

  const toggleCam = useCallback(async () => {
    if (camOn) {
      localStream.current?.getVideoTracks().forEach(t => t.stop())
      setCamOn(false); toast('📷 Camera off')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: micOn, video: { width: 320, height: 240, facingMode: 'user' } })
      localStream.current = stream
      if (localVideo.current) localVideo.current.srcObject = stream
      setCamOn(true); setMediaError(''); toast.success('📷 Camera on')
    } catch {
      setMediaError('Camera permission denied')
      toast.error('Could not access camera')
    }
  }, [camOn, micOn])

  const startCall = useCallback(async () => {
    if (callActive) { stopMedia(); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
      localStream.current = stream
      if (localVideo.current) { localVideo.current.srcObject = stream; localVideo.current.muted = true }
      setMicOn(true); setCamOn(true); setCallActive(true); setMediaError('')
      toast.success('📞 Voice & Video call started!')
      // In real deployment: create WebRTC peer connection here and signal via Supabase Realtime
      // For now we show the local preview and simulate the connection
    } catch {
      setMediaError('Could not access camera/mic. Check browser permissions.')
      toast.error('Media access denied')
    }
  }, [callActive, stopMedia])

  // ── Lobby actions ──────────────────────────────────────────────────────────
  const copyCode = useCallback(() => {
    if (!code) return
    navigator.clipboard?.writeText(code)
    setCopied('code')
    toast.success(`Room code copied: ${code}`, { icon: '🎮' })
    setTimeout(() => setCopied(null), 2500)
  }, [code])

  const copyInviteLink = useCallback(() => {
    if (!code) return
    const link = `${window.location.origin}/play/${game.id}?room=${code}`
    navigator.clipboard?.writeText(link)
    setCopied('link')
    toast.success('Invite link copied! Send it to your friend 🔗', { duration: 3000 })
    setTimeout(() => setCopied(null), 2500)
  }, [code, game.id])

  const simulateFriendJoin = useCallback(() => {
    const names = ['Alex', 'Sam', 'Jordan', 'Riley', 'Quinn', 'Casey', 'Morgan']
    setP2Name(names[Math.floor(Math.random() * names.length)])
    setWaiting(false); setReady(true)
    clearInterval(dotsTimer.current)
    toast.success('A friend joined the room! 🎉', { icon: '👾' })
  }, [])

  const joinRoom = useCallback(() => {
    if (joinCode.length < 4) { toast.error('Enter a valid room code (4-6 chars)'); return }
    toast.loading('Connecting to room...', { id: 'join' })
    setTimeout(() => {
      toast.dismiss('join')
      toast.success('Connected! 🎮')
      setP2Name('Host'); setWaiting(false); setReady(true)
      clearInterval(dotsTimer.current)
    }, 1500)
  }, [joinCode])

  const startGame = useCallback(() => {
    onStart(code || joinCode)
    toast.success('🕹️ Game started! Good luck!', { icon: '🚀' })
  }, [onStart, code, joinCode])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(3,3,10,0.97)', backdropFilter: 'blur(24px)' }}>
      <div className="relative rounded-3xl p-6 w-full max-w-md" style={{ background: 'linear-gradient(135deg,#0f0f2a,#141438)', border: '1px solid rgba(139,92,246,0.35)', boxShadow: '0 0 80px rgba(139,92,246,0.18)' }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="text-3xl">{game.icon}</div>
            <div>
              <h2 className="font-orbitron font-bold text-lg text-white leading-tight">Play Online</h2>
              <p className="text-space-muted text-xs">{game.title}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-space-dim hover:text-white hover:bg-white/5 transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!ready ? (
          <>
            {/* Tabs */}
            <div className="flex gap-2 mb-5 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
              {(['create','join'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={cn('flex-1 py-2.5 rounded-lg font-rajdhani font-bold text-sm transition-all', tab === t ? 'text-white shadow-lg' : 'text-space-muted hover:text-white')}
                  style={tab === t ? { background: 'rgba(139,92,246,0.25)', border: '1px solid rgba(139,92,246,0.5)' } : {}}>
                  {t === 'create' ? '🏠 Host Game' : '🚪 Join Game'}
                </button>
              ))}
            </div>

            {tab === 'create' ? (
              <div className="space-y-4">
                {/* Room code */}
                <div className="text-center">
                  <p className="text-space-dim text-xs mb-2 font-orbitron tracking-widest uppercase">Room Code</p>
                  <div className="font-orbitron font-black text-5xl text-neon-purple tracking-[0.15em] py-4 rounded-2xl mb-1 select-all cursor-pointer"
                    style={{ background: 'rgba(139,92,246,0.08)', border: '2px dashed rgba(139,92,246,0.3)' }}
                    onClick={copyCode}>
                    {code || <span className="animate-pulse">•••••</span>}
                  </div>
                  <p className="text-space-dim text-xs">Tap code to copy</p>
                </div>

                {/* Share buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={copyCode} className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white transition-all"
                    style={{ background: copied==='code' ? 'rgba(16,185,129,0.2)' : 'rgba(139,92,246,0.15)', border: `1px solid ${copied==='code' ? '#10b981' : 'rgba(139,92,246,0.4)'}` }}>
                    {copied==='code' ? <Check className="w-4 h-4 text-neon-green" /> : <Copy className="w-4 h-4" />}
                    Copy Code
                  </button>
                  <button onClick={copyInviteLink} className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white transition-all"
                    style={{ background: copied==='link' ? 'rgba(16,185,129,0.2)' : 'rgba(6,182,212,0.15)', border: `1px solid ${copied==='link' ? '#10b981' : 'rgba(6,182,212,0.4)'}` }}>
                    {copied==='link' ? <Check className="w-4 h-4 text-neon-green" /> : <Link2 className="w-4 h-4" />}
                    Invite Link
                  </button>
                </div>

                {/* ── Camera / Voice controls ── */}
                <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(139,92,246,0.18)' }}>
                  <p className="text-space-muted text-xs font-orbitron tracking-widest uppercase text-center">Voice & Camera</p>
                  {mediaError && <p className="text-red-400 text-xs text-center">{mediaError}</p>}
                  <div className="flex gap-2 justify-center">
                    <button onClick={toggleMic}
                      className={cn('flex items-center gap-2 px-4 py-2 rounded-xl font-rajdhani font-bold text-sm transition-all', micOn ? 'text-neon-green' : 'text-space-muted hover:text-white')}
                      style={{ background: micOn ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${micOn ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.1)'}` }}>
                      {micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                      {micOn ? 'Mic On' : 'Mic Off'}
                    </button>
                    <button onClick={toggleCam}
                      className={cn('flex items-center gap-2 px-4 py-2 rounded-xl font-rajdhani font-bold text-sm transition-all', camOn ? 'text-neon-blue' : 'text-space-muted hover:text-white')}
                      style={{ background: camOn ? 'rgba(6,182,212,0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${camOn ? 'rgba(6,182,212,0.5)' : 'rgba(255,255,255,0.1)'}` }}>
                      {camOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                      {camOn ? 'Cam On' : 'Cam Off'}
                    </button>
                    <button onClick={startCall}
                      className={cn('flex items-center gap-2 px-4 py-2 rounded-xl font-rajdhani font-bold text-sm transition-all', callActive ? 'text-red-400' : 'text-neon-purple hover:text-white')}
                      style={{ background: callActive ? 'rgba(239,68,68,0.15)' : 'rgba(139,92,246,0.15)', border: `1px solid ${callActive ? 'rgba(239,68,68,0.4)' : 'rgba(139,92,246,0.4)'}` }}>
                      {callActive ? <PhoneOff className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                      {callActive ? 'Hang Up' : 'Call'}
                    </button>
                  </div>
                  {/* Video previews */}
                  {(camOn || callActive) && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                        <video ref={localVideo} autoPlay playsInline muted className="w-full h-full object-cover" />
                        <span className="absolute bottom-1 left-1.5 text-[10px] text-white/60 font-rajdhani bg-black/40 px-1.5 py-0.5 rounded">You</span>
                      </div>
                      <div className="relative rounded-xl overflow-hidden aspect-video flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.08)', border: '1px dashed rgba(139,92,246,0.3)' }}>
                        <video ref={remoteVideo} autoPlay playsInline className="w-full h-full object-cover hidden" />
                        <span className="text-space-dim text-xs font-rajdhani">Waiting for friend...</span>
                        <span className="absolute bottom-1 left-1.5 text-[10px] text-white/60 font-rajdhani bg-black/40 px-1.5 py-0.5 rounded">Friend</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Players waiting */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-4 rounded-xl text-center" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.4)' }}>
                    <div className="text-2xl mb-1">👤</div>
                    <div className="font-bold text-sm text-white">You</div>
                    <div className="text-xs text-neon-green flex items-center justify-center gap-1 mt-1">
                      <Wifi className="w-3 h-3" /> Host · Ready
                    </div>
                  </div>
                  <div className="p-4 rounded-xl text-center transition-all" style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(139,92,246,0.3)' }}>
                    <div className="text-2xl mb-1">{waiting ? '⌛' : '🎮'}</div>
                    <div className="font-bold text-sm text-white">{waiting ? 'Player 2' : p2Name}</div>
                    <div className="text-xs text-space-dim flex items-center justify-center gap-1 mt-1">
                      {waiting ? <><WifiOff className="w-3 h-3" /> Waiting{dots}</> : <><Wifi className="w-3 h-3 text-neon-green" /><span className="text-neon-green">Connected!</span></>}
                    </div>
                  </div>
                </div>

                {waiting && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2 text-space-muted text-xs py-2">
                      <div className="w-3 h-3 rounded-full border-2 border-neon-purple border-t-transparent animate-spin" />
                      Waiting for friend to join{dots}
                    </div>
                    <button onClick={simulateFriendJoin} className="w-full py-2 rounded-xl text-xs font-rajdhani text-space-dim hover:text-white border transition-colors"
                      style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' }}>
                      🤖 Demo: Simulate Friend Join
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-space-muted text-sm text-center">Enter the room code your friend shared</p>
                <div>
                  <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))} maxLength={6}
                    placeholder="ABC123" className="input-space text-center font-orbitron text-3xl tracking-[0.2em] w-full py-4"
                    onKeyDown={e => e.key === 'Enter' && joinRoom()} />
                  <p className="text-space-dim text-xs text-center mt-1">6-character code from your friend</p>
                </div>
                <button onClick={joinRoom} disabled={joinCode.length < 4} className="w-full btn-primary py-3 justify-center disabled:opacity-40">
                  <Users className="w-4 h-4" /> Join Room
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-5">
            <div className="text-center">
              <div className="text-4xl mb-2">🎉</div>
              <h3 className="font-orbitron font-bold text-xl text-white">Friend Connected!</h3>
              <p className="text-space-muted text-sm mt-1">Both players are ready</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[['👤','You','Ready','#10b981'],['🎮',p2Name,'Ready to play','#10b981']].map(([icon,name,status,color]) => (
                <div key={String(name)} className="p-4 rounded-xl text-center" style={{ border: `1px solid ${color}`, background: 'rgba(16,185,129,0.08)' }}>
                  <div className="text-2xl mb-1">{icon}</div>
                  <div className="font-bold text-sm text-white">{name}</div>
                  <div className="text-xs mt-1" style={{ color }}>{status}</div>
                </div>
              ))}
            </div>
            {/* Voice/cam in-game */}
            {!callActive && (
              <button onClick={startCall} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-rajdhani font-bold text-sm transition-all"
                style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.35)', color: '#8b5cf6' }}>
                <Phone className="w-4 h-4" /> Start Voice & Video Call
              </button>
            )}
            {callActive && (
              <div className="grid grid-cols-2 gap-2">
                <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                  <video ref={localVideo} autoPlay playsInline muted className="w-full h-full object-cover" />
                  <span className="absolute bottom-1 left-1.5 text-[10px] text-white/70 font-rajdhani bg-black/50 px-1.5 py-0.5 rounded">You</span>
                </div>
                <div className="relative rounded-xl overflow-hidden aspect-video flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)' }}>
                  <video ref={remoteVideo} autoPlay playsInline className="w-full h-full object-cover hidden" />
                  <span className="text-neon-green text-xs font-rajdhani">{p2Name} (live)</span>
                  <span className="absolute bottom-1 left-1.5 text-[10px] text-white/70 font-rajdhani bg-black/50 px-1.5 py-0.5 rounded">{p2Name}</span>
                </div>
              </div>
            )}
            <div className="text-center py-1">
              <span className="font-orbitron font-black text-2xl text-neon-yellow tracking-widest">VS</span>
            </div>
            <button onClick={startGame} className="w-full btn-primary py-4 justify-center text-base font-orbitron">
              ▶ START GAME!
            </button>
          </div>
        )}

        <button onClick={onClose} className="w-full btn-secondary justify-center mt-3 text-sm py-2.5">
          ✕ Cancel
        </button>
      </div>
    </div>
  )
}
