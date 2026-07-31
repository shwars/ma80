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

The album fills `100svh`. A single contained photograph sits in a full-bleed ambient field. Navigation, counter, age, and scrubber occupy mobile safe areas and never cover the protagonist's face unnecessarily. Desktop enlarges the print but preserves the one-photo rhythm.

## Motion

Slides leave laterally with slight perspective, scale, blur, and rotation while the next photograph arrives from the opposite side. Dragging follows the pointer before committing. Motion uses an exponential ease-out and never bounces. Reduced motion replaces spatial travel with a short crossfade.

## Components

- Cover: three photographic fragments, title, short instruction, and one start button.
- Photo stage: ambient backdrop, current image, age/year label, variant label, and position counter.
- Navigation: generous previous/next buttons, swipe/pointer gestures, keyboard arrows, and a range-based timeline scrubber.
- Utility: fullscreen toggle and first-visit gesture hint.
