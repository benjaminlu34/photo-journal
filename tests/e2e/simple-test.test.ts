/**
 * Simple test to verify E2E test setup
 */

import { describe, it, expect } from 'vitest';

describe('Simple E2E Test', () => {
  it('should run basic test', () => {
    expect(1 + 1).toBe(2);
  });
});