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
  adminPassword: "Thunderfuck",
  eventPassword: "hospitable",
  applicationsOpen: true,
  applicationsSheet: '',
  rsvpSheet: '',
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

const DEFAULT_CALENDAR = [
  { id: 'c1', date: 'Aug 1 at 5pm', label: 'Shift sign-ups open' },
  { id: 'c2', date: 'Aug 26', label: 'Early crew starts arriving' },
  { id: 'c3', date: 'Aug 30th', label: 'The Gates Open / Burningman Starts' },
  { id: 'c6', date: 'September 7th', label: 'Burningman Ends!' },
  { id: 'c4', date: 'Sept 5', label: 'The Man Burns' },
  { id: 'c5', date: 'Sept 6', label: 'The Temple Burns' },
];

// ============================================================
// STORAGE HELPERS
// ============================================================

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
// INJECT CSS
// ============================================================

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Inter:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: #100804;
    color: #FBF0E0;
    font-family: 'Inter', system-ui, sans-serif;
    min-height: 100vh;
  }

  /* --- NAV --- */
  .ev-nav {
    position: sticky; top: 0; z-index: 100;
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 28px;
    height: 52px;
    background: rgba(10,5,2,0.92);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid #1E100A;
  }
  .ev-nav-brand {
    font-family: 'Cormorant Garamond', serif;
    font-size: 18px; font-weight: 500; letter-spacing: .03em;
    color: #FBF0E0; text-decoration: none;
    cursor: pointer;
  }
  .ev-nav-tabs { display: flex; align-items: center; gap: 2px; }
  .ev-nav-tab {
    padding: 6px 14px; border-radius: 20px; border: none;
    background: transparent; color: #A88876;
    font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 500;
    cursor: pointer; transition: color .15s, background .15s;
  }
  .ev-nav-tab:hover { color: #FBF0E0; background: #1A0E08; }
  .ev-nav-tab.active { background: #C8956C; color: #100804; }
  .ev-nav-lock {
    background: none; border: none; cursor: pointer;
    color: #6B5749; font-size: 16px; padding: 6px; transition: color .15s;
  }
  .ev-nav-lock:hover { color: #C8956C; }

  /* --- PAGE WRAPPER --- */
  .ev-page { max-width: 720px; margin: 0 auto; padding: 48px 24px 80px; }
  .ev-page-wide { max-width: 900px; margin: 0 auto; padding: 48px 24px 80px; }

  /* --- BUTTONS --- */
  .ev-btn {
    display: inline-flex; align-items: center; justify-content: center;
    gap: 6px; padding: 10px 22px; border-radius: 100px;
    font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 500;
    cursor: pointer; border: none; transition: opacity .15s, transform .1s;
  }
  .ev-btn:active { transform: scale(.97); }
  .ev-btn-primary {
    background: linear-gradient(135deg, #D4894E, #C06830);
    color: #100804;
  }
  .ev-btn-primary:hover { opacity: .9; }
  .ev-btn-ghost {
    background: transparent;
    border: 1px solid #3A2010;
    color: #C8956C;
  }
  .ev-btn-ghost:hover { border-color: #C8956C; color: #FBF0E0; }
  .ev-btn-dark {
    background: #1A0E08;
    border: 1px solid #2A1810;
    color: #FBF0E0;
  }
  .ev-btn-dark:hover { background: #231208; }
  .ev-btn-small { padding: 6px 14px; font-size: 12px; }
  .ev-btn:disabled { opacity: .4; cursor: not-allowed; }

  /* --- FORM ELEMENTS --- */
  .ev-input, .ev-select, .ev-textarea {
    width: 100%; padding: 10px 14px;
    background: #0F0805; border: 1px solid #2A1810; border-radius: 8px;
    color: #FBF0E0; font-family: 'Inter', sans-serif; font-size: 14px;
    outline: none; transition: border-color .15s;
  }
  .ev-input:focus, .ev-select:focus, .ev-textarea:focus { border-color: #C8956C; }
  .ev-input::placeholder, .ev-textarea::placeholder { color: #4A3020; }
  .ev-textarea { resize: vertical; min-height: 80px; }
  .ev-select option { background: #1A0E08; }
  .ev-label {
    display: block; font-size: 13px; color: #A88876;
    margin-bottom: 6px; font-weight: 500;
  }
  .ev-field { margin-bottom: 16px; }

  /* --- CARDS --- */
  .ev-card {
    background: #0F0805; border: 1px solid #1E100A;
    border-radius: 12px; padding: 20px;
    margin-bottom: 12px;
  }

  /* --- ADMIN --- */
  .ev-admin-section { margin-bottom: 40px; }
  .ev-admin-section h3 {
    font-family: 'Cormorant Garamond', serif;
    font-size: 22px; font-weight: 500; color: #FBF0E0;
    margin-bottom: 16px; padding-bottom: 8px;
    border-bottom: 1px solid #1E100A;
  }
  .ev-admin-tabs { display: flex; gap: 8px; margin-bottom: 32px; flex-wrap: wrap; }
  .ev-admin-tab {
    padding: 8px 18px; border-radius: 20px; border: 1px solid #2A1810;
    background: transparent; color: #A88876;
    font-size: 13px; font-weight: 500; cursor: pointer; transition: all .15s;
  }
  .ev-admin-tab.active { background: #1E100A; border-color: #C8956C; color: #FBF0E0; }

  /* --- MODAL --- */
  .ev-modal-backdrop {
    position: fixed; inset: 0; z-index: 200;
    background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center;
    padding: 24px;
  }
  .ev-modal {
    background: #1A0E08; border: 1px solid #3A2010;
    border-radius: 16px; padding: 36px; max-width: 420px; width: 100%;
    text-align: center;
  }
  .ev-modal h2 {
    font-family: 'Cormorant Garamond', serif;
    font-size: 26px; font-weight: 500; color: #FBF0E0; margin-bottom: 12px;
  }
  .ev-modal p { color: #A88876; font-size: 15px; line-height: 1.6; margin-bottom: 24px; }

  /* --- LOCK SCREEN --- */
  .ev-lock {
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
    padding: 24px; background: radial-gradient(ellipse at 50% 30%, #1E0E06 0%, #100804 70%);
  }
  .ev-lock-box { text-align: center; max-width: 340px; width: 100%; }
  .ev-lock-box h1 {
    font-family: 'Cormorant Garamond', serif;
    font-size: 36px; font-weight: 400; color: #FBF0E0; margin: 16px 0 6px;
  }
  .ev-lock-box p { color: #6B5749; font-size: 13px; margin-bottom: 28px; }

  /* --- HOME --- */
  .ev-hero {
    min-height: calc(100vh - 52px);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    text-align: center; padding: 48px 24px;
    background: radial-gradient(ellipse at 50% 40%, #1C0E06 0%, #100804 65%);
  }
  .ev-hero-badge {
    display: inline-block; padding: 4px 14px; border-radius: 20px;
    background: #C8956C; color: #100804;
    font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase;
    margin-bottom: 20px;
  }
  .ev-hero h1 {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(52px, 8vw, 88px); font-weight: 400; line-height: 1;
    color: #FBF0E0; margin-bottom: 6px;
  }
  .ev-hero h1 em { color: #C8956C; font-style: italic; }
  .ev-hero-tagline {
    color: #6B5749; font-style: italic;
    font-family: 'Cormorant Garamond', serif; font-size: 16px;
    margin-top: 32px;
  }
  .ev-hero-desc {
    max-width: 480px; color: #A88876; font-size: 15px; line-height: 1.7;
    margin: 16px auto 0;
  }
  .ev-hero-meta {
    margin-top: 20px; display: flex; gap: 20px; justify-content: center;
    flex-wrap: wrap; color: #6B5749; font-size: 13px;
  }
  .ev-hero-meta span { display: flex; align-items: center; gap: 6px; }
  .ev-hero-actions { display: flex; gap: 12px; margin-top: 36px; flex-wrap: wrap; justify-content: center; }

  /* --- FORM PAGE --- */
  .ev-form-header { margin-bottom: 32px; }
  .ev-form-header h1 {
    font-family: 'Cormorant Garamond', serif;
    font-size: 38px; font-weight: 400; color: #FBF0E0; margin-bottom: 8px;
  }
  .ev-form-header p { color: #A88876; font-size: 14px; line-height: 1.6; }

  /* --- SHIFTS --- */
  .ev-shifts-notice {
    background: #0F0805; border: 1px solid #2A1810; border-radius: 12px;
    padding: 28px 24px; text-align: center; margin-bottom: 24px;
  }
  .ev-shifts-notice h2 {
    font-family: 'Cormorant Garamond', serif;
    font-size: 26px; font-weight: 400; color: #FBF0E0; margin-bottom: 10px;
  }
  .ev-shifts-notice p { color: #A88876; font-size: 14px; line-height: 1.6; }
  .ev-shift-card {
    background: #0F0805; border: 1px solid #1E100A; border-radius: 10px;
    padding: 16px 20px; margin-bottom: 10px;
    display: flex; align-items: center; justify-content: space-between; gap: 16px;
  }
  .ev-shift-info h3 { font-size: 15px; font-weight: 500; color: #FBF0E0; margin-bottom: 2px; }
  .ev-shift-info p { font-size: 13px; color: #6B5749; }
  .ev-shift-meta { font-size: 12px; color: #A88876; white-space: nowrap; }

  /* --- RESOURCES --- */
  .ev-resource-card {
    background: #0F0805; border: 1px solid #1E100A; border-radius: 10px;
    padding: 16px 20px; margin-bottom: 10px;
    display: flex; align-items: center; justify-content: space-between; gap: 16px;
    text-decoration: none; transition: border-color .15s;
  }
  .ev-resource-card:hover { border-color: #3A2010; }
  .ev-resource-info h3 { font-size: 15px; font-weight: 500; color: #FBF0E0; margin-bottom: 2px; }
  .ev-resource-info p { font-size: 13px; color: #6B5749; }
  .ev-resource-kind {
    font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase;
    color: #C8956C; white-space: nowrap;
  }

  /* --- PACKING --- */
  .ev-packing-item {
    display: flex; align-items: center; gap: 12px;
    padding: 12px 16px; border-radius: 8px; cursor: pointer;
    transition: background .1s; margin-bottom: 4px;
  }
  .ev-packing-item:hover { background: #0F0805; }
  .ev-packing-item input[type=checkbox] { width: 16px; height: 16px; accent-color: #C8956C; cursor: pointer; }
  .ev-packing-item span { font-size: 14px; color: #FBF0E0; line-height: 1.4; }
  .ev-packing-item.checked span { text-decoration: line-through; color: #4A3020; }

  /* --- DATES --- */
  .ev-dates-year {
    font-family: 'Cormorant Garamond', serif;
    font-size: 32px; font-weight: 400; color: #FBF0E0; margin-bottom: 24px;
  }
  .ev-date-row {
    display: flex; align-items: baseline; gap: 16px;
    padding: 14px 0; border-bottom: 1px solid #1A0C06;
  }
  .ev-date-date {
    font-family: 'Cormorant Garamond', serif;
    font-size: 18px; color: #C8956C; min-width: 80px; flex-shrink: 0;
  }
  .ev-date-label { font-size: 14px; color: #FBF0E0; }

  /* --- SECTION HEADING --- */
  .ev-section-h {
    font-family: 'Cormorant Garamond', serif;
    font-size: 32px; font-weight: 400; color: #FBF0E0; margin-bottom: 8px;
  }
  .ev-section-sub { color: #6B5749; font-size: 14px; margin-bottom: 28px; }

  /* --- AGREEMENT --- */
  .ev-agreement {
    display: flex; align-items: flex-start; gap: 10px;
    margin-bottom: 12px;
  }
  .ev-agreement input[type=checkbox] { margin-top: 2px; accent-color: #C8956C; flex-shrink: 0; }
  .ev-agreement span { font-size: 13px; color: #A88876; line-height: 1.5; }
`;

function InjectCSS() {
  useEffect(() => {
    const el = document.createElement('style');
    el.textContent = CSS;
    document.head.appendChild(el);
    return () => document.head.removeChild(el);
  }, []);
  return null;
}

// ============================================================
// LOCK SCREEN
// ============================================================

function LockScreen({ config, onUnlock }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState(false);

  const attempt = () => {
    if (pw === config.eventPassword) {
      onUnlock();
    } else {
      setErr(true);
      setPw('');
      setTimeout(() => setErr(false), 1500);
    }
  };

  return (
    <div className="ev-lock">
      <div className="ev-lock-box">
        <div style={{ color: '#C8956C', marginBottom: 8 }}>
          <Giraffe size={60} />
        </div>
        <h1>{config.eventName}</h1>
        <p>Contact your organizer for the password</p>
        <div className="ev-field">
          <input
            className="ev-input"
            type="password"
            placeholder="Password"
            value={pw}
            onChange={e => setPw(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && attempt()}
            style={{ textAlign: 'center', borderColor: err ? '#8B3020' : undefined }}
            autoFocus
          />
          {err && <p style={{ color: '#8B3020', fontSize: 13, marginTop: 6, textAlign: 'center' }}>Incorrect password</p>}
        </div>
        <button className="ev-btn ev-btn-primary" style={{ width: '100%' }} onClick={attempt}>
          Enter
        </button>
      </div>
    </div>
  );
}

// ============================================================
// SUCCESS MODAL
// ============================================================

function SuccessModal({ message, subMessage, onClose }) {
  return (
    <div className="ev-modal-backdrop" onClick={onClose}>
      <div className="ev-modal" onClick={e => e.stopPropagation()}>
        <div style={{ color: '#C8956C', marginBottom: 16 }}>
          <Giraffe size={48} />
        </div>
        <h2>{message}</h2>
        <p>{subMessage}</p>
        <button className="ev-btn ev-btn-primary" onClick={onClose} style={{ width: '100%' }}>
          Close
        </button>
      </div>
    </div>
  );
}

// ============================================================
// HOME PAGE
// ============================================================

function HomePage({ config, setPage }) {
  return (
    <div className="ev-hero">
      <div style={{ color: '#C8956C' }}>
        <Giraffe size={64} />
      </div>
      {config.year && (
        <div className="ev-hero-badge">{config.year} Edition</div>
      )}
      <h1>
        {config.eventName.split(' ').map((w, i) => (
          i === config.eventName.split(' ').length - 1
            ? <em key={i}>{w}</em>
            : <span key={i}>{w} </span>
        ))}
      </h1>
      {(config.dates || config.location) && (
        <div className="ev-hero-meta">
          {config.dates && <span>📅 {config.dates}</span>}
          {config.location && <span>📍 {config.location}</span>}
        </div>
      )}
      {config.description && (
        <p className="ev-hero-desc">{config.description}</p>
      )}
      <div className="ev-hero-actions">
        <button className="ev-btn ev-btn-primary" onClick={() => setPage('apply')}>
          New Applicants
        </button>
        <button className="ev-btn ev-btn-primary" onClick={() => setPage('rsvp')}>
          Returning Alumna/Alumnus →
        </button>
      </div>
      {config.tagline && <p className="ev-hero-tagline">"{config.tagline}"</p>}
    </div>
  );
}

// ============================================================
// SHARED FORM COMPONENT (used by both Apply & RSVP)
// ============================================================

function ApplicationForm({
  config, shifts, setShifts, applications, setApplications, me, setMe,
  formType, // 'apply' | 'rsvp'
  onSuccess,
}) {
  const isRsvp = formType === 'rsvp';

  const [form, setForm] = useState({
    name: me?.name || '',
    playaName: me?.playaName || '',
    email: me?.email || '',
    phone: me?.phone || '',
    emergency: '',
    campSponsor: '',
  });
  const [agreed, setAgreed] = useState(config.agreements.map(() => false));
  const [selectedShifts, setSelectedShifts] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const field = (key) => ({
    value: form[key],
    onChange: e => setForm(f => ({ ...f, [key]: e.target.value })),
  });

  const toggleShift = (shiftId) => {
    setSelectedShifts(prev =>
      prev.includes(shiftId) ? prev.filter(id => id !== shiftId) : [...prev, shiftId]
    );
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Required';
    if (!form.email.trim()) errs.email = 'Required';
    if (!form.phone.trim()) errs.phone = 'Required';
    if (!form.emergency.trim()) errs.emergency = 'Required';
    if (!agreed.every(Boolean)) errs.agreements = 'Please agree to all statements';
    return errs;
  };

  const submit = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSubmitting(true);

    const myId = me?.id || newId();
    const newMe = { id: myId, name: form.name, playaName: form.playaName, email: form.email, phone: form.phone };
    await save('me', newMe, false);
    setMe(newMe);

    // Sign up for shifts
    let updatedShifts = shifts;
    if (selectedShifts.length > 0) {
      updatedShifts = shifts.map(sh => {
        if (!selectedShifts.includes(sh.id)) return sh;
        if (sh.signups.some(s => s.id === myId)) return sh;
        if (sh.signups.length >= sh.capacity) return sh;
        return { ...sh, signups: [...sh.signups, { id: myId, name: form.name }] };
      });
      await save('shifts', updatedShifts, true);
      setShifts(updatedShifts);
    }

    const application = {
      id: newId(),
      userId: myId,
      type: formType,
      name: form.name,
      playaName: form.playaName,
      email: form.email,
      phone: form.phone,
      emergency: form.emergency,
      shifts: selectedShifts,
      appliedAt: new Date().toISOString(),
    };

    const newApplications = [...applications, application];
    await save('applications', newApplications, true);
    setApplications(newApplications);

    // Post to Google Sheet if configured
    const sheetUrl = isRsvp ? config.rsvpSheet : config.applicationsSheet;
    if (sheetUrl) {
      fetch(sheetUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ type: isRsvp ? 'rsvp' : 'application', ...form, submittedAt: new Date().toISOString() })
      }).catch(() => {});
    }
    setSubmitting(false);
    if (typeof onSuccess === 'function') onSuccess();
  };

  if (!config.applicationsOpen && !isRsvp) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: '#6B5749' }}>
        <Giraffe size={48} style={{ marginBottom: 16 }} />
        <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, color: '#FBF0E0', marginBottom: 8 }}>Applications closed</p>
        <p style={{ fontSize: 14 }}>Check back soon or contact camp leadership.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="ev-field">
        <label className="ev-label">Full Name *</label>
        <input className="ev-input" placeholder="Your legal name" {...field('name')} />
        {errors.name && <p style={{ color: '#8B3020', fontSize: 12, marginTop: 4 }}>{errors.name}</p>}
      </div>

      <div className="ev-field">
        <label className="ev-label">Playa Name</label>
        <input className="ev-input" placeholder="Your playa name (if you have one)" {...field('playaName')} />
      </div>

      <div className="ev-field">
        <div>
          <label className="ev-label">Camp Sponsor's Name</label>
          <input className="ev-input" placeholder="Who invited you?" {...field('campSponsor')} />
        </div>
        <label className="ev-label">Email *</label>
        <input className="ev-input" type="email" placeholder="you@example.com" {...field('email')} />
        {errors.email && <p style={{ color: '#8B3020', fontSize: 12, marginTop: 4 }}>{errors.email}</p>}
      </div>

      <div className="ev-field">
        <label className="ev-label">Phone *</label>
        <input className="ev-input" type="tel" placeholder="(555) 000-0000" {...field('phone')} />
        {errors.phone && <p style={{ color: '#8B3020', fontSize: 12, marginTop: 4 }}>{errors.phone}</p>}
      </div>

      <div className="ev-field">
        <label className="ev-label">Emergency Contact *</label>
        <input className="ev-input" placeholder="Name & phone number" {...field('emergency')} />
        {errors.emergency && <p style={{ color: '#8B3020', fontSize: 12, marginTop: 4 }}>{errors.emergency}</p>}
      </div>

      {/* General Agreements */}
      <div style={{ marginBottom: 28 }}>
        <label className="ev-label" style={{ fontSize: 15, marginBottom: 12 }}>General Agreements</label>
        {config.agreements.map((ag, i) => (
          <div key={i} className="ev-agreement">
            <input
              type="checkbox"
              id={`ag-${i}`}
              checked={agreed[i]}
              onChange={() => setAgreed(a => a.map((v, j) => j === i ? !v : v))}
            />
            <label htmlFor={`ag-${i}`} style={{ fontSize: 13, color: '#A88876', lineHeight: 1.5, cursor: 'pointer' }}>
              {ag}
            </label>
          </div>
        ))}
        {errors.agreements && <p style={{ color: '#8B3020', fontSize: 12, marginTop: 4 }}>{errors.agreements}</p>}
      </div>

      <button
        className="ev-btn ev-btn-primary"
        style={{ width: '100%', padding: '14px' }}
        onClick={submit}
        disabled={submitting}
      >
        {submitting ? 'Submitting…' : isRsvp ? 'Continue to Camp Agreements' : 'Submit Application'}
      </button>
    </div>
  );
}

// ============================================================
// APPLY PAGE — first-timers
// ============================================================

function ApplyPage({ config, shifts, setShifts, applications, setApplications, me, setMe }) {
  const [success, setSuccess] = useState(false);

  return (
    <div className="ev-page">
      {success && (
        <SuccessModal
          message="Thanks for your submission!"
          subMessage="Someone from camp leadership will be in touch in the coming weeks."
          onClose={() => setSuccess(false)}
        />
      )}
      <div className="ev-form-header">
        <h1>Apply</h1>
        <p>First time at Beverly Grillz? We'd love to have you. Fill out the form below and we'll be in touch.</p>
      </div>
      <ApplicationForm
        config={config}
        shifts={shifts}
        setShifts={setShifts}
        applications={applications}
        setApplications={setApplications}
        me={me}
        setMe={setMe}
        formType="apply"
        onSuccess={() => setSuccess(true)}
      />
    </div>
  );
}

// ============================================================
// RSVP PAGE — returning alumni
// ============================================================

function RSVPPage({ config, shifts, setShifts, applications, setApplications, me, setMe }) {
  const [success, setSuccess] = useState(false);

  return (
    <div className="ev-page">
      {success && (
        <SuccessModal
          message="Welcome back!"
          subMessage="Your response has been recorded."
          onClose={() => setSuccess(false)}
        />
      )}
      <div className="ev-form-header">
        <h1>RSVP</h1>
        <p>Welcome back to the dust. Confirm your spot for this year's Beverly Grillz.</p>
      </div>
      <ApplicationForm
        config={config}
        shifts={shifts}
        setShifts={setShifts}
        applications={applications}
        setApplications={setApplications}
        me={me}
        setMe={setMe}
        formType="rsvp"
        onSuccess={() => setSuccess(true)}
      />
    </div>
  );
}

// ============================================================
// SHIFTS PAGE
// ============================================================

function ShiftsPage({ shifts, setShifts, me }) {
  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const signupOpen = new Date() >= new Date('2026-08-01T17:00:00');

  const toggleSignup = async (shiftId) => {
    if (!me) return;
    const updated = shifts.map(s => {
      if (s.id !== shiftId) return s;
      const signups = s.signups || [];
      const idx = signups.indexOf(me.name);
      return { ...s, signups: idx >= 0 ? signups.filter(n => n !== me.name) : [...signups, me.name] };
    });
    setShifts(updated);
    await save('shifts', updated, true);
  };

  return (
    <div className="ev-page">
      <h1 className="ev-section-h">Dates &amp; Shifts</h1>


      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <h2 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.75rem', color: 'var(--ev-accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Shifts</h2>
        {!signupOpen ? (
          <div className="ev-shifts-notice">
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Check back 5pm 8/1/26</h2>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {DAYS.map(day => {
              const dayShifts = shifts.filter(s => s.day === day);
              if (!dayShifts.length) return null;
              return (
                <div key={day} style={{ background: 'var(--ev-card)', borderRadius: 10, padding: '1rem', border: '1px solid var(--ev-border)' }}>
                  <div style={{ fontWeight: 700, marginBottom: '0.75rem', color: 'var(--ev-accent)' }}>{day}</div>
                  {dayShifts.map(shift => {
                    const filled = shift.signups?.length || 0;
                    const full = filled >= shift.capacity;
                    const isMine = me && shift.signups?.includes(me.name);
                    return (
                      <div key={shift.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--ev-border)' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{shift.name}</div>
                          <div style={{ color: 'var(--ev-muted)', fontSize: '0.8rem' }}>{shift.time} · {filled}/{shift.capacity} spots</div>
                        </div>
                        {me && (
                          <button
                            onClick={() => toggleSignup(shift.id)}
                            disabled={full && !isMine}
                            style={{ fontSize: '0.8rem', padding: '4px 12px', borderRadius: 6, border: 'none', cursor: full && !isMine ? 'not-allowed' : 'pointer', background: isMine ? '#27ae60' : full ? 'var(--ev-border)' : 'var(--ev-accent)', color: isMine || (!full) ? '#fff' : 'var(--ev-muted)' }}
                          >
                            {isMine ? 'Signed Up ✓' : full ? 'Full' : 'Sign Up'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
function ResourcesPage({ resources }) {
  return (
    <div className="ev-page">
      <h1 className="ev-section-h">Resources</h1>
      <p className="ev-section-sub">Everything you need for the event.</p>
      {resources.length === 0 && (
        <p style={{ color: '#6B5749', fontSize: 14 }}>Resources will be posted here before the event.</p>
      )}
      {resources.map(r => (
        <a
          key={r.id}
          className="ev-resource-card"
          href={r.url || '#'}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'flex', textDecoration: 'none' }}
        >
          <div className="ev-resource-info">
            <h3>{r.name}</h3>
            {r.description && <p>{r.description}</p>}
          </div>
          <div className="ev-resource-kind">{r.kind}</div>
        </a>
      ))}
    </div>
  );
}

// ============================================================
// PACKING PAGE
// ============================================================

function PackingPage({ items, checks, setChecks, me }) {
  const toggle = async (item) => {
    const next = { ...checks, [item]: !checks[item] };
    setChecks(next);
    await save('packingChecks', next, false);
  };

  const done = Object.values(checks).filter(Boolean).length;

  return (
    <div className="ev-page">
      <h1 className="ev-section-h">Packing List</h1>
      <p className="ev-section-sub">
        {done === 0
          ? 'Check items off as you pack.'
          : `${done} of ${items.length} packed.`}
      </p>
      {items.map((item, i) => {
        const checked = !!checks[item];
        return (
          <div
            key={i}
            className={`ev-packing-item${checked ? ' checked' : ''}`}
            onClick={() => toggle(item)}
          >
            <input type="checkbox" checked={checked} onChange={() => toggle(item)} onClick={e => e.stopPropagation()} />
            <span>{item}</span>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// DATES PAGE
// ============================================================

function DatesPage({ calendar }) {
  return (
    <div className="ev-page">
      <h1 className="ev-section-h">Dates</h1>
      <p className="ev-section-sub">Key dates for the 2026 season.</p>
      <div className="ev-dates-year">2026 Calendar</div>
      {calendar.map(ev => (
        <div key={ev.id} className="ev-date-row">
          <div className="ev-date-date">{ev.date}</div>
          <div className="ev-date-label">{ev.label}</div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// ADMIN — Config panel
// ============================================================

function AdminConfig({ config, updateConfig }) {
  const [form, setForm] = useState(config);
  useEffect(() => setForm(config), [config]);
  const f = (key) => ({ value: form[key] || '', onChange: e => setForm(c => ({ ...c, [key]: e.target.value })) });

  return (
    <div className="ev-admin-section">
      <h3>Event Info</h3>
      <div className="ev-field"><label className="ev-label">Event Name</label><input className="ev-input" {...f('eventName')} /></div>
      <div className="ev-field"><label className="ev-label">Tagline</label><input className="ev-input" {...f('tagline')} /></div>
      <div className="ev-field"><label className="ev-label">Year</label><input className="ev-input" type="number" {...f('year')} /></div>
      <div className="ev-field"><label className="ev-label">Dates</label><input className="ev-input" placeholder="e.g. July 3–6, 2026" {...f('dates')} /></div>
      <div className="ev-field"><label className="ev-label">Location</label><input className="ev-input" placeholder="e.g. Mojave Desert, CA" {...f('location')} /></div>
      <div className="ev-field"><label className="ev-label">Description</label><textarea className="ev-textarea" rows={4} {...f('description')} /></div>

      <h3 style={{ marginTop: 32 }}>Access</h3>
      <div className="ev-field"><label className="ev-label">Event Password (lock screen)</label><input className="ev-input" {...f('eventPassword')} /></div>
      <div className="ev-field"><label className="ev-label">Admin Password</label><input className="ev-input" {...f('adminPassword')} /></div>

      <h3 style={{ marginTop: 32 }}>Applications</h3>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <input
          type="checkbox"
          id="appOpen"
          checked={!!form.applicationsOpen}
          onChange={e => setForm(c => ({ ...c, applicationsOpen: e.target.checked }))}
          style={{ accentColor: '#C8956C' }}
        />
        <label htmlFor="appOpen" style={{ fontSize: 13, color: '#A88876', cursor: 'pointer' }}>
          Applications open (uncheck to close RSVP)
        </label>
      </div>
      <div className="ev-field">
        <label className="ev-label">Minimum shifts required</label>
        <input className="ev-input" type="number" {...f('shiftRequirement')} />
      </div>
      <div className="ev-field">
        <label className="ev-label">Applications Sheet URL (Google Apps Script)</label>
        <input className="ev-input" placeholder="https://script.google.com/macros/s/.../exec" {...f('applicationsSheet')} />
      </div>
      <div className="ev-field">
        <label className="ev-label">RSVP Sheet URL (Google Apps Script)</label>
        <input className="ev-input" placeholder="https://script.google.com/macros/s/.../exec" {...f('rsvpSheet')} />
      </div>

      <button className="ev-btn ev-btn-primary" onClick={() => updateConfig(form)}>Save changes</button>
    </div>
  );
}

// ============================================================
// ADMIN — Shifts panel
// ============================================================

function AdminShifts({ shifts, updateShifts }) {
  const [list, setList] = useState(shifts);
  useEffect(() => setList(shifts), [shifts]);

  const update = (i, k, v) => { const next = [...list]; next[i] = { ...next[i], [k]: v }; setList(next); };
  const remove = (i) => setList(list.filter((_, j) => j !== i));
  const add = () => setList([...list, { id: 'S' + Date.now(), name: 'New Shift', day: 'Thursday', time: '12:00–2:00 pm', capacity: 4, signups: [] }]);

  return (
    <div className="ev-admin-section">
      <h3>Shifts</h3>
      {list.map((sh, i) => (
        <div key={sh.id} style={{ background: '#0F0805', border: '1px solid #2A1810', borderRadius: 8, padding: 14, marginBottom: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 60px', gap: 8, marginBottom: 8 }}>
            <input className="ev-input" placeholder="Shift name" value={sh.name} onChange={e => update(i, 'name', e.target.value)} />
            <input className="ev-input" placeholder="Day" value={sh.day} onChange={e => update(i, 'day', e.target.value)} />
            <input className="ev-input" placeholder="Time" value={sh.time} onChange={e => update(i, 'time', e.target.value)} />
            <button className="ev-btn ev-btn-ghost ev-btn-small" onClick={() => remove(i)}>×</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label className="ev-label" style={{ marginBottom: 0 }}>Capacity:</label>
            <input className="ev-input" type="number" value={sh.capacity} onChange={e => update(i, 'capacity', Number(e.target.value))} style={{ width: 80 }} />
            <span style={{ fontSize: 12, color: '#6B5749' }}>{sh.signups.length} signed up</span>
          </div>
        </div>
      ))}
      <button className="ev-btn ev-btn-ghost ev-btn-small" onClick={add}>+ Add shift</button>
      <div style={{ marginTop: 20 }}>
        <button className="ev-btn ev-btn-primary" onClick={() => updateShifts(list)}>Save shifts</button>
      </div>
    </div>
  );
}

// ============================================================
// ADMIN — Applications panel
// ============================================================

function AdminApplications({ applications }) {
  const exportCsv = () => {
    const rows = [
      ['Type', 'Name', 'Playa Name', 'Email', 'Phone', 'Emergency', 'Submitted'],
      ...applications.map(a => [a.type || '', a.name, a.playaName || '', a.email, a.phone, a.emergency, new Date(a.appliedAt).toLocaleString()]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'applications.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="ev-admin-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ marginBottom: 0, borderBottom: 'none' }}>Applications ({applications.length})</h3>
        <button className="ev-btn ev-btn-ghost ev-btn-small" onClick={exportCsv} disabled={applications.length === 0}>Export CSV</button>
      </div>
      {applications.length === 0 && <p style={{ color: '#8A7060' }}>No applications yet.</p>}
      {applications.map(a => (
        <div key={a.id} style={{ background: '#0F0805', border: '1px solid #2A1810', borderRadius: 8, padding: 14, marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 500, fontSize: 19, color: '#FBF0E0' }}>{a.name}</div>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: a.type === 'rsvp' ? '#1A2A10' : '#1A100A', color: a.type === 'rsvp' ? '#6EC87A' : '#C8956C', fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase' }}>{a.type || 'apply'}</span>
          </div>
          {a.playaName && <div style={{ fontSize: 13, color: '#C8956C', marginBottom: 2 }}>"{a.playaName}"</div>}
          <div style={{ fontSize: 14, color: '#C8956C' }}>{a.email} · {a.phone}</div>
          <div style={{ fontSize: 13, color: '#A88876', marginTop: 4 }}>Emergency: {a.emergency}</div>
          <div style={{ fontSize: 12, color: '#6B5749', marginTop: 6 }}>Submitted {new Date(a.appliedAt).toLocaleString()}</div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// ADMIN — Resources panel
// ============================================================

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

// ============================================================
// ADMIN — Packing panel
// ============================================================

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

// ============================================================
// ADMIN — Calendar panel
// ============================================================

function AdminCalendar({ calendar, updateCalendar }) {
  const [list, setList] = useState(calendar);
  useEffect(() => setList(calendar), [calendar]);
  const update = (i, k, v) => { const next = [...list]; next[i] = { ...next[i], [k]: v }; setList(next); };
  const remove = (i) => setList(list.filter((_, j) => j !== i));
  const add = () => setList([...list, { id: 'c' + Date.now(), date: '', label: '' }]);

  return (
    <div className="ev-admin-section">
      <h3>Calendar</h3>
      {list.map((ev, i) => (
        <div key={ev.id} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 40px', gap: 8, marginBottom: 8 }}>
          <input className="ev-input" placeholder="Date (e.g. 8/1/26)" value={ev.date} onChange={e => update(i, 'date', e.target.value)} />
          <input className="ev-input" placeholder="Event description" value={ev.label} onChange={e => update(i, 'label', e.target.value)} />
          <button className="ev-btn ev-btn-ghost ev-btn-small" onClick={() => remove(i)}>×</button>
        </div>
      ))}
      <button className="ev-btn ev-btn-ghost ev-btn-small" onClick={add}>+ Add date</button>
      <div style={{ marginTop: 20 }}>
        <button className="ev-btn ev-btn-primary" onClick={() => updateCalendar(list)}>Save calendar</button>
      </div>
    </div>
  );
}

// ============================================================
// ADMIN PAGE
// ============================================================

function AdminPage({ config, shifts, resources, packingItems, applications, calendar, updateConfig, updateShifts, updateResources, updatePacking, updateCalendar, onLogout }) {
  const [tab, setTab] = useState('config');

  const tabs = [
    { id: 'config', label: 'Event Info' },
    { id: 'shifts', label: 'Dates & Shifts' },
    { id: 'packing', label: 'Packing' },
    { id: 'resources', label: 'Resources' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'applications', label: `Applications (${applications.length})` },
  ];

  return (
    <div className="ev-page-wide">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <h1 className="ev-section-h" style={{ marginBottom: 0 }}>Admin</h1>
        <button className="ev-btn ev-btn-ghost ev-btn-small" onClick={onLogout}>Log out</button>
      </div>
      <div className="ev-admin-tabs">
        {tabs.map(t => (
          <button key={t.id} className={`ev-admin-tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'config' && <AdminConfig config={config} updateConfig={updateConfig} />}
      {tab === 'shifts' && <AdminShifts shifts={shifts} updateShifts={updateShifts} />}
      {tab === 'packing' && <AdminPacking items={packingItems} updatePacking={updatePacking} />}
      {tab === 'resources' && <AdminResources resources={resources} updateResources={updateResources} />}
      {tab === 'calendar' && <AdminCalendar calendar={calendar} updateCalendar={updateCalendar} />}
      {tab === 'applications' && <AdminApplications applications={applications} />}
    </div>
  );
}

// ============================================================
// ADMIN LOCK
// ============================================================

function AdminLock({ config, onLogin }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState(false);

  const attempt = () => {
    if (pw === config.adminPassword) {
      onLogin();
    } else {
      setErr(true);
      setPw('');
      setTimeout(() => setErr(false), 1500);
    }
  };

  return (
    <div className="ev-page" style={{ maxWidth: 360, paddingTop: 80 }}>
      <h1 className="ev-section-h">Admin</h1>
      <p className="ev-section-sub">Enter the admin password to continue.</p>
      <div className="ev-field">
        <input
          className="ev-input"
          type="password"
          placeholder="Admin password"
          value={pw}
          onChange={e => setPw(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && attempt()}
          style={{ borderColor: err ? '#8B3020' : undefined }}
          autoFocus
        />
        {err && <p style={{ color: '#8B3020', fontSize: 12, marginTop: 4 }}>Incorrect password</p>}
      </div>
      <button className="ev-btn ev-btn-primary" style={{ width: '100%' }} onClick={attempt}>Enter</button>
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================

// ============================================================
// CAMP AGREEMENTS PAGE
// ============================================================

const CAMP_AGREEMENTS_LIST = [
  "I will check in after reasonably after arrival with Terry, Maria, Rana, or Brian",
  "I will fill in my dates of arrival/departure on the ride share document",
  "I will demoop my area prior to departure",
  "I will participate in moop sweeps throughout my time on the playa",
  "I will contribute materially to strike, regardless of departure date",
  "I will pack out all of the belongings that I packed in",
  "I will absolutely not leave my bike or belongings for the truck (for camp gear only)",
  "I will take bags of trash in my shower (IF I HAVE AN RV)",
  "I will try to take bags of trash if I have a normal vehicle",
  "I will return tools and drills to Terry's tool corner on the front of the Coronado",
  "I will be careful not to take tools or items that may be in use",
  "I will check IDs at the bar",
  "I will try to attend camp meetings when possible",
  "If there is a weather emergency, I will be sure to stay engaged with the camp updates",
];

function CampAgreementsPage({ me }) {
  const [checked, setChecked] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const allChecked = CAMP_AGREEMENTS_LIST.every((_, i) => checked[i]);

  if (submitted) {
    return (
      <div className="ev-page" style={{ textAlign: 'center', paddingTop: '3rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔥</div>
        <h2 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>You're all set!</h2>
        <p style={{ color: 'var(--ev-muted)' }}>Thank you for reviewing the camp agreements.</p>
      </div>
    );
  }

  return (
    <div className="ev-page">
      <h1 className="ev-section-h">Camp Agreements</h1>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <div style={{ background: 'var(--ev-card)', borderRadius: 10, padding: '1.5rem', marginBottom: '1.5rem', border: '1px solid var(--ev-border)' }}>
          <p style={{ margin: 0, lineHeight: 1.6 }}>
            Hello Campers! This year we are incorporating an agreements page. Please read and acknowledge — this will help the camp run smoothly.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
          {CAMP_AGREEMENTS_LIST.map((item, i) => (
            <label key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer', padding: '0.75rem', background: checked[i] ? 'rgba(139,96,64,0.08)' : 'var(--ev-card)', borderRadius: 8, border: '1px solid ' + (checked[i] ? 'var(--ev-accent)' : 'var(--ev-border)'), transition: 'all 0.15s' }}>
              <input
                type="checkbox"
                checked={!!checked[i]}
                onChange={e => setChecked(c => ({ ...c, [i]: e.target.checked }))}
                style={{ marginTop: '2px', accentColor: 'var(--ev-accent)', width: 18, height: 18, flexShrink: 0 }}
              />
              <span style={{ lineHeight: 1.5, fontSize: '0.92rem' }}>{item}</span>
            </label>
          ))}
        </div>
        <button
          className="ev-btn ev-btn-primary"
          disabled={!allChecked}
          onClick={() => setSubmitted(true)}
          style={{ width: '100%', opacity: allChecked ? 1 : 0.5, cursor: allChecked ? 'pointer' : 'not-allowed' }}
        >
          {allChecked ? 'Submit' : `Check all boxes to continue (${Object.values(checked).filter(Boolean).length}/${CAMP_AGREEMENTS_LIST.length})`}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// CAMP NEEDS PAGE
// ============================================================

function CampNeedsPage() {
  return (
    <div className="ev-page">
      <h1 className="ev-section-h">Camp Needs</h1>
      <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        <div style={{ background: 'var(--ev-card)', borderRadius: 10, padding: '1.5rem', border: '1px solid var(--ev-border)' }}>
          <h2 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--ev-accent)' }}>Items the Camp Needs</h2>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <li>2–3 simple kitchen burners (new)</li>
            <li>Bar mats — to keep the bar safer, especially in weather</li>
          </ul>
        </div>

        <div style={{ background: 'var(--ev-card)', borderRadius: 10, padding: '1.5rem', border: '1px solid var(--ev-border)' }}>
          <h2 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--ev-accent)' }}>Projects to Help the Camp</h2>
          <p style={{ color: 'var(--ev-muted)', fontSize: '0.92rem', margin: 0 }}>More details coming soon. If you have ideas or want to lead a project, reach out!</p>
        </div>

        <div style={{ background: 'var(--ev-card)', borderRadius: 10, padding: '1.5rem', border: '1px solid var(--ev-border)' }}>
          <h2 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--ev-accent)' }}>Sub-Task Lead Roles</h2>
          <p style={{ marginBottom: '0.75rem', fontSize: '0.92rem', color: 'var(--ev-muted)' }}>The camp could use help in these areas. Interested? Let a camp lead know.</p>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <li>Water Lead</li>
          </ul>
        </div>

      </div>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState('home');
  const [loading, setLoading] = useState(true);

  // Shared state (Supabase kv_store)
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [shifts, setShifts] = useState(DEFAULT_SHIFTS);
  const [packingItems, setPackingItems] = useState(DEFAULT_PACKING);
  const [resources, setResources] = useState(DEFAULT_RESOURCES);
  const [applications, setApplications] = useState([]);
  const [calendar, setCalendar] = useState(DEFAULT_CALENDAR);

  // Per-device state (localStorage)
  const [me, setMe] = useState(null);
  const [packingChecks, setPackingChecks] = useState({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    (async () => {
      const [cfg, sh, pk, rs, ap, cal, mUsr, pcChk] = await Promise.all([
        load('config', DEFAULT_CONFIG, true),
        load('shifts', DEFAULT_SHIFTS, true),
        load('packing', DEFAULT_PACKING, true),
        load('resources', DEFAULT_RESOURCES, true),
        load('applications', [], true),
        load('calendar', DEFAULT_CALENDAR, true),
        load('me', null, false),
        load('packingChecks', {}, false),
      ]);
      setConfig(cfg);
      setShifts(sh);
      setPackingItems(pk);
      setResources(rs);
      setApplications(ap);
      setCalendar(cal);
      setMe(mUsr);
      setPackingChecks(pcChk);
      setLoading(false);
    })();
  }, []);

  const unlock = async () => {
    setUnlocked(true);
  };

  const updateConfig = async (cfg) => {
    setConfig(cfg);
    await save('config', cfg, true);
  };
  const updateShifts = async (sh) => {
    setShifts(sh);
    await save('shifts', sh, true);
  };
  const updatePacking = async (pk) => {
    setPackingItems(pk);
    await save('packing', pk, true);
  };
  const updateResources = async (rs) => {
    setResources(rs);
    await save('resources', rs, true);
  };
  const updateCalendar = async (cal) => {
    setCalendar(cal);
    await save('calendar', cal, true);
  };

  const NAV_TABS = [
    { id: 'home', label: 'Home' },
    { id: 'apply', label: 'New Applicants' },
    { id: 'rsvp', label: 'RSVP' },
    { id: 'shifts', label: 'Shifts' },
    { id: 'dates', label: 'Dates' },
    { id: 'resources', label: 'Resources' },
    { id: 'packing', label: 'Packing' },
    { id: 'admin', label: 'Admin' },
    { id: 'campNeeds', label: 'Camp Needs' },
    { id: 'campAgreements', label: 'Agreements' },
  ];

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C8956C', fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontStyle: 'italic' }}>
        Lighting the fires…
      </div>
    );
  }

  if (!unlocked) {
    return (
      <>
        <InjectCSS />
        <LockScreen config={config} onUnlock={unlock} />
      </>
    );
  }

  return (
    <>
      <InjectCSS />
      <nav className="ev-nav">
        <span className="ev-nav-brand" onClick={() => setPage('home')}>{config.eventName}</span>
        <div className="ev-nav-tabs">
          {NAV_TABS.map(t => (
            <button
              key={t.id}
              className={`ev-nav-tab${page === t.id ? ' active' : ''}`}
              onClick={() => setPage(t.id)}
            >
              {t.label}
            </button>
          ))}
          <button
            className="ev-nav-lock"
            title="Lock screen"
            onClick={async () => {
              await save('unlocked', false, false);
              setUnlocked(false);
              setIsAdmin(false);
            }}
          >
            🔒
          </button>
        </div>
      </nav>

      {page === 'home' && <HomePage config={config} setPage={setPage} />}
      {page === 'apply' && (
        <ApplyPage
          config={config} shifts={shifts} setShifts={setShifts}
          applications={applications} setApplications={setApplications}
          me={me} setMe={setMe}
        />
      )}
      {page === 'rsvp' && (
        <RSVPPage
          config={config} shifts={shifts} setShifts={setShifts}
          applications={applications} setApplications={setApplications}
          me={me} setMe={setMe} setPage={setPage}
        />
      )}
      {page === 'shifts' && <ShiftsPage shifts={shifts} setShifts={setShifts} me={me} />}
      {page === 'dates' && <DatesPage calendar={calendar} />}
      {page === 'resources' && <ResourcesPage resources={resources} />}
      {page === 'packing' && (
        <PackingPage
          items={packingItems} checks={packingChecks}
          setChecks={setPackingChecks} me={me}
        />
      )}
      {page === 'campAgreements' && <CampAgreementsPage me={me} />}
      {page === 'campNeeds' && <CampNeedsPage />}
      {page === 'admin' && (
        isAdmin
          ? <AdminPage
              config={config} shifts={shifts} resources={resources}
              packingItems={packingItems} applications={applications} calendar={calendar}
              updateConfig={updateConfig} updateShifts={updateShifts}
              updateResources={updateResources} updatePacking={updatePacking}
              updateCalendar={updateCalendar}
              onLogout={() => setIsAdmin(false)}
            />
          : <AdminLock config={config} onLogin={() => setIsAdmin(true)} />
      )}
    </>
  );
}
