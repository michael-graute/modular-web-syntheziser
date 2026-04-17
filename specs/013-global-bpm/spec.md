# Feature Specification: Global BPM Control

**Feature Branch**: `013-global-bpm`  
**Created**: 2026-04-17  
**Status**: Draft  
**Input**: User description: "For the step-sequencer, the collider, some effects like delay and some upcoming new components it would be great to have a global control for BPM."

## Overview

Currently, time-dependent components such as the Step Sequencer and the Collider each maintain their own independent BPM setting. This means a musician must update the tempo in multiple places to keep components in sync — a friction point that disrupts creative flow. This feature introduces a single, authoritative global BPM control that all tempo-aware components can follow, while still allowing individual components to optionally override the global value when a different tempo is desired.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Set Tempo Once, Affect All (Priority: P1)

A musician is building a patch with a Step Sequencer and a Collider. They want both components to play at the same tempo without having to configure each one individually. They adjust the global BPM control and both components immediately respond.

**Why this priority**: This is the core value of the feature — eliminating the need to set BPM in multiple places. Without this, the feature has no purpose.

**Independent Test**: Can be fully tested by placing a Step Sequencer and a Collider on the canvas, adjusting the global BPM, and confirming both respond to the new value simultaneously.

**Acceptance Scenarios**:

1. **Given** a patch with a Step Sequencer and a Collider, both following global BPM, **When** the user changes the global BPM value, **Then** both components immediately update their playback speed to match the new tempo.
2. **Given** a global BPM of 120, **When** the user increases it to 160, **Then** all tempo-following components speed up noticeably within the same musical beat.
3. **Given** no components are on the canvas, **When** the user sets a global BPM, **Then** the value is stored and applied to any components added afterwards.

---

### User Story 2 - Per-Component BPM Override (Priority: P2)

A musician wants the Step Sequencer to run at half the global BPM (e.g., for a half-time feel) while the Collider continues to follow the global tempo. They switch the Step Sequencer to use its own local BPM instead of the global one and set it independently.

**Why this priority**: Creative flexibility — global sync is the default, but some musical arrangements require individual timing. This makes the global BPM non-destructive.

**Independent Test**: Can be tested by enabling local BPM override on one component, setting a different value, and confirming it plays at its local tempo while another component continues to follow the global BPM.

**Acceptance Scenarios**:

1. **Given** a Step Sequencer following global BPM, **When** the user enables local BPM mode on the Step Sequencer and sets a different value, **Then** the Step Sequencer plays at its local BPM while other components continue following global BPM.
2. **Given** a component in local BPM mode, **When** the user changes the global BPM, **Then** that component's tempo is unaffected.
3. **Given** a component in local BPM mode, **When** the user disables local mode and returns to global mode, **Then** the component immediately adopts the current global BPM.

---

### User Story 3 - BPM Persisted Across Sessions (Priority: P3)

A musician saves their patch and reopens it. The global BPM and each component's BPM mode (global-follow vs. local override) are restored exactly as they were left.

**Why this priority**: Consistency across sessions is important for a professional workflow, but the feature is still useful without persistence as a session-only tool.

**Independent Test**: Can be tested by setting a specific global BPM, saving the patch, reloading it, and confirming the global BPM and component modes are restored correctly.

**Acceptance Scenarios**:

1. **Given** a patch with a global BPM of 95 and one component in local override mode, **When** the patch is saved and reopened, **Then** the global BPM is 95 and the component is still in local override mode with its local BPM intact.
2. **Given** a patch is loaded that was created before this feature existed, **When** it is opened, **Then** all tempo-aware components fall back to the global BPM default (120 BPM) without error.

---

### Edge Cases

