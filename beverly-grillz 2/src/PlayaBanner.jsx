// ============================================================
// PLAYA BANNER
// ============================================================
// The sunrise panorama that closes a page. Used at the foot of Resources,
// Dates and the Ten Principles.
//
// Pulled out of ResourcesPage rather than pasted three times: the full-bleed
// trick below is fiddly enough that three copies would drift apart the first
// time one of them got adjusted.
//
// HOW THE FULL-BLEED WORKS
// The page content sits in a centred, max-width column. `width: 100vw` with
// `left: 50%` and `margin-left: -50vw` breaks an element out of that column
// and spans it edge to edge regardless of how wide the column is.
//
// The source is 4.4:1, so height is clamped and the image crops from the
// centre instead of letterboxing into a sliver on narrow screens. The top
// fade blends it into the page rather than starting on a hard seam.

export default function PlayaBanner({ marginTop = 40 }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'relative',
        width: '100vw',
        left: '50%',
        marginLeft: '-50vw',
        marginTop,
        marginBottom: -40,
        lineHeight: 0,
        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, #000 14%)',
        maskImage: 'linear-gradient(to bottom, transparent 0%, #000 14%)',
      }}
    >
      <img
        src="/playa-panorama.jpg"
        alt=""
        loading="lazy"
        decoding="async"
        style={{
          display: 'block',
          width: '100%',
          height: 'clamp(150px, 22vw, 300px)',
          objectFit: 'cover',
          objectPosition: 'center 45%',
        }}
      />
    </div>
  );
}
