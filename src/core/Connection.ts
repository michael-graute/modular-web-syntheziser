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
  /**
   * Optional modulation metadata for CV connections
   * Feature: 008-lfo-parameter-depth (T025, T026)
   * Stores parameter-aware depth calculation results for patch persistence
   */
  modulationMetadata?: {
    targetParameterMin: number;
    targetParameterMax: number;
    lastCalculatedDepth: number;
    lastCalculatedBaseValue: number;
    lastCalculatedGain: number;
    lastCalculatedAt: number;
  };

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
   * Feature: 008-lfo-parameter-depth (T025)
   * Includes optional modulationMetadata for CV connections
   */
  serialize(): {
    id: string;
    sourceComponentId: string;
    sourcePortId: string;
    targetComponentId: string;
    targetPortId: string;
    signalType: SignalType;
    modulationMetadata?: {
      targetParameterMin: number;
      targetParameterMax: number;
      lastCalculatedDepth: number;
      lastCalculatedBaseValue: number;
      lastCalculatedGain: number;
      lastCalculatedAt: number;
    };
  } {
    const serialized: any = {
      id: this.id,
      sourceComponentId: this.sourceComponentId,
      sourcePortId: this.sourcePortId,
      targetComponentId: this.targetComponentId,
      targetPortId: this.targetPortId,
      signalType: this.signalType,
    };

    // Include modulationMetadata if present
    if (this.modulationMetadata) {
      serialized.modulationMetadata = this.modulationMetadata;
    }

    return serialized;
  }

  /**
   * Deserialize connection from JSON
   * Feature: 008-lfo-parameter-depth (T026, T027)
   * Restores modulationMetadata if present, backward compatible with old patches
   */
  static deserialize(data: {
    id: string;
    sourceComponentId: string;
    sourcePortId: string;
    targetComponentId: string;
    targetPortId: string;
    signalType: SignalType;
    modulationMetadata?: {
      targetParameterMin: number;
      targetParameterMax: number;
      lastCalculatedDepth: number;
      lastCalculatedBaseValue: number;
      lastCalculatedGain: number;
      lastCalculatedAt: number;
    };
  }): Connection {
    const connection = new Connection(
      data.id,
      data.sourceComponentId,
      data.sourcePortId,
      data.targetComponentId,
      data.targetPortId,
      data.signalType
    );

    // Restore modulationMetadata if present (T026)
    // Backward compatibility: old patches without metadata will work fine (T027)
    if (data.modulationMetadata) {
      connection.modulationMetadata = data.modulationMetadata;
    }

    return connection;
  }
}
