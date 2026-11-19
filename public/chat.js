import { sendChat } from './api.js';
import { el } from './dom.js';

const SUGGESTIONS = [
  'Is it safe to exercise outside today?',
  'How can I protect my kids at school?',
  'Cheapest way to clean my indoor air?',
];
const MAX_HISTORY = 8;
const MIN_CITY_LENGTH = 2;
const GREETING =
  "Hi, I'm AirWise. Enter your city above, then ask me anything about air quality, your family's health or cleaner daily habits.";
const CITY_PROMPT = 'Please enter your city first, so I can use live air data for your answer.';
const RULES_NOTE = 'Built-in guidance from live air data (AI is unavailable right now)';
const AI_OFFLINE_NOTE = 'The AI model is offline, so you will get built-in guidance based on live air data.';

const hasCity = (value) => value.trim().length >= MIN_CITY_LENGTH;

/** The conversation sent with each question. Starts afresh when the user switches city. */
const createConversation = () => {
  let history = [];
  let city = '';
  const push = (message) => {
    history = [...history, message].slice(-MAX_HISTORY);
  };
  return {
    switchCity(next) {
      if (next.toLowerCase() === city.toLowerCase()) return;
      city = next;
      history = [];
    },
    addUser: (content) => push({ role: 'user', content }),
    addAssistant: (content) => push({ role: 'assistant', content }),
    dropLast() {
      history = history.slice(0, -1);
    },
    get messages() {
      return history;
    },
  };
};

/** Appends chat bubbles to the log and keeps the newest one in view. */
const createMessageLog = (log) => ({
  isEmpty: () => log.childElementCount === 0,
  add(role, text) {
    const bubble = el('div', { className: `msg ${role}`, text });
    log.append(bubble);
    log.scrollTop = log.scrollHeight;
    return bubble;
  },
});

/** Opening and closing the floating panel, with focus handling for keyboard users. */
const createPanel = ({ panel, launcher, cityInput, input, onFirstOpen }) => {
  const isOpen = () => !panel.hidden;
  return {
    isOpen,
    open() {
      if (isOpen()) return;
      panel.hidden = false;
      launcher.setAttribute('aria-expanded', 'true');
      onFirstOpen();
      (hasCity(cityInput.value) ? input : cityInput).focus();
    },
    close() {
      panel.hidden = true;
      launcher.setAttribute('aria-expanded', 'false');
      launcher.focus();
    },
  };
};

const showReply = (bubble, reply, source) => {
  bubble.textContent = reply;
  if (source === 'rules') bubble.append(el('small', { className: 'msg-note', text: RULES_NOTE }));
};

const showError = (bubble, message) => {
  bubble.textContent = message;
  bubble.classList.add('error');
};

/** Sends questions to the API and renders the answers, one question at a time. */
const createAsker = ({ conversation, messages, cityInput, input, send }) => {
  let busy = false;

  const setBusy = (value) => {
    busy = value;
    send.disabled = value;
    input.disabled = value;
  };

  const getAnswer = async (city) => {
    setBusy(true);
    const pending = messages.add('assistant', 'Thinking…');
    try {
      const { reply, source } = await sendChat(city, conversation.messages);
      showReply(pending, reply, source);
      conversation.addAssistant(reply);
    } catch (error) {
      showError(pending, error.message);
      conversation.dropLast(); // the failed question is not part of the history
    } finally {
      setBusy(false);
      input.focus();
    }
  };

  return async (question) => {
    const text = question.trim();
    if (!text || busy) return;
    const city = cityInput.value.trim();
    if (!hasCity(city)) {
      messages.add('assistant', CITY_PROMPT);
      cityInput.focus();
      return;
    }
    conversation.switchCity(city);
    conversation.addUser(text);
    messages.add('user', text);
    input.value = '';
    await getAnswer(city);
  };
};

/** Pre-fills the city field, but never overwrites a city the user typed themselves. */
const createCitySuggester = (cityInput) => {
  let lastSuggested = '';
  return (city) => {
    const current = cityInput.value.trim();
    if (hasCity(current) && current !== lastSuggested) return;
    cityInput.value = city;
    lastSuggested = city;
  };
};

const addSuggestionChips = (list, ask) => {
  SUGGESTIONS.forEach((question) => {
    const button = el('button', { className: 'chip', text: question, attrs: { type: 'button' } });
    button.addEventListener('click', () => ask(question));
    list.append(el('li', {}, [button]));
  });
};

const bindPanelEvents = ({ view, panel, launcher, openers, closeButton }) => {
  [launcher, ...openers].forEach((button) =>
    button.addEventListener('click', () => (view.isOpen() && button === launcher ? view.close() : view.open())),
  );
  closeButton.addEventListener('click', view.close);
  panel.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') view.close();
  });
};

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
  const conversation = createConversation();
  const messages = createMessageLog(log);
  const view = createPanel({
    panel,
    launcher,
    cityInput,
    input,
    onFirstOpen: () => messages.isEmpty() && messages.add('assistant', GREETING),
  });
  const ask = createAsker({ conversation, messages, cityInput, input, send });

  addSuggestionChips(chips, ask);
  bindPanelEvents({ view, panel, launcher, openers, closeButton });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    ask(input.value);
  });

  return {
    /** Pre-fills the city (from the wizard or results) without disturbing a city the user typed here. */
    suggestCity: createCitySuggester(cityInput),
    /** Chat always works; without an AI model the server answers from built-in guidance. */
    setAiOnline(online) {
      note.hidden = online;
      note.textContent = online ? '' : AI_OFFLINE_NOTE;
    },
  };
};
