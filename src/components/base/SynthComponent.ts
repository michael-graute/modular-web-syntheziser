/**
 * SynthComponent - Base class for all synthesizer components
 */

import { ComponentType, Position, ComponentData } from '../../core/types';
import { audioEngine } from '../../core/AudioEngine';
import { Port } from './Port';
import { Parameter } from './Parameter';

/**
 * Abstract base class for synth components
 */
export abstract class SynthComponent {
  id: string;
  type: ComponentType;
  name: string;
  position: Position;
  inputs: Map<string, Port>;
  outputs: Map<string, Port>;
  parameters: Map<string, Parameter>;
  audioNodes: Map<string, AudioNode>;
  isActive: boolean;
  private _isBypassed: boolean = false;
  protected _bypassConnections: Array<{ from: AudioNode; to: AudioNode }> = [];

  constructor(id: string, type: ComponentType, name: string, position: Position) {
    this.id = id;
    this.type = type;
    this.name = name;
    this.position = position;
    this.inputs = new Map();
    this.outputs = new Map();
    this.parameters = new Map();
    this.audioNodes = new Map();
    this.isActive = false;
  }

  /**
   * Initialize the component's audio nodes
   * Must be implemented by subclasses
   */
  abstract createAudioNodes(): void;

  /**
   * Cleanup audio nodes when component is destroyed
   * Must be implemented by subclasses
   */
  abstract destroyAudioNodes(): void;

  /**
   * Update audio parameters when parameter values change
   */
  abstract updateAudioParameter(parameterId: string, value: number): void;

  /**
   * Add an input port
   */
  protected addInput(id: string, name: string, type: import('../../core/types').SignalType): void {
    const port = new Port(id, name, type, true);
    this.inputs.set(id, port);
  }

  /**
   * Add an output port
   */
  protected addOutput(id: string, name: string, type: import('../../core/types').SignalType): void {
    const port = new Port(id, name, type, false);
    this.outputs.set(id, port);
  }

  /**
   * Add a parameter
   */
  protected addParameter(
    id: string,
    name: string,
    defaultValue: number,
    min: number,
    max: number,
    step: number = 0.01,
    unit: string = ''
  ): void {
    // Create unique parameter ID by combining component ID with parameter ID
    // This ensures parameters from different components don't collide
    const uniqueParameterId = `${this.id}:${id}`;
    const parameter = new Parameter(uniqueParameterId, name, defaultValue, min, max, step, unit);
    this.parameters.set(id, parameter);
  }

  /**
   * Get an input port by ID
   */
  getInput(id: string): Port | undefined {
    return this.inputs.get(id);
  }

  /**
   * Get an output port by ID
   */
  getOutput(id: string): Port | undefined {
    return this.outputs.get(id);
  }

  /**
   * Get a parameter by ID
   */
  getParameter(id: string): Parameter | undefined {
    return this.parameters.get(id);
  }

  /**
   * Set a parameter value
   */
  setParameterValue(parameterId: string, value: number): void {
    // Parameter ID might be either simple ("frequency") or full ("componentId:frequency")
    // Parameters are stored internally with simple IDs, so extract if needed
    let simpleId = parameterId;
    if (parameterId.includes(':')) {
      // Extract the part after the colon
      const parts = parameterId.split(':');
      simpleId = parts[1] || parameterId;
    }

    const parameter = this.parameters.get(simpleId);
    if (!parameter) {
      console.warn(`Parameter ${parameterId} (${simpleId}) not found on component ${this.id}`);
      return;
    }

    parameter.setValue(value);
    // Pass simple ID to updateAudioParameter since subclasses expect simple IDs
    this.updateAudioParameter(simpleId, value);
  }

  /**
   * Get bypass state
   */
  get isBypassed(): boolean {
    return this._isBypassed;
  }

  /**
   * Check if this component type supports bypass
   */
  isBypassable(): boolean {
    const bypassableTypes: ComponentType[] = [
      ComponentType.FILTER,
      ComponentType.VCA,
      ComponentType.ADSR_ENVELOPE,
      ComponentType.FILTER_ENVELOPE,
      ComponentType.DELAY,
      ComponentType.REVERB,
      ComponentType.DISTORTION,
      ComponentType.CHORUS,
      ComponentType.MIXER,
    ];
    return bypassableTypes.includes(this.type);
  }

  /**
   * Enable or disable bypass for this component
   */
  setBypass(bypassed: boolean): void {
    if (this._isBypassed === bypassed) return; // No change

    this._isBypassed = bypassed;

    if (bypassed) {
      this.enableBypass();
    } else {
      this.disableBypass();
    }
  }

