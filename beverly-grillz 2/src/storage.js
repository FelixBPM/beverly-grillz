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

// Deletes one application. Removes the per-row entry and, if the record still
// lives in the legacy `applications` array, removes it from there too.
// Returns true only if everything that needed removing was removed.
export async function deleteApplication(application) {
  let ok = true

  try {
    const { error } = await supabase
      .from('kv_store')
      .delete()
      .eq('key', applicationKey(application))
    if (error) { console.error('Supabase deleteApplication error', error); ok = false }
  } catch (e) {
    console.error('Supabase deleteApplication failed', e)
    ok = false
  }

  // Legacy array cleanup. Read-modify-write, but this only runs from the
  // single-admin panel and only touches the retired key.
  try {
    const { data, error } = await supabase
      .from('kv_store')
      .select('value')
      .eq('key', 'applications')
      .maybeSingle()
    if (error) throw error
    const legacy = data && Array.isArray(data.value) ? data.value : null
    if (legacy) {
      const same = (x) => {
        if (application.id && x.id) return x.id === application.id
        const stamp = (v) => v.submittedAt || v.appliedAt || ''
        return String(x.email || '').trim().toLowerCase() === String(application.email || '').trim().toLowerCase()
          && stamp(x) === stamp(application)
      }
      const next = legacy.filter(x => !same(x))
      if (next.length !== legacy.length) {
        const wrote = await save('applications', next, true)
        if (!wrote) ok = false
      }
    }
  } catch (e) {
    console.error('Legacy applications cleanup failed', e)
    ok = false
  }

  return ok
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

// ============================================================
// CAMP GALLERY — image uploads and up/down votes
// ============================================================
// Images go in a public Supabase Storage bucket, not in kv_store. A 4MB JPEG
// base64-encoded into a jsonb column is ~5.5MB of text that every visitor
// downloads on page load, which defeats "keep the original at full quality".
//
// Two objects are stored per upload:
//   originals/<id>.<ext>  the untouched file, byte for byte as uploaded
//   display/<id>.webp     a downscaled copy the grid actually loads
//
// Metadata and votes live in kv_store under separate prefixes. `gallery:` and
// `gvote:` deliberately do not share a prefix, so a LIKE query for one cannot
// pick up the other.

const GALLERY_BUCKET = 'gallery'
const GALLERY_PREFIX = 'gallery:'
const GALLERY_VOTE_PREFIX = 'gvote:'

export const GALLERY_MAX_BYTES = 25 * 1024 * 1024
// The `.heic,.heif` extensions are listed alongside the MIME types on purpose:
// several browsers report an empty type for a HEIC sitting on disk, and would
// grey it out in the file picker if the list were MIME types alone.
export const GALLERY_ACCEPT =
  'image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif'

// Longest edge of the copy shown in the grid. Big enough to stay crisp on a
// retina screen at the rendered size, small enough that a dozen of them don't
// cost a phone user their data plan.
const GALLERY_DISPLAY_MAX_EDGE = 1400

export function galleryPublicUrl(path) {
  if (!path) return ''
  const { data } = supabase.storage.from(GALLERY_BUCKET).getPublicUrl(path)
  return (data && data.publicUrl) || ''
}

// The MIME type is authoritative; the filename is only a tiebreaker for the
// jpg/jpeg spelling. Deriving from the name alone gets "flyer" (no dot) wrong --
// split('.').pop() returns the whole name, which then looks like a valid
// extension and produces originals/<uuid>.flyer, a file nobody's OS can open.
const MIME_EXTENSION = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

function fileExtension(file) {
  const fromType = MIME_EXTENSION[String(file.type || '').toLowerCase()]
  if (fromType) {
    const parts = String(file.name || '').split('.')
    const named = parts.length > 1 ? parts.pop().toLowerCase() : ''
    // Keep the author's spelling when it means the same format.
    if (fromType === 'jpg' && named === 'jpeg') return 'jpeg'
    return fromType
  }
  const parts = String(file.name || '').split('.')
  const named = parts.length > 1 ? parts.pop().toLowerCase() : ''
  if (named && named.length <= 5 && /^[a-z0-9]+$/.test(named)) return named
  return 'img'
}

// PostgREST silently truncates at db-max-rows (1000 by default) and reports no
// error, so an over-large gallery would just start losing votes and rendering
// wrong scores. Asking for one more than the ceiling lets the caller notice.
const GALLERY_ROW_LIMIT = 900

// ------------------------------------------------------------
// HEIC
// ------------------------------------------------------------
// iPhones shoot HEIC by default. Safari can render it; Chrome, Firefox and
// every Android browser cannot, and the storage bucket rejects the MIME type
// outright. So a HEIC is transcoded to JPEG in the browser before it is
// uploaded, and what lands in the bucket is an ordinary photo everyone can see.
//
// Quality 0.94 at full resolution: visually indistinguishable from the source,
// and the point of keeping originals here is the picture, not the container.

const HEIC_JPEG_QUALITY = 0.94

const HEIC_MIME = new Set([
  'image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence',
])

// A cheap pre-check, run before the 3MB decoder is fetched. The MIME type is
// trusted when the OS supplies one, but Chrome on Windows and most Android
// file pickers hand over an empty type (or application/octet-stream) for a
// .heic, so the extension is the only signal available at that point.
function looksHeic(file) {
  const type = String(file.type || '').toLowerCase()
  if (HEIC_MIME.has(type)) return true
  if (!type || type === 'application/octet-stream') {
    return /\.(heic|heif)$/i.test(String(file.name || ''))
  }
  return false
}

// Returns a JPEG File for a HEIC, or the untouched file for anything else.
// The decoder is imported dynamically so the wasm only travels to the people
// who actually post an iPhone photo -- it is far larger than the whole app.
async function normalizeHeic(file) {
  if (!looksHeic(file)) return file

  let heic
  try {
    heic = await import('heic-to')
  } catch (e) {
    console.error('HEIC decoder failed to load', e)
    throw new Error('Could not load the HEIC converter. Check your connection and try again.')
  }

  // Magic bytes decide, not the filename. A JPEG that someone renamed .heic
  // would otherwise be handed to libheif, which fails with an opaque error --
  // and it is a file we could have accepted untouched.
  try {
    if (!(await heic.isHeic(file))) return file
  } catch (e) {
    // Undecidable: fall through and let the conversion attempt be the answer.
  }

  let blob
  try {
    blob = await heic.heicTo({ blob: file, type: 'image/jpeg', quality: HEIC_JPEG_QUALITY })
  } catch (e) {
    console.error('HEIC conversion failed', e)
    blob = null
  }
  if (!blob) {
    throw new Error(
      'That HEIC photo could not be converted. On an iPhone, Settings → Camera → Formats → Most Compatible makes new photos upload as JPG.'
    )
  }

  const base = String(file.name || 'photo').replace(/\.(heic|heif)$/i, '')
  return new File([blob], `${base}.jpg`, {
    type: 'image/jpeg',
    lastModified: file.lastModified || Date.now(),
  })
}

// Draws the image onto a canvas at reduced size. Returns null on any failure --
// callers fall back to serving the original, which is slower but never wrong.
async function makeDisplayCopy(file) {
  try {
    if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return null

    const bitmap = await createImageBitmap(file)
    const { width, height } = bitmap

    // A canvas holds one frame, so re-encoding an animated GIF would silently
    // turn it into a still -- and only for GIFs above the size threshold, so
    // whether your animation survived would depend on its pixel dimensions.
    // Serve GIFs as-is instead: consistently animated, at the cost of the
    // original's file size.
    if (String(file.type || '').toLowerCase() === 'image/gif') {
      bitmap.close && bitmap.close()
      return { blob: null, width, height }
    }

    const scale = Math.min(1, GALLERY_DISPLAY_MAX_EDGE / Math.max(width, height))

    // Already small enough: no point re-encoding and losing quality for nothing.
    if (scale === 1) { bitmap.close && bitmap.close(); return { blob: null, width, height } }

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) { bitmap.close && bitmap.close(); return { blob: null, width, height } }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close && bitmap.close()

    // WebP rather than JPEG: these are logos, and JPEG would both lose the
    // alpha channel and ring badly around hard-edged lettering.
    const blob = await new Promise(res => canvas.toBlob(res, 'image/webp', 0.88))
    return { blob, width, height }
  } catch (e) {
    console.warn('Could not build a display copy; will serve the original', e)
    return null
  }
}

