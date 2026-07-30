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

// ============================================================
// APPLICATIONS — one Supabase row per application
// ============================================================
// Applications used to live in a single `applications` array under one key,
// which meant every submit was a read-modify-write of the whole list. Two
// people submitting at once, or one person submitting from a page that had
// been open a while, silently erased other people's records.
//
// Each application now gets its own row. There is no read-modify-write in
// this path at all, so concurrent submits cannot collide.

const APPLICATION_PREFIX = 'application:'

// The row key is derived from email + the moment the form was completed, not
// from a fresh random id, so retrying a submit that appeared to fail overwrites
// the same row instead of creating a duplicate.
function applicationKey(a) {
  const stamp = a.submittedAt || a.appliedAt
  const basis = a.email && stamp
    ? `${String(a.email).trim().toLowerCase()}|${stamp}`
    : String(a.id || '')
  return APPLICATION_PREFIX + basis.replace(/[^a-zA-Z0-9@._|:-]/g, '_')
}

export async function saveApplication(application) {
  try {
    const { error } = await supabase
      .from('kv_store')
      .upsert({ key: applicationKey(application), value: application, updated_at: new Date().toISOString() })
    if (error) {
      console.error('Supabase saveApplication error', error)
      return false
    }
    return true
  } catch (e) {
    console.error('Supabase saveApplication failed', e)
    return false
  }
}

// Returns every application: the per-row ones plus any still sitting in the
// legacy `applications` array, deduplicated and sorted oldest first.
export async function loadAllApplications() {
  // Throws rather than returning a short list: an admin looking at "0
  // applications" must be able to tell a real empty list from a failed read.
  let rows = []
  const { data, error } = await supabase
    .from('kv_store')
    .select('key,value')
    .like('key', `${APPLICATION_PREFIX}%`)
  if (error) throw new Error(`Could not load applications: ${error.message || error}`)
  if (Array.isArray(data)) rows = data.map(r => r.value).filter(Boolean)

  const legacy = await load('applications', [], true)
  const all = [...(Array.isArray(legacy) ? legacy : []), ...rows]

  const seen = new Set()
  const out = []
  for (const a of all) {
    if (!a || typeof a !== 'object') continue
    const stamp = a.submittedAt || a.appliedAt || ''
    const k = a.email && stamp
      ? `${String(a.email).trim().toLowerCase()}|${stamp}`
      : `id:${a.id || Math.random()}`
    if (seen.has(k)) continue
    seen.add(k)
    out.push(a)
  }
  out.sort((x, y) => String(x.submittedAt || x.appliedAt || '').localeCompare(String(y.submittedAt || y.appliedAt || '')))
  return out
}

// Returns true on success, false on failure. Callers that must not report
// success to a user unless the write landed should check the return value.
export async function save(key, val, shared) {
  if (!shared) {
    try {
      localStorage.setItem(key, JSON.stringify(val))
      return true
    } catch (e) {
      console.error('localStorage save failed for', key, e)
      return false
    }
  }
  try {
    const { error } = await supabase
      .from('kv_store')
      .upsert({ key, value: val, updated_at: new Date().toISOString() })
    if (error) {
      console.error('Supabase save error for', key, error)
      return false
    }
    return true
  } catch (e) {
    console.error('Supabase save failed for', key, e)
    return false
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
