import express from 'express';
import { VertexAI } from '@google-cloud/vertexai';

const app = express();
app.use(express.json());

// --- Vertex AI client ---
const project = process.env.GOOGLE_CLOUD_PROJECT || 'roary-bk';
const location = process.env.VERTEX_LOCATION || 'us-central1';
const vertexAi = new VertexAI({ project, location });
const model = vertexAi.getGenerativeModel({ model: 'gemini-2.5-flash' });

// --- Health endpoint ---
app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true, project, location, model: 'gemini-2.5-flash' });
});

// --- Home ---
app.get('/', (_req, res) => res.send('ROARY is live 🐯'));

// --- Chat endpoint (robust reply extraction) ---
app.post('/chat', async (req, res) => {
  try {
    const userInput = req.body?.text || 'Hello, ROARY';
    const resp = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: userInput }] }]
    });

    let reply = '';

    // Case 1: newer SDKs expose response.text() as a function
    if (resp?.response && typeof resp.response.text === 'function') {
      reply = resp.response.text();
    }
    // Case 2: sometimes it's a plain string property
    else if (resp?.response && typeof resp.response.text === 'string') {
      reply = resp.response.text;
    }
    // Case 3: fall back to walking candidates/parts
    else {
      const cands = resp?.response?.candidates ?? [];
      reply = cands
        .map(c => (c?.content?.parts ?? [])
          .map(p => p?.text ?? '')
          .join(''))
        .filter(Boolean)
        .join('\n')
        .trim();
    }

    if (!reply) reply = '[no text returned]';
    res.json({ reply });
  } catch (err) {
    console.error('Vertex error:', err);
    res.status(500).json({ error: String(err) });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`ROARY running on http://localhost:${PORT} (project=${project}, location=${location})`);
});