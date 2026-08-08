// ============================================================
// FIND IT — distance, direction, and a live compass
// ============================================================
// Everything here runs on the device. The browser's Geolocation API reads the
// GPS chip, which talks to satellites and needs no cell service — the one
// piece of playa navigation that works for free out there. No position is ever
// sent anywhere: there is no request to any server in this file.
//
// The answer is phrased in clock positions because that is the city's own
// coordinate system. "Head toward 4:30" is something you can act on standing
// in dust at 2am; "bearing 178°" is not.

import { useState, useEffect, useRef, useCallback } from 'react';
import PlayaMap from './PlayaMap';
import {
  coordsOf, clockOf, clockToBearing, toPlaya,
  distanceFeet, bearingDegrees, bearingToClock,
  formatDistance, walkMinutes, compassPoint,
} from './playa-geo';

// ------------------------------------------------------------
// COMPASS
// ------------------------------------------------------------
// Heading needs an explicit permission grant on iOS, and it has to be asked
// for from inside a tap handler or the prompt never appears.

function useHeading(enabled) {
  const [heading, setHeading] = useState(null);
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    const onOrient = (e) => {
      // iOS exposes a true-north heading directly; everywhere else alpha is
      // relative to the device's own zero, which is close enough to steer by.
      const h = e.webkitCompassHeading != null
        ? e.webkitCompassHeading
        : (e.alpha != null ? 360 - e.alpha : null);
      if (h != null && !Number.isNaN(h)) setHeading(h);
    };
    window.addEventListener('deviceorientationabsolute', onOrient, true);
    window.addEventListener('deviceorientation', onOrient, true);
    return () => {
      window.removeEventListener('deviceorientationabsolute', onOrient, true);
      window.removeEventListener('deviceorientation', onOrient, true);
    };
  }, [enabled]);
  return heading;
}

async function requestCompass() {
  const D = typeof window !== 'undefined' && window.DeviceOrientationEvent;
  if (D && typeof D.requestPermission === 'function') {
    try { return (await D.requestPermission()) === 'granted'; } catch { return false; }
  }
  return !!D;
}

// ------------------------------------------------------------

