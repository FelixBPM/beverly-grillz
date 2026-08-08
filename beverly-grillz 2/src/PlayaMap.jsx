// ============================================================
// PLAYA MAP
// ============================================================
// A polar map of Black Rock City, drawn as SVG.
//
// WHY SVG AND NOT GOOGLE MAPS
// ---------------------------
// 1. There is no cell service on playa. Anything that fetches tiles at the
//    moment of use is a map that works everywhere except where it is needed.
//    This is a few kilobytes of vector that ships with the page.
// 2. Google has no useful basemap for BRC — it is bare desert eleven months a
//    year. A satellite tile of nothing is worse than no map.
// 3. BRC is polar, not a grid. Rings and radials ARE the city's address
//    system, so drawing the coordinate system straight is more legible than
//    any street map would be.
//
// WHAT IS DRAWN IS ONLY WHAT IS KNOWN
// -----------------------------------
// Distance rings and hour spokes come out of the geometry fitted from BMorg's
// own art coordinates. Lettered streets are deliberately NOT drawn: their
// radii are not derivable from the data we hold, and a street drawn in the
// wrong place is worse than no street at all. Rings are labelled in feet,
// which is the unit the addresses already use.

import { CITY, distanceFeet, bearingDegrees, formatDistance } from './playa-geo';

const SIZE = 320;          // viewBox is SIZE x SIZE, centred on the Man
const MAX_FT = 6000;       // radius the map covers
const RINGS = [1000, 2000, 3000, 4000, 5000];

// Screen position for a point, given its bearing and distance from the Man.
// The map is rotated so 12:00 points up — that is how every BRC map is drawn,
// and how everyone already pictures the city.
function place(bearing, ft) {
  const a = ((bearing - CITY.bearingOf12) * Math.PI) / 180; // 0 = up
  const r = (Math.min(ft, MAX_FT) / MAX_FT) * (SIZE / 2 - 18);
  return { x: SIZE / 2 + r * Math.sin(a), y: SIZE / 2 - r * Math.cos(a) };
}

function hourLabel(h) {
  const p = place(CITY.bearingOf12 + h * 30, MAX_FT * 0.99);
  return { ...p, label: `${h === 0 ? 12 : h}` };
}

export default function PlayaMap({ target, user, targetName }) {
  const spike = CITY.goldenSpike;

  const t = target && {
    ...place(bearingDegrees(spike, target), distanceFeet(spike, target)),
    ft: distanceFeet(spike, target),
  };
  const u = user && {
    ...place(bearingDegrees(spike, user), distanceFeet(spike, user)),
    ft: distanceFeet(spike, user),
  };

  // Hours 2 through 10 are the built city; 11, 12, 1 are open playa.
  const hours = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

  return (
    <div style={{ margin: '4px 0 2px' }}>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width="100%"
        style={{ display: 'block', maxWidth: 400, margin: '0 auto' }}
        role="img"
        aria-label={
          targetName
            ? `Map of Black Rock City showing ${targetName}${user ? ' and your position' : ''}`
            : 'Map of Black Rock City'
        }
      >
        <circle cx={SIZE/2} cy={SIZE/2} r={SIZE/2 - 2} fill="#0F0805" />

        {/* distance rings */}
        {RINGS.map(ft => {
          const r = (ft / MAX_FT) * (SIZE / 2 - 18);
          return (
            <g key={ft}>
              <circle
                cx={SIZE/2} cy={SIZE/2} r={r}
                fill="none" stroke="#3A2416" strokeWidth="1"
                strokeDasharray={ft % 2000 === 0 ? 'none' : '2 4'}
              />
              {ft % 2000 === 0 && (
                <text
                  x={SIZE/2 + 3} y={SIZE/2 - r - 3}
                  fill="#5A4030" fontSize="7" fontFamily="Inter, sans-serif"
                >
                  {ft === 5280 ? '1 mi' : `${ft/1000}k ft`}
                </text>
              )}
            </g>
          );
        })}

        {/* hour spokes */}
        {hours.map(h => {
          const b = CITY.bearingOf12 + h * 30;
          const inner = place(b, 400);
          const outer = place(b, MAX_FT * 0.94);
          const major = h % 3 === 0;
          return (
            <line
              key={h}
              x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
              stroke={major ? '#4A3020' : '#2A1810'}
              strokeWidth={major ? 1 : 0.6}
            />
          );
        })}

        {/* hour numbers */}
        {[12, 3, 6, 9].map(h => {
          const p = hourLabel(h % 12);
          return (
            <text
              key={h}
              x={p.x} y={p.y}
              fill="#8A6C52" fontSize="9" fontFamily="Inter, sans-serif"
              textAnchor="middle" dominantBaseline="middle"
            >
              {h}
            </text>
          );
        })}

        {/* the Man */}
        <g>
          <circle cx={SIZE/2} cy={SIZE/2} r="3.5" fill="#C8956C" />
          <text
            x={SIZE/2} y={SIZE/2 + 13}
            fill="#8A6C52" fontSize="7" fontFamily="Inter, sans-serif"
            textAnchor="middle"
          >
            the Man
          </text>
        </g>

        {/* a line between you and it, so the relationship reads instantly */}
        {t && u && (
          <line
            x1={u.x} y1={u.y} x2={t.x} y2={t.y}
            stroke="#C8956C" strokeWidth="1" strokeDasharray="3 3" opacity="0.75"
          />
        )}

        {/* target */}
        {t && (
          <g>
            <circle cx={t.x} cy={t.y} r="6" fill="none" stroke="#E0A878" strokeWidth="1.5" />
            <circle cx={t.x} cy={t.y} r="2.5" fill="#E0A878" />
          </g>
        )}

        {/* you */}
        {u && (
          <g>
            <circle cx={u.x} cy={u.y} r="9" fill="#6FA8DC" opacity="0.18" />
            <circle cx={u.x} cy={u.y} r="3.5" fill="#6FA8DC" stroke="#0F0805" strokeWidth="1" />
          </g>
        )}
      </svg>

      <div style={{
        display: 'flex', gap: 16, justifyContent: 'center',
        color: '#6B5749', fontSize: 11.5, marginTop: 6, flexWrap: 'wrap',
      }}>
        {t && (
          <span>
            <span style={{ color: '#E0A878' }}>●</span>{' '}
            {targetName || 'Destination'} · {formatDistance(t.ft)} out
          </span>
        )}
        {u && <span><span style={{ color: '#6FA8DC' }}>●</span> You</span>}
        <span style={{ opacity: 0.7 }}>12:00 is up</span>
      </div>
    </div>
  );
}
