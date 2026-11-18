// Vercel serverless entry point: every /api/* request is rewritten here (see vercel.json).
import { createDefaultApp } from '../server/bootstrap.js';

export default createDefaultApp().app;
