# Quickstart: Slew Limiter / Portamento

**Feature**: 031-slew-limiter-portamento

---

## What This Feature Does

The Slew Limiter sits between any CV source and any CV destination. It smooths abrupt jumps in the CV signal, turning sharp steps into gentle glides. This is the classic portamento / glide effect — previously impossible to apply to Sequencer or Collider CV output.

## Primary Patch (Portamento on Sequencer)

```
Step Sequencer  →  [CV Out]  →  Slew Limiter [CV In]
Slew Limiter    →  [CV Out]  →  Oscillator [Pitch CV]
```

1. Add a **Step Sequencer**, **Slew Limiter**, and **Oscillator** to the canvas.
2. Patch: Sequencer CV Out → Slew Limiter CV In.
3. Patch: Slew Limiter CV Out → Oscillator Pitch CV.
4. Turn the **Rise** knob up to ~200 ms. Press Play. Each note change now glides.

## Controls

| Knob | Range | Effect |
|------|-------|--------|
| Rise | 0–5000 ms | Time to glide *upward* to a higher CV value |
| Fall | 0–5000 ms | Time to glide *downward* to a lower CV value |

Both knobs use an **exponential scale** — small rotations near zero give fine control over short glides (1–50 ms); larger rotations span the multi-second range.

## Bypass

Click the bypass button (standard component header) to pass CV through unmodified. Useful for A/B comparison.

## Other Useful Patches

**LFO edge softening**:
```
LFO (square) → Slew Limiter → Oscillator detune CV
```
Softens the hard edges of a square LFO into slow ramps.

**Collider glide**:
```
Collider CV Out → Slew Limiter → Oscillator Pitch CV
```
Adds portamento to randomly generated Collider pitches.

## Patch Persistence

Rise and Fall values are saved with the patch and restored on reload.
