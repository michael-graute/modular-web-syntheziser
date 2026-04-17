# Research: Global BPM Control

**Feature**: 013-global-bpm  
**Date**: 2026-04-17

## Findings

### Decision 1: Global BPM State Location

**Decision**: A singleton `GlobalBpmController` holds the authoritative BPM value and broadcasts changes via the existing `EventBus`.

**Rationale**: The project already has an `eventBus` singleton (`src/core/EventBus.ts`) used for all cross-cutting state (patch saved/loaded, component added/removed, parameter changed). Reusing this pattern keeps the architecture consistent and avoids a new dependency injection system. A singleton controller can be imported anywhere, just like `audioEngine` and `patchManager` already are.

**Alternatives considered**:
- Storing BPM inside `PatchManager` — rejected because BPM is runtime state that should be accessible without loading a full patch, and PatchManager is already responsible for lifecycle, not real-time parameter dispatch.
- Adding it as an `AppState` field — rejected because AppState is a passive data shape; active broadcasting requires a class with methods.

---

### Decision 2: How Components Receive Global BPM

**Decision**: Components subscribe to a `BPM_CHANGED` event on the `EventBus` when they are activated, and unsubscribe when deactivated. Components that support global BPM gain a `bpmMode` parameter (`0 = global`, `1 = local`) stored as a regular parameter alongside the existing `bpm` parameter.

**Rationale**: Using the EventBus publish-subscribe pattern matches how the rest of the app handles cross-component state (PARAMETER_CHANGED, COMPONENT_ADDED, etc.). Storing `bpmMode` as a numeric parameter means it is automatically serialized and deserialized by the existing `SynthComponent.serialize()` / `deserialize()` path with no additional patch format changes needed beyond adding a field to `PatchData`.

**Alternatives considered**:
- Pull model (components poll a global value on each tick) — rejected because it creates coupling to a shared mutable object and timing is inconsistent.
- Adding a `globalBpm` field to `ComponentData` — rejected because mode is component state, not patch-level metadata; it belongs in the component's own parameter map.

---

### Decision 3: PatchData Schema Extension

**Decision**: Add a top-level `globalBpm` field to the `PatchData` interface (optional, defaults to `120` when absent for backward compatibility).

**Rationale**: `PatchData` already has a flat structure (`name`, `version`, `components`, `connections`). Adding `globalBpm?: number` is minimal and non-breaking. Legacy patches that omit the field load cleanly at the default 120 BPM as specified in FR-010.

**Alternatives considered**:
- Storing global BPM in `localStorage` outside the patch — rejected because it would not travel with exported/imported patch JSON files, violating FR-008.

---

### Decision 4: Toolbar UI Widget

**Decision**: A new `GlobalBpmControl` class in `src/ui/` renders a numeric input + tap-tempo button into the existing `.top-bar` div in `index.html`. The HTML element is added adjacent to the patch name input. `main.ts` instantiates it during app setup.

**Rationale**: The `.top-bar` div is the existing persistent header. All other persistent UI controls (patch name, buttons) already live there. A dedicated class (matching the pattern of `Sidebar`, `HelpSidebar`, `SaveModal`) keeps `main.ts` thin and the control independently testable.

**Alternatives considered**:
- Inline HTML in `index.html` + raw DOM queries in `main.ts` — rejected because it does not scale and is inconsistent with the project's class-per-UI-widget convention.

---

### Decision 5: Tap Tempo

**Decision**: Include a tap tempo button in the `GlobalBpmControl` widget. Three or more taps within 3 seconds are averaged to compute BPM; the result is clamped to 30–300.

**Rationale**: Tap tempo is a standard DAW and hardware synth feature that makes global BPM useful for live performance contexts. It requires no new dependencies (pure JS timing) and is directly testable. Mentioned in the spec as future-component-friendly.

**Alternatives considered**:
- Omit tap tempo and use only numeric input — not rejected, but tap tempo is low-effort and high-value for musician workflows.
