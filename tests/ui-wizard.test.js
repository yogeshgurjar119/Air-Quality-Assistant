import assert from 'node:assert/strict';
import { before, beforeEach, describe, it } from 'node:test';
import { loadDom } from './helpers-dom.js';

let wizardModule;
before(async () => {
  loadDom();
  wizardModule = await import('../public/wizard.js');
});

const submit = () => {
  const form = document.getElementById('plan-form');
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
};
const pick = (name, value) => {
  document.querySelector(`input[name="${name}"][value="${value}"]`).click();
};
const currentLabel = () => document.querySelector('.stepper .current').textContent;

describe('createWizard', () => {
  let wizard;
  let completed;
  let cities;

  beforeEach(() => {
    loadDom(); // a fresh page per test, so listeners from earlier wizards can't fire
    completed = [];
    cities = [];
    wizard = wizardModule.createWizard({
      root: document.getElementById('wizard-view'),
      onComplete: (profile) => completed.push(profile),
      onCity: (city) => cities.push(city),
    });
  });

  it('starts on the first step with the popular-city shortcuts', () => {
    assert.equal(wizard.step, 0);
    assert.equal(currentLabel(), 'Place');
    assert.equal(document.getElementById('back').hidden, true);
    assert.equal(document.querySelectorAll('#city-chips button').length, wizardModule.POPULAR_CITIES.length);
    assert.equal(document.querySelector('.stepper .current').getAttribute('aria-current'), 'step');
  });

  it('blocks an empty city with an accessible error and does not advance', () => {
    submit();
    const input = document.getElementById('city');
    assert.equal(wizard.step, 0);
    assert.equal(document.getElementById('city-error').textContent, 'Please enter your city.');
    assert.equal(document.getElementById('city-error').hidden, false);
    assert.equal(input.getAttribute('aria-invalid'), 'true');
    assert.equal(document.activeElement, input);
    assert.deepEqual(cities, []);
  });

  it('walks through the steps, shows a review, and completes with the profile', () => {
    document.getElementById('city').value = '  Delhi ';
    submit();
    assert.equal(wizard.step, 1);
    assert.equal(document.getElementById('city-error').hidden, true);
    pick('commute', 'motorbike');
    pick('cooking', 'biomass');
    submit();
    pick('vulnerable', 'children');
    pick('vulnerable', 'asthma_or_lung_condition');
    submit();

    assert.equal(wizard.step, 3);
    assert.equal(document.getElementById('next').textContent, 'Show my plan');
    const review = Object.fromEntries(
      [...document.querySelectorAll('#review > div')].map((row) => [
        row.children[0].textContent,
        row.children[1].textContent,
      ]),
    );
    assert.equal(review.City, 'Delhi');
    assert.equal(review['Getting around'], 'Motorbike / scooter');
    assert.equal(review['Sensitive members'], 'Children, Asthma or lung condition');

    submit();
    assert.deepEqual(completed, [
      {
        city: 'Delhi',
        commute: 'motorbike',
        cooking: 'biomass',
        home: 'apartment',
        purifier: 'none',
        vulnerable: ['children', 'asthma_or_lung_condition'],
      },
    ]);
    assert.ok(cities.length >= 3 && cities.every((city) => city === 'Delhi'));
  });

  it('goes back, resets to the first step and keeps the answers', () => {
    document.getElementById('city').value = 'Oslo';
    submit();
    document.getElementById('back').click();
    assert.equal(wizard.step, 0);
    wizard.goToStep(2);
    wizard.reset();
    assert.equal(wizard.step, 0);
    assert.equal(document.getElementById('city').value, 'Oslo');
  });

  it('clamps out-of-range steps', () => {
    wizard.goToStep(99);
    assert.equal(wizard.step, 3);
    wizard.goToStep(-5);
    assert.equal(wizard.step, 0);
  });

  it('jumps ahead when a popular city is tapped', () => {
    document.querySelector('#city-chips button').click();
    assert.equal(document.getElementById('city').value, wizardModule.POPULAR_CITIES[0]);
    assert.equal(wizard.step, 1);
    assert.deepEqual(cities, [wizardModule.POPULAR_CITIES[0]]);
  });

  it('shows user text in the review as text, never as HTML', () => {
    document.getElementById('city').value = '<b>x</b>';
    wizard.goToStep(3);
    assert.equal(document.querySelector('#review b'), null);
    assert.match(document.getElementById('review').textContent, /<b>x<\/b>/);
  });

  it('disables the submit button while busy', () => {
    wizard.setBusy(true);
    assert.equal(document.getElementById('next').disabled, true);
    wizard.setBusy(false);
    assert.equal(document.getElementById('next').disabled, false);
  });
});
