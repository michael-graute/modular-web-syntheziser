# Tasks: MIDI Support (023)

**Input**: Design documents from `/specs/023-midi-support/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create new directories and extend existing type/event infrastructure that all later phases depend on.

- [X] T001 Create `src/midi/` directory (empty placeholder for MidiEngine)
- [X] T002 [P] Add `MidiMapping`, `MidiLearnSession`, `MidiDeviceInfo` interfaces to `src/core/types.ts` (from `specs/023-midi-support/contracts/types.ts`)
- [X] T003 [P] Add six MIDI `EventType` values to `src/core/types.ts`: `MIDI_DEVICE_CONNECTED`, `MIDI_DEVICE_DISCONNECTED`, `MIDI_LEARN_STARTED`, `MIDI_LEARN_COMPLETED`, `MIDI_LEARN_CANCELLED`, `MIDI_MAPPINGS_CHANGED`
- [X] T004 [P] Add `midiMappings?: MidiMapping[]` optional field to the `PatchData` interface in `src/core/types.ts`

**Checkpoint**: Type infrastructure ready — all downstream files can import new types without errors.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core `MidiEngine` singleton and patch serialisation hooks that all user story phases depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T005 Create `src/midi/MidiEngine.ts` — singleton class with: `requestAccess()` calling `navigator.requestMIDIAccess({ sysex: false })`; internal `Map<string, MidiMapping>` registry keyed by `componentId:parameterName`; internal `learnSession: MidiLearnSession | null = null`; `activeInputId: string | null`; `midiAccess: MIDIAccess | null`; `isLearnActive(): boolean` returning `this.learnSession !== null`; export singleton `midiEngine`. No dispatch logic yet.
- [X] T006 Add `saveToPatch(patch: PatchData): void` method to `MidiEngine` that writes `patch.midiMappings = Array.from(this.mappings.values())`
- [X] T007 Add `loadFromPatch(patch: PatchData): void` method to `MidiEngine` that replaces the registry with `sanitiseMidiMappings(patch.midiMappings ?? [])` — import `sanitiseMidiMappings` from a new `src/midi/midiValidation.ts` (copy logic from `specs/023-midi-support/contracts/validation.ts`)
- [X] T008 Create `src/midi/midiValidation.ts` — copy `isValidMidiMapping`, `scaleCcToParam`, `mappingKey`, `sanitiseMidiMappings` constants and functions verbatim from `specs/023-midi-support/contracts/validation.ts`
- [X] T009 Modify `src/patch/PatchSerializer.ts` — call `midiEngine.saveToPatch(patch)` during serialisation (after existing `globalBpmController.saveToPatch(patch)` call) and `midiEngine.loadFromPatch(patch)` during deserialisation (after components are recreated)
- [X] T010 Add `<div id="midi-toolbar"></div>` to `index.html` immediately below the `.canvas-container` closing tag and above the `.keyboard-section`

**Checkpoint**: `MidiEngine` exists, patch round-trips include MIDI mappings, HTML has toolbar mount point. Run `npx tsc --noEmit` — zero errors expected.

---

## Phase 3: User Story 1 — Play Keyboard via MIDI Input (Priority: P1) 🎯 MVP

**Goal**: A connected MIDI keyboard plays notes on the synthesizer polyphonically with velocity; device picker visible in toolbar; graceful fallback if MIDI unavailable.

**Independent Test**: Connect a MIDI keyboard → open app → browser permission prompt appears → grant it → device shows in toolbar picker → press keys → synthesizer produces notes → on-screen Keyboard highlights keys.

### Implementation for User Story 1

- [X] T011 [US1] Add `init(): Promise<void>` to `MidiEngine` that calls `navigator.requestMIDIAccess({ sysex: false })`, stores the result, registers `onstatechange` for hot-plug, and emits `MIDI_DEVICE_CONNECTED` / `MIDI_DEVICE_DISCONNECTED` on `eventBus`; if the API is unavailable or the Promise rejects, sets `midiAccess = null` and emits no device events
- [X] T011a [US1] In `MidiEngine.init()`, after enumerating available inputs, auto-select the first input if exactly one MIDI device is connected — call `this.setActiveInput(firstInput.id)` so users with a single keyboard require no manual device selection (SC-001)
- [X] T012 [US1] Add `getAvailableInputs(): MidiDeviceInfo[]` method to `MidiEngine` that returns all current `MIDIInput` entries as `MidiDeviceInfo` objects
- [X] T013 [US1] Add `setActiveInput(deviceId: string | null): void` to `MidiEngine` that unregisters any previous `onmidimessage` listener and registers a new one on the selected input
- [X] T014 [US1] Add `private handleMidiMessage(event: MIDIMessageEvent): void` to `MidiEngine` — parse note-on (status `0x9n`, velocity > 0), note-off (status `0x8n` or `0x9n` velocity 0), and CC (status `0xBn`) messages; for note-on emit `EventType.NOTE_ON` with `{ note, velocity: velocity/127 }` on `eventBus`; for note-off emit `EventType.NOTE_OFF` with `{ note }`; CC handling deferred to T020
- [X] T015 [P] [US1] Create `src/ui/MidiToolbar.ts` — DOM widget class following the `GlobalBpmControl` pattern: constructor inserts into `#midi-toolbar`; renders MIDI status indicator ("MIDI unavailable" / "No device" / device name); renders `<select>` device picker populated from `midiEngine.getAvailableInputs()`; renders "MIDI Learn" toggle button (inactive in this phase — wired in T024); subscribes to `MIDI_DEVICE_CONNECTED` and `MIDI_DEVICE_DISCONNECTED` events to refresh picker
- [X] T016 [US1] Wire `MidiEngine` and `MidiToolbar` in `src/main.ts`: import and call `await midiEngine.init()` after audio context setup; instantiate `new MidiToolbar()`; wire `MidiToolbar`'s device picker `change` event to `midiEngine.setActiveInput(selectedId)`; verify that the existing `triggerNoteOn(note, velocity)` call in `main.ts` accepts and forwards the velocity parameter from the `NOTE_ON` event payload (FR-004)
- [X] T016a [US1] Verify that the Keyboard component in `src/keyboard/Keyboard.ts` subscribes to `EventType.NOTE_ON` / `EventType.NOTE_OFF` on the `eventBus` and highlights keys accordingly (FR-003); if it uses only pointer callbacks, add eventBus subscriptions so MIDI-triggered notes are visually reflected on the on-screen keyboard
- [X] T017 [US1] Add basic MIDI toolbar styles to `src/styles/components.css`: `.midi-toolbar` layout (flex row, consistent with top-bar height), `.midi-status` indicator (green dot = connected, grey = unavailable), `.midi-learn-btn` base styles

