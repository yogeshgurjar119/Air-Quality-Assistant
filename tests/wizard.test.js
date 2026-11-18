import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LABELS, LAST_STEP, STEPS, clampStep, summarizeProfile, validateStep } from '../public/wizard-model.js';
import { OPTIONS } from '../server/services/profile.js';
import { validBody } from './helpers.js';

describe('wizard model', () => {
  it('has four steps ending with review', () => {
    assert.equal(STEPS.length, 4);
    assert.equal(STEPS[LAST_STEP].id, 'review');
  });

  it('clamps step indexes', () => {
    assert.equal(clampStep(-3), 0);
    assert.equal(clampStep(2), 2);
    assert.equal(clampStep(99), LAST_STEP);
  });

  it('only blocks the first step when the city is too short', () => {
    assert.equal(validateStep(0, { city: ' a ' }), 'Please enter your city.');
    assert.equal(validateStep(0, { city: 'Delhi' }), null);
    assert.equal(validateStep(1, { city: '' }), null);
  });

  it('summarises answers for review, including "None" for no sensitive members', () => {
    const rows = Object.fromEntries(summarizeProfile({ ...validBody, vulnerable: [] }));
    assert.equal(rows.City, 'Delhi');
    assert.equal(rows['Getting around'], 'Car');
    assert.equal(rows['Sensitive members'], 'None');
    const withKids = Object.fromEntries(summarizeProfile({ ...validBody, vulnerable: ['children', 'elderly'] }));
    assert.equal(withKids['Sensitive members'], 'Children, Older adults');
  });

  it('has a label for every option the server accepts (no drift between UI and API)', () => {
    for (const [field, values] of Object.entries(OPTIONS)) {
      for (const value of values.filter((v) => v !== 'none' || field === 'purifier')) {
        assert.ok(LABELS[field][value], `${field}.${value} has no label`);
      }
    }
  });
});
