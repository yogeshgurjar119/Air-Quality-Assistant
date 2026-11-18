import { createDefaultApp } from './bootstrap.js';

const { app, config, llm } = createDefaultApp();

app.listen(config.port, () => {
  const mode = llm.isConfigured ? `AI models: ${config.nvidia.models.join(' → ')}` : 'offline rules mode (no NVIDIA_API_KEY)';
  console.log(`AirWise on http://localhost:${config.port} — ${mode}`);
});
