const bibleBooks = [
    { name: "Genesis", chapters: 50 },
    { name: "Exodus", chapters: 40 },
    { name: "Leviticus", chapters: 27 },
    { name: "Numbers", chapters: 36 },
    { name: "Deuteronomy", chapters: 34 },
    { name: "Joshua", chapters: 24 },
    { name: "Judges", chapters: 21 },
    { name: "Ruth", chapters: 4 },
    { name: "1 Samuel", chapters: 31 },
    { name: "2 Samuel", chapters: 24 },
    { name: "1 Kings", chapters: 22 },
    { name: "2 Kings", chapters: 25 },
    { name: "1 Chronicles", chapters: 29 },
    { name: "2 Chronicles", chapters: 36 },
    { name: "Ezra", chapters: 10 },
    { name: "Nehemiah", chapters: 13 },
    { name: "Esther", chapters: 10 },
    { name: "Job", chapters: 42 },
    { name: "Psalms", chapters: 150 },
    { name: "Proverbs", chapters: 31 },
    { name: "Ecclesiastes", chapters: 12 },
    { name: "Song of Solomon", chapters: 8 },
    { name: "Isaiah", chapters: 66 },
    { name: "Jeremiah", chapters: 52 },
    { name: "Lamentations", chapters: 5 },
    { name: "Ezekiel", chapters: 48 },
    { name: "Daniel", chapters: 12 },
    { name: "Hosea", chapters: 14 },
    { name: "Joel", chapters: 3 },
    { name: "Amos", chapters: 9 },
    { name: "Obadiah", chapters: 1 },
    { name: "Jonah", chapters: 4 },
    { name: "Micah", chapters: 7 },
    { name: "Nahum", chapters: 3 },
    { name: "Habakkuk", chapters: 3 },
    { name: "Zephaniah", chapters: 3 },
    { name: "Haggai", chapters: 2 },
    { name: "Zechariah", chapters: 14 },
    { name: "Malachi", chapters: 4 },
    { name: "Matthew", chapters: 28 },
    { name: "Mark", chapters: 16 },
    { name: "Luke", chapters: 24 },
    { name: "John", chapters: 21 },
    { name: "Acts", chapters: 28 },
    { name: "Romans", chapters: 16 },
    { name: "1 Corinthians", chapters: 16 },
    { name: "2 Corinthians", chapters: 13 },
    { name: "Galatians", chapters: 6 },
    { name: "Ephesians", chapters: 6 },
    { name: "Philippians", chapters: 4 },
    { name: "Colossians", chapters: 4 },
    { name: "1 Thessalonians", chapters: 5 },
    { name: "2 Thessalonians", chapters: 3 },
    { name: "1 Timothy", chapters: 6 },
    { name: "2 Timothy", chapters: 4 },
    { name: "Titus", chapters: 3 },
    { name: "Philemon", chapters: 1 },
    { name: "Hebrews", chapters: 13 },
    { name: "James", chapters: 5 },
    { name: "1 Peter", chapters: 5 },
    { name: "2 Peter", chapters: 3 },
    { name: "1 John", chapters: 5 },
    { name: "2 John", chapters: 1 },
    { name: "3 John", chapters: 1 },
    { name: "Jude", chapters: 1 },
    { name: "Revelation", chapters: 22 }
];

// DOM elements
const bookSelect = document.getElementById('book-select');
const chapterSelect = document.getElementById('chapter-select');
const exploreBtn = document.getElementById('explore-btn');
const loadingDiv = document.querySelector('.loading');
const resultsDiv = document.getElementById('results');
const chapterTitle = document.getElementById('chapter-title');
const summaryContent = document.getElementById('summary-content');
const imagesContainer = document.getElementById('images-container');

// Populate book select
bibleBooks.forEach(book => {
    const option = document.createElement('option');
    option.value = book.name.toLowerCase();
    option.textContent = book.name;
    bookSelect.appendChild(option);
});

// Update chapters when book is selected
bookSelect.addEventListener('change', function() {
    chapterSelect.innerHTML = '<option value="">-- Select Chapter --</option>';
    
    const selectedBook = bibleBooks.find(
        book => book.name.toLowerCase() === this.value
    );
    
    if (selectedBook) {
        for (let i = 1; i <= selectedBook.chapters; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = i;
            chapterSelect.appendChild(option);
        }
    }
});

// Handle explore button click
exploreBtn.addEventListener('click', async function() {
    const book = bookSelect.value;
    const chapter = chapterSelect.value;
    
    if (!book || !chapter) {
        alert('Please select both a book and a chapter');
        return;
    }
    
    // Show loading, hide results
    loadingDiv.classList.remove('hidden');
    resultsDiv.classList.add('hidden');
    
    try {
        const response = await fetch(`http://localhost:3000/api/summarize`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ book, chapter }),
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch data');
        }
        
        const data = await response.json();
        
        // Display results
        chapterTitle.textContent = `${book.charAt(0).toUpperCase() + book.slice(1)} Chapter ${chapter}`;
        summaryContent.innerHTML = data.summary
            .split('\n\n')
            .map(p => `<p>${p}</p>`)
            .join('');
        
        imagesContainer.innerHTML = data.images
            .map(url => `<img src="${url}" alt="Bible illustration">`)
            .join('');
        
        // Hide loading, show results
        loadingDiv.classList.add('hidden');
        resultsDiv.classList.remove('hidden');
    } catch (error) {
        console.error('Error:', error);
        loadingDiv.classList.add('hidden');
        alert('An error occurred. Please try again.');
    }
});