// Uploads one image and records it. Returns the saved record, or throws with a
// message meant to be shown to the person who tried to upload.
export async function uploadGalleryImage(file, { uploaderName, voterId, onStage }) {
  if (!file) throw new Error('No file selected.')

  // Size is judged on what the person actually picked, before any conversion.
  // A 60MB file should be refused instantly rather than after libheif has
  // spent ten seconds decoding it into something we then reject anyway.
  if (file.size > GALLERY_MAX_BYTES) {
    throw new Error(`That image is ${(file.size / 1048576).toFixed(1)}MB. The limit is ${GALLERY_MAX_BYTES / 1048576}MB.`)
  }

  // HEIC becomes JPEG here, so everything downstream -- the type check, the
  // display copy, the bucket's allowed_mime_types -- sees a format it knows.
  if (looksHeic(file) && onStage) onStage('converting')
  const source = await normalizeHeic(file)
  if (onStage) onStage('uploading')

  // Check against the same list the bucket enforces, not just "image/*".
  // An AVIF screenshot is image/* but the bucket rejects it, and the server's
  // error message is unreadable.
  if (!MIME_EXTENSION[String(source.type || '').toLowerCase()]) {
    throw new Error(
      String(source.type || '').startsWith('image/')
        ? `${source.type.split('/')[1].toUpperCase()} images aren't supported. Use JPG, PNG, WebP or GIF.`
        : 'That file is not an image.'
    )
  }

  const id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2))
  const originalPath = `originals/${id}.${fileExtension(source)}`

  // The original goes up exactly as it came off the camera or the designer's
  // export. No re-encoding, no stripping. (A HEIC is the one exception: it was
  // transcoded above, because the alternative is a file most people can't open.)
  const up = await supabase.storage.from(GALLERY_BUCKET).upload(originalPath, source, {
    contentType: source.type || 'application/octet-stream',
    upsert: false,
  })
  if (up.error) {
    console.error('Gallery original upload failed', up.error)
    throw new Error(describeStorageError(up.error))
  }

  let displayPath = ''
  let width = 0
  let height = 0
  const copy = await makeDisplayCopy(source)
  if (copy) {
    width = copy.width || 0
    height = copy.height || 0
    if (copy.blob) {
      const path = `display/${id}.webp`
      const disp = await supabase.storage.from(GALLERY_BUCKET).upload(path, copy.blob, {
        contentType: 'image/webp',
        upsert: false,
      })
      // A failed display copy is not fatal -- the grid falls back to the original.
      if (disp.error) console.warn('Gallery display copy failed; serving the original', disp.error)
      else displayPath = path
    }
  }

  const record = {
    id,
    originalPath,
    displayPath,
    name: String(uploaderName || '').trim().slice(0, 60),
    uploadedBy: voterId || '',
    uploadedAt: new Date().toISOString(),
    bytes: source.size,
    type: source.type || '',
    width,
    height,
  }

  const wrote = await save(GALLERY_PREFIX + id, record, true)
  if (!wrote) {
    // Don't leave an orphaned object in the bucket that nothing references.
    await supabase.storage.from(GALLERY_BUCKET).remove([originalPath, displayPath].filter(Boolean))
    throw new Error('The image uploaded but could not be recorded. Please try again.')
  }

  return record
}

