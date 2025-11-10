/**
 * ConnectionManager - Manages visual and audio connections between components
 */

import { Connection } from '../core/Connection';
import { CanvasConnection } from './Connection';
import { CanvasComponent } from './CanvasComponent';
import { eventBus } from '../core/EventBus';
import { EventType, SignalType } from '../core/types';
import { modulationConnectionManager } from '../modulation/ModulationConnectionManager';
import { parameterAwareDepthCalculator } from '../modulation/ParameterAwareDepthCalculator';
import type { DepthCalculationInput } from '../modulation/types';
import { handleBaseAtBoundary, clampBaseValue } from '../modulation/validation';

/**
 * Manages all connections in the patch
 */
export class ConnectionManager {
  private connections: Map<string, Connection>;
  private visualConnections: Map<string, CanvasConnection>;
  private components: Map<string, CanvasComponent>;

  constructor() {
    this.connections = new Map();
    this.visualConnections = new Map();
    this.components = new Map();

    // Feature: 008-lfo-parameter-depth (T010, T011)
    // Listen for parameter changes to recalculate modulation depth
    this.setupParameterChangeListeners();
  }

  /**
   * Setup event listeners for parameter changes
   * Feature: 008-lfo-parameter-depth (T010, T011)
   */
  private setupParameterChangeListeners(): void {
    // T010: Listen for LFO depth parameter changes
    // T011: Listen for target parameter base value changes
    eventBus.on(EventType.PARAMETER_CHANGED, (data: any) => {
      const { componentId, parameterId } = data;

      // Check if this is an LFO depth parameter change
      const component = this.components.get(componentId);
      if (!component || !component.synthComponent) return;

      if (parameterId === 'depth' && component.type === 'lfo') {
        // LFO depth changed - recalculate for all connected parameters
        this.handleLFODepthChange(componentId);
      } else {
        // Check if this parameter is being modulated
        // If so, recalculate depth (base value might have changed)
        this.handleParameterBaseValueChange(componentId, parameterId);
      }
    });
  }

  /**
   * Handle LFO depth parameter change
   * Feature: 008-lfo-parameter-depth (T010)
   *
   * @param lfoComponentId - LFO component ID
   */
  private handleLFODepthChange(lfoComponentId: string): void {
    // Get all connections from this LFO
    const affectedConnections = modulationConnectionManager.getConnectionsByLFO(lfoComponentId);

    if (affectedConnections.length === 0) {
      return;
    }

    console.log(`🔄 LFO depth changed, recalculating ${affectedConnections.length} connection(s)`);

    // Recalculate depth for each connected parameter
    for (const connectionId of affectedConnections) {
      const connection = this.connections.get(connectionId);
      if (!connection) continue;

      const sourceComponent = this.components.get(connection.sourceComponentId);
      const targetComponent = this.components.get(connection.targetComponentId);

      if (sourceComponent && targetComponent) {
        this.calculateAndApplyDepth(
          connectionId,
          sourceComponent,
          targetComponent,
          connection.targetPortId
        );
      }
    }
  }

  /**
   * Handle target parameter base value change
   * Feature: 008-lfo-parameter-depth (T011)
   *
   * @param componentId - Component ID
   * @param parameterId - Parameter ID
   */
  private handleParameterBaseValueChange(
    componentId: string,
    _parameterId: string
  ): void {
    // Find connections where this component/parameter is the target
    const affectedConnections = Array.from(this.connections.entries()).filter(
      ([_, connection]) =>
        connection.targetComponentId === componentId &&
        connection.signalType === SignalType.CV
    );

    if (affectedConnections.length === 0) {
      return;
    }

    console.log(`🔄 Parameter base value changed, recalculating modulation`);

    // Recalculate for affected connections
    for (const [connectionId, connection] of affectedConnections) {
      const sourceComponent = this.components.get(connection.sourceComponentId);
      const targetComponent = this.components.get(connection.targetComponentId);

      if (sourceComponent && targetComponent) {
        this.calculateAndApplyDepth(
          connectionId,
          sourceComponent,
          targetComponent,
          connection.targetPortId
        );
      }
    }
  }

  /**
   * Register a component with the manager
   */
  registerComponent(component: CanvasComponent): void {
    this.components.set(component.id, component);
  }

  /**
   * Unregister a component and remove all its connections
   */
  unregisterComponent(componentId: string): void {
    // Remove all connections involving this component
    const connectionsToRemove = Array.from(this.connections.values()).filter(
      (conn) =>
        conn.sourceComponentId === componentId ||
        conn.targetComponentId === componentId
    );

    connectionsToRemove.forEach((conn) => this.removeConnection(conn.id));
    this.components.delete(componentId);
  }

