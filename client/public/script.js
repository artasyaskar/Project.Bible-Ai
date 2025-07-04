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

// Daily Summary DOM elements
const dailySummaryContainer = document.getElementById('daily-summary-container');
const dailySummaryLoading = document.getElementById('daily-summary-loading');
const dailySummaryContent = document.getElementById('daily-summary-content');
const dailySummaryTitle = document.getElementById('daily-summary-title');
const dailySummaryText = document.getElementById('daily-summary-text');
const dailySummaryError = document.getElementById('daily-summary-error');

// Search DOM elements
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const clearSearchBtn = document.getElementById('clear-search-btn');

// Store original content to revert highlights
let originalSummaryContent = '';
let originalDailySummaryText = '';

// Function to fetch and display daily summary
async function fetchAndDisplayDailySummary() {
    let response; // Define response here to access it in catch if needed
    try {
        dailySummaryLoading.classList.remove('hidden');
        dailySummaryContent.classList.add('hidden');
        dailySummaryError.classList.add('hidden');

        response = await fetch('/api/daily-summary'); // Assign to outer scope variable

        if (!response.ok) {
            let errorData;
            // Check content type before trying to parse as JSON
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                errorData = await response.json();
                throw new Error(errorData.error || `Server error: ${response.status}`);
            } else {
                // If not JSON, throw a generic error with status text
                const responseText = await response.text(); // Get the text for logging
                console.error("Server returned non-JSON error:", responseText);
                throw new Error(`Server returned an unexpected response: ${response.status} ${response.statusText}`);
            }
        }
        const data = await response.json();

        dailySummaryTitle.textContent = `${data.book} Chapter ${data.chapter}`;
        // Assuming summary is plain text, wrap in <p> if not already structured
        dailySummaryText.innerHTML = `<p>${data.summary.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;
        originalDailySummaryText = dailySummaryText.innerHTML; // Store clean version
        
        dailySummaryContent.classList.remove('hidden');
    } catch (error) {
        console.error('Daily Summary Error Details:', error);
        let displayMessage = error.message;

        // If the error is due to JSON parsing of a non-JSON response, it's a SyntaxError.
        if (error instanceof SyntaxError) {
            displayMessage = "Failed to understand server's response. It might be temporarily unavailable.";
            if (response) { // If response object exists
                 displayMessage += ` (Status: ${response.status} ${response.statusText})`;
            }
        }
        
        dailySummaryError.textContent = `Could not load today's summary: ${displayMessage}`;
        dailySummaryError.classList.remove('hidden');
    } finally {
        dailySummaryLoading.classList.add('hidden');
    }
}

// --- Search Functionality ---

function highlightInElement(element, query) {
    if (!element || !query) return false;

    const innerHTML = element.innerHTML;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    
    // Simple check if query exists before complex replacement
    if (!innerHTML.match(regex)) {
        return false; 
    }

    // This is a simplified highlight that might break complex HTML structures.
    // For simple <p>text</p> structures, it should be okay.
    // A more robust solution would involve traversing text nodes.
    const newHTML = innerHTML.replace(regex, '<span class="highlight">$1</span>');
    
    if (newHTML !== innerHTML) {
        element.innerHTML = newHTML;
        return true;
    }
    return false;
}

function clearHighlights() {
    if (originalSummaryContent) {
        summaryContent.innerHTML = originalSummaryContent;
    }
    if (originalDailySummaryText) {
        dailySummaryText.innerHTML = originalDailySummaryText;
    }
    // Remove any stray highlight spans if original content wasn't stored or is empty
    const highlights = document.querySelectorAll('.highlight');
    highlights.forEach(span => {
        // Replace span with its text content
        span.outerHTML = span.innerHTML; 
    });
}


