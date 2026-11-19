import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildFallbackPlan } from '../server/services/fallback.js';
import { buildFallbackReply } from '../server/services/fallbackChat.js';
import { normalizePlan } from '../server/services/planSchema.js';
import { parseProfile } from '../server/services/profile.js';
import { sampleAir, sampleLocation, validBody } from './helpers.js';

describe('buildFallbackPlan', () => {
  const context = (air, overrides = {}) => ({
    profile: { ...parseProfile(validBody), ...overrides },
    location: sampleLocation,
    air,
  });

  it('always returns a complete, valid plan for every profile combination', () => {
    const commutes = ['walk', 'cycle', 'public_transport', 'car', 'motorbike', 'work_from_home'];
    const cooking = ['electric', 'induction', 'lpg_gas', 'biomass', 'mixed'];
    const airs = [
      sampleAir(30, 'good', 'Good'),
      sampleAir(80, 'moderate', 'Moderate'),
      sampleAir(180),
      sampleAir(400, 'hazardous', 'Hazardous'),
    ];
    for (const commute of commutes) {
      for (const cook of cooking) {
        for (const air of airs) {
          for (const purifier of ['none', 'hepa_purifier']) {
            const plan = buildFallbackPlan(
              context(air, { commute, cooking: cook, purifier, home: 'house', vulnerable: [] }),
            );
            assert.doesNotThrow(() => normalizePlan(plan));
          }
        }
      }
    }
  });

  it('adapts advice to air quality and sensitive members', () => {
    const bad = buildFallbackPlan(context(sampleAir(180)));
    const good = buildFallbackPlan(context(sampleAir(30, 'good', 'Good'), { vulnerable: [] }));
    assert.match(bad.routines[0].title, /indoors/i);
    assert.doesNotMatch(good.routines[0].title, /indoors/i);
    assert.ok(bad.routines.some((r) => /sensitive/i.test(r.title)));
  });
});

describe('buildFallbackReply', () => {
  const city = (air) => ({ location: sampleLocation, air });
  const bad = sampleAir(180);
  const good = sampleAir(30, 'good', 'Good');
  const reply = (air, question) => buildFallbackReply(city(air), question);

  it('always grounds the answer in the live reading', () => {
    assert.match(reply(bad, 'anything'), /^Delhi AQI is 180 \(Unhealthy\)\./);
  });

  it('answers each topic and adapts to the AQI band', () => {
    assert.match(reply(bad, 'Can I go for a jog?'), /Skip hard outdoor exercise/);
    assert.match(reply(good, 'Can I go for a jog?'), /Outdoor activity is fine/);
    assert.match(reply(bad, 'Should my kids go to school?'), /keep outdoor play and sport indoors/);
    assert.match(reply(good, 'my child plays'), /fine for most children/);
    assert.match(reply(bad, 'Do I need an N95 mask?'), /N95\/FFP2 mask cuts/);
    assert.match(reply(good, 'mask?'), /not needed/);
    assert.match(reply(bad, 'best purifier or windows?'), /Keep windows shut/);
    assert.match(reply(good, 'open windows?'), /opposite sides/);
    assert.match(reply(bad, 'gas stove cooking'), /exhaust fan/);
    assert.match(reply(bad, 'my daily commute by car'), /walking, cycling or transit/);
    assert.match(reply(bad, 'when is the cleanest hour'), /cleanest hour in the next 24 hours is around 10:00/);
  });

  it('mentions the cleanest hour for exercise, and copes without forecast data', () => {
    assert.match(reply(bad, 'jog'), /around 10:00/);
    const noForecast = { ...bad, forecast: { hours: [], best: null } };
    assert.doesNotMatch(reply(noForecast, 'jog'), /around/);
    assert.match(reply(noForecast, 'best time'), /24-hour chart/);
  });

  it('gives an overview for unrecognised questions', () => {
    assert.match(reply(bad, 'tell me a story'), /Everyone should reduce prolonged outdoor exertion/);
    assert.match(reply(bad, 'tell me a story'), /Ask me about/);
  });
});