  /**
   * Create a new connection between two ports
   */
  createConnection(
    sourceComponentId: string,
    sourcePortId: string,
    targetComponentId: string,
    targetPortId: string
  ): { success: boolean; error?: string; connectionId?: string } {
    // Get components
    const sourceComponent = this.components.get(sourceComponentId);
    const targetComponent = this.components.get(targetComponentId);

    if (!sourceComponent || !targetComponent) {
      return { success: false, error: 'Component not found' };
    }

    if (!sourceComponent.synthComponent || !targetComponent.synthComponent) {
      return { success: false, error: 'Component not linked to audio' };
    }

    // Get ports
    const sourcePort = sourceComponent.synthComponent.outputs.get(sourcePortId);
    const targetPort = targetComponent.synthComponent.inputs.get(targetPortId);

    if (!sourcePort || !targetPort) {
      return { success: false, error: 'Port not found' };
    }

    // Validate connection
    const validation = Connection.validate(sourcePort.type, targetPort.type);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Check if input already has a connection (only one connection per input)
    const existingConnection = Array.from(this.connections.values()).find(
      (conn) =>
        conn.targetComponentId === targetComponentId &&
        conn.targetPortId === targetPortId
    );

    if (existingConnection) {
      // Remove existing connection first
      this.removeConnection(existingConnection.id);
    }

    // Create connection data model
    const connectionId = crypto.randomUUID();
    const connection = new Connection(
      connectionId,
      sourceComponentId,
      sourcePortId,
      targetComponentId,
      targetPortId,
      sourcePort.type
    );

    // Create visual connection
    const sourcePos = sourceComponent.getPortPosition(sourcePortId, false);
    const targetPos = targetComponent.getPortPosition(targetPortId, true);

    if (!sourcePos || !targetPos) {
      return { success: false, error: 'Could not determine port positions' };
    }

    const visualConnection = new CanvasConnection(
      connectionId,
      sourcePos,
      targetPos,
      sourcePort.type
    );

    // Store connections
    this.connections.set(connectionId, connection);
    this.visualConnections.set(connectionId, visualConnection);

    // Connect audio nodes with port IDs
    // For CV connections, we'll insert a scaling GainNode for parameter-aware depth
    const isCVConnection = sourcePort.type === SignalType.CV;

    try {
      if (isCVConnection) {
        // Feature: 008-lfo-parameter-depth
        // For CV connections, create parameter-aware scaling
        const sourceOutputNode = sourceComponent.synthComponent.getOutputNode();
        const targetAudioParam = targetComponent.synthComponent.getAudioParamForInput(targetPortId);

        if (sourceOutputNode && targetAudioParam) {
          // Create scaling GainNode via ModulationConnectionManager
          const scalingNode = modulationConnectionManager.createScalingNode(
            connectionId,
            connection,
            sourceOutputNode,
            targetAudioParam
          );

          if (!scalingNode) {
            throw new Error('Failed to create modulation scaling node');
          }

          // Calculate parameter-aware depth (T009)
          this.calculateAndApplyDepth(
            connectionId,
            sourceComponent,
            targetComponent,
            targetPortId
          );
        } else {
          // Fallback to direct connection if AudioParam not available
          sourceComponent.synthComponent.connectTo(
            targetComponent.synthComponent,
            sourcePortId,
            targetPortId
          );
        }
      } else {
        // Non-CV connections: standard audio connection
        sourceComponent.synthComponent.connectTo(
          targetComponent.synthComponent,
          sourcePortId,
          targetPortId
        );
      }
    } catch (error) {
      console.error('Failed to connect audio nodes:', error);
      // Clean up on failure
      this.connections.delete(connectionId);
      this.visualConnections.delete(connectionId);
      return { success: false, error: 'Failed to connect audio nodes' };
    }

    console.log(
      `✅ Connected ${sourceComponent.type}:${sourcePort.name} -> ${targetComponent.type}:${targetPort.name}${isCVConnection ? ' (parameter-aware)' : ''}`
    );

    // Notify ModulationVisualizer about CV connections for realtime visualization
    if (isCVConnection) {
      eventBus.emit(EventType.CONNECTION_ADDED, {
        connection,
        sourceComponent: sourceComponent.synthComponent,
        targetComponent: targetComponent.synthComponent,
      });
    }

    return { success: true, connectionId };
  }

  /**
   * Calculate parameter-aware depth and apply to scaling GainNode
   * Feature: 008-lfo-parameter-depth (T009)
   *
   * @param connectionId - Connection ID
   * @param sourceComponent - Source component (LFO)
   * @param targetComponent - Target component (has parameter)
   * @param targetPortId - Target port ID (parameter)
   */
  private calculateAndApplyDepth(
    connectionId: string,
    sourceComponent: CanvasComponent,
    targetComponent: CanvasComponent,
    targetPortId: string
  ): void {
    // Get LFO depth parameter
    const lfoDepth = sourceComponent.synthComponent?.getParameter('depth')?.getValue();
    if (lfoDepth === undefined) {
      console.warn('Could not get LFO depth parameter');
      return;
    }

    // Get target parameter (parameter ID matches port ID)
    const targetParameter = targetComponent.synthComponent?.getParameter(targetPortId);
    if (!targetParameter) {
      console.warn(`Could not get target parameter for port ${targetPortId}`);
      return;
    }

    // Check if parameter can be modulated
    if (!targetParameter.canBeModulated()) {
      console.warn(`Parameter ${targetParameter.name} has zero range, cannot be modulated`);
      return;
    }

    // Get parameter bounds
    const bounds = targetParameter.getModulationBounds();

    // Feature: 008-lfo-parameter-depth (T018)
    // Edge case: Clamp base value if outside parameter range
    const clampResult = clampBaseValue(bounds.baseValue, bounds.min, bounds.max);
    const effectiveBaseValue = clampResult.clamped;

    // Prepare depth calculation input
    const input: DepthCalculationInput = {
      parameterMin: bounds.min,
      parameterMax: bounds.max,
      baseValue: effectiveBaseValue,
      depthPercent: lfoDepth,
    };

    // Feature: 008-lfo-parameter-depth (T016)
    // Check for edge case: base value at boundaries
    const boundaryInfo = handleBaseAtBoundary(
      { min: bounds.min, max: bounds.max, baseValue: effectiveBaseValue, range: bounds.range },
      lfoDepth
    );

    // Calculate modulation ranges
    const result = parameterAwareDepthCalculator.calculateModulationRanges(input);

    if (!result.valid) {
      console.error('Depth calculation failed:', result.error);
      return;
    }

    // Apply calculated gain to scaling node
    modulationConnectionManager.updateScalingGain(connectionId, result.value.gain);

    // Feature: 008-lfo-parameter-depth (T025)
    // Store modulation metadata in connection for patch persistence
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.modulationMetadata = {
        targetParameterMin: bounds.min,
        targetParameterMax: bounds.max,
        lastCalculatedDepth: lfoDepth,
        lastCalculatedBaseValue: effectiveBaseValue,
        lastCalculatedGain: result.value.gain,
        lastCalculatedAt: Date.now(),
      };
    }

    // Feature: 008-lfo-parameter-depth (T019)
    // Enhanced logging for asymmetric calculations
    const isAsymmetric = Math.abs(result.value.upwardRange - result.value.downwardRange) > 0.01;
    const asymmetricIndicator = isAsymmetric ? ' [ASYMMETRIC]' : ' [SYMMETRIC]';

    let edgeCaseInfo = '';
    if (boundaryInfo.isAtMin) {
      edgeCaseInfo = '\n  ⚠️ Edge case: Base at minimum - unidirectional upward modulation';
    } else if (boundaryInfo.isAtMax) {
      edgeCaseInfo = '\n  ⚠️ Edge case: Base at maximum - unidirectional downward modulation';
    }

    if (clampResult.wasClamped) {
      edgeCaseInfo += `\n  ⚠️ Edge case: Base value clamped from ${bounds.baseValue.toFixed(2)} to ${effectiveBaseValue.toFixed(2)}`;
    }

