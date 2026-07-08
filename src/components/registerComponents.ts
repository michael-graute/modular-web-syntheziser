/**
 * Register all component types with the registry
 */

import { componentRegistry } from './ComponentRegistry';
import { ComponentType } from '../core/types';
import { Oscillator } from './generators/Oscillator';
import { KarplusStrong } from './generators/KarplusStrong';
import { FMOscillator } from './generators/FMOscillator';
import { LFO } from './generators/LFO';
import { NoiseGenerator } from './generators/NoiseGenerator';
import { VCA } from './processors/VCA';
import { Filter } from './processors/Filter';
import { ADSREnvelope } from './processors/ADSREnvelope';
import { KeyboardInput } from './utilities/KeyboardInput';
import { MasterOutput } from './utilities/MasterOutput';
import { Mixer } from './utilities/Mixer';
import { Collider } from './utilities/Collider';
import { ChordFinder } from './utilities/ChordFinder';
import { Quantizer } from './utilities/Quantizer';
import { ParametricEQ } from './processors/ParametricEQ';
import { Looper } from './utilities/Looper';
import { XYPad } from './utilities/XYPad';
import { Notes } from './utilities/Notes';
import { Delay } from './effects/Delay';
import { Reverb } from './effects/Reverb';
import { Distortion } from './effects/Distortion';
import { Chorus } from './effects/Chorus';
import { Bitcrusher } from './effects/Bitcrusher';
import { Flanger } from './effects/Flanger';
import { Phaser } from './effects/Phaser';
import { Tremolo } from './effects/Tremolo';
import { RingModulator } from './effects/RingModulator';
import { Arpeggiator } from './utilities/Arpeggiator';
import { Oscilloscope } from './analyzers/Oscilloscope';
import { VuMeter } from './analyzers/VuMeter';
import { EnvelopeFollower } from './analyzers/EnvelopeFollower';
import { SlewLimiter } from './utilities/SlewLimiter';
import { StepSequencer } from './utilities/StepSequencer';
import { PolyOscillator } from './generators/PolyOscillator';
import { PolyADSR } from './processors/PolyADSR';
import { PolyVCA } from './processors/PolyVCA';
import { calculateComponentDimensions } from '../utils/componentLayout';

/**
 * Register all available component types
 */
