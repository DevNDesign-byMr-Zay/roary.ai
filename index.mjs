import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

const app = express();
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

app.post('/chat', async (req, res) => {
  const userInput = req.body?.text || "Hello, ROARY";
  const result = await model.generateContent(userInput);
  res.json({ reply: result.response.text() });
});

app.listen(8080, () =>
  console.log("ROARY.AI (Gemini API) running on http://localhost:8080")
);