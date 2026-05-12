# Implementation Plan: MIDI Support

**Branch**: `023-midi-support` | **Date**: 2026-05-12 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/023-midi-support/spec.md`

## Summary

Add full MIDI input support to the modular web synthesizer: polyphonic note-on/off routing from any connected MIDI keyboard to the existing Keyboard component, plus a MIDI Learn system allowing any knob or button in any component to be assigned to a MIDI CC message. All mappings are persisted inside the patch file. A permanently visible MIDI toolbar provides device selection and MIDI Learn toggle. Implemented as a new `MidiEngine` singleton following the existing `audioEngine` / `patchManager` singleton pattern, with zero new runtime dependencies.

## Technical Context

**Language/Version**: TypeScript 5.6+, ES2020 target, strict mode
**Primary Dependencies**: Web Audio API, Web MIDI API, DOM — zero runtime dependencies
**Storage**: `localStorage` via existing `PatchSerializer` / `PatchStorage` pattern; `midiMappings?: MidiMapping[]` added to `PatchData`
**Testing**: Vitest (run via `vitest run`)
**Target Platform**: Browser (Vite dev server / static build) — Chrome/Edge for MIDI; graceful fallback for Safari/Firefox
**Project Type**: Single-page modular synthesizer app (`src/` flat structure with `core/`, `components/`, `ui/`, `patch/`, `canvas/`, `timing/` directories)
**Performance Goals**: 60 FPS canvas rendering; MIDI note-to-sound latency < 10ms; CC dispatch synchronous on main thread
**Constraints**:
- Zero new runtime dependencies — Web Audio API + Web MIDI API + DOM only
- TypeScript strict mode enforced
- Follows existing singleton export pattern (`audioEngine`, `patchManager`, `eventBus`)
- Patch format changes must be backward-compatible (legacy patches load without error)

## Constitution Check

**Constitution Version**: 1.0

- [x] **Readability & Maintainability**: `MidiEngine` split into focused methods (<50 lines each); learn state machine is a simple two-state switch; value scaling is a pure function.
- [x] **Code Organization**: New code lives in `src/midi/` (engine) and `src/ui/` (toolbar, modal) — consistent with existing `src/ui/GlobalBpmControl.ts` pattern.
- [x] **Code Standards**: No magic numbers (CC range constants in `validation.ts`); strict TypeScript; no new linting exceptions needed.
- [x] **Test Coverage**: `MidiEngine` CC dispatch and scaling logic → 100%; `PatchSerializer` round-trip → extended; UI widgets → DOM assertions via Vitest/jsdom.
- [x] **Test Quality**: All tests isolated via mock `MIDIAccess`; AAA pattern; descriptive names.
- [x] **UI Consistency**: MIDI toolbar follows `GlobalBpmControl` DOM-widget pattern; MIDI Learn highlight follows existing bypass visual pattern; modal follows existing Welcome Dialog pattern.
- [x] **User Feedback**: Device connection shown immediately in toolbar; MIDI Learn waiting state shows highlight synchronously on click; mapping confirmed synchronously on CC receipt.
- [x] **Performance**: CC dispatch is O(1) map lookup + synchronous `setParameterValue()` call — no new render work; canvas FPS unaffected.

No constitution violations. Complexity Tracking section left empty.

## Project Structure

### Documentation (this feature)

```text
specs/023-midi-support/
├── plan.md              ← This file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/
│   ├── types.ts         ← TypeScript type contracts
│   └── validation.ts    ← Validation and scaling helpers
└── tasks.md             ← Phase 2 output (/speckit-tasks)
```

### Source Code (new and modified files)

```text
src/
├── core/
│   └── types.ts             ← MODIFIED: MidiMapping, MidiLearnSession, MidiDeviceInfo, 6 EventType values, PatchData.midiMappings
├── midi/
│   └── MidiEngine.ts        ← NEW: singleton — Web MIDI access, CC dispatch, learn state machine
├── ui/
│   ├── MidiToolbar.ts       ← NEW: device picker + MIDI Learn toggle widget
│   └── MidiMappingsModal.ts ← NEW: modal for viewing/deleting CC mappings
├── patch/
│   └── PatchSerializer.ts   ← MODIFIED: saveToPatch / loadFromPatch calls
├── styles/
│   └── components.css       ← MODIFIED: toolbar, highlight, modal styles
└── main.ts                  ← MODIFIED: instantiate MidiEngine, MidiToolbar, MidiMappingsModal; wire note callbacks

index.html                   ← MODIFIED: add <div id="midi-toolbar">

tests/
├── midi/
│   └── MidiEngine.test.ts   ← NEW
└── ui/
    └── MidiToolbar.test.ts  ← NEW
```

## Phase 0: Research

**Status**: Complete — see [research.md](research.md)

Key decisions:
- Use native Web MIDI API, no libraries.
- `MidiEngine` singleton mirrors `audioEngine` pattern.
- Emit existing `NOTE_ON` / `NOTE_OFF` events for note routing — no Keyboard changes.
- CC dispatch calls `setParameterValue()` + emits `PARAMETER_CHANGED` — no CanvasComponent changes.
- Two-state MIDI Learn machine (idle ↔ waiting) owned by `MidiEngine`.
- `midiMappings?: MidiMapping[]` added to top-level `PatchData`.

## Phase 1: Design & Contracts

**Status**: Complete

- [data-model.md](data-model.md) — entity definitions, state transitions, registry structure
- [contracts/types.ts](contracts/types.ts) — `MidiMapping`, `MidiLearnSession`, `MidiDeviceInfo`, event payload shapes
- [contracts/validation.ts](contracts/validation.ts) — `isValidMidiMapping`, `scaleCcToParam`, `mappingKey`, `sanitiseMidiMappings`
- [quickstart.md](quickstart.md) — new/modified files, integration points, test commands

## Complexity Tracking

> No constitution violations found. Section intentionally empty.
