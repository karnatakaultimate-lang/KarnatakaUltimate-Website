---
name: KUPA
description: The digital home base for athletes — events, teams, and community in one place.
colors:
  club-red: "#d32f2f"
  ink: "#212121"
  field-grey: "#f5f5f5"
  surface-white: "#ffffff"
  border: "#e0e0e0"
  text-secondary: "#757575"
  warning-amber: "#f57c00"
  success-green: "#388e3c"
  avatar-bg: "#e0e0e0"
typography:
  display:
    fontFamily: "Inter, Helvetica, Arial, sans-serif"
    fontSize: "clamp(1.75rem, 4vw, 2.25rem)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Inter, Helvetica, Arial, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Inter, Helvetica, Arial, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Inter, Helvetica, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Inter, Helvetica, Arial, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    letterSpacing: "0.02em"
rounded:
  sm: "8px"
  md: "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.club-red}"
    textColor: "{colors.surface-white}"
    rounded: "{rounded.sm}"
    padding: "10px 24px"
  button-primary-hover:
    backgroundColor: "#b71c1c"
    textColor: "{colors.surface-white}"
    rounded: "{rounded.sm}"
    padding: "10px 24px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.club-red}"
    rounded: "{rounded.sm}"
    padding: "10px 24px"
  card:
    backgroundColor: "{colors.surface-white}"
    rounded: "{rounded.md}"
---

# Design System: KUPA

## 1. Overview

**Creative North Star: "The Broadcast Signal"**

KUPA is built around the visual grammar of sports broadcasting: a hierarchy so clear that what matters is legible at a glance. Every screen answers one question first — the upcoming match, the open RSVP, the live roster — then organizes everything else beneath it. The red is not decoration; it is the signal. When it appears, it means something: an action to take, a status that matters, a moment of consequence.

