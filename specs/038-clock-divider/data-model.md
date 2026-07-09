# Phase 1 Data Model: Clock Divider

## ClockDivider (SynthComponent subclass)

Extends `SynthComponent`, placed in `src/components/utilities/ClockDivider.ts`, registered as `ComponentType.CLOCK_DIVIDER` (category `Controllers` — it is a rhythm/performance-adjacent utility in the same spirit as Arpeggiator/Step Sequencer, per the sidebar's existing Controllers/Utilities split). No audio nodes, no CV/audio ports — six independent `SignalType.GATE` outputs only, zero inputs (per spec Assumptions: no external clock-in support in this feature).

### State

| Field | Type | Notes |
|---|---|---|
| `_currentBpm` | `number` | Cached copy of the global BPM, updated on every `GLOBAL_BPM_CHANGED` event. Defaults to `globalBpmController.getBpm()` at construction. |
| `_rates` | `[ClockDividerRate; 6]` (six `ClockDividerRate` fields, `rate1`…`rate6`, or an equivalent fixed-length structure) | Each output's currently assigned rate. Defaults per output: output 1 → `Div2`, output 2 → `Div4`, output 3 → `Div8`, output 4 → `Div16`, output 5 → `X2`, output 6 → `X3` — one output pre-assigned to each of the six rates named in FR-004/FR-005, so the component is immediately useful with no configuration. |
| `_nextTickTime` | `number[6]` | Per-output `AudioContext.currentTime`-space cursor for the lookahead scheduler (research.md decision 1). Not serialized — transient scheduling state, reset to `ctx.currentTime` whenever the scheduler (re)starts (`createAudioNodes()` or `TRANSPORT_PLAY`). |
| `_gateNodes` | `(ConstantSourceNode \| null)[6]` | The six independently-driven gate output nodes (research.md decision 2). Not serialized — audio-graph state, recreated in `createAudioNodes()`. |
| `_schedulerIntervalId` | `number \| null` | Handle for the shared 25ms `setInterval` poll loop (research.md decision 1). Not serialized — runtime-only. |
| `_unsubscribeBpm` | `(() => void) \| null` | `GLOBAL_BPM_CHANGED` subscription handle, following `StepSequencer`'s lifecycle convention. Not serialized. |
| `_unsubscribeTransportPlay`, `_unsubscribeTransportStop` | `(() => void) \| null` | Transport subscription handles, following `StepSequencer`/`Looper`'s convention. Not serialized. |

No ports other than the six gate outputs (constructor calls no `addInput`), no CV/audio nodes, no `addParameter` calls beyond the six rate parameters described below (which double as both live state and the persistence mechanism, per the existing `Parameter`-backed pattern — there is no separate non-parameter state for the rates).

### Methods (public API)

- `setRate(outputIndex: 1|2|3|4|5|6, rate: ClockDividerRate): void` — Updates a single output's assigned rate. Takes effect on that output's next natural pulse boundary (FR-008) — implemented by only changing the *interval* used for the next `_nextTickTime[i]` advance, never resetting `_nextTickTime[i]` itself, mirroring `StepSequencer.getStepInterval()`'s live-recompute-without-reset behavior (research.md decision 1). Internally calls `setParameterValue('rateN', rate)` so the change is both live and immediately serializable.
- `getRate(outputIndex: 1|2|3|4|5|6): ClockDividerRate` — Current rate assigned to that output.
- Inherited abstract methods:
  - `createAudioNodes(): void` — Creates and starts all six `ConstantSourceNode`s (offset 0 initially), registers each via `registerAudioNode`, initializes `_nextTickTime` for all six outputs to `ctx.currentTime`, starts the shared 25ms scheduler interval, subscribes to `GLOBAL_BPM_CHANGED`/`TRANSPORT_PLAY`/`TRANSPORT_STOP` (research.md decision 5).
  - `destroyAudioNodes(): void` — Clears the scheduler interval, unsubscribes all three event subscriptions, stops/disconnects all six `ConstantSourceNode`s.
  - `updateAudioParameter(parameterId, value): void` — For `rate1`…`rate6`, updates the corresponding entry in `_rates` (no other parameters exist).
  - `getInputNode(): AudioNode | null` — Returns `null` (no inputs).
  - `getOutputNode(): AudioNode | null` — Returns the first output's node (`_gateNodes[0]`, the `/2` output) as the sane default for callers that connect without specifying a port ID, mirroring `ChordFinder.getOutputNode()`'s "return the primary output" convention.
- Overridden:
  - `protected getOutputNodeByPort(portId: string): AudioNode | null` — Switch statement mapping `'out1'`…`'out6'` to the corresponding `_gateNodes[i]`, mirroring `ChordFinder.getOutputNodeByPort` exactly (research.md decision 2).

### Serialization

`serialize()` extends the base implementation (no override needed beyond the generic parameter mechanism): the base `SynthComponent.serialize()` already walks every registered `Parameter` (the six `rateN` parameters) into `ComponentData.parameters` as plain numbers — no Clock-Divider-specific serialize/deserialize override is required, since there is no non-parameter state to persist (unlike Notes' `text`/`width`/`height`, which needed a custom override because those aren't `Parameter`-backed). This satisfies FR-009 using zero new persistence code (research.md decision 3).

## ClockDividerRate (enum, contracts/types.ts)

| Value | Index | Beats per pulse | Meaning |
|---|---|---|---|
| `Div16` | 0 | 16 | One pulse every 16 beats |
| `Div8` | 1 | 8 | One pulse every 8 beats |
| `Div4` | 2 | 4 | One pulse every 4 beats |
| `Div2` | 3 | 2 | One pulse every 2 beats |
| `X2` | 4 | 0.5 | Two pulses per beat |
| `X3` | 5 | 1/3 | Three pulses per beat |

A parallel `RATE_BEATS_PER_PULSE: Record<ClockDividerRate, number>` lookup (mirroring `ArpSubdivision`'s `SUBDIVISION_FRACTIONS` map) provides the `beatsPerPulse` value fed to `TimingCalculator.beatsToMs(bpm, beatsPerPulse)` to compute each output's pulse period (research.md decision 4). A `RATE_LABELS: Record<ClockDividerRate, string>` map provides the on-canvas display string (`"/16"`, `"/8"`, `"/4"`, `"/2"`, `"x2"`, `"x3"`), satisfying SC-004 (identify each output's rate from the on-canvas display alone) and reusing the project's existing short-form vocabulary (research.md, spec Assumptions).

Ordered `Div16 → Div2 → X2 → X3` (slowest to fastest) so the dropdown option list reads as a single ascending-speed sequence, consistent with how `StepSequencer`'s `NOTE_DIVISION_LABELS` and `Arpeggiator`'s `ArpSubdivision` are both ordered slowest-to-fastest.

## ComponentData schema — no changes needed

Unlike prior features (e.g. Notes' `text?`/`width?`/`height?`), Clock Divider introduces **no new fields** on `ComponentData`. All six rate choices persist through the pre-existing, fully generic `parameters: Record<string, number>` field via the standard `addParameter`/`setParameterValue` mechanism (research.md decision 3) — confirmed as the uniform pattern used by every other enum-like choice in this codebase (Arpeggiator's `subdivision`, StepSequencer's `noteValue`/`bpmMode`, Collider's `scaleType`/`bpmMode`/`gateSize`).

Backward compatibility: N/A in the "legacy patch" sense — this is a wholly new component type, so there is no prior serialized shape to remain compatible with. A patch saved with Clock Divider and loaded by pre-038 code would simply fail to recognize `ComponentType.CLOCK_DIVIDER` (the same graceful-degradation behavior every new component type already has when opened by older app versions — not a regression this feature introduces).

## Validation rules

- Each `rateN` parameter's value MUST be one of the six valid `ClockDividerRate` indices (0–5) — enforced by the `Parameter`'s existing `min`/`max`/`step` clamping (`addParameter('rateN', ..., defaultIndex, 0, 5, 1, '')`), the same generic mechanism every other enum-index parameter in this codebase already relies on (no new validation code needed).
- No cross-output validation is required — any output may independently hold any rate, including two outputs sharing the same rate (spec edge case: "two outputs both set to /4... valid... fan out the same derived rate to multiple destinations").

## State Transitions

None in the SynthComponent sense (no lifecycle states like Looper's `LooperState`) — each output's rate is a simple, freely-mutable selection with no invalid transitions between values. The only temporal behavior is the scheduler's running/stopped state, which mirrors `TRANSPORT_PLAY`/`TRANSPORT_STOP` 1:1 (running while transport is playing, stopped and all six gates zeroed while transport is stopped) rather than being a component-owned state machine.
