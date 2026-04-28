import { useState, useEffect } from 'react';
import { load, save } from './storage';

// ============================================================
// DEFAULT DATA — admins can change everything from the Admin tab
// ============================================================

const DEFAULT_CONFIG = {
  eventName: "Beverly Grillz",
  tagline: "",
  year: new Date().getFullYear(),
  dates: "",
  location: "",
  description: "",
  agreements: [
    "I understand this is a remote desert event and I'm responsible for my own safety, hydration, and shelter.",
    "I agree to follow the event guidelines, leave no trace, and respect all participants.",
    "I understand my contact info will only be used for event coordination.",
  ],
  shiftRequirement: 3,
  adminPassword: "admin123",
  eventPassword: "hospitable",
  applicationsOpen: true,
};

const DEFAULT_SHIFTS = [
  { id: 's1', name: 'Camp Build', day: 'Thursday', time: '2:00–4:00 pm', capacity: 8, signups: [] },
  { id: 's2', name: 'Welcome Gate', day: 'Thursday', time: '4:00–6:00 pm', capacity: 4, signups: [] },
  { id: 's3', name: 'Dinner Crew', day: 'Thursday', time: '6:00–8:00 pm', capacity: 5, signups: [] },
  { id: 's4', name: 'Fire Watch', day: 'Thursday', time: '10:00 pm–1:00 am', capacity: 3, signups: [] },
  { id: 's5', name: 'Sunrise Coffee', day: 'Friday', time: '6:00–8:00 am', capacity: 3, signups: [] },
  { id: 's6', name: 'Workshop Setup', day: 'Friday', time: '10:00 am–12:00 pm', capacity: 4, signups: [] },
  { id: 's7', name: 'Communal Lunch', day: 'Friday', time: '12:00–2:00 pm', capacity: 5, signups: [] },
  { id: 's8', name: 'Bonfire Tending', day: 'Friday', time: '8:00–11:00 pm', capacity: 3, signups: [] },
  { id: 's9', name: 'Final Brunch', day: 'Sunday', time: '9:00–11:00 am', capacity: 5, signups: [] },
  { id: 's10', name: 'Tear-down Crew', day: 'Sunday', time: '12:00–3:00 pm', capacity: 8, signups: [] },
];

const DEFAULT_PACKING = [
  'Tent or shade structure',
  'Sleeping bag (rated for cold nights)',
  'Sleeping pad',
  'At least 2 gallons of water per day',
  'Wide-brim hat',
  'Sunglasses (UV)',
  'High-SPF sunscreen',
  'Headlamp + extra batteries',
  'Closed-toe boots or sturdy shoes',
  'Warm layers for night',
  'Dust mask or bandana',
  'Lip balm',
  'Personal medications',
  'Trash bags (leave no trace)',
];

const DEFAULT_RESOURCES = [
  { id: 'r1', name: 'Camp Map', kind: 'image', url: '', description: 'Site layout & landmarks' },
  { id: 'r2', name: 'Full Schedule', kind: 'pdf', url: '#', description: 'Thursday through Sunday' },
  { id: 'r3', name: 'Driving Directions', kind: 'pdf', url: '#', description: 'Final approach & GPS coords' },
];

// ============================================================
// STORAGE HELPERS
// ============================================================
// Imported from ./storage at the top of the file:
// shared=true  → Supabase kv_store
// shared=false → localStorage

const newId = () => 'u' + Math.random().toString(36).slice(2, 10);

// ============================================================
// GIRAFFE — reusable silhouette, color via currentColor
// ============================================================

function Giraffe({ size = 100, opacity = 1, style = {}, className = '' }) {
  return (
    <svg
      width={size}
      height={size * 1.35}
      viewBox="0 0 120 160"
      fill="currentColor"
      className={className}
      style={{ opacity, ...style }}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* body */}
      <ellipse cx="50" cy="80" rx="32" ry="13"/>
      {/* legs */}
      <rect x="65" y="88" width="4.2" height="56" rx="2"/>
      <rect x="74" y="88" width="4.2" height="56" rx="2"/>
      <rect x="22" y="88" width="4.2" height="56" rx="2"/>
      <rect x="31" y="88" width="4.2" height="56" rx="2"/>
      {/* tail */}
      <path d="M 18 76 Q 11 84 9 95 Q 13 99 15 94 Q 16 87 16 80 Z"/>
      <ellipse cx="11" cy="96" rx="2.5" ry="3"/>
      {/* neck */}
      <path d="M 70 72 L 78 72 L 92 17 L 83 14 Z"/>
      {/* head */}
      <ellipse cx="93" cy="16" rx="9" ry="5"/>
      {/* snout */}
      <path d="M 99 14 L 105 16 L 103 21 L 98 19 Z"/>
      {/* ossicones */}
      <rect x="84.5" y="6" width="2" height="6" rx="1"/>
      <circle cx="85.5" cy="5" r="2"/>
      <rect x="89" y="7" width="2" height="5" rx="1"/>
      <circle cx="90" cy="6" r="1.7"/>
      {/* ear */}
      <ellipse cx="89" cy="13" rx="3" ry="1.8" transform="rotate(-35 89 13)"/>
    </svg>
  );
}

// ============================================================
// MAIN APP
// ============================================================

