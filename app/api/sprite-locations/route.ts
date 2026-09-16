import { supabase } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { location_name, sprite_name, variant, loot_source } = await request.json()

  const { error } = await supabase
    .from('sprite_locations')
    .insert([{ location_name, sprite_name, variant, loot_source }])

  // The variant column is newer than the table. Until it is added:
  //
  //   alter table public.sprite_locations add column variant text;
  //
  // PostgREST rejects the whole insert with PGRST204 ("column not found"),
  // which would lose a finding the user has already filled in. Saving what the
  // table can hold beats dropping it. Delete this fallback once the column
  // exists — its only job is to keep the form working in between.
  if (error?.code === 'PGRST204') {
    const retry = await supabase
      .from('sprite_locations')
      .insert([{ location_name, sprite_name, loot_source }])
    if (retry.error) {
      return NextResponse.json({ error: retry.error.message }, { status: 400 })
    }
    return NextResponse.json({ success: true, variantDropped: true })
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
