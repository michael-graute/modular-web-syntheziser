# Quickstart: Arpeggiator Integration Scenarios

**Branch**: `029-arpeggiator` | **Date**: 2026-05-31

---

## Scenario 1: Basic keyboard arpeggio (US1 — MVP)

```
Keyboard ──CV Out──► Arpeggiator (CV In)
         ──Gate Out─► Arpeggiator (Gate In)

Arpeggiator ──CV Out──► Oscillator (Frequency CV)
            ──Gate Out─► ADSR (Gate) ──► VCA ──► Master Out
```

**What to expect**: Hold multiple keys — the Arpeggiator steps through them in the selected direction at the configured rate. Release a key and it drops from the cycle within one step.

---

## Scenario 2: Octave spread (US2)

Same patch as Scenario 1. Set **Octaves = 2**, **Direction = Up**.

```
Hold C4 + E4 + G4 → steps: C4, E4, G4, C5, E5, G5, C4, …
```

---

## Scenario 3: 1/16th-note arpeggio synced to BPM (US3)

Set global BPM to 120, **Rate = 1/16**. Steps fire at 240 ms / 4 = 62.5 ms each.

```
Global BPM ──GLOBAL_BPM_CHANGED event──► Arpeggiator (auto-adjusts step clock)
```

Change BPM while playing — the Arpeggiator adjusts within the current step.

---

## Scenario 4: Step Sequencer driving the Arpeggiator

```
Step Sequencer ──CV Out──► Arpeggiator (CV In)
               ──Gate Out─► Arpeggiator (Gate In)
```

Each sequencer step triggers a gate-high, latching the current pitch into the Arpeggiator's sequence. Gate-low on the next step removes it. Results in a dynamic, step-driven arpeggio texture.

---

## Scenario 5: Patch save / reload (US4)

1. Build Scenario 1 patch.
2. Set **Direction = Down**, **Octaves = 3**, **Rate = 1/8**, **Gate = Long**.
3. Save patch via the top-bar Save button.
4. Reload the page.
5. The Arpeggiator reappears with all parameters and connections restored.

---

## Connection notes

- **CV In** accepts `SignalType.CV` — any component with a CV pitch output.
- **Gate In** accepts `SignalType.GATE` — any component with a Gate output.
- **CV Out** emits `SignalType.CV` — connect to oscillator frequency CV input.
- **Gate Out** emits `SignalType.GATE` — connect to ADSR or any Gate input.
- The Arpeggiator has no audio-rate signal path. It produces only CV and Gate signals.
- Output is silent (gate off) when no notes are latched — safe to leave connected.

---

## Parameter reference

| Parameter | Control | Values | Default |
|-----------|---------|--------|---------|
| Direction | Knob (4 steps) | Up / Down / Up-Down / Random | Up |
| Octaves | Knob (4 steps) | 1 / 2 / 3 / 4 | 1 |
| Rate | Knob (4 steps) | 1/4 / 1/8 / 1/16 / 1/32 | 1/16 |
| Gate Length | Knob (3 steps) | Short / Medium / Long | Medium |
