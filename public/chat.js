import { sendChat } from './api.js';
import { el } from './dom.js';

const SUGGESTIONS = [
  'Is it safe to exercise outside today?',
  'How can I protect my kids at school?',
  'Cheapest way to clean my indoor air?',
];
const MAX_HISTORY = 8;
const GREETING =
  "Hi, I'm AirWise. Enter your city above, then ask me anything about air quality, your family's health or cleaner daily habits.";

/**
 * Floating chat assistant available on every page. It has its own city field (pre-filled from the
 * wizard), so people can chat straight away without completing the questionnaire first.
 */
export const createChat = ({
  panel,
  launcher,
  openers,
  closeButton,
  cityInput,
  log,
  chips,
  form,
  input,
  send,
  note,
}) => {
  let history = [];
  let activeCity = '';
  let lastSuggested = '';
  let busy = false;

  const addBubble = (role, text) => {
    const bubble = el('div', { className: `msg ${role}`, text });
    log.append(bubble);
    log.scrollTop = log.scrollHeight;
    return bubble;
  };

  const setBusy = (value) => {
    busy = value;
    send.disabled = value;
    input.disabled = value;
  };

  const isOpen = () => !panel.hidden;

  const open = () => {
    if (isOpen()) return;
    panel.hidden = false;
    launcher.setAttribute('aria-expanded', 'true');
    if (log.childElementCount === 0) addBubble('assistant', GREETING);
    (cityInput.value.trim().length < 2 ? cityInput : input).focus();
  };

  const close = () => {
    panel.hidden = true;
    launcher.setAttribute('aria-expanded', 'false');
    launcher.focus();
  };

  const ask = async (question) => {
    const text = question.trim();
    if (!text || busy) return;
    const city = cityInput.value.trim();
    if (city.length < 2) {
      addBubble('assistant', 'Please enter your city first, so I can use live air data for your answer.');
      cityInput.focus();
      return;
    }
    if (city.toLowerCase() !== activeCity.toLowerCase()) {
      activeCity = city;
      history = [];
    }

    history = [...history, { role: 'user', content: text }].slice(-MAX_HISTORY);
    addBubble('user', text);
    input.value = '';
    setBusy(true);
    const pending = addBubble('assistant', 'Thinking…');
    try {
      const { reply, source } = await sendChat(city, history);
      pending.textContent = reply;
      if (source === 'rules') {
        pending.append(
          el('small', {
            className: 'msg-note',
            text: 'Built-in guidance from live air data (AI is unavailable right now)',
          }),
        );
      }
      history = [...history, { role: 'assistant', content: reply }].slice(-MAX_HISTORY);
    } catch (error) {
      pending.textContent = error.message;
      pending.classList.add('error');
      history = history.slice(0, -1);
    } finally {
      setBusy(false);
      input.focus();
    }
  };

  SUGGESTIONS.forEach((question) => {
    const button = el('button', { className: 'chip', text: question, attrs: { type: 'button' } });
    button.addEventListener('click', () => ask(question));
    chips.append(el('li', {}, [button]));
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    ask(input.value);
  });
  [launcher, ...openers].forEach((button) =>
    button.addEventListener('click', () => (isOpen() && button === launcher ? close() : open())),
  );
  closeButton.addEventListener('click', close);
  panel.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });

  return {
    /** Pre-fills the city (from the wizard or results) without disturbing a city the user typed here. */
    suggestCity(city) {
      const current = cityInput.value.trim();
      if (current.length < 2 || current === lastSuggested) {
        cityInput.value = city;
        lastSuggested = city;
      }
    },
    /** Chat always works; without an AI model the server answers from built-in guidance. */
    setAiOnline(online) {
      note.hidden = online;
      note.textContent = online
        ? ''
        : 'The AI model is offline, so you will get built-in guidance based on live air data.';
    },
  };
};
