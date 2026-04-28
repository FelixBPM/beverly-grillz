import { createClient } from '@supabase/supabase-js'

// ============================================================
// SUPABASE CLIENT
// ============================================================
// These come from .env.local in development and from Cloudflare Pages
// environment variables in production. They MUST start with VITE_ to be
// exposed to client code.

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Missing Supabase credentials. Set VITE_SUPABASE_URL and ' +
    'VITE_SUPABASE_ANON_KEY in .env.local (and in Cloudflare Pages env vars).'
  )
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '')

// ============================================================
// STORAGE API — same signature as the original window.storage helpers
// ============================================================
// shared=true  → Supabase kv_store table (visible to everyone)
// shared=false → localStorage (per-device, like a browser cookie)

export async function load(key, defaultVal, shared) {
  if (!shared) {
    try {
      const v = localStorage.getItem(key)
      return v != null ? JSON.parse(v) : defaultVal
    } catch (e) {
      return defaultVal
    }
  }
  try {
    const { data, error } = await supabase
      .from('kv_store')
      .select('value')
      .eq('key', key)
      .maybeSingle()
    if (error || !data) return defaultVal
    return data.value
  } catch (e) {
    console.error('Supabase load failed for', key, e)
    return defaultVal
  }
}

export async function save(key, val, shared) {
  if (!shared) {
    try {
      localStorage.setItem(key, JSON.stringify(val))
    } catch (e) {
      console.error('localStorage save failed for', key, e)
    }
    return
  }
  try {
    const { error } = await supabase
      .from('kv_store')
      .upsert({ key, value: val, updated_at: new Date().toISOString() })
    if (error) console.error('Supabase save error for', key, error)
  } catch (e) {
    console.error('Supabase save failed for', key, e)
  }
}

export async function del(key, shared) {
  if (!shared) {
    try { localStorage.removeItem(key) } catch (e) {}
    return
  }
  try {
    await supabase.from('kv_store').delete().eq('key', key)
  } catch (e) {
    console.error('Supabase delete failed for', key, e)
  }
}
