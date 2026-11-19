import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { extractJson, normalizePlan } from '../server/services/planSchema.js';
import { buildChatMessages, buildMessages } from '../server/services/prompt.js';
import { parseProfile } from '../server/services/profile.js';
import { sampleAir, sampleLocation, validBody } from './helpers.js';

describe('planSchema', () => {
  const item = { title: 'T', action: 'A', impact: 'I' };
  const raw = { summary: 'S', routines: [item], indoor: [item], alternatives: [item] };

  it('extracts JSON wrapped in prose or code fences', () => {
    assert.deepEqual(extractJson('Here:\n```json\n{"a":1}\n```'), { a: 1 });
    assert.equal(extractJson('no json'), null);
    assert.equal(extractJson('{broken'), null);
    assert.equal(extractJson(42), null);
  });

  it('normalises a valid plan and caps list length', () => {
    assert.equal(normalizePlan({ ...raw, routines: Array(9).fill(item) }).routines.length, 5);
  });

  it('drops malformed items and rejects incomplete plans', () => {
    assert.equal(normalizePlan({ ...raw, indoor: [item, { title: 'x' }, 'str'] }).indoor.length, 1);
    assert.throws(() => normalizePlan({ ...raw, alternatives: [] }), { status: 502 });
    assert.throws(() => normalizePlan(null), { status: 502 });
  });
});

describe('prompts', () => {
  const city = { location: sampleLocation, air: sampleAir(), weather: { windKmh: 2 }, density: { perKm2: 9000 } };

  it('embeds readings and household in the plan prompt', () => {
    const [system, user] = buildMessages({ profile: parseProfile(validBody), ...city });
    assert.equal(system.role, 'system');
    assert.match(user.content, /"usAqi":180/);
    assert.match(user.content, /lpg_gas/);
    assert.match(user.content, /"perKm2":9000/);
  });

  it('grounds chat in live data and appends history', () => {
    const history = [{ role: 'user', content: 'hi' }];
    const messages = buildChatMessages(city, history);
    assert.match(messages[0].content, /"usAqi":180/);
    assert.deepEqual(messages.slice(1), history);
  });
});
