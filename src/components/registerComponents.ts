/**
 * Register all component types with the registry
 */

import { componentRegistry } from './ComponentRegistry';
import { ComponentType } from '../core/types';
import { Oscillator } from './generators/Oscillator';
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
import { Delay } from './effects/Delay';
import { Reverb } from './effects/Reverb';
import { Distortion } from './effects/Distortion';
import { Chorus } from './effects/Chorus';
import { Oscilloscope } from './analyzers/Oscilloscope';
import { StepSequencer } from './utilities/StepSequencer';
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
    ComponentType.CHORD_FINDER,
    'Chord Finder',
    'Diatonic chord explorer with CV/Gate outputs',
    'Utilities',
    (id, position) => new ChordFinder(id, position),
    calculateComponentDimensions(ComponentType.CHORD_FINDER)
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

  // Analyzers
  componentRegistry.register(
    ComponentType.OSCILLOSCOPE,
    'Oscilloscope',
    'Real-time waveform and spectrum analyzer',
    'Analyzers',
    (id, position) => new Oscilloscope(id, position),
    calculateComponentDimensions(ComponentType.OSCILLOSCOPE)
  );

  console.log(`✅ Registered ${componentRegistry.getCount()} components`);
}
