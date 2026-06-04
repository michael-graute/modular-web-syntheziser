# Quickstart: ChordFinder Poly CV Output

**Feature**: 033-chordfinder-poly-cv

## What changes

One file modified: `src/components/utilities/ChordFinder.ts`

No new files in `src/`. No changes to ConnectionManager, CanvasComponent, serialization, or any other component.

## The three additions to ChordFinder

### 1. Private poly slot array

```ts
private polySlots: VoiceSlot[] = Array.from({ length: 4 }, (_, i) => ({
  voiceIndex: i as 0 | 1 | 2 | 3,
  frequency: 0,
  gate: 0 as 0 | 1,
  note: null,
  timestamp: 0,
}));
```

Initialized in the constructor before `addOutput` calls.

### 2. The poly-cv output port (in constructor)

```ts
this.addOutput('poly-cv', 'Poly CV', SignalType.POLY_CV);
```

Added after the existing `note1`/`note2`/`note3`/`gate` outputs.

### 3. The getVoiceSlots method

```ts
getVoiceSlots(): Readonly<VoiceSlot[]> {
  return this.polySlots;
}
```

This is the only method ConnectionManager needs. Duck-typed — no interface declaration needed at runtime.

### 4. getOutputNodeByPort update

```ts
case 'poly-cv': return null; // data-only port, no AudioNode
```

Added to the existing switch in `getOutputNodeByPort()`.

### 5. pressChord update (slot writes)

Inside the existing `pressChord()`, after computing `midiToHz` and `octaveShift`:

```ts
// Poly slots — mirror note frequencies into voice slots
const notes = chord.notes;
for (let i = 0; i < 3; i++) {
  this.polySlots[i]!.frequency = midiToHz(notes[i]! + octaveShift);  // ← wrong, octaveShift already in midiToHz
  this.polySlots[i]!.gate = 1;
}
// slot 3 stays gate=0, frequency=0 permanently
```

Note: use the same `midiToHz(chord.notes[i]! + octaveShift)` call already present for the mono outputs, reusing the same computed values.

### 6. releaseChord update (gate off)

Inside the existing `releaseChord()`, after the mono gate release:

```ts
for (let i = 0; i < 3; i++) {
  this.polySlots[i]!.gate = 0;
  // frequency intentionally retained
}
```

## How the poly chain reads ChordFinder

```
ChordFinder.getVoiceSlots()  ←  PolyOscillator (reads frequency each rAF frame)
                              ←  PolyADSR (reads gate each rAF frame, triggers env on edge)
```

ConnectionManager registers the getter when a POLY_CV cable is connected:
```ts
tgt.setVoiceSlotsGetter(() => src.getVoiceSlots());
```

No further wiring needed.

## How to test manually

1. Open the synthesiser. Add: ChordFinder, PolyOscillator, PolyADSR, PolyVCA, Master Out.
2. Connect ChordFinder **poly-cv** → PolyOscillator **poly-cv**.
3. Connect ChordFinder **poly-cv** → PolyADSR **poly-cv** (second cable from same port — if the UI supports fan-out; otherwise connect PolyADSR downstream of PolyOscillator if that's the arch).
4. Connect PolyOscillator **poly-audio** → PolyADSR **poly-audio-0..3** (per the 032 patch).
5. Connect PolyVCA **output** → Master Out.
6. Press any chord button → hear three simultaneous pitches with envelope shaping.
7. Release the button → three voices fade out (release tail audible).
8. Existing mono outputs (note1/note2/note3/gate) still work normally if wired.

## Running tests

```sh
vitest run tests/components/ChordFinder.emit.test.ts
vitest run tests/unit/components/ChordFinder.test.ts
```

After adding the new poly test file:

```sh
vitest run tests/components/ChordFinder.poly.test.ts
```
