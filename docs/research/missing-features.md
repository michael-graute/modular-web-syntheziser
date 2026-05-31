# Missing Features Research

**Created**: 2026-05-30  
**Context**: Survey of gaps in the modular web synthesizer based on the 24 implemented components as of May 2026.

---

## Current Component Inventory (as of survey)

| Category | Components |
|----------|-----------|
| Generators | Oscillator, FM Oscillator, LFO, Noise |
| Processors | Filter, VCA, ADSR Envelope, Parametric EQ |
| Effects | Delay, Reverb, Distortion, Chorus, Bitcrusher, Flanger, Phaser, Tremolo |
| Utilities | Keyboard, Master Out, Mixer, Step Sequencer, Chord Finder, Collider, Looper |
| Analyzers | Oscilloscope |

---

## Identified Gaps

### Synthesis Fundamentals

- **Sample Player / Wavetable Oscillator** — no way to load audio files or user-defined waveforms; most modular systems have this. Would open up sampling, one-shot drums, and wavetable synthesis workflows.
- **Karplus-Strong / Physical Modeling** — algorithmic plucked string synthesis. Would complement the physics-themed Collider well and introduce a new synthesis paradigm distinct from the existing oscillator-based approach.
- **Ring Modulator** — classic AM synthesis, absent despite an otherwise complete effects chain. Simple to implement; produces metallic, bell-like timbres by multiplying two audio signals.

### Modulation & Control

- ~~**Quantizer**~~ ✅ *Implemented in `src/components/utilities/Quantizer.ts` (branch `025-quantizer`)* — snaps free-running CV to musical scales; supports 8 scale types, 12 root notes, optional gate/trigger input for rhythmically locked pitch steps, and full patch persistence.
- **Envelope Follower** — converts incoming audio amplitude to a CV signal. Essential for sidechain-style patching and making one signal control another dynamically.
- **S&H (Sample & Hold) — standalone** — already exists as an LFO waveform mode, but a dedicated module would allow any CV source (not just LFO) to be sampled on a trigger. Common utility for stepped random CV.
- **Slew Limiter / Portamento** — smooths abrupt CV jumps; produces glide between pitches. The Keyboard has no detached portamento module, so CV glide can't be applied to sequencer or Collider output.

### Signal Processing

- **Wavefolder** — distinctive west-coast synthesis texture; folds the waveform back on itself when it exceeds a threshold. Complements Distortion and Bitcrusher with a different character.
- ~~**EQ / Parametric Filter**~~ ✅ *Implemented in `src/components/processors/ParametricEQ.ts` (branch `026-parametric-eq`)* — 3-band parametric EQ (low shelf, mid peak, high shelf) with per-band gain CV inputs for LFO modulation (1V = 1 dB), bypass support, and full patch persistence.
- **Vocoder / Spectral** — more advanced; natural next step once all basics are covered. Would require a significant canvas display investment.

### Utilities & Routing

- **Clock Divider / Multiplier** — expands the BPM system; lets the Step Sequencer or Collider run at half/double/triple time relative to the global BPM. Very high value for rhythmic complexity.
- **CV Attenuverter / Offset** — scales and offsets CV signals (including polarity inversion) without needing a full LFO. The smallest and most reusable utility missing; frequently needed to adapt CV ranges between modules.
- **Logic Gate (AND / OR / XOR for Gates)** — combines gate signals. Enables rhythmic patterns that emerge from the interaction of two clock sources.
- **Arpeggiator (standalone)** — the Step Sequencer has an arpeggiator mode, but a dedicated module with more flexible octave range, direction (up/down/random), and rate control is a common modular utility.

### Output & Monitoring

- **VU Meter / Level Meter** — visual feedback for signal levels independent of the Oscilloscope. Useful for monitoring mixer channels or checking CV ranges without interrupting the audio path.
- **Tuner** — detects the fundamental pitch of an incoming audio signal. Handy for calibrating oscillators against each other and verifying CV-to-pitch accuracy.

---

## Priority Assessment

| Feature | Impact | Effort | Priority |
|---------|--------|--------|----------|
| ~~Quantizer~~ | High | Low | ✅ **Implemented** |
| CV Attenuverter / Offset | High | Very Low | **P1** |
| Clock Divider / Multiplier | High | Low | **P1** |
| Envelope Follower | High | Low | **P1** |
| Slew Limiter / Portamento | Medium | Low | **P2** |
| S&H (standalone) | Medium | Low | **P2** |
| Sample Player / Wavetable | High | High | **P2** |
| Ring Modulator | Medium | Low | **P2** |
| Wavefolder | Medium | Medium | **P3** |
| ~~EQ / Parametric Filter~~ | Medium | Medium | ✅ **Implemented** |
| VU Meter | Low | Low | **P3** |
| Tuner | Low | Medium | **P3** |
| Arpeggiator (standalone) | Medium | Medium | **P3** |
| Logic Gate | Low | Low | **P3** |
| Vocoder / Spectral | High | Very High | **P4** |

---

## Notes

- The **Quantizer** is already being specced (see `specs/025-quantizer/`).
- The **CV Attenuverter** and **Clock Divider** are the highest-value additions relative to implementation cost — either would be a good next candidate after the Quantizer.
- The **Sample Player** is high-impact but would require significant new infrastructure (file loading, AudioBuffer management) and should be planned carefully.
- The **Envelope Follower** pairs naturally with the Quantizer: `Mic/Audio → Envelope Follower → Quantizer → Oscillator` creates a pitch-tracking or pitch-following patch.
