// ============================================================
// THE TEN PRINCIPLES
// ============================================================
// Larry Harvey wrote these in 2004, not as commandments but as a description
// of the culture that had already grown up around the event. The text is
// reproduced verbatim — it is short, it is quoted everywhere, and paraphrasing
// it would be its own small vandalism.

import PlayaBanner from './PlayaBanner';

const PRINCIPLES = [
  {
    name: 'Radical Inclusion',
    body: 'Anyone may be a part of Burning Man. We welcome and respect the stranger. No prerequisites exist for participation in our community.',
  },
  {
    name: 'Decommodification',
    body: 'In order to preserve the spirit of gifting, our community seeks to create social environments that are unmediated by commercial sponsorships, transactions, or advertising. We stand ready to protect our culture from such exploitation. We resist the substitution of consumption for participatory experience.',
  },
  {
    name: 'Gifting',
    body: 'Burning Man is devoted to acts of gift giving. The value of a gift is unconditional. Gifting does not contemplate a return or an exchange for something of equal value.',
  },
  {
    name: 'Radical Self-reliance',
    body: 'Burning Man encourages the individual to discover, exercise and rely on their inner resources.',
  },
  {
    name: 'Communal Effort',
    body: 'Our community values creative cooperation and collaboration. We strive to produce, promote and protect social networks, public spaces, works of art, and methods of communication that support such interaction.',
  },
  {
    name: 'Radical Self-expression',
    body: 'Radical self-expression arises from the unique gifts of the individual. No one other than the individual or a collaborating group can determine its content. It is offered as a gift to others. In this spirit, the giver should respect the rights and liberties of the recipient.',
  },
  {
    name: 'Civic Responsibility',
    body: 'We value civil society. Community members who organize events should assume responsibility for public welfare and endeavor to communicate civic responsibilities to participants. They must also assume responsibility for conducting events in accordance with local, state and federal laws.',
  },
  {
    name: 'Leaving No Trace',
    body: 'Our community respects the environment. We are committed to leaving no physical trace of our activities wherever we gather. We clean up after ourselves and endeavor, whenever possible, to leave such places in a better state than when we found them.',
  },
  {
    name: 'Participation',
    body: 'Our community is committed to a radically participatory ethic. We believe that transformative change, whether in the individual or in society, can occur only through the medium of deeply personal participation. We achieve being through doing. Everyone is invited to work. Everyone is invited to play. We make the world real through actions that open the heart.',
  },
  {
    name: 'Immediacy',
    body: 'Immediate experience is, in many ways, the most important touchstone of value in our culture. We seek to overcome barriers that stand between us and a recognition of our inner selves, the reality of those around us, participation in society, and contact with a natural world exceeding human powers. No idea can substitute for this experience.',
  },
];

export default function PrinciplesPage() {
  return (
    <div className="ev-page ev-page-packing">
      {/* Same sunrise rails as Packing and Affirmations — this is another long
          single-column read, so the margins are doing nothing else. */}
      <div className="ev-rail ev-rail-l" aria-hidden="true" />
      <div className="ev-rail ev-rail-r" aria-hidden="true" />

      <h1 className="ev-section-h">The Ten Principles</h1>
      <p className="ev-section-sub" style={{ marginBottom: 28 }}>
        Written by Larry Harvey in 2004 — not as rules handed down, but as a
        description of the culture that had already grown up on its own.
      </p>

      {PRINCIPLES.map((p, i) => (
        <div
          key={p.name}
          style={{
            display: 'flex',
            gap: 18,
            padding: '20px 0',
            borderBottom: i < PRINCIPLES.length - 1
              ? '1px solid rgba(200,149,108,0.15)'
              : 'none',
          }}
        >
          {/* The numeral is set large and dim: it gives the list a spine and a
              sense of progression without competing with the words, which are
              the point. */}
          <div
            aria-hidden="true"
            style={{
              fontFamily: 'Cormorant Garamond, serif',
              fontSize: 34,
              lineHeight: 1,
              color: 'rgba(200,149,108,0.32)',
              minWidth: 46,
              flexShrink: 0,
              paddingTop: 2,
            }}
          >
            {String(i + 1).padStart(2, '0')}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <h2
              style={{
                fontFamily: 'Cormorant Garamond, serif',
                fontSize: 26,
                fontWeight: 400,
                color: '#C8956C',
                margin: '0 0 8px',
                lineHeight: 1.15,
              }}
            >
              {p.name}
            </h2>
            <p
              style={{
                color: '#C8B49E',
                fontSize: 15,
                lineHeight: 1.68,
                margin: 0,
              }}
            >
              {p.body}
            </p>
          </div>
        </div>
      ))}

      <p style={{ color: '#6B5749', fontSize: 12.5, marginTop: 28, lineHeight: 1.6 }}>
        The Ten Principles are published by{' '}
        <a
          href="https://burningman.org/about/10-principles/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#C8956C' }}
        >
          Burning Man Project
        </a>
        .
      </p>

      <PlayaBanner />
    </div>
  );
}
