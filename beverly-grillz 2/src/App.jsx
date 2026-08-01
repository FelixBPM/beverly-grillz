import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { load, save, saveApplication, loadAllApplications, deleteApplication } from './storage';

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

// A packing entry beginning with "## " renders as a section heading instead of
// a checkbox. Keeping the list a flat array of strings means the existing
// Supabase data and the Admin editor both keep working -- an admin can add a
// section just by typing "## Whatever" as an item.
// The packing list is a flat array of strings so it round-trips through
// Supabase and the Admin editor unchanged. Two prefixes give it structure:
//   "## "  -> renders as a section heading rather than a checkbox
//   "! "   -> marks an item the camp considers essential
// Contents are derived from the camp's Google packing spreadsheet.
const PACKING_SECTION_PREFIX = '## ';
const PACKING_ESSENTIAL_PREFIX = '! ';

const DEFAULT_PACKING = [
  '## For Camp',
  '2 bottles of booze',
  '4 mixers',

  '## Before You Leave',
  '! Tickets. No, really — people forget them every year',
  '! Drivers license, insurance, ID',
  '! Medications and any special needs',
  'Extra set of car keys',
  'Printouts from Burning Man (theme camp confirmation, etc.)',

  '## Shelter & Sleep',
  '! Shelter (yurt, tent, shiftpod, etc.)',
  '! Rebar or lag screws to stake down your tent or shade',
  '! Tennis balls to cover the rebar — prevents shin and foot injuries',
  'Light to mark your tent and your stakes',
  'Tarp for under the tent',
  'Lantern',
  'Air mattress',
  'Fitted sheet for the mattress',
  'Pillows',
  'Light blanket',
  '! Warm blanket or sleeping bag — nights get genuinely cold',
  'Camp chair (camp has seating, but nice to have your own)',
  'Big plastic tub to stash things in — invaluable in a dust storm',

  '## Creature Comforts',
  '! Goggles — not optional in a dust storm',
  '! Floppy wide-brim hat',
  'Dust masks',
  'Extra filters',
  'Earplugs, and a little tin to keep them in',
  'Sunglasses, plus a spare pair (they get lost)',
  'Sleep mask',
  'Mister or battery fan',
  'Moist neck ties',
  'Little sewing kit',
  'Safety pins',

  '## Out on the Playa',
  '! Flashlight and/or headlamp',
  '! Water container — Camelback, Nalgene, whatever you like',
  'Blinky lights, LEDs, other illumination — art cars need to see you',
  'Backpack, shoulder bag or bum bag',
  'Little zip lock bags for MOOP you generate or find',

  '## Bike & Tools',
  'Bike',
  'Patch kit',
  'Bike pump',
  'Bike lights',
  'Lock',
  '! Work gloves',
  'Small tool box with a few essentials',
  'Swiss army knife or Leatherman',
  'Paracord, rope, bungies',
  'Zip ties, zip ties, zip ties',
  'Sharpie',
  'Scissors',
  'Electrical tape',
  'Duct tape',
  'Big trash bags — about 10',
  '3 gallon zip locks',
  '1 gallon zip locks',

  '## Hygiene',
  'Baby wipes (4 packs)',
  'Face wipes',
  'Paper towels',
  'Q-tips',
  'Shampoo and conditioner',
  "Dr. Bronner's or other camp soap — works for dishes and people",
  'Moisturizer, especially for hands and feet',
  'Lip balm',
  'Saline spray or vapor rub for a dried-out nose',
  'Kleenex',
  'Toothbrush',
  'Toothpaste',
  'Towels',
  '! Toilet paper — single ply only, the portos run out',
  'Pee bottle for late-night needs',
  'Nail clippers',

  '## Health & First Aid',
  '! Sunblock',
  'Eyedrops',
  'Contact lenses and solution',
  'Contraception',
  'Ibuprofen or preferred pain reliever',
  'Excedrin',
  'Tylenol PM',
  'Immodium and Tums',
  'First aid kit (camp has one too)',
  'Burn kit — it is Burning Man, after all',
  'Hand sanitizer',
  'Rescue Remedy for the inevitable meltdown',
  'Arnica gel for bruises',
  'Aloe vera gel',
  'Moleskin or blister pads',
  'Extra rags and towels',

  '## Clothing',
  'Pants, skirts or sarongs (2 or 3)',
  'Shorts or short skirts (2 or 3)',
  'Shirts — one for each day',
  'Thermals (one pair)',
  'Warm shirts (2 or 3)',
  'Scarf',
  'Warm hat',
  'Rain gear',
  '! Boots or closed-toe shoes',
  'Sandals for quick runs to the portos',
  'Costumes! Tons of them',

  '## Cooking & Food',
  '! Eating utensils — camp does not provide these',
  '! Bowl, plate and cup — camp does not provide these',
  'Powdered electrolyte or energy drink',
  'Canned food, in case a meal plan goes sideways',
  'Portable food for going out — bars, nuts, trail mix',
  'Instant soups and meals',
  'Quick protein — jerky, hard boiled eggs, cheese, nuts',
  'Munchies, salty and sweet, lots of them',
];

const DEFAULT_RESOURCES = [
  { id: 'r1', name: 'Camp Map', kind: 'image', url: '/d0487e7d-ae32-43e9-9b7d-d1666ed90116.jpg', description: 'Site layout & landmarks' },
  { id: 'r2', name: 'Full Schedule', kind: 'pdf', url: '#', description: 'Thursday through Sunday' },
  { id: 'r3', name: 'Production Schedule Flyer', kind: 'pdf', url: '#', description: '(under construction)' },
];

