import { fileURLToPath } from 'node:url';
import { createDefaultApp } from './bootstrap.js';

// Only the local server serves the UI itself; Vercel/Netlify serve `public/` from their CDN.
const staticDir = fileURLToPath(new URL('../public', import.meta.url));
const { app, config, llm } = createDefaultApp(process.env, { staticDir });

app.listen(config.port, () => {
  const mode = llm.isConfigured ? `AI models: ${config.nvidia.models.join(' → ')}` : 'offline rules mode (no NVIDIA_API_KEY)';
  console.log(`AirWise on http://localhost:${config.port} — ${mode}`);
});
