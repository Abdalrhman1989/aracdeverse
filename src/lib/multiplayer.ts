import { getSupabaseBrowserClient } from './supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { generateRoomCode } from './utils'

type MessageHandler = (data: unknown) => void

export class MultiplayerManager {
  private channel: RealtimeChannel | null = null
  private roomCode = ''
  private handlers = new Map<string, MessageHandler[]>()

  async createRoom(_gameId: string): Promise<string> {
    const code = generateRoomCode()
    this.roomCode = code
    this.channel = getSupabaseBrowserClient().channel(`room:${code}`, {
      config: { broadcast: { self: false } },
    })
    this._setup()
    return code
  }

  async joinRoom(code: string): Promise<boolean> {
    this.roomCode = code.toUpperCase()
    this.channel = getSupabaseBrowserClient().channel(`room:${this.roomCode}`, {
      config: { broadcast: { self: false } },
    })
    this._setup()
    return true
  }

  private _setup() {
    if (!this.channel) return
    this.channel.on('broadcast', { event: '*' }, ({ event, payload }) => {
      ;(this.handlers.get(event) ?? []).forEach(h => h(payload))
    })
    this.channel.subscribe()
  }

  broadcast(type: string, data: unknown) {
    this.channel?.send({ type: 'broadcast', event: type, payload: data })
  }

  onMessage(type: string, handler: MessageHandler) {
    if (!this.handlers.has(type)) this.handlers.set(type, [])
    this.handlers.get(type)!.push(handler)
  }

  get code() { return this.roomCode }

  destroy() {
    this.channel?.unsubscribe()
    this.channel = null
    this.handlers.clear()
  }
}
