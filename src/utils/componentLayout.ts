/**
 * Component Layout Utilities
 * Automatically calculate component dimensions based on ports and controls
 */

import { ComponentType } from '../core/types';
import { COMPONENT } from './constants';

/**
 * Control layout configuration for each component type
 */
interface ControlLayout {
  hasDropdown?: boolean;
  numKnobs?: number;
  numSliders?: number;
  sliderHeight?: number;
  hasDisplayArea?: boolean;
  displayHeight?: number;
}

/**
 * Get the control layout for a component type
 */
function getControlLayout(type: ComponentType): ControlLayout {
  switch (type) {
    case ComponentType.OSCILLATOR:
      return {
        hasDropdown: true,
        numKnobs: 2, // frequency, detune
      };

    case ComponentType.FILTER:
      return {
        hasDropdown: true,
        numKnobs: 2, // cutoff, resonance
      };

    case ComponentType.VCA:
      return {
        numKnobs: 0, // gain
      };

    case ComponentType.ADSR_ENVELOPE:
      return {
        numSliders: 4, // attack, decay, sustain, release
        sliderHeight: 80,
      };

    case ComponentType.MASTER_OUTPUT:
      return {
        numKnobs: 2, // volume, limiter
      };

    case ComponentType.OSCILLOSCOPE:
      return {
        hasDropdown: true,
        numKnobs: 2, // timeScale, gain
        hasDisplayArea: true,
        displayHeight: 150,
      };

    case ComponentType.MIXER:
      return {
        numSliders: 5, // 4 channels + master
        sliderHeight: 80,
      };

    case ComponentType.KEYBOARD_INPUT:
    case ComponentType.LFO:
    case ComponentType.NOISE:
    case ComponentType.FILTER_ENVELOPE:
    case ComponentType.DELAY:
    case ComponentType.REVERB:
    case ComponentType.DISTORTION:
    default:
      return {}; // No controls or minimal controls
  }
}

/**
 * Get the number of ports for a component type
 */
function getPortCounts(type: ComponentType): { inputs: number; outputs: number } {
  switch (type) {
    case ComponentType.OSCILLATOR:
      return { inputs: 2, outputs: 1 }; // frequency CV, detune CV / audio out

    case ComponentType.FILTER:
      return { inputs: 3, outputs: 1 }; // audio in, cutoff CV, resonance CV / audio out

    case ComponentType.VCA:
      return { inputs: 2, outputs: 1 }; // audio in, CV in / audio out

    case ComponentType.ADSR_ENVELOPE:
      return { inputs: 1, outputs: 1 }; // gate in / CV out

    case ComponentType.KEYBOARD_INPUT:
      return { inputs: 0, outputs: 3 }; // frequency CV, gate, velocity

    case ComponentType.MASTER_OUTPUT:
      return { inputs: 1, outputs: 0 }; // audio in

    case ComponentType.LFO:
      return { inputs: 0, outputs: 1 }; // CV out

    case ComponentType.NOISE:
      return { inputs: 0, outputs: 1 }; // audio out

    case ComponentType.FILTER_ENVELOPE:
      return { inputs: 1, outputs: 1 }; // gate in / CV out

    case ComponentType.DELAY:
      return { inputs: 1, outputs: 1 }; // audio in / audio out

    case ComponentType.REVERB:
      return { inputs: 1, outputs: 1 }; // audio in / audio out

    case ComponentType.DISTORTION:
      return { inputs: 1, outputs: 1 }; // audio in / audio out

    case ComponentType.MIXER:
      return { inputs: 4, outputs: 1 }; // 4 channels in / audio out

    default:
      return { inputs: 1, outputs: 1 };
  }
}

/**
 * Calculate the height required for a component based on its ports and controls
 */
export function calculateComponentHeight(type: ComponentType): number {
  const portCounts = getPortCounts(type);
  const controlLayout = getControlLayout(type);

  // Start with header height
  let height: number = COMPONENT.HEADER_HEIGHT; // 32

  // Add port area height (based on the maximum of inputs or outputs)
  const maxPorts = Math.max(portCounts.inputs, portCounts.outputs);
  const portAreaHeight = maxPorts * (COMPONENT.PORT_SIZE + COMPONENT.PORT_PADDING) + COMPONENT.PORT_PADDING;
  height += portAreaHeight;

  // Add control area height
  if (controlLayout.hasDropdown) {
    height += 5; // spacing above dropdown
    height += 12; // dropdown label
    height += 24; // dropdown height
    height += 10; // spacing after dropdown before knobs
  }

  if (controlLayout.numKnobs && controlLayout.numKnobs > 0) {
    if (!controlLayout.hasDropdown) {
      height += 10; // spacing if no dropdown above
    }
    height += 12; // knob label above
    height += 40; // knob size
    height += 12; // value text below (includes padding)
  }

  if (controlLayout.numSliders && controlLayout.numSliders > 0) {
    height += 10; // spacing above sliders
    height += (controlLayout.sliderHeight || 80); // slider height
    height += 12; // value text below (includes padding)
  }

  if (controlLayout.hasDisplayArea) {
    height += 10; // spacing above display
    height += (controlLayout.displayHeight || 150); // display area height
    height += 10; // spacing below display
  }

  // If no controls, ensure minimum height for visual balance
  if (!controlLayout.hasDropdown && !controlLayout.numKnobs && !controlLayout.numSliders && !controlLayout.hasDisplayArea) {
    // Ensure component is at least a reasonable size even without controls
    const minHeightWithoutControls: number = COMPONENT.HEADER_HEIGHT + portAreaHeight + 20;
    if (height < 100) {
      height = Math.max(100, minHeightWithoutControls);
    }
  }

  return height;
}

/**
 * Calculate the width required for a component based on its controls
 */
export function calculateComponentWidth(type: ComponentType): number {
  const controlLayout = getControlLayout(type);

  // Base width considerations
  let width: number = COMPONENT.MIN_WIDTH;

  // Oscillator and Filter need more width for 2 knobs side by side
  if (controlLayout.numKnobs && controlLayout.numKnobs >= 2) {
    width = 150;
  }

  // ADSR needs more width for 4 sliders side by side
  if (controlLayout.numSliders && controlLayout.numSliders >= 4) {
    width = 160;
  }

  // Mixer needs more width for 5 sliders side by side
  if (controlLayout.numSliders && controlLayout.numSliders >= 5) {
    width = 200;
  }

  // Oscilloscope needs more width for display area
  if (controlLayout.hasDisplayArea) {
    width = 220;
  }

  return width;
}

/**
 * Calculate dimensions for a component type
 */
export function calculateComponentDimensions(type: ComponentType): { width: number; height: number } {
  return {
    width: calculateComponentWidth(type),
    height: calculateComponentHeight(type),
  };
}
