// ============================================================
// ON PLAYA — searchable Camps / Art / Events directory
// ============================================================
// Renders the Black Rock City directory that bm-sync.mjs has already fetched,
// embargoed, and written into Supabase kv_store. This component never talks
// to api.burningman.org directly — it only reads kv_store through the same
// `load()` helper the rest of the site uses.
//
// WHICH YEAR IS SHOWN
// -------------------
// The `bm:current` row points at whichever year the sync last loaded, so the
// site can display the 2025 archive today and flip to live 2026 data the day
// the API key arrives — without a redeploy.
//
// EMBARGO, SECOND LAYER
// ---------------------
// bm-sync.mjs strips placements before they are written, so pre-release they
// are not in the database at all. The `locationsReleased()` guards below are
// belt-and-braces: if someone runs the sync with a wrong clock or hand-edits a
// row, the UI still refuses to render a placement early.

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { load } from './storage';
import FindIt from './FindIt';
import {
  BM_YEAR,
  locationsReleased,
  releaseLabel,
  daysUntilRelease,
} from './bm-embargo';

const PAGE_SIZE = 25;

// ------------------------------------------------------------
// DAILY SHUFFLE
// ------------------------------------------------------------
// The archive hands camps back in its own order, which happens to open on
// "Bag o' Dicks" and "Pussy Day Spa" — a pair that makes a poor first
// impression of 1,385 camps. Alphabetical would only trade that for a
// different fixed pair, and would bury anyone whose name starts late.
//
// So the list is shuffled — but seeded by the calendar day rather than
// Math.random(). That matters: a fresh shuffle on every render would reorder
// the list under your thumb as you scrolled or typed. Seeded by the day, the
// order is rock steady while you browse and different tomorrow, so over a week
// everyone gets a turn near the top.

/** mulberry32 — small, fast, good enough for shuffling a list. */
function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dailyShuffle(list) {
  if (!Array.isArray(list) || list.length < 2) return list || [];
  // Days since epoch: same value all day, everywhere, no timezone drama.
  const seed = Math.floor(Date.now() / 86400000);
  const rand = seededRandom(seed);
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// The app's shared `.ev-input::placeholder` is #4A3020 on a near-black field —
// 1.64:1 contrast, which is why the search box read as decoration. This scopes
// a readable placeholder (5.3:1, clears WCAG AA) to this page's search input
// without touching the shared style used by every form elsewhere in the app.
const SEARCH_CSS = `
  .bg-playa-search::placeholder { color: #9A8574; opacity: 1; }
  .bg-playa-search::-webkit-search-cancel-button { display: none; }
`;

function InjectSearchCSS() {
  useEffect(() => {
    const el = document.createElement('style');
    el.textContent = SEARCH_CSS;
    document.head.appendChild(el);
    return () => document.head.removeChild(el);
  }, []);
  return null;
}

// ------------------------------------------------------------
// INFINITE SCROLL
// ------------------------------------------------------------
// A sentinel div sits below the last row; when it scrolls into view the list
// grows. rootMargin loads the next page ~500px BEFORE the sentinel is visible,
// so rows are already there by the time you reach them and the list never
// visibly stalls. Everything is already in memory — this only controls how
// many rows are mounted, which is what keeps 4,500 events from freezing the
// page on first paint.
function useInfiniteScroll(hasMore, loadMore) {
  const sentinelRef = useRef(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!hasMore || !el) return;
    // Guard for older Safari, where the list simply stays paginated rather
    // than breaking.
    if (typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) loadMore(); },
      { rootMargin: '500px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadMore]);
  return sentinelRef;
}

// ------------------------------------------------------------
// SEARCH
// ------------------------------------------------------------
// Everything is already in memory, so search is a plain filter — no server
// round-trip, no debounce needed at these list sizes. A record's searchable
// text is built once and cached on the record, because rebuilding it inside
// the filter would redo the work on every keystroke.

function searchableText(rec) {
  if (rec.__q) return rec.__q;
  const parts = [
    rec.name, rec.title, rec.artist, rec.hometown,
    rec.description, rec.landmark, rec.location_string,
    rec.event_type?.label,
  ];
  rec.__q = parts.filter(Boolean).join(' ').toLowerCase();
  return rec.__q;
}

/** All terms must match, so "coffee 9:00" narrows instead of widening. */
function useSearch(records, query) {
  return useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return records;
    return records.filter(r => {
      const hay = searchableText(r);
      return terms.every(t => hay.includes(t));
    });
  }, [records, query]);
}