function describeStorageError(error) {
  const msg = String((error && error.message) || error || '')
  if (/bucket not found/i.test(msg)) {
    return 'The gallery storage bucket does not exist yet. An admin needs to run the gallery setup SQL in Supabase.'
  }
  if (/policy|permission|unauthorized|row-level/i.test(msg)) {
    return 'Uploads are not permitted yet. An admin needs to run the gallery setup SQL in Supabase.'
  }
  if (/exceeded the maximum|too large|payload/i.test(msg)) {
    return 'That image is larger than the gallery allows.'
  }
  return `Upload failed: ${msg || 'unknown error'}`
}

export async function loadGalleryImages() {
  const { data, error } = await supabase
    .from('kv_store')
    .select('key,value')
    .like('key', `${GALLERY_PREFIX}%`)
    .limit(GALLERY_ROW_LIMIT)
  if (error) throw new Error(`Could not load the gallery: ${error.message || error}`)
  const rows = (Array.isArray(data) ? data : []).map(r => r.value).filter(Boolean)
  if (rows.length >= GALLERY_ROW_LIMIT) {
    console.warn(`Gallery hit the ${GALLERY_ROW_LIMIT}-image read limit; older images are not being shown.`)
  }
  return rows
}

// The kv_store record is what makes an image exist as far as the site is
// concerned, so that delete decides success. The bucket objects are cleaned up
// afterwards and a failure there is only logged: an unreferenced file is
// invisible clutter, whereas treating it as failure would make the caller put
// a card back on screen for an image whose record is already gone -- a card
// that disappears again on the next reload with no explanation.
export async function deleteGalleryImage(image) {
  if (!image || !image.id) return false

  try {
    const { error } = await supabase.from('kv_store').delete().eq('key', GALLERY_PREFIX + image.id)
    if (error) { console.error('Gallery record delete failed', error); return false }
  } catch (e) {
    console.error('Gallery record delete failed', e)
    return false
  }

  // Votes are keyed by image, so they can be cleared with one prefix delete.
  // Left behind they would be invisible junk that quietly reattaches if an id
  // were ever reused.
  //
  // The id goes into a LIKE pattern, where % and _ are wildcards. Ids we mint
  // are uuids, but a record's id is just a field on a row and anyone holding
  // the anon key can write a row -- an id of "%" would turn this into
  // "delete gvote:%|%", i.e. every vote on every image. Only run the prefix
  // delete for ids that cannot contain a wildcard.
  if (/^[A-Za-z0-9-]+$/.test(image.id)) {
    try {
      await supabase.from('kv_store').delete().like('key', `${GALLERY_VOTE_PREFIX}${image.id}|%`)
    } catch (e) {
      console.warn('Gallery vote cleanup failed', e)
    }
  } else {
    console.warn('Skipping vote cleanup: image id contains characters that are LIKE wildcards', image.id)
  }

  const paths = [image.originalPath, image.displayPath].filter(Boolean)
  if (paths.length) {
    try {
      const { error } = await supabase.storage.from(GALLERY_BUCKET).remove(paths)
      if (error) console.warn('Gallery files left behind in the bucket', error)
    } catch (e) {
      console.warn('Gallery files left behind in the bucket', e)
    }
  }

  return true
}