**Checkpoint**: US1 complete. Connect MIDI keyboard → play notes → synthesizer sounds. `vitest run` passes. `npx tsc --noEmit` clean.

---

## Phase 4: User Story 2 — MIDI Learn for Knobs and Buttons (Priority: P2)

**Goal**: Any knob, slider, or button in any component can be assigned to a CC message via MIDI Learn; mappings persist in the patch file.

**Independent Test**: Enable MIDI Learn in toolbar → click any knob → knob highlights → turn physical CC knob → mapping confirmed → physical knob now drives the on-screen parameter in real time → save patch → reload page → mapping still works.

### Implementation for User Story 2

- [X] T018 [US2] Add `startLearn(componentId: string, parameterName: string): void` to `MidiEngine` — sets `learnSession`, emits `MIDI_LEARN_STARTED` with `{ componentId, parameterName }` on `eventBus`
- [X] T019 [US2] Add `cancelLearn(): void` to `MidiEngine` — clears `learnSession`, emits `MIDI_LEARN_CANCELLED` on `eventBus`
- [X] T020 [US2] Wire CC handling in `MidiEngine.handleMidiMessage()` (T014 stub): if `learnSession` is set, create a `MidiMapping` from the incoming CC event using the session's `componentId`/`parameterName` and the component's parameter bounds via `synthComponent.getParameterRange(parameterName)` (added in T020a); save to registry; clear `learnSession`; emit `MIDI_LEARN_COMPLETED` and `MIDI_MAPPINGS_CHANGED`; otherwise look up mapping by `channel:cc` and call `dispatchCc()`
- [X] T020a [US2] Add `getParameterRange(parameterName: string): { min: number; max: number }` to `src/components/base/SynthComponent.ts` — reads bounds from the component's existing parameter definition structure; returns `{ min: 0, max: 1 }` as a safe fallback for unknown parameters
- [X] T021 [US2] Add `dispatchCc(channel: number, cc: number, value: number): void` to `MidiEngine` — iterates all mappings whose `cc` and `channel` match (channel 0 = omni); calls `scaleCcToParam(value, mapping.minValue, mapping.maxValue)`; calls `synthComponent.setParameterValue(mapping.parameterName, scaledValue)` via component lookup; emits `EventType.PARAMETER_CHANGED` on `eventBus`
- [X] T022 [US2] Add component registry lookup to `MidiEngine` — inject or import the canvas component registry (or `SynthComponent` map from `canvas`) so `dispatchCc` can resolve `componentId` → `SynthComponent` instance
- [X] T023 [US2] Wire MIDI Learn toggle button in `MidiToolbar` — clicking activates global MIDI Learn mode (toolbar enters highlighted state); clicking again or pressing Escape calls `midiEngine.cancelLearn()`; subscribe to `MIDI_LEARN_STARTED`, `MIDI_LEARN_COMPLETED`, `MIDI_LEARN_CANCELLED` to update button state
- [X] T024 [US2] Add MIDI Learn click handler to `src/canvas/CanvasComponent.ts` — when `MidiEngine` is in learn mode and user clicks a control, call `midiEngine.startLearn(componentId, controlParamName)`; subscribe to `MIDI_LEARN_STARTED` to apply a visual "waiting" highlight (e.g., pulsing border or colour tint) on the matching control; subscribe to `MIDI_LEARN_COMPLETED` / `MIDI_LEARN_CANCELLED` to clear the highlight
- [X] T025 [US2] Add MIDI Learn highlight styles to `src/styles/components.css`: `.midi-learn-waiting` pulsing highlight class for controls awaiting assignment; `.midi-learn-assigned` subtle indicator for controls that have a mapping
- [X] T026 [US2] Add Escape key listener in `src/main.ts` — `keydown` handler that calls `midiEngine.cancelLearn()` when `event.key === 'Escape'` and learn session is active

