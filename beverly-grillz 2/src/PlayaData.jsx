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

import { useState, useEffect, useMemo, useRef } from 'react';
import { load } from './storage';
import {
  BM_YEAR,
  locationsReleased,
  releaseLabel,
  daysUntilRelease,
} from './bm-embargo';

const PAGE_SIZE = 25;

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
// LIST
// ------------------------------------------------------------

function ResultList({ items, kind, archive, renderMeta }) {
  const [shown, setShown] = useState(PAGE_SIZE);

  // Any change to the result set resets paging, so a new search never lands
  // the reader partway down a list they never scrolled.
  const firstKey = items[0]?.uid;
  useEffect(() => { setShown(PAGE_SIZE); }, [items.length, firstKey]);

  if (!items.length) {
    return <p style={{ color: '#6B5749', fontSize: 14 }}>Nothing matches that search.</p>;
  }

  return (
    <>
      {items.slice(0, shown).map(item => (
        <div key={item.uid} className="ev-resource-card" style={{ display: 'block' }}>
          <div className="ev-resource-info">
            <h3>{item.name || item.title}</h3>
            {renderMeta(item)}
            {item.description && <p style={{ marginTop: 6 }}>{item.description}</p>}
            <p style={{ marginTop: 8, fontSize: 13 }}>
              <Placement record={item} kind={kind} archive={archive} />
              {item.landmark && (
                <span style={{ color: '#6B5749' }}> · {item.landmark}</span>
              )}
            </p>
          </div>
        </div>
      ))}
      {items.length > shown && (
        <button
          className="ev-btn ev-btn-ghost"
          style={{ width: '100%', marginTop: 10 }}
          onClick={() => setShown(s => s + PAGE_SIZE)}
        >
          Show {Math.min(PAGE_SIZE, items.length - shown)} more
          <span style={{ opacity: 0.6 }}> ({items.length - shown} left)</span>
        </button>
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
      {rows.length > shown && (
        <button
          className="ev-btn ev-btn-ghost"
          style={{ width: '100%', marginTop: 4 }}
          onClick={() => setShown(s => s + PAGE_SIZE)}
        >
          Show more <span style={{ opacity: 0.6 }}>({rows.length - shown} left)</span>
        </button>
      )}
    </>
  );
}

// ------------------------------------------------------------
// PAGE
// ------------------------------------------------------------

export default function PlayaDataPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ camps: [], art: [], events: [], ourCamp: null });
  const [meta, setMeta] = useState(null);
  const [tab, setTab] = useState('camps');
  const [query, setQuery] = useState('');
  const searchRef = useRef(null);

  useEffect(() => {
    (async () => {
      // Which year to show is a stored pointer, not a hardcoded constant, so
      // the sync can swap 2025 -> 2026 without a redeploy.
      const current = await load('bm:current', null, true);
      const year = current?.year || BM_YEAR;

      const [camps, art, events, ourCamp, m] = await Promise.all([
        load(`bm:${year}:camps`, [], true),
        load(`bm:${year}:art`, [], true),
        load(`bm:${year}:events`, [], true),
        load(`bm:${year}:ourCamp`, null, true),
        load(`bm:${year}:meta`, null, true),
      ]);

      setData({
        camps: Array.isArray(camps) ? camps : [],
        art: Array.isArray(art) ? art : [],
        events: Array.isArray(events) ? events : [],
        ourCamp,
      });
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

  const filteredCamps = useSearch(data.camps, tab === 'camps' ? query : '');
  const filteredArt = useSearch(data.art, tab === 'art' ? query : '');
  const filteredEvents = useSearch(data.events, tab === 'events' ? query : '');

  const archive = !!meta?.isArchive;
  const year = meta?.year || BM_YEAR;

  const TABS = [
    { id: 'camps', label: 'Camps', n: data.camps.length },
    { id: 'art', label: 'Art', n: data.art.length },
    { id: 'events', label: 'Events', n: data.events.length },
  ];

  const kindForTab = { camps: 'camps', art: 'art', events: 'events' }[tab];
  const held = !archive && !locationsReleased(kindForTab);

  const counts = {
    camps: filteredCamps.length,
    art: filteredArt.length,
    events: filteredEvents.length,
  };

  return (
    <div className="ev-page">
      <h1 className="ev-section-h">On Playa</h1>
      <p className="ev-section-sub">
        The Black Rock City directory — camps, art, and events, searchable.
      </p>

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
              border: '1px solid rgba(200,149,108,0.3)', borderRadius: 10,
              padding: '10px 14px', marginBottom: 14,
              color: '#9A8574', fontSize: 13,
            }}>
              Showing the <strong style={{ color: '#C8956C' }}>{year}</strong> directory.
              This swaps to {BM_YEAR} automatically once the live sync runs.
            </div>
          )}

          {data.ourCamp && (
            <div
              className="ev-resource-card"
              style={{ display: 'block', borderColor: 'rgba(200,149,108,0.5)' }}
            >
              <div className="ev-resource-info">
                <h3 style={{ color: '#C8956C' }}>★ {data.ourCamp.name}</h3>
                <p style={{ marginTop: 4 }}>
                  <Placement record={data.ourCamp} kind="camps" archive={archive} />
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

          <input
            ref={searchRef}
            className="ev-input"
            placeholder={
              tab === 'camps' ? 'Search camps — name, city, what they offer…'
              : tab === 'art' ? 'Search art — title, artist, hometown…'
              : 'Search events — title, host, type…'
            }
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{ marginBottom: 10 }}
          />

          <p style={{ color: '#9A8574', fontSize: 12.5, marginBottom: 14 }}>
            {counts[tab]} {counts[tab] === 1 ? 'result' : 'results'}
            {query && ' · '}
            {query && (
              <button
                onClick={() => { setQuery(''); searchRef.current?.focus(); }}
                style={{
                  background: 'none', border: 'none', padding: 0,
                  color: '#C8956C', cursor: 'pointer', font: 'inherit',
                }}
              >
                clear
              </button>
            )}
          </p>

          {held && (
            <EmbargoNotice kind={kindForTab}>
              Everything else is searchable now — only the addresses are withheld.
            </EmbargoNotice>
          )}

          {tab === 'camps' && (
            <ResultList
              items={filteredCamps} kind="camps" archive={archive}
              renderMeta={c => c.hometown ? <p>{c.hometown}</p> : null}
            />
          )}

          {tab === 'art' && (
            <ResultList
              items={filteredArt} kind="art" archive={archive}
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