// ---- Votes ----
// One row per (image, voter) rather than a counter on the image. A shared
// counter would be a read-modify-write on every click, and two people voting
// at the same moment would lose one of the votes -- the same bug that used to
// eat applications.

export async function loadGalleryVotes() {
  const { data, error } = await supabase
    .from('kv_store')
    .select('key,value')
    .like('key', `${GALLERY_VOTE_PREFIX}%`)
    .limit(GALLERY_ROW_LIMIT)
  if (error) throw new Error(`Could not load votes: ${error.message || error}`)
  const rows = (Array.isArray(data) ? data : []).map(r => r.value).filter(Boolean)
  if (rows.length >= GALLERY_ROW_LIMIT) {
    console.warn(`Gallery hit the ${GALLERY_ROW_LIMIT}-vote read limit; displayed scores are incomplete.`)
  }
  return rows
}

// vote: 1, -1, or 0 to clear. Voting the same way twice clears it.
export async function setGalleryVote(imageId, voterId, vote) {
  const key = `${GALLERY_VOTE_PREFIX}${imageId}|${voterId}`
  if (!vote) {
    try {
      const { error } = await supabase.from('kv_store').delete().eq('key', key)
      if (error) { console.error('Vote clear failed', error); return false }
      return true
    } catch (e) {
      console.error('Vote clear failed', e)
      return false
    }
  }
  return save(key, { imageId, voterId, vote, at: new Date().toISOString() }, true)
}
