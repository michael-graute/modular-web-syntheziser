# Feature Specification: Resizable Notes Component

**Feature Branch**: `037-notes-resizable`
**Created**: 2026-07-08
**Status**: Draft
**Input**: User description: "Make the Notes component resizable. When clicking and dragging the bottom-left edge of the component, the component should resize in width and height according to the drag movement. The cursor should change to a resize curser when hovering over the bottom-left edge."

## Clarifications

### Session 2026-07-08

- Q: Existing saved patches have Notes components with no stored width/height (size was always the fixed default before this feature). When such a legacy patch loads, what size should the Notes component get? → A: Default size — loads at today's existing fixed default width/height, same as before this feature shipped; fully backward-compatible, no visual change for old patches.

## Amendments

### 2026-07-08 — Extended to both bottom corners

After the initial bottom-left-only implementation shipped, user feedback requested that the bottom-right corner also act as a resize handle, for a more natural resizing experience (matching the common two-corner resize pattern used by most windowed UIs). This was implemented as a direct, low-risk extension of the existing bottom-left logic:

- The bottom-right corner now has its own resize handle, hit-test, and cursor feedback, symmetric to the bottom-left one.
- Dragging the bottom-right corner keeps the **top-left** corner fixed (position never moves; width/height track the cursor directly) — the mirror image of the bottom-left behavior, which keeps the top-right corner fixed.
- All other behavior (minimum-size clamping, no maximum, zoom-aware world-coordinate math, text preservation, persistence) is identical between the two corners and reuses the same underlying size-clamping logic.
- FR-001, FR-003, FR-006, and FR-013 below are updated to describe "either bottom corner" instead of only the bottom-left; acceptance scenarios in User Story 1 and User Story 2 are updated correspondingly. No new user story was added — this is treated as a refinement of the existing P1/P2 stories, not new scope, since the underlying capability (drag a corner to resize, with cursor feedback) is unchanged.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Resize the Notes Component by Dragging Its Corner (Priority: P1)

A musician has added a Notes component to document their patch, but the default size is too small for the amount of text they want to write (or too large and taking up canvas space they need for other components). They grab a bottom corner (left or right) of the Notes component and drag it to make the component bigger or smaller, so the text area better fits their content.

**Why this priority**: Resizing is the entire purpose of this feature. Without it, nothing else in this spec matters.

**Independent Test**: Add a Notes component to the canvas, drag its bottom-left corner outward, and verify the component becomes wider and taller; drag it back inward and verify the component shrinks accordingly. Repeat with the bottom-right corner and verify equivalent, mirrored behavior.

**Acceptance Scenarios**:

1. **Given** a Notes component is on the canvas, **When** the user presses the mouse button down on the component's bottom-left corner and drags down and to the left, **Then** the component grows both wider and taller, expanding away from its top-right corner (its top-right corner stays fixed while its position and size adjust to track the cursor).
2. **Given** a Notes component is on the canvas, **When** the user presses the mouse button down on the component's bottom-left corner and drags up and to the right, **Then** the component shrinks in both width and height, down to its minimum allowed size.
3. **Given** a Notes component is on the canvas, **When** the user presses the mouse button down on the component's bottom-right corner and drags down and to the right, **Then** the component grows both wider and taller, expanding away from its top-left corner (its top-left corner stays fixed — position never changes — while size tracks the cursor).
4. **Given** a Notes component is on the canvas, **When** the user presses the mouse button down on the component's bottom-right corner and drags up and to the left, **Then** the component shrinks in both width and height, down to its minimum allowed size, with its top-left corner (position) unchanged.
5. **Given** the user is dragging either bottom corner, **When** the user releases the mouse button, **Then** the component stops resizing and keeps the size it had at release.
6. **Given** a Notes component has been resized from either corner, **When** the user clicks into the text area and continues typing, **Then** existing text is preserved and the text area reflects the new size.

---

### User Story 2 - Visual Feedback When Hovering Over the Resize Handle (Priority: P2)

Before a musician tries to resize a Notes component, they want a clear visual cue that a bottom corner is draggable, distinct from the rest of the component (which drags to move, or is just the text area).

**Why this priority**: Discoverability matters, but the feature is still usable without it once a user knows a corner is draggable — this refines the experience rather than enabling the core value.

**Independent Test**: Add a Notes component, move the mouse cursor over its bottom-left corner without clicking, and verify the cursor icon changes to a resize indicator; move the cursor away and verify it reverts to normal. Repeat for the bottom-right corner, and verify the two corners show mirrored diagonal cursors.

**Acceptance Scenarios**:

1. **Given** a Notes component is on the canvas, **When** the user moves the mouse cursor over the component's bottom-left corner without pressing any button, **Then** the mouse cursor changes to a resize cursor matching that corner's diagonal (bottom-left ↔ top-right).
2. **Given** a Notes component is on the canvas, **When** the user moves the mouse cursor over the component's bottom-right corner without pressing any button, **Then** the mouse cursor changes to a resize cursor matching that corner's diagonal (top-left ↔ bottom-right) — visually distinct from the bottom-left corner's cursor.
3. **Given** the mouse cursor is showing a resize cursor over either bottom corner, **When** the user moves the cursor away from that corner (elsewhere on the component or off it), **Then** the cursor reverts to its normal appearance.
4. **Given** the user is actively dragging a bottom corner to resize, **When** the drag is in progress, **Then** the resize cursor for that corner remains active even if the cursor briefly moves outside the corner's hit area (so a fast drag doesn't lose the resize cursor mid-gesture).

---

### Edge Cases

