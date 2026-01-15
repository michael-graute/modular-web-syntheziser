/**
 * Mock Object Contracts
 *
 * TypeScript interfaces for Web Audio API, localStorage, and DOM mocks.
 * Based on data-model.md mock object schemas.
 *
 * Feature: 008-test-coverage
 * Date: 2026-01-12
 */

/**
 * Mock AudioContext for testing audio engine without browser
 */
export interface MockAudioContext extends Partial<BaseAudioContext> {
  state: AudioContextState;
  sampleRate: number;
  currentTime: number;
  destination: AudioDestinationNode;

  createOscillator(): OscillatorNode;
  createGain(): GainNode;
  createBiquadFilter(): BiquadFilterNode;
  createAnalyser(): AnalyserNode;

  resume(): Promise<void>;
  suspend(): Promise<void>;
  close(): Promise<void>;

  // Test utilities
  getConnectedNodes(): AudioNode[];
  reset(): void;
}

/**
 * Base mock audio node with connection tracking
 */
export interface MockAudioNode extends Partial<AudioNode> {
  id: string;
  context: AudioContext;
  connections: AudioNode[];
  numberOfInputs: number;
  numberOfOutputs: number;

  connect(destination: AudioNode, outputIndex?: number, inputIndex?: number): AudioNode;
  disconnect(): void;

  // Test utilities
  getConnections(): AudioNode[];
  isConnectedTo(node: AudioNode): boolean;
}

/**
 * Mock oscillator node with frequency/detune parameters
 */
export interface MockOscillatorNode extends MockAudioNode, Partial<OscillatorNode> {
  type: OscillatorType;
  frequency: MockAudioParam;
  detune: MockAudioParam;

  start(when?: number): void;
  stop(when?: number): void;

  // Test utilities
  isStarted: boolean;
  isStopped: boolean;
}

/**
 * Mock gain node with gain parameter
 */
export interface MockGainNode extends MockAudioNode, Partial<GainNode> {
  gain: MockAudioParam;
}

/**
 * Mock biquad filter node with frequency/Q/gain parameters
 */
export interface MockBiquadFilterNode extends MockAudioNode, Partial<BiquadFilterNode> {
  type: BiquadFilterType;
  frequency: MockAudioParam;
  Q: MockAudioParam;
  gain: MockAudioParam;
}

/**
 * Mock analyser node for audio analysis
 */
export interface MockAnalyserNode extends MockAudioNode, Partial<AnalyserNode> {
  fftSize: number;
  frequencyBinCount: number;

  getByteTimeDomainData(array: Uint8Array): void;
  getByteFrequencyData(array: Uint8Array): void;
}

/**
 * Mock AudioParam with value automation
 */
export interface MockAudioParam extends Partial<AudioParam> {
  value: number;
  defaultValue: number;
  minValue: number;
  maxValue: number;

  setValueAtTime(value: number, startTime: number): MockAudioParam;
  linearRampToValueAtTime(value: number, endTime: number): MockAudioParam;
  exponentialRampToValueAtTime(value: number, endTime: number): MockAudioParam;

  // Test utilities
  getScheduledValues(): Array<{ value: number; time: number }>;
}

/**
 * Mock localStorage for testing without browser persistence
 */
export interface MockLocalStorage extends Storage {
  readonly length: number;

  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
  key(index: number): string | null;

  // Test utilities
  getAllKeys(): string[];
  getAllValues(): Record<string, string>;
}

/**
 * Configuration for mouse event creation
 */
export interface MouseEventConfig {
  clientX: number;
  clientY: number;
  button?: number; // 0=left, 1=middle, 2=right
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
}

/**
 * Configuration for touch point
 */
export interface TouchConfig {
  identifier: number;
  clientX: number;
  clientY: number;
  pageX?: number;
  pageY?: number;
  screenX?: number;
  screenY?: number;
}

/**
 * Factory function for creating mouse events
 */
export type MouseEventFactory = (
  type: 'mousedown' | 'mousemove' | 'mouseup' | 'click' | 'dblclick',
  config: MouseEventConfig
) => MouseEvent;

/**
 * Factory function for creating touch events
 */
export type TouchEventFactory = (
  type: 'touchstart' | 'touchmove' | 'touchend' | 'touchcancel',
  touches: TouchConfig[]
) => TouchEvent;

/**
 * Mock registry - central access to all mocks
 */
export interface MockRegistry {
  audio: {
    createContext: () => MockAudioContext;
    createOscillator: () => MockOscillatorNode;
    createGain: () => MockGainNode;
    createFilter: () => MockBiquadFilterNode;
    createAnalyser: () => MockAnalyserNode;
    createParam: (defaultValue: number) => MockAudioParam;
  };

  storage: {
    createLocalStorage: () => MockLocalStorage;
  };

  events: {
    createMouseEvent: MouseEventFactory;
    createTouchEvent: TouchEventFactory;
  };
}

/**
 * Test utilities for working with mocks
 */
export interface MockTestUtilities {
  /**
   * Reset all mocks to initial state
   */
  resetAllMocks(): void;

  /**
   * Verify mock was called with expected arguments
   */
  verifyMockCall(mock: any, expectedArgs: any[]): boolean;

  /**
   * Get call count for a mock
   */
  getMockCallCount(mock: any): number;
}
