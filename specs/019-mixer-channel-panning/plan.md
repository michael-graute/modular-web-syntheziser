# Implementation Plan: Mixer Channel Panning

**Branch**: `019-mixer-channel-panning` | **Date**: 2026-05-01 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/019-mixer-channel-panning/spec.md`

## Summary

Add an independent stereo pan knob to each of the Mixer's four channels. Pan is applied after the channel volume fader in the signal chain using a `StereoPannerNode` per channel (equal-power law, built into the Web Audio API). The pan knobs are rendered as a second row below the existing faders in the Mixer canvas component. Pan values (−1.0 to +1.0, default 0.0) are persisted via the existing `PatchSerializer` parameter mechanism. No new dependencies are required; the change is fully backward-compatible.

## Technical Context

**Language/Version**: TypeScript 5.6+, ES2020 target, strict mode
**Primary Dependencies**: Web Audio API (`StereoPannerNode`), DOM — zero runtime dependencies
**Storage**: `localStorage` via existing `PatchSerializer` / `PatchStorage` pattern
**Testing**: Vitest (run via `vitest run`)
**Target Platform**: Browser (Vite dev server / static build)
**Project Type**: Single-page modular synthesizer app (`src/` flat structure with `core/`, `components/`, `ui/`, `canvas/`, `timing/` directories)
**Performance Goals**: 60 FPS canvas rendering; audio parameter changes take effect within one Web Audio scheduler tick (~128 samples)
**Constraints**:
- Zero new runtime dependencies — Web Audio API + DOM only
- TypeScript strict mode enforced
- Follows existing singleton export pattern (`audioEngine`, `patchManager`, `eventBus`)
- Patch format changes must be backward-compatible (legacy patches must load without error)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Constitution Version**: 1.0

- [X] **Readability & Maintainability**: Per-channel pan logic loops over an array of `StereoPannerNode`s — same pattern as the existing `channelGains` array. Functions stay well under 50 lines.
- [X] **Code Organization**: Changes confined to `src/components/utilities/Mixer.ts`, `src/canvas/CanvasComponent.ts`, `src/utils/componentLayout.ts`. No new directories needed.
- [X] **Code Standards**: Named parameter IDs `pan1`–`pan4` follow the existing `gain1`–`gain4` pattern. Pan range constants extracted as named consts.
- [X] **Test Coverage**: Unit tests cover constructor (4 pan params), `createAudioNodes` (StereoPannerNode created, signal chain order), `updateAudioParameter`, serialize/deserialize (legacy patch defaults), and bypass behavior.
- [X] **Test Quality**: Tests follow existing AAA pattern in `tests/components/` — a `MockStereoPannerNode` will be added to `tests/mocks/WebAudioAPI.mock.ts`.
- [X] **UI Consistency**: Pan knob row follows the exact same layout arithmetic as other effects' knob rows. No new design tokens.
- [X] **User Feedback**: Pan knob visual update is synchronous (canvas redraws on next frame after parameter change).
- [X] **Performance**: Adding 4 `StereoPannerNode` instances is negligible CPU cost; canvas layout change does not affect render loop.

No constitution violations.

## Project Structure

### Documentation (this feature)

```text
specs/019-mixer-channel-panning/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/
│   ├── types.ts         ← TypeScript type contracts
│   └── validation.ts    ← Validation helpers
└── tasks.md             ← Phase 2 output (/speckit-tasks)
```

### Source Code (affected files only)

```text
src/
├── components/utilities/
│   └── Mixer.ts                  ← Add pan params + StereoPannerNode per channel;
│                                    update signal chain (fader → panner → bus);
│                                    handle pan in updateAudioParameter and bypass
├── canvas/
│   └── CanvasComponent.ts        ← Add pan knob row below fader row in Mixer block
└── utils/
    └── componentLayout.ts        ← Add numPanKnobs to Mixer layout descriptor;
                                     increase component height to accommodate knob row

tests/
├── mocks/
│   └── WebAudioAPI.mock.ts       ← Add MockStereoPannerNode
└── components/
    └── Mixer.test.ts             ← New test file covering all pan scenarios
```

## Complexity Tracking

No constitution violations requiring justification.

---

## Phase 0: Research

See [research.md](research.md).

---

## Phase 1: Design & Contracts

See [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md).