// ------------------------------------------------------------
// SHARED BITS
// ------------------------------------------------------------

function EmbargoNotice({ kind, children }) {
  const days = daysUntilRelease(kind);
  return (
    <div
      style={{
        border: '1px solid rgba(200,149,108,0.35)',
        background: 'rgba(200,149,108,0.07)',
        borderRadius: 10,
        padding: '12px 16px',
        margin: '0 0 16px',
        color: '#6B5749',
        fontSize: 13.5,
        lineHeight: 1.55,
      }}
    >
      <strong style={{ color: '#C8956C' }}>🔒 Addresses hidden until {releaseLabel(kind)}</strong>
      {days > 0 && <span style={{ opacity: 0.75 }}> · {days} day{days === 1 ? '' : 's'} out</span>}
      <div style={{ marginTop: 4 }}>{children}</div>
    </div>
  );
}

/** A placement, or an honest placeholder when it is still embargoed. */
function Placement({ record, kind, archive }) {
  const released = archive || locationsReleased(kind);

  if (!released || record?.locationEmbargoed) {
    return (
      <span style={{ color: '#9A8574', fontStyle: 'italic' }}>
        Address revealed {releaseLabel(kind)}
      </span>
    );
  }

  // Prefer the ready-made string; fall back to assembling from the parts.
  // Field names confirmed against the real archive: location.intersection is
  // the clock ("3:15") and location.frontage is the radial street ("D").
  let loc = record?.location_string || null;
  if (!loc && record?.location) {
    const l = record.location;
    const clock = l.intersection || (l.hour != null ? `${l.hour}:${String(l.minute ?? 0).padStart(2, '0')}` : null);
    const cross = l.frontage || l.distance || null;
    if (clock && cross) loc = `${clock} ${l.intersection_type || '&'} ${cross}`;
    else loc = clock || cross || null;
  }

  if (!loc) return <span style={{ color: '#9A8574', fontStyle: 'italic' }}>Not placed</span>;
  return <strong style={{ color: '#C8956C' }}>{loc}</strong>;
}

// ------------------------------------------------------------
// THUMBNAIL
// ------------------------------------------------------------
// 315 of 341 art pieces and 923 camps ship an official image URL in the API
// payload (burningman.widen.net). Using those beats searching the web for a
// matching photo: it is authoritative, correctly paired with the record, and
// carries no licensing question. Records without one simply render no image
// rather than a broken frame or a wrong picture.

function Thumb({ item }) {
  const [failed, setFailed] = useState(false);
  const url = item.images?.[0]?.thumbnail_url;
  if (!url || failed) return null;
  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      style={{
        width: 84, height: 84, flexShrink: 0,
        objectFit: 'cover', borderRadius: 8,
        border: '1px solid #2A1810', background: '#0F0805',
      }}
    />
  );
}

// ------------------------------------------------------------
// DETAIL MODAL
// ------------------------------------------------------------
// The list rows are deliberately compact so you can scan 1,400 camps. This is
// where the full record lives: the photo at a size worth looking at, and the
// description untruncated.

