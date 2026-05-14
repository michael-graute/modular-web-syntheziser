# Implementation Plan: MIDI Monitor

**Branch**: `024-midi-monitor` | **Date**: 2026-05-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/024-midi-monitor/spec.md`

## Summary

Add a "MIDI Monitor" button to the existing `MidiToolbar` that opens a draggable floating overlay window. The window subscribes to raw MIDI messages via `MidiEngine` and renders a capped, scrolling log of all incoming MIDI events in real time. The log is cleared on demand. No persistence beyond in-memory state; no new runtime dependencies.

## Technical Context

**Language/Version**: TypeScript 5.6+, ES2020 target, strict mode
**Primary Dependencies**: Web Audio API, DOM — zero runtime dependencies
**Storage**: None — log is in-memory only; not persisted to `localStorage`
**Testing**: Vitest (run via `vitest run`)
**Target Platform**: Browser (Vite dev server / static build)
**Project Type**: Single-page modular synthesizer app (`src/` flat structure with `core/`, `components/`, `ui/`, `patch/`, `canvas/`, `timing/` directories)
**Performance Goals**: 60 FPS canvas rendering; log updates must not block the main thread
**Constraints**:
- Zero new runtime dependencies — Web Audio API + DOM only
- TypeScript strict mode enforced
- Follows existing singleton export pattern (`audioEngine`, `patchManager`, `eventBus`, `midiEngine`)
- MIDI event routing goes through `MidiEngine.handleMidiMessage()` — monitor taps into this via a new `EventType.MIDI_MESSAGE_RECEIVED` event emitted on `eventBus`

## Constitution Check

**Constitution Version**: 1.0

- [x] **Readability & Maintainability**: `MidiMonitorWindow` is a single-responsibility class; `MidiLogEntry` type is self-documenting; all functions stay under 50 lines
- [x] **Code Organization**: New file lives in `src/ui/` alongside `MidiToolbar.ts`, `MidiMappingsModal.ts`; new `EventType` entry added to `src/core/types.ts`
- [x] **Code Standards**: All new constants (MAX_LOG_ENTRIES = 500) are named; strict mode passes; linting clean
- [x] **Test Coverage**: `MidiMonitorWindow` unit tests cover: entry formatting, FIFO cap, clear, auto-scroll flag, duplicate-open guard; target ≥ 80% coverage
- [x] **Test Quality**: Tests isolated via fresh class instantiation; AAA pattern; descriptive names
- [x] **UI Consistency**: Floating window uses existing CSS variable tokens (`--z-index-popover`, `--color-*`, `--spacing-*`); draggable pattern follows DOM conventions; no new design tokens
- [x] **User Feedback**: Button click opens window synchronously; clear button empties list within same animation frame
- [x] **Performance**: Log append is O(1) amortized (array splice + DOM append); FIFO trim only on cap breach; no blocking operations

No constitution violations.

## Project Structure

### Documentation (this feature)

```text
specs/024-midi-monitor/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── types.ts         # MidiRawMessagePayload, MidiLogEntry, MIDI_TYPE_LABELS, midiNoteToName
│   └── validation.ts    # formatMidiLogEntry, formatWallClock, parseMidiType, parseMidiChannel
└── tasks.md             # Phase 2 output (not created here)
```

### Source Code (new/modified files)

```text
src/
├── core/
│   └── types.ts                        # ADD: EventType.MIDI_MESSAGE_RECEIVED, MidiRawMessagePayload
├── midi/
│   └── MidiEngine.ts                   # MODIFY: emit MIDI_MESSAGE_RECEIVED in handleMidiMessage()
├── ui/
│   ├── MidiToolbar.ts                  # MODIFY: add monitorBtn + MidiMonitorWindow instance
│   └── MidiMonitorWindow.ts            # NEW: floating window class
└── styles/
    └── components.css                  # ADD: .midi-monitor-* CSS rules

tests/
└── ui/
    └── MidiMonitorWindow.test.ts       # NEW: unit tests
```

## Complexity Tracking

No violations requiring justification.
