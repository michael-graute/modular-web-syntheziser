/**
 * AudioEngine - Web Audio API management
 * Handles audio context, node creation, and routing
 */

import { eventBus } from './EventBus';
import { stateManager } from './StateManager';
import { EventType } from './types';

/**
 * Audio node wrapper for management
 */
interface ManagedAudioNode {
  id: string;
  node: AudioNode;
  type: string;
  connections: Set<string>;
}

/**
 * AudioEngine class for managing Web Audio API
 */
export class AudioEngine {
  private context: AudioContext | null;
  private nodes: Map<string, ManagedAudioNode>;
  private isInitialized: boolean;

  constructor() {
    this.context = null;
    this.nodes = new Map();
    this.isInitialized = false;
  }

  /**
   * Initialize the audio context
   */
  async init(): Promise<void> {
    if (this.isInitialized) {
      console.warn('AudioEngine already initialized');
      return;
    }

    try {
      // Create AudioContext
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error('Web Audio API not supported');
      }

      this.context = new AudioContextClass();

      // Handle context state changes
      this.setupContextStateHandlers();

      // Resume context if it starts suspended (Chrome's autoplay policy)
      if (this.context.state === 'suspended') {
        console.log('AudioContext suspended. Click anywhere to resume audio.');
      }

      this.isInitialized = true;
      stateManager.setAudioContextState(this.context.state);

      console.log('✅ AudioEngine initialized');
      console.log(`Sample rate: ${this.context.sampleRate}Hz`);
      console.log(`Context state: ${this.context.state}`);
    } catch (error) {
      console.error('Failed to initialize AudioEngine:', error);
      throw error;
    }
  }

  /**
   * Setup handlers for audio context state changes
   */
  private setupContextStateHandlers(): void {
    if (!this.context) return;

    this.context.addEventListener('statechange', () => {
      if (this.context) {
        console.log(`AudioContext state changed: ${this.context.state}`);
        stateManager.setAudioContextState(this.context.state);
      }
    });
  }

  /**
   * Resume audio context (needed for Chrome's autoplay policy)
   */
  async resume(): Promise<void> {
    if (!this.context) {
      throw new Error('AudioContext not initialized');
    }

    if (this.context.state === 'suspended') {
      try {
        await this.context.resume();
        console.log('AudioContext resumed');
      } catch (error) {
        console.error('Failed to resume AudioContext:', error);
        throw error;
      }
    }
  }

  /**
   * Suspend audio context
   */
  async suspend(): Promise<void> {
    if (!this.context) {
      throw new Error('AudioContext not initialized');
    }

    if (this.context.state === 'running') {
      try {
        await this.context.suspend();
        console.log('AudioContext suspended');
      } catch (error) {
        console.error('Failed to suspend AudioContext:', error);
        throw error;
      }
    }
  }

  /**
   * Close audio context
   */
  async close(): Promise<void> {
    if (!this.context) {
      return;
    }

    try {
      // Disconnect all nodes
      this.disconnectAll();

      // Close context
      await this.context.close();
      console.log('AudioContext closed');

      this.context = null;
      this.isInitialized = false;
    } catch (error) {
      console.error('Failed to close AudioContext:', error);
      throw error;
    }
  }

  /**
   * Get the audio context
   */
  getContext(): AudioContext {
    if (!this.context) {
      throw new Error('AudioContext not initialized');
    }
    return this.context;
  }

  /**
   * Get audio context state
   */
  getState(): AudioContextState {
    if (!this.context) {
      return 'closed';
    }
    return this.context.state;
  }

  /**
   * Check if audio engine is initialized
   */
  isReady(): boolean {
    return this.isInitialized && this.context !== null;
  }

  /**
   * Add an audio node to management
   */
  addNode(id: string, node: AudioNode, type: string): void {
    if (this.nodes.has(id)) {
      console.warn(`Node with id ${id} already exists`);
      return;
    }

    this.nodes.set(id, {
      id,
      node,
      type,
      connections: new Set(),
    });

    console.log(`Added audio node: ${id} (${type})`);
  }

  /**
   * Remove an audio node from management
   */
  removeNode(id: string): void {
    const managedNode = this.nodes.get(id);
    if (!managedNode) {
      console.warn(`Node with id ${id} not found`);
      return;
    }

    // Disconnect the node
    this.disconnectNode(id);

    // Remove from map
    this.nodes.delete(id);

    console.log(`Removed audio node: ${id}`);
  }

  /**
   * Get a managed audio node
   */
  getNode(id: string): AudioNode | null {
    const managedNode = this.nodes.get(id);
    return managedNode ? managedNode.node : null;
  }

  /**
   * Connect two audio nodes
   */
  connect(
    sourceId: string,
    targetId: string,
    outputIndex: number = 0,
    inputIndex: number = 0
  ): void {
    const sourceNode = this.nodes.get(sourceId);
    const targetNode = this.nodes.get(targetId);

    if (!sourceNode) {
      throw new Error(`Source node ${sourceId} not found`);
    }

    if (!targetNode) {
      throw new Error(`Target node ${targetId} not found`);
    }

    try {
      // Connect the nodes
      sourceNode.node.connect(targetNode.node, outputIndex, inputIndex);

      // Track the connection
      const connectionKey = `${targetId}:${outputIndex}:${inputIndex}`;
      sourceNode.connections.add(connectionKey);

      console.log(`Connected: ${sourceId} -> ${targetId}`);

      // Emit event
      eventBus.emit(EventType.CONNECTION_ADDED, {
        sourceId,
        targetId,
        outputIndex,
        inputIndex,
      });
    } catch (error) {
      console.error(`Failed to connect ${sourceId} to ${targetId}:`, error);
      throw error;
    }
  }

  /**
   * Connect node to audio context destination
   */
  connectToDestination(sourceId: string, outputIndex: number = 0): void {
    if (!this.context) {
      throw new Error('AudioContext not initialized');
    }

    const sourceNode = this.nodes.get(sourceId);
    if (!sourceNode) {
      throw new Error(`Source node ${sourceId} not found`);
    }

    try {
      sourceNode.node.connect(this.context.destination, outputIndex);
      sourceNode.connections.add('destination');
      console.log(`Connected ${sourceId} to destination`);
    } catch (error) {
      console.error(`Failed to connect ${sourceId} to destination:`, error);
      throw error;
    }
  }

  /**
   * Disconnect a specific connection
   */
  disconnect(
    sourceId: string,
    targetId: string,
    outputIndex: number = 0,
    inputIndex: number = 0
  ): void {
    const sourceNode = this.nodes.get(sourceId);
    const targetNode = this.nodes.get(targetId);

    if (!sourceNode || !targetNode) {
      console.warn(`Cannot disconnect: node not found`);
      return;
    }

    try {
      // Disconnect specific connection
      sourceNode.node.disconnect(targetNode.node, outputIndex, inputIndex);

      // Remove from tracking
      const connectionKey = `${targetId}:${outputIndex}:${inputIndex}`;
      sourceNode.connections.delete(connectionKey);

      console.log(`Disconnected: ${sourceId} -> ${targetId}`);

      // Emit event
      eventBus.emit(EventType.CONNECTION_REMOVED, {
        sourceId,
        targetId,
        outputIndex,
        inputIndex,
      });
    } catch (error) {
      console.error(`Failed to disconnect ${sourceId} from ${targetId}:`, error);
    }
  }

  /**
   * Disconnect all connections from a node
   */
  disconnectNode(id: string): void {
    const managedNode = this.nodes.get(id);
    if (!managedNode) {
      return;
    }

    try {
      managedNode.node.disconnect();
      managedNode.connections.clear();
      console.log(`Disconnected all connections from ${id}`);
    } catch (error) {
      console.error(`Failed to disconnect node ${id}:`, error);
    }
  }

  /**
   * Disconnect all nodes
   */
  disconnectAll(): void {
    this.nodes.forEach((managedNode) => {
      try {
        managedNode.node.disconnect();
        managedNode.connections.clear();
      } catch (error) {
        // Ignore errors when disconnecting
      }
    });
    console.log('Disconnected all audio nodes');
  }

  /**
   * Clear all nodes (used when loading a new patch)
   */
  clearAll(): void {
    this.disconnectAll();
    this.nodes.clear();
    console.log('Cleared all audio nodes');
  }

  /**
   * Get current audio time
   */
  getCurrentTime(): number {
    if (!this.context) {
      return 0;
    }
    return this.context.currentTime;
  }

  /**
   * Get sample rate
   */
  getSampleRate(): number {
    if (!this.context) {
      return 0;
    }
    return this.context.sampleRate;
  }

  /**
   * Get base latency (if available)
   */
  getBaseLatency(): number {
    if (!this.context) {
      return 0;
    }
    return this.context.baseLatency || 0;
  }

  /**
   * Get output latency (if available)
   */
  getOutputLatency(): number {
    if (!this.context) {
      return 0;
    }
    return (this.context as any).outputLatency || 0;
  }

  /**
   * Get total node count
   */
  getNodeCount(): number {
    return this.nodes.size;
  }

  /**
   * Get all node IDs
   */
  getNodeIds(): string[] {
    return Array.from(this.nodes.keys());
  }

  /**
   * Request microphone access (for future audio input features)
   */
  async requestMicrophoneAccess(): Promise<MediaStream> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      console.log('Microphone access granted');
      return stream;
    } catch (error) {
      console.error('Failed to get microphone access:', error);
      throw error;
    }
  }

  /**
   * Create a media stream source from a stream
   */
  createMediaStreamSource(stream: MediaStream): MediaStreamAudioSourceNode {
    if (!this.context) {
      throw new Error('AudioContext not initialized');
    }

    return this.context.createMediaStreamSource(stream);
  }
}

// Export singleton instance
export const audioEngine = new AudioEngine();