function DetailModal({ items, index, onStep, kind, archive, onClose }) {
  const scrollRef = useRef(null);
  const item = items?.[index] || null;
  const hasPrev = index > 0;
  const hasNext = items && index < items.length - 1;

  // `go` must NOT close over `index`. The keydown listener is registered once,
  // and if the handler captured the current index then holding the arrow key
  // would fire several presses against the same stale value and only move one
  // step. Stepping is delegated to the parent, which applies it as a
  // functional state update, so every press counts.
  const go = onStep;

  // Escape closes; arrows walk the list. Deliberately does NOT wrap around at
  // the ends — with 1,385 camps, silently teleporting from the last to the
  // first reads as a glitch rather than a feature.
  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, go]);

  // Moving to a new record has to reset the scroll position, or a short entry
  // after a long one opens already scrolled past its own title.
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; }, [index]);

  // Swipe, because phones have no arrow keys. The vertical guard matters: a
  // slightly-diagonal scroll up the description should not flick to the next
  // camp.
  const touch = useRef(null);
  const onTouchStart = e => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = e => {
    if (!touch.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touch.current.x;
    const dy = t.clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.6) go(dx < 0 ? 1 : -1);
  };

  if (!item) return null;
  const img = item.images?.[0]?.thumbnail_url;

  return (
    <div
      className="ev-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={item.name || item.title}
    >
      <div
        ref={scrollRef}
        className="ev-modal"
        onClick={e => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{ maxWidth: 620, textAlign: 'left', maxHeight: '86vh', overflowY: 'auto', position: 'relative' }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'sticky', top: 0, float: 'right', marginLeft: 12,
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#9A8574', fontSize: 26, lineHeight: 1, padding: 0,
          }}
        >
          ×
        </button>

        {img && (
          // The API only publishes one thumbnail per record, and it is a
          // fixed-width CDN render — so this is shown as large as it can go
          // without upscaling into mush.
          <img
            src={img}
            alt={item.name || item.title || ''}
            style={{
              width: '100%', maxHeight: 340, objectFit: 'cover',
              borderRadius: 10, border: '1px solid #2A1810',
              background: '#0F0805', marginBottom: 16,
            }}
          />
        )}

        <h2 style={{
          fontFamily: 'Cormorant Garamond, serif', fontSize: 28,
          color: '#FBF0E0', marginBottom: 6, lineHeight: 1.2,
        }}>
          {item.name || item.title}
        </h2>

        {(item.artist || item.hometown) && (
          <p style={{ color: '#C8956C', fontSize: 14, marginBottom: 4 }}>
            {item.artist}
            {item.artist && item.hometown ? ' · ' : ''}
            {item.hometown}
          </p>
        )}

        {!archive && (
          <p style={{ fontSize: 14, marginBottom: 12 }}>
            <Placement record={item} kind={kind} archive={archive} />
          </p>
        )}

        {item.description && (
          <p style={{ color: '#C8B49E', fontSize: 15, lineHeight: 1.65, marginTop: 12 }}>
            {item.description}
          </p>
        )}

        {item.landmark && (
          <p style={{ color: '#9A8574', fontSize: 13.5, marginTop: 12, fontStyle: 'italic' }}>
            Look for: {item.landmark}
          </p>
        )}

        {/* Directions live at the bottom of the record, after you have decided
            you want to go — not competing with the description above it. */}
        <FindIt item={item} />

        <div style={{ marginTop: 18, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer"
               className="ev-btn ev-btn-ghost" style={{ textDecoration: 'none' }}>
              Their website ↗
            </a>
          )}
          <button className="ev-btn ev-btn-ghost" onClick={onClose}>Close</button>
        </div>

        {/* On-screen arrows as well as the key bindings: phones have no arrow
            keys, and on desktop nobody discovers a shortcut that is never
            shown. The counter doubles as a hint that the list is walkable. */}
        {items && items.length > 1 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 12, marginTop: 16, paddingTop: 14,
            borderTop: '1px solid rgba(200,149,108,0.18)',
          }}>
            <button
              className="ev-btn ev-btn-ghost ev-btn-small"
              onClick={() => go(-1)}
              disabled={!hasPrev}
              aria-label="Previous"
              style={{ opacity: hasPrev ? 1 : 0.35, cursor: hasPrev ? 'pointer' : 'default' }}
            >
              ‹ Previous
            </button>

            <span style={{ color: '#6B5749', fontSize: 12.5, whiteSpace: 'nowrap' }}>
              {(index + 1).toLocaleString()} of {items.length.toLocaleString()}
              <span style={{ display: 'block', opacity: 0.75, fontSize: 11.5 }}>
                ← → or swipe
              </span>
            </span>

            <button
              className="ev-btn ev-btn-ghost ev-btn-small"
              onClick={() => go(1)}
              disabled={!hasNext}
              aria-label="Next"
              style={{ opacity: hasNext ? 1 : 0.35, cursor: hasNext ? 'pointer' : 'default' }}
            >
              Next ›
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// LIST
// ------------------------------------------------------------

