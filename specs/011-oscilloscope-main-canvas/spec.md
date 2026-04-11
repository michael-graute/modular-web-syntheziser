# Feature Specification: Oscilloscope Display — Main Canvas Migration

**Feature Branch**: `011-oscilloscope-main-canvas`
**Created**: 2026-04-11
**Status**: Draft
**Input**: User description: "Move OscilloscopeDisplay from a separate overlay HTML canvas element to draw directly on the main CanvasRenderingContext2D, following the pattern established by ChordFinderDisplay."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Sharp, Correctly-Scaled Oscilloscope at Any Zoom Level (Priority: P1)

When a user zooms in or out on the canvas, the oscilloscope display (waveform, spectrum, grid, labels) must remain as crisp and correctly-sized as any other component on screen. Currently, zoom is applied via a CSS `transform: scale()` on the overlay canvas, which causes font interpolation blur and pixel-smearing artefacts. After this change, the oscilloscope is drawn directly in world-space coordinates on the main canvas, so it scales identically to every other component.

**Why this priority**: This is the primary visible bug motivating the feature. All other improvements are secondary consequences of this fix.

**Independent Test**: Add an Oscilloscope module. Zoom the canvas to 50% and then to 200%. Observe that waveform lines and grid lines remain crisp at all zoom levels, matching the visual fidelity of neighbouring components.

**Acceptance Scenarios**:

1. **Given** an Oscilloscope is on the canvas and the viewport is zoomed to 50%, **When** the oscilloscope renders, **Then** waveform lines and grid lines are pixel-crisp with no interpolation blur.
2. **Given** an Oscilloscope is on the canvas and the viewport is zoomed to 200%, **When** the oscilloscope renders, **Then** all visual elements scale proportionally and remain sharp, matching the rendering quality of other components.
3. **Given** a high-DPI (Retina) display, **When** the oscilloscope renders, **Then** it respects the device pixel ratio and renders at native resolution without blurriness.

---

### User Story 2 — No Z-Index Conflicts with Dropdown Menus (Priority: P2)

Dropdown menus (e.g., the Display-mode selector on the Oscilloscope itself, or dropdowns on nearby components) must always appear visually on top of the oscilloscope display area. Currently the overlay canvas element can obscure dropdown menus rendered on the main canvas.

**Why this priority**: A partially obscured dropdown is a functional breakage, not just a cosmetic issue. After the oscilloscope is drawn on the main canvas, this class of conflict is eliminated by construction.

**Independent Test**: Add an Oscilloscope module. Open the Display dropdown on the module. Verify the dropdown popup renders fully on top of the oscilloscope display area with no clipping or obscuring.

**Acceptance Scenarios**:

1. **Given** the Oscilloscope display is visible, **When** the user opens the Display-mode dropdown, **Then** the dropdown list renders fully on top of the oscilloscope waveform area.
2. **Given** a neighbouring component with a dropdown is placed adjacent to the Oscilloscope, **When** that dropdown is opened, **Then** it is not clipped or obscured by the oscilloscope display.

---

### User Story 3 — No Orphaned DOM Overlay Elements (Priority: P3)

When the Oscilloscope component is removed from the canvas, its display area must leave no residual HTML elements in the DOM. Currently the overlay canvas element can be left behind if cleanup is not perfectly timed.

**Why this priority**: DOM leaks are a correctness issue but not immediately user-visible. Fixing them is a natural consequence of the migration.

**Independent Test**: Add an Oscilloscope, confirm the display renders, then delete it. Inspect the DOM (browser devtools) and confirm no orphaned `<canvas>` elements remain under the synth canvas container.

**Acceptance Scenarios**:

1. **Given** an Oscilloscope is on the canvas, **When** the user deletes it, **Then** no overlay `<canvas>` element remains in the DOM.
2. **Given** multiple Oscilloscopes are added and then all deleted, **When** the user inspects the DOM, **Then** the canvas container holds only the single main canvas element.

---

### Edge Cases

- What happens when the analyser node has no audio data yet? The display must render a flat line or empty spectrum rather than crash or show garbage values.
- What happens when the Oscilloscope component is panned fully off-screen? Rendering calls must be skipped or complete silently without errors.
- What happens when the browser window is resized? The oscilloscope display area must reflow correctly alongside all other components with no misalignment.
- What happens if two Oscilloscopes are on the canvas simultaneously? Each must render independently into its own region without visual interference.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The oscilloscope waveform/spectrum display MUST be drawn directly onto the main canvas context as part of the normal per-frame component render pass, with no separate HTML canvas element created or managed.
- **FR-002**: The display MUST render at the correct position and size in world (component-layout) coordinates, consistent with how all other component controls are drawn.
- **FR-003**: The display MUST support all three existing display modes: waveform (time-domain), spectrum (frequency-domain), and both (split view).
- **FR-004**: The display MUST continue to update in real time while audio is playing, reflecting live waveform and/or spectrum data each rendered frame.
- **FR-005**: All existing visual elements MUST be preserved: background fill, grid lines, waveform trace, spectrum bars, centre line.
- **FR-006**: The migration MUST remove the overlay canvas element and all associated DOM management code (creation, insertion, removal, CSS positioning, CSS transform).
- **FR-007**: CSS-transform-based viewport synchronisation (`updateViewportTransform`) MUST be removed; the display MUST instead rely on the main canvas viewport transform already applied by the render loop.
- **FR-008**: The display MUST follow the architectural pattern of `ChordFinderDisplay`: a `render(ctx, state)` method receiving the main context and a display-state snapshot, with world-coordinate positioning via stored position and size properties.
- **FR-009**: Cleanup on component destruction MUST require no DOM element removal — only releasing internal references and unsubscribing from any frame scheduler.
- **FR-010**: The oscilloscope display area MUST always appear beneath dropdown menus, which are drawn in a subsequent pass on the same main canvas.

### Key Entities

- **OscilloscopeDisplay**: The visual renderer. After migration it holds only position/size metadata and rendering logic; it owns no DOM element.
- **OscilloscopeState**: A snapshot of the data the display needs each frame — display mode, waveform buffer, spectrum buffer — passed into `render()` by the component orchestrator.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The oscilloscope display is visually indistinguishable in sharpness from other component controls at all zoom levels between 25% and 400%.
- **SC-002**: Zero `<canvas>` overlay elements exist in the DOM after an Oscilloscope component is added; zero orphaned elements remain after deletion.
- **SC-003**: Dropdown menus on the Oscilloscope and on components adjacent to it render fully visible with no portion obscured by the oscilloscope display area.
- **SC-004**: The display updates at a minimum of 25 frames per second during active audio playback, with no visible freeze or stutter compared to the current implementation.
- **SC-005**: The migration is self-contained — changes are limited to the display class, the component orchestrator wiring, and any lifecycle management code; no changes are required to the audio analysis logic.
- **SC-006**: All existing automated tests continue to pass after the migration with no regressions.

---

## Assumptions

- The oscilloscope display area requires no pointer or mouse interaction (it is read-only). If this assumption is wrong, hit-detection routing will need a separate design pass.
- The internal frame-rate throttle (currently 30 FPS) will be retained by tracking the last render timestamp inside the display and skipping the draw call when insufficient time has elapsed.
- The main render loop runs at approximately 60 FPS; the oscilloscope piggybacks on this loop and self-throttles internally.
- No changes are needed to the audio analysis component (`Oscilloscope.ts`) itself; all work is confined to the display and canvas wiring layers.
- `ChordFinderDisplay` is the accepted reference implementation for the target architecture.
