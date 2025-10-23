/**
 * Port - Input/Output port definition for synth components
 */

import { SignalType } from '../../core/types';

/**
 * Port class representing an input or output on a component
 */
export class Port {
  id: string;
  name: string;
  type: SignalType;
  isInput: boolean;
  connectedTo: string | null;

  constructor(id: string, name: string, type: SignalType, isInput: boolean) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.isInput = isInput;
    this.connectedTo = null;
  }

  /**
   * Check if port is an input
   */
  isInputPort(): boolean {
    return this.isInput;
  }

  /**
   * Check if port is an output
   */
  isOutputPort(): boolean {
    return !this.isInput;
  }

  /**
   * Check if port is connected
   */
  isConnected(): boolean {
    return this.connectedTo !== null;
  }

  /**
   * Connect this port to another port
   */
  connect(portId: string): void {
    if (this.isInput && this.connectedTo !== null) {
      console.warn(`Input port ${this.id} already connected. Disconnecting previous connection.`);
    }
    this.connectedTo = portId;
  }

  /**
   * Disconnect this port
   */
  disconnect(): void {
    this.connectedTo = null;
  }

  /**
   * Get the ID of the connected port
   */
  getConnectedPort(): string | null {
    return this.connectedTo;
  }

  /**
   * Serialize port data
   */
  serialize(): {
    id: string;
    name: string;
    type: SignalType;
    isInput: boolean;
  } {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      isInput: this.isInput,
    };
  }
}
