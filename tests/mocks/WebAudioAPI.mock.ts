/**
 * Web Audio API Mocks
 *
 * Manual TypeScript mocks for Web Audio API to enable testing without browser.
 * Based on research.md RT-001 decision: Use manual mocks (lightweight, type-safe)
 */

/**
 * Mock AudioParam for parameter automation
 */
export class MockAudioParam implements Partial<AudioParam> {
  private _value: number;
  defaultValue: number;
  minValue: number;
  maxValue: number;
  private scheduledValues: Array<{ value: number; time: number }> = [];

  constructor(defaultValue: number = 0, minValue: number = -3.4028235e38, maxValue: number = 3.4028235e38) {
    this._value = defaultValue;
    this.defaultValue = defaultValue;
    this.minValue = minValue;
    this.maxValue = maxValue;
  }

  get value(): number {
    return this._value;
  }

  set value(val: number) {
    this._value = val;
  }

  setValueAtTime(value: number, startTime: number): this {
    this._value = value;
    this.scheduledValues.push({ value, time: startTime });
    return this;
  }

  linearRampToValueAtTime(value: number, endTime: number): this {
    this._value = value;
    this.scheduledValues.push({ value, time: endTime });
    return this;
  }

  exponentialRampToValueAtTime(value: number, endTime: number): this {
    this._value = value;
    this.scheduledValues.push({ value, time: endTime });
    return this;
  }

  setTargetAtTime(target: number, startTime: number, timeConstant: number): this {
    this._value = target;
    return this;
  }

  setValueCurveAtTime(values: number[] | Float32Array, startTime: number, duration: number): this {
    if (values.length > 0) {
      this._value = values[values.length - 1];
    }
    return this;
  }

  cancelScheduledValues(cancelTime: number): this {
    this.scheduledValues = this.scheduledValues.filter(sv => sv.time < cancelTime);
    return this;
  }

  cancelAndHoldAtTime(cancelTime: number): this {
    return this.cancelScheduledValues(cancelTime);
  }

  // Test utility
  getScheduledValues(): Array<{ value: number; time: number }> {
    return [...this.scheduledValues];
  }
}

/**
 * Mock AudioNode base class
 */
export class MockAudioNode implements Partial<AudioNode> {
  id: string;
  context: any; // MockAudioContext
  connections: AudioNode[] = [];
  numberOfInputs: number;
  numberOfOutputs: number;
  channelCount: number = 2;
  channelCountMode: ChannelCountMode = 'max';
  channelInterpretation: ChannelInterpretation = 'speakers';

  constructor(numberOfInputs: number = 1, numberOfOutputs: number = 1) {
    this.id = Math.random().toString(36).substring(2, 15);
    this.numberOfInputs = numberOfInputs;
    this.numberOfOutputs = numberOfOutputs;
  }

  connect(destination: AudioNode, outputIndex?: number, inputIndex?: number): AudioNode {
    this.connections.push(destination);
    return destination;
  }

  disconnect(): void;
  disconnect(output: number): void;
  disconnect(destinationNode: AudioNode): void;
  disconnect(destinationNode: AudioNode, output: number): void;
  disconnect(destinationNode: AudioNode, output: number, input: number): void;
  disconnect(destinationOrOutput?: AudioNode | number, output?: number, input?: number): void {
    if (destinationOrOutput === undefined) {
      this.connections = [];
    } else if (typeof destinationOrOutput === 'object') {
      this.connections = this.connections.filter(conn => conn !== destinationOrOutput);
    }
  }

  // Test utilities
  getConnections(): AudioNode[] {
    return [...this.connections];
  }

  isConnectedTo(node: AudioNode): boolean {
    return this.connections.includes(node);
  }
}

/**
 * Mock OscillatorNode
 */
export class MockOscillatorNode extends MockAudioNode implements Partial<OscillatorNode> {
  type: OscillatorType = 'sine';
  frequency: MockAudioParam;
  detune: MockAudioParam;
  isStarted: boolean = false;
  isStopped: boolean = false;

  constructor() {
    super(0, 1);
    this.frequency = new MockAudioParam(440, -22050, 22050);
    this.detune = new MockAudioParam(0, -153600, 153600);
  }

  start(when: number = 0): void {
    this.isStarted = true;
  }

  stop(when: number = 0): void {
    this.isStopped = true;
  }

  setPeriodicWave(periodicWave: PeriodicWave): void {
    // Mock implementation
  }
}

/**
 * Mock GainNode
 */
export class MockGainNode extends MockAudioNode implements Partial<GainNode> {
  gain: MockAudioParam;

  constructor() {
    super(1, 1);
    this.gain = new MockAudioParam(1, -3.4028235e38, 3.4028235e38);
  }
}

