import { supabase } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { location_name, sprite_name, loot_source } = await request.json()

  const { error } = await supabase
    .from('sprite_locations')
    .insert([{ location_name, sprite_name, loot_source }])

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
