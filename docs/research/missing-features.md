# Missing Features Research

**Created**: 2026-05-30  
**Context**: Survey of gaps in the modular web synthesizer based on the 24 implemented components as of May 2026.

---

## Current Component Inventory (as of survey)

| Category | Components |
|----------|-----------|
| Generators | Oscillator, FM Oscillator, LFO, Noise, Karplus-Strong |
| Processors | Filter, VCA, ADSR Envelope, Parametric EQ |
| Effects | Delay, Reverb, Distortion, Chorus, Bitcrusher, Flanger, Phaser, Tremolo, Ring Modulator |
| Utilities | Keyboard, Master Out, Mixer, Step Sequencer, Chord Finder, Collider, Looper |
| Analyzers | Oscilloscope, VU Meter |

---

## Identified Gaps

### Synthesis Fundamentals

- **Sample Player / Wavetable Oscillator** — no way to load audio files or user-defined waveforms; most modular systems have this. Would open up sampling, one-shot drums, and wavetable synthesis workflows.
- ~~**Karplus-Strong / Physical Modeling**~~ ✅ *Implemented in `src/components/generators/KarplusStrong.ts` (branch `034-karplus-strong-oscillator`)* — algorithmic plucked-string/percussive synthesizer using the classic delay-line-with-feedback-filter technique, driven by a custom AudioWorkletNode (the project's first). Gate-triggered "pluck" excitation, 1V/octave pitch CV tracking with a manual Frequency/transpose knob, Damping (decay length) and Tone (pick-position brightness) controls, and four selectable decay-algorithm Modes: String (clean harmonic decay), Stretched (longer, rougher/percussive — good for toms/drums), Muted (dull, palm-mute character), and Metallic (inharmonic, bell/kalimba-like via a detuned second delay tap). Live waveform display and full patch persistence.
- ~~**Ring Modulator**~~ ✅ *Implemented in `src/components/effects/RingModulator.ts` (branch `028-ring-modulator`)* — classic AM synthesis, absent despite an otherwise complete effects chain. Simple to implement; produces metallic, bell-like timbres by multiplying two audio signals.

### Modulation & Control

- ~~**Quantizer**~~ ✅ *Implemented in `src/components/utilities/Quantizer.ts` (branch `025-quantizer`)* — snaps free-running CV to musical scales; supports 8 scale types, 12 root notes, optional gate/trigger input for rhythmically locked pitch steps, and full patch persistence.
- ~~**Envelope Follower**~~ ✅ *Implemented in `src/components/analyzers/EnvelopeFollower.ts` (branch `030-envelope-follower`)* — converts incoming audio amplitude to a 0–1 CV signal via periodic RMS analysis (AnalyserNode); independent Attack (1–500 ms) and Release (5–2000 ms) IIR smoothing; Gain/Sensitivity knob (0.1×–4×); live vertical bar-meter display; CV output patchable to any CV-accepting input; full patch persistence.
- **S&H (Sample & Hold) — standalone** — already exists as an LFO waveform mode, but a dedicated module would allow any CV source (not just LFO) to be sampled on a trigger. Common utility for stepped random CV.
- ~~**Slew Limiter / Portamento**~~ ✅ *Implemented in `src/components/utilities/SlewLimiter.ts` (branch `031-slew-limiter-portamento`)* — smooths abrupt CV jumps via frame-driven IIR lowpass; independent Rise and Fall time controls (0–5000 ms, exponential scale); live vertical bar-meter display; bypass support; CV output patchable to any CV-accepting input; full patch persistence.

### Signal Processing

- **Wavefolder** — distinctive west-coast synthesis texture; folds the waveform back on itself when it exceeds a threshold. Complements Distortion and Bitcrusher with a different character.
- ~~**EQ / Parametric Filter**~~ ✅ *Implemented in `src/components/processors/ParametricEQ.ts` (branch `026-parametric-eq`)* — 3-band parametric EQ (low shelf, mid peak, high shelf) with per-band gain CV inputs for LFO modulation (1V = 1 dB), bypass support, and full patch persistence.
- **Vocoder / Spectral** — more advanced; natural next step once all basics are covered. Would require a significant canvas display investment.

### Utilities & Routing

- **Clock Divider / Multiplier** — expands the BPM system; lets the Step Sequencer or Collider run at half/double/triple time relative to the global BPM. Very high value for rhythmic complexity.
- **CV Attenuverter / Offset** — scales and offsets CV signals (including polarity inversion) without needing a full LFO. The smallest and most reusable utility missing; frequently needed to adapt CV ranges between modules.
- **Logic Gate (AND / OR / XOR for Gates)** — combines gate signals. Enables rhythmic patterns that emerge from the interaction of two clock sources.
- ~~**Arpeggiator (standalone)**~~ ✅ *Implemented in `src/components/utilities/Arpeggiator.ts` (branch `029-vu-meter`)*  — the Step Sequencer has an arpeggiator mode, but a dedicated module with more flexible octave range, direction (up/down/random), and rate control is a common modular utility.

### Output & Monitoring

- ~~**VU Meter / Level Meter**~~ ✅ *Implemented in `src/components/analyzers/VuMeter.ts` (branch `027-vu-meter`)* — passive 20-segment peak-level monitor with green/yellow/red zones, 1.5s peak hold marker, and 80px narrow canvas display. Accepts any Audio-typed source without interrupting the signal path.
- **Tuner** — detects the fundamental pitch of an incoming audio signal. Handy for calibrating oscillators against each other and verifying CV-to-pitch accuracy.

---

## Priority Assessment

| Feature | Impact | Effort | Priority |
|---------|--------|--------|----------|
| ~~Quantizer~~ | High | Low | ✅ **Implemented** |
| CV Attenuverter / Offset | High | Very Low | **P1** |
| Clock Divider / Multiplier | High | Low | **P1** |
| ~~Envelope Follower~~ | High | Low | ✅ **Implemented** |
| ~~Slew Limiter / Portamento~~ | Medium | Low | ✅ **Implemented** |
| S&H (standalone) | Medium | Low | **P2** |
| Sample Player / Wavetable | High | High | **P2** |
| ~~Ring Modulator~~ | Medium | Low | ✅ **Implemented** |
| ~~Karplus-Strong / Physical Modeling~~ | High | High | ✅ **Implemented** |
| Wavefolder | Medium | Medium | **P3** |
| ~~EQ / Parametric Filter~~ | Medium | Medium | ✅ **Implemented** |
| ~~VU Meter~~ | Low | Low | ✅ **Implemented** |
| Tuner | Low | Medium | **P3** |
| ~~Arpeggiator (standalone)~~ | Medium | Medium | ✅ **Implemented** |
| Logic Gate | Low | Low | **P3** |
| Vocoder / Spectral | High | Very High | **P4** |

---

## Notes

- The **Quantizer** is already being specced (see `specs/025-quantizer/`).
- The **CV Attenuverter** and **Clock Divider** are the highest-value additions relative to implementation cost — either would be a good next candidate after the Quantizer.
- The **Sample Player** is high-impact but would require significant new infrastructure (file loading, AudioBuffer management) and should be planned carefully.
- The **Envelope Follower** pairs naturally with the Quantizer: `Mic/Audio → Envelope Follower → Quantizer → Oscillator` creates a pitch-tracking or pitch-following patch.
