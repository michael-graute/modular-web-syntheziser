# Feature Specification: Touch Support for iPad & Large Touch Devices

**Feature Branch**: `017-touch-support`  
**Created**: 2026-04-29  
**Status**: Draft  
**Input**: User description: "Touch support. We need touch support in addition to only mouse events, so that the app can be used with larger touch-devices like iPad."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Interact with Canvas Controls (Priority: P1)

An iPad user opens the synthesizer and adjusts knobs and sliders on components using touch. They press and drag vertically on a knob to change its value, and drag a slider thumb to adjust a parameter — the same way a desktop user would use a mouse.

**Why this priority**: Knobs and sliders are the primary way users interact with every component. Without touch support for controls, the app is effectively unusable on a touch device.

**Independent Test**: Place a single component on the canvas, open on iPad, and verify knob drag and slider drag correctly change parameter values.

**Acceptance Scenarios**:

1. **Given** a component with a knob is on the canvas, **When** the user presses and drags vertically on the knob with one finger, **Then** the knob value changes proportionally to the drag distance, matching the same behaviour as mouse drag.
2. **Given** a component with a slider is on the canvas, **When** the user presses and drags the slider thumb with one finger, **Then** the slider value updates continuously during the drag and settles at release.
3. **Given** a knob or slider is being adjusted via touch, **When** the user lifts their finger, **Then** the final value is committed and the control returns to idle state.

---

### User Story 2 - Move Components on the Canvas (Priority: P2)

An iPad user rearranges synthesizer components on the canvas by pressing and dragging them to new positions with one finger, just as a desktop user would click-drag.

**Why this priority**: Patch layout management is a core part of the workflow. Users need to be able to organise their patches spatially on touch.

**Independent Test**: Add two components to the canvas, drag one to a new position via touch, and verify it moves and stays at the new location.

**Acceptance Scenarios**:

1. **Given** a component on the canvas, **When** the user presses and holds on the component header and drags, **Then** the component follows the finger and is repositioned on release.
2. **Given** multiple selected components, **When** the user drags one of them via touch, **Then** all selected components move together.
3. **Given** a component is being dragged, **When** the user releases their finger, **Then** the component snaps to its final position and the drag state clears.

---

### User Story 3 - Pan and Zoom the Canvas (Priority: P2)

An iPad user navigates a large patch by panning the canvas with two fingers and zooming in/out with a standard pinch gesture.

**Why this priority**: Patches can be large and complex. Without pan/zoom via touch, users cannot navigate patches that extend beyond the viewport.

**Independent Test**: Create a patch with components spread across a large area, use two-finger pan and pinch-zoom on iPad to navigate to and zoom in on a distant component.

**Acceptance Scenarios**:

1. **Given** the canvas contains components, **When** the user drags with two fingers on an empty canvas area, **Then** the viewport pans in the direction of the gesture.
2. **Given** the canvas is visible, **When** the user performs a pinch gesture (two fingers moving apart or together), **Then** the canvas zooms in or out centred on the midpoint of the two fingers.
3. **Given** the user is panning or pinching, **When** they lift both fingers, **Then** the viewport state is stable and no unintended interaction (component move, knob drag) occurs.

---

### User Story 4 - Connect and Disconnect Cables (Priority: P3)

An iPad user connects two components by tapping an output port and then tapping an input port. They disconnect a cable by tapping on an existing connection.

**Why this priority**: Cable patching is essential to the modular workflow, but is a more precise interaction. Placed at P3 as basic control and navigation should work first.

**Independent Test**: On iPad, connect an oscillator output to a filter input by tapping both ports in sequence, verify the cable is drawn and audio routing changes.

**Acceptance Scenarios**:

1. **Given** two components with compatible ports, **When** the user taps an output port, **Then** a cable preview starts from that port following the finger.
2. **Given** a cable preview is active, **When** the user taps a compatible input port, **Then** the cable is connected and audio routing is established.
3. **Given** an existing cable connection, **When** the user taps the cable or either of its connected ports, **Then** the cable is removed.

---

### User Story 5 - Add Components from the Sidebar (Priority: P3)

An iPad user opens the component sidebar by tapping a toggle button, browses the module list, and adds a module to the canvas by tapping it. The sidebar can be closed again to reclaim canvas space.

**Why this priority**: The HTML5 drag-and-drop API used in the sidebar does not work on touch devices. A tap-to-add interaction provides a touch-compatible alternative.

**Independent Test**: On iPad, tap the sidebar toggle button to open it, tap a component type, verify it appears on the canvas at a default position, then close the sidebar and verify the canvas area expands.

**Acceptance Scenarios**:

1. **Given** a touch device, **When** the app loads, **Then** the sidebar is hidden by default and a clearly visible toggle button is shown.
2. **Given** the sidebar toggle is tapped, **When** the sidebar opens, **Then** the component list is fully visible and tappable.
3. **Given** the sidebar is open, **When** the user taps a component item, **Then** the component is added to the canvas at a sensible default position (e.g., centre of the current viewport) and the sidebar remains open.
4. **Given** a component is added via tap, **Then** it is selected and ready to be repositioned by dragging.
5. **Given** the sidebar is open, **When** the user taps the toggle button again, **Then** the sidebar closes and the full canvas width is restored.

---

### Edge Cases

