# Design

## Theme

BroadLister is a product UI for focused editorial operations. The physical scene: a Sevenfold operator reviewing sensitive client media targets on a laptop at a desk, then checking a campaign list from a phone while away from the machine. The interface should be light, quiet, and high-contrast, with warm paper-like surfaces and restrained ink/olive/clay accents.

## Color

Use OKLCH design tokens. Avoid pure black and white. Keep the palette restrained:

- Canvas: warm neutral paper.
- Surface: slightly lifted warm panel.
- Surface muted: subtle olive-gray for navigation and secondary panels.
- Ink: tinted near-black for primary text.
- Muted text: warm brown-gray for helper copy.
- Accent: clay/rust for current selection and primary actions.
- Success: muted green.
- Warning: amber.
- Danger: muted red.
- Focus: strong clay ring with enough contrast.

## Typography

Use a system sans stack for product clarity:

`-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`

Use a tight product scale. Labels and table text should be legible at desktop and mobile sizes. Avoid display fonts in controls, data, or labels.

## Layout

Use a persistent app shell on desktop with compact navigation, strong section headers, and two-pane workspace/detail patterns when space allows. Collapse to one column on tablet and phone. Mobile navigation must wrap cleanly and remain touch-friendly. Detail panels become inline sections on narrow screens.

## Components

- Buttons: consistent rounded rectangles or pills, with default, hover, focus, disabled, and loading states.
- Inputs: labeled, full-width on mobile, clear helper/error copy.
- Tables: readable, horizontally safe on mobile via card-like row reflow where needed.
- Panels: minimal elevation, no glassmorphism.
- Notices: explicit status and safety copy, not decorative cards.
- Review items: clear status, action buttons, keyboard shortcut hints.

## Motion

Use short 150-220ms transitions for hover, focus, and panel changes. Do not animate layout properties. Respect `prefers-reduced-motion`.

## Copy

Use precise operator language: review item, campaign overlay, source audit, approval log, draft export. Do not use CRM or sales language such as pipeline, deal, sequence, cadence, lead score, or engagement velocity. No em dashes.

