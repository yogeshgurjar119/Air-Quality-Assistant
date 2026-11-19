import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { categorizeAqi, severity } from '../server/services/aqi.js';

describe('categorizeAqi', () => {
  it('maps values to EPA bands at their boundaries', () => {
    assert.equal(categorizeAqi(50).level, 'good');
    assert.equal(categorizeAqi(51).level, 'moderate');
    assert.equal(categorizeAqi(150).level, 'sensitive');
    assert.equal(categorizeAqi(201).level, 'very_unhealthy');
    assert.equal(categorizeAqi(500).level, 'hazardous');
  });

  it('rejects missing or invalid values', () => {
    for (const bad of [undefined, null, NaN, -1, '50']) assert.equal(categorizeAqi(bad), null);
  });

  it('ranks severity', () => {
    assert.ok(severity('hazardous') > severity('good'));
  });
});