export default function App() {
  const [page, setPage] = useState('home');
  const [loading, setLoading] = useState(true);

  // Shared (everyone sees same)
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [shifts, setShifts] = useState(DEFAULT_SHIFTS);
  const [packingItems, setPackingItems] = useState(DEFAULT_PACKING);
  const [resources, setResources] = useState(DEFAULT_RESOURCES);
  const [applications, setApplications] = useState([]);

  // Per-user (only this device/browser)
  const [me, setMe] = useState(null);
  const [packingChecks, setPackingChecks] = useState({});

  // Admin state (per-device)
  const [isAdmin, setIsAdmin] = useState(false);

  // Lock screen state (per-device)
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => { (async () => {
    const [cfg, sh, pk, rs, ap, mUsr, pcChk, unl] = await Promise.all([
      load('config', DEFAULT_CONFIG, true),
      load('shifts', DEFAULT_SHIFTS, true),
      load('packing', DEFAULT_PACKING, true),
      load('resources', DEFAULT_RESOURCES, true),
      load('applications', [], true),
      load('me', null, false),
      load('packingChecks', {}, false),
      load('unlocked', false, false),
    ]);
    setConfig(cfg); setShifts(sh); setPackingItems(pk);
    setResources(rs); setApplications(ap);
    setMe(mUsr); setPackingChecks(pcChk);
    setUnlocked(unl);
    setLoading(false);
  })(); }, []);

  // Update helpers
  const updateConfig = async (c) => { setConfig(c); await save('config', c, true); };
  const updateShifts = async (s) => { setShifts(s); await save('shifts', s, true); };
  const updatePacking = async (p) => { setPackingItems(p); await save('packing', p, true); };
  const updateResources = async (r) => { setResources(r); await save('resources', r, true); };
  const updateApplications = async (a) => { setApplications(a); await save('applications', a, true); };
  const updateMe = async (m) => { setMe(m); await save('me', m, false); };
  const updatePackingChecks = async (pc) => { setPackingChecks(pc); await save('packingChecks', pc, false); };
  const updateUnlocked = async (u) => { setUnlocked(u); await save('unlocked', u, false); };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0F0805', fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 22, color: '#FF8438',
        fontStyle: 'italic', letterSpacing: '0.04em'
      }}>
        Lighting the fires…
      </div>
    );
  }

  if (!unlocked) {
    return <LockScreen config={config} onUnlock={() => updateUnlocked(true)} />;
  }

  const PAGES = {
    home: <Home config={config} setPage={setPage} me={me} />,
    apply: <Apply config={config} me={me} updateMe={updateMe} applications={applications} updateApplications={updateApplications} setPage={setPage} />,
    shifts: <Shifts shifts={shifts} updateShifts={updateShifts} me={me} requirement={config.shiftRequirement} setPage={setPage} />,
    resources: <Resources resources={resources} />,
    packing: <Packing items={packingItems} checks={packingChecks} updateChecks={updatePackingChecks} />,
    admin: <Admin
      isAdmin={isAdmin} setIsAdmin={setIsAdmin}
      config={config} updateConfig={updateConfig}
      shifts={shifts} updateShifts={updateShifts}
      packingItems={packingItems} updatePacking={updatePacking}
      resources={resources} updateResources={updateResources}
      applications={applications} updateApplications={updateApplications}
    />,
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,500&family=Outfit:wght@300;400;500;600;700&display=swap');

        * { box-sizing: border-box; }
        .ev-app {
          min-height: 100vh;
          background: #0F0805;
          color: #FBF0E0;
          font-family: 'Outfit', system-ui, sans-serif;
          font-size: 16px;
          line-height: 1.55;
          background-image:
            radial-gradient(ellipse 60% 40% at 15% 0%, rgba(255, 107, 26, 0.10), transparent 70%),
            radial-gradient(ellipse 50% 50% at 90% 100%, rgba(199, 62, 29, 0.10), transparent 70%),
            radial-gradient(ellipse 80% 30% at 50% 100%, rgba(255, 182, 39, 0.05), transparent 70%);
        }
        .ev-display { font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 500; letter-spacing: -0.01em; }
        .ev-italic { font-family: 'Cormorant Garamond', Georgia, serif; font-style: italic; font-weight: 400; }

        .ev-container { max-width: 880px; margin: 0 auto; padding: 24px; }

        /* HEADER */
        .ev-header {
          padding: 18px 24px;
          border-bottom: 1px solid #2A1810;
          background: rgba(15, 8, 5, 0.85);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          position: sticky; top: 0; z-index: 50;
        }
        .ev-header-row { max-width: 1100px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
        .ev-logo {
          font-family: 'Cormorant Garamond', Georgia, serif; font-size: 24px; font-weight: 500;
          letter-spacing: -0.01em; color: #FBF0E0; cursor: pointer;
          display: flex; align-items: center; gap: 10px;
        }
        .ev-logo .dot {
          background: linear-gradient(135deg, #FFB627, #FF6B1A 50%, #C73E1D);
          -webkit-background-clip: text; background-clip: text;
          -webkit-text-fill-color: transparent;
          font-style: italic;
        }
        .ev-nav { display: flex; gap: 2px; flex-wrap: wrap; align-items: center; }
        .ev-nav button {
          background: none; border: none; cursor: pointer;
          padding: 8px 14px; border-radius: 999px;
          font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 500;
          color: #A88876; transition: all 0.18s ease;
          letter-spacing: 0.02em;
        }
        .ev-nav button:hover { background: #1F1108; color: #FBF0E0; }
        .ev-nav button.active {
          background: linear-gradient(135deg, #FF6B1A, #C73E1D);
          color: #FBF0E0;
          box-shadow: 0 4px 16px rgba(255, 107, 26, 0.25);
        }

        /* BUTTONS */
        .ev-btn {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 12px 24px; border-radius: 999px;
          font-family: 'Outfit', sans-serif; font-size: 14px; font-weight: 600;
          border: none; cursor: pointer; transition: all 0.18s ease;
          letter-spacing: 0.02em;
        }
        .ev-btn-primary {
          background: linear-gradient(135deg, #FFB627 0%, #FF6B1A 50%, #C73E1D 100%);
          color: #150905;
          box-shadow: 0 6px 24px rgba(255, 107, 26, 0.3);
        }
        .ev-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 8px 28px rgba(255, 107, 26, 0.45); }
        .ev-btn-primary:disabled { background: #3A2418; color: #6B5749; cursor: not-allowed; box-shadow: none; transform: none; }
        .ev-btn-accent {
          background: #FF6B1A; color: #150905;
        }
        .ev-btn-accent:hover { background: #FF8438; }
        .ev-btn-ghost { background: transparent; color: #FBF0E0; border: 1px solid #3A2418; }
        .ev-btn-ghost:hover { background: #1F1108; border-color: #5A3818; }
        .ev-btn-small { padding: 6px 14px; font-size: 12px; }

        /* CARDS */
        .ev-card {
          background: #1A0E08;
          border: 1px solid #2A1810;
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 16px;
        }
        .ev-card-tight { padding: 16px; }

        /* INPUTS */
        .ev-label {
          display: block; font-size: 11px; font-weight: 600; color: #C8956C;
          margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.12em;
          font-family: 'Outfit', sans-serif;
        }
        .ev-input, .ev-textarea, .ev-select {
          width: 100%;
          padding: 12px 14px;
          background: #0F0805;
          border: 1px solid #3A2418;
          border-radius: 8px;
          font-family: 'Outfit', sans-serif;
          font-size: 15px;
          color: #FBF0E0;
          transition: border 0.18s ease;
        }
        .ev-input:focus, .ev-textarea:focus, .ev-select:focus { outline: none; border-color: #FF6B1A; box-shadow: 0 0 0 3px rgba(255, 107, 26, 0.12); }
        .ev-input::placeholder, .ev-textarea::placeholder { color: #6B5749; }
        .ev-textarea { resize: vertical; min-height: 90px; }

        /* CHECKBOX */
        .ev-check { display: flex; align-items: flex-start; gap: 12px; padding: 12px; border-radius: 8px; cursor: pointer; transition: background 0.15s; }
        .ev-check:hover { background: #1F1108; }
        .ev-check input { width: 18px; height: 18px; margin-top: 2px; accent-color: #FF6B1A; cursor: pointer; flex-shrink: 0; }
        .ev-check span { font-size: 15px; line-height: 1.45; color: #E8D0B8; }

        /* HERO */
        .ev-hero { padding: 56px 0 40px; text-align: center; position: relative; }
        .ev-hero h1 { font-size: clamp(52px, 9vw, 96px); line-height: 1; margin: 0 0 8px; font-weight: 500; }
        .ev-hero h1 em {
          font-style: italic;
          background: linear-gradient(135deg, #FFB627 0%, #FF6B1A 50%, #C73E1D 100%);
          -webkit-background-clip: text; background-clip: text;
          -webkit-text-fill-color: transparent;
          font-weight: 400;
        }
        .ev-hero .tagline { font-family: 'Cormorant Garamond', serif; font-style: italic; font-size: 22px; color: #C8956C; margin: 16px 0 4px; }
        .ev-hero .meta { font-size: 12px; color: #C8956C; letter-spacing: 0.25em; text-transform: uppercase; margin-top: 18px; font-weight: 500; }
        .ev-hero .lead { font-size: 17px; color: #A88876; max-width: 520px; margin: 28px auto 36px; line-height: 1.6; }

        /* SHIFT */
        .ev-shift {
          display: flex; align-items: center; justify-content: space-between; gap: 16px;
          padding: 18px 22px; background: #1A0E08; border: 1px solid #2A1810; border-radius: 10px;
          margin-bottom: 10px;
          transition: border-color 0.18s;
        }
        .ev-shift.full { background: #14080A; opacity: 0.55; }
        .ev-shift.mine {
          border-color: #FF6B1A;
          background: linear-gradient(135deg, rgba(255, 107, 26, 0.08), rgba(199, 62, 29, 0.05));
        }
        .ev-shift-meta { display: flex; flex-direction: column; gap: 3px; }
        .ev-shift-name { font-family: 'Cormorant Garamond', serif; font-size: 21px; font-weight: 500; color: #FBF0E0; letter-spacing: -0.01em; }
        .ev-shift-when { font-size: 13px; color: #C8956C; letter-spacing: 0.04em; }
        .ev-shift-cap { font-size: 12px; color: #8A7060; font-weight: 500; }
        .ev-shift-actions { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }

        .ev-day-heading {
          font-family: 'Cormorant Garamond', serif; font-style: italic; font-weight: 400;
          font-size: 32px; margin: 32px 0 14px;
          background: linear-gradient(135deg, #FFB627, #FF6B1A);
          -webkit-background-clip: text; background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        /* RESOURCE */
        .ev-resource { display: flex; gap: 16px; align-items: center; padding: 16px; background: #1A0E08; border: 1px solid #2A1810; border-radius: 10px; margin-bottom: 10px; }
        .ev-resource-icon {
          width: 56px; height: 56px; flex-shrink: 0;
          background: linear-gradient(135deg, #281510, #1A0E08);
          border: 1px solid #3A2418;
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          font-family: 'Cormorant Garamond', serif; font-weight: 600;
          color: #FF8438; font-size: 13px;
          background-size: cover; background-position: center;
          letter-spacing: 0.05em;
        }

        /* PACKING */
        .ev-pack-row { display: flex; align-items: center; gap: 12px; padding: 11px 14px; border-bottom: 1px solid #2A1810; }
        .ev-pack-row:last-child { border-bottom: none; }
        .ev-pack-row input { width: 18px; height: 18px; accent-color: #FF6B1A; cursor: pointer; }
        .ev-pack-row span { font-size: 15px; flex: 1; color: #E8D0B8; }
        .ev-pack-row span.checked { text-decoration: line-through; color: #6B5749; }

        /* ADMIN */
        .ev-admin-section { padding: 24px; background: #1A0E08; border: 1px solid #2A1810; border-radius: 12px; margin-bottom: 16px; }
        .ev-admin-section h3 { font-family: 'Cormorant Garamond', serif; font-size: 26px; margin: 0 0 14px; font-weight: 500; }
        .ev-admin-row { display: grid; grid-template-columns: 1fr 1fr 1fr 80px auto; gap: 8px; align-items: center; margin-bottom: 8px; }

        /* MISC */
        .ev-section-title {
          font-family: 'Cormorant Garamond', serif; font-size: 44px; font-weight: 500;
          margin: 0 0 8px; letter-spacing: -0.015em; line-height: 1.05;
        }
        .ev-section-sub { color: #A88876; margin: 0 0 28px; font-size: 16px; }
        .ev-pill { display: inline-block; padding: 5px 14px; background: #281510; color: #C8956C; border-radius: 999px; font-size: 11px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; }
        .ev-pill.green { background: rgba(255, 107, 26, 0.15); color: #FFB627; border: 1px solid rgba(255, 107, 26, 0.3); }
        .ev-pill.orange { background: linear-gradient(135deg, #FFB627, #FF6B1A); color: #150905; }

        .ev-success { padding: 16px 20px; background: rgba(255, 107, 26, 0.1); color: #FFB627; border: 1px solid rgba(255, 107, 26, 0.25); border-radius: 10px; font-weight: 500; margin-bottom: 16px; }
        .ev-warn { padding: 16px 20px; background: rgba(199, 62, 29, 0.12); color: #FF8438; border: 1px solid rgba(199, 62, 29, 0.3); border-radius: 10px; margin-bottom: 16px; }

        .ev-divider { height: 1px; background: #2A1810; margin: 24px 0; }

        @media (max-width: 600px) {
          .ev-shift { flex-direction: column; align-items: flex-start; }
          .ev-admin-row { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="ev-app">
        <Header config={config} page={page} setPage={setPage} onLock={() => updateUnlocked(false)} />
        <div className="ev-container">
          {PAGES[page]}
        </div>
        <Footer />
      </div>
    </>
  );
}

// ============================================================
// HEADER & NAV
// ============================================================

function Header({ config, page, setPage, onLock }) {
  const tabs = [
    ['home', 'Home'],
    ['apply', 'Apply'],
    ['shifts', 'Shifts'],
    ['resources', 'Resources'],
    ['packing', 'Packing'],
    ['admin', 'Admin'],
  ];
  return (
    <header className="ev-header">
      <div className="ev-header-row">
        <div className="ev-logo" onClick={() => setPage('home')}>
          {config.eventName}<span className="dot">.</span>
        </div>
        <nav className="ev-nav">
          {tabs.map(([k, label]) => (
            <button key={k} onClick={() => setPage(k)} className={page === k ? 'active' : ''}>
              {label}
            </button>
          ))}
          <button
            onClick={onLock}
            title="Lock app"
            style={{ marginLeft: 4, padding: '8px 10px', color: '#8A8270' }}
          >
            🔒
          </button>
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer style={{ textAlign: 'center', padding: '48px 20px 60px', color: '#6B5749', fontSize: 13, fontStyle: 'italic', fontFamily: 'Cormorant Garamond, serif', letterSpacing: '0.03em' }}>
      Built for the wanderers who keep returning to the dust.
    </footer>
  );
}

// ============================================================
// LOCK SCREEN — gates entire app behind event password
// ============================================================

function LockScreen({ config, onUnlock }) {
  const [pw, setPw] = useState('');
  const [error, setError] = useState(false);

  function tryUnlock() {
    if (pw === config.eventPassword) {
      setError(false);
      onUnlock();
    } else {
      setError(true);
      setPw('');
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,400;1,500&family=Outfit:wght@300;400;500;600&display=swap');

        .lock-bg {
          min-height: 100vh;
          background: #0A0503;
          background-image:
            radial-gradient(ellipse 80% 60% at 50% 20%, rgba(255, 107, 26, 0.22), transparent 60%),
            radial-gradient(ellipse 60% 40% at 50% 30%, rgba(255, 182, 39, 0.15), transparent 60%),
            radial-gradient(ellipse 100% 50% at 50% 100%, rgba(199, 62, 29, 0.18), transparent 70%);
          color: #FBF0E0;
          font-family: 'Outfit', sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          position: relative;
          overflow: hidden;
        }

        /* Sun/flame disc behind the title */
        .lock-sun {
          position: absolute;
          top: 18%;
          left: 50%;
          transform: translateX(-50%);
          width: 380px; height: 380px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255, 182, 39, 0.35) 0%, rgba(255, 107, 26, 0.15) 40%, transparent 70%);
          filter: blur(20px);
          pointer-events: none;
        }

        /* Dune silhouettes at bottom */
        .lock-dunes {
          position: absolute;
          bottom: 0; left: 0; right: 0;
          height: 200px;
          pointer-events: none;
          z-index: 1;
        }

        /* Giraffes positioned along the dune line */
        .lock-giraffe {
          position: absolute;
          bottom: 60px;
          color: #1A0E08;
          z-index: 2;
          pointer-events: none;
        }
        .lock-giraffe.left { left: 8%; }
        .lock-giraffe.right { right: 12%; bottom: 80px; transform: scaleX(-1); }

        @media (max-width: 700px) {
          .lock-giraffe.right { display: none; }
          .lock-sun { width: 260px; height: 260px; }
        }

        .lock-card {
          width: 100%;
          max-width: 440px;
          text-align: center;
          position: relative;
          z-index: 10;
        }
        .lock-mark {
          font-family: 'Outfit', sans-serif;
          font-size: 11px;
          letter-spacing: 0.35em;
          text-transform: uppercase;
          color: #FFB627;
          margin-bottom: 24px;
          font-weight: 500;
        }
        .lock-mark .sep { color: #6B5749; margin: 0 8px; }
        .lock-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(48px, 9vw, 76px);
          font-weight: 500;
          line-height: 0.95;
          letter-spacing: -0.02em;
          margin: 0 0 44px;
        }
        .lock-title em {
          font-style: italic; font-weight: 400;
          background: linear-gradient(135deg, #FFB627 0%, #FF6B1A 50%, #C73E1D 100%);
          -webkit-background-clip: text; background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .lock-sub {
          font-family: 'Cormorant Garamond', serif;
          font-style: italic;
          font-size: 19px;
          color: #C8956C;
          margin: -32px 0 12px;
          letter-spacing: 0.01em;
        }
        .lock-where {
          font-size: 11px; letter-spacing: 0.25em; text-transform: uppercase;
          color: #8A7060; margin: -8px 0 44px;
        }
        .lock-input {
          width: 100%;
          padding: 16px 20px;
          background: rgba(15, 8, 5, 0.6);
          border: 1px solid rgba(255, 132, 56, 0.3);
          border-radius: 10px;
          font-family: 'Outfit', sans-serif;
          font-size: 15px;
          color: #FBF0E0;
          text-align: center;
          letter-spacing: 0.05em;
          transition: all 0.2s ease;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }
        .lock-input::placeholder { color: rgba(200, 149, 108, 0.5); letter-spacing: 0.02em; }
        .lock-input:focus {
          outline: none;
          border-color: #FF8438;
          box-shadow: 0 0 0 3px rgba(255, 132, 56, 0.15);
        }
        .lock-input.error { border-color: #C73E1D; animation: shake 0.4s; }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-6px); }
          75% { transform: translateX(6px); }
        }
        .lock-btn {
          width: 100%;
          margin-top: 12px;
          padding: 15px 22px;
          background: linear-gradient(135deg, #FFB627 0%, #FF6B1A 50%, #C73E1D 100%);
          color: #150905;
          border: none;
          border-radius: 10px;
          font-family: 'Outfit', sans-serif;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 8px 32px rgba(255, 107, 26, 0.3);
        }
        .lock-btn:hover { transform: translateY(-1px); box-shadow: 0 12px 40px rgba(255, 107, 26, 0.45); }
        .lock-error {
          color: #FF8438; font-size: 13px; font-style: italic;
          font-family: 'Cormorant Garamond', serif; margin-top: 18px; height: 16px;
        }
        .lock-foot {
          margin-top: 40px;
          font-size: 11px;
          color: #6B5749;
          font-style: italic;
          font-family: 'Cormorant Garamond', serif;
          letter-spacing: 0.04em;
        }
      `}</style>
      <div className="lock-bg">
        <div className="lock-sun" />

        {/* Dune silhouettes */}
        <svg className="lock-dunes" viewBox="0 0 1200 200" preserveAspectRatio="none">
          <path d="M 0 200 L 0 130 Q 200 90 400 110 Q 600 130 800 100 Q 1000 75 1200 105 L 1200 200 Z" fill="#150905" opacity="0.95"/>
          <path d="M 0 200 L 0 165 Q 250 140 500 155 Q 750 170 1000 145 Q 1100 135 1200 150 L 1200 200 Z" fill="#0A0503"/>
        </svg>

        {/* Giraffe silhouettes on the dunes */}
        <div className="lock-giraffe left">
          <Giraffe size={64} />
        </div>
        <div className="lock-giraffe right">
          <Giraffe size={48} opacity={0.85} />
        </div>

        <div className="lock-card">
          <div className="lock-mark">{config.year}</div>
          <h1 className="lock-title">
            {config.eventName.split(' ').slice(0, -1).join(' ')}{' '}
            <em>{config.eventName.split(' ').slice(-1)[0]}</em>
          </h1>
          {config.tagline && <div className="lock-sub">{config.tagline}</div>}
          {(config.dates || config.location) && (
            <div className="lock-where">{[config.dates, config.location].filter(Boolean).join(' · ')}</div>
          )}
          <input
            className={`lock-input ${error ? 'error' : ''}`}
            type="password"
            value={pw}
            onChange={e => { setPw(e.target.value); setError(false); }}
            onKeyDown={e => { if (e.key === 'Enter') tryUnlock(); }}
            placeholder="Access password"
            autoFocus
          />
          <button className="lock-btn" onClick={tryUnlock}>Enter</button>
          <div className="lock-error">{error ? 'That password isn\u2019t right.' : ''}</div>
          <div className="lock-foot">Contact your organizer for the password</div>
        </div>
      </div>
    </>
  );
}

// ============================================================
// HOME
// ============================================================

function Home({ config, setPage, me }) {
  return (
    <div className="ev-hero">
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20, color: '#FF8438' }}>
        <Giraffe size={56} opacity={0.9} />
      </div>
      <div style={{ marginBottom: 24 }}>
        <span className="ev-pill orange">{config.year} Edition</span>
      </div>
      <h1 className="ev-display">
        {config.eventName.split(' ').slice(0, -1).join(' ')}{' '}
        <em className="ev-italic">{config.eventName.split(' ').slice(-1)[0]}</em>
      </h1>
      {config.tagline && <div className="tagline">{config.tagline}</div>}
      {(config.dates || config.location) && (
        <div className="meta">{[config.dates, config.location].filter(Boolean).join(' · ')}</div>
      )}
      {config.description && <p className="lead">{config.description}</p>}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        {!me?.applied ? (
          <button className="ev-btn ev-btn-primary" onClick={() => setPage('apply')}>
            RSVP & Apply →
          </button>
        ) : (
          <button className="ev-btn ev-btn-primary" onClick={() => setPage('shifts')}>
            Sign Up for Shifts →
          </button>
        )}
        <button className="ev-btn ev-btn-ghost" onClick={() => setPage('packing')}>
          What to Pack
        </button>
      </div>

      {me?.applied && (
        <div style={{ marginTop: 48, color: '#C8956C', fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic', fontSize: 19 }}>
          Welcome back, {me.name.split(' ')[0]}.
        </div>
      )}
    </div>
  );
}

// ============================================================
// APPLY
// ============================================================

function Apply({ config, me, updateMe, applications, updateApplications, setPage }) {
  const [name, setName] = useState(me?.name || '');
  const [email, setEmail] = useState(me?.email || '');
  const [phone, setPhone] = useState(me?.phone || '');
  const [emergency, setEmergency] = useState(me?.emergency || '');
  const [notes, setNotes] = useState(me?.notes || '');
  const [agreed, setAgreed] = useState(config.agreements.map(() => false));
  const [submitted, setSubmitted] = useState(me?.applied || false);

  const allAgreed = agreed.every(Boolean);
  const filled = name.trim() && email.trim() && phone.trim() && emergency.trim();
  const canSubmit = allAgreed && filled && config.applicationsOpen;

  async function submit() {
    const userId = me?.id || newId();
    const userObj = { id: userId, name, email, phone, emergency, notes, applied: true, appliedAt: new Date().toISOString() };
    await updateMe(userObj);
    const newApps = applications.filter(a => a.id !== userId).concat([userObj]);
    await updateApplications(newApps);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div>
        <h2 className="ev-section-title">You're in.</h2>
        <p className="ev-section-sub">RSVP received — see you at the gathering.</p>
        <div className="ev-success">
          We've got your application, {name.split(' ')[0]}. Next step: <strong>sign up for {config.shiftRequirement} shifts</strong>.
        </div>
        <button className="ev-btn ev-btn-primary" onClick={() => setPage('shifts')}>
          Pick Your Shifts →
        </button>
        <button className="ev-btn ev-btn-ghost" style={{ marginLeft: 8 }} onClick={() => setSubmitted(false)}>
          Edit info
        </button>
      </div>
    );
  }

  if (!config.applicationsOpen) {
    return (
      <div>
        <h2 className="ev-section-title">Applications closed</h2>
        <p className="ev-section-sub">RSVPs aren't being accepted right now. Check back soon.</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="ev-section-title">Apply & RSVP</h2>
      <p className="ev-section-sub">A few quick details, three boxes to check, and you're set.</p>

      <div className="ev-card">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ gridColumn: 'span 2' }}>
            <label className="ev-label">Full name</label>
            <input className="ev-input" value={name} onChange={e => setName(e.target.value)} placeholder="Jordan Rivera" />
          </div>
          <div>
            <label className="ev-label">Email</label>
            <input className="ev-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div>
            <label className="ev-label">Phone</label>
            <input className="ev-input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 123-4567" />
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <label className="ev-label">Emergency contact (name & phone)</label>
            <input className="ev-input" value={emergency} onChange={e => setEmergency(e.target.value)} placeholder="Sam Rivera, (555) 987-6543" />
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <label className="ev-label">Anything we should know? (dietary, accessibility, etc.)</label>
            <textarea className="ev-textarea" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" />
          </div>
        </div>
      </div>

      <div className="ev-card">
        <div style={{ marginBottom: 12, fontFamily: 'Fraunces, serif', fontSize: 18, fontWeight: 500 }}>Before you submit, please confirm:</div>
        {config.agreements.map((text, i) => (
          <label key={i} className="ev-check">
            <input type="checkbox" checked={agreed[i]} onChange={e => {
              const next = [...agreed]; next[i] = e.target.checked; setAgreed(next);
            }} />
            <span>{text}</span>
          </label>
        ))}
      </div>

      <button className="ev-btn ev-btn-primary" disabled={!canSubmit} onClick={submit}>
        Submit Application
      </button>
      {!filled && <span style={{ marginLeft: 12, color: '#8A8270', fontSize: 13 }}>Fill in all required fields</span>}
      {filled && !allAgreed && <span style={{ marginLeft: 12, color: '#8A8270', fontSize: 13 }}>Confirm all agreements</span>}
    </div>
  );
}

// ============================================================
// SHIFTS
// ============================================================

function Shifts({ shifts, updateShifts, me, requirement, setPage }) {
  if (!me?.applied) {
    return (
      <div>
        <h2 className="ev-section-title">Shift Sign-Up</h2>
        <p className="ev-section-sub">You'll need to RSVP first before claiming shifts.</p>
        <button className="ev-btn ev-btn-primary" onClick={() => setPage('apply')}>Go to RSVP →</button>
      </div>
    );
  }

  const myShifts = shifts.filter(s => s.signups.some(u => u.userId === me.id));
  const myCount = myShifts.length;
  const remaining = Math.max(0, requirement - myCount);

  async function toggle(shiftId) {
    const next = shifts.map(s => {
      if (s.id !== shiftId) return s;
      const has = s.signups.some(u => u.userId === me.id);
      if (has) return { ...s, signups: s.signups.filter(u => u.userId !== me.id) };
      if (s.signups.length >= s.capacity) return s; // full
      if (myCount >= requirement) return s; // already at requirement
      return { ...s, signups: [...s.signups, { userId: me.id, name: me.name }] };
    });
    await updateShifts(next);
  }

  // group by day
  const days = [...new Set(shifts.map(s => s.day))];

  return (
    <div>
      <h2 className="ev-section-title">Pick Your Shifts</h2>
      <p className="ev-section-sub">
        Each person signs up for <strong>{requirement} shifts</strong> across the weekend. You've claimed {myCount}.
      </p>

      <div className="ev-card ev-card-tight" style={{
        background: remaining === 0 ? '#D9E4D6' : '#FFFCF4',
        borderColor: remaining === 0 ? '#3D5A40' : '#E5DFD0'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontFamily: 'Fraunces, serif', fontSize: 18 }}>
            {remaining === 0 ? <>✓ All set — you have your {requirement} shifts.</> :
              <>Need <strong>{remaining}</strong> more shift{remaining === 1 ? '' : 's'}.</>}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {Array.from({ length: requirement }).map((_, i) => (
              <div key={i} style={{
                width: 14, height: 14, borderRadius: '50%',
                background: i < myCount ? '#3D5A40' : 'transparent',
                border: '1px solid #3D5A40'
              }} />
            ))}
          </div>
        </div>
      </div>

      {days.map(day => (
        <div key={day}>
          <div className="ev-day-heading">{day}</div>
          {shifts.filter(s => s.day === day).map(s => {
            const mine = s.signups.some(u => u.userId === me.id);
            const full = s.signups.length >= s.capacity;
            const atLimit = myCount >= requirement && !mine;
            return (
              <div key={s.id} className={`ev-shift ${mine ? 'mine' : ''} ${full && !mine ? 'full' : ''}`}>
                <div className="ev-shift-meta">
                  <div className="ev-shift-name">{s.name}</div>
                  <div className="ev-shift-when">{s.time}</div>
                  <div className="ev-shift-cap">{s.signups.length} / {s.capacity} signed up</div>
                </div>
                <div className="ev-shift-actions">
                  {mine ? (
                    <>
                      <span className="ev-pill green">You're on this</span>
                      <button className="ev-btn ev-btn-ghost ev-btn-small" onClick={() => toggle(s.id)}>Remove</button>
                    </>
                  ) : full ? (
                    <span className="ev-pill">Full</span>
                  ) : atLimit ? (
                    <span className="ev-pill">Limit reached</span>
                  ) : (
                    <button className="ev-btn ev-btn-accent ev-btn-small" onClick={() => toggle(s.id)}>Claim</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ============================================================
// RESOURCES
// ============================================================

function Resources({ resources }) {
  return (
    <div>
      <h2 className="ev-section-title">Resources</h2>
      <p className="ev-section-sub">Maps, schedules, and everything else you'll want before you arrive.</p>
      {resources.length === 0 && <p style={{ color: '#8A8270' }}>No resources posted yet.</p>}
      {resources.map(r => (
        <div key={r.id} className="ev-resource">
          <div
            className="ev-resource-icon"
            style={r.kind === 'image' && r.url && r.url !== '#' ? { backgroundImage: `url(${r.url})` } : {}}
          >
            {(!r.url || r.url === '#' || r.kind !== 'image') && (r.kind === 'pdf' ? 'PDF' : r.kind === 'image' ? 'IMG' : 'FILE')}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Fraunces, serif', fontSize: 18, fontWeight: 500 }}>{r.name}</div>
            <div style={{ fontSize: 14, color: '#6E6755' }}>{r.description}</div>
          </div>
          {r.url && r.url !== '#' ? (
            <a href={r.url} target="_blank" rel="noopener noreferrer" className="ev-btn ev-btn-ghost ev-btn-small">
              {r.kind === 'image' ? 'View' : 'Download'}
            </a>
          ) : (
            <span className="ev-pill">Coming soon</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================
// PACKING
// ============================================================

function Packing({ items, checks, updateChecks }) {
  const checkedCount = items.filter((_, i) => checks[i]).length;

  async function toggle(i) {
    const next = { ...checks, [i]: !checks[i] };
    await updateChecks(next);
  }

  return (
    <div>
      <h2 className="ev-section-title">What to Pack</h2>
      <p className="ev-section-sub">Check things off as you go. We'll remember your list on this device.</p>
      <div className="ev-card ev-card-tight" style={{ marginBottom: 16, fontFamily: 'Fraunces, serif', fontSize: 18 }}>
        {checkedCount} of {items.length} packed
        <div style={{ height: 6, background: '#EFE9DA', borderRadius: 999, marginTop: 8, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${(checkedCount / items.length) * 100}%`,
            background: '#3D5A40',
            transition: 'width 0.3s ease'
          }} />
        </div>
      </div>
      <div className="ev-card">
        {items.map((it, i) => (
          <label key={i} className="ev-pack-row" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={!!checks[i]} onChange={() => toggle(i)} />
            <span className={checks[i] ? 'checked' : ''}>{it}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// ADMIN
// ============================================================

function Admin({ isAdmin, setIsAdmin, config, updateConfig, shifts, updateShifts,
                  packingItems, updatePacking, resources, updateResources,
                  applications, updateApplications }) {
  const [pw, setPw] = useState('');
  const [section, setSection] = useState('event');

  if (!isAdmin) {
    return (
      <div>
        <h2 className="ev-section-title">Admin</h2>
        <p className="ev-section-sub">Restricted area. Enter the admin password to continue.</p>
        <div className="ev-card" style={{ maxWidth: 400 }}>
          <label className="ev-label">Password</label>
          <input
            className="ev-input"
            type="password"
            value={pw}
            onChange={e => setPw(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && pw === config.adminPassword) setIsAdmin(true); }}
          />
          <button className="ev-btn ev-btn-primary" style={{ marginTop: 12 }} onClick={() => {
            if (pw === config.adminPassword) setIsAdmin(true);
            else alert('Incorrect password');
          }}>Unlock</button>
          <div style={{ marginTop: 16, fontSize: 13, color: '#8A7060', fontStyle: 'italic', fontFamily: 'Cormorant Garamond, serif' }}>
            Default password: <code style={{ color: '#FFB627' }}>admin123</code> — change it in Event Settings after you log in.
          </div>
        </div>
      </div>
    );
  }

  const sections = [
    ['event', 'Event'],
    ['shifts', 'Shifts'],
    ['apps', 'Applications'],
    ['resources', 'Resources'],
    ['packing', 'Packing List'],
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h2 className="ev-section-title">Admin</h2>
        <button className="ev-btn ev-btn-ghost ev-btn-small" onClick={() => setIsAdmin(false)}>Lock</button>
      </div>
      <div className="ev-nav" style={{ marginBottom: 24 }}>
        {sections.map(([k, l]) => (
          <button key={k} onClick={() => setSection(k)} className={section === k ? 'active' : ''}>{l}</button>
        ))}
      </div>

      {section === 'event' && <AdminEvent config={config} updateConfig={updateConfig} />}
      {section === 'shifts' && <AdminShifts shifts={shifts} updateShifts={updateShifts} />}
      {section === 'apps' && <AdminApps applications={applications} updateApplications={updateApplications} />}
      {section === 'resources' && <AdminResources resources={resources} updateResources={updateResources} />}
      {section === 'packing' && <AdminPacking items={packingItems} updatePacking={updatePacking} />}
    </div>
  );
}

function AdminEvent({ config, updateConfig }) {
  const [c, setC] = useState(config);
  useEffect(() => setC(config), [config]);
  const set = (k, v) => setC({ ...c, [k]: v });
  const setAgreement = (i, v) => { const a = [...c.agreements]; a[i] = v; setC({ ...c, agreements: a }); };
  return (
    <div className="ev-admin-section">
      <h3>Event Settings</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div><label className="ev-label">Event Name</label><input className="ev-input" value={c.eventName} onChange={e => set('eventName', e.target.value)} /></div>
        <div><label className="ev-label">Tagline</label><input className="ev-input" value={c.tagline} onChange={e => set('tagline', e.target.value)} /></div>
        <div><label className="ev-label">Year</label><input className="ev-input" type="number" value={c.year} onChange={e => set('year', +e.target.value)} /></div>
        <div><label className="ev-label">Dates</label><input className="ev-input" value={c.dates} onChange={e => set('dates', e.target.value)} /></div>
        <div style={{ gridColumn: 'span 2' }}><label className="ev-label">Location</label><input className="ev-input" value={c.location} onChange={e => set('location', e.target.value)} /></div>
        <div style={{ gridColumn: 'span 2' }}><label className="ev-label">Description</label><textarea className="ev-textarea" value={c.description} onChange={e => set('description', e.target.value)} /></div>
        <div><label className="ev-label">Shifts Required Per Person</label><input className="ev-input" type="number" min="1" value={c.shiftRequirement} onChange={e => set('shiftRequirement', +e.target.value)} /></div>
        <div><label className="ev-label">Admin Password</label><input className="ev-input" value={c.adminPassword} onChange={e => set('adminPassword', e.target.value)} /></div>
        <div style={{ gridColumn: 'span 2' }}><label className="ev-label">Event Access Password (gate to enter app)</label><input className="ev-input" value={c.eventPassword} onChange={e => set('eventPassword', e.target.value)} /></div>
        <div style={{ gridColumn: 'span 2' }}>
          <label className="ev-check">
            <input type="checkbox" checked={c.applicationsOpen} onChange={e => set('applicationsOpen', e.target.checked)} />
            <span>Applications open (uncheck to close RSVP)</span>
          </label>
        </div>
      </div>
      <div style={{ marginTop: 16 }}>
        <label className="ev-label">Required Agreements (checkboxes shown on application)</label>
        {c.agreements.map((a, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
            <input className="ev-input" value={a} onChange={e => setAgreement(i, e.target.value)} />
            <button className="ev-btn ev-btn-ghost ev-btn-small" onClick={() => setC({ ...c, agreements: c.agreements.filter((_, j) => j !== i) })}>×</button>
          </div>
        ))}
        <button className="ev-btn ev-btn-ghost ev-btn-small" onClick={() => setC({ ...c, agreements: [...c.agreements, 'New agreement…'] })}>+ Add agreement</button>
      </div>
      <div style={{ marginTop: 20 }}>
        <button className="ev-btn ev-btn-primary" onClick={() => updateConfig(c)}>Save changes</button>
      </div>
    </div>
  );
}

function AdminShifts({ shifts, updateShifts }) {
  const [list, setList] = useState(shifts);
  useEffect(() => setList(shifts), [shifts]);

  const update = (i, k, v) => { const next = [...list]; next[i] = { ...next[i], [k]: v }; setList(next); };
  const remove = (i) => setList(list.filter((_, j) => j !== i));
  const add = () => setList([...list, { id: 's' + Date.now(), name: 'New Shift', day: 'Friday', time: '12:00–2:00 pm', capacity: 4, signups: [] }]);

  return (
    <div className="ev-admin-section">
      <h3>Shift Layout</h3>
      <p style={{ marginTop: -10, color: '#6E6755', fontSize: 14 }}>Define the shifts participants can sign up for. Capacity caps the number of sign-ups.</p>

      <div className="ev-admin-row" style={{ fontWeight: 600, fontSize: 12, color: '#4F5A52', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        <div>Name</div><div>Day</div><div>Time</div><div>Cap</div><div></div>
      </div>
      {list.map((s, i) => (
        <div key={s.id} className="ev-admin-row">
          <input className="ev-input" value={s.name} onChange={e => update(i, 'name', e.target.value)} />
          <input className="ev-input" value={s.day} onChange={e => update(i, 'day', e.target.value)} />
          <input className="ev-input" value={s.time} onChange={e => update(i, 'time', e.target.value)} />
          <input className="ev-input" type="number" min="1" value={s.capacity} onChange={e => update(i, 'capacity', +e.target.value)} />
          <button className="ev-btn ev-btn-ghost ev-btn-small" onClick={() => remove(i)}>×</button>
        </div>
      ))}
      <button className="ev-btn ev-btn-ghost ev-btn-small" onClick={add} style={{ marginTop: 8 }}>+ Add shift</button>

      <div style={{ marginTop: 20 }}>
        <button className="ev-btn ev-btn-primary" onClick={() => updateShifts(list)}>Save shifts</button>
      </div>

      <div className="ev-divider" />
      <h3 style={{ fontSize: 18 }}>Current sign-ups</h3>
      {shifts.map(s => (
        <div key={s.id} style={{ marginBottom: 10 }}>
          <strong>{s.name}</strong> <span style={{ color: '#8A8270' }}>({s.day}, {s.time}) — {s.signups.length}/{s.capacity}</span>
          {s.signups.length > 0 && (
            <div style={{ fontSize: 14, marginLeft: 12, color: '#4F5A52' }}>
              {s.signups.map(u => u.name).join(', ')}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function AdminApps({ applications, updateApplications }) {
  function exportCsv() {
    const rows = [['Name', 'Email', 'Phone', 'Emergency Contact', 'Notes', 'Applied At']];
    applications.forEach(a => rows.push([a.name, a.email, a.phone, a.emergency, (a.notes || '').replace(/\n/g, ' '), a.appliedAt]));
    const csv = rows.map(r => r.map(c => `"${(c || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'applications.csv';
    a.click();
  }

  return (
    <div className="ev-admin-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <h3>Applications ({applications.length})</h3>
        <button className="ev-btn ev-btn-ghost ev-btn-small" onClick={exportCsv} disabled={applications.length === 0}>Export CSV</button>
      </div>
      {applications.length === 0 && <p style={{ color: '#8A7060' }}>No applications yet.</p>}
      {applications.map(a => (
        <div key={a.id} style={{ background: '#0F0805', border: '1px solid #2A1810', borderRadius: 8, padding: 14, marginBottom: 10 }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 500, fontSize: 19, color: '#FBF0E0' }}>{a.name}</div>
          <div style={{ fontSize: 14, color: '#C8956C' }}>{a.email} · {a.phone}</div>
          <div style={{ fontSize: 13, color: '#A88876', marginTop: 4 }}>Emergency: {a.emergency}</div>
          {a.notes && <div style={{ fontSize: 13, color: '#A88876', marginTop: 4, fontStyle: 'italic' }}>"{a.notes}"</div>}
          <div style={{ fontSize: 12, color: '#6B5749', marginTop: 6 }}>Submitted {new Date(a.appliedAt).toLocaleString()}</div>
        </div>
      ))}
    </div>
  );
}

function AdminResources({ resources, updateResources }) {
  const [list, setList] = useState(resources);
  useEffect(() => setList(resources), [resources]);
  const update = (i, k, v) => { const next = [...list]; next[i] = { ...next[i], [k]: v }; setList(next); };
  const remove = (i) => setList(list.filter((_, j) => j !== i));
  const add = () => setList([...list, { id: 'r' + Date.now(), name: 'New file', kind: 'pdf', url: '', description: '' }]);

  return (
    <div className="ev-admin-section">
      <h3>Resources</h3>
      <p style={{ marginTop: -10, color: '#6E6755', fontSize: 14 }}>Paste URLs to PDFs or images hosted anywhere (Dropbox, Google Drive share links, Imgur, etc.).</p>
      {list.map((r, i) => (
        <div key={r.id} style={{ background: '#0F0805', border: '1px solid #2A1810', padding: 14, borderRadius: 8, marginBottom: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 60px', gap: 8, marginBottom: 8 }}>
            <input className="ev-input" placeholder="Name" value={r.name} onChange={e => update(i, 'name', e.target.value)} />
            <select className="ev-select" value={r.kind} onChange={e => update(i, 'kind', e.target.value)}>
              <option value="pdf">PDF</option>
              <option value="image">Image</option>
              <option value="other">Other</option>
            </select>
            <button className="ev-btn ev-btn-ghost ev-btn-small" onClick={() => remove(i)}>×</button>
          </div>
          <input className="ev-input" placeholder="URL" value={r.url} onChange={e => update(i, 'url', e.target.value)} style={{ marginBottom: 8 }} />
          <input className="ev-input" placeholder="Description" value={r.description} onChange={e => update(i, 'description', e.target.value)} />
        </div>
      ))}
      <button className="ev-btn ev-btn-ghost ev-btn-small" onClick={add}>+ Add resource</button>
      <div style={{ marginTop: 20 }}>
        <button className="ev-btn ev-btn-primary" onClick={() => updateResources(list)}>Save resources</button>
      </div>
    </div>
  );
}

function AdminPacking({ items, updatePacking }) {
  const [list, setList] = useState(items);
  useEffect(() => setList(items), [items]);
  const update = (i, v) => { const next = [...list]; next[i] = v; setList(next); };
  const remove = (i) => setList(list.filter((_, j) => j !== i));
  const add = () => setList([...list, 'New item']);

  return (
    <div className="ev-admin-section">
      <h3>Packing List</h3>
      {list.map((it, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
          <input className="ev-input" value={it} onChange={e => update(i, e.target.value)} />
          <button className="ev-btn ev-btn-ghost ev-btn-small" onClick={() => remove(i)}>×</button>
        </div>
      ))}
      <button className="ev-btn ev-btn-ghost ev-btn-small" onClick={add}>+ Add item</button>
      <div style={{ marginTop: 20 }}>
        <button className="ev-btn ev-btn-primary" onClick={() => updatePacking(list)}>Save list</button>
      </div>
    </div>
  );
}
