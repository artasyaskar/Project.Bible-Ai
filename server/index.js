require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { OpenAI } = require('openai');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Test route
app.get('/', (req, res) => {
  res.send('Bible AI Server Running');
});

// Bible summary endpoint
app.get('/api/summary/:book/:chapter', async (req, res) => {
  try {
    const { book, chapter } = req.params;
    
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{
        role: "user",
        content: `Summarize ${book} chapter ${chapter} of the Bible in 3 paragraphs`
      }]
    });

    res.json({
      book,
      chapter,
      summary: completion.choices[0].message.content
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "AI summary failed" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