**Checkpoint**: US2 complete. Full MIDI Learn flow works end-to-end. Save/reload a patch — mappings restored and CC knobs still drive parameters. `vitest run` passes.

---

## Phase 5: User Story 3 — View and Manage MIDI Mappings (Priority: P3)

**Goal**: User can open a mapping overview listing all active CC assignments and delete individual mappings or clear all.

**Independent Test**: Open MIDI mappings modal → all current mappings shown (component name, parameter, CC, channel) → delete one → physical knob no longer moves that parameter → "Clear All" removes everything after confirmation.

### Implementation for User Story 3

- [X] T027 [US3] Add `getMappings(): MidiMapping[]` to `MidiEngine` — returns `Array.from(this.mappings.values())`
- [X] T028 [US3] Add `removeMapping(componentId: string, parameterName: string): void` to `MidiEngine` — deletes from registry, emits `MIDI_MAPPINGS_CHANGED`
- [X] T029 [US3] Add `clearAllMappings(): void` to `MidiEngine` — clears registry, emits `MIDI_MAPPINGS_CHANGED`
- [X] T030 [P] [US3] Create `src/ui/MidiMappingsModal.ts` — modal following the existing Welcome Dialog pattern: hidden by default; `open()` / `close()` methods; renders a table of mappings with columns (Component, Parameter, CC, Channel) plus a Delete button per row; renders a "Clear All" button with a `window.confirm()` guard; subscribes to `MIDI_MAPPINGS_CHANGED` to refresh table while open
- [X] T031 [US3] Wire "Mappings" button in `MidiToolbar` to `midiMappingsModal.open()`; instantiate `MidiMappingsModal` in `src/main.ts`
- [X] T032 [US3] Add modal styles to `src/styles/components.css`: `.midi-mappings-modal` overlay, `.midi-mappings-table` table layout, empty-state message when no mappings exist

**Checkpoint**: US3 complete. All three user stories independently functional. `vitest run` passes.

---

## Phase 6: Tests

**Purpose**: Unit and integration test coverage for critical logic per constitution requirements (≥80% for critical logic, 100% for utility functions).

- [X] T033 [P] Create `tests/midi/midiValidation.test.ts` — 100% coverage of `isValidMidiMapping`, `scaleCcToParam`, `mappingKey`, `sanitiseMidiMappings` (boundary values: cc=0, cc=127, channel=0, channel=15, maxValue=minValue edge case)
- [X] T034 [P] Create `tests/midi/MidiEngine.test.ts` — unit tests using a mock `MIDIAccess` object: device enumeration, note-on/off dispatch to eventBus, CC dispatch with value scaling, MIDI Learn state machine (start → receive CC → complete; start → cancel), `saveToPatch` / `loadFromPatch` round-trip, omni-channel matching (channel=0 matches any incoming channel)
- [X] T035 [P] Extend `tests/patch/PatchSerializer.test.ts` — add round-trip tests: patch with `midiMappings` serialises and deserialises correctly; legacy patch without `midiMappings` loads without error (treated as empty array)
- [X] T036 Create `tests/ui/MidiToolbar.test.ts` — DOM tests via jsdom: toolbar renders in `#midi-toolbar`; device picker updates on `MIDI_DEVICE_CONNECTED` event; MIDI Learn button toggles active state