- What happens when the user drags the corner so far that the component would become smaller than a usable size? The component MUST stop shrinking at a minimum width and height that keeps the text area and header usable, rather than collapsing to zero or negative size.
- What happens when the user drags the corner far beyond the visible canvas area? The component MUST continue resizing (there is no explicit maximum size), consistent with the canvas already supporting components positioned and viewed at arbitrary pan/zoom levels.
- What happens when the user starts a resize drag and then also tries to type in the text area at the same time? Not applicable — resizing is a mouse-drag-only gesture; typing requires clicking into the text area first, which is a separate, non-overlapping interaction from grabbing the corner.
- What happens if the user resizes the component and then saves the patch? The custom size MUST be saved and restored on reload, so the component doesn't revert to its default size.
- What happens when the canvas is zoomed in or out while the user resizes a component? The drag distance MUST be interpreted in canvas (world) coordinates, not raw screen pixels, so resizing feels consistent regardless of zoom level.
- What happens if the user drags the corner in a way that only moves horizontally or only vertically? The component MUST resize only along the axis (or axes) actually dragged — a purely horizontal drag changes only width, a purely vertical drag changes only height.
- What happens when a patch saved before this feature existed (a Notes component with no stored size) is loaded? The component MUST load at the same fixed default width/height it used to render at before this feature shipped, so existing patches look unchanged after the upgrade.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Notes component MUST expose draggable resize handles at both its bottom-left and bottom-right corners. *(Amended 2026-07-08 — originally bottom-left only.)*
- **FR-002**: When the user presses the mouse button down on a resize handle and drags, the Notes component MUST resize its width and height to track the drag movement in real time.
- **FR-003**: Dragging the bottom-left corner MUST resize the component such that its top-right corner remains fixed in place (position shifts to accommodate the new width). Dragging the bottom-right corner MUST resize the component such that its top-left corner remains fixed in place (position never changes). *(Amended 2026-07-08 — added the bottom-right behavior.)*
- **FR-004**: The Notes component's resize MUST be constrained to a minimum width and height, below which further shrinking is prevented, so the header and text area remain usable. Applies identically to both corners.
- **FR-005**: The Notes component MUST NOT have a maximum size limit for resizing, from either corner.
- **FR-006**: While the mouse cursor hovers over a resize handle (without dragging), the cursor MUST change to a diagonal resize cursor matching that corner's diagonal — visually distinct between the bottom-left and bottom-right handles. *(Amended 2026-07-08 — originally bottom-left only.)*
- **FR-007**: The cursor MUST revert to its default appearance when it moves off a resize handle and no resize drag is in progress.
- **FR-008**: Releasing the mouse button MUST end the resize interaction and lock in the component's current size, regardless of which corner was being dragged.
- **FR-009**: The resized width and height of a Notes component MUST be persisted and restored using the project's existing patch save/load mechanism, regardless of which corner produced the current size.
- **FR-009a**: A patch saved before this feature existed (containing a Notes component with no stored size) MUST load that component at the same fixed default width/height it used to render at previously, preserving backward compatibility.
- **FR-010**: Resizing a Notes component MUST NOT alter or discard its text content, regardless of which corner is used.
- **FR-011**: The Notes component's internal text area MUST scale to fill the available space as the component is resized, so a larger component shows a proportionally larger editable text region.
- **FR-012**: Resize interactions MUST be interpreted in canvas (world) coordinates so that resize behavior is consistent across different zoom levels.
- **FR-013**: Resizing MUST NOT be triggered by clicks or drags on other parts of the Notes component (its header, its text area, or its top corners) — only the two bottom corners act as resize handles. *(Amended 2026-07-08 — originally only the bottom-left corner was a valid handle; the top corners remain non-interactive.)*

### Key Entities

- **Notes Component**: Extended with a user-adjustable size (width and height), in addition to its existing text content and canvas position. Size is bounded by a minimum; there is no maximum.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can resize a Notes component to at least double or halve its default footprint using a single continuous drag gesture, with no intermediate steps (e.g. no separate "resize mode" toggle required).
- **SC-002**: The component's size visibly updates with no perceptible lag while the user drags the resize handle.
- **SC-003**: A first-time user recognizes either bottom corner as resizable within one hover, based on the cursor change alone, without needing external documentation.
- **SC-004**: A saved patch containing a custom-sized Notes component, once reloaded, reproduces the exact same width and height with no loss.
- **SC-005**: Resizing a component never causes its text content to be lost, truncated, or altered.

## Assumptions

- This feature scopes resizing to the Notes component only, per the request; other components remain fixed-size as before. A general resize mechanism usable by other component types is not part of this feature, though the implementation may be structured to allow future reuse.
- "Bottom-left edge"/"bottom-right corner" refer to the corners of the component's bounding box (the intersection of its bottom edge with the left or right edge respectively), not the entire left/right/bottom edge as independent drag targets — this matches the diagonal-resize-handle pattern implied by "resize cursor." *(Amended 2026-07-08 to cover both corners.)*
- The minimum usable width and height are implementation-defined defaults chosen to keep the header and a small amount of text area visible and usable (no specific pixel values are mandated by this spec). Applies identically to both corners.
- Resize handle affordance (cursor change) is sufficient discoverability; no additional visual indicator (e.g. a persistent grab-handle icon drawn in the corner) is required beyond the cursor change, consistent with a lightweight resize-corner pattern. Applies to both corners.
- Each resize handle's hit area is a small region around its exact corner, large enough to be reliably targetable with a mouse but not so large that it overlaps with normal text-area or header interactions, or with the other corner's hit area.
- The top-left and top-right corners remain non-interactive (no resize handle) — only the two bottom corners were requested and implemented.
