# Tasks: Global BPM Control

**Input**: Design documents from `/specs/013-global-bpm/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Organization**: Tasks grouped by user story — each story is independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unresolved dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add type contracts and event infrastructure before any component work begins.

- [ ] T001 Add `GLOBAL_BPM_CHANGED = 'global:bpm-changed'` to the `EventType` enum in `src/core/types.ts`
- [ ] T002 Add `globalBpm?: number` optional field to the `PatchData` interface in `src/core/types.ts`
- [ ] T003 Add the `TempoAware` interface and `GlobalBpmChangedPayload` type to `src/core/types.ts` (inline from `specs/013-global-bpm/contracts/types.ts` — keeps all shared types in the canonical source file, avoids runtime imports from `specs/`)
- [ ] T004 Create `src/core/bpmValidation.ts` with `isValidBpm`, `clampBpm`, `isValidBpmMode` inlined from `specs/013-global-bpm/contracts/validation.ts`, plus named constants `BPM_MIN = 30`, `BPM_MAX = 300`, `BPM_DEFAULT = 120`, `BpmMode` enum (depends on T001)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: `GlobalBpmController` singleton must exist before components or UI can reference it.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T005 Create `src/core/GlobalBpmController.ts` as a class (depends on T004):
  - Import `clampBpm`, `BPM_DEFAULT` from `./bpmValidation`
  - Import `EventType`, `PatchData` from `./types`
  - Private `_bpm: number` field defaulting to `BPM_DEFAULT`
  - `getBpm(): number` — returns current value
  - `setBpm(value: number): void` — clamps using `clampBpm()`, stores result, emits `eventBus.emit(EventType.GLOBAL_BPM_CHANGED, { bpm })` only if value changed
  - `loadFromPatch(patch: PatchData): void` — reads `patch.globalBpm ?? BPM_DEFAULT`, calls `setBpm()`
  - `saveToPatch(patch: PatchData): PatchData` — returns `{ ...patch, globalBpm: this._bpm }`
  - Export singleton: `export const globalBpmController = new GlobalBpmController()`
- [ ] T006 Write unit tests for `GlobalBpmController` in `tests/core/GlobalBpmController.test.ts`:
  - `setBpm` clamps values below 30 to 30
  - `setBpm` clamps values above 300 to 300
  - `setBpm` emits `GLOBAL_BPM_CHANGED` with the clamped value
  - `setBpm` does NOT emit when value is unchanged
  - `loadFromPatch` reads `globalBpm` field when present
  - `loadFromPatch` defaults to 120 when `globalBpm` is absent (legacy patch)
  - `saveToPatch` injects `globalBpm` into returned patch object
  - **SC-001 timing gate**: After `setBpm()` emits, a subscribed mock component receives the event synchronously (i.e., within the same JS call stack turn) — confirming the propagation mechanism is not async-deferred, which ensures the "within one musical measure" criterion is met at the framework level
- [ ] T007 Write unit tests for `bpmValidation.ts` in `tests/core/bpmValidation.test.ts`:
  - `isValidBpm` returns true for 30, 120, 300
  - `isValidBpm` returns false for 29, 301, NaN, Infinity, non-number
  - `clampBpm` rounds and clamps correctly at boundaries
  - `isValidBpmMode` returns true for 0 and 1 only

**Checkpoint**: `GlobalBpmController` is functional and tested — user story phases can now begin.

---

## Phase 3: User Story 1 — Set Tempo Once, Affect All (Priority: P1) 🎯 MVP

**Goal**: Changing the global BPM immediately updates all tempo-aware components on their next step/timing boundary.

**Independent Test**: Add a StepSequencer and a Collider to the canvas, change global BPM via `globalBpmController.setBpm(160)` in the browser console, and confirm both components speed up noticeably on the next step.

### Implementation for User Story 1

- [ ] T008 [P] [US1] Add `bpmMode` parameter to `StepSequencer` in `src/components/utilities/StepSequencer.ts`:
  - In the constructor, after existing `addParameter('bpm', ...)`, add: `this.addParameter('bpmMode', 'BPM Mode', 0, 0, 1, 1, '')`
  - Add private field `private _globalBpmUnsubscribe: (() => void) | null = null`
- [ ] T009 [P] [US1] Add `bpmMode` parameter to `Collider` in `src/components/utilities/Collider.ts`:
  - In the constructor, after existing `this.addParameter('bpm', ...)`, add: `this.addParameter('bpmMode', 'BPM Mode', 0, 0, 1, 1, '')`
  - Add private field `private _globalBpmUnsubscribe: (() => void) | null = null`
- [ ] T010 [US1] Implement global BPM subscription in `StepSequencer` (depends on T008):
  - Add `subscribeToGlobalBpm(): void` — calls `globalBpmController.getBpm()` immediately and sets the `bpm` parameter if `bpmMode === 0`; then subscribes via `eventBus.on(EventType.GLOBAL_BPM_CHANGED, handler)` and stores the unsubscribe function
  - Add `unsubscribeFromGlobalBpm(): void` — calls and clears `_globalBpmUnsubscribe`
  - In `activate()`: call `subscribeToGlobalBpm()` after existing setup — this covers components added mid-playback because `Canvas` calls `activate()` synchronously on every component add (verify this is still the case in `src/canvas/Canvas.ts` before completing the task; if not, subscribe at component-add time instead)
  - In `deactivate()` / `destroyAudioNodes()`: call `unsubscribeFromGlobalBpm()`
  - In `updateAudioParameter('bpmMode', value)` case: if switching to 0 (global), immediately call `this.setParameterValue('bpm', globalBpmController.getBpm())`
  - The existing BPM change handling via `case 'bpm':` already schedules the new tempo at the next step boundary — no further timing change needed
- [ ] T011 [US1] Implement global BPM subscription in `Collider` (depends on T009):
  - Same `subscribeToGlobalBpm` / `unsubscribeFromGlobalBpm` pattern as T010
  - In `activate()`: call `subscribeToGlobalBpm()` after existing setup — mid-playback add coverage same as T010 (verify `activate()` is called synchronously on canvas add)
  - In `destroyAudioNodes()`: call `unsubscribeFromGlobalBpm()`
  - In `updateAudioParameter('bpmMode', value)` case: if switching to 0, immediately apply `globalBpmController.getBpm()` to `this.config.bpm` and restart physics timing
- [ ] T012 [US1] Wire `GlobalBpmController` into `main.ts`:
  - Import `globalBpmController` from `src/core/GlobalBpmController.ts`
  - No other changes needed yet — components will subscribe automatically via `activate()`

**Checkpoint**: Global BPM changes propagate to both StepSequencer and Collider. Manually verifiable via browser console.

---

## Phase 4: User Story 2 — Per-Component BPM Override (Priority: P2)

**Goal**: A component can be switched to local BPM mode and run at a different tempo than the global value, independently of other components.

**Independent Test**: Set global BPM to 120. Enable local BPM on the StepSequencer (`bpmMode = 1`, `bpm = 60`). Confirm the Sequencer plays at half speed while Collider continues at 120. Then set `bpmMode = 0` on the Sequencer and confirm it snaps back to 120.

### Implementation for User Story 2

- [ ] T013 [US2] Expose `bpmMode` in the StepSequencer UI in `src/canvas/displays/StepSequencerDisplay.ts`:
  - Add a toggle control (button or checkbox) labeled "Local BPM" that reads/writes the `bpmMode` parameter (0 = global, 1 = local)
  - When `bpmMode === 0` (global), the BPM knob/input should be visually disabled or labelled "Global" to indicate it is driven externally
  - When `bpmMode === 1` (local), the BPM knob/input is enabled for editing
- [ ] T014 [US2] Expose `bpmMode` in the Collider UI in `src/canvas/displays/ColliderDisplay.ts` (or relevant Collider canvas control):
  - Same toggle pattern as T013 — "Local BPM" toggle; BPM control disabled when `bpmMode === 0`
- [ ] T015 [P] [US2] Write unit tests for StepSequencer BPM mode in `tests/components/utilities/StepSequencer.bpmMode.test.ts`:
  - When `bpmMode = 0` and global BPM changes, component's effective BPM updates
  - When `bpmMode = 1` and global BPM changes, component's effective BPM is unaffected
  - Switching from `bpmMode = 1` to `bpmMode = 0` immediately adopts the current global BPM
- [ ] T016 [P] [US2] Write unit tests for Collider BPM mode in `tests/components/utilities/Collider.bpmMode.test.ts`:
  - Same three scenarios as T015, applied to Collider

**Checkpoint**: Each tempo-aware component can independently follow global BPM or run at its own local tempo.

---

## Phase 5: User Story 3 — BPM Persisted Across Sessions (Priority: P3)

**Goal**: Global BPM and per-component BPM mode survive a save/load cycle. Legacy patches load cleanly at 120 BPM global mode.

**Independent Test**: Set global BPM to 95 and set the StepSequencer to local BPM at 60. Save the patch. Reload the page and load the patch. Confirm global BPM reads 95 and the StepSequencer is in local mode at 60. Then load a legacy patch (no `globalBpm` field) and confirm no error and global BPM defaults to 120.

### Implementation for User Story 3

- [ ] T017 [US3] Modify `PatchSerializer.serializePatch()` in `src/patch/PatchSerializer.ts`:
  - Import `globalBpmController`
  - Before returning the `PatchData` object, call `globalBpmController.saveToPatch(patch)` and return the result, so `globalBpm` is included in the serialized output
- [ ] T018 [US3] Modify `PatchManager` in `src/patch/PatchManager.ts` to restore global BPM on load:
  - Import `globalBpmController`
  - After components are instantiated and `deserialize()` is called on each, call `globalBpmController.loadFromPatch(patch)`
  - The emitted `GLOBAL_BPM_CHANGED` event will update any already-subscribed components; components added afterwards via `activate()` will read the current value directly
- [ ] T019 [P] [US3] Write serialization round-trip tests in `tests/patch/PatchSerializer.globalBpm.test.ts`:
  - Serialized patch includes `globalBpm` field matching `globalBpmController.getBpm()`
  - Deserializing a patch with `globalBpm: 95` sets `globalBpmController` to 95
  - Deserializing a legacy patch (no `globalBpm`) sets `globalBpmController` to 120 without error
  - Component `bpmMode` and local `bpm` parameters round-trip correctly through serialize/deserialize

**Checkpoint**: Full save/load cycle preserves all BPM state. Legacy patches load cleanly.

---

## Phase 6: UI — Global BPM Toolbar Control

**Purpose**: Surface global BPM to the user via the toolbar.

- [ ] T020 Add BPM widget container to `index.html`:
  - Inside `.top-bar-actions` (before or after the patch-name input), add: `<div id="global-bpm-control"></div>`
- [ ] T021 Create `src/ui/GlobalBpmControl.ts`:
  - Constructor accepts a container element (`HTMLElement`)
  - Renders: a `<label>` "BPM", a `<input type="number" min="30" max="300" step="1">` bound to `globalBpmController.getBpm()`, and a `<button>` "Tap"
  - On input `change`/`input`: call `globalBpmController.setBpm(Number(input.value))`
  - On `GLOBAL_BPM_CHANGED` event: update the input display (e.g., when a patch is loaded)
  - Tap tempo logic: push `Date.now()` to a `tapTimes` array; discard entries older than 3000ms; if ≥ 2 taps remain, compute average interval in ms, convert to BPM (`60000 / avgIntervalMs`), call `globalBpmController.setBpm(calculatedBpm)`
- [ ] T022 Instantiate `GlobalBpmControl` in `src/main.ts`:
  - Import `GlobalBpmControl`
  - After DOM is ready, find `document.getElementById('global-bpm-control')` and pass it to `new GlobalBpmControl(el)`
- [ ] T023 [P] Write unit tests for `GlobalBpmControl` in `tests/ui/GlobalBpmControl.test.ts`:
  - Numeric input change calls `globalBpmController.setBpm()` with the entered value
  - `GLOBAL_BPM_CHANGED` event updates the displayed input value
  - Tap tempo: 2 taps 500ms apart → ~120 BPM
  - Tap tempo: taps older than 3s are discarded before averaging
  - Input is clamped to min/max via the controller (no UI-level clamping needed beyond HTML attributes)

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T024 [P] Import `TempoAware` from `../../core/types` and add `implements TempoAware` to `StepSequencer` in `src/components/utilities/StepSequencer.ts` and to `Collider` in `src/components/utilities/Collider.ts` — enforces the subscription contract at compile time (depends on T003)
- [ ] T025 [P] Update `CLAUDE.md` via the `.specify` agent context pipeline (already handled by `update-agent-context.sh`; verify the entry was written correctly)
- [ ] T026 Run `vitest run` and confirm all new and existing tests pass
- [ ] T027 Run `npm run lint` and fix any warnings introduced by the feature
- [ ] T028 Manually verify the quickstart.md test scenario end-to-end in the browser, including SC-002: confirm that setting global BPM and adding three tempo-aware components to the patch takes under 60 seconds from a fresh page load

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 (T001–T004) — **blocks all user story phases**
- **Phase 3 (US1)**: Depends on Phase 2 complete (T005–T007)
- **Phase 4 (US2)**: Depends on Phase 3 complete (T008–T012)
- **Phase 5 (US3)**: Depends on Phase 2 complete; can run in parallel with Phase 3/4 if care is taken with `PatchSerializer` not to reference `bpmMode` until T008/T009 land
- **Phase 6 (UI)**: Depends on Phase 2 complete (T005); fully independent of Phases 3–5
- **Phase 7 (Polish)**: Depends on all previous phases

### User Story Dependencies

- **US1 (P1)**: Depends only on Foundational. No dependency on US2 or US3.
- **US2 (P2)**: Depends on US1 (requires subscription mechanism from T010/T011 to be in place before UI controls make sense)
- **US3 (P3)**: Depends on Foundational only for serialization; independently testable alongside US1

### Within Each Phase

- Models/parameters before subscription logic
- Subscription logic before UI controls
- All tests can be written in parallel with implementation tasks they test

### Parallel Opportunities

- T003 and T004 can run in parallel (different files)
- T008 and T009 can run in parallel (StepSequencer vs Collider)
- T010 and T011 can run in parallel after T008/T009 respectively
- T015 and T016 can run in parallel
- T019 and T023 can run in parallel with their corresponding implementation tasks
- Phase 6 (UI) can proceed in parallel with Phase 3 once Phase 2 is complete

---

## Parallel Example: Phase 3 (US1)

```
# T008 and T009 can run in parallel (different component files):
Task T008: "Add bpmMode parameter to StepSequencer in src/components/utilities/StepSequencer.ts"
Task T009: "Add bpmMode parameter to Collider in src/components/utilities/Collider.ts"

