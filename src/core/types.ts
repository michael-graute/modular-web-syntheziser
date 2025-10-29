/**
 * Core TypeScript Type Definitions
 * Modular Synthesizer Application
 */

/**
 * Signal types for audio routing
 */
export enum SignalType {
  AUDIO = 'audio',
  CV = 'cv',
  GATE = 'gate',
}

/**
 * Component types
 */
export enum ComponentType {
  OSCILLATOR = 'oscillator',
  LFO = 'lfo',
  NOISE = 'noise',
  FILTER = 'filter',
  VCA = 'vca',
  ADSR_ENVELOPE = 'adsr-envelope',
  FILTER_ENVELOPE = 'filter-envelope',
  DELAY = 'delay',
  REVERB = 'reverb',
  DISTORTION = 'distortion',
  CHORUS = 'chorus',
  MIXER = 'mixer',
  KEYBOARD_INPUT = 'keyboard-input',
  MASTER_OUTPUT = 'master-output',
  OSCILLOSCOPE = 'oscilloscope',
  STEP_SEQUENCER = 'step-sequencer',
}

/**
 * Position on canvas
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * Component port definition
 */
export interface Port {
  id: string;
  name: string;
  type: SignalType;
  isInput: boolean;
}

/**
 * Parameter definition for components
 */
export interface Parameter {
  id: string;
  name: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
}

/**
 * Connection between components
 */
export interface Connection {
  id: string;
  sourceComponentId: string;
  sourcePortId: string;
  targetComponentId: string;
  targetPortId: string;
  signalType: SignalType;
}

/**
 * Base component data
 */
export interface ComponentData {
  id: string;
  type: ComponentType;
  position: Position;
  parameters: Record<string, number>;
  isBypassed?: boolean;
}

/**
 * Patch data structure for save/load
 */
export interface PatchData {
  name: string;
  version: string;
  created: string;
  modified: string;
  components: ComponentData[];
  connections: Connection[];
}

/**
 * Application state
 */
export interface AppState {
  currentPatch: PatchData | null;
  selectedComponentIds: string[];
  isDirty: boolean;
  audioContextState: AudioContextState;
  viewport: ViewportState;
}

/**
 * Viewport state for canvas
 */
export interface ViewportState {
  zoom: number;
  panX: number;
  panY: number;
}

/**
 * Event types for EventBus
 */
export enum EventType {
  COMPONENT_ADD_REQUESTED = 'component:add-requested',
  COMPONENT_ADDED = 'component:added',
  COMPONENT_REMOVED = 'component:removed',
  COMPONENT_MOVED = 'component:moved',
  COMPONENT_SELECTED = 'component:selected',
  COMPONENT_DESELECTED = 'component:deselected',
  CONTROLS_RECREATED = 'controls:recreated',
  PARAMETER_CHANGED = 'parameter:changed',
  CONNECTION_ADDED = 'connection:added',
  CONNECTION_REMOVED = 'connection:removed',
  PATCH_LOADED = 'patch:loaded',
  PATCH_SAVED = 'patch:saved',
  PATCH_CLEARED = 'patch:cleared',
  VIEWPORT_CHANGED = 'viewport:changed',
  NOTE_ON = 'note:on',
  NOTE_OFF = 'note:off',
}

/**
 * Event payload types
 */
export interface ComponentEvent {
  componentId: string;
  componentType?: ComponentType;
  position?: Position;
}

export interface ParameterEvent {
  componentId: string;
  parameterId: string;
  value: number;
}

export interface ConnectionEvent {
  connectionId: string;
  connection?: Connection;
}

export interface NoteEvent {
  frequency: number;
  velocity: number;
}

export interface ViewportEvent {
  zoom: number;
  panX: number;
  panY: number;
}

/**
 * Keyboard note mapping
 */
export interface KeyboardMapping {
  key: string;
  noteOffset: number;
}

/**
 * Voice state for polyphony
 */
export interface Voice {
  id: string;
  frequency: number;
  isActive: boolean;
  componentIds: string[];
}
