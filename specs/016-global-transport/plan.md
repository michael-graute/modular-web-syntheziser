# Implementation Plan: Global Transport Controller

**Branch**: `016-global-transport` | **Date**: 2026-04-28 | **Spec**: [spec.md](spec.md)

## Summary

Add a `GlobalTransportController` singleton that manages play/stop state, emits beat-tick events at the current BPM, and tracks bar/beat position. A `GlobalTransportControl` toolbar widget displays a ▶/■ toggle button and a live bar.beat counter. The Step Sequencer subscribes to transport start/stop; the Looper subscribes to transport stop (halts playback) and transport start (resumes playback if a loop is recorded). All wiring uses the existing EventBus — no tight coupling between components.

## Technical Context

**Language/Version**: TypeScript 5.6+, ES2020 target, strict mode
**Primary Dependencies**: Web Audio API (`AudioContext.currentTime` for scheduling), DOM — zero new runtime dependencies
**Storage**: No new patch fields needed — transport state is ephemeral (always starts stopped)
**Testing**: Vitest (run via `vitest run`)
**Target Platform**: Browser (Vite dev server / static build)
**Performance Goals**: 60 FPS canvas rendering unaffected; beat scheduling uses a lookahead timer on the JS thread (not the audio thread) with ~25 ms scheduling window
**Constraints**:
- Zero new runtime dependencies
- TypeScript strict mode enforced
- Follows existing singleton export pattern (`globalBpmController`, `eventBus`)
- No new patch format fields (transport is session state, not persisted)
- Beat scheduling must survive BPM changes mid-play without missing or doubling a tick

## Constitution Check

*GATE: Passed — no violations.*

- [x] **Readability & Maintainability**: `GlobalTransportController` mirrors `GlobalBpmController` in structure; all methods ≤ 30 lines
- [x] **Code Organization**: Controller in `src/core/`, UI widget in `src/ui/`, EventTypes added to `src/core/types.ts`
- [x] **Code Standards**: Named constants for all timing values; strict mode; no magic numbers
- [x] **Test Coverage**: State machine and beat-position logic are pure functions → 100% testable; StepSequencer/Looper integration tested via EventBus mocks
- [x] **Test Quality**: Isolated unit tests using fake timers (`vi.useFakeTimers`) for beat scheduling
- [x] **UI Consistency**: Toggle button inserted into `#global-bpm-control` area using same DOM construction pattern as `GlobalBpmControl`
- [x] **User Feedback**: Button label changes synchronously on click (▶ → ■); position display updates on every beat tick
- [x] **Performance**: Beat scheduling on JS thread via `setTimeout` lookahead; zero canvas rendering impact

## Project Structure

### Documentation (this feature)

```text
specs/016-global-transport/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/
│   ├── types.ts         ← TypeScript type contracts
│   └── validation.ts    ← Validation helpers
└── tasks.md             ← Phase 2 output (speckit.tasks)
```

### Source Code

```text
src/
├── core/
│   ├── types.ts                         MODIFIED — add EventType entries + payload types
│   └── GlobalTransportController.ts     NEW — transport singleton
├── ui/
│   └── GlobalTransportControl.ts        NEW — ▶/■ toggle button + bar.beat display
├── components/
│   └── utilities/
│       ├── StepSequencer.ts             MODIFIED — subscribe to transport events
│       └── Looper.ts                    MODIFIED — subscribe to transport events
└── main.ts                              MODIFIED — instantiate GlobalTransportControl

tests/
├── core/
│   └── GlobalTransportController.test.ts  NEW
├── ui/
│   └── GlobalTransportControl.test.ts     NEW
└── components/
    ├── StepSequencer.transport.test.ts    NEW
    └── Looper.transport.test.ts           NEW
```

## Complexity Tracking

No constitution violations to justify.