    console.log(
      `📊 Depth calculation for ${targetParameter.name}${asymmetricIndicator}:`,
      `\n  Parameter range: [${bounds.min.toFixed(2)}, ${bounds.max.toFixed(2)}]`,
      `\n  Base: ${effectiveBaseValue.toFixed(2)}, Depth: ${lfoDepth}%`,
      `\n  Upward range: ${result.value.upwardRange.toFixed(2)} (${((result.value.upwardRange / bounds.range) * 100).toFixed(1)}% of total)`,
      `\n  Downward range: ${result.value.downwardRange.toFixed(2)} (${((result.value.downwardRange / bounds.range) * 100).toFixed(1)}% of total)`,
      `\n  Averaged gain: ${result.value.gain.toFixed(4)}`,
      `\n  Effective modulation: ${result.value.effectiveMin.toFixed(2)} - ${result.value.effectiveMax.toFixed(2)}`,
      edgeCaseInfo
    );
  }

  /**
   * Remove a connection
   */
  removeConnection(connectionId: string): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return false;
    }

    // Get components
    const sourceComponent = this.components.get(connection.sourceComponentId);
    const targetComponent = this.components.get(connection.targetComponentId);

    // Feature: 008-lfo-parameter-depth (T012)
    // For CV connections with parameter-aware depth, handle scaling node cleanup first
    const isCVConnection = connection.signalType === SignalType.CV;
    const hasScalingNode = isCVConnection && modulationConnectionManager.getScalingNode(connectionId);

    if (hasScalingNode) {
      // Remove scaling GainNode - this handles all audio disconnections
      modulationConnectionManager.removeScalingNode(connectionId);

      // Notify ModulationVisualizer
      eventBus.emit(EventType.CONNECTION_REMOVED, connectionId);
    } else {
      // Standard disconnection for non-CV or CV connections without scaling nodes
      if (
        sourceComponent?.synthComponent &&
        targetComponent?.synthComponent
      ) {
        try {
          sourceComponent.synthComponent.disconnectFrom(
            targetComponent.synthComponent,
            connection.sourcePortId,
            connection.targetPortId
          );
        } catch (error) {
          console.error('Failed to disconnect audio nodes:', error);
        }
      }

      // Notify for other CV connections (e.g., old-style direct CV)
      if (isCVConnection) {
        eventBus.emit(EventType.CONNECTION_REMOVED, connectionId);
      }
    }

    // Remove connections
    this.connections.delete(connectionId);
    this.visualConnections.delete(connectionId);

    console.log('🔌 Connection removed:', connectionId);

    return true;
  }

  /**
   * Get connection at a specific position (for click detection)
   */
  getConnectionAt(x: number, y: number): string | null {
    for (const [id, visualConn] of this.visualConnections.entries()) {
      if (visualConn.containsPoint(x, y)) {
        return id;
      }
    }
    return null;
  }

  /**
   * Update visual connection positions (called when components move)
   */
  updateConnectionPositions(componentId: string): void {
    const component = this.components.get(componentId);
    if (!component) return;

    // Update all connections involving this component
    for (const [id, connection] of this.connections.entries()) {
      const visualConnection = this.visualConnections.get(id);
      if (!visualConnection) continue;

      // Update source position
      if (connection.sourceComponentId === componentId) {
        const sourcePos = component.getPortPosition(
          connection.sourcePortId,
          false
        );
        if (sourcePos) {
          visualConnection.updateSource(sourcePos);
        }
      }

      // Update target position
      if (connection.targetComponentId === componentId) {
        const targetPos = component.getPortPosition(
          connection.targetPortId,
          true
        );
        if (targetPos) {
          visualConnection.updateTarget(targetPos);
        }
      }
    }
  }

  /**
   * Render all connections
   */
  render(ctx: CanvasRenderingContext2D): void {
    for (const visualConnection of this.visualConnections.values()) {
      visualConnection.render(ctx);
    }
  }

  /**
   * Get all connections
   */
  getConnections(): Connection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Clear all connections
   */
  clear(): void {
    // Disconnect all audio nodes first
    for (const connection of this.connections.values()) {
      const sourceComponent = this.components.get(connection.sourceComponentId);
      const targetComponent = this.components.get(connection.targetComponentId);

      if (sourceComponent?.synthComponent && targetComponent?.synthComponent) {
        try {
          sourceComponent.synthComponent.disconnectFrom(
            targetComponent.synthComponent
          );
        } catch (error) {
          console.error('Failed to disconnect audio nodes:', error);
        }
      }
    }

    this.connections.clear();
    this.visualConnections.clear();
  }

  /**
   * Get connection count
   */
  getCount(): number {
    return this.connections.size;
  }

  /**
   * Serialize all connections for patch save
   */
  serialize(): any[] {
    return Array.from(this.connections.values()).map((conn) =>
      conn.serialize()
    );
  }

  /**
   * Deserialize connections from patch data
   */
  deserialize(data: any[]): void {
    this.clear();

    for (const connData of data) {
      const connection = Connection.deserialize(connData);

      // Recreate connection
      this.createConnection(
        connection.sourceComponentId,
        connection.sourcePortId,
        connection.targetComponentId,
        connection.targetPortId
      );
    }
  }
}