const DEFAULT_CALENDAR = [
  { id: 'c1', date: 'Thu, Aug 6 at 5pm EST', label: 'Shift sign-ups open' },
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

function Giraffe({ size = 100, opacity = 1, style = {}, className = '', wings = false }) {
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
      {/* far wing sits behind the body, near wing in front, so it reads 3D */}
      {wings && (
        <path
          className="ev-wing ev-wing-far"
          fill="#E8D6C4"
          d="M 50 77 Q 33 70 18 55 Q 31 61 42 62 Q 25 50 17 32 Q 34 45 50 60 Z"
        />
      )}
      {/* body */}
      <ellipse cx="50" cy="80" rx="32" ry="13"/>
      {wings && (
        <path
          className="ev-wing ev-wing-near"
          fill="#FFFBF5"
          d="M 55 74 Q 34 66 12 47 Q 28 55 41 57 Q 19 42 9 20 Q 31 35 52 56 Z"
        />
      )}
      {/* legs — classed so they can splay outward during the fall */}
      <rect className="ev-leg ev-leg-a" x="65" y="88" width="4.2" height="56" rx="2"/>
      <rect className="ev-leg ev-leg-b" x="74" y="88" width="4.2" height="56" rx="2"/>
      <rect className="ev-leg ev-leg-c" x="22" y="88" width="4.2" height="56" rx="2"/>
      <rect className="ev-leg ev-leg-d" x="31" y="88" width="4.2" height="56" rx="2"/>
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
    background-color: #100804;
    background-image: linear-gradient(rgba(200,149,108,0.04), rgba(200,149,108,0.04)), url('/bg-texture.jpg');
    background-size: cover;
    background-attachment: fixed;
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
  /* Giraffe celebration on a correct password: crouch, two travelling hops
     with squash-and-stretch, then a hop back to where he started. He must
     finish at translate(0,0) scale(1,1) -- the home page renders him in that
     exact spot, so landing anywhere else makes him jump on the handover. */
  @keyframes ev-giraffe-hop {
    0%   { transform: translate(0, 0) scale(1, 1) rotate(0deg); }
    6%   { transform: translate(0, 6px) scale(1.14, 0.84) rotate(0deg); }
    20%  { transform: translate(18px, -34px) scale(0.9, 1.14) rotate(6deg); }
    32%  { transform: translate(34px, 0) scale(1.12, 0.88) rotate(0deg); }
    38%  { transform: translate(34px, 0) scale(1, 1) rotate(0deg); }
    44%  { transform: translate(34px, 6px) scale(1.14, 0.84) rotate(0deg); }
    58%  { transform: translate(6px, -38px) scale(0.9, 1.14) rotate(-7deg); }
    70%  { transform: translate(-22px, 0) scale(1.12, 0.88) rotate(0deg); }
    76%  { transform: translate(-22px, 0) scale(1, 1) rotate(0deg); }
    82%  { transform: translate(-22px, 5px) scale(1.14, 0.84) rotate(0deg); }
    92%  { transform: translate(-11px, -30px) scale(0.92, 1.12) rotate(3deg); }
    97%  { transform: translate(0, 0) scale(1.12, 0.88) rotate(0deg); }
    100% { transform: translate(0, 0) scale(1, 1) rotate(0deg); }
  }
  .ev-giraffe-hop {
    display: inline-block;
    transform-origin: bottom center;
    animation: ev-giraffe-hop 1.5s ease-in-out forwards;
  }
  @keyframes ev-lock-dismiss {
    to { opacity: 0; transform: translateY(6px); }
  }
  .ev-lock-dismiss { animation: ev-lock-dismiss .45s ease forwards; }

  /* Anyone who has asked their OS to reduce motion gets neither the hop nor
     the delay -- see LockScreen, which unlocks immediately in that case. */
  @media (prefers-reduced-motion: reduce) {
    .ev-giraffe-hop, .ev-lock-dismiss { animation: none; }
  }

  /* ---- Apply button: the giraffe falls through the page into the button ----
     The travel distance is measured at click time and passed in as
     --ev-fall-dy, so it lands on the button at any viewport size. */
  @keyframes ev-fall-through {
    0%   { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; animation-timing-function: ease-out; }
    14%  { transform: translateY(-16px) rotate(-6deg) scale(1); animation-timing-function: cubic-bezier(.5, 0, 1, .5); }
    82%  { transform: translateY(calc(var(--ev-fall-dy, 260px) * 0.9)) rotate(13deg) scale(.5); opacity: 1; }
    100% { transform: translateY(var(--ev-fall-dy, 260px)) rotate(18deg) scale(.12); opacity: 0; }
  }
  .ev-falling {
    display: inline-block;
    position: relative;
    z-index: 5;                      /* passes in front of the badge and title */
    transform-origin: center center;
    animation: ev-fall-through 1.4s forwards;
    pointer-events: none;
  }

  /* Legs splay outward and flail, the way a falling animal's do. */
  .ev-falling .ev-leg { transform-box: view-box; }
  .ev-falling .ev-leg-a { transform-origin: 67px 90px;   animation: ev-splay-a 1.4s ease-out forwards; }
  .ev-falling .ev-leg-b { transform-origin: 76px 90px;   animation: ev-splay-b 1.4s ease-out forwards; }
  .ev-falling .ev-leg-c { transform-origin: 24px 90px;   animation: ev-splay-c 1.4s ease-out forwards; }
  .ev-falling .ev-leg-d { transform-origin: 33px 90px;   animation: ev-splay-d 1.4s ease-out forwards; }
  @keyframes ev-splay-a { 0% { transform: rotate(0deg); } 25% { transform: rotate(26deg); } 60% { transform: rotate(18deg); } 100% { transform: rotate(30deg); } }
  @keyframes ev-splay-b { 0% { transform: rotate(0deg); } 25% { transform: rotate(36deg); } 60% { transform: rotate(27deg); } 100% { transform: rotate(41deg); } }
  @keyframes ev-splay-c { 0% { transform: rotate(0deg); } 25% { transform: rotate(-36deg); } 60% { transform: rotate(-26deg); } 100% { transform: rotate(-40deg); } }
  @keyframes ev-splay-d { 0% { transform: rotate(0deg); } 25% { transform: rotate(-25deg); } 60% { transform: rotate(-17deg); } 100% { transform: rotate(-29deg); } }

  /* The Apply button stays orange and just loses its label, then darkens in
     step with the fall -- orange, to burnt orange, to the page background --
     so it has become a hole in the page exactly as he drops through it.
     Timed to match ev-fall-through (1.4s). */
  @keyframes ev-btn-swallow {
    0%   { background: linear-gradient(135deg, #D4894E, #C06830); box-shadow: none; }
    18%  { background: linear-gradient(135deg, #D4894E, #C06830); box-shadow: none; }
    45%  { background: linear-gradient(135deg, #8A5228, #6B3C18); box-shadow: inset 0 6px 14px rgba(0, 0, 0, .45); }
    70%  { background: linear-gradient(135deg, #4A2A10, #331B0A); box-shadow: inset 0 9px 20px rgba(0, 0, 0, .7); }
    100% { background: #100804; box-shadow: inset 0 12px 26px rgba(0, 0, 0, .9); }
  }
  .ev-btn-swallow {
    color: transparent !important;
    border-color: transparent !important;
    animation: ev-btn-swallow 1.4s ease-in forwards;
    cursor: default;
  }

  @media (prefers-reduced-motion: reduce) {
    .ev-btn-swallow { animation: none; }
  }

  /* Instant version, used by the Submit button on the Affirmations page. */
  .ev-btn-pothole {
    color: transparent !important;
    background: #3E1D06 !important;
    border-color: #3E1D06 !important;
    box-shadow: inset 0 10px 22px rgba(0, 0, 0, .8), inset 0 -3px 8px rgba(0, 0, 0, .5);
    transition: background .3s ease, color .2s ease, box-shadow .3s ease, border-color .3s ease;
    cursor: default;
  }

  @media (prefers-reduced-motion: reduce) {
    .ev-falling { animation: none; }
    .ev-falling .ev-leg { animation: none; }
  }

  /* ---- Winged launch out of the Submit button ----
     The button darkens to the same hole colour used on the home page, then
     the giraffe pops out of it and flies up and away. Positioned with fixed
     coordinates measured off the button, so it starts exactly on it. */
  .ev-flyer {
    position: fixed;
    z-index: 60;
    transform: translate(-50%, -50%);
    color: #C8956C;
    pointer-events: none;
  }
  .ev-flyer-inner {
    display: inline-block;
    animation: ev-fly-away 1.7s cubic-bezier(.35, 0, .5, 1) forwards;
  }
  @keyframes ev-fly-away {
    0%   { transform: translate(0, 14px) scale(.2) rotate(0deg); opacity: 0; }
    10%  { transform: translate(0, -6px) scale(1.18) rotate(-2deg); opacity: 1; }
    18%  { transform: translate(2px, -18px) scale(1) rotate(0deg); opacity: 1; }
    45%  { transform: translate(26px, -120px) scale(.92) rotate(-6deg); opacity: 1; }
    75%  { transform: translate(64px, -300px) scale(.72) rotate(-10deg); opacity: .85; }
    100% { transform: translate(110px, -520px) scale(.45) rotate(-14deg); opacity: 0; }
  }
  .ev-wing { transform-box: view-box; transform-origin: 53px 70px; }
  .ev-wing-near { animation: ev-flap-near .26s ease-in-out infinite; }
  .ev-wing-far  { animation: ev-flap-far  .26s ease-in-out infinite; }
  @keyframes ev-flap-near { 0%, 100% { transform: rotate(-20deg); } 50% { transform: rotate(24deg); } }
  @keyframes ev-flap-far  { 0%, 100% { transform: rotate(-8deg); }  50% { transform: rotate(36deg); } }

  @media (prefers-reduced-motion: reduce) {
    .ev-flyer { display: none; }
  }

  /* ---- Moonwalking giraffe, bottom of the Dates page ----
     He faces right but travels left, which is what sells the moonwalk. The
     legs run a diagonal gait so it reads as walking forward while sliding
     backward. The track is the full width of the strip and he sits at its
     left edge, so these percentages are strip-widths -- stopping at -9%
     means he exits the left just as the loop restarts. */
  .ev-moonwalk-strip {
    position: relative;
    height: 54px;
    overflow: hidden;
    color: #C8956C;
    /* Full-bleed out of the 720px content column so he crosses the whole
       black band, and pulled down into .ev-page's 80px bottom padding so he
       walks along the very bottom edge of it. */
    width: 100vw;
    margin: 28px 0 -62px calc(50% - 50vw);
  }
  .ev-moonwalk-track {
    position: absolute;
    inset: 0;
    animation: ev-mw-travel 7s linear infinite;
  }
  @keyframes ev-mw-travel {
    from { transform: translateX(101%); }
    to   { transform: translateX(-9%); }
  }
  .ev-moonwalk-body {
    position: absolute;
    left: 0;
    bottom: 0;
    display: inline-block;
    transform-origin: bottom center;
    animation: ev-mw-bob .52s ease-in-out infinite;
  }
  @keyframes ev-mw-bob {
    0%, 100% { transform: translateY(0) rotate(-7deg); }
    50%      { transform: translateY(-3px) rotate(-5deg); }
  }
  .ev-moonwalk-body .ev-leg { transform-box: view-box; }
  .ev-moonwalk-body .ev-leg-a { transform-origin: 67px 90px; animation: ev-mw-legfwd .52s ease-in-out infinite; }
  .ev-moonwalk-body .ev-leg-b { transform-origin: 76px 90px; animation: ev-mw-legback .52s ease-in-out infinite; }
  .ev-moonwalk-body .ev-leg-c { transform-origin: 24px 90px; animation: ev-mw-legback .52s ease-in-out infinite; }
  .ev-moonwalk-body .ev-leg-d { transform-origin: 33px 90px; animation: ev-mw-legfwd .52s ease-in-out infinite; }
  @keyframes ev-mw-legfwd  { 0%, 100% { transform: rotate(19deg); }  50% { transform: rotate(-15deg); } }
  @keyframes ev-mw-legback { 0%, 100% { transform: rotate(-15deg); } 50% { transform: rotate(19deg); } }

  /* ---- Music bar ---- */
  .ev-music-bar {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 80;
    background: #0B0503; border-top: 1px solid #2A1810;
    display: flex; align-items: center; gap: 10px;
    padding: 6px 10px;
    box-shadow: 0 -6px 18px rgba(0, 0, 0, .5);
  }
  .ev-music-bar iframe { flex: 1; border: 0; min-width: 0; }
  .ev-music-close {
    flex-shrink: 0; background: transparent; border: 1px solid #2A1810;
    color: #A88876; border-radius: 6px; cursor: pointer;
    font-size: 16px; line-height: 1; padding: 6px 9px;
  }
  .ev-music-close:hover { color: #C8956C; border-color: #C8956C; }
  body.ev-has-music { padding-bottom: 84px; }

  @media (prefers-reduced-motion: reduce) {
    .ev-moonwalk-strip { display: none; }
  }

  .ev-essential-badge {
    display: inline-block; flex-shrink: 0;
    font-size: 10px; letter-spacing: .1em; text-transform: uppercase; font-weight: 700;
    color: #100804; background: #C8956C;
    padding: 3px 8px; border-radius: 20px;
  }

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
  .ev-shifts-frame {
    width: 100%; min-height: 600px; border: 1px solid #2A1810;
    border-radius: 10px; background: #0F0805; display: block;
  }

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

  /* --- ACCOMMODATION MATRIX --- */
  .ev-matrix { width: 100%; border-collapse: collapse; margin-top: 8px; }
  .ev-matrix th {
    padding: 10px 12px; text-align: center; color: #A88876;
    font-weight: 500; font-size: 13px; border-bottom: 1px solid #2A1810;
  }
  .ev-matrix th:first-child { text-align: left; min-width: 64px; }
  .ev-matrix td {
    padding: 14px 12px; text-align: center;
    border-bottom: 1px solid #1A0C06;
  }
  .ev-matrix td:first-child {
    text-align: left; color: #FBF0E0;
    font-weight: 600; letter-spacing: 0.04em;
  }
  .ev-matrix tr:hover td { background: rgba(200,149,108,0.04); }
  .ev-matrix input[type=checkbox] {
    width: 18px; height: 18px; accent-color: #C8956C; cursor: pointer;
  }

  /* Pulse the Affirmations tab when application is pending */
  @keyframes tab-pulse {
    0%, 100% { background: rgba(200,149,108,0.15); color: #C8956C; }
    50% { background: rgba(200,149,108,0.35); color: #FBF0E0; }
  }
  .ev-nav-tab-pulse {
    animation: tab-pulse 1.8s ease-in-out infinite;
    border-radius: 20px;
  }
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

const HOP_MS = 1500;

function LockScreen({ config, onUnlock }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const hopTimer = useRef(null);

  useEffect(() => () => clearTimeout(hopTimer.current), []);

  const attempt = () => {
    if (pw !== config.eventPassword) {
      setErr(true);
      setPw('');
      setTimeout(() => setErr(false), 1500);
      return;
    }
    if (celebrating) return;

    const reducedMotion = typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Don't make someone who asked for reduced motion sit through a delay
    // with nothing happening -- let them straight in.
    if (reducedMotion) {
      onUnlock();
      return;
    }

    setCelebrating(true);
    hopTimer.current = setTimeout(onUnlock, HOP_MS);
  };

  return (
    <div className="ev-lock">
      <div className="ev-lock-box">
        <div style={{ color: '#C8956C', marginBottom: 8 }}>
          <span className={celebrating ? 'ev-giraffe-hop' : undefined}>
            <Giraffe size={60} />
          </span>
        </div>
        <h1>{config.eventName}</h1>
        <p className={celebrating ? 'ev-lock-dismiss' : undefined}>
          {celebrating ? 'See you on the playa' : 'Contact your organizer for the password'}
        </p>
        <div className={`ev-field${celebrating ? ' ev-lock-dismiss' : ''}`}>
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
        <button
          className={`ev-btn ev-btn-primary${celebrating ? ' ev-lock-dismiss' : ''}`}
          style={{ width: '100%' }}
          onClick={attempt}
          disabled={celebrating}
        >
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

const FALL_MS = 1400;

function HomePage({ config, setPage }) {
  const [falling, setFalling] = useState(false);
  const giraffeRef = useRef(null);
  const buttonRef = useRef(null);
  const fallTimer = useRef(null);

  useEffect(() => () => clearTimeout(fallTimer.current), []);

  const handleApply = () => {
    if (falling) return;

    const reducedMotion = typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion || !giraffeRef.current || !buttonRef.current) {
      setPage('apply');
      return;
    }

    // Measure the actual gap between the giraffe and the button now, rather
    // than hardcoding a distance -- the hero reflows with viewport width and
    // with which optional config fields are filled in.
    // Measure the svg, not the wrapper: an inline span reports its line box,
    // which sits higher than the artwork and made him land short of the hole.
    const art = giraffeRef.current.querySelector('svg') || giraffeRef.current;
    const g = art.getBoundingClientRect();
    const b = buttonRef.current.getBoundingClientRect();
    const dy = (b.top + b.height / 2) - (g.top + g.height / 2);
    giraffeRef.current.style.setProperty('--ev-fall-dy', `${dy}px`);

    setFalling(true);
    fallTimer.current = setTimeout(() => setPage('apply'), FALL_MS);
  };

  return (
    <div className="ev-hero">
      <div style={{ color: '#C8956C' }}>
        <span
          ref={giraffeRef}
          className={falling ? 'ev-falling' : undefined}
          style={{ display: 'inline-block' }}
        >
          <Giraffe size={64} />
        </span>
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
        <button
          ref={buttonRef}
          className={`ev-btn ev-btn-primary${falling ? ' ev-btn-swallow' : ''}`}
          onClick={handleApply}
          disabled={falling}
        >
          Apply for 2026 →
        </button>
      </div>
      {config.tagline && <p className="ev-hero-tagline">"{config.tagline}"</p>}
    </div>
  );
}

// ============================================================
// UNIFIED APPLY PAGE (new applicants + returning members)
// ============================================================

const COUNTRIES = [
  { code: 'US', name: 'United States', dial: '1', flag: '🇺🇸' },
  { code: 'CA', name: 'Canada',        dial: '1', flag: '🇨🇦' },
  { code: 'GB', name: 'United Kingdom', dial: '44', flag: '🇬🇧' },
  { code: 'AU', name: 'Australia',     dial: '61', flag: '🇦🇺' },
  { code: 'DE', name: 'Germany',       dial: '49', flag: '🇩🇪' },
  { code: 'FR', name: 'France',        dial: '33', flag: '🇫🇷' },
  { code: 'NL', name: 'Netherlands',   dial: '31', flag: '🇳🇱' },
  { code: 'BE', name: 'Belgium',       dial: '32', flag: '🇧🇪' },
  { code: 'CH', name: 'Switzerland',   dial: '41', flag: '🇨🇭' },
  { code: 'AT', name: 'Austria',       dial: '43', flag: '🇦🇹' },
  { code: 'SE', name: 'Sweden',        dial: '46', flag: '🇸🇪' },
  { code: 'NO', name: 'Norway',        dial: '47', flag: '🇳🇴' },
  { code: 'DK', name: 'Denmark',       dial: '45', flag: '🇩🇰' },
  { code: 'FI', name: 'Finland',       dial: '358', flag: '🇫🇮' },
  { code: 'ES', name: 'Spain',         dial: '34', flag: '🇪🇸' },
  { code: 'IT', name: 'Italy',         dial: '39', flag: '🇮🇹' },
  { code: 'PT', name: 'Portugal',      dial: '351', flag: '🇵🇹' },
  { code: 'IE', name: 'Ireland',       dial: '353', flag: '🇮🇪' },
  { code: 'NZ', name: 'New Zealand',   dial: '64', flag: '🇳🇿' },
  { code: 'ZA', name: 'South Africa',  dial: '27', flag: '🇿🇦' },
  { code: 'IL', name: 'Israel',        dial: '972', flag: '🇮🇱' },
  { code: 'JP', name: 'Japan',         dial: '81', flag: '🇯🇵' },
  { code: 'MX', name: 'Mexico',        dial: '52', flag: '🇲🇽' },
  { code: 'BR', name: 'Brazil',        dial: '55', flag: '🇧🇷' },
  { code: 'AR', name: 'Argentina',     dial: '54', flag: '🇦🇷' },
  { code: 'IN', name: 'India',         dial: '91', flag: '🇮🇳' },
  { code: 'CN', name: 'China',         dial: '86', flag: '🇨🇳' },
  { code: 'KR', name: 'South Korea',   dial: '82', flag: '🇰🇷' },
  { code: 'SG', name: 'Singapore',     dial: '65', flag: '🇸🇬' },
  { code: 'HK', name: 'Hong Kong',     dial: '852', flag: '🇭🇰' },
  { code: 'OTHER', name: 'Other',      dial: '',   flag: '🌍' },
];

// Build a longest-match lookup: dialCode → country (prefer US over CA for +1)
const DIAL_TO_COUNTRY = {};
[...COUNTRIES].reverse().forEach(c => {
  if (c.dial) DIAL_TO_COUNTRY[c.dial] = c;
});
DIAL_TO_COUNTRY['1'] = COUNTRIES.find(c => c.code === 'US'); // US wins +1

function detectCountryFromInput(raw) {
  // raw may start with + or just digits
  const digits = raw.replace(/^\+/, '').replace(/\D/g, '');
  // Try 3-digit, 2-digit, 1-digit prefixes in that order
  for (const len of [3, 2, 1]) {
    const prefix = digits.slice(0, len);
    if (DIAL_TO_COUNTRY[prefix]) return { country: DIAL_TO_COUNTRY[prefix], rest: digits.slice(len) };
  }
  return null;
}

// E.164 caps a full international number at 15 digits.
const MAX_PHONE_DIGITS = 15;

// Reduces whatever the user typed or pasted to bare national digits.
//
// A leading "1" on a +1 number is the country/trunk code, not part of the
// national number, so "1 917 319 0900" pasted with US selected becomes
// "9173190900" rather than an 11-digit string.
function normalizeNationalDigits(value, country) {
  let d = String(value == null ? '' : value).replace(/\D/g, '');
  if (country.dial === '1' && d.length === 11 && d.charAt(0) === '1') d = d.slice(1);
  return d.slice(0, country.dial === '1' ? 10 : MAX_PHONE_DIGITS);
}

// Live display formatting for +1 numbers only. Other countries have too much
// variation in national format to guess at, so their digits show as typed.
function formatNationalPhone(digits, country) {
  if (!digits) return '';
  if (country.dial !== '1') return digits;
  if (digits.length < 4) return digits;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

// Weekdays are hardcoded for 2026 (Aug 30 = Sunday, gates open; Sept 7 =
// Labor Day Monday). If this app is reused for another year, these must be
// recalculated -- they will not update themselves.
const ARRIVAL_DAYS = [
  '', 'Tue, Aug 25 (super early crew)', 'Wed, Aug 26 (early crew)', 'Thu, Aug 27', 'Fri, Aug 28',
  'Sat, Aug 29', 'Sun, Aug 30 (gates open)', 'Mon, Aug 31', 'Tue, Sept 1', 'Wed, Sept 2',
  'Thu, Sept 3', 'Fri, Sept 4', 'Sat, Sept 5', 'Sun, Sept 6', 'Mon, Sept 7',
];

const DEPARTURE_DAYS = [
  '', 'Sun, Aug 30', 'Mon, Aug 31', 'Tue, Sept 1', 'Wed, Sept 2', 'Thu, Sept 3', 'Fri, Sept 4',
  'Sat, Sept 5 (Man burns)', 'Sun, Sept 6 (Temple burns)', 'Mon, Sept 7 (BM ends)',
  'Tue, Sept 8',
];

// One phone field, used for both the applicant and their emergency contact.
// Extracted so the two can never drift apart -- the country-detection bug this
// fixes was subtle enough that a second copy would eventually reintroduce it.
function PhoneField({ label, onChange, placeholder, autoComplete, error, required }) {
  const [phoneCountry, setPhoneCountry] = useState(COUNTRIES[0]); // US default
  const [phoneDigits, setPhoneDigits] = useState('');   // national digits only, unformatted
  const [phoneIntl, setPhoneIntl] = useState(null);     // raw "+..." buffer, until it resolves
  const phoneInputRef = useRef(null);
  const phoneCaretRef = useRef(null);                   // digits before the caret, to restore after reformat

  // Country auto-detection fires ONLY on a leading "+".
  //
  // It used to also fire on the first 1-4 bare digits, which meant a national
  // number was read as a dial code: typing "917..." matched +91 and switched
  // the country to India, discarding the digits. That made roughly a quarter of
  // all US area codes impossible to enter. A "+" is the only unambiguous signal
  // that what follows is a country code.
  const handlePhoneInput = (e) => {
    const el = e.target;
    const raw = el.value;
    const caretPos = el.selectionStart == null ? raw.length : el.selectionStart;

    if (raw.trim().startsWith('+')) {
      const detected = detectCountryFromInput(raw);
      if (detected) {
        setPhoneIntl(null);
        setPhoneCountry(detected.country);
        setPhoneDigits(normalizeNationalDigits(detected.rest, detected.country));
        phoneCaretRef.current = null; // caret to end after an international paste
        return;
      }
      // Not a dial code we know yet — hold the raw text so the user can keep
      // typing it, rather than clearing the field under them.
      setPhoneIntl(raw.trim().slice(0, MAX_PHONE_DIGITS + 1));
      phoneCaretRef.current = null;
      return;
    }

    setPhoneIntl(null);
    phoneCaretRef.current = raw.slice(0, caretPos).replace(/\D/g, '').length;
    setPhoneDigits(normalizeNationalDigits(raw, phoneCountry));
  };

  // Reformatting rewrites the string, so put the caret back where the user left
  // it — after the same number of digits — instead of jumping to the end.
  useLayoutEffect(() => {
    const el = phoneInputRef.current;
    const target = phoneCaretRef.current;
    phoneCaretRef.current = null;
    if (!el || target == null) return;
    const text = el.value;
    let pos = text.length;
    if (target === 0) {
      pos = 0;
    } else {
      let seen = 0;
      for (let i = 0; i < text.length; i++) {
        if (/\d/.test(text.charAt(i))) {
          seen++;
          if (seen === target) { pos = i + 1; break; }
        }
      }
    }
    el.setSelectionRange(pos, pos);
  }, [phoneDigits, phoneCountry, phoneIntl]);

  const phoneDisplay = phoneIntl != null ? phoneIntl : formatNationalPhone(phoneDigits, phoneCountry);

  // Empty stays empty — this used to submit the string "+1 " for anyone who
  // left the field blank.
  const fullPhone = phoneIntl != null
    ? phoneIntl
    : phoneDigits
      ? (phoneCountry.dial ? '+' + phoneCountry.dial + ' ' + phoneDigits : phoneDigits)
      : '';

  // Report the assembled number up to the form.
  useEffect(() => {
    if (onChange) onChange(fullPhone);
  }, [fullPhone]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="ev-field">
      <label className="ev-label">{label}{required ? ' *' : ''}</label>
      <div style={{ display: 'flex', gap: 0, borderRadius: 8, border: '1px solid #2A1810', overflow: 'hidden', background: '#0F0805', transition: 'border-color .15s' }}
        onFocusCapture={e => e.currentTarget.style.borderColor = '#C8956C'}
        onBlurCapture={e => e.currentTarget.style.borderColor = '#2A1810'}
      >
        <select
          value={phoneCountry.code}
          onChange={e => {
            const c = COUNTRIES.find(x => x.code === e.target.value);
            if (!c) return;
            setPhoneCountry(c);
            // Keep whatever they already typed -- changing country must never
            // wipe the number.
            setPhoneIntl(null);
            setPhoneDigits(d => normalizeNationalDigits(d, c));
          }}
          style={{
            background: '#1A0E08', border: 'none', borderRight: '1px solid #2A1810',
            color: '#FBF0E0', fontSize: 14, padding: '10px 8px', cursor: 'pointer',
            outline: 'none', flexShrink: 0, maxWidth: 180,
          }}
        >
          {COUNTRIES.map(c => (
            <option key={c.code} value={c.code}>
              {c.flag} {c.name}{c.dial ? ` (+${c.dial})` : ''}
            </option>
          ))}
        </select>
        {phoneCountry.dial && (
          <span style={{ padding: '10px 8px 10px 10px', color: '#C8956C', fontSize: 14, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            +{phoneCountry.dial}
          </span>
        )}
        <input
          ref={phoneInputRef}
          style={{ flex: 1, background: 'transparent', border: 'none', color: '#FBF0E0', fontSize: 14, padding: '10px 12px 10px 4px', outline: 'none', minWidth: 0 }}
          type="tel"
          inputMode="tel"
          autoComplete={autoComplete || 'tel-national'}
          placeholder={placeholder || (phoneCountry.code === 'US' ? '(555) 000-0000' : 'Your number')}
          value={phoneDisplay}
          onChange={handlePhoneInput}
        />
      </div>
      {error
        ? <p style={{ color: '#8B3020', fontSize: 12, marginTop: 4 }}>{error}</p>
        : <p style={{ fontSize: 12, color: '#6B5749', marginTop: 4 }}>Pick your country, then just type your number. Pasting a number that starts with + will set the country for you.</p>}
    </div>
  );
}

function UnifiedApplyPage({ config, onContinueToAgreements }) {
  const [memberType, setMemberType] = useState('returning'); // 'new' | 'returning'
  const [form, setForm] = useState({
    name: '',
    playaName: '',
    email: '',
    arrivalDay: '',
    departureDay: '',
    dietary: '',
    medicalCondition: false,
    emergency: '',
    campingWith: '',
  });
  const [accom, setAccom] = useState('');       // 'tent' | 'rv'
  const [needsPower, setNeedsPower] = useState(false);
  const [duesStatus, setDuesStatus] = useState(''); // 'paid' | 'will-talk'
  const [errors, setErrors] = useState({});
  const [phone, setPhone] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');

  const field = (key) => ({
    value: form[key],
    onChange: e => setForm(f => ({ ...f, [key]: e.target.value })),
  });

  // Matrix interaction: switching rows resets power/dues
  const handleMatrix = (type, col, checked) => {
    if (accom !== type) {
      setAccom(type);
      setNeedsPower(col === 'power' ? checked : false);
      setDuesStatus(col === 'paid' ? (checked ? 'paid' : '') : col === 'will-talk' ? (checked ? 'will-talk' : '') : '');
    } else {
      if (col === 'power') setNeedsPower(checked);
      if (col === 'paid') setDuesStatus(checked ? 'paid' : '');
      if (col === 'will-talk') setDuesStatus(checked ? 'will-talk' : '');
    }
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Required';
    if (!form.email.trim()) errs.email = 'Required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) errs.email = "That doesn't look like a valid email";
    if (!form.emergency.trim()) errs.emergency = 'Required';
    if (!emergencyPhone.trim()) errs.emergencyPhone = 'Required';
    if (!accom) errs.accom = 'Please indicate Tent or RV';
    return errs;
  };

  const handleContinue = () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    onContinueToAgreements({
      memberType,
      ...form,
      phone,
      emergencyPhone,
      accommodationType: accom,
      needsPower,
      duesStatus,
      submittedAt: new Date().toISOString(),
    });
  };

  if (!config.applicationsOpen) {
    return (
      <div className="ev-page" style={{ textAlign: 'center', paddingTop: 60 }}>
        <Giraffe size={48} style={{ marginBottom: 16, color: '#C8956C' }} />
        <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, color: '#FBF0E0', marginBottom: 8 }}>Applications closed</p>
        <p style={{ fontSize: 14, color: '#6B5749' }}>Check back soon or contact camp leadership.</p>
      </div>
    );
  }

  return (
    <div className="ev-page">
      <div className="ev-form-header">
        <h1>Apply for 2026</h1>
        <p>Fill out the form below to secure your spot at Beverly Grillz. After submitting you'll review and affirm the camp affirmations.</p>
      </div>

      {/* New vs Returning */}
      <div className="ev-field">
        <label className="ev-label" style={{ fontSize: 14, color: '#FBF0E0', marginBottom: 10 }}>Are you new to Beverly Grillz or a returning member?</label>
        <div style={{ display: 'flex', gap: 12 }}>
          {[
            { val: 'returning', label: 'Returning Member' },
            { val: 'new', label: 'New to Beverly Grillz' },
          ].map(({ val, label }) => (
            <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '10px 16px', borderRadius: 8, border: '1px solid ' + (memberType === val ? '#C8956C' : '#2A1810'), background: memberType === val ? 'rgba(200,149,108,0.08)' : '#0F0805', transition: 'all .15s', flex: 1, justifyContent: 'center' }}>
              <input type="radio" name="memberType" value={val} checked={memberType === val} onChange={() => setMemberType(val)} style={{ accentColor: '#C8956C' }} />
              <span style={{ fontSize: 14, color: memberType === val ? '#FBF0E0' : '#A88876' }}>{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Name */}
      <div className="ev-field">
        <label className="ev-label">Your Name *</label>
        <input className="ev-input" placeholder="Your full name" {...field('name')} />
        {errors.name && <p style={{ color: '#8B3020', fontSize: 12, marginTop: 4 }}>{errors.name}</p>}
      </div>

      {/* Playa Name */}
      <div className="ev-field">
        <label className="ev-label">Your Playa Name</label>
        <input className="ev-input" placeholder="Your playa name (if you have one)" {...field('playaName')} />
      </div>

      {/* Email */}
      <div className="ev-field">
        <label className="ev-label">Email *</label>
        <input className="ev-input" type="email" placeholder="you@example.com" {...field('email')} />
        {errors.email && <p style={{ color: '#8B3020', fontSize: 12, marginTop: 4 }}>{errors.email}</p>}
      </div>

      <PhoneField label="Phone Number" onChange={setPhone} error={errors.phone} />

      {/* Arrival / Departure */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="ev-field">
          <label className="ev-label">Which day are you planning to arrive?</label>
          <select className="ev-select" value={form.arrivalDay} onChange={e => setForm(f => ({ ...f, arrivalDay: e.target.value }))}>
            {ARRIVAL_DAYS.map(d => <option key={d} value={d}>{d || '— Select a day —'}</option>)}
          </select>
        </div>
        <div className="ev-field">
          <label className="ev-label">Which day are you planning to leave?</label>
          <select className="ev-select" value={form.departureDay} onChange={e => setForm(f => ({ ...f, departureDay: e.target.value }))}>
            {DEPARTURE_DAYS.map(d => <option key={d} value={d}>{d || '— Select a day —'}</option>)}
          </select>
        </div>
      </div>

      {/* Dietary */}
      <div className="ev-field">
        <label className="ev-label">Dietary Restrictions / Food Allergies</label>
        <textarea className="ev-textarea" placeholder="Any dietary needs or allergies we should know about?" rows={2} {...field('dietary')} />
      </div>

      {/* Medical */}
      <div className="ev-field">
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={form.medicalCondition}
            onChange={e => setForm(f => ({ ...f, medicalCondition: e.target.checked }))}
            style={{ accentColor: '#C8956C', marginTop: 2, flexShrink: 0, width: 16, height: 16 }}
          />
          <span style={{ fontSize: 14, color: '#FBF0E0', lineHeight: 1.5 }}>
            Do you have a health condition that our team medical lead should be aware of?
          </span>
        </label>
        <p style={{ fontSize: 12, color: '#6B5749', marginTop: 6, marginLeft: 26 }}>
          Our medical lead will reach out for a brief, private conversation.
        </p>
      </div>

      {/* Emergency Contact */}
      <div className="ev-field">
        <label className="ev-label">Emergency Contact *</label>
        <input className="ev-input" placeholder="Name & relationship to you" {...field('emergency')} />
        {errors.emergency && <p style={{ color: '#8B3020', fontSize: 12, marginTop: 4 }}>{errors.emergency}</p>}
      </div>
      <PhoneField
        label="Emergency Contact Phone"
        onChange={setEmergencyPhone}
        placeholder="Their number"
        required
        error={errors.emergencyPhone}
        autoComplete="off"
      />

      {/* Who camping with */}
      <div className="ev-field">
        <label className="ev-label">Who are you camping with?</label>
        <input className="ev-input" placeholder="Names of people in your camp group" {...field('campingWith')} />
      </div>

      {/* Accommodation matrix */}
      <div className="ev-field" style={{ marginTop: 8 }}>
        <p style={{ fontSize: 14, color: '#FBF0E0', fontWeight: 600, marginBottom: 4 }}>
          Will you be in a <strong>TENT</strong> or <strong>RV</strong>? <span style={{ color: '#8B3020' }}>*</span>
        </p>
        <p style={{ fontSize: 13, color: '#A88876', marginBottom: 6 }}>
          Have you <strong>PAID</strong> your camp donation?
        </p>
        <p style={{ fontSize: 13, color: '#A88876', marginBottom: 12 }}>
          Will you need <strong>POWER</strong> to your Tent or RV?{' '}
          <em>(Additional power costs for RV's and Tents, talk to a Camp Lead)</em>
        </p>
        <div style={{ overflowX: 'auto', background: '#0F0805', borderRadius: 10, border: '1px solid #2A1810', padding: '4px 0' }}>
          <table className="ev-matrix">
            <thead>
              <tr>
                <th></th>
                <th>I Will Need Power Hookup</th>
                <th>Paid Dues!</th>
                <th>Haven't Paid Dues Yet, Will Talk to a Lead</th>
              </tr>
            </thead>
            <tbody>
              {[{ type: 'tent', label: 'Tent' }, { type: 'rv', label: 'RV' }].map(({ type, label }) => (
                <tr key={type} style={{ background: accom === type ? 'rgba(200,149,108,0.06)' : 'transparent' }}>
                  <td>{label}</td>
                  <td>
                    <input type="checkbox"
                      checked={accom === type && needsPower}
                      onChange={e => handleMatrix(type, 'power', e.target.checked)}
                    />
                  </td>
                  <td>
                    <input type="checkbox"
                      checked={accom === type && duesStatus === 'paid'}
                      onChange={e => handleMatrix(type, 'paid', e.target.checked)}
                    />
                  </td>
                  <td>
                    <input type="checkbox"
                      checked={accom === type && duesStatus === 'will-talk'}
                      onChange={e => handleMatrix(type, 'will-talk', e.target.checked)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {errors.accom && <p style={{ color: '#8B3020', fontSize: 12, marginTop: 6 }}>{errors.accom}</p>}
      </div>

      <div style={{ marginTop: 32 }}>
        <button
          className="ev-btn ev-btn-primary"
          style={{ width: '100%', padding: '14px', fontSize: 15 }}
          onClick={handleContinue}
        >
          Continue to Camp Affirmations →
        </button>
        <div style={{ marginTop: 14, background: 'rgba(200,149,108,0.08)', border: '1px solid rgba(200,149,108,0.3)', borderRadius: 10, padding: '12px 16px', textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: '#C8956C', fontWeight: 600, marginBottom: 4 }}>
            ⚠️ Your information will not be recorded until you complete the Affirmations section.
          </p>
          <p style={{ fontSize: 12, color: '#A88876' }}>
            After clicking Continue, you must check all affirmations and hit Submit to officially apply.
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SHIFTS PAGE — Google Sheet embed
// ============================================================

const SHIFTS_SHEET_ID = '1Y8iUF1ldAAffelAsuY0Y9pNitn38nIrKVOUijq7ON88';
// Google refuses to render /edit URLs in an iframe, so the page embeds the
// read-only htmlview. Leadership Links points at the editable /edit URL.
const SHIFTS_SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHIFTS_SHEET_ID}/htmlview?gid=1492903072`;

// Shift signups open Thursday, August 6 2026 at 5pm Eastern.
// The -04:00 offset is deliberate: Eastern is on daylight time in August, so
// this is the instant that is 5pm in New York. Anyone loading the page before
// this moment sees the Coming Soon panel instead of the sheet -- no embed, no
// link -- and the page swaps itself over without needing a reload.
const SHIFTS_OPEN_AT = new Date('2026-08-06T17:00:00-04:00');
const SHIFTS_OPEN_LABEL = 'Thursday, August 6th @ 5pm EST';

// Ride Share sheet. Google refuses to render an /edit URL inside an iframe, so
// the embed uses the read-only htmlview and the button opens the editable sheet.
// Where the Apps Script endpoint deposits submitted applications. Kept as a
// constant rather than a config field so it can't be blanked out by an empty
// value in Supabase -- the Admin panel only ever links to it, never posts.
const APPLICATIONS_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1pYKPq3w4GfX4aQchewYrYLVGSDKtG164xYJsG2zXFUs/edit';

const RIDESHARE_SHEET_ID = '1lDDHilsu5es2H_3In81wK6U4fvkVvtz0d9b4MPCGHR0';
const RIDESHARE_SHEET_VIEW_URL = `https://docs.google.com/spreadsheets/d/${RIDESHARE_SHEET_ID}/htmlview?gid=0`;
const RIDESHARE_SHEET_EDIT_URL = `https://docs.google.com/spreadsheets/d/${RIDESHARE_SHEET_ID}/edit?gid=0#gid=0`;

function ShiftsComingSoon({ config }) {
  const minShifts = config && config.shiftRequirement ? config.shiftRequirement : 3;
  return (
    <div className="ev-page">
      <h1 className="ev-section-h">Shifts</h1>
      <div style={{
        maxWidth: 560, margin: '0 auto', background: '#0F0805', border: '1px solid #2A1810',
        borderRadius: 12, padding: '2.75rem 2rem', textAlign: 'center',
      }}>
        <div style={{
          fontSize: 12, letterSpacing: '.2em', textTransform: 'uppercase',
          color: '#C8956C', fontWeight: 600, marginBottom: 18,
        }}>
          Coming Soon
        </div>
        <h2 style={{
          fontFamily: 'Cormorant Garamond, serif', fontWeight: 400, fontSize: 27,
          color: '#FBF0E0', lineHeight: 1.35, marginBottom: 14,
        }}>
          Shift signup will open on<br />{SHIFTS_OPEN_LABEL}
        </h2>
        <div style={{ width: 40, height: 1, background: '#2A1810', margin: '0 auto 14px' }} />
        <p style={{ color: '#A88876', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
          Check back then to claim your shifts. Every camper completes at least {minShifts}.
        </p>
      </div>
    </div>
  );
}

function ShiftsPage({ config }) {
  // Re-check periodically so a page left open before 5pm opens itself.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  if (now < SHIFTS_OPEN_AT.getTime()) {
    return <ShiftsComingSoon config={config} />;
  }

  return (
    <div className="ev-page-wide">
      <h1 className="ev-section-h">Shifts</h1>
      <p className="ev-section-sub">Sign up for your shifts using the live spreadsheet below. You must complete at least 3 shifts.</p>

      <div style={{ background: '#0F0805', border: '1px solid #2A1810', borderRadius: 12, padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 20 }}>📋</span>
        <div>
          <p style={{ fontSize: 14, color: '#FBF0E0', fontWeight: 500, marginBottom: 2 }}>Live Shifts Spreadsheet</p>
          <p style={{ fontSize: 13, color: '#6B5749' }}>
            The sheet updates in real time. Can't see it?{' '}
            <a href={SHIFTS_SHEET_URL} target="_blank" rel="noopener noreferrer" style={{ color: '#C8956C', textDecoration: 'underline' }}>
              Open in a new tab →
            </a>
          </p>
        </div>
      </div>

      <iframe
        src={SHIFTS_SHEET_URL}
        className="ev-shifts-frame"
        title="Beverly Grillz Shifts"
        frameBorder="0"
        allowFullScreen
      />
    </div>
  );
}

// ============================================================
// RIDE SHARE PAGE
// ============================================================

function RideSharePage() {
  return (
    <div className="ev-page-wide">
      <h1 className="ev-section-h">Ride Share</h1>
      <p className="ev-section-sub">Offering a ride or looking for one? Add yourself to the sheet below so we can pair people up.</p>

      <div style={{ background: '#0F0805', border: '1px solid #2A1810', borderRadius: 12, padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <p style={{ fontSize: 14, color: '#FBF0E0', fontWeight: 500, marginBottom: 2 }}>Live Ride Share Spreadsheet</p>
          <p style={{ fontSize: 13, color: '#6B5749' }}>
            The view below is read-only and updates in real time. To add or edit your own row, open the sheet directly.
          </p>
        </div>
        <a
          className="ev-btn ev-btn-primary ev-btn-small"
          href={RIDESHARE_SHEET_EDIT_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: 'none', whiteSpace: 'nowrap' }}
        >
          Open the sheet →
        </a>
      </div>

      <iframe
        src={RIDESHARE_SHEET_VIEW_URL}
        className="ev-shifts-frame"
        title="Beverly Grillz Ride Share"
        frameBorder="0"
        allowFullScreen
      />
    </div>
  );
}

// ============================================================
// RESOURCES PAGE
// ============================================================

function ResourcesPage({ resources }) {
  return (
    <div className="ev-page">
      <h1 className="ev-section-h">Resources</h1>
      <p className="ev-section-sub">Everything you need for the event.</p>
      {resources.length === 0 && (
        <p style={{ color: '#6B5749', fontSize: 14 }}>Resources will be posted here before the event.</p>
      )}
      {resources.map(r => {
        // A resource with no real URL is a placeholder. Render it as plainly
        // unavailable rather than a link that silently does nothing. This is
        // checked at render time on purpose — resources come from Supabase, so
        // editing the defaults in code would not fix already-saved entries.
        const ready = r.url && r.url.trim() && r.url.trim() !== '#';
        if (!ready) {
          return (
            <div
              key={r.id}
              className="ev-resource-card"
              style={{ display: 'flex', opacity: 0.55, cursor: 'default' }}
            >
              <div className="ev-resource-info">
                <h3>{r.name}</h3>
                <p>{r.description ? `${r.description} — coming soon` : 'Coming soon'}</p>
              </div>
              <div className="ev-resource-kind">soon</div>
            </div>
          );
        }
        return (
          <a
            key={r.id}
            className="ev-resource-card"
            href={r.url}
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
        );
      })}
    </div>
  );
}

// ============================================================
// PACKING PAGE
// ============================================================

// Full packing spreadsheet — a copy of the community list, with its four tabs
// (Intro, Creature Comforts, Camp Needs, Cooking and Food), owned by the camp.
const PACKING_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1oF1EtxtShFa26DX3c-RX_J8GzS89Zk87ozvWUAAKwXo/edit';

function PackingPage({ items, checks, setChecks }) {
  const toggle = async (item) => {
    const next = { ...checks, [item]: !checks[item] };
    setChecks(next);
    await save('packingChecks', next, false);
  };

  const isSection = (item) => String(item).startsWith(PACKING_SECTION_PREFIX);
  const isEssential = (item) => String(item).startsWith(PACKING_ESSENTIAL_PREFIX);
  const label = (item) => isEssential(item) ? String(item).slice(PACKING_ESSENTIAL_PREFIX.length) : String(item);
  const packable = items.filter(i => !isSection(i));
  const done = packable.filter(i => checks[i]).length;
  const essentials = packable.filter(isEssential);
  const essentialsDone = essentials.filter(i => checks[i]).length;

  return (
    <div className="ev-page">
      <h1 className="ev-section-h">Packing List</h1>
      <p className="ev-section-sub">
        {done === 0
          ? 'Check items off as you pack. Your ticks are saved on this device.'
          : `${done} of ${packable.length} packed · ${essentialsDone} of ${essentials.length} essentials.`}
      </p>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        background: '#0F0805', border: '1px solid #2A1810', borderRadius: 10,
        padding: '12px 14px', marginBottom: 20,
      }}>
        <span className="ev-essential-badge">Essential</span>
        <span style={{ fontSize: 13, color: '#A88876', flex: 1, minWidth: 200 }}>
          Marked items are the ones people most regret forgetting.
        </span>
        {PACKING_SHEET_URL && (
          <a
            className="ev-btn ev-btn-ghost ev-btn-small"
            href={PACKING_SHEET_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: 'none', whiteSpace: 'nowrap' }}
          >
            Full spreadsheet →
          </a>
        )}
      </div>
      {items.map((item, i) => {
        if (isSection(item)) {
          return (
            <h2
              key={i}
              style={{
                fontFamily: 'Cormorant Garamond, serif', fontWeight: 500, fontSize: 22,
                color: '#C8956C', margin: i === 0 ? '0 0 10px' : '28px 0 10px',
                paddingBottom: 6, borderBottom: '1px solid #2A1810',
              }}
            >
              {item.slice(PACKING_SECTION_PREFIX.length)}
            </h2>
          );
        }
        const checked = !!checks[item];
        return (
          <div
            key={i}
            className={`ev-packing-item${checked ? ' checked' : ''}`}
            onClick={() => toggle(item)}
          >
            <input type="checkbox" checked={checked} onChange={() => toggle(item)} onClick={e => e.stopPropagation()} />
            <span style={{ flex: 1 }}>{label(item)}</span>
            {isEssential(item) && <span className="ev-essential-badge">Essential</span>}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// DATES PAGE
// ============================================================

// Calendar rows are free text, so we can't derive a real timestamp from most of
// them. Only entries we can pin to an exact moment get "add to calendar" links.
const CALENDAR_EVENTS = [
  {
    match: /shift sign-?ups? open/i,
    title: 'Beverly Grillz — shift sign-ups open',
    start: SHIFTS_OPEN_AT,
    minutes: 30,
    details: 'Shift sign-ups open at permanentdisco.com — grab your shifts.',
    location: 'permanentdisco.com',
  },
];

function icsStamp(d) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function googleCalendarUrl(ev) {
  const end = new Date(ev.start.getTime() + ev.minutes * 60000);
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.title,
    dates: `${icsStamp(ev.start)}/${icsStamp(end)}`,
    details: ev.details,
    location: ev.location,
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

function downloadIcs(ev) {
  const end = new Date(ev.start.getTime() + ev.minutes * 60000);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Beverly Grillz//EN',
    'BEGIN:VEVENT',
    `UID:${icsStamp(ev.start)}-beverlygrillz@permanentdisco.com`,
    `DTSTAMP:${icsStamp(ev.start)}`,
    `DTSTART:${icsStamp(ev.start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${ev.title}`,
    `DESCRIPTION:${ev.details}`,
    `LOCATION:${ev.location}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'beverly-grillz-shift-signups.ics';
  a.click();
  URL.revokeObjectURL(url);
}

function DatesPage({ calendar }) {
  return (
    <div className="ev-page">
      <h1 className="ev-section-h">Dates</h1>
      <p className="ev-section-sub">Key dates for the 2026 season.</p>
      <div className="ev-dates-year">2026 Calendar</div>
      {calendar.map(ev => {
        const known = CALENDAR_EVENTS.find(k => k.match.test(ev.label || ''));
        return (
          <div key={ev.id} className="ev-date-row">
            <div className="ev-date-date">{ev.date}</div>
            <div className="ev-date-label">
              {ev.label}
              {known && (
                <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <a
                    className="ev-btn ev-btn-ghost ev-btn-small"
                    href={googleCalendarUrl(known)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ textDecoration: 'none' }}
                  >
                    + Google Calendar
                  </a>
                  <button
                    className="ev-btn ev-btn-ghost ev-btn-small"
                    onClick={() => downloadIcs(known)}
                  >
                    + Apple / Outlook
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}

      <div className="ev-moonwalk-strip" aria-hidden="true">
        <span className="ev-moonwalk-track">
          <span className="ev-moonwalk-body">
            <Giraffe size={38} />
          </span>
        </span>
      </div>
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
      <div className="ev-field"><label className="ev-label">Dates</label><input className="ev-input" placeholder="e.g. Aug 30 – Sept 7, 2026" {...f('dates')} /></div>
      <div className="ev-field"><label className="ev-label">Location</label><input className="ev-input" placeholder="e.g. 7:30 & B Plaza, Black Rock City" {...f('location')} /></div>
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
          Applications open
        </label>
      </div>
      <div className="ev-field">
        <label className="ev-label">Minimum shifts required</label>
        <input className="ev-input" type="number" {...f('shiftRequirement')} />
      </div>
      <div className="ev-field">
        <label className="ev-label">Applications Endpoint (Google Apps Script /exec URL)</label>
        <input className="ev-input" placeholder="https://script.google.com/macros/s/.../exec" {...f('applicationsSheet')} />
        <p style={{ fontSize: 12, color: '#6B5749', marginTop: 4 }}>
          All form submissions (new applicants and returning members) get posted here. This is the
          pipe into the spreadsheet, not the spreadsheet itself — opening it in a browser is only a
          health check and should answer <code>{'{"ok":true…}'}</code>. To read the applications, use{' '}
          <a href={APPLICATIONS_SHEET_URL} target="_blank" rel="noopener noreferrer" style={{ color: '#C8956C' }}>
            the Applications spreadsheet →
          </a>
        </p>
        {!String(form.applicationsSheet || '').trim() && (
          <div style={{ background: 'rgba(190,70,50,0.12)', border: '1px solid #B4503C', borderRadius: 8, padding: '10px 12px', marginTop: 8 }}>
            <p style={{ margin: 0, fontSize: 12, color: '#E0A090', lineHeight: 1.5 }}>
              <strong>Not set.</strong> Applications are being saved to the camp database, but nothing is reaching the Google Sheet.
              Paste the Apps Script deployment URL above — it must end in <code>/exec</code> (not <code>/dev</code>) and the deployment access must be set to "Anyone".
            </p>
          </div>
        )}
        {(() => {
          const u = String(form.applicationsSheet || '').trim();
          if (!u) return null;
          if (u.endsWith('/exec')) return null;
          return (
            <div style={{ background: 'rgba(200,149,108,0.10)', border: '1px solid #C8956C', borderRadius: 8, padding: '10px 12px', marginTop: 8 }}>
              <p style={{ margin: 0, fontSize: 12, color: '#C8956C', lineHeight: 1.5 }}>
                This URL does not end in <code>/exec</code>. A <code>/dev</code> URL only works while you are signed in as the script owner, so applicant submissions will be dropped.
              </p>
            </div>
          );
        })()}
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

function AdminApplications({ applications, applicationsError, onDeleteApplication }) {
  const [confirming, setConfirming] = useState(null); // application id awaiting confirmation
  const [deleting, setDeleting] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  const handleDelete = async (a) => {
    setDeleteError(null);
    setDeleting(a.id);
    const ok = await onDeleteApplication(a);
    setDeleting(null);
    setConfirming(null);
    if (!ok) setDeleteError(`Could not delete ${a.name || 'that application'}. It may still be in the database — reload and check.`);
  };

  const exportCsv = () => {
    const rows = [
      ['Type', 'Name', 'Playa Name', 'Email', 'Phone', 'Arrival', 'Departure', 'Accommodation', 'Power Needed', 'Dues Status', 'Emergency', 'Emergency Phone', 'Dietary', 'Medical Condition', 'Rideshare', 'Camping With', 'Submitted'],
      ...applications.map(a => [
        a.memberType || a.type || '',
        a.name, a.playaName || '', a.email, a.phone || '',
        a.arrivalDay || '', a.departureDay || '',
        a.accommodationType || '', a.needsPower ? 'Yes' : 'No',
        a.duesStatus || '', a.emergency, a.emergencyPhone || '', a.dietary || '',
        a.medicalCondition ? 'Yes' : 'No',
        a.rideshare || '', a.campingWith || '',
        new Date(a.submittedAt || a.appliedAt).toLocaleString(),
      ]),
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
        <button className="ev-btn ev-btn-ghost ev-btn-small" onClick={exportCsv} disabled={applications.length === 0 || applicationsError}>Export CSV</button>
      </div>
      {applicationsError && (
        <div style={{ background: 'rgba(190,70,50,0.12)', border: '1px solid #B4503C', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
          <p style={{ margin: 0, fontSize: 13, color: '#E0A090', lineHeight: 1.5 }}>
            <strong>Could not load applications.</strong> This list may be incomplete or empty because the database read failed — reload the page before assuming nobody has applied. Do not export CSV from this view.
          </p>
        </div>
      )}
      {deleteError && (
        <div style={{ background: 'rgba(190,70,50,0.12)', border: '1px solid #B4503C', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
          <p style={{ margin: 0, fontSize: 13, color: '#E0A090', lineHeight: 1.5 }}>{deleteError}</p>
        </div>
      )}
      {applications.length === 0 && !applicationsError && <p style={{ color: '#8A7060' }}>No applications yet.</p>}
      {applications.map(a => (
        <div key={a.id} style={{ background: '#0F0805', border: '1px solid #2A1810', borderRadius: 8, padding: 14, marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 500, fontSize: 19, color: '#FBF0E0' }}>{a.name}</div>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: a.memberType === 'returning' ? '#1A2A10' : '#1A100A', color: a.memberType === 'returning' ? '#6EC87A' : '#C8956C', fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase' }}>{a.memberType || a.type || 'apply'}</span>
          </div>
          {a.playaName && <div style={{ fontSize: 13, color: '#C8956C', marginBottom: 2 }}>"{a.playaName}"</div>}
          {a.affirmations && Array.isArray(a.affirmations.items) && (
            <div style={{ fontSize: 12, color: '#6EC87A', marginBottom: 2 }}>
              ✓ Affirmed {a.affirmations.items.filter(i => i.checked).length}/{a.affirmations.items.length}
              {a.affirmations.affirmedAt ? ` · ${new Date(a.affirmations.affirmedAt).toLocaleDateString()}` : ''}
            </div>
          )}
          <div style={{ fontSize: 14, color: '#C8956C' }}>{a.email}{a.phone && <span style={{ color: '#A88876', marginLeft: 10 }}>{a.phone}</span>}</div>
          {(a.arrivalDay || a.departureDay) && (
            <div style={{ fontSize: 13, color: '#A88876', marginTop: 4 }}>
              {a.arrivalDay && `Arrives: ${a.arrivalDay}`}{a.arrivalDay && a.departureDay && ' · '}{a.departureDay && `Leaves: ${a.departureDay}`}
            </div>
          )}
          {a.accommodationType && (
            <div style={{ fontSize: 13, color: '#A88876', marginTop: 2 }}>
              {a.accommodationType === 'tent' ? '⛺ Tent' : '🚐 RV'}{a.needsPower ? ' · Needs power' : ''}{a.duesStatus === 'paid' ? ' · Dues paid' : a.duesStatus === 'will-talk' ? ' · Will talk to lead re: dues' : ''}
            </div>
          )}
          <div style={{ fontSize: 13, color: '#A88876', marginTop: 4 }}>
            Emergency: {a.emergency}{a.emergencyPhone ? <span style={{ color: '#C8956C', marginLeft: 8 }}>{a.emergencyPhone}</span> : null}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, gap: 10 }}>
            <span style={{ fontSize: 12, color: '#6B5749' }}>Submitted {new Date(a.submittedAt || a.appliedAt).toLocaleString()}</span>
            {confirming === a.id ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <span style={{ fontSize: 12, color: '#E0A090' }}>Delete permanently?</span>
                <button
                  className="ev-btn ev-btn-small"
                  disabled={deleting === a.id}
                  onClick={() => handleDelete(a)}
                  style={{ background: '#B4503C', color: '#FBF0E0', border: 'none' }}
                >
                  {deleting === a.id ? 'Deleting…' : 'Yes, delete'}
                </button>
                <button className="ev-btn ev-btn-ghost ev-btn-small" disabled={deleting === a.id} onClick={() => setConfirming(null)}>Cancel</button>
              </span>
            ) : (
              <button
                className="ev-btn ev-btn-ghost ev-btn-small"
                onClick={() => { setDeleteError(null); setConfirming(a.id); }}
                style={{ flexShrink: 0, color: '#A86050' }}
              >
                Delete
              </button>
            )}
          </div>
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
  const [confirmReset, setConfirmReset] = useState(false);
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

      <p style={{ fontSize: 12, color: '#6B5749', marginTop: 16, lineHeight: 1.5 }}>
        An item starting with <code>## </code> renders as a section heading.
        One starting with <code>! </code> is flagged Essential.
      </p>

      <div style={{ marginTop: 20, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="ev-btn ev-btn-primary" onClick={() => updatePacking(list)}>Save list</button>
        {/* Once a list is saved it lives in Supabase and shadows the one in the
            code, so shipping an updated default has no visible effect without
            this. Two-step so it can't be hit by accident. */}
        {confirmReset ? (
          <>
            <button
              className="ev-btn ev-btn-small"
              style={{ background: '#B4503C', color: '#FBF0E0', border: 'none' }}
              onClick={() => { setList(DEFAULT_PACKING); setConfirmReset(false); }}
            >
              Yes, replace my list
            </button>
            <button className="ev-btn ev-btn-ghost ev-btn-small" onClick={() => setConfirmReset(false)}>Cancel</button>
          </>
        ) : (
          <button className="ev-btn ev-btn-ghost ev-btn-small" onClick={() => setConfirmReset(true)}>
            Load the camp's full packing list
          </button>
        )}
      </div>
      {confirmReset && (
        <p style={{ fontSize: 12, color: '#E0A090', marginTop: 10 }}>
          This replaces everything above with the {DEFAULT_PACKING.length}-line list from the camp
          spreadsheet. Nothing is saved until you press Save list.
        </p>
      )}
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

// ============================================================
// ADMIN — Leadership Links
// ============================================================
// Every Google Sheet the camp runs on, in one place, so leadership doesn't
// have to dig through the site or their inbox to find one. These are plain
// constants rather than editable config: an accidental blank save in the
// Admin form shouldn't be able to lose the budget link.

const LEADERSHIP_LINK_GROUPS = [
  {
    heading: 'Applications',
    links: [
      {
        name: 'Application Submissions',
        note: 'Every submitted application lands here, one row each, on the Applications tab.',
        url: APPLICATIONS_SHEET_URL,
      },
    ],
  },
  {
    heading: 'Sheets the site uses',
    links: [
      {
        name: 'Shift Sign-ups',
        note: 'Embedded on the Shifts tab.',
        url: `https://docs.google.com/spreadsheets/d/${SHIFTS_SHEET_ID}/edit?gid=1492903072#gid=1492903072`,
      },
      {
        name: 'Ride Share',
        note: 'Embedded on the Ride Share tab.',
        url: RIDESHARE_SHEET_EDIT_URL,
      },
      {
        name: 'Packing List',
        note: 'The source for the Packing tab.',
        url: PACKING_SHEET_URL,
      },
    ],
  },
  {
    heading: 'Camp operations',
    links: [
      {
        name: '2026 Budget',
        url: 'https://docs.google.com/spreadsheets/d/16tBDO8ivHrvwdmP3CQwB5aeEz32UbsE_A8FcmbhjYuo/edit?gid=73976039#gid=73976039',
      },
      {
        name: '2026 Master List — Camper and Contact Info',
        note: 'Link not set yet.',
        url: '',
      },
      {
        name: '2026 Food Program Overview',
        url: 'https://docs.google.com/spreadsheets/d/1u9m6q2x_SuHvhRwYYoMkipx3do0tBmI5XK-w_ra9JKA/edit?gid=816529996#gid=816529996',
      },
    ],
  },
];

function AdminLinks() {
  return (
    <div>
      <p className="ev-section-sub" style={{ marginBottom: 24 }}>
        Every sheet the camp runs on. All of these open in a new tab.
      </p>

      {LEADERSHIP_LINK_GROUPS.map(group => (
        <div key={group.heading} style={{ marginBottom: 30 }}>
          <h3 style={{ marginBottom: 14 }}>{group.heading}</h3>

          {group.links.map(link => (
            <div
              key={link.name}
              style={{
                borderTop: '1px solid #2A1810',
                padding: '14px 0',
              }}
            >
              <div style={{ color: '#F0E0D0', fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
                {link.name}
              </div>
              {link.note && (
                <div style={{ color: '#6B5749', fontSize: 12, marginBottom: 6 }}>{link.note}</div>
              )}
              {link.url ? (
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: '#C8956C',
                    fontSize: 13,
                    wordBreak: 'break-all',
                  }}
                >
                  {link.url}
                </a>
              ) : (
                <div style={{ color: '#8B6F5C', fontSize: 13, fontStyle: 'italic' }}>
                  Send Claude the URL and it'll go here.
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function AdminPage({ config, shifts, resources, packingItems, applications, applicationsError, onDeleteApplication, calendar, updateConfig, updateShifts, updateResources, updatePacking, updateCalendar, onLogout }) {
  const [tab, setTab] = useState('config');

  const tabs = [
    { id: 'config', label: 'Event Info' },
    { id: 'shifts', label: 'Shifts' },
    { id: 'packing', label: 'Packing' },
    { id: 'resources', label: 'Resources' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'applications', label: `Applications (${applications.length})` },
    { id: 'links', label: 'Leadership Links' },
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
      {tab === 'applications' && <AdminApplications applications={applications} applicationsError={applicationsError} onDeleteApplication={onDeleteApplication} />}
      {tab === 'links' && <AdminLinks />}
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
// CAMP AGREEMENTS PAGE
// ============================================================

const CAMP_AGREEMENTS_LIST = [
  "I will check in reasonably after arrival with Terry, Maria, Rana, or Brian",
  "I will fill in my dates of arrival/departure on the ride share document",
  "I will demoop my area prior to departure",
  "I will participate in moop sweeps throughout my time on the playa",
  "I will contribute materially to strike, regardless of departure date",
  "I will pack out all of the belongings that I packed in",
  "I will absolutely not leave my bike or belongings for the truck (for camp gear only)",
  "I will take a few bags of trash out in my shower (If I have an RV)",
  "I will try to take bags of trash if I have a normal vehicle",
  "I will return tools and drills to Terry's tool corner on the front of the Coronado",
  "I will be careful not to take tools or items that may be in use",
  "I will check IDs at the bar",
  "I will try to attend camp meetings when possible",
  "If there is a weather emergency, I will be sure to stay engaged with the camp updates",
  "I will be very careful about my shower water usage",
];

function CampAgreementsPage({ pendingApplication, onApplicationSubmit }) {
  const [checked, setChecked] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [launching, setLaunching] = useState(false); // button darkened while saving
  const [flyFrom, setFlyFrom] = useState(null);      // {x, y} centre of the button
  const submitBtnRef = useRef(null);
  const flyTimer = useRef(null);

  useEffect(() => () => clearTimeout(flyTimer.current), []);
  const allChecked = CAMP_AGREEMENTS_LIST.every((_, i) => checked[i]);
  const checkedCount = Object.values(checked).filter(Boolean).length;

  // Captured before submitting: handleApplicationSubmit clears pendingApplication
  // on success, so the success screen must not read it to decide what to say.
  const [wasApplication, setWasApplication] = useState(false);

  const FLIGHT_MS = 1700;

  const reducedMotion = () => typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Only launch after the write has actually landed -- a failed save must show
  // the error, not fly the giraffe away.
  const launchThenFinish = () => {
    if (reducedMotion() || !submitBtnRef.current) {
      setSubmitted(true);
      return;
    }
    const b = submitBtnRef.current.getBoundingClientRect();
    setFlyFrom({ x: b.left + b.width / 2, y: b.top + b.height / 2 });
    flyTimer.current = setTimeout(() => setSubmitted(true), FLIGHT_MS);
  };

  const handleSubmit = async () => {
    if (!allChecked || submitting || launching) return;
    setSubmitError(null);
    setLaunching(true);

    if (pendingApplication && typeof onApplicationSubmit === 'function') {
      setWasApplication(true);
      setSubmitting(true);
      // Record what was actually affirmed, alongside the application.
      const payload = {
        ...pendingApplication,
        affirmations: {
          version: 1,
          affirmedAt: new Date().toISOString(),
          items: CAMP_AGREEMENTS_LIST.map((text, i) => ({ text, checked: !!checked[i] })),
        },
      };
      let result;
      try {
        result = await onApplicationSubmit(payload);
      } catch (e) {
        console.error('Application submit threw', e);
        result = { ok: false, error: 'Something went wrong while saving. Please try again.' };
      }
      setSubmitting(false);
      // Only claim success if the write actually landed.
      if (!result || result.ok !== true) {
        setLaunching(false);
        setSubmitError((result && result.error) || 'Your application could not be saved. Please try again.');
        return;
      }
    }
    launchThenFinish();
  };

  if (submitted) {
    return (
      <div className="ev-page" style={{ textAlign: 'center', paddingTop: '3rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔥</div>
        <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, fontWeight: 400, color: '#FBF0E0', marginBottom: '0.75rem' }}>
          {wasApplication ? "You're all set!" : "Affirmations complete!"}
        </h2>
        <p style={{ color: '#A88876', fontSize: 15, maxWidth: 400, margin: '0 auto' }}>
          {wasApplication
            ? 'Your application has been submitted and your affirmations are on record. See you on the playa!'
            : 'Thank you for reviewing the camp affirmations.'}
        </p>
      </div>
    );
  }

  return (
    <div className="ev-page">
      <h1 className="ev-section-h">Camp Affirmations</h1>
      {pendingApplication && (
        <div style={{ background: 'rgba(200,149,108,0.08)', border: '1px solid #C8956C', borderRadius: 10, padding: '12px 16px', marginBottom: 24 }}>
          <p style={{ fontSize: 14, color: '#C8956C', fontWeight: 500 }}>
            Almost there, {pendingApplication.name}! Check all the boxes below, then hit Submit to complete your application.
          </p>
        </div>
      )}
      {flyFrom && (
        <div className="ev-flyer" style={{ left: flyFrom.x, top: flyFrom.y }} aria-hidden="true">
          <span className="ev-flyer-inner">
            <Giraffe size={56} wings />
          </span>
        </div>
      )}
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <div style={{ background: 'var(--ev-card,#0F0805)', borderRadius: 10, padding: '1.5rem', marginBottom: '1.5rem', border: '1px solid #1E100A' }}>
          <p style={{ margin: 0, lineHeight: 1.6 }}>
            Hello Campers! Please read and affirm each item below — this will help the camp run smoothly and ensure everyone is on the same page.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
          {CAMP_AGREEMENTS_LIST.map((item, i) => (
            <label key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer', padding: '0.75rem', background: checked[i] ? 'rgba(139,96,64,0.08)' : '#0F0805', borderRadius: 8, border: '1px solid ' + (checked[i] ? '#C8956C' : '#1E100A'), transition: 'all 0.15s' }}>
              <input
                type="checkbox"
                checked={!!checked[i]}
                onChange={e => setChecked(c => ({ ...c, [i]: e.target.checked }))}
                style={{ marginTop: '2px', accentColor: '#C8956C', width: 18, height: 18, flexShrink: 0 }}
              />
              <span style={{ lineHeight: 1.5, fontSize: '0.92rem' }}>{item}</span>
            </label>
          ))}
        </div>
        {submitError && (
          <div style={{ background: 'rgba(190,70,50,0.12)', border: '1px solid #B4503C', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
            <p style={{ margin: 0, fontSize: 14, color: '#E0A090', lineHeight: 1.5 }}>{submitError}</p>
          </div>
        )}
        <button
          ref={submitBtnRef}
          className={`ev-btn ev-btn-primary${launching ? ' ev-btn-pothole' : ''}`}
          disabled={!allChecked || submitting || launching}
          onClick={handleSubmit}
          style={{ width: '100%', padding: '14px', fontSize: 15, opacity: allChecked && !submitting ? 1 : 0.5, cursor: allChecked && !submitting ? 'pointer' : 'not-allowed' }}
        >
          {submitting
            ? 'Saving…'
            : allChecked
              ? (pendingApplication ? (submitError ? 'Try Again' : 'Submit My Application ✓') : 'Acknowledged ✓')
              : `Check all boxes to continue (${checkedCount}/${CAMP_AGREEMENTS_LIST.length})`}
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

        <div style={{ background: '#0F0805', borderRadius: 10, padding: '1.5rem', border: '1px solid #1E100A' }}>
          <h2 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '1rem', color: '#C8956C' }}>Items the Camp Needs</h2>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <li>2–3 simple kitchen burners</li>
            <li>Bar mats — to keep the bar safer, especially in weather</li>
            <li>2 hard rakes</li>
          </ul>
        </div>

        <div style={{ background: '#0F0805', borderRadius: 10, padding: '1.5rem', border: '1px solid #1E100A' }}>
          <h2 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '1rem', color: '#C8956C' }}>Projects to Help the Camp</h2>
          <p style={{ color: '#6B5749', fontSize: '0.92rem', margin: 0 }}>More details coming soon. If you have ideas or want to lead a project, reach out!</p>
        </div>

        <div style={{ background: '#0F0805', borderRadius: 10, padding: '1.5rem', border: '1px solid #1E100A' }}>
          <h2 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '1rem', color: '#C8956C' }}>Sub-Task Lead Roles</h2>
          <p style={{ marginBottom: '0.75rem', fontSize: '0.92rem', color: '#A88876' }}>The camp could use help in these areas. Interested? Let a camp lead know.</p>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <li>Water Lead</li>
            <li>Bike Czar</li>
            <li>Piano Tuner</li>
            <li>Extra Wood</li>
            <li>Trash Lead — to help ensure everyone takes trash out and manages that process</li>
          </ul>
        </div>

      </div>
    </div>
  );
}

// ============================================================
// MUSIC BAR
// ============================================================
// A SoundCloud player pinned to the bottom of every page once you're past the
// lock screen. It is rendered from App's root so it never unmounts when the
// page changes -- if it were rendered per page, the iframe would reload and
// the track would restart on every nav click.
//
// Autoplay: browsers only allow a cross-origin iframe to start audio when the
// page already has user activation, which the Enter click on the lock screen
// provides. `allow="autoplay"` passes that activation into the iframe. iOS
// Safari ignores it, so the widget's own play button is left visible.

const MUSIC_TRACK_URL = 'https://soundcloud.com/coronado_collective/102223-violet-ride-flow';
const MUSIC_DISMISS_KEY = 'ev-music-dismissed';

function musicEmbedSrc() {
  const params = new URLSearchParams({
    url: MUSIC_TRACK_URL,
    color: '#c8956c',
    auto_play: 'true',
    hide_related: 'true',
    show_comments: 'false',
    show_user: 'true',
    show_reposts: 'false',
    show_teaser: 'false',
    visual: 'false',
  });
  return `https://w.soundcloud.com/player/?${params.toString()}`;
}

function MusicBar() {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(MUSIC_DISMISS_KEY) === '1'; } catch (e) { return false; }
  });

  // The bar floats over the bottom of the page, so the document needs room
  // underneath it or the last row of any page sits behind it.
  useEffect(() => {
    if (dismissed) return undefined;
    document.body.classList.add('ev-has-music');
    return () => document.body.classList.remove('ev-has-music');
  }, [dismissed]);

  if (dismissed) return null;

  return (
    <div className="ev-music-bar">
      <iframe
        title="Beverly Grillz camp track"
        src={musicEmbedSrc()}
        height="66"
        scrolling="no"
        frameBorder="no"
        allow="autoplay"
      />
      <button
        className="ev-music-close"
        title="Hide the music player"
        aria-label="Hide the music player"
        onClick={() => {
          setDismissed(true);
          try { localStorage.setItem(MUSIC_DISMISS_KEY, '1'); } catch (e) {}
        }}
      >
        ×
      </button>
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================

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
  const [packingChecks, setPackingChecks] = useState({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  // Pending application (form data waiting for agreements to be signed)
  const [pendingApplication, setPendingApplication] = useState(null);
  const [navIntercept, setNavIntercept] = useState(null); // tab id user tried to go to
  const [applicationsError, setApplicationsError] = useState(false);

  useEffect(() => {
    (async () => {
      let applicationsFailed = false;
      const [cfg, sh, pk, rs, ap, cal, pcChk] = await Promise.all([
        load('config', DEFAULT_CONFIG, true),
        load('shifts', DEFAULT_SHIFTS, true),
        load('packing', DEFAULT_PACKING, true),
        load('resources', DEFAULT_RESOURCES, true),
        loadAllApplications().catch(e => { console.error(e); applicationsFailed = true; return []; }),
        load('calendar', DEFAULT_CALENDAR, true),
        load('packingChecks', {}, false),
      ]);
      setConfig(cfg);
      setShifts(sh);
      setPackingItems(pk);
      setResources(rs);
      setApplications(ap);
      setApplicationsError(applicationsFailed);
      setCalendar(cal);
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

  // Called when user fills out apply form and clicks "Continue to Agreements"
  const handleContinueToAgreements = (formData) => {
    setPendingApplication(formData);
    setPage('campAgreements');
  };

  // Called when user finishes agreements — saves application + sends to Google Sheet.
  // Returns { ok: boolean, error?: string }. The caller must NOT show a success
  // screen unless ok === true.
  const handleApplicationSubmit = async (appData) => {
    const application = {
      id: newId(),
      ...appData,
    };

    // Written as its own Supabase row — no read-modify-write, so a simultaneous
    // submit by someone else cannot overwrite this one (or vice versa).
    const saved = await saveApplication(application);
    if (!saved) {
      return { ok: false, error: 'Your application could not be saved. Please try again, or email camp leadership.' };
    }
    setApplications(prev => [...prev, application]);

    // Post to Google Sheet if configured.
    // no-cors means the response is opaque, so a bad URL cannot be detected
    // here — that is why an unset URL is surfaced in the Admin panel instead.
    if (config.applicationsSheet) {
      fetch(config.applicationsSheet, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(application),
      }).catch(() => {});
    } else {
      console.warn('config.applicationsSheet is empty — application saved to Supabase only, nothing sent to the Google Sheet.');
    }

    setPendingApplication(null);
    return { ok: true };
  };

  const handleDeleteApplication = async (application) => {
    const ok = await deleteApplication(application);
    if (ok) {
      // Match on id when both have one, otherwise on email + timestamp.
      // A plain `x.id !== application.id` would drop every legacy record
      // that has no id at all.
      const stamp = (v) => v.submittedAt || v.appliedAt || '';
      const isSame = (x) => x === application
        || (application.id && x.id ? x.id === application.id
            : String(x.email || '').trim().toLowerCase() === String(application.email || '').trim().toLowerCase()
              && stamp(x) === stamp(application));
      setApplications(prev => prev.filter(x => !isSame(x)));
    }
    return ok;
  };

  const NAV_TABS = [
    { id: 'home', label: 'Home' },
    { id: 'apply', label: 'Apply' },
    { id: 'campAgreements', label: 'Affirmations' },
    { id: 'shifts', label: 'Shifts' },
    { id: 'rideShare', label: 'Ride Share' },
    { id: 'packing', label: 'Packing' },
    { id: 'dates', label: 'Dates' },
    { id: 'resources', label: 'Resources' },
    { id: 'campNeeds', label: 'Camp Needs' },
    { id: 'admin', label: 'Admin' },
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

  const discardApplication = (goTo) => {
    setPendingApplication(null);
    setNavIntercept(null);
    setPage(goTo);
  };

  return (
    <>
      <InjectCSS />
      {navIntercept && (
        <div className="ev-modal-backdrop" onClick={() => setNavIntercept(null)}>
          <div className="ev-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
            <h2 style={{ fontSize: 22, marginBottom: 10 }}>Application in Progress</h2>
            <p style={{ marginBottom: 24 }}>
              You started filling out an application. If you leave now, your information will <strong style={{ color: '#C8956C' }}>not be saved</strong> — you'll need to start over.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button className="ev-btn ev-btn-primary" style={{ width: '100%' }} onClick={() => { setNavIntercept(null); setPage('campAgreements'); }}>
                Go back and complete Affirmations →
              </button>
              <button className="ev-btn ev-btn-ghost" style={{ width: '100%' }} onClick={() => discardApplication(navIntercept)}>
                Discard my application and leave
              </button>
            </div>
          </div>
        </div>
      )}
      <nav className="ev-nav">
        <span className="ev-nav-brand" onClick={() => setPage('home')}>{config.eventName}</span>
        <div className="ev-nav-tabs">
          {NAV_TABS.map(t => (
            <button
              key={t.id}
              className={
                `ev-nav-tab${page === t.id ? ' active' : ''}` +
                (pendingApplication && t.id === 'campAgreements' && page !== 'campAgreements' ? ' ev-nav-tab-pulse' : '')
              }
              onClick={() => {
                // A half-finished application only lives in memory. Warn before
                // navigating away from the Affirmations step instead of losing it.
                if (pendingApplication && t.id !== 'campAgreements' && page === 'campAgreements') {
                  setNavIntercept(t.id);
                  return;
                }
                setPage(t.id);
              }}
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
        <UnifiedApplyPage
          config={config}
          onContinueToAgreements={handleContinueToAgreements}
        />
      )}
      {page === 'shifts' && <ShiftsPage config={config} />}
      {page === 'rideShare' && <RideSharePage />}
      {page === 'dates' && <DatesPage calendar={calendar} />}
      {page === 'resources' && <ResourcesPage resources={resources} />}
      {page === 'packing' && (
        <PackingPage
          items={packingItems} checks={packingChecks}
          setChecks={setPackingChecks}
        />
      )}
      {page === 'campAgreements' && (
        <CampAgreementsPage
          pendingApplication={pendingApplication}
          onApplicationSubmit={handleApplicationSubmit}
        />
      )}
      {page === 'campNeeds' && <CampNeedsPage />}
      {page === 'admin' && (
        isAdmin
          ? <AdminPage
              config={config} shifts={shifts} resources={resources}
              packingItems={packingItems} applications={applications} applicationsError={applicationsError}
              onDeleteApplication={handleDeleteApplication} calendar={calendar}
              updateConfig={updateConfig} updateShifts={updateShifts}
              updateResources={updateResources} updatePacking={updatePacking}
              updateCalendar={updateCalendar}
              onLogout={() => setIsAdmin(false)}
            />
          : <AdminLock config={config} onLogin={() => setIsAdmin(true)} />
      )}

      <MusicBar />
    </>
  );
}
