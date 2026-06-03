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
  COLLIDER = 'collider',
  CHORD_FINDER = 'chord-finder',
  LOOPER = 'looper',
  BITCRUSHER = 'bitcrusher',
  FLANGER = 'flanger',
  PHASER = 'phaser',
  TREMOLO = 'tremolo',
  FM_OSCILLATOR = 'fm-oscillator',
  QUANTIZER = 'quantizer',
  PARAMETRIC_EQ = 'parametric-eq',
  VU_METER = 'vu-meter',
  RING_MODULATOR = 'ring-modulator',
  ARPEGGIATOR = 'arpeggiator',
  ENVELOPE_FOLLOWER = 'envelope-follower',
  SLEW_LIMITER = 'slew-limiter',
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
  audioBlob?: string; // Base64-encoded Float32 PCM — used by Looper; ignored by all other components
}

/**
 * Patch data structure for save/load
 */
export interface PatchData {
  name: string;
  version: string;
  created: string;
  modified: string;
  description?: string; // Optional description for factory patches
  globalBpm?: number; // Global BPM value; absent in legacy patches (defaults to 120 on load)
  midiMappings?: MidiMapping[]; // CC-to-parameter bindings; absent in legacy patches (treated as [])
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
  GLOBAL_BPM_CHANGED = 'global:bpm-changed',
  CHORD_NOTES_ON = 'chord:notes-on',
  CHORD_NOTES_OFF = 'chord:notes-off',
  LOOPER_KEY_RECORD = 'looper:key-record',
  LOOPER_KEY_STOP = 'looper:key-stop',
  LOOPER_KEY_CLEAR = 'looper:key-clear',
  TRANSPORT_PLAY = 'transport:play',
  TRANSPORT_STOP = 'transport:stop',
  TRANSPORT_BEAT = 'transport:beat',
  COMPONENT_LONG_PRESS = 'component:long-press',
  MIDI_DEVICE_CONNECTED = 'midi:device-connected',
  MIDI_DEVICE_DISCONNECTED = 'midi:device-disconnected',
  MIDI_LEARN_STARTED = 'midi:learn-started',
  MIDI_LEARN_COMPLETED = 'midi:learn-completed',
  MIDI_LEARN_CANCELLED = 'midi:learn-cancelled',
  MIDI_MAPPINGS_CHANGED = 'midi:mappings-changed',
  MIDI_MESSAGE_RECEIVED = 'midi:message-received',
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
 * Payload emitted with GLOBAL_BPM_CHANGED event
 */
export interface GlobalBpmChangedPayload {
  bpm: number;
}

/**
 * Payload emitted with CHORD_NOTES_ON event.
 * Carries the three octave-shifted MIDI note numbers of the pressed chord
 * and the ID of the ChordFinder that emitted the event.
 */
export interface ChordNotesOnPayload {
  notes: [number, number, number];
  sourceId: string;
}

/**
 * Payload emitted with CHORD_NOTES_OFF event.
 * Mirrors ChordNotesOnPayload — carries the same notes that were pressed.
 */
export interface ChordNotesOffPayload {
  notes: [number, number, number];
  sourceId: string;
}

/**
 * Payload emitted with TRANSPORT_BEAT event.
 */
export interface TransportBeatPayload {
  bar: number;
  beat: number;
}

/**
 * Interface that tempo-aware components must satisfy to integrate
 * with the GlobalBpmController subscription mechanism.
 */
export interface TempoAware {
  /** Subscribe to global BPM changes. Called during component activation. */
  subscribeToGlobalBpm(): void;

  /** Unsubscribe from global BPM changes. Called during component deactivation. */
  unsubscribeFromGlobalBpm(): void;

  /**
   * Apply a new BPM value. Only called when component is in Global mode.
   * Takes effect at the component's next natural timing boundary.
   */
  applyGlobalBpm(bpm: number): void;
}

/**
 * Persistent CC-to-parameter binding stored inside PatchData.
 * Uniquely identified by (componentId, parameterName).
 */
export interface MidiMapping {
  componentId: string;
  parameterName: string;
  /** MIDI channel 0–15; 0 means omni (accept on any channel) */
  channel: number;
  /** CC number 0–127 */
  cc: number;
  /** Parameter's minimum value — used for linear scaling */
  minValue: number;
  /** Parameter's maximum value — used for linear scaling */
  maxValue: number;
}

/**
 * Payload emitted with MIDI_MESSAGE_RECEIVED event.
 * Carries the raw bytes of every incoming MIDI message before any routing.
 */
export interface MidiRawMessagePayload {
  status: number;
  byte1: number;
  byte2: number;
  timestamp: number;
}

/**
 * Transient state held during a MIDI Learn session.
 * Never serialised; discarded on page reload or cancel.
 */
export interface MidiLearnSession {
  componentId: string;
  parameterName: string;
}

/**
 * Runtime representation of a connected MIDI input device.
 * Not persisted in PatchData.
 */
export interface MidiDeviceInfo {
  id: string;
  name: string;
  connected: boolean;
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

/**
 * Patch category discriminator for UI
 */
export type PatchCategory = 'user' | 'factory';

/**
 * Factory patch metadata wrapper
 */
export interface FactoryPatchMetadata {
  filename: string;
  source: 'factory';
  patch: PatchData;
  loadedAt: Date;
}