The surface is clean light grey (#f5f5f5) — not a warm cream, not a branded neutral, just the neutral ground a clubhouse notice board needs. White cards float above it with soft shadow. The system is compact without being cramped, informative without feeling like a dashboard. This is a community platform, not a data tool.

The typography is single-weight-family: Inter at 400/600/700. No serif, no decorative type. Hierarchy comes from weight and size, not from pairing drama. This is intentional — broadcast graphics don't pair Garamond with Futura; they commit to the one font that reads fast from a distance.

This system explicitly rejects: the grey corporate intranet (lifeless, role-obsessed, uninviting), the SaaS dashboard template (metric-hero tiles, identical card grids, sidebar-blue), and the kiddy-club energy (rounded bubbly type, mascots, pastel everything). KUPA is for adults who take their sport seriously and expect their club platform to match that intensity.

**Key Characteristics:**
- Club red is the primary signal: primary CTA, active state, live badge. Nowhere else.
- Cards lift off the grey ground — they are objects, not regions.
- Type hierarchy is decisive: one heading per section, one dominant action per card.
- Mobile-native pacing — the layout earns its mobile form first.
- Community warmth lives in content (team photos, avatars, event names), not in decorative rounding or pastel accents.

## 2. Colors: The Signal Palette

A two-color identity (red + near-black) expanded with functional neutrals. The palette does not add color for warmth; warmth comes from the content.

### Primary
- **Club Red** (`#d32f2f`): The identity color. Used on primary buttons, active navigation states, status badges ("Live", "RSVP Open"), progress indicators, and the top border accent on key cards. Never used as a background for large areas.

### Secondary
- **Ink** (`#212121`): Near-black for headings, secondary buttons, and the mobile drawer background. Also used as text in high-emphasis labels that should not carry the red signal.

### Neutral
- **Field Grey** (`#f5f5f5`): The body background. Provides the canvas that makes white cards read as lifted objects.
- **Surface White** (`#ffffff`): Card and paper surface. AppBar background. All primary content containers.
- **Border** (`#e0e0e0`): Dividers, input strokes, avatar fallback fill. Never the same value as text — contrast is too low.
- **Text Secondary** (`#757575`): Subheadings, captions, secondary metadata. Must clear 4.5:1 on white (#ffffff) — this value (4.54:1) just passes; do not go lighter.
- **Avatar Bg** (`#e0e0e0`): Fallback background for person avatars. Chosen to not conflict with team logos (which may be red).

### Semantic
- **Warning Amber** (`#f57c00`): Admin panel accents only. Admin status chips, the Admin Panel menu item. Never used in member-facing UI.
- **Success Green** (`#388e3c`): Confirmed RSVP state, resolved grievance status. Used sparingly.

### Named Rules
**The One Signal Rule.** Club Red appears on ≤2 elements per screen at any time. Its rarity is what makes it mean "act here." Seeing red twice on the same card means one of them is wrong.

**The No Warm-Neutral Rule.** The grey palette has zero warm or cool tint. `#f5f5f5` is chroma-zero neutral. Do not swap it for beige, cream, sand, or any warm-tinted near-white. Warmth in KUPA is in the club photography and team colors, not the chrome.

## 3. Typography

**Display / Headline / Body Font:** Inter (Helvetica, Arial, sans-serif fallback)

**Character:** A single-family system — Inter at three weights (400, 600, 700). Hierarchy is built from size and weight contrast, not from family contrast. This is the broadcast-graphics approach: one face, used decisively. No serif counterpoint, no decorative display face.

### Hierarchy
- **Display** (700, clamp(1.75rem, 4vw, 2.25rem), lh 1.2, ls -0.02em): Page-level hero titles, the event name on EventDetails, the hero carousel headline. Max ~36px desktop. Never larger than `2.25rem` (`clamp` ceiling).
- **Headline** (700, 1.5rem, lh 1.3, ls -0.01em): Card section headers (e.g. "Attendees", "Hosted By"), dialog titles, announcement titles.
- **Title** (600, 1.125rem, lh 1.4): Card sub-headers, list item labels, chip group labels.
- **Body** (400, 1rem, lh 1.6): All body copy. Line length capped at 70ch on prose sections; use `max-width: 70ch` on description paragraphs.
- **Label** (600, 0.75rem, ls 0.02em): Metadata chips, status indicators, navigation sub-labels, caption timestamps. All caps only for status badges, not for general labels.

### Named Rules
**The No Eyebrow Rule.** Never use a small all-caps tracked label above every card heading. One status chip or metadata line per card is fine; a structural eyebrow above the heading on every section is the AI scaffold tell.

**The Letter-Spacing Floor.** Display and headline letter-spacing at -0.02em to -0.01em. Never below -0.04em — at that point letters touch. Inter is optically tight at large sizes; -0.02em is plenty.

## 4. Elevation

Lifted surfaces. Cards float above the field-grey ground using a single ambient shadow vocabulary. The system does not use tonal elevation (Material You-style surface tints) — white-on-grey contrast handles containment, shadow handles perceived height.

### Shadow Vocabulary
- **Card ambient** (`0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)`): Default card and content container. Tailwind `shadow-md` equivalent. Soft, diffuse — the card reads as lifted without shouting.
- **AppBar** (MUI `boxShadow: 1` ≈ `0 2px 4px -1px rgb(0 0 0 / 0.1)`): Navigation bar subtle separation from content below.
- **Modal / Dialog** (`0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)`): Dialogs sit visibly above the backdrop. Tailwind `shadow-xl` equivalent.
- **Drawer**: No additional shadow beyond MUI default — drawers are temporary overlays, the backdrop scrim handles separation.

### Named Rules
**The Single Shadow Rule.** A surface uses one shadow role only. No `border: 1px solid X` plus a wide drop shadow on the same card — pick the shadow. The border is for interactive states (focus rings on inputs), not ambient decoration.

## 5. Components

### Buttons
Decisive and direct: solid fills, clear labels, no decorative rounding beyond 8px.

- **Shape:** Gently curved (8px radius). Not pill-shaped. Not square.
- **Primary (contained):** Club Red (`#d32f2f`) fill, white text, 600 weight, `textTransform: none`. Padding: 10px 24px desktop / 8px 20px compact. The primary action on any given screen.
- **Hover:** Darkens to `#b71c1c` (red 900). No scale transform, no shadow addition.
- **Secondary (outlined):** Club Red border, Club Red text, transparent fill. Used for secondary confirmations and share actions.
- **Ghost / text:** No border, no fill. `textTransform: none`, 600 weight. Used for back navigation, cancel actions, and footer links.
- **Disabled:** 38% opacity of the default variant. No special color.

### Chips
Status and metadata at a glance.

- **Status chips (MUI color variants):** Error (red) for open/live, Warning (amber) for in-progress, Success (green) for confirmed/resolved, Default (grey) for neutral. `fontWeight: bold`, no icon by default.
- **Info chips (outlined):** Outlined variant for category labels, event type, team role. No fill. Used when the label is metadata, not a state.
- **Size:** Default MUI chip height (32px). Label: 0.75rem, 600 weight.

### Cards / Containers
The primary layout unit. Cards are used when content is discrete and groupable — not as a default wrapper for every section.

- **Corner Style:** Gently rounded (16px radius, at the allowed ceiling for cards).
- **Background:** Surface White (`#ffffff`).
- **Shadow:** Card ambient shadow (see Elevation). No border.
- **Top accent (key cards only):** A 6px solid top border in Club Red is used on the primary content card per page (e.g. the event header card, the grievance card). Intentional, not default.
- **Internal Padding:** 24px (lg) standard; 20px (md) on compact / mobile-adjusted cards.
- **Nested cards:** Forbidden. Never put a Card inside another Card.

### Inputs / Fields
- **Style:** MUI outlined variant. 1px border in Border (`#e0e0e0`) at rest.
- **Focus:** Border shifts to Club Red (`#d32f2f`), 2px width. No glow or shadow on inputs — the border shift is the focus signal.
- **Error:** Border and label shift to error red (`#d32f2f` — same as primary; MUI handles this via `color="error"`).
- **Placeholder text:** Inherits MUI default `text.disabled` — must be verified against the 4.5:1 threshold on each deployment.

### Navigation
- **AppBar:** White (`#ffffff`) sticky bar, `color: text.primary`, `boxShadow: 1` (ambient separation). Not colored — the logo and red CTAs provide identity.
- **Active link:** Club Red (`primary.main`). Weight 600.
- **Inactive link:** Text secondary (`text.secondary`, ~`#757575`). Weight 600. No underline, no background.
- **myKUPA button:** Contained primary (red fill). Right-anchored. The single CTA in the nav.
- **Mobile:** Hamburger (left) / Logo (centered) / Spacer (right). Drawer width 280px, left-anchored. Active drawer items use `action.selected` background tint, red icon and text.

### HeroCarousel
The signature component — full-bleed image with a bottom gradient overlay for caption legibility.

- **Dimensions:** `height: { xs: 240px, sm: 360px, md: 500px }`. Always full-width to the container edge.
- **Overlay:** `linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.8) 100%)` — applied only when title or description are present. No overlay on image-only slides.
- **Caption:** Display typography, white, `textShadow: 1px 1px 6px rgba(0,0,0,0.7)`. Description hidden on xs (too much noise at small viewport).
- **Transition:** 0.8s opacity crossfade — smooth and reduced-motion safe (opacity/crossfade is the reduced-motion fallback by default).
- **Controls:** Semi-transparent dark scrim buttons (`rgba(0,0,0,0.3)`), white icons. Dot indicators with 50% white for inactive.

### Avatars
Person avatars use a grey fill (`#e0e0e0`) and show the user's profile photo when available.

- **Size (standard):** 40×40px. Compact list: 28×28px (24px on xs).
- **Fallback:** Initials at 600 weight on grey bg (`#e0e0e0`). Never red background (conflicts with team logos that may also be red).
- **Profile photo:** Loaded as `<img>` child of MUI Avatar with `referrerPolicy="no-referrer"` (required for Google Auth photo URLs from `lh3.googleusercontent.com`).

## 6. Do's and Don'ts

### Do:
- **Do** use Club Red (`#d32f2f`) for exactly one primary CTA per screen and for active navigation states.
- **Do** cap body prose at `max-width: 70ch` on description paragraphs for readability.
- **Do** use the soft card ambient shadow and white background — cards should feel physically lifted above the grey canvas.
- **Do** use `textTransform: none` on all buttons; sentence-case labels read faster and feel less like legacy enterprise UI.
- **Do** use `referrerPolicy="no-referrer"` on all `<img>` tags loading Google photo URLs.
- **Do** write `prefers-reduced-motion` alternatives for every animation — use opacity crossfade as the fallback when transform/translate are the primary effect.
- **Do** use a 6px top border in Club Red only on the single dominant card per page (event header, grievance header) — it signals "this is the primary artifact of this page."

### Don't:
- **Don't** use Club Red as a background color for large areas, hero sections, or card fills. It is a signal color, not a surface.
- **Don't** use `border: 1px solid X` and a box-shadow wider than 8px blur on the same element. The ghost-card pattern: pick one.
- **Don't** use `border-radius` larger than 16px on cards or content containers. 16px is the ceiling; 24px or 32px reads as a toy, not a sports platform.
- **Don't** use warm-tinted neutrals (`#faf5f0`, cream, beige, sand) for backgrounds. The palette is chroma-zero neutral grey. Warmth comes from photography and team colors, not chrome.
- **Don't** nest MUI Cards. An inner Card inside an outer Card collapses visual hierarchy — use a `Box` with appropriate padding and a divider instead.
- **Don't** add a structural eyebrow (small tracked all-caps label above every section heading). A single status chip or metadata chip per item is fine; eyebrows on every card section is the AI scaffold tell.
- **Don't** make the interface feel like a generic corporate HR tool (tabled data everywhere, grey headers, muted palette with no club identity), a kids' app (bubbly type, pastel chip fills, cartoon icons), or a SaaS startup dashboard (metric-hero grid, identical icon+heading+text card grid).
- **Don't** use `border-left` or `border-right` wider than 1px as a colored accent stripe on cards or list items. Use a full top border, a background tint, or nothing.