/**
 * Mock BiquadFilterNode
 */
export class MockBiquadFilterNode extends MockAudioNode implements Partial<BiquadFilterNode> {
  type: BiquadFilterType = 'lowpass';
  frequency: MockAudioParam;
  Q: MockAudioParam;
  gain: MockAudioParam;
  detune: MockAudioParam;

  constructor() {
    super(1, 1);
    this.frequency = new MockAudioParam(350, 10, 22050);
    this.Q = new MockAudioParam(1, 0.0001, 1000);
    this.gain = new MockAudioParam(0, -40, 40);
    this.detune = new MockAudioParam(0, -153600, 153600);
  }

  getFrequencyResponse(frequencyHz: Float32Array, magResponse: Float32Array, phaseResponse: Float32Array): void {
    // Mock implementation
  }
}

/**
 * Mock AnalyserNode
 */
export class MockAnalyserNode extends MockAudioNode implements Partial<AnalyserNode> {
  fftSize: number = 2048;
  frequencyBinCount: number = 1024;
  minDecibels: number = -100;
  maxDecibels: number = -30;
  smoothingTimeConstant: number = 0.8;

  constructor() {
    super(1, 1);
  }

  getByteTimeDomainData(array: Uint8Array): void {
    // Fill with mock data (centered around 128)
    for (let i = 0; i < array.length; i++) {
      array[i] = 128;
    }
  }

  getByteFrequencyData(array: Uint8Array): void {
    // Fill with mock data (zeros)
    for (let i = 0; i < array.length; i++) {
      array[i] = 0;
    }
  }

  getFloatTimeDomainData(array: Float32Array): void {
    // Fill with mock data (zeros)
    for (let i = 0; i < array.length; i++) {
      array[i] = 0;
    }
  }

  getFloatFrequencyData(array: Float32Array): void {
    // Fill with mock data (minimum decibels)
    for (let i = 0; i < array.length; i++) {
      array[i] = this.minDecibels;
    }
  }
}

/**
 * Mock AudioDestinationNode
 */
export class MockAudioDestinationNode extends MockAudioNode implements Partial<AudioDestinationNode> {
  maxChannelCount: number = 2;

  constructor() {
    super(1, 0);
  }
}

/**
 * Mock ConstantSourceNode
 */
export class MockConstantSourceNode extends MockAudioNode implements Partial<ConstantSourceNode> {
  offset: MockAudioParam;
  isStarted: boolean = false;
  isStopped: boolean = false;

  constructor() {
    super(0, 1);
    this.offset = new MockAudioParam(1);
  }

  start(when: number = 0): void {
    this.isStarted = true;
  }

  stop(when: number = 0): void {
    this.isStopped = true;
  }
}

/**
 * Mock AudioContext
 */
export class MockAudioContext implements Partial<BaseAudioContext> {
  state: AudioContextState = 'suspended';
  sampleRate: number = 44100;
  currentTime: number = 0;
  destination: MockAudioDestinationNode;
  baseLatency: number = 0.01;
  private nodes: Map<string, AudioNode> = new Map();
  private eventListeners: Map<string, Function[]> = new Map();

  constructor() {
    this.destination = new MockAudioDestinationNode();
    this.destination.context = this;
  }

  addEventListener(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  removeEventListener(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private dispatchEvent(event: string): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => listener());
    }
  }

  createOscillator(): OscillatorNode {
    const node = new MockOscillatorNode();
    node.context = this;
    this.nodes.set(node.id, node as any);
    return node as any;
  }

  createGain(): GainNode {
    const node = new MockGainNode();
    node.context = this;
    this.nodes.set(node.id, node as any);
    return node as any;
  }

  createBiquadFilter(): BiquadFilterNode {
    const node = new MockBiquadFilterNode();
    node.context = this;
    this.nodes.set(node.id, node as any);
    return node as any;
  }

  createAnalyser(): AnalyserNode {
    const node = new MockAnalyserNode();
    node.context = this;
    this.nodes.set(node.id, node as any);
    return node as any;
  }

  createConstantSource(): ConstantSourceNode {
    const node = new MockConstantSourceNode();
    node.context = this;
    this.nodes.set(node.id, node as any);
    return node as any;
  }

  async resume(): Promise<void> {
    this.state = 'running';
    this.dispatchEvent('statechange');
  }

  async suspend(): Promise<void> {
    this.state = 'suspended';
    this.dispatchEvent('statechange');
  }

  async close(): Promise<void> {
    this.state = 'closed';
    this.dispatchEvent('statechange');
  }

  // Test utilities
  getConnectedNodes(): AudioNode[] {
    return Array.from(this.nodes.values());
  }

  reset(): void {
    this.nodes.clear();
    this.state = 'suspended';
    this.currentTime = 0;
  }
}
