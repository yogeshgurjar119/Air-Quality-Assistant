import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import puppeteer from 'puppeteer-core';

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

/** Path of an installed Chrome/Chromium, or undefined (browser tests are then skipped, not failed). */
export const findChrome = () => CHROME_CANDIDATES.find((path) => path && existsSync(path));

export const launchBrowser = () =>
  puppeteer.launch({
    executablePath: findChrome(),
    headless: true,
    // CI containers run without the user namespaces Chrome's sandbox needs.
    args: process.env.CI ? ['--no-sandbox'] : [],
  });

const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

/** Runs axe-core on the current page and returns readable descriptions of any violations. */
export const accessibilityViolations = async (page) => {
  await page.evaluate(axeSource);
  const { violations } = await page.evaluate(
    (tags) => globalThis.axe.run(document, { runOnly: { type: 'tag', values: tags } }),
    AXE_TAGS,
  );
  return violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
};

/** Opens a page on the app with the viewport and user preferences under test. */
export const openApp = async (browser, url, { width = 1280, height = 800, colorScheme = 'light' } = {}) => {
  const page = await browser.newPage();
  await page.setViewport({ width, height });
  await page.emulateMediaFeatures([
    { name: 'prefers-color-scheme', value: colorScheme },
    { name: 'prefers-reduced-motion', value: 'reduce' },
  ]);
  await page.goto(url, { waitUntil: 'networkidle2' });
  return page;
};

/** Moves the questionnaire forward with the keyboard (focus Next, press Enter). */
export const pressNext = async (page) => {
  await page.focus('#next');
  await page.keyboard.press('Enter');
};

/** Completes the questionnaire for `city` with default answers and waits for the AI plan. */
export const generatePlan = async (page, city) => {
  await page.type('#city', city);
  await pressNext(page);
  await pressNext(page);
  await pressNext(page);
  await page.click('#next');
  await page.waitForSelector('#plan .plan-item', { visible: true });
};
