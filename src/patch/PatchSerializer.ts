/**
 * PatchSerializer - Serializes and deserializes patches to/from JSON
 */

import { PatchData, ComponentData, Connection as ConnectionType } from '../core/types';
import type { SynthComponent } from '../components/base/SynthComponent';
import type { Connection } from '../core/Connection';

/**
 * Serializes patch data to JSON format
 */
export class PatchSerializer {
  /**
   * Serialize a complete patch to JSON
   */
  static serializePatch(
    name: string,
    components: SynthComponent[],
    connections: Connection[]
  ): PatchData {
    const now = new Date().toISOString();

    // Serialize all components
    const componentData: ComponentData[] = components.map((component) =>
      component.serialize()
    );

    // Serialize all connections
    const connectionData: ConnectionType[] = connections.map((connection) =>
      connection.serialize()
    );

    return {
      name,
      version: '1.0',
      created: now,
      modified: now,
      components: componentData,
      connections: connectionData,
    };
  }

  /**
   * Update an existing patch's modified timestamp
   */
  static updatePatchTimestamp(patch: PatchData): PatchData {
    return {
      ...patch,
      modified: new Date().toISOString(),
    };
  }

  /**
   * Serialize patch to JSON string
   */
  static toJSON(patchData: PatchData): string {
    return JSON.stringify(patchData, null, 2);
  }

  /**
   * Deserialize patch from JSON string
   */
  static fromJSON(jsonString: string): PatchData {
    try {
      const data = JSON.parse(jsonString);
      return PatchSerializer.validatePatchData(data);
    } catch (error) {
      throw new Error(`Failed to parse patch JSON: ${error}`);
    }
  }

  /**
   * Validate and normalize patch data structure
   */
  static validatePatchData(data: any): PatchData {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid patch data: must be an object');
    }

    if (typeof data.name !== 'string' || data.name.length === 0) {
      throw new Error('Invalid patch data: name is required');
    }

    if (!Array.isArray(data.components)) {
      throw new Error('Invalid patch data: components must be an array');
    }

    if (!Array.isArray(data.connections)) {
      throw new Error('Invalid patch data: connections must be an array');
    }

    // Validate each component
    for (const component of data.components) {
      if (!component.id || !component.type || !component.position) {
        throw new Error('Invalid component data: missing required fields');
      }

      if (
        typeof component.position.x !== 'number' ||
        typeof component.position.y !== 'number'
      ) {
        throw new Error('Invalid component data: position must have x and y numbers');
      }

      if (!component.parameters || typeof component.parameters !== 'object') {
        throw new Error('Invalid component data: parameters must be an object');
      }
    }

    // Validate each connection
    for (const connection of data.connections) {
      if (
        !connection.id ||
        !connection.sourceComponentId ||
        !connection.sourcePortId ||
        !connection.targetComponentId ||
        !connection.targetPortId ||
        !connection.signalType
      ) {
        throw new Error('Invalid connection data: missing required fields');
      }
    }

    // Return validated patch data
    return {
      name: data.name,
      version: data.version || '1.0',
      created: data.created || new Date().toISOString(),
      modified: data.modified || new Date().toISOString(),
      components: data.components,
      connections: data.connections,
    };
  }

  /**
   * Create an empty patch
   */
  static createEmptyPatch(name: string = 'Untitled'): PatchData {
    const now = new Date().toISOString();
    return {
      name,
      version: '1.0',
      created: now,
      modified: now,
      components: [],
      connections: [],
    };
  }

  /**
   * Clone a patch with a new name
   */
  static clonePatch(patch: PatchData, newName: string): PatchData {
    const now = new Date().toISOString();
    return {
      ...patch,
      name: newName,
      created: now,
      modified: now,
      // Deep clone components and connections
      components: JSON.parse(JSON.stringify(patch.components)),
      connections: JSON.parse(JSON.stringify(patch.connections)),
    };
  }

  /**
   * Get patch metadata without full component/connection data
   */
  static getPatchMetadata(patch: PatchData): {
    name: string;
    version: string;
    created: string;
    modified: string;
    componentCount: number;
    connectionCount: number;
  } {
    return {
      name: patch.name,
      version: patch.version,
      created: patch.created,
      modified: patch.modified,
      componentCount: patch.components.length,
      connectionCount: patch.connections.length,
    };
  }

  /**
   * Compare two patches for equality
   */
  static patchesEqual(patch1: PatchData, patch2: PatchData): boolean {
    // Compare excluding timestamps
    return (
      patch1.name === patch2.name &&
      patch1.components.length === patch2.components.length &&
      patch1.connections.length === patch2.connections.length &&
      JSON.stringify(patch1.components) === JSON.stringify(patch2.components) &&
      JSON.stringify(patch1.connections) === JSON.stringify(patch2.connections)
    );
  }
}
