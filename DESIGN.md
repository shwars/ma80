# Design System

## Direction

The physical reference is a dark table scattered with family prints. Seven dimmed, rotated photographs form a loose pile while the current photograph is lifted above them at full clarity. The interface disappears around this composition.

## Color

- `--ink`: `oklch(0.96 0 0)`
- `--muted`: `oklch(0.76 0.012 230)`
- `--bg`: `oklch(0.08 0 0)`
- `--surface`: `oklch(0.14 0.014 230)`
- `--primary`: `oklch(0.45 0.086 230)`
- `--accent`: `oklch(0.78 0.12 82)`

The strategy is restrained on controls but visually drenched by the current photograph and its blurred ambient echo.

## Typography

Use Manrope for the small status readout and gesture hint, with local sans-serif fallbacks. Photography—not typography—carries the hierarchy.

## Layout

The album fills the current visual viewport and updates width, height, and viewport offsets after rotation. The active photograph is strictly contained at the largest possible size. The pile recomputes around its aspect ratio and viewport orientation; invisible navigation occupies the left and right edges.

## Motion

The selected next image rises from its existing pile pose to full size and clarity. Simultaneously, the outgoing image shrinks, rotates, dims, and settles into its exact pose in the next pile. Dragging follows the pointer before committing. Reduced motion uses a short crossfade.

## Components

- Photo stage: ambient backdrop, seven-photo deterministic pile, and one maximally sized contained image.
- Navigation: swipe/pointer gestures, invisible 25% edge tap zones, and keyboard arrows.
- Utility: a fading age/counter pill and a first-visit gesture hint.