  /**
   * Enable bypass - to be overridden by subclasses
   * Default implementation provides warning for non-implemented components
   */
  protected enableBypass(): void {
    // Subclasses should override for component-specific logic
    console.warn(`Bypass not fully implemented for ${this.type}`);
  }

  /**
   * Disable bypass - to be overridden by subclasses
   */
  protected disableBypass(): void {
    // Subclasses should override for component-specific logic
    console.warn(`Bypass restoration not fully implemented for ${this.type}`);
  }

  /**
   * Get an audio node by key
   */
  getAudioNode(key: string): AudioNode | undefined {
    return this.audioNodes.get(key);
  }

  /**
   * Register an audio node with the audio engine
   */
  protected registerAudioNode(key: string, node: AudioNode): void {
    this.audioNodes.set(key, node);
    audioEngine.addNode(`${this.id}:${key}`, node, this.type);
  }

  /**
   * Get the main audio input node (for connections)
   */
  abstract getInputNode(portId?: string): AudioNode | null;

  /**
   * Get the main audio output node (for connections)
   */
  abstract getOutputNode(): AudioNode | null;

  /**
   * Connect this component's output to another component's input
   */
  connectTo(target: SynthComponent, outputId: string = 'output', inputId: string = 'input'): void {
    // Get port information
    const outputPort = this.outputs.get(outputId);
    const inputPort = target.inputs.get(inputId);

    if (!outputPort || !inputPort) {
      console.warn(`Cannot connect: port not found (${outputId} -> ${inputId})`);
      return;
    }

    try {
      // Get the specific output node for this port
      const outputNode = this.getOutputNodeByPort(outputId);

      if (!outputNode) {
        console.warn(`Cannot connect: no output node for port ${outputId}`);
        return;
      }

      // Check if this is a CV/Gate connection to an AudioParam
      if (outputPort.type === 'cv' || outputPort.type === 'gate') {
        // Special handling for gate connections to ADSR
        if (outputPort.type === 'gate' && target.type === 'adsr-envelope') {
          // Register the ADSR with the source component for triggering
          const registerMethod = (this as any).registerGateTarget;
          if (registerMethod && typeof registerMethod === 'function') {
            registerMethod.call(this, target);
            console.log(`✓ Connected ${this.name}:${outputPort.name} (Gate) -> ${target.name}:${inputPort.name} (Trigger)`);
          } else {
            console.warn(`Gate connection registered but source doesn't support gate triggering`);
          }
        }

        // Try to get the target AudioParam for CV modulation
        const targetParam = target.getAudioParamForInput(inputId);

        if (targetParam) {
          // Connect CV source to AudioParam
          outputNode.connect(targetParam);
          console.log(`✓ Connected ${this.name}:${outputPort.name} (CV) -> ${target.name}:${inputPort.name} (AudioParam)`);

          // Helpful tip for frequency CV connections
          if (inputId === 'frequency' && target.type === 'oscillator') {
            console.log(`💡 Tip: Set ${target.name} frequency knob to 0 Hz for direct CV control, or use it as an offset/transpose`);
          }
        } else if (outputPort.type !== 'gate' || target.type !== 'adsr-envelope') {
          // Only warn if it's not a gate->ADSR connection (which doesn't use AudioParam)
          console.warn(`Cannot connect CV: no AudioParam found for input ${inputId}`);
          return;
        }
      } else {
        // Regular audio connection (AudioNode -> AudioNode)
        const inputNode = target.getInputNode(inputId);

        if (!inputNode) {
          console.warn(`Cannot connect: no input node for ${target.name}`);
          return;
        }

        outputNode.connect(inputNode);
        console.log(`Connected ${this.name}:${outputPort.name} (Audio) -> ${target.name}:${inputPort.name}`);
      }

      // Update port connections
      outputPort.connect(inputPort.id);
      inputPort.connect(outputPort.id);

    } catch (error) {
      console.error(`Failed to connect components:`, error);
    }
  }

  /**
   * Get output node for a specific port (override in subclasses if needed)
   */
  protected getOutputNodeByPort(_portId: string): AudioNode | null {
    // Default implementation returns the main output node
    // Subclasses can override to return port-specific nodes
    return this.getOutputNode();
  }

