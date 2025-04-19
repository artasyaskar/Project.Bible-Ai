require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { OpenAI } = require('openai');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Bible API function
async function getBibleText(book, chapter) {
    try {
        const response = await fetch(`https://bible-api.com/${book}+${chapter}`);
        const data = await response.json();
        return data.text;
    } catch (error) {
        console.error('Error fetching Bible text:', error);
        throw error;
    }
}

// AI Summarization
async function generateSummary(text) {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{
                role: "user",
                content: `Provide a detailed 4-5 paragraph summary of this Bible chapter in modern, easy-to-understand language. 
                Include key events, characters, and spiritual lessons. Here's the chapter text: ${text}`
            }],
            temperature: 0.7
        });
        
        return response.choices[0].message.content;
    } catch (error) {
        console.error('Error generating summary:', error);
        throw error;
    }
}

// Image Generation
async function generateImages(summary) {
    try {
        const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: `Create 4 high-quality 3D renderings of key scenes from this Bible chapter summary: ${summary}. 
            The images should be realistic, detailed, and suitable for all ages. 
            Include characters, settings, and important objects from the story.`,
            n: 4,
            size: "1024x1024",
            quality: "standard"
        });
        
        return response.data.map(img => img.url);
    } catch (error) {
        console.error('Error generating images:', error);
        throw error;
    }
}

// API Endpoint
app.post('/api/summarize', async (req, res) => {
    try {
        const { book, chapter } = req.body;
        
        // Get Bible text
        const bibleText = await getBibleText(book, chapter);
        
        // Generate summary
        const summary = await generateSummary(bibleText);
        
        // Generate images
        const images = await generateImages(summary);
        
        res.json({ summary, images });
    } catch (error) {
        console.error('Error in summarize endpoint:', error);
        res.status(500).json({ error: 'Failed to process request' });
    }
});

// Start server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