function ResultList({ items, kind, archive, renderMeta, onOpen }) {
  const [shown, setShown] = useState(PAGE_SIZE);

  // Any change to the result set resets paging, so a new search never lands
  // the reader partway down a list they never scrolled.
  const firstKey = items[0]?.uid;
  useEffect(() => { setShown(PAGE_SIZE); }, [items.length, firstKey]);

  const loadMore = useCallback(() => setShown(s => s + PAGE_SIZE), []);
  const hasMore = items.length > shown;
  const sentinelRef = useInfiniteScroll(hasMore, loadMore);

  if (!items.length) {
    return <p style={{ color: '#6B5749', fontSize: 14 }}>Nothing matches that search.</p>;
  }

  return (
    <>
      {items.slice(0, shown).map((item, i) => (
        <div
          key={item.uid}
          className="ev-resource-card"
          role="button"
          tabIndex={0}
          onClick={() => onOpen(items, i)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(items, i); } }}
          style={{ display: 'flex', gap: 14, alignItems: 'flex-start', cursor: 'pointer' }}
        >
          {/* Official BMorg-hosted thumbnail, straight from the API payload —
              no scraping, no guessing which photo belongs to which piece.
              lazy + async decoding so a 300-item list does not fetch 300
              images before first paint. */}
          <Thumb item={item} />
          <div className="ev-resource-info" style={{ flex: 1, minWidth: 0 }}>
            <h3>{item.name || item.title}</h3>
            {renderMeta(item)}
            {item.description && <p style={{ marginTop: 6 }}>{item.description}</p>}
            {/* Placements are deliberately hidden for archive years. A past
                year's address tells you nothing about where a camp will be
                this year, and showing it invites someone to plan around a
                stale location. Only the live year renders an address. */}
            {!archive && (
              <p style={{ marginTop: 8, fontSize: 13 }}>
                <Placement record={item} kind={kind} archive={archive} />
              </p>
            )}
          </div>
        </div>
      ))}
      {hasMore && (
        <div ref={sentinelRef} style={{ padding: '18px 0', textAlign: 'center' }}>
          <span style={{ color: '#6B5749', fontSize: 13, fontStyle: 'italic' }}>
            Loading more… <span style={{ opacity: 0.6 }}>({(items.length - shown).toLocaleString()} to go)</span>
          </span>
        </div>
      )}
    </>
  );
}

// ------------------------------------------------------------
// EVENTS
// ------------------------------------------------------------
// Events differ from camps and art: one record can repeat across several days,
// and people search for when something happens as much as what it is. So the
// list is flattened to one row per occurrence and grouped by day.

const DAY_FMT = { weekday: 'long', month: 'short', day: 'numeric' };
const TIME_FMT = { hour: 'numeric', minute: '2-digit' };