export default function FindIt({ item }) {
  const [state, setState] = useState('idle'); // idle | locating | ready | denied | unsupported
  const [pos, setPos] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [compassOn, setCompassOn] = useState(false);
  const watchRef = useRef(null);
  const heading = useHeading(compassOn);

  const target = coordsOf(item);
  const targetClock = clockOf(item);

  useEffect(() => () => {
    if (watchRef.current != null) navigator.geolocation?.clearWatch(watchRef.current);
  }, []);

  const locate = useCallback(async () => {
    if (!navigator.geolocation) { setState('unsupported'); return; }
    setState('locating');
    setCompassOn(await requestCompass());
    // watchPosition rather than getCurrentPosition: the first fix is often
    // poor, and it tightens up over a few seconds as more satellites lock.
    watchRef.current = navigator.geolocation.watchPosition(
      (p) => {
        setPos({ lat: p.coords.latitude, lon: p.coords.longitude });
        setAccuracy(p.coords.accuracy);
        setState('ready');
      },
      (err) => setState(err.code === err.PERMISSION_DENIED ? 'denied' : 'unsupported'),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
  }, []);

  // ---- what we can say ----
  let distance = null, bearing = null, clock = null;
  if (pos && target) {
    distance = distanceFeet(pos, target);
    bearing = bearingDegrees(pos, target);
    clock = bearingToClock(bearing);
  } else if (target) {
    const p = toPlaya(target);
    clock = p.clock;
  } else if (targetClock) {
    bearing = clockToBearing(targetClock);
    clock = targetClock;
  }

  const arrowAngle = bearing != null && heading != null ? bearing - heading : null;

  const box = {
    border: '1px solid rgba(200,149,108,0.3)',
    background: 'rgba(200,149,108,0.05)',
    borderRadius: 12, padding: '16px 18px', marginTop: 18,
  };

  // Nothing placed at all — say so rather than showing a dead button.
  if (!target && !targetClock) {
    return (
      <div style={{ ...box, color: '#9A8574', fontSize: 13.5, lineHeight: 1.6 }}>
        No placement published for this one yet. Directions appear here as soon
        as it has an address.
      </div>
    );
  }

  return (
    <div style={box}>
      {state === 'idle' && (
        <>
          <button
            className="ev-btn ev-btn-primary"
            style={{ width: '100%' }}
            onClick={locate}
          >
            Find it from where I am →
          </button>
          <p style={{ color: '#6B5749', fontSize: 12, marginTop: 8, lineHeight: 1.5 }}>
            Uses your phone's GPS, which works without any signal out there.
            Your location stays on your device — it is never sent anywhere.
          </p>
          {clock && (
            <p style={{ color: '#9A8574', fontSize: 13, marginTop: 10 }}>
              It's at <strong style={{ color: '#C8956C' }}>{clock}</strong>
              {target ? ` · ${formatDistance(toPlaya(target).distanceFeet)} from the Man` : ''}
            </p>
          )}
        </>
      )}

      {state === 'locating' && (
        <p style={{ color: '#C8956C', fontSize: 14, fontStyle: 'italic' }}>
          Finding you… <span style={{ color: '#6B5749' }}>(can take a few seconds)</span>
        </p>
      )}

      {state === 'denied' && (
        <div style={{ color: '#9A8574', fontSize: 13.5, lineHeight: 1.6 }}>
          <strong style={{ color: '#C8956C' }}>Location is off.</strong> Turn it on
          in your browser settings for turn-by-turn, or just steer by the address:
          {clock && <> it's at <strong style={{ color: '#C8956C' }}>{clock}</strong>.</>}
        </div>
      )}

      {state === 'unsupported' && (
        <div style={{ color: '#9A8574', fontSize: 13.5 }}>
          This browser won't share a location.
          {clock && <> It's at <strong style={{ color: '#C8956C' }}>{clock}</strong>.</>}
        </div>
      )}

      {state === 'ready' && (
        <>
          {distance != null ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              {/* The arrow only appears once we have a heading — a static arrow
                  that looks live would point people into open desert. */}
              {arrowAngle != null && (
                <div style={{
                  width: 62, height: 62, flexShrink: 0, borderRadius: '50%',
                  border: '1.5px solid rgba(200,149,108,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <div style={{
                    transform: `rotate(${arrowAngle}deg)`,
                    transition: 'transform .18s linear',
                    fontSize: 26, lineHeight: 1, color: '#C8956C',
                  }}>
                    ↑
                  </div>
                </div>
              )}
              <div>
                <div style={{
                  fontFamily: 'Cormorant Garamond, serif', fontSize: 30,
                  color: '#FBF0E0', lineHeight: 1.1,
                }}>
                  {formatDistance(distance)}
                </div>
                <div style={{ color: '#C8956C', fontSize: 14, marginTop: 2 }}>
                  Head toward <strong>{clock}</strong>
                  <span style={{ color: '#6B5749' }}> · {compassPoint(bearing)}</span>
                </div>
                <div style={{ color: '#6B5749', fontSize: 12.5, marginTop: 2 }}>
                  about {walkMinutes(distance)} min walk
                  {accuracy ? ` · GPS ±${Math.round(accuracy)}m` : ''}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ color: '#9A8574', fontSize: 13.5, lineHeight: 1.6 }}>
              This one publishes a street address but no GPS, so an exact
              distance isn't possible — but the direction is:
              head toward <strong style={{ color: '#C8956C' }}>{clock}</strong>.
            </div>
          )}

          {arrowAngle == null && (
            <p style={{ color: '#6B5749', fontSize: 12, marginTop: 10 }}>
              Tilt-compass isn't available here, so there's no live arrow —
              the clock heading above still holds.
            </p>
          )}

          <PlayaMap target={target} user={pos} targetName={item.name || item.title} />
        </>
      )}
    </div>
  );
}
