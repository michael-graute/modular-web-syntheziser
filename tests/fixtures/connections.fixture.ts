/**
 * Connection Test Fixtures
 *
 * Factory functions for creating test connection data.
 * Based on data-model.md fixture schemas
 */

import { Connection, SignalType } from '../../src/core/types';

/**
 * Create test connection between components
 */
export function createTestConnection(
  sourceComponentId: string,
  targetComponentId: string,
  sourcePortId: string = 'output-0',
  targetPortId: string = 'input-0',
  signalType: SignalType = SignalType.AUDIO
): Connection {
  return {
    id: `conn-${Math.random().toString(36).slice(2, 11)}`,
    sourceComponentId,
    sourcePortId,
    targetComponentId,
    targetPortId,
    signalType,
  };
}
