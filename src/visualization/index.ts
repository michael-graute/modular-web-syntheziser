/**
 * Visualization Module
 * Exports all visualization components for realtime CV parameter visualization
 */

// Main orchestrator
export { ModulationVisualizer } from './ModulationVisualizer';

// Core components
export { ParameterValueSampler } from './ParameterValueSampler';
export { VisualUpdateScheduler } from './VisualUpdateScheduler';

// Types and interfaces
export type {
  IModulationVisualizer,
  IParameterValueSampler,
  IVisualUpdateScheduler,
  IVisualizableControl,
  VisualizationConfig,
  VisualizationHandle,
  ModulationState,
  Connection,
  SubscriptionHandle,
} from './types';

// Enums
export { ModulationEventType } from './types';
