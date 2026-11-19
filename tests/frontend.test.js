import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  summarizeSources,
  barHeight,
  barWidth,
  rankSentence,
  whoNote,
  densityTier,
  formatHour,
  formatNumber,
  formatPopulation,
  gaugeFraction,
  summarizeForecast,
} from '../public/format.js';

describe('frontend formatting', () => {
  it('formats populations compactly only when large', () => {
    assert.equal(formatPopulation(26_495_000), '26.5M');
    assert.equal(formatPopulation(52_000), '52,000');
    assert.equal(formatNumber(17_852), '17,852');
  });

  it('extracts the hour from local ISO time', () => {
    assert.equal(formatHour('2026-11-18T14:00'), '14:00');
  });

  it('classifies density tiers at boundaries', () => {
    assert.equal(densityTier(100), 'Low density');
    assert.equal(densityTier(1_500), 'Moderate density');
    assert.equal(densityTier(5_000), 'Dense');
    assert.equal(densityTier(15_000), 'Very dense');
  });

  it('clamps the gauge and bar scale', () => {
    assert.equal(gaugeFraction(-5), 0);
    assert.equal(gaugeFraction(150), 0.5);
    assert.equal(gaugeFraction(999), 1);
    assert.equal(barHeight(0), '3.0%');
    assert.equal(barHeight(300), '100.0%');
  });

  it('summarises the outlook with cleanest and worst hours', () => {
    const hours = [
      { time: '2026-01-01T05:00', aqi: 40 },
      { time: '2026-01-01T14:00', aqi: 190 },
    ];
    assert.equal(
      summarizeForecast({ hours, best: hours[0] }),
      'Cleanest around 05:00 (AQI 40); worst around 14:00 (AQI 190).',
    );
    assert.equal(summarizeForecast({ hours: [], best: null }), 'No forecast available.');
  });
});

describe('WHO and comparison helpers', () => {
  it('compares readings with the WHO 24 h guideline', () => {
    assert.equal(whoNote('pm25', 15), 'Within WHO guideline');
    assert.equal(whoNote('pm25', 51), '3.4× WHO limit');
    assert.equal(whoNote('pm10', 90), '2.0× WHO limit');
    assert.equal(whoNote('ozone', 100), null, 'no guideline defined for ozone here');
    assert.equal(whoNote('pm25', null), null);
  });

  it('scales comparison bars and words the ranking', () => {
    assert.equal(barWidth(0), '2.0%');
    assert.equal(barWidth(150), '50.0%');
    assert.equal(rankSentence({ rank: 1, total: 25 }), 'The most polluted of 25 major cities right now');
    assert.equal(rankSentence({ rank: 25, total: 25 }), 'The cleanest of 25 major cities right now');
    assert.equal(rankSentence({ rank: 4, total: 25 }), '#4 most polluted of 25 major cities');
  });
});

describe('source status summary', () => {
  const sources = (...flags) => flags.map((ok) => ({ ok }));

  it('summarises live, partial and down states', () => {
    assert.deepEqual(summarizeSources(sources(true, true, true, true)), {
      live: 4,
      total: 4,
      state: 'ok',
      label: '4 of 4 free data sources live',
    });
    assert.equal(summarizeSources(sources(true, false)).state, 'partial');
    assert.equal(summarizeSources(sources(false, false)).state, 'down');
    assert.equal(summarizeSources(sources(true, false)).label, '1 of 2 free data sources live');
  });
});
