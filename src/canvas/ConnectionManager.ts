/**
 * ConnectionManager - Manages visual and audio connections between components
 */

import { Connection } from '../core/Connection';
import { CanvasConnection } from './Connection';
import { CanvasComponent } from './CanvasComponent';
import { eventBus } from '../core/EventBus';
import { EventType, SignalType } from '../core/types';

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
    try {
      sourceComponent.synthComponent.connectTo(
        targetComponent.synthComponent,
        sourcePortId,
        targetPortId
      );
    } catch (error) {
      console.error('Failed to connect audio nodes:', error);
      // Clean up on failure
      this.connections.delete(connectionId);
      this.visualConnections.delete(connectionId);
      return { success: false, error: 'Failed to connect audio nodes' };
    }

    console.log(
      `✅ Connected ${sourceComponent.type}:${sourcePort.name} -> ${targetComponent.type}:${targetPort.name}`
    );

    // Notify ModulationVisualizer about CV connections for realtime visualization
    if (sourcePort.type === SignalType.CV) {
      eventBus.emit(EventType.CONNECTION_ADDED, {
        connection,
        sourceComponent: sourceComponent.synthComponent,
        targetComponent: targetComponent.synthComponent,
      });
    }

    return { success: true, connectionId };
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

    // Disconnect audio nodes with specific port IDs
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

    // Notify ModulationVisualizer about CV connection removal
    if (connection.signalType === SignalType.CV) {
      eventBus.emit(EventType.CONNECTION_REMOVED, connectionId);
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
