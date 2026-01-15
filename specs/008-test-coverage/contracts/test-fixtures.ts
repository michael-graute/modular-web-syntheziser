/**
 * Test Fixture Contracts
 *
 * TypeScript interfaces for test data factories.
 * Based on data-model.md fixture schemas.
 *
 * Feature: 008-test-coverage
 * Date: 2026-01-12
 */

import type { SynthComponent, Patch, Connection, Position, ComponentType } from '../../../src/types';

/**
 * Factory function signature for creating test components
 */
export type ComponentFixtureFactory<T extends SynthComponent = SynthComponent> = (
  overrides?: Partial<T>
) => T;

/**
 * Factory function signature for creating test patches
 */
export type PatchFixtureFactory = (
  overrides?: Partial<Patch>
) => Patch;

/**
 * Configuration for component fixtures with default values
 */
export interface ComponentFixtureConfig {
  type: ComponentType;
  defaultPosition: Position;
  defaultParameters: Record<string, any>;
  inputs: string[];
  outputs: string[];
}

/**
 * Configuration for patch fixtures
 */
export interface PatchFixtureConfig {
  name: string;
  componentCount: number;
  connectionCount: number;
  description: string;
}

/**
 * Test fixture catalog - registry of all available fixtures
 */
export interface FixtureCatalog {
  // Component fixtures
  components: {
    oscillator: ComponentFixtureFactory;
    filter: ComponentFixtureFactory;
    envelope: ComponentFixtureFactory;
    lfo: ComponentFixtureFactory;
    vca: ComponentFixtureFactory;
    output: ComponentFixtureFactory;
    keyboard: ComponentFixtureFactory;
    sequencer: ComponentFixtureFactory;
  };

  // Patch fixtures
  patches: {
    empty: PatchFixtureFactory;
    simple: PatchFixtureFactory;
    complex: PatchFixtureFactory;
    subtractive: PatchFixtureFactory;
    fm: PatchFixtureFactory;
  };

  // Connection fixtures
  connections: {
    create: (fromId: string, toId: string, fromPort?: number, toPort?: number) => Connection;
  };
}

/**
 * Metadata about a test fixture
 */
export interface FixtureMetadata {
  name: string;
  type: 'component' | 'patch' | 'connection';
  description: string;
  defaultValues: Record<string, any>;
}
