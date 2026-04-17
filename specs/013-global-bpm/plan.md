# Implementation Plan: Global BPM Control

**Branch**: `013-global-bpm` | **Date**: 2026-04-17 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `specs/013-global-bpm/spec.md`

## Summary

Introduce a single authoritative global BPM control in the application toolbar. All tempo-aware components (Step Sequencer, Collider) subscribe to it via the existing EventBus and follow the global BPM by default, with an optional per-component local override. The global BPM is persisted in `PatchData` and restored on load. Legacy patches default to 120 BPM without error.

## Technical Context

**Language/Version**: TypeScript 5.6+, ES2020 target, strict mode  
**Primary Dependencies**: Web Audio API, DOM — zero new runtime dependencies  
**Storage**: `localStorage` via existing `PatchSerializer` / `PatchStorage` pattern  
**Testing**: Vitest (run via `vitest run`)  
**Target Platform**: Browser (Vite dev server)  
**Project Type**: Single-page modular synthesizer app (`src/` flat structure with `core/`, `components/`, `ui/`, `patch/` directories)  
**Performance Goals**: BPM change propagates to all components within one musical measure; UI updates are synchronous  
**Constraints**:
- Zero new runtime dependencies
- Must not break existing patch save/load format (backward-compatible schema extension)
- Follows existing singleton export pattern (`audioEngine`, `patchManager`, `eventBus`)

## Constitution Check

**Constitution Version**: 1.0 (project-level)

- [x] **Readability & Maintainability**: `GlobalBpmController` is a focused single-responsibility class. Types are self-documenting via contracts/types.ts.
- [x] **Code Organization**: New code is grouped by responsibility (`core/GlobalBpmController.ts`, `ui/GlobalBpmControl.ts`). Follows existing module patterns.
- [x] **Code Standards**: TypeScript strict mode, named constants (`BPM_MIN`, `BPM_MAX`, `BPM_DEFAULT`), no magic numbers.
- [x] **Test Coverage**: Core logic (`GlobalBpmController`, validation, component subscription) must reach 80%+ coverage. Utility functions in `contracts/validation.ts` must reach 100%.
- [x] **Test Quality**: Tests are isolated; no shared mutable state between test cases; AAA pattern.
- [x] **UI Consistency**: `GlobalBpmControl` matches existing top-bar widget style. No new design tokens introduced.
- [x] **User Feedback**: BPM input responds synchronously; tap tempo button provides immediate visual feedback.
- [x] **Performance**: BPM change is an O(n) EventBus emit where n = subscribed components. No audio-thread blocking.

No constitution violations.

## Project Structure

### Documentation (this feature)

```text
specs/013-global-bpm/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/
│   ├── types.ts         ← Phase 1 output
│   └── validation.ts    ← Phase 1 output
└── tasks.md             ← Phase 2 output (/speckit.tasks)
```

### Source Code Changes

```text
src/
├── core/
│   ├── types.ts                         MODIFY — add GLOBAL_BPM_CHANGED to EventType; add globalBpm? to PatchData
│   └── GlobalBpmController.ts           CREATE  — singleton; getBpm/setBpm; EventBus emission
├── ui/
│   └── GlobalBpmControl.ts              CREATE  — toolbar widget; numeric input + tap tempo
├── components/utilities/
│   ├── StepSequencer.ts                 MODIFY  — add bpmMode param; subscribe/unsubscribe pattern
│   └── Collider.ts                      MODIFY  — add bpmMode param; subscribe/unsubscribe pattern
├── patch/
│   ├── PatchSerializer.ts               MODIFY  — inject/read globalBpm field
│   └── PatchManager.ts                  MODIFY  — call globalBpmController.loadFromPatch() on load
└── main.ts                              MODIFY  — instantiate GlobalBpmControl

index.html                               MODIFY  — add BPM widget slot in .top-bar

tests/
├── core/
│   └── GlobalBpmController.test.ts      CREATE
├── ui/
│   └── GlobalBpmControl.test.ts         CREATE
├── components/utilities/
│   ├── StepSequencer.bpmMode.test.ts    CREATE
│   └── Collider.bpmMode.test.ts         CREATE
└── patch/
    └── PatchSerializer.globalBpm.test.ts CREATE
```

## Implementation Phases

### Phase 1 — Core Infrastructure

1. **Add `GLOBAL_BPM_CHANGED` to `EventType`** in `src/core/types.ts`
2. **Add `globalBpm?: number` to `PatchData`** in `src/core/types.ts`
3. **Create `GlobalBpmController`** at `src/core/GlobalBpmController.ts`
   - `getBpm()`, `setBpm(value)` with clamp + emit
   - `loadFromPatch(patch)` reads `patch.globalBpm ?? 120`
   - `saveToPatch(patch)` injects `globalBpm`
   - Export singleton `globalBpmController`
4. **Write unit tests** for `GlobalBpmController`

### Phase 2 — Component Integration

5. **Add `bpmMode` parameter to `StepSequencer`** (default 0 = global)
   - On `activate()`: subscribe to `GLOBAL_BPM_CHANGED`; read current global BPM immediately
   - On `deactivate()`: unsubscribe
   - In `updateAudioParameter('bpmMode', ...)`: if switching to global (0), adopt current global BPM immediately
   - BPM change takes effect at next step boundary (existing scheduling loop already handles this via `getStepInterval()`)
6. **Add `bpmMode` parameter to `Collider`** (same pattern)
7. **Write tests** for StepSequencer and Collider BPM mode behaviour

### Phase 3 — Persistence

8. **Modify `PatchSerializer.serializePatch()`** to call `globalBpmController.saveToPatch()`
9. **Modify `PatchManager`** to call `globalBpmController.loadFromPatch(patch)` after components are created and parameters restored
10. **Write serialization round-trip tests**

### Phase 4 — UI

11. **Create `GlobalBpmControl`** at `src/ui/GlobalBpmControl.ts`
    - Renders into `.top-bar` in `index.html`
    - Numeric input bound to `globalBpmController`
    - Tap tempo: collect timestamps, discard > 3s old, average intervals after ≥ 2 taps, call `setBpm()`
    - Listens for `GLOBAL_BPM_CHANGED` to update display when BPM changes programmatically (e.g., patch load)
12. **Add BPM widget markup** to `index.html` (a `<div id="global-bpm-control">` placeholder in `.top-bar`)
13. **Instantiate `GlobalBpmControl`** in `main.ts`
14. **Write UI tests** for `GlobalBpmControl`

## Complexity Tracking

No constitution violations requiring justification.
