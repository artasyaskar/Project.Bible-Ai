
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { OpenAI } = require('openai');

const app = express();

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(limiter);

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Test route
app.get('/', (req, res) => {
  res.send('Bible AI Server Running');
});

// Bible summary endpoint
app.post('/api/summarize', async (req, res) => {
  try {
    const { book, chapter } = req.body; // Changed from req.params
    
    // Input validation
    // Ensure chapter is a number if it's passed as a string from the client
    const chapterNumber = parseInt(chapter, 10);
    if (!book || !chapter || isNaN(chapterNumber)) {
      return res.status(400).json({ error: "Invalid book or chapter" });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{
        role: "user",
        content: `Summarize ${book} chapter ${chapter} of the Bible in 3 paragraphs with key lessons`
      }],
      temperature: 0.7
    });

    res.json({
      book,
      chapter,
      summary: completion.choices[0].message.content
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      error: "AI summary failed",
      details: error.message 
    });
  }
});

// Simplified list of Bible books and their chapter counts for random selection
// In a larger application, this might come from a database or a shared module
const bibleBooksForRandom = [
  { name: "Genesis", chapters: 50 }, { name: "Exodus", chapters: 40 },
  { name: "Psalms", chapters: 150 }, { name: "Proverbs", chapters: 31 },
  { name: "Isaiah", chapters: 66 }, { name: "Jeremiah", chapters: 52 },
  { name: "Matthew", chapters: 28 }, { name: "Mark", chapters: 16 },
  { name: "Luke", chapters: 24 }, { name: "John", chapters: 21 },
  { name: "Acts", chapters: 28 }, { name: "Romans", chapters: 16 },
  { name: "Revelation", chapters: 22 } // Added a few representative books
];

// Daily summary endpoint
app.get('/api/daily-summary', async (req, res) => {
  try {
    // Select a random book
    const randomBookEntry = bibleBooksForRandom[Math.floor(Math.random() * bibleBooksForRandom.length)];
    const book = randomBookEntry.name;
    // Select a random chapter from that book (1-indexed)
    const chapter = Math.floor(Math.random() * randomBookEntry.chapters) + 1;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{
        role: "user",
        content: `Provide a concise one-paragraph summary of ${book} chapter ${chapter} of the Bible, highlighting a key insight or lesson.`
      }],
      temperature: 0.7,
      max_tokens: 150 // Keep it concise for a daily summary
    });

    res.json({
      book,
      chapter: chapter.toString(), // Ensure chapter is a string like other endpoint
      summary: completion.choices[0].message.content
    });
  } catch (error) {
    console.error("Daily summary error:", error);
    res.status(500).json({ 
      error: "Failed to generate daily summary",
      details: error.message 
    });
  }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