export function registerAllComponents(): void {
  // Generators
  componentRegistry.register(
    ComponentType.OSCILLATOR,
    'Oscillator',
    'Basic waveform generator',
    'Generators',
    (id, position) => new Oscillator(id, position),
    calculateComponentDimensions(ComponentType.OSCILLATOR)
  );

  componentRegistry.register(
    ComponentType.FM_OSCILLATOR,
    'FM Oscillator',
    'Frequency modulation oscillator',
    'Generators',
    (id, position) => new FMOscillator(id, position),
    calculateComponentDimensions(ComponentType.FM_OSCILLATOR)
  );

  componentRegistry.register(
    ComponentType.LFO,
    'LFO',
    'Low frequency oscillator for modulation',
    'Generators',
    (id, position) => new LFO(id, position),
    calculateComponentDimensions(ComponentType.LFO)
  );

  componentRegistry.register(
    ComponentType.NOISE,
    'Noise',
    'White and pink noise generator',
    'Generators',
    (id, position) => new NoiseGenerator(id, position),
    calculateComponentDimensions(ComponentType.NOISE)
  );

  componentRegistry.register(
    ComponentType.KARPLUS_STRONG,
    'Karplus-Strong',
    'Algorithmic plucked-string / percussive synthesizer',
    'Generators',
    (id, position) => new KarplusStrong(id, position),
    calculateComponentDimensions(ComponentType.KARPLUS_STRONG)
  );

  // Processors
  componentRegistry.register(
    ComponentType.VCA,
    'VCA',
    'Voltage controlled amplifier',
    'Processors',
    (id, position) => new VCA(id, position),
    calculateComponentDimensions(ComponentType.VCA)
  );

  componentRegistry.register(
    ComponentType.FILTER,
    'Filter',
    'Multi-mode audio filter',
    'Processors',
    (id, position) => new Filter(id, position),
    calculateComponentDimensions(ComponentType.FILTER)
  );

  componentRegistry.register(
    ComponentType.ADSR_ENVELOPE,
    'ADSR Envelope',
    'Attack Decay Sustain Release envelope',
    'Processors',
    (id, position) => new ADSREnvelope(id, position),
    calculateComponentDimensions(ComponentType.ADSR_ENVELOPE)
  );

  componentRegistry.register(
    ComponentType.PARAMETRIC_EQ,
    'Parametric EQ',
    '3-band parametric equalizer with CV gain modulation',
    'Processors',
    (id, position) => new ParametricEQ(id, position),
    calculateComponentDimensions(ComponentType.PARAMETRIC_EQ)
  );

  // Utilities
  componentRegistry.register(
    ComponentType.KEYBOARD_INPUT,
    'Keyboard',
    'QWERTY keyboard input with CV/Gate outputs',
    'Utilities',
    (id, position) => new KeyboardInput(id, position),
    calculateComponentDimensions(ComponentType.KEYBOARD_INPUT)
  );

  componentRegistry.register(
    ComponentType.MASTER_OUTPUT,
    'Master Output',
    'Main audio output to speakers',
    'Utilities',
    (id, position) => new MasterOutput(id, position),
    calculateComponentDimensions(ComponentType.MASTER_OUTPUT)
  );

  componentRegistry.register(
    ComponentType.MIXER,
    'Mixer',
    'Mix multiple audio sources',
    'Utilities',
    (id, position) => new Mixer(id, position),
    calculateComponentDimensions(ComponentType.MIXER)
  );

  componentRegistry.register(
    ComponentType.STEP_SEQUENCER,
    'Sequencer',
    '16-step sequencer with CV/Gate outputs',
    'Utilities',
    (id, position) => new StepSequencer(id, position),
    calculateComponentDimensions(ComponentType.STEP_SEQUENCER)
  );

  componentRegistry.register(
    ComponentType.COLLIDER,
    'Collider',
    'Musical physics simulation with CV/Gate outputs',
    'Utilities',
    (id, position) => new Collider(id, 'Collider', position),
    calculateComponentDimensions(ComponentType.COLLIDER)
  );

  componentRegistry.register(
    ComponentType.QUANTIZER,
    'Quantizer',
    'Snaps CV to the nearest note in a musical scale',
    'Utilities',
    (id, position) => new Quantizer(id, position),
    calculateComponentDimensions(ComponentType.QUANTIZER)
  );

  componentRegistry.register(
    ComponentType.CHORD_FINDER,
    'Chord Finder',
    'Diatonic chord explorer with CV/Gate outputs',
    'Utilities',
    (id, position) => new ChordFinder(id, position),
    calculateComponentDimensions(ComponentType.CHORD_FINDER)
  );

  componentRegistry.register(
    ComponentType.LOOPER,
    'Looper',
    'BPM-synced audio looper with doughnut ring display',
    'Utilities',
    (id, position) => new Looper(id, position),
    calculateComponentDimensions(ComponentType.LOOPER)
  );

  componentRegistry.register(
    ComponentType.XY_PAD,
    'X-Y Pad',
    'Two-axis controller with recordable movement, outputs X and Y as CV',
    'Utilities',
    (id, position) => new XYPad(id, position),
    calculateComponentDimensions(ComponentType.XY_PAD)
  );

  componentRegistry.register(
    ComponentType.NOTES,
    'Notes',
    'Free-text notes attached to the patch',
    'Utilities',
    (id, position) => new Notes(id, position),
    calculateComponentDimensions(ComponentType.NOTES)
  );

  // Effects
  componentRegistry.register(
    ComponentType.DELAY,
    'Delay',
    'Echo/delay effect with feedback',
    'Effects',
    (id, position) => new Delay(id, position),
    calculateComponentDimensions(ComponentType.DELAY)
  );

  componentRegistry.register(
    ComponentType.REVERB,
    'Reverb',
    'Algorithmic reverb effect',
    'Effects',
    (id, position) => new Reverb(id, position),
    calculateComponentDimensions(ComponentType.REVERB)
  );

  componentRegistry.register(
    ComponentType.DISTORTION,
    'Distortion',
    'Waveshaping distortion effect',
    'Effects',
    (id, position) => new Distortion(id, position),
    calculateComponentDimensions(ComponentType.DISTORTION)
  );

  componentRegistry.register(
    ComponentType.CHORUS,
    'Chorus',
    'Modulated delay chorus effect',
    'Effects',
    (id, position) => new Chorus(id, position),
    calculateComponentDimensions(ComponentType.CHORUS)
  );

  componentRegistry.register(
    ComponentType.BITCRUSHER,
    'Bitcrusher',
    'Digital bit depth and sample rate reducer',
    'Effects',
    (id, position) => new Bitcrusher(id, position),
    calculateComponentDimensions(ComponentType.BITCRUSHER)
  );

  componentRegistry.register(
    ComponentType.FLANGER,
    'Flanger',
    'Comb-filter sweep with feedback',
    'Effects',
    (id, position) => new Flanger(id, position),
    calculateComponentDimensions(ComponentType.FLANGER)
  );

  componentRegistry.register(
    ComponentType.PHASER,
    'Phaser',
    'All-pass phase sweep with selectable stages',
    'Effects',
    (id, position) => new Phaser(id, position),
    calculateComponentDimensions(ComponentType.PHASER)
  );

  componentRegistry.register(
    ComponentType.TREMOLO,
    'Tremolo',
    'Rhythmic amplitude modulation',
    'Effects',
    (id, position) => new Tremolo(id, position),
    calculateComponentDimensions(ComponentType.TREMOLO)
  );

  componentRegistry.register(
    ComponentType.RING_MODULATOR,
    'Ring Modulator',
    'Analog-style signal multiplier for AM synthesis',
    'Effects',
    (id, position) => new RingModulator(id, position),
    calculateComponentDimensions(ComponentType.RING_MODULATOR)
  );

  componentRegistry.register(
    ComponentType.ARPEGGIATOR,
    'Arpeggiator',
    'Steps through held notes at a BPM-synced rate',
    'Utilities',
    (id, position) => new Arpeggiator(id, position),
    calculateComponentDimensions(ComponentType.ARPEGGIATOR)
  );

  // Analyzers
  componentRegistry.register(
    ComponentType.OSCILLOSCOPE,
    'Oscilloscope',
    'Real-time waveform and spectrum analyzer',
    'Analyzers',
    (id, position) => new Oscilloscope(id, position),
    calculateComponentDimensions(ComponentType.OSCILLOSCOPE)
  );

  componentRegistry.register(
    ComponentType.VU_METER,
    'VU Meter',
    'Real-time peak level meter for audio and CV signals',
    'Analyzers',
    (id, position) => new VuMeter(id, position),
    calculateComponentDimensions(ComponentType.VU_METER)
  );

  componentRegistry.register(
    ComponentType.ENVELOPE_FOLLOWER,
    'Env Follower',
    'Converts audio amplitude to a 0–1 CV signal',
    'Analyzers',
    (id, position) => new EnvelopeFollower(id, position),
    calculateComponentDimensions(ComponentType.ENVELOPE_FOLLOWER)
  );

  componentRegistry.register(
    ComponentType.SLEW_LIMITER,
    'Slew Limiter',
    'Smooths CV transitions — portamento and glide',
    'Utilities',
    (id, position) => new SlewLimiter(id, position),
    calculateComponentDimensions(ComponentType.SLEW_LIMITER)
  );

  componentRegistry.register(
    ComponentType.POLY_OSCILLATOR,
    'Poly Oscillator',
    '4-voice polyphonic oscillator',
    'Generators',
    (id, position) => new PolyOscillator(id, position),
    calculateComponentDimensions(ComponentType.POLY_OSCILLATOR)
  );

  componentRegistry.register(
    ComponentType.POLY_ADSR,
    'Poly ADSR',
    '4-voice polyphonic ADSR envelope',
    'Processors',
    (id, position) => new PolyADSR(id, position),
    calculateComponentDimensions(ComponentType.POLY_ADSR)
  );

  componentRegistry.register(
    ComponentType.POLY_VCA,
    'Poly VCA',
    '4-voice polyphonic VCA with mono mix output',
    'Processors',
    (id, position) => new PolyVCA(id, position),
    calculateComponentDimensions(ComponentType.POLY_VCA)
  );

  console.log(`✅ Registered ${componentRegistry.getCount()} components`);
}
