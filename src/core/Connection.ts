/**
 * Connection - Data model for component connections
 */

import { SignalType } from './types';
import { areSignalTypesCompatible } from '../utils/validators';

/**
 * Connection data model representing audio/CV routing
 */
export class Connection {
  id: string;
  sourceComponentId: string;
  sourcePortId: string;
  targetComponentId: string;
  targetPortId: string;
  signalType: SignalType;

  constructor(
    id: string,
    sourceComponentId: string,
    sourcePortId: string,
    targetComponentId: string,
    targetPortId: string,
    signalType: SignalType
  ) {
    this.id = id;
    this.sourceComponentId = sourceComponentId;
    this.sourcePortId = sourcePortId;
    this.targetComponentId = targetComponentId;
    this.targetPortId = targetPortId;
    this.signalType = signalType;
  }

  /**
   * Validate if this connection is allowed
   */
  static validate(
    sourceType: SignalType,
    targetType: SignalType
  ): { valid: boolean; error?: string } {
    if (!areSignalTypesCompatible(sourceType, targetType)) {
      return {
        valid: false,
        error: `Cannot connect ${sourceType} to ${targetType}`,
      };
    }
    return { valid: true };
  }

  /**
   * Get source identifier
   */
  getSourceId(): string {
    return `${this.sourceComponentId}:${this.sourcePortId}`;
  }

  /**
   * Get target identifier
   */
  getTargetId(): string {
    return `${this.targetComponentId}:${this.targetPortId}`;
  }

  /**
   * Serialize connection to JSON
   */
  serialize(): {
    id: string;
    sourceComponentId: string;
    sourcePortId: string;
    targetComponentId: string;
    targetPortId: string;
    signalType: SignalType;
  } {
    return {
      id: this.id,
      sourceComponentId: this.sourceComponentId,
      sourcePortId: this.sourcePortId,
      targetComponentId: this.targetComponentId,
      targetPortId: this.targetPortId,
      signalType: this.signalType,
    };
  }

  /**
   * Deserialize connection from JSON
   */
  static deserialize(data: {
    id: string;
    sourceComponentId: string;
    sourcePortId: string;
    targetComponentId: string;
    targetPortId: string;
    signalType: SignalType;
  }): Connection {
    return new Connection(
      data.id,
      data.sourceComponentId,
      data.sourcePortId,
      data.targetComponentId,
      data.targetPortId,
      data.signalType
    );
  }
}
