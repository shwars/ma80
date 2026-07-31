# Design System

## Direction

The physical reference is a dark photographic light table at dusk: nearly black surroundings, deep harbor-blue navigation, and small brass timeline marks. The interface should disappear around the image and feel more like handling prints than browsing a web gallery.

## Color

- `--ink`: `oklch(0.96 0 0)`
- `--muted`: `oklch(0.76 0.012 230)`
- `--bg`: `oklch(0.08 0 0)`
- `--surface`: `oklch(0.14 0.014 230)`
- `--primary`: `oklch(0.45 0.086 230)`
- `--accent`: `oklch(0.78 0.12 82)`

The strategy is restrained on controls but visually drenched by the current photograph and its blurred ambient echo.

## Typography

Use Prata for the brief celebratory display line and Manrope for controls and metadata, with local serif and sans-serif fallbacks. Display tracking never goes below `-0.03em`; compact copy is balanced rather than all-caps.

## Layout

The album fills the current visual viewport and updates that measurement after rotation. A single contained photograph uses the entire stage inside mobile safe areas. Navigation is invisible at the left and right edges; a compact age/counter pill floats at the bottom.

## Motion

Slides leave laterally with slight perspective, scale, blur, and rotation while the next photograph arrives from the opposite side. Dragging follows the pointer before committing. Motion uses an exponential ease-out and never bounces. Reduced motion replaces spatial travel with a short crossfade.

## Components

- Cover: three photographic fragments, title, short instruction, and one start button.
- Photo stage: ambient backdrop and one maximally sized contained image.
- Navigation: swipe/pointer gestures, invisible 25% edge tap zones, and keyboard arrows.
- Utility: one close button, a fading age/counter pill, and a first-visit gesture hint.