searchBtn.addEventListener('click', () => {
    const query = searchInput.value.trim();
    if (!query) {
        clearHighlights(); // Clear if query is empty
        return;
    }

    // Store original content before highlighting, if not already stored or if content changed
    if (!originalSummaryContent || summaryContent.innerHTML !== originalSummaryContent.replace(/<span class="highlight">(.*?)<\/span>/gi, '$1')) {
        originalSummaryContent = summaryContent.innerHTML.replace(/<span class="highlight">(.*?)<\/span>/gi, '$1');
    }
    if (!originalDailySummaryText || dailySummaryText.innerHTML !== originalDailySummaryText.replace(/<span class="highlight">(.*?)<\/span>/gi, '$1')) {
        originalDailySummaryText = dailySummaryText.innerHTML.replace(/<span class="highlight">(.*?)<\/span>/gi, '$1');
    }
    
    clearHighlights(); // Clear previous highlights before applying new ones

    let foundInMain = false;
    if (summaryContent.offsetParent !== null) { // Check if visible
       foundInMain = highlightInElement(summaryContent, query);
    }

    let foundInDaily = false;
    if (dailySummaryText.offsetParent !== null) { // Check if visible
        foundInDaily = highlightInElement(dailySummaryText, query);
    }

    if (!foundInMain && !foundInDaily) {
        alert('Search term not found.');
    }
});

clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearHighlights();
    originalSummaryContent = ''; // Reset stored content
    originalDailySummaryText = '';
});

searchInput.addEventListener('keyup', (event) => {
    if (event.key === 'Enter') {
        searchBtn.click();
    }
    if (searchInput.value.trim() === '') {
        clearHighlights();
        originalSummaryContent = ''; 
        originalDailySummaryText = '';
    }
});


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
        const response = await fetch(`/api/summarize`, { // Changed to relative path
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ book, chapter }),
        });
        
        if (!response.ok) {
            let errorData;
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                errorData = await response.json();
                throw new Error(errorData.error || `Request failed: ${response.status} ${response.statusText}`);
            } else {
                const responseText = await response.text();
                console.error("Server returned non-JSON error for /api/summarize:", responseText);
                throw new Error(`Server returned an unexpected response: ${response.status} ${response.statusText}`);
            }
        }
        
        const data = await response.json();
        
        // Display results
        chapterTitle.textContent = `${book.charAt(0).toUpperCase() + book.slice(1)} Chapter ${chapter}`;
        summaryContent.innerHTML = data.summary
            .split('\n\n')
            .map(p => `<p>${p}</p>`)
            .join('');
        originalSummaryContent = summaryContent.innerHTML; // Store clean version
        
        // Handle images section
        const imagesSection = document.querySelector('.images-section');
        if (data.images && data.images.length > 0) {
            imagesContainer.innerHTML = data.images
                .map(url => `<img src="${url}" alt="Bible illustration">`)
                .join('');
            imagesSection.classList.remove('hidden');
        } else {
            imagesContainer.innerHTML = ''; // Clear any previous images
            imagesSection.classList.add('hidden'); // Hide images section if no images
        }
        
        // Hide loading, show results
        loadingDiv.classList.add('hidden');
        resultsDiv.classList.remove('hidden');
    } catch (error) {
        console.error('Error during explore:', error);
        loadingDiv.classList.add('hidden');
        let displayMessage = error.message;
        if (error instanceof SyntaxError) { // If JSON parsing failed
            displayMessage = "Failed to understand server's response. It might be temporarily unavailable.";
        }
        alert(`An error occurred: ${displayMessage}. Please try again.`);
    }
});

// Initial calls when DOM is ready
const themeToggleBtn = document.getElementById('theme-toggle-btn');

// Function to set theme
function setTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark-mode');
        themeToggleBtn.textContent = '☀️'; // Sun icon for light mode
        localStorage.setItem('theme', 'dark');
    } else {
        document.body.classList.remove('dark-mode');
        themeToggleBtn.textContent = '🌙'; // Moon icon for dark mode
        localStorage.setItem('theme', 'light');
    }
}

// Event listener for theme toggle button
if (themeToggleBtn) { // Check if button exists, though it should
    themeToggleBtn.addEventListener('click', () => {
        if (document.body.classList.contains('dark-mode')) {
            setTheme('light');
        } else {
            setTheme('dark');
        }
    });
}


document.addEventListener('DOMContentLoaded', () => {
    // Apply saved theme or default to light
    const savedTheme = localStorage.getItem('theme');
    // If there's a saved theme, use it. Otherwise, check system preference.
    // Default to 'light' if no preference or saved theme.
    let currentTheme = 'light'; // Default theme

    if (savedTheme) {
        currentTheme = savedTheme;
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        currentTheme = 'dark'; // Prefer system dark mode if no explicit choice saved
    }
    setTheme(currentTheme);

    fetchAndDisplayDailySummary();
});