function EventList({ events, campsByUid, archive }) {
  const [shown, setShown] = useState(PAGE_SIZE);
  useEffect(() => { setShown(PAGE_SIZE); }, [events.length]);
  const loadMore = useCallback(() => setShown(s => s + PAGE_SIZE), []);

  const rows = useMemo(() => {
    const out = [];
    for (const e of events) {
      const occs = e.occurrence_set?.length ? e.occurrence_set : [null];
      for (const o of occs) {
        out.push({
          key: `${e.uid}-${o?.start_time || 'tba'}`,
          title: e.title,
          description: e.description,
          type: e.event_type?.label || '',
          host: campsByUid.get(e.hosted_by_camp)?.name || '',
          allDay: e.all_day,
          start: o?.start_time ? new Date(o.start_time) : null,
          end: o?.end_time ? new Date(o.end_time) : null,
        });
      }
    }
    return out.sort((a, b) => {
      if (!a.start) return 1;
      if (!b.start) return -1;
      return a.start - b.start;
    });
  }, [events, campsByUid]);

  // Declared before the early return so hook order stays stable across renders.
  const hasMore = rows.length > shown;
  const sentinelRef = useInfiniteScroll(hasMore, loadMore);

  if (!rows.length) {
    return <p style={{ color: '#6B5749', fontSize: 14 }}>Nothing matches that search.</p>;
  }

  const visible = rows.slice(0, shown);
  const groups = [];
  for (const r of visible) {
    const label = r.start ? r.start.toLocaleDateString('en-US', DAY_FMT) : 'Time TBA';
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(r);
    else groups.push({ label, items: [r] });
  }

  return (
    <>
      {groups.map(g => (
        <div key={g.label} style={{ marginBottom: 20 }}>
          <div style={{
            fontFamily: 'Cormorant Garamond, serif', fontSize: 19, color: '#C8956C',
            borderBottom: '1px solid rgba(200,149,108,0.25)',
            paddingBottom: 5, marginBottom: 8,
          }}>
            {g.label}
          </div>
          {g.items.map(r => (
            <div key={r.key} className="ev-date-row">
              <div className="ev-date-label">
                <strong>{r.title}</strong>
                {r.type && <span style={{ color: '#9A8574', fontSize: 13 }}> · {r.type}</span>}
                {r.host && <div style={{ color: '#9A8574', fontSize: 12.5 }}>at {r.host}</div>}
                {r.description && (
                  <div style={{ color: '#6B5749', fontSize: 13, marginTop: 3 }}>{r.description}</div>
                )}
              </div>
              <div className="ev-date-date">
                {r.allDay ? 'All day'
                  : r.start
                    ? r.start.toLocaleTimeString('en-US', TIME_FMT) +
                      (r.end ? `–${r.end.toLocaleTimeString('en-US', TIME_FMT)}` : '')
                    : 'TBA'}
              </div>
            </div>
          ))}
        </div>
      ))}
      {hasMore && (
        <div ref={sentinelRef} style={{ padding: '18px 0', textAlign: 'center' }}>
          <span style={{ color: '#6B5749', fontSize: 13, fontStyle: 'italic' }}>
            Loading more… <span style={{ opacity: 0.6 }}>({(rows.length - shown).toLocaleString()} to go)</span>
          </span>
        </div>
      )}
    </>
  );
}

// ------------------------------------------------------------
// PAGE
// ------------------------------------------------------------

