/**
 * Modulation Connection Manager
 * Feature: 008-lfo-parameter-depth
 *
 * Manages ModulationConnection instances and scaling GainNodes for parameter-aware depth.
 * Implements FR-013: Enforces one LFO per parameter constraint.
 */

import type { Connection } from '../core/types';
import type { ModulationScalingNode } from './types';
import { audioEngine } from '../core/AudioEngine';

/**
 * Manages modulation-specific connections and scaling gain nodes
 * Tracks which parameters are modulated by which LFOs
 */
export class ModulationConnectionManager {
  /**
   * Map of connection ID to scaling GainNode
   * One scaling node per CV connection for parameter-aware depth
   */
  private scalingNodes: Map<string, ModulationScalingNode>;

  /**
   * Map of target parameter ID to source LFO component ID
   * Enforces FR-013: one LFO per parameter constraint
   * Key: `${targetComponentId}:${targetPortId}`
   * Value: sourceComponentId (LFO ID)
   */
  private parameterToLFOMap: Map<string, string>;

  constructor() {
    this.scalingNodes = new Map();
    this.parameterToLFOMap = new Map();
  }

  /**
   * Create a scaling GainNode for a CV connection
   * Feature: 008-lfo-parameter-depth
   *
   * @param connectionId - Connection ID
   * @param connection - Connection data
   * @param lfoOutputNode - LFO's output node (gain node)
   * @param targetAudioParam - Target parameter's AudioParam
   * @returns Created scaling node or null if failed
   */
  createScalingNode(
    connectionId: string,
    connection: Connection,
    lfoOutputNode: AudioNode,
    targetAudioParam: AudioParam
  ): ModulationScalingNode | null {
    if (!audioEngine.isReady()) {
      console.error('AudioEngine not ready for scaling node creation');
      return null;
    }

    // FR-013: Check if target parameter already has a modulation connection
    const parameterKey = `${connection.targetComponentId}:${connection.targetPortId}`;
    const existingLFO = this.parameterToLFOMap.get(parameterKey);

    if (existingLFO && existingLFO !== connection.sourceComponentId) {
      console.warn(
        `Parameter ${parameterKey} already modulated by LFO ${existingLFO}. Replacing with ${connection.sourceComponentId}`
      );
      // Replace existing connection (this is handled by ConnectionManager removing old connection first)
    }

    const ctx = audioEngine.getContext();

    // Create scaling GainNode
    const scalingGainNode = ctx.createGain();
    scalingGainNode.gain.value = 1.0; // Will be set by depth calculation

    // Connect: LFO output → Scaling GainNode → Target AudioParam
    try {
      lfoOutputNode.connect(scalingGainNode);
      scalingGainNode.connect(targetAudioParam);

      const scalingNode: ModulationScalingNode = {
        connectionId,
        scalingGainNode,
        lfoOutputNode,
        targetAudioParam,
        sourceComponentId: connection.sourceComponentId,
        targetComponentId: connection.targetComponentId,
        targetPortId: connection.targetPortId,
      };

      // Track the scaling node
      this.scalingNodes.set(connectionId, scalingNode);

      // Track parameter-to-LFO mapping (FR-013 enforcement)
      this.parameterToLFOMap.set(parameterKey, connection.sourceComponentId);

      console.log(
        `✓ Created scaling GainNode for CV connection ${connectionId} (${parameterKey})`
      );

      return scalingNode;
    } catch (error) {
      console.error('Failed to create scaling node:', error);
      // Clean up on failure
      scalingGainNode.disconnect();
      return null;
    }
  }

  /**
   * Update scaling gain value for a connection
   * Called when depth or base value changes
   *
   * @param connectionId - Connection ID
   * @param gainValue - New gain value from depth calculation
   */
  updateScalingGain(connectionId: string, gainValue: number): void {
    const scalingNode = this.scalingNodes.get(connectionId);
    if (!scalingNode) {
      console.warn(`No scaling node found for connection ${connectionId}`);
      return;
    }

    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;

    // Update gain smoothly to avoid audio clicks
    scalingNode.scalingGainNode.gain.setValueAtTime(gainValue, now);

    console.log(`Updated scaling gain for ${connectionId}: ${gainValue.toFixed(4)}`);
  }

  /**
   * Remove scaling node for a connection
   * Called when connection is removed
   *
   * @param connectionId - Connection ID
   */
  removeScalingNode(connectionId: string): void {
    const scalingNode = this.scalingNodes.get(connectionId);
    if (!scalingNode) {
      return;
    }

    try {
      // Disconnect the complete chain: LFO → Scaling GainNode → Target AudioParam
      // First disconnect LFO output from scaling node
      scalingNode.lfoOutputNode.disconnect(scalingNode.scalingGainNode);

      // Then disconnect scaling node from target AudioParam
      scalingNode.scalingGainNode.disconnect(scalingNode.targetAudioParam);

      // Remove from parameter-to-LFO map
      const parameterKey = `${scalingNode.targetComponentId}:${scalingNode.targetPortId}`;
      this.parameterToLFOMap.delete(parameterKey);

      // Remove from tracking
      this.scalingNodes.delete(connectionId);

      console.log(`✓ Removed scaling GainNode for connection ${connectionId}`);
    } catch (error) {
      console.error('Failed to remove scaling node:', error);
    }
  }

  /**
   * Get scaling node for a connection
   *
   * @param connectionId - Connection ID
   * @returns Scaling node or undefined
   */
  getScalingNode(connectionId: string): ModulationScalingNode | undefined {
    return this.scalingNodes.get(connectionId);
  }

  /**
   * Check if a parameter is already modulated
   * FR-013 enforcement helper
   *
   * @param targetComponentId - Target component ID
   * @param targetPortId - Target port ID
   * @returns LFO component ID if parameter is modulated, undefined otherwise
   */
  getModulatingLFO(
    targetComponentId: string,
    targetPortId: string
  ): string | undefined {
    const parameterKey = `${targetComponentId}:${targetPortId}`;
    return this.parameterToLFOMap.get(parameterKey);
  }

  /**
   * Get all connections modulated by a specific LFO
   * Used for bulk updates when LFO depth changes
   *
   * @param lfoComponentId - LFO component ID
   * @returns Array of connection IDs
   */
  getConnectionsByLFO(lfoComponentId: string): string[] {
    const connectionIds: string[] = [];

    for (const [connectionId, scalingNode] of this.scalingNodes.entries()) {
      if (scalingNode.sourceComponentId === lfoComponentId) {
        connectionIds.push(connectionId);
      }
    }

    return connectionIds;
  }

  /**
   * Clear all scaling nodes
   * Called when resetting or clearing the patch
   */
  clear(): void {
    for (const [connectionId] of this.scalingNodes.entries()) {
      this.removeScalingNode(connectionId);
    }

    console.log('✓ Cleared all modulation scaling nodes');
  }
}

/**
 * Singleton instance for global access
 */
export const modulationConnectionManager = new ModulationConnectionManager();
