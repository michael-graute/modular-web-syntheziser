# Quickstart: Karplus-Strong String Synthesizer

**Feature**: `034-karplus-strong-oscillator`

## Try it as a musician (manual verification)

1. Run the dev server: `npm run dev`.
2. Drag a **Karplus-Strong** module from the Generators section of the component palette onto the canvas.
3. Drag a **Keyboard** module onto the canvas. Patch the Keyboard's Gate output to the Karplus-Strong's Trigger input, and the Keyboard's Pitch CV output to the Karplus-Strong's Pitch CV input.
4. Patch the Karplus-Strong's Audio output to **Master Out**.
5. Play a key on the Keyboard. You should hear a plucked-string tone that decays naturally. Play different keys and confirm the pitch follows correctly (an octave higher key sounds an octave higher).
6. Sweep the **Damping** knob while re-triggering — confirm the decay time visibly/audibly lengthens or shortens.
7. Sweep the **Tone** knob while re-triggering — confirm the pluck's brightness changes.
8. Switch **Mode** between "String" and "Stretched" and re-trigger at the same pitch/damping — confirm a clearly different decay character.
9. Save the patch (top-bar Save), reload the page, load the patch back — confirm Frequency/Damping/Tone/Mode and all cable connections are restored exactly.
10. Watch the module's canvas panel while triggering — confirm the live waveform/level display responds.

## Automated verification (for implementation)

- `vitest run` — runs the full suite, including:
  - `tests/worklets/karplus-strong-dsp.test.ts` — pure DSP helper unit tests (coefficient mapping, delay-line length calculation, frequency clamping) requiring no `AudioContext`.
  - `tests/components/generators/KarplusStrong.test.ts` — component-level tests using the project's existing mock-`AudioContext` pattern (parameter defaults, clamping, serialize/deserialize round-trip, mode persistence).
- `npm run lint` — must pass with zero warnings on both the component and the new `src/worklets/karplus-strong.worklet.ts` source.

## Key files touched

See plan.md "Project Structure" for the full list. The fastest way to verify wiring is complete:
- Component appears in the palette under Generators.
- `componentLayout.ts` sizes the module correctly (no visual overlap/clipping of controls).
- `CanvasComponent.createControls()` has a case producing all four interactive controls (Frequency, Damping, Tone, Mode).
- MIDI Learn works on Frequency, Damping, and Tone (per FR-011) — right-click or long-press the control and confirm a MIDI-mappable context menu appears, consistent with other components.