  /**
   * Get input node for a specific port (override in subclasses if needed)
   */
  protected getInputNodeByPort(_portId: string): AudioNode | null {
    // Default implementation returns the main input node
    // Subclasses can override to return port-specific nodes
    return this.getInputNode();
  }

  /**
   * Get AudioParam for a specific input port (override in subclasses for CV inputs)
   */
  protected getAudioParamForInput(_inputId: string): AudioParam | null {
    // Default implementation returns null
    // Subclasses should override to provide AudioParams for CV inputs
    return null;
  }

  /**
   * Disconnect from another component
   */
  disconnectFrom(target: SynthComponent, outputId?: string, inputId?: string): void {
    try {
      // If port IDs provided, disconnect specific connection
      if (outputId && inputId) {
        const outputNode = this.getOutputNodeByPort(outputId);
        const outputPort = this.outputs.get(outputId);
        const inputPort = target.inputs.get(inputId);

        if (!outputNode || !outputPort || !inputPort) {
          console.warn(`Cannot disconnect: port not found (${outputId} -> ${inputId})`);
          return;
        }

        // For CV/Gate connections to AudioParams, disconnect from the AudioParam
        if (outputPort.type === 'cv' || outputPort.type === 'gate') {
          const targetParam = target.getAudioParamForInput(inputId);

          if (targetParam) {
            outputNode.disconnect(targetParam);
            console.log(`✓ Disconnected ${this.name}:${outputPort.name} from ${target.name}:${inputPort.name} (AudioParam)`);
          }

          // If this was a gate connection to ADSR, unregister
          if (outputPort.type === 'gate' && target.type === 'adsr-envelope') {
            const unregisterMethod = (this as any).unregisterGateTarget;
            if (unregisterMethod && typeof unregisterMethod === 'function') {
              unregisterMethod.call(this, target);
            }
          }
        } else {
          // For audio connections, disconnect from input node
          const inputNode = target.getInputNodeByPort(inputId);
          if (inputNode) {
            outputNode.disconnect(inputNode);
            console.log(`✓ Disconnected ${this.name}:${outputPort.name} from ${target.name}:${inputPort.name} (Audio)`);
          }
        }

        // Update port connection state
        outputPort.disconnect();
        inputPort.disconnect();
      } else {
        // Fallback: disconnect all (legacy behavior)
        const outputNode = this.getOutputNode();
        const inputNode = target.getInputNode();

        if (outputNode && inputNode) {
          outputNode.disconnect(inputNode);

          // Update port connections
          this.outputs.forEach((port) => port.disconnect());
          target.inputs.forEach((port) => port.disconnect());

          console.log(`Disconnected ${this.name} from ${target.name} (all connections)`);
        }
      }
    } catch (error) {
      console.error(`Failed to disconnect components:`, error);
    }
  }

  /**
   * Activate the component (start audio processing)
   */
  activate(): void {
    if (!this.isActive) {
      this.createAudioNodes();
      this.isActive = true;

      // Apply bypass state if it was restored from deserialization
      if (this._isBypassed) {
        this.enableBypass();
      }
    }
  }

  /**
   * Deactivate the component (stop audio processing)
   */
  deactivate(): void {
    if (this.isActive) {
      this.destroyAudioNodes();
      this.isActive = false;
    }
  }

  /**
   * Move component to new position
   */
  setPosition(position: Position): void {
    this.position = position;
  }

  /**
   * Get all input port IDs
   */
  getInputIds(): string[] {
    return Array.from(this.inputs.keys());
  }

  /**
   * Get all output port IDs
   */
  getOutputIds(): string[] {
    return Array.from(this.outputs.keys());
  }

  /**
   * Get all parameter IDs
   */
  getParameterIds(): string[] {
    return Array.from(this.parameters.keys());
  }

  /**
   * Serialize component to JSON
   */
  serialize(): ComponentData {
    const parameterData: Record<string, number> = {};
    this.parameters.forEach((param, id) => {
      parameterData[id] = param.getValue();
    });

    return {
      id: this.id,
      type: this.type,
      position: { ...this.position },
      parameters: parameterData,
      isBypassed: this._isBypassed || undefined, // Only include if true
    };
  }

  /**
   * Deserialize and restore parameter values
   */
  deserialize(data: ComponentData): void {
    // Restore position
    this.position = { ...data.position };

    // Restore parameter values
    Object.entries(data.parameters).forEach(([id, value]) => {
      this.setParameterValue(id, value);
    });

    // Store bypass state flag (will be applied after audio nodes are created)
    if (data.isBypassed) {
      this._isBypassed = true;
    }
  }
}
