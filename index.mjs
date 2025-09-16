import express from 'express';
import { VertexAI } from '@google-cloud/vertexai';
import admin from 'firebase-admin';

const app = express();
app.use(express.json());

// --- Vertex AI client ---
const project = process.env.GOOGLE_CLOUD_PROJECT || 'roary-bk';
const location = process.env.VERTEX_LOCATION || 'us-central1';

const vertexAi = new VertexAI({ project, location });
const model = vertexAi.getGenerativeModel({
  model: 'gemini-2.5-flash',
  systemInstruction: {
    parts: [{
      text: `You are ROARY, a concise, upbeat assistant for roary.ai.
- Keep answers short unless asked.
- If you don’t know, say so and offer next steps.
- Avoid sensitive or personal data without being asked.`
    }]
  }
});

// --- Firestore (uses ADC) ---
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

async function loadHistory(sessionId, limit = 8) {
  const qs = await db
    .collection('conversations')
    .doc(sessionId)
    .collection('turns')
    .orderBy('ts', 'desc')
    .limit(limit)
    .get();
  return qs.docs.reverse().map(d => d.data());
}

async function saveTurn(sessionId, user, roary) {
  await db
    .collection('conversations')
    .doc(sessionId)
    .collection('turns')
    .add({
      ts: admin.firestore.FieldValue.serverTimestamp(),
      user,
      roary
    });
}

// --- Health ---
app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true, project, location, model: 'gemini-2.5-flash' });
});

// --- Home ---
app.get('/', (_req, res) => res.send('ROARY is live 🐯'));

// --- Chat (threaded with memory) ---
app.post('/chat', async (req, res) => {
  try {
    const userInput = req.body?.text || 'Hello, ROARY';
    const sessionId = (req.body?.sessionId || 'default').toString();

    const history = await loadHistory(sessionId, 8);
    const contents = [
      ...history.flatMap(t => ([
        { role: 'user', parts: [{ text: t.user }] },
        { role: 'model', parts: [{ text: t.roary }] }
      ])),
      { role: 'user', parts: [{ text: userInput }] }
    ];

    const resp = await model.generateContent({ contents });

    // robust reply extraction across SDK variants
    let reply = '';
    if (resp?.response && typeof resp.response.text === 'function') reply = resp.response.text();
    else if (resp?.response && typeof resp.response.text === 'string') reply = resp.response.text;
    else {
      const cands = resp?.response?.candidates ?? [];
      reply = cands
        .map(c => (c?.content?.parts ?? []).map(p => p?.text ?? '').join(''))
        .join('\n').trim();
    }
    if (!reply) reply = '[no text returned]';

    await saveTurn(sessionId, userInput, reply);
    res.json({ reply, sessionId });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: String(err) });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`ROARY running on http://localhost:${PORT} (project=${project}, location=${location})`);
});