# After T008 and T009 complete, T010 and T011 can run in parallel:
Task T010: "Implement global BPM subscription in StepSequencer"
Task T011: "Implement global BPM subscription in Collider"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T004)
2. Complete Phase 2: Foundational (T005–T007) — **CRITICAL: blocks everything**
3. Complete Phase 3: US1 (T008–T012)
4. Complete Phase 6: UI (T020–T023) — global BPM is now user-controllable
5. **STOP and VALIDATE**: Change BPM in toolbar → StepSequencer and Collider both respond
6. Demo: single BPM control drives all tempo-aware components

### Incremental Delivery

1. Phase 1 + 2 → Controller exists, tested
2. Phase 3 + 6 → Global BPM works end-to-end (MVP)
3. Phase 4 → Per-component override available
4. Phase 5 → BPM survives save/load
5. Phase 7 → Polish and validation

---

## Notes

- `[P]` tasks touch different files and have no dependency on incomplete sibling tasks
- `bpmMode` serializes automatically via the existing `SynthComponent.serialize()` parameter map — no `ComponentData` type changes needed
- Legacy patch compatibility is free: `bpmMode` parameter defaults to `0` (global) when absent because `getParameter('bpmMode')?.getValue() ?? 0` returns 0
- Tap tempo intentionally requires ≥ 2 taps (`TAP_TEMPO_MIN_TAPS = 2`) before applying a value
- Run `vitest run` (not `npm test`) — bare `npm test` starts watch mode and never exits
