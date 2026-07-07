# Feature Specification: Notes Component

**Feature Branch**: `036-notes-component`
**Created**: 2026-07-08
**Status**: Draft
**Input**: User description: "please specify a new feature for a new component: Notes. Users should be able to add a simple texteditor to a patch to capture notes or explanations for that patch."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Write Notes on the Patch Canvas (Priority: P1)

A musician adds a Notes component to the canvas and types free-form text into it — reminders about a sound design idea, a description of what the patch does, or instructions for someone else opening the patch later. The text is visible directly on the canvas alongside the other components.

**Why this priority**: Capturing text is the entire purpose of this component. Without the ability to type and see text, nothing else in this spec matters.

**Independent Test**: Add a Notes component to the canvas, click into it, type a paragraph of text, click away, and verify the typed text remains visible on the component.

**Acceptance Scenarios**:

1. **Given** a Notes component is on the canvas, **When** the user clicks into its text area and types, **Then** the typed text appears in the component in real time.
2. **Given** a Notes component contains text, **When** the user clicks outside the component to defocus it, **Then** the text remains visible and unchanged.
3. **Given** a Notes component contains text, **When** the user clicks back into it, **Then** the existing text is still there and editable (cursor can be placed anywhere, existing text can be modified or deleted).
4. **Given** a Notes component is newly added, **When** the user has not yet typed anything, **Then** the component displays an empty text area (optionally with placeholder guidance text) rather than an error or blank/broken control.

---

### User Story 2 - Notes Persist With the Patch (Priority: P2)

A musician writes notes explaining their patch, saves the patch, and later reloads it (in the same session or a new one). The notes are still there exactly as written, so the explanation isn't lost.

**Why this priority**: A notes feature that doesn't survive save/reload provides little real value beyond a single session — persistence is what makes it useful as documentation attached to the patch.

**Independent Test**: Add a Notes component, type text into it, save the patch, reload the page (or load the saved patch), and verify the same text is displayed in the Notes component.

**Acceptance Scenarios**:

1. **Given** a Notes component contains text, **When** the patch is saved, **Then** the text content is included in the saved patch.
2. **Given** a saved patch containing a Notes component with text, **When** the patch is loaded, **Then** the Notes component displays the same text exactly as it was saved.
3. **Given** a Notes component with no text has been added, **When** the patch is saved and reloaded, **Then** the Notes component loads showing an empty text area (no error).

---

### User Story 3 - Resize and Position Notes Like Any Other Component (Priority: P3)

A musician wants a Notes component to occupy more space on the canvas for a longer explanation, or to move it out of the way of other components. They resize and reposition it the same way they would any other canvas component.

**Why this priority**: Basic canvas ergonomics (move, resize) make the component usable in a busy patch layout, but the component is already useful for short notes without resizing — this refines rather than enables the core value.

**Independent Test**: Add a Notes component, drag it to a new position on the canvas, resize it larger, and verify the text area reflows to use the new size and the component stays at its new position after a save/reload.

**Acceptance Scenarios**:

1. **Given** a Notes component is on the canvas, **When** the user drags its header to a new location, **Then** the component moves the same way other canvas components do.
2. **Given** a Notes component is on the canvas, **When** the user resizes it, **Then** the text area grows or shrinks to fill the available space.
3. **Given** a Notes component has been resized, **When** the patch is saved and reloaded, **Then** the component reappears at its saved size and position.

### Edge Cases

- What happens when the user types a very long note? The text area MUST scroll internally rather than growing the component indefinitely or losing text.
- What happens when the user pastes formatted text (e.g. from a word processor)? The component MUST accept it as plain text, discarding any formatting, consistent with "simple texteditor" scope.
- What happens when two Notes components exist in the same patch? Each MUST hold independent text; editing one MUST NOT affect the other.
- What happens when the note text contains characters that could interfere with patch storage (e.g. quotes, special symbols, emoji)? The component MUST store and restore all such characters correctly without corruption.
- What happens when the user selects the Notes component but does not click directly into the text area? The component MUST behave like other canvas components for selection/deletion (e.g. it can be selected and removed from the patch), without requiring a click into the text area first.
- What happens when the user deletes the Notes component from the canvas? Its text MUST be removed along with it (no orphaned data), consistent with how deleting any other component removes its state.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a Notes component that can be added to the canvas like other modular components.
- **FR-002**: The Notes component MUST render an editable, multi-line plain-text area.
- **FR-003**: Users MUST be able to click into the text area and type, edit, and delete text using standard text-editing interactions (typing, backspace/delete, cursor placement, text selection, copy/paste).
- **FR-004**: The Notes component MUST NOT apply or preserve rich-text formatting (bold, italics, font changes, embedded images, etc.) — pasted formatted content is reduced to plain text.
- **FR-005**: The Notes component's text MUST update immediately as the user types (no explicit "save" action required within the editing session).
- **FR-006**: The Notes component's text content MUST be persisted and restored using the project's existing patch save/load mechanism.
- **FR-007**: The Notes component MUST support being repositioned on the canvas using the same interaction as other components.
- **FR-008**: The Notes component MUST support being resized, with the text area adapting to the component's current size.
- **FR-009**: The Notes component MUST support internal scrolling when its text content exceeds the visible area of the text region.
- **FR-010**: The Notes component MUST be removable from the canvas using the same interaction as other components, and removing it MUST discard its text.
- **FR-011**: The Notes component MUST NOT expose any audio, CV, or gate input/output ports — it carries no signal role in the patch.
- **FR-012**: Multiple Notes components MUST be independently addable to the same patch, each retaining its own separate text content.

### Key Entities

- **Notes Component**: A canvas component with no signal ports, holding a single block of plain-text content. Attributes: text content, canvas position, canvas size (width/height).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can add a Notes component and begin typing within the same interaction flow used to add any other component, with no additional setup steps.
- **SC-002**: Typed text appears with no perceptible delay as the user types.
- **SC-003**: A saved patch containing Notes text, once reloaded, reproduces the exact same text with no loss or corruption of content.
- **SC-004**: A first-time user can understand how to add and use the Notes component without external documentation, since it behaves like a familiar text box.
- **SC-005**: Resizing a Notes component to fit a longer explanation takes a single drag interaction, consistent with resizing any other component.

## Assumptions

- "Simple texteditor" means plain-text only — no rich-text formatting toolbar, no markdown rendering, no embedded media. This keeps the component minimal and avoids scope creep into a full document editor.
- The Notes component has no audio/CV/gate signal role and therefore no input or output ports, unlike every other existing component in this project.
- Notes text is persisted via the existing `PatchSerializer` / `PatchStorage` pattern used by all other stateful components in this project, consistent with how component-specific data (e.g. recorded gestures, sequencer patterns) is already saved.
- Default component size on creation is a reasonable small-to-medium canvas footprint (enough for a few lines of text), resizable larger as needed, consistent with how other components define default dimensions.
- There is no character limit beyond what's reasonably necessary to avoid unbounded patch file growth; standard patch-note lengths (a paragraph or two) are the expected use case.
- Text editing uses the browser's native text input behavior (native text selection, copy/paste, undo/redo within the field) rather than a custom-built text editing engine.
