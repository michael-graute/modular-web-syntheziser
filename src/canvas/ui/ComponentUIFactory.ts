/**
 * ComponentUIFactory - Factory interface for creating component-specific UI controls
 *
 * This pattern extracts the large switch-case statement in CanvasComponent.createControls()
 * into separate factory classes, improving maintainability and testability.
 */

import type { SynthComponent } from '../../components/base/SynthComponent';
import type { Knob } from '../controls/Knob';
import type { Dropdown } from '../controls/Dropdown';
import type { Slider } from '../controls/Slider';
import type { Button } from '../controls/Button';
import type { Position, ComponentType } from '../../core/types';

/**
 * Control union type
 */
export type Control = Knob | Dropdown | Slider | Button;

/**
 * Port positioning information
 */
export interface PortPositions {
  inputs: Array<{ id: string; x: number; y: number }>;
  outputs: Array<{ id: string; x: number; y: number }>;
}

/**
 * Interface for component-specific UI factories
 */
export interface ComponentUIFactory {
  /**
   * Get the component type this factory handles
   */
  getComponentType(): ComponentType;

  /**
   * Create UI controls for the component
   *
   * @param synthComponent - The synth component to create controls for
   * @param position - Canvas position of the component
   * @param width - Component width
   * @param height - Component height
   * @returns Array of UI controls
   */
  createControls(
    synthComponent: SynthComponent,
    position: Position,
    width: number,
    height: number
  ): Control[];

  /**
   * Calculate port positions for inputs and outputs
   *
   * @param synthComponent - The synth component
   * @param position - Canvas position of the component
   * @param width - Component width
   * @param height - Component height
   * @returns Port positions for rendering
   */
  calculatePortPositions(
    synthComponent: SynthComponent,
    position: Position,
    width: number,
    height: number
  ): PortPositions;

  /**
   * Calculate the required height for this component based on its controls
   *
   * @param synthComponent - The synth component
   * @param width - Component width
   * @returns Required height in pixels
   */
  calculateHeight(synthComponent: SynthComponent, width: number): number;
}

/**
 * Base implementation with common utilities
 */
export abstract class BaseComponentUIFactory implements ComponentUIFactory {
  abstract getComponentType(): ComponentType;
  abstract createControls(
    synthComponent: SynthComponent,
    position: Position,
    width: number,
    height: number
  ): Control[];

  /**
   * Default port position calculation
   * Distributes ports evenly along the left (inputs) and right (outputs) edges
   */
  calculatePortPositions(
    synthComponent: SynthComponent,
    position: Position,
    width: number,
    _height: number
  ): PortPositions {
    const COMPONENT_CONSTANTS = {
      HEADER_HEIGHT: 30,
      PORT_SIZE: 10,
      PORT_PADDING: 8,
      PORT_LABEL_MARGIN: 15,
    };

    const inputs = Array.from(synthComponent.inputs.entries()).map(([id, _port], index) => {
      const y = position.y + COMPONENT_CONSTANTS.HEADER_HEIGHT + (index + 1) * (COMPONENT_CONSTANTS.PORT_SIZE + COMPONENT_CONSTANTS.PORT_PADDING);
      return {
        id,
        x: position.x,
        y,
      };
    });

    const outputs = Array.from(synthComponent.outputs.entries()).map(([id, _port], index) => {
      const y = position.y + COMPONENT_CONSTANTS.HEADER_HEIGHT + (index + 1) * (COMPONENT_CONSTANTS.PORT_SIZE + COMPONENT_CONSTANTS.PORT_PADDING);
      return {
        id,
        x: position.x + width,
        y,
      };
    });

    return { inputs, outputs };
  }

  /**
   * Default height calculation based on ports and controls
   */
  calculateHeight(synthComponent: SynthComponent, _width: number): number {
    const COMPONENT_CONSTANTS = {
      MIN_HEIGHT: 120,
      HEADER_HEIGHT: 30,
      PORT_SIZE: 10,
      PORT_PADDING: 8,
      CONTROL_MARGIN_TOP: 10,
      CONTROL_MARGIN_BOTTOM: 10,
    };

    const numInputPorts = synthComponent.inputs.size;
    const numOutputPorts = synthComponent.outputs.size;
    const maxPorts = Math.max(numInputPorts, numOutputPorts);
    const portAreaHeight = maxPorts * (COMPONENT_CONSTANTS.PORT_SIZE + COMPONENT_CONSTANTS.PORT_PADDING) + COMPONENT_CONSTANTS.PORT_PADDING;

    // Base height includes header + port area + margins
    return Math.max(
      COMPONENT_CONSTANTS.MIN_HEIGHT,
      COMPONENT_CONSTANTS.HEADER_HEIGHT + portAreaHeight + COMPONENT_CONSTANTS.CONTROL_MARGIN_TOP + COMPONENT_CONSTANTS.CONTROL_MARGIN_BOTTOM
    );
  }

  /**
   * Helper: Calculate Y position below ports for control placement
   */
  protected getControlStartY(
    synthComponent: SynthComponent,
    position: Position
  ): number {
    const COMPONENT_CONSTANTS = {
      HEADER_HEIGHT: 30,
      PORT_SIZE: 10,
      PORT_PADDING: 8,
      CONTROL_MARGIN_TOP: 10,
    };

    const numInputPorts = synthComponent.inputs.size;
    const numOutputPorts = synthComponent.outputs.size;
    const maxPorts = Math.max(numInputPorts, numOutputPorts);
    const portAreaHeight = maxPorts * (COMPONENT_CONSTANTS.PORT_SIZE + COMPONENT_CONSTANTS.PORT_PADDING) + COMPONENT_CONSTANTS.PORT_PADDING;

    return position.y + COMPONENT_CONSTANTS.HEADER_HEIGHT + portAreaHeight + COMPONENT_CONSTANTS.CONTROL_MARGIN_TOP;
  }
}