**Checkpoint**: `vitest run` green across all new and extended test files.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T037 [P] Verify `npx tsc --noEmit` reports zero errors across all new and modified files
- [X] T038 [P] Run `npm run lint` — fix any warnings introduced by new files
- [X] T039 Add `.midi-learn-assigned` subtle indicator to `CanvasComponent` rendered controls that have an active mapping (small MIDI icon or coloured dot in corner of the knob)
- [X] T040 Verify MIDI toolbar displays correctly at all existing viewport sizes (no layout overflow); adjust `.midi-toolbar` CSS if needed
- [X] T041 [P] Update `specs/023-midi-support/quickstart.md` if any implementation details diverged from the plan

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately; T002, T003, T004 are parallel
- **Phase 2 (Foundational)**: Depends on Phase 1 — **BLOCKS all user story phases**
- **Phase 3 (US1)**: Depends on Phase 2; T015 is parallel with T011–T014
- **Phase 4 (US2)**: Depends on Phase 3 (requires active input and note dispatch to be wired)
- **Phase 5 (US3)**: Depends on Phase 2 only; can start alongside Phase 4 if desired
- **Phase 6 (Tests)**: T033–T035 can start as soon as Phase 2 is complete; T036 requires Phase 3
- **Phase 7 (Polish)**: Depends on Phases 3–6 complete

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2 — no dependency on US2/US3
- **US2 (P2)**: Depends on US1 (requires active MIDI input and note dispatch infrastructure)
- **US3 (P3)**: Depends on Phase 2 only; `MidiEngine.getMappings()` / `removeMapping()` / `clearAllMappings()` are independent of US1/US2 wiring

### Within Each Phase

- Models / pure logic → services → UI wiring
- `MidiEngine` core methods before `MidiToolbar` (toolbar calls engine methods)
- Engine dispatch (T020–T022) before CanvasComponent learn handler (T024)

### Parallel Opportunities

- T002, T003, T004 (Phase 1) — different sections of `types.ts`, no conflict if done atomically
- T005–T008 (Phase 2) — new files, fully parallel
- T015 (MidiToolbar) can be drafted in parallel with T011–T014 (engine methods)
- T030 (MidiMappingsModal) parallel with T027–T029 (engine accessors)
- T033, T034, T035, T036 (tests) — all different files, fully parallel

---

## Parallel Example: Phase 2

```
Parallel batch:
  T005 — src/midi/MidiEngine.ts (skeleton)
  T008 — src/midi/midiValidation.ts

Sequential after T005 + T008:
  T006 — MidiEngine.saveToPatch()
  T007 — MidiEngine.loadFromPatch() (imports midiValidation)
  T009 — PatchSerializer.ts integration
  T010 — index.html toolbar mount point
```

## Parallel Example: User Story 1

```
Parallel batch (after Phase 2):
  T011 — MidiEngine.init()
  T015 — MidiToolbar.ts (skeleton, device picker)
  T017 — CSS styles

Sequential:
  T012 — MidiEngine.getAvailableInputs()
  T013 — MidiEngine.setActiveInput()
  T014 — MidiEngine.handleMidiMessage() (note routing)
  T016 — main.ts wiring (depends on T011–T015)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (types, EventType, PatchData extension)
2. Complete Phase 2: Foundational (MidiEngine skeleton, patch serialisation, HTML mount)
3. Complete Phase 3: User Story 1 (MIDI input, note routing, toolbar with device picker)
4. **STOP and VALIDATE**: Connect keyboard → play notes → confirm polyphony and velocity
5. MVP shipped — MIDI keyboard performance is live

### Incremental Delivery

1. Phase 1 + 2 → Foundation ready (15 min)
2. Phase 3 → US1 complete → **Play MIDI keyboard** (MVP)
3. Phase 4 → US2 complete → **MIDI Learn for all controls**
4. Phase 5 → US3 complete → **Mapping management panel**
5. Phase 6 → Tests green
6. Phase 7 → Polish and lint clean

---

## Notes

- [P] tasks touch different files and have no incomplete dependencies — safe to parallelise
- Each user story checkpoint is independently demonstrable
- `vitest run` is the correct test command (not `npm test` which starts watch mode)
- Commit after each phase checkpoint at minimum
- `npx tsc --noEmit` should stay clean throughout — check after each phase
