/**
 * Register all component types with the registry
 */

import { componentRegistry } from './ComponentRegistry';
import { ComponentType } from '../core/types';
import { Oscillator } from './generators/Oscillator';
import { VCA } from './processors/VCA';
import { Filter } from './processors/Filter';
import { ADSREnvelope } from './processors/ADSREnvelope';
import { KeyboardInput } from './utilities/KeyboardInput';
import { MasterOutput } from './utilities/MasterOutput';
import { Mixer } from './utilities/Mixer';
import { Oscilloscope } from './analyzers/Oscilloscope';
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
