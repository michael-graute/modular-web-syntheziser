# Feature Specification: Factory Patches

**Feature Branch**: `003-factory-patches`
**Created**: 2025-10-31
**Status**: Draft
**Input**: User description: "Plan a new feature for Factory Patches: The application should have predefined factory patches with some quickstart examples that can be loaded by the user. These should be under a seperate Factory category in the load modal. The JSON of these patches should be in the same format as the patches that are saved to the localStorage. The patch JSON files shoud be saved in a seperate folder, so that new factory patches can be added by a developer."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Load Factory Patch from Library (Priority: P1)

A new user opens the application and wants to hear what the synthesizer can do without building a patch from scratch. They click the Load button and see a "Factory" category with pre-built example patches like "Basic Bass", "Simple Lead", or "Pad Sound". They select one and it loads immediately, allowing them to play notes and hear the result.

**Why this priority**: This is the core value proposition - providing immediate examples for new users to explore. Without this, users must build patches from scratch, creating a steep learning curve.

**Independent Test**: Can be fully tested by opening the Load modal, selecting a factory patch, clicking Load, and verifying the patch loads successfully with all components and connections intact. Delivers immediate value by letting users hear working examples.

**Acceptance Scenarios**:

1. **Given** the user clicks the Load button, **When** the Load modal opens, **Then** a "Factory" category is visible alongside "My Patches"
2. **Given** the "Factory" category is selected, **When** the factory patches list displays, **Then** at least 3 example patches are shown (e.g., "Basic Bass", "Simple Lead", "Pad Sound")
3. **Given** a factory patch is selected, **When** the user clicks Load, **Then** the patch loads onto the canvas with all components, connections, and parameter values intact
4. **Given** a factory patch has loaded, **When** the user plays notes on the keyboard, **Then** audio is produced according to the patch design

---

### User Story 2 - Browse Factory Patch Details (Priority: P2)

A user exploring factory patches wants to understand what each patch does before loading it. They hover over or click on a factory patch name and see a brief description of the sound (e.g., "A warm bass sound using a sawtooth oscillator and lowpass filter"). This helps them choose the right starting point for learning or inspiration.

**Why this priority**: Enhances discoverability and learning. Users can understand what each patch demonstrates without trial and error. Not critical for MVP but significantly improves user experience.

**Independent Test**: Can be tested by opening the Load modal, navigating to Factory patches, and verifying that descriptions appear for each patch. Delivers value by helping users make informed choices.

**Acceptance Scenarios**:

1. **Given** the Factory category is selected, **When** a factory patch is displayed, **Then** a brief description (1-2 sentences) is shown for each patch
2. **Given** a user is browsing factory patches, **When** they read the description, **Then** it clearly explains the sound type and key components used (e.g., "Smooth pad sound using multiple detuned oscillators with chorus and reverb")

---

### User Story 3 - Developer Adds New Factory Patch (Priority: P3)

A developer wants to add a new example patch to the factory collection. They create a patch in the application, export it to JSON format, place the JSON file in the designated factory patches folder, and the new patch automatically appears in the Factory category on next application load (or after refresh).

**Why this priority**: Enables extensibility and community contributions. While valuable for long-term growth, not critical for initial release since the application ships with curated examples.

**Independent Test**: Can be tested by adding a new JSON file to the factory patches folder and verifying it appears in the Load modal. Delivers value by making the patch library maintainable and extensible.

**Acceptance Scenarios**:

1. **Given** a developer has a patch JSON file, **When** they place it in the factory patches folder (e.g., `/public/patches/factory/`), **Then** the patch appears in the Factory category on application load
2. **Given** a factory patch JSON file has an invalid format, **When** the application loads, **Then** that specific patch is skipped with a console warning, but other valid patches still load
3. **Given** a developer wants to add a description, **When** they include a "description" field in the JSON metadata, **Then** that description appears in the Load modal

---

### Edge Cases

- What happens when no factory patches are available (e.g., folder is empty or missing)?
  - System should display "No factory patches available" message in the Factory category
- What happens when a factory patch JSON file is corrupted or has invalid format?
  - System should skip the invalid patch with a console error and load remaining valid patches
- What happens when a factory patch references components not available in the current application version?
  - System should attempt to load compatible components and warn user about missing/incompatible elements
- What happens when a user tries to save over a factory patch?
  - Factory patches should be read-only; attempting to overwrite should save to "My Patches" instead or show an error
- What happens when factory patches folder doesn't exist?
  - System should gracefully handle missing folder and show empty Factory category or hide it entirely

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a "Factory" category in the Load modal alongside user-saved patches
- **FR-002**: System MUST load factory patch JSON files from a designated folder (e.g., `/public/patches/factory/`)
- **FR-003**: System MUST support the same JSON format for factory patches as user-saved patches (ensuring format compatibility)
- **FR-004**: System MUST display factory patch names in the Load modal's Factory category
- **FR-005**: System MUST load selected factory patches onto the canvas with all components, connections, and parameters
- **FR-006**: System MUST treat factory patches as read-only (users cannot modify the original factory files)
- **FR-007**: System MUST gracefully handle missing or invalid factory patch files without breaking the Load modal
- **FR-008**: System MUST include at least 3 starter factory patches at launch: a basic oscillator patch, a bass patch, and a pad patch
- **FR-009**: System MUST support optional description field in factory patch JSON for displaying patch information
- **FR-010**: Developers MUST be able to add new factory patches by adding JSON files to the factory patches folder

### Key Entities

- **Factory Patch**: A pre-built synthesizer patch stored as a JSON file in the factory patches folder
  - **Attributes**: name, description (optional), components, connections, parameter values
  - **Format**: Identical to user-saved patches (includes component types, positions, connections, parameter states)
  - **Storage**: File-based in designated folder, loaded at application startup

- **Factory Category**: A distinct grouping in the Load modal separate from user patches
  - **Relationship**: Contains multiple Factory Patches
  - **Behavior**: Read-only collection, distinct from mutable user patches

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can successfully load and play at least one factory patch within 30 seconds of opening the application
- **SC-002**: 100% of valid factory patch JSON files load successfully without errors
- **SC-003**: New users can explore at least 3 different factory patches to understand synthesizer capabilities before creating their own
- **SC-004**: Developers can add a new factory patch by adding a single JSON file, visible on next application load (no code changes required)
- **SC-005**: Factory patches are clearly distinguished from user patches in the Load modal UI (separate category)
- **SC-006**: Zero crashes or errors when loading the Load modal, even with missing or corrupted factory patch files

## Assumptions

- Factory patches will be stored in a publicly accessible folder (e.g., `/public/patches/factory/`) that can be bundled with the application
- The existing patch JSON format is sufficient for factory patches (no format extensions needed initially)
- Factory patch descriptions are optional; patches without descriptions simply show the name only
- The Load modal already has infrastructure for displaying patches by category (if not, this may require additional UI work)
- Developers can access the factory patches folder to add new files (either in source code before build, or as a documented extension point)
- Users understand the distinction between factory (read-only examples) and user patches (editable)
