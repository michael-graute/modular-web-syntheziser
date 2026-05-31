# Implementation Plan: Arpeggiator

**Branch**: `029-arpeggiator` | **Date**: 2026-05-31 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/029-arpeggiator/spec.md`

## Summary

Implement an Arpeggiator utility component that accepts a CV pitch input and a Gate input, maintains a latch queue of up to 8 notes (gate-high latches, gate-low removes), and continuously steps through the queue at a BPM-synced rate across a configurable octave range in one of four directions (Up, Down, Up-Down, Random), emitting CV and Gate outputs. The component uses the same `ConstantSourceNode` + JS-interval scheduling pattern as `StepSequencer`, subscribes to `GLOBAL_BPM_CHANGED` via `eventBus`, and persists through the existing `PatchSerializer` pipeline with no new `PatchData` fields.

## Technical Context

**Language/Version**: TypeScript 5.6+, ES2020 target, strict mode
**Primary Dependencies**: Web Audio API, DOM — zero runtime dependencies
**Storage**: `localStorage` via existing `PatchSerializer` / `PatchStorage` pattern
**Testing**: Vitest (run via `vitest run`)
**Target Platform**: Browser (Vite dev server / static build)
**Project Type**: Single-page modular synthesizer app (`src/` flat structure with `core/`, `components/`, `ui/`, `patch/`, `canvas/`, `timing/` directories)
**Performance Goals**: 60 FPS canvas rendering; audio parameter changes take effect within one Web Audio scheduler tick (~128 samples)
**Constraints**:
- Zero new runtime dependencies — Web Audio API + DOM only
- TypeScript strict mode enforced
- Follows existing singleton export pattern (`audioEngine`, `patchManager`, `eventBus`)
- Patch format changes must be backward-compatible (legacy patches must load without error)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Constitution Version**: 1.0

Verify feature compliance with project constitution principles:

- [x] **Readability & Maintainability**: The Arpeggiator has ~5 private fields and 4 parameters. `buildStepCycle()` (note expansion + direction sort) is the most complex method, well under 50 lines. `tick()` (advance step, schedule CV/Gate) is likewise bounded. All names are self-documenting.
- [x] **Code Organization**: New file at `src/components/utilities/Arpeggiator.ts`; registered in `registerComponents.ts`; wired into `ComponentType` enum, `componentLayout.ts`, `Sidebar.ts`, `CanvasComponent.ts`. No cross-cutting changes needed outside these files.
- [x] **Code Standards**: No magic numbers — `SUBDIVISION_FRACTIONS`, `GATE_LENGTH_FRACTIONS`, `ARP_MAX_NOTES` are named constants in `contracts/types.ts`. TypeScript strict mode satisfied; all node fields are nullable with null guards.
- [x] **Test Coverage**: Constructor, `buildStepCycle` (all 4 directions × octave range), note latch/unlatch, `tick` (CV/Gate scheduling), BPM update, serialize/deserialize, and getter registration will reach ≥ 80% coverage.
- [x] **Test Quality**: Tests follow AAA pattern, isolated via `beforeEach` with `vi.clearAllMocks()`, mock only `createGain`, `createConstantSource`, and `eventBus`. No shared state.
- [x] **UI Consistency**: Four stepped knobs (Direction, Octaves, Rate, Gate Length) using the existing `Knob` control. No new design tokens. Appears in Utilities sidebar section.
- [x] **User Feedback**: Parameter knob changes take effect within one step (≤ 62.5 ms at 120 BPM / 1/16). No loading states needed — synchronous parameter updates.
- [x] **Performance**: Two `ConstantSourceNode` instances + JS `setInterval` at 20 ms. Negligible CPU. No canvas display; no render loop.

## Project Structure

### Documentation (this feature)

```text
specs/029-arpeggiator/
├── plan.md              # This file
├── research.md          # Phase 0 output ✅
├── data-model.md        # Phase 1 output ✅
├── quickstart.md        # Phase 1 output ✅
├── contracts/           # Phase 1 output ✅
│   ├── types.ts         # TypeScript type contracts
│   └── validation.ts    # Validation helpers
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── core/types.ts                          # Add ComponentType.ARPEGGIATOR
├── components/
│   ├── base/SynthComponent.ts             # No changes needed (Arpeggiator is NOT bypassable)
│   ├── utilities/
│   │   └── Arpeggiator.ts                # NEW — core logic
│   └── registerComponents.ts             # Add registration entry
├── canvas/CanvasComponent.ts             # Add 'Arpeggiator' to getDisplayName() map
│                                         # Add case in createControls() for 4 knobs
├── ui/Sidebar.ts                         # Add icon for ARPEGGIATOR
└── utils/componentLayout.ts             # Add port counts (2 in, 2 out) + control layout