- A component added mid-playback immediately adopts the current global BPM (or its local override if set).
- When a global BPM change occurs mid-sequence, the Step Sequencer finishes its current step then adopts the new tempo at the next step boundary.
- If the global BPM falls outside a component's supported range, the component silently clamps to its own minimum or maximum BPM and continues playing.
- Delay tempo-sync is out of scope for this feature; it will be handled in a dedicated follow-up feature.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a single, persistent global BPM control in the toolbar / header bar, visible at all times regardless of which patch is loaded or what is on the canvas.
- **FR-002**: The global BPM control MUST support a range of 30–300 BPM with at least 1 BPM precision. If a component's own supported range is narrower, it MUST silently clamp to its own limit without error.
- **FR-003**: All tempo-aware components (Step Sequencer, Collider, and future components) MUST follow the global BPM by default, including components added to the canvas mid-playback.
- **FR-004**: When the global BPM changes, all tempo-following components MUST adopt the new tempo at their next natural timing boundary (e.g., the next step for the Step Sequencer) — no later than the end of the current measure.
- **FR-005**: Each tempo-aware component MUST offer a per-component option to override the global BPM with a local value.
- **FR-006**: When a component is in local BPM override mode, changes to the global BPM MUST NOT affect that component.
- **FR-007**: When a component exits local override mode, it MUST immediately adopt the current global BPM.
- **FR-008**: The global BPM value MUST be saved as part of the patch and restored when the patch is loaded.
- **FR-009**: Each component's BPM mode (global-follow or local override) and local BPM value (if set) MUST be saved and restored with the patch.
- **FR-010**: Patches saved before this feature was introduced MUST load without errors, with all tempo-aware components defaulting to global BPM mode at 120 BPM.
- **FR-011**: *(Out of scope — deferred)* Delay tempo-sync will be addressed in a follow-up feature that builds on the global BPM infrastructure introduced here.

### Key Entities

- **Global BPM**: A single authoritative tempo value shared across the entire patch. Has a numeric value (30–300), a default of 120, and is persisted as part of the patch.
- **BPM Mode**: A per-component setting that declares whether the component follows the global BPM or uses a locally overridden value. Values: `global` (default) or `local`.
- **Local BPM Override**: A component-level BPM value that is only active when the component's BPM Mode is set to `local`. Persisted with the patch.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Changing the global BPM causes all tempo-following components to update their playback speed within one musical measure (no more than 2 seconds at 30 BPM).
- **SC-002**: A musician can configure global BPM and add three tempo-aware components to a patch in under 60 seconds.
- **SC-003**: 100% of tempo-aware components respond to global BPM changes without requiring individual reconfiguration.
- **SC-004**: Patches with mixed BPM modes (global and local) save and restore correctly 100% of the time.
- **SC-005**: Legacy patches (without BPM mode data) load without errors and default to global BPM mode in 100% of cases.

## Clarifications

### Session 2026-04-17

- Q: Where does the global BPM control live — toolbar/header, floating panel, or canvas component? → A: Toolbar / header bar — always visible, outside the canvas.
- Q: When global BPM changes mid-sequence, when does the Step Sequencer adopt the new tempo? → A: On the next step boundary — the current step finishes, then new tempo takes effect.
- Q: Is Delay tempo-sync (FR-011) in scope for this feature or a separate follow-up? → A: Out of scope — defer to a follow-up feature built on top of global BPM infrastructure.
- Q: When a new component is added mid-playback, when does it adopt the global BPM? → A: Immediately on add — component starts at global BPM right away.
- Q: If global BPM exceeds a component's supported range, how should the component behave? → A: Silently clamp — component plays at its own maximum (or minimum) BPM.

## Assumptions

- The global BPM control is placed in the toolbar / header bar — always visible, outside the canvas, never as a canvas component.
- Components that are not tempo-aware (e.g., Oscillator, Mixer) are unaffected by this feature.
- The default global BPM is 120, matching the existing default used by StepSequencer and Collider.
- Delay tempo-sync is explicitly out of scope for this feature and will be delivered separately.
- Future components that require BPM will be built to subscribe to the global BPM mechanism introduced by this feature.