export default function PlayaDataPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ camps: [], art: [], events: [], vehicles: [], ourCamp: null });
  const [meta, setMeta] = useState(null);
  const [vehicleMeta, setVehicleMeta] = useState(null);
  const [tab, setTab] = useState('camps');
  const [query, setQuery] = useState('');
  // Holds the list being browsed plus a cursor, not just one record — that is
  // what lets the arrows walk whatever is currently on screen, search filters
  // included.
  const [selected, setSelected] = useState(null);
  const openItem = useCallback((items, index) => setSelected({ items, index }), []);

  // Clamped functional update: stable identity, and safe to call as fast as a
  // held arrow key can fire.
  const stepItem = useCallback((delta) => {
    setSelected(sel => {
      if (!sel) return sel;
      const next = sel.index + delta;
      return next >= 0 && next < sel.items.length ? { ...sel, index: next } : sel;
    });
  }, []);
  const searchRef = useRef(null);

  useEffect(() => {
    (async () => {
      // Which year to show is a stored pointer, not a hardcoded constant, so
      // the sync can swap 2025 -> 2026 without a redeploy.
      const current = await load('bm:current', null, true);
      const year = current?.year || BM_YEAR;

      const [camps, art, events, vehicles, ourCamp, m] = await Promise.all([
        load(`bm:${year}:camps`, [], true),
        load(`bm:${year}:art`, [], true),
        load(`bm:${year}:events`, [], true),
        // Art cars live under their own key, not a year-scoped one: they come
        // from BMorg's current-year directory rather than the archive, so they
        // are 2026 even while camps and art are still showing 2025.
        load('bm:vehicles', null, true),
        load(`bm:${year}:ourCamp`, null, true),
        load(`bm:${year}:meta`, null, true),
      ]);

      setData({
        camps: Array.isArray(camps) ? camps : [],
        art: Array.isArray(art) ? art : [],
        events: Array.isArray(events) ? events : [],
        vehicles: Array.isArray(vehicles?.items) ? vehicles.items : [],
        ourCamp,
      });
      setVehicleMeta(vehicles && !Array.isArray(vehicles) ? vehicles : null);
      setMeta(m || current);
      setLoading(false);
    })();
  }, []);

  // Switching tabs clears the query — carrying "coffee" from Events into Camps
  // just shows an empty list and reads as a bug.
  const switchTab = (id) => { setTab(id); setQuery(''); };

  const campsByUid = useMemo(
    () => new Map(data.camps.map(c => [c.uid, c])),
    [data.camps]
  );

  // Shuffled once per day, then searched — so results keep the same stable
  // order rather than jumping around as the query narrows.
  const shuffledCamps = useMemo(() => dailyShuffle(data.camps), [data.camps]);
  const filteredCamps = useSearch(shuffledCamps, tab === 'camps' ? query : '');
  const filteredArt = useSearch(data.art, tab === 'art' ? query : '');
  const filteredEvents = useSearch(data.events, tab === 'events' ? query : '');
  const filteredVehicles = useSearch(data.vehicles, tab === 'vehicles' ? query : '');

  const archive = !!meta?.isArchive;
  const year = meta?.year || BM_YEAR;

  const TABS = [
    { id: 'camps', label: 'Camps', n: data.camps.length },
    { id: 'art', label: 'Art', n: data.art.length },
    { id: 'events', label: 'Events', n: data.events.length },
    { id: 'vehicles', label: 'Art Cars', n: data.vehicles.length },
  ];

  // 'vehicles' intentionally has no embargo kind — art cars roam and have no
  // address, so there is never anything to withhold.
  const kindForTab = { camps: 'camps', art: 'art', events: 'events' }[tab];
  const held = !archive && !locationsReleased(kindForTab);

  const counts = {
    camps: filteredCamps.length,
    art: filteredArt.length,
    events: filteredEvents.length,
    vehicles: filteredVehicles.length,
  };

  return (
    <div className="ev-page">
      <InjectSearchCSS />
      <h1 className="ev-section-h">On Playa</h1>
      <p className="ev-section-sub">
        The Black Rock City directory — camps, art, and events, searchable.
      </p>

      {selected && (
        <DetailModal
          items={selected.items}
          index={selected.index}
          onStep={stepItem}
          kind={kindForTab}
          archive={archive && tab !== 'vehicles'}
          onClose={() => setSelected(null)}
        />
      )}

      {loading ? (
        <p style={{ color: '#6B5749', fontSize: 14, fontStyle: 'italic' }}>Checking the playa…</p>
      ) : !data.camps.length && !data.art.length && !data.events.length ? (
        <p style={{ color: '#6B5749', fontSize: 14 }}>
          No directory data loaded yet. Run the sync (<code>bm-sync.mjs</code>) to
          populate it — <code>--archive 2025</code> works today without an API key.
        </p>
      ) : (
        <>
          {archive && (
            <div style={{
              border: '1px solid rgba(200,149,108,0.45)',
              background: 'rgba(200,149,108,0.06)',
              borderRadius: 12,
              padding: '18px 22px', marginBottom: 20,
              fontFamily: 'Cormorant Garamond, serif',
              lineHeight: 1.35,
            }}>
              {/* The headline states what you are looking at; the second line is
                  a footnote about the future. Sizing and colour say which is
                  which before either is read. */}
              <div style={{ color: '#FBF0E0', fontSize: 27 }}>
                This is the {year} Directory.
              </div>
              <div style={{ color: '#9A8574', fontSize: 16, marginTop: 4 }}>
                {BM_YEAR} will automatically update when available.
              </div>
            </div>
          )}

          {data.ourCamp && (
            <div
              className="ev-resource-card"
              role="button"
              tabIndex={0}
              onClick={() => openItem([data.ourCamp], 0)}
              onKeyDown={e => { if (e.key === 'Enter') openItem([data.ourCamp], 0); }}
              style={{ display: 'block', borderColor: 'rgba(200,149,108,0.5)', cursor: 'pointer' }}
            >
              <div className="ev-resource-info">
                <h3 style={{ color: '#C8956C' }}>★ {data.ourCamp.name}</h3>
                {/* Same rule as the list: no stale address. On an archive year
                    this card is just "we're in the directory"; the real
                    placement appears once the live year is synced. */}
                <p style={{ marginTop: 4 }}>
                  {archive
                    ? <span style={{ color: '#9A8574', fontSize: 13 }}>
                        Our listing in the {year} directory
                      </span>
                    : <Placement record={data.ourCamp} kind="camps" archive={archive} />}
                </p>
              </div>
            </div>
          )}

          <div className="ev-admin-tabs" style={{ margin: '18px 0 14px' }}>
            {TABS.map(t => (
              <button
                key={t.id}
                className={`ev-admin-tab${tab === t.id ? ' active' : ''}`}
                onClick={() => switchTab(t.id)}
              >
                {t.label} <span style={{ opacity: 0.55 }}>{t.n}</span>
              </button>
            ))}
          </div>

          {/* The shared .ev-input is deliberately not used here. Its placeholder
              is #4A3020 on a #0F0805 field — about 1.6:1 contrast, which is
              unreadable and made the search box look decorative rather than
              usable. This one is a lifted field with a real border, a search
              icon, and a placeholder that can actually be read. */}
          <label
            htmlFor="playa-search"
            style={{
              display: 'block',
              fontFamily: 'Cormorant Garamond, serif',
              fontSize: 24,
              color: '#FBF0E0',
              marginBottom: 8,
            }}
          >
            Search
          </label>
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <span
              aria-hidden="true"
              style={{
                position: 'absolute', left: 16, top: '50%',
                transform: 'translateY(-50%)',
                color: '#C8956C', fontSize: 17, pointerEvents: 'none',
              }}
            >
              ⌕
            </span>
            <input
              ref={searchRef}
              id="playa-search"
              type="search"
              className="bg-playa-search"
              aria-label={`Search ${tab}`}
              placeholder={
                tab === 'camps' ? 'Search 1,000+ camps by name, city, or what they offer'
                : tab === 'art' ? 'Search art by title, artist, or hometown'
                : tab === 'vehicles' ? 'Search art cars by name, city, or description'
                : 'Search events by title, host camp, or type'
              }
              value={query}
              onChange={e => setQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '15px 44px 15px 42px',
                background: '#1C100A',
                border: '1.5px solid #4A3020',
                borderRadius: 10,
                color: '#FBF0E0',
                // 16px keeps iOS from zooming the page on focus.
                fontSize: 16,
                fontFamily: 'Inter, sans-serif',
                outline: 'none',
                transition: 'border-color .15s, background .15s',
              }}
              onFocus={e => {
                e.target.style.borderColor = '#C8956C';
                e.target.style.background = '#231409';
              }}
              onBlur={e => {
                e.target.style.borderColor = '#4A3020';
                e.target.style.background = '#1C100A';
              }}
            />
            {query && (
              <button
                aria-label="Clear search"
                onClick={() => { setQuery(''); searchRef.current?.focus(); }}
                style={{
                  position: 'absolute', right: 10, top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#9A8574', fontSize: 20, lineHeight: 1,
                  padding: '4px 8px',
                }}
              >
                ×
              </button>
            )}
          </div>

          <p style={{ color: '#9A8574', fontSize: 12.5, marginBottom: 14 }}>
            {counts[tab].toLocaleString()} {counts[tab] === 1 ? 'result' : 'results'}
            {query ? ` for “${query}”` : ''}
          </p>

          {held && (
            <EmbargoNotice kind={kindForTab}>
              Everything else is searchable now — only the addresses are withheld.
            </EmbargoNotice>
          )}

          {tab === 'camps' && (
            <ResultList
              items={filteredCamps} kind="camps" archive={archive} onOpen={openItem}
              renderMeta={c => c.hometown ? <p>{c.hometown}</p> : null}
            />
          )}

          {tab === 'art' && (
            <ResultList
              items={filteredArt} kind="art" archive={archive} onOpen={openItem}
              renderMeta={a => (
                <p>{a.artist}{a.hometown ? ` · ${a.hometown}` : ''}</p>
              )}
            />
          )}

          {tab === 'events' && (
            <EventList
              events={filteredEvents} campsByUid={campsByUid} archive={archive}
            />
          )}

          {tab === 'vehicles' && (
            data.vehicles.length === 0 ? (
              <div style={{
                border: '1px solid rgba(200,149,108,0.3)',
                borderRadius: 10, padding: '18px 20px',
                color: '#9A8574', fontSize: 14, lineHeight: 1.6,
              }}>
                <strong style={{ color: '#C8956C' }}>
                  495 art cars are registered for {BM_YEAR}.
                </strong>
                <div style={{ marginTop: 8 }}>
                  They land here on the first live sync. Burning Man's free
                  public archive covers camps, art and events but not mutant
                  vehicles — those come only from the authenticated API, which
                  needs the {BM_YEAR} key. The sync already knows how to fetch
                  them, so this tab fills itself in with no further work.
                </div>
                <div style={{ marginTop: 12 }}>
                  <a
                    href="https://burningman.org/black-rock-city/black-rock-city-2026/2026-mutant-vehicles/"
                    target="_blank" rel="noopener noreferrer"
                    style={{ color: '#C8956C', fontWeight: 500 }}
                  >
                    Browse the official {BM_YEAR} directory on burningman.org →
                  </a>
                </div>
              </div>
            ) : (
              <>
                <p style={{ color: '#9A8574', fontSize: 12.5, marginBottom: 12 }}>
                  {vehicleMeta?.count || data.vehicles.length} vehicles registered for{' '}
                  {vehicleMeta?.year || BM_YEAR}, from{' '}
                  <a href={vehicleMeta?.sourceUrl || 'https://burningman.org/black-rock-city/black-rock-city-2026/2026-mutant-vehicles/'}
                     target="_blank" rel="noopener noreferrer" style={{ color: '#C8956C' }}>
                    Burning Man's official DMV directory
                  </a>. Art cars roam, so they have no address.
                </p>
                <ResultList
                  items={filteredVehicles} kind="vehicles" archive={archive} onOpen={openItem}
                  renderMeta={v => v.hometown ? <p>{v.hometown}</p> : null}
                />
              </>
            )
          )}

          {/* Attribution is a condition of the API terms of service. */}
          <p style={{ color: '#9A8574', fontSize: 12, marginTop: 30, lineHeight: 1.6 }}>
            Data from the{' '}
            <a
              href="https://innovate.burningman.org/apis-page/"
              target="_blank" rel="noopener noreferrer"
              style={{ color: '#C8956C' }}
            >
              Burning Man Public API
            </a>
            . Not affiliated with or endorsed by Burning Man Project.
            {meta?.syncedAt && <> Last synced {new Date(meta.syncedAt).toLocaleString()}.</>}
          </p>
        </>
      )}
    </div>
  );
}