tests/
└── components/
    └── Arpeggiator.test.ts              # NEW — unit tests
```

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations. The Arpeggiator is architecturally identical to the StepSequencer arpeggiator mode, factored into a standalone component.

---

## Phase 0: Research

*See [research.md](./research.md) for full findings.*

Key decisions:
- **Scheduling**: `window.setInterval` (~20 ms) + `setValueAtTime` for sample-accurate CV/Gate output — same as StepSequencer.
- **Note sequence**: Plain `number[]` in JS; max 8 entries; latch on gate-high, remove on gate-low.
- **CV/Gate output**: Two `ConstantSourceNode` instances (`cvOutputNode`, `gateOutputNode`).
- **CV/Gate input reading**: JS-level getter functions (`setCvGetter`, `setGateGetter`) registered by ConnectionManager — mirrors StepSequencer arp-mode pattern.
- **BPM sync**: Subscribe to `GLOBAL_BPM_CHANGED` in `activate()`, unsubscribe in `deactivate()`.
- **Subdivision fractions**: Quarter=1.0, Eighth=0.5, Sixteenth=0.25, ThirtySecond=0.125 — fed directly into `timingCalculator.calculateGateDuration()`.

---

## Phase 1: Design & Contracts

*See [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md).*

### Arpeggiator.ts — public interface

```typescript
class Arpeggiator extends SynthComponent {
  // Registered via ConnectionManager (mirrors StepSequencer arp-mode setters)
  setCvGetter(fn: () => number): void
  setGateGetter(fn: () => number): void
  clearCvGetter(portId?: string): void
  clearGateGetter(portId?: string): void

  // SynthComponent overrides
  createAudioNodes(): void
  destroyAudioNodes(): void
  updateAudioParameter(parameterId: string, value: number): void
  getInputNode(portId?: string): AudioNode | null
  protected getInputNodeByPort(portId: string): AudioNode | null
  getOutputNode(): AudioNode | null
  protected getOutputNodeByPort(portId: string): AudioNode | null
  onInputConnected(portId: string): void
  onInputDisconnected(portId: string): void

  // Internal (tested via effects)
  private buildStepCycle(): number[]
  private tick(): void
  private startClock(): void
  private stopClock(): void
  private stepIntervalMs(): number
}
```

### CanvasComponent.ts — createControls() additions

The Arpeggiator needs 4 stepped knobs in `createControls()`:

| Knob | Parameter | Labels (discrete steps) |
|------|-----------|------------------------|
| Direction | `direction` | Up / Down / UpDn / Rand |
| Octaves | `octaves` | 1 / 2 / 3 / 4 |
| Rate | `subdivision` | 1/4 / 1/8 / 1/16 / 1/32 |
| Gate | `gateLength` | Short / Med / Long |

### componentLayout.ts additions

```
Port counts: inputs = 2 (cv-in, gate-in), outputs = 2 (cv-out, gate-out)
Control layout: 4 knobs → standard layout, no canvas display
```

### ConnectionManager integration

The `ConnectionManager` (or `SynthComponent.connectTo`) must register getter functions when connecting a CV/Gate source to the Arpeggiator's `cv-in` / `gate-in` ports. This follows the exact same pattern as the StepSequencer's `setArpGateGetter` / `setArpFreqGetter` — no new ConnectionManager infrastructure needed, only the Arpeggiator needs to implement the setter/clearer methods and the ConnectionManager's existing path for the StepSequencer case can be extended to also handle `ComponentType.ARPEGGIATOR`.
