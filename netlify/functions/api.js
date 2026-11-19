// Netlify Function entry point: /api/* is redirected here (see netlify.toml).
import serverless from 'serverless-http';
import { createDefaultApp } from '../../server/bootstrap.js';

const handle = serverless(createDefaultApp().app);
const FUNCTION_PREFIX = '/.netlify/functions/api';

/** Normalises the path so Express always sees /api/... however Netlify invoked us. */
export const handler = (event, context) =>
  handle(
    {
      ...event,
      path: event.path.startsWith(FUNCTION_PREFIX) ? `/api${event.path.slice(FUNCTION_PREFIX.length)}` : event.path,
    },
    context,
  );