- What happens when a single-finger touch lands on a port vs. a knob vs. empty canvas space? Each target must be unambiguously resolved using hit-testing consistent with mouse behaviour.
- How does the system handle a touch beginning on a component header (move intent) vs. a control within the component (value-change intent)? A distance-based threshold (~8px) determines intent: finger movement beyond the threshold triggers drag/move; lifting without crossing the threshold is treated as a tap.
- What happens if the user touches the canvas with more than two fingers simultaneously? Additional fingers beyond the first (single-touch) or second (two-touch gestures) should be ignored.
- What happens when a touch starts on a control but the finger drifts outside the component bounds during a drag?
- A long-press on a component (finger held without crossing the ~8px movement threshold) MUST open a small context menu offering at minimum a Delete action. The menu is dismissed by tapping outside it.
- How does the virtual keyboard (on-screen piano) respond to multi-touch chords? (Multiple simultaneous note presses should be supported.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The canvas MUST respond to single-finger touch events for all interactions that currently use single mouse button drag (component move, knob drag, slider drag, cable patching). Intent is resolved by a distance threshold: movement beyond ~8px confirms drag intent; lifting without crossing the threshold is treated as a tap.
- **FR-002**: The canvas MUST respond to two-finger touch events for panning the viewport.
- **FR-003**: The canvas MUST respond to two-finger pinch gestures for zooming the viewport in and out.
- **FR-004**: Knobs MUST support vertical single-finger drag to change value, matching the existing mouse-drag behaviour.
- **FR-005**: Sliders MUST support single-finger drag along their axis to change value.
- **FR-006**: Components MUST be moveable on the canvas via single-finger press-and-drag on their header area.
- **FR-007**: Port tap interactions MUST initiate and complete cable connections in the same way mouse clicks do. Tapping a port that already has a cable connected MUST disconnect that cable (tap toggles connection off).
- **FR-008**: The sidebar MUST provide a tap-to-add interaction for adding components to the canvas, as a replacement for HTML5 drag-and-drop which is not supported on touch. On touch devices the sidebar MUST be collapsible — hidden by default with a visible toggle button to open and close it.
- **FR-009**: Touch interactions and mouse interactions MUST coexist; the app MUST remain fully functional with a mouse when touch events are also registered.
- **FR-010**: The virtual keyboard (on-screen piano) MUST support simultaneous multi-touch so the user can play chords.
- **FR-011**: All touch interactions MUST prevent default browser touch behaviours (scroll, zoom, context menu) where they would interfere with synthesizer interactions.
- **FR-012**: Buttons and clickable UI elements in the toolbar and modals MUST respond correctly to tap events on touch devices with no perceivable delay. This is satisfied by applying `touch-action: manipulation` to all `<button>` elements (eliminates the 300ms tap delay on iOS Safari) and ensuring no `pointer-events: none` styles are applied to interactive elements on touch.
- **FR-013**: A long-press gesture on a component (sustained touch without crossing the movement threshold) MUST present a context menu containing at minimum a Delete action. The menu MUST be dismissed by tapping outside it.

### Key Entities

- **Touch Gesture**: A discrete interaction pattern (tap, single-finger drag, two-finger pan, pinch-zoom) mapped to a synthesizer action.
- **Hit Target**: The interactive region on the canvas (component header, knob, slider, port, cable, empty space) used to resolve which interaction type a touch initiates.
- **Viewport**: The current pan and zoom state of the canvas, navigable by two-finger pan and pinch.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All primary patch-building tasks (add component, move component, adjust knob/slider, connect cable) can be completed end-to-end on an iPad without a mouse or keyboard.
- **SC-002**: Touch interactions produce the same parameter changes as equivalent mouse interactions — no detectable accuracy regression for knob/slider adjustments. Visible UI feedback (knob/slider movement, value change) MUST occur within one animation frame (~16ms) of the touch event.
- **SC-003**: Two-finger pan and pinch-zoom work without triggering accidental component moves or control adjustments.
- **SC-004**: The virtual keyboard supports at least 5 simultaneous touch points so the user can play full chords.
- **SC-005**: All existing mouse-based interactions continue to work correctly after touch support is added — zero regression for desktop users.
- **SC-006**: No unintended browser default behaviours (page scroll, browser zoom, context menus) occur during synthesizer touch interactions.

## Clarifications

### Session 2026-04-29

- Q: How should the system decide whether a single-finger touch is a tap vs. a drag? → A: Distance-based threshold (~8px): movement beyond threshold = drag intent; lift without crossing = tap.
- Q: When the user taps a port that already has a cable connected, what should happen? → A: Disconnect the existing cable (tap toggles connection off).
- Q: Should a long-press on a component trigger a delete or options action on touch? → A: Long-press shows a small context menu with Delete and any other component actions.
- Q: Should the sidebar be always visible or collapsible on touch devices? → A: Collapsible — hidden by default with a clearly visible toggle button to open/close it.
- Q: What is the maximum acceptable delay between touch input and visible UI feedback? → A: One animation frame (~16ms).

## Assumptions

- The primary touch target device is iPad (landscape orientation, ~1024×768 or larger screen). Smaller phone-sized screens are out of scope for this feature.
- The Pointer Events API (`pointerdown`/`pointermove`/`pointerup`/`pointercancel`) replaces the existing `mousedown`/`mousemove`/`mouseup` listeners in Canvas.ts. Because pointer events fire for mouse, touch, and stylus, mouse behaviour is preserved without separate event paths. See `specs/017-touch-support/research.md` Decision 1 for rationale.
- The on-screen keyboard chord support uses `pointerdown`/`pointerup` with `setPointerCapture` per key element, replacing the existing mouse listeners. The existing `Keyboard.ts` multi-key state logic requires no changes.
- Stylus input (Apple Pencil) is treated the same as finger touch — no pressure or tilt sensitivity is required.
- No changes to the patch save/load format are needed for this feature.
