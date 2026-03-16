import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase-server"

function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { gameId } = await req.json()
  if (!gameId) return NextResponse.json({ error: "gameId required" }, { status: 400 })

  let code = generateCode()
  let tries = 0
  while (tries < 5) {
    const { data: existing } = await supabase.from("rooms").select("id").eq("code", code).single()
    if (!existing) break
    code = generateCode(); tries++
  }

  const { data, error } = await supabase.from("rooms").insert({
    code, game_id: gameId, host_id: user.id, status: "waiting"
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ room: data })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { code } = await req.json()
  if (!code) return NextResponse.json({ error: "Room code required" }, { status: 400 })

  const { data: room, error: findErr } = await supabase
    .from("rooms").select("*").eq("code", code.toUpperCase()).single()
  if (findErr || !room) return NextResponse.json({ error: "Room not found" }, { status: 404 })
  if (room.status !== "waiting") return NextResponse.json({ error: "Room is not waiting" }, { status: 400 })
  if (room.host_id === user.id) return NextResponse.json({ error: "Cannot join your own room" }, { status: 400 })

  const { data, error } = await supabase.from("rooms")
    .update({ guest_id: user.id, status: "playing" })
    .eq("id", room.id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ room: data })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get("code")
  if (!code) return NextResponse.json({ error: "code required" }, { status: 400 })

  const supabase = await createServerClient()
  const { data, error } = await supabase.from("rooms")
    .select("*, host:profiles!host_id(username), guest:profiles!guest_id(username)")
    .eq("code", code.toUpperCase()).single()

  if (error) return NextResponse.json({ error: "Room not found" }, { status: 404 })
  return NextResponse.json({ room: data })
}