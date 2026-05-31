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
  numPanKnobs?: number;
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

    case ComponentType.FM_OSCILLATOR:
      return {
        hasDropdown: true,
        numKnobs: 3, // frequency, detune, fmDepth
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
        numPanKnobs: 4,
      };

    case ComponentType.REVERB:
      return {
        numKnobs: 3, // roomSize, decay, mix
      };

    case ComponentType.DELAY:
      return {
        numKnobs: 3, // time, feedback, mix
      };

    case ComponentType.STEP_SEQUENCER:
      return {
        // BPM and Division are rendered inside the StepSequencerDisplay transport bar;
        // no separate knobs are added at the component level.
        hasDisplayArea: true,
        displayHeight: 220, // transport bar (52) + step grid (80) + padding
      };

    case ComponentType.LFO:
      return {
        hasDropdown: true,
        numKnobs: 2, // rate, depth
      };

    case ComponentType.NOISE:
      return {
        hasDropdown: true,
        numKnobs: 1, // amplitude
      };

    case ComponentType.DISTORTION:
      return {
        numKnobs: 3, // drive, tone, mix
      };

    case ComponentType.CHORUS:
      return {
        numKnobs: 3, // rate, depth, mix
      };

    case ComponentType.BITCRUSHER:
      return {
        numKnobs: 3, // bitDepth, sampleRate, mix
      };

    case ComponentType.FLANGER:
      return {
        numKnobs: 4, // rate, depth, feedback, mix
      };

    case ComponentType.PHASER:
      return {
        numKnobs: 5, // rate, depth, feedback, stages, mix
      };

    case ComponentType.TREMOLO:
      return {
        numKnobs: 3, // rate, depth, mix
      };

    case ComponentType.COLLIDER:
      return {
        numKnobs: 6, // scaleType, rootNote, colliderCount, speedPreset, bpm, gateSize
        hasDisplayArea: true,
        displayHeight: 200, // physics simulation canvas
      };

    case ComponentType.CHORD_FINDER:
      return {
        hasDropdown: true, // root note + scale dropdowns
        hasDisplayArea: true,
        displayHeight: 220, // chord circle canvas
      };

    case ComponentType.LOOPER:
      return {
        hasDisplayArea: true,
        displayHeight: 300, // doughnut ring canvas (240w × 300h)
      };

    case ComponentType.QUANTIZER:
      return {
        hasDropdown: true, // root note + scale type dropdowns
        numKnobs: 0,
      };

    case ComponentType.PARAMETRIC_EQ:
      return {
        numKnobs: 7, // lowGain, lowFreq, midGain, midFreq, midQ, highGain, highFreq
      };

    case ComponentType.VU_METER:
      return {
        hasDisplayArea: true,
        displayHeight: 200,
      };

    case ComponentType.KEYBOARD_INPUT:
    case ComponentType.FILTER_ENVELOPE:
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

    case ComponentType.FM_OSCILLATOR:
      return { inputs: 4, outputs: 1 }; // frequency CV, detune CV, fm audio in, fmDepth CV / audio out

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
      return { inputs: 1, outputs: 1 }; // amplitude CV in / audio out

    case ComponentType.FILTER_ENVELOPE:
      return { inputs: 1, outputs: 1 }; // gate in / CV out

    case ComponentType.DELAY:
      return { inputs: 1, outputs: 1 }; // audio in / audio out

    case ComponentType.REVERB:
      return { inputs: 1, outputs: 1 }; // audio in / audio out

    case ComponentType.DISTORTION:
      return { inputs: 1, outputs: 1 }; // audio in / audio out

    case ComponentType.CHORUS:
      return { inputs: 1, outputs: 1 }; // audio in / audio out

    case ComponentType.BITCRUSHER:
    case ComponentType.FLANGER:
    case ComponentType.PHASER:
    case ComponentType.TREMOLO:
      return { inputs: 1, outputs: 1 }; // audio in / audio out

    case ComponentType.MIXER:
      return { inputs: 4, outputs: 1 }; // 4 channels in / audio out

    case ComponentType.STEP_SEQUENCER:
      return { inputs: 3, outputs: 3 }; // arpeggiate gate, frequency, velocity in / frequency, gate, velocity out

    case ComponentType.OSCILLOSCOPE:
      return { inputs: 1, outputs: 0 }; // audio in

    case ComponentType.COLLIDER:
      return { inputs: 0, outputs: 2 }; // CV out, Gate out

    case ComponentType.CHORD_FINDER:
      return { inputs: 0, outputs: 4 }; // note1 CV, note2 CV, note3 CV, gate

    case ComponentType.LOOPER:
      return { inputs: 1, outputs: 1 }; // audio in / audio out

    case ComponentType.QUANTIZER:
      return { inputs: 2, outputs: 1 }; // cv-in, gate-in / cv-out

    case ComponentType.PARAMETRIC_EQ:
      return { inputs: 4, outputs: 1 }; // audio-in, low-gain-cv, mid-gain-cv, high-gain-cv / audio-out

    case ComponentType.VU_METER:
      return { inputs: 1, outputs: 0 };

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

  // Special case for Quantizer: root dropdown + scale dropdown + note label
  if (type === ComponentType.QUANTIZER) {
    const maxPorts = Math.max(portCounts.inputs, portCounts.outputs);
    const portAreaHeight = maxPorts * (COMPONENT.PORT_SIZE + COMPONENT.PORT_PADDING) + COMPONENT.PORT_PADDING;

    const dropdownY = COMPONENT.HEADER_HEIGHT + portAreaHeight + COMPONENT.CONTROL_MARGIN_TOP;
    const scaleDropdownY = dropdownY + COMPONENT.DROPDOWN_HEIGHT + COMPONENT.CONTROL_SPACING_VERTICAL;
    const noteLabelY = scaleDropdownY + COMPONENT.DROPDOWN_HEIGHT + COMPONENT.CONTROL_SPACING_VERTICAL;
    return noteLabelY + 28 + 12; // 28px label height + 12px bottom padding
  }

  // Special case for ChordFinder: root dropdown + scale dropdown + octave dropdown + generate button + display
  // Must match the actual layout computation in CanvasComponent.ts exactly:
  //   dropdownY       = HEADER + portArea + CONTROL_MARGIN_TOP
  //   scaleDropdownY  = dropdownY + DROPDOWN_HEIGHT + CONTROL_SPACING_VERTICAL
  //   octaveDropdownY = scaleDropdownY + DROPDOWN_HEIGHT + CONTROL_SPACING_VERTICAL
  //   buttonY         = octaveDropdownY + DROPDOWN_HEIGHT + CONTROL_SPACING_VERTICAL
  //   displayY        = buttonY + 30 (buttonHeight) + CONTROL_SPACING_VERTICAL
  //   bottom          = displayY + 220 (displayHeight) + 10 (bottom padding)
  if (type === ComponentType.CHORD_FINDER) {
    const maxPorts = Math.max(portCounts.inputs, portCounts.outputs);
    const portAreaHeight = maxPorts * (COMPONENT.PORT_SIZE + COMPONENT.PORT_PADDING) + COMPONENT.PORT_PADDING;

    const dropdownY = COMPONENT.HEADER_HEIGHT + portAreaHeight + COMPONENT.CONTROL_MARGIN_TOP;
    const scaleDropdownY = dropdownY + COMPONENT.DROPDOWN_HEIGHT + COMPONENT.CONTROL_SPACING_VERTICAL;
    const octaveDropdownY = scaleDropdownY + COMPONENT.DROPDOWN_HEIGHT + COMPONENT.CONTROL_SPACING_VERTICAL;
    const buttonY = octaveDropdownY + COMPONENT.DROPDOWN_HEIGHT + COMPONENT.CONTROL_SPACING_VERTICAL;
    const displayY = buttonY + 30 + COMPONENT.CONTROL_SPACING_VERTICAL;
    return displayY + 220 + 10;
  }

  // Special case for Collider: 6 knobs in 3x2 grid + button + display
  if (type === ComponentType.COLLIDER) {
    const maxPorts = Math.max(portCounts.inputs, portCounts.outputs);
    const portAreaHeight = maxPorts * (COMPONENT.PORT_SIZE + COMPONENT.PORT_PADDING) + COMPONENT.PORT_PADDING;

    let height = COMPONENT.HEADER_HEIGHT; // 32
    height += portAreaHeight; // Port area
    height += 10; // Spacing above knobs
    height += 12; // Knob labels (row 1)
    height += 40; // Knob size (row 1)
    height += 12; // Value text (row 1)
    height += 20; // Spacing between rows
    height += 12; // Knob labels (row 2)
    height += 40; // Knob size (row 2)
    height += 12; // Value text (row 2)
    height += 10; // Spacing before button
    height += 30; // Button height
    height += 10; // Spacing before display
    height += 200; // Display area
    height += 10; // Spacing after display

    return height;
  }

  // Special case for ParametricEQ: 7 knobs across 3 rows (Low: 2, Mid: 3, High: 2)
  if (type === ComponentType.PARAMETRIC_EQ) {
    const maxPorts = Math.max(portCounts.inputs, portCounts.outputs);
    const portAreaHeight = maxPorts * (COMPONENT.PORT_SIZE + COMPONENT.PORT_PADDING) + COMPONENT.PORT_PADDING;
    const rowHeight = 12 + 40 + 12; // label + knob + value
    const rowSpacing = COMPONENT.CONTROL_SPACING_VERTICAL;
    return COMPONENT.HEADER_HEIGHT + portAreaHeight + COMPONENT.CONTROL_MARGIN_TOP + rowHeight * 3 + rowSpacing * 2 + 10;
  }

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

  if (controlLayout.numPanKnobs && controlLayout.numPanKnobs > 0) {
    height += 10; // spacing above pan knob row
    height += 12; // knob label height
    height += 40; // knob size
    height += 12; // value text below
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

  // Reverb needs more width for 3 knobs side by side
  if (controlLayout.numKnobs && controlLayout.numKnobs >= 3) {
    width = 180;
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

  // StepSequencer needs wide display for 16 steps: 16 * 40px cells + margins
  if (type === ComponentType.STEP_SEQUENCER) {
    width = 660;
  }

  // Collider needs extra width for 6 knobs in 3x2 grid + button + display area
  if (type === ComponentType.COLLIDER) {
    width = 280; // Enough for 3 knobs side by side (40px each + spacing) + margins + display area
  }

  // ChordFinder needs enough width for the circular display
  if (type === ComponentType.CHORD_FINDER) {
    width = 240;
  }

  // Looper: 240px canvas + 10px margin each side
  if (type === ComponentType.LOOPER) {
    width = 260;
  }

  // ParametricEQ: 3 knobs in widest row (Mid), needs same width as 3-column Collider layout
  if (type === ComponentType.PARAMETRIC_EQ) {
    width = 200;
  }

  // VU Meter: narrow single-column display — override the generic hasDisplayArea width
  if (type === ComponentType.VU_METER) {
    width = 80;
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
