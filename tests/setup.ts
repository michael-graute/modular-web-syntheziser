/**
 * Global Test Setup
 *
 * This file runs before all tests and sets up global mocks and configurations.
 * Based on research.md BP-001 recommendations.
 */

import { beforeEach, afterEach, vi } from 'vitest';
import { MockAudioContext } from './mocks/WebAudioAPI.mock';
import { MockLocalStorage } from './mocks/LocalStorage.mock';

// Global mocks setup
beforeEach(() => {
  // Mock Web Audio API
  // @ts-expect-error - Mocking global AudioContext
  global.AudioContext = MockAudioContext;

  // Mock localStorage
  // @ts-expect-error - Mocking global localStorage
  global.localStorage = new MockLocalStorage();

  // Mock performance.now() for consistent timing
  vi.spyOn(performance, 'now').mockReturnValue(0);
});

afterEach(() => {
  // Clear all mocks between tests
  vi.clearAllMocks();

  // Reset localStorage
  if (global.localStorage && 'clear' in global.localStorage) {
    global.localStorage.clear();
  }
});
