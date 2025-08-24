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
const summaryContentUr = document.getElementById('summary-content-ur');
const imagesContainer = document.getElementById('images-container');
const translationSelect = document.getElementById('translation-select');
const fullChapterToggle = document.getElementById('full-chapter-toggle');
const fullChapter = document.getElementById('full-chapter');
const fullChapterUr = document.getElementById('full-chapter-ur');
const fullChapterLang = document.getElementById('full-chapter-lang');
const btnSummaryLangEn = document.getElementById('summary-lang-en');
const btnSummaryLangUr = document.getElementById('summary-lang-ur');

// Daily Summary DOM elements
const dailySummaryContainer = document.getElementById('daily-summary-container');
const dailySummaryLoading = document.getElementById('daily-summary-loading');
const dailySummaryContent = document.getElementById('daily-summary-content');
const dailySummaryTitle = document.getElementById('daily-summary-title');
const dailySummaryText = document.getElementById('daily-summary-text');
const dailySummaryTextUr = document.getElementById('daily-summary-text-ur');
const dailySummaryError = document.getElementById('daily-summary-error');
const dailySummaryRetry = document.getElementById('daily-summary-retry');
const dailySummaryCitations = document.getElementById('daily-summary-citations');
const btnDailyLangEn = document.getElementById('daily-lang-en');
const btnDailyLangUr = document.getElementById('daily-lang-ur');
const dailySummaryRefresh = document.getElementById('daily-summary-refresh');

// Cache for translated full chapters: key -> book|chapter|translation
const fullChapterUrCache = new Map();

// Search DOM elements
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const clearSearchBtn = document.getElementById('clear-search-btn');

// Store original content to revert highlights
let originalSummaryContent = '';
let originalDailySummaryText = '';

// Function to fetch and display daily summary
async function fetchAndDisplayDailySummary(options = {}) {
    const force = options.force === true;
    let response; // Define response here to access it in catch if needed
    try {
        dailySummaryLoading.classList.remove('hidden');
        dailySummaryLoading.setAttribute('aria-busy', 'true');
        dailySummaryContainer?.setAttribute('aria-busy', 'true');
        dailySummaryContent.classList.add('hidden');
        dailySummaryError.classList.add('hidden');
        if (dailySummaryRetry) dailySummaryRetry.classList.add('hidden');

        const t = translationSelect ? translationSelect.value : 'kjv';
        const today = new Date().toISOString().slice(0, 10);
        const cacheKey = `dailySummary:${today}|${t}`;
        const cooldownKey = `dailySummaryCooldown:${t}`;

        // Respect cooldown set after a 429
        const now = Date.now();
        const cooldownUntil = parseInt(localStorage.getItem(cooldownKey) || '0', 10);
        if (!isNaN(cooldownUntil) && now < cooldownUntil) {
            const secs = Math.ceil((cooldownUntil - now) / 1000);
            dailySummaryError.textContent = `Please wait ${secs}s before trying again (rate limit cooldown).`;
            dailySummaryError.classList.remove('hidden');
            if (dailySummaryRetry) {
                dailySummaryRetry.classList.remove('hidden');
                dailySummaryRetry.disabled = true;
                setTimeout(() => { if (dailySummaryRetry) dailySummaryRetry.disabled = false; }, (cooldownUntil - now));
            }
            return; // Skip calling server during cooldown
        }

        // Try cache first (skip when force refresh)
        if (!force) {
            const cachedRaw = localStorage.getItem(cacheKey);
            if (cachedRaw) {
                try {
                    const data = JSON.parse(cachedRaw);
                    renderDailySummary(data);
                    dailySummaryContent.classList.remove('hidden');
                    if (dailySummaryRetry) dailySummaryRetry.classList.add('hidden');
                    return; // Served from cache
                } catch (_) { /* ignore bad cache */ }
            }
        }

        const url = `/api/daily-summary?translation=${encodeURIComponent(t)}${force ? '&force=true' : ''}`;
        response = await fetch(url); // Assign to outer scope variable

        if (!response.ok) {
            let errorData;
            // Check content type before trying to parse as JSON
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                errorData = await response.json();
                const message = errorData?.details
                    ? `${errorData.error || 'Server error'}: ${errorData.details}`
                    : (errorData.error || `Server error: ${response.status}`);
                throw new Error(message);
            } else {
                // If not JSON, throw a generic error with status text
                const responseText = await response.text(); // Get the text for logging
                console.error("Server returned non-JSON error:", responseText);
                throw new Error(`Server returned an unexpected response: ${response.status} ${response.statusText}`);
            }
        }
        const data = await response.json();
        // Save to cache for the rest of the day
        try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch (_) {}

        renderDailySummary(data);
        dailySummaryContent.classList.remove('hidden');
        if (dailySummaryRetry) dailySummaryRetry.classList.add('hidden');
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
        
        // Set short cooldown after 429s to avoid hammering the API
        if (response && response.status === 429) {
            const cooldownMs = 2 * 60 * 1000; // 2 minutes
            const t = translationSelect ? translationSelect.value : 'kjv';
            const cooldownKey = `dailySummaryCooldown:${t}`;
            try { localStorage.setItem(cooldownKey, String(Date.now() + cooldownMs)); } catch (_) {}
        }

        dailySummaryError.textContent = `Could not load today's summary: ${displayMessage}`;
        dailySummaryError.classList.remove('hidden');
        if (dailySummaryRetry) {
            dailySummaryRetry.classList.remove('hidden');
            dailySummaryRetry.focus();
        }
    } finally {
        dailySummaryLoading.classList.add('hidden');
        dailySummaryLoading.setAttribute('aria-busy', 'false');
        dailySummaryContainer?.setAttribute('aria-busy', 'false');
    }
}

// Helper to render daily summary payload consistently (for cache or fresh data)
function renderDailySummary(data) {
    dailySummaryTitle.textContent = `${data.book} Chapter ${data.chapter} (${data.translation || (translationSelect?.value?.toUpperCase() || 'KJV')})`;
    dailySummaryText.innerHTML = `<p>${data.summary.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;
    if (dailySummaryTextUr) {
        if (data.summaryUr) {
            dailySummaryTextUr.innerHTML = `<p>${data.summaryUr.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;
        } else {
            dailySummaryTextUr.innerHTML = '';
        }
        // Default to English view on refresh
        dailySummaryText.classList.remove('hidden');
        dailySummaryTextUr.classList.add('hidden');
        if (btnDailyLangEn && btnDailyLangUr) {
            btnDailyLangEn.setAttribute('aria-pressed', 'true');
            btnDailyLangUr.setAttribute('aria-pressed', 'false');
        }
    }
    originalDailySummaryText = dailySummaryText.innerHTML; // Store clean version
    // Render citations
    if (dailySummaryCitations) {
        if (Array.isArray(data.citations) && data.citations.length > 0) {
            dailySummaryCitations.classList.remove('hidden');
            dailySummaryCitations.innerHTML = `
                <h3 style="margin-top:8px;">Citations</h3>
                <ul>
                    ${data.citations.map(c => `
                        <li><strong>${c.label}:</strong> ${c.verses.map(v => `(${v.number}) ${v.text}`).join(' ')}</li>
                    `).join('')}
                </ul>
            `;
        } else {
            dailySummaryCitations.classList.add('hidden');
            dailySummaryCitations.innerHTML = '';
        }
    }
}

// Retry handler for Daily Summary
if (dailySummaryRetry) {
    dailySummaryRetry.addEventListener('click', () => {
        fetchAndDisplayDailySummary();
    });
} 

// Refresh handler for Daily Summary
if (dailySummaryRefresh) {
    dailySummaryRefresh.addEventListener('click', async () => {
        const original = dailySummaryRefresh.innerHTML;
        dailySummaryRefresh.disabled = true;
        dailySummaryRefresh.innerHTML = `<span class="spinner spinner--small" aria-hidden="true"></span> Refreshing…`;
        try {
            await fetchAndDisplayDailySummary({ force: true });
        } finally {
            dailySummaryRefresh.disabled = false;
            dailySummaryRefresh.innerHTML = original;
        }
    });
}

// Language toggle helpers
function setAriaPressed(btn, pressed) {
    if (!btn) return;
    btn.setAttribute('aria-pressed', pressed ? 'true' : 'false');
}

// Toggle for main summary English/Urdu
if (btnSummaryLangEn && btnSummaryLangUr && summaryContent && summaryContentUr) {
    btnSummaryLangEn.addEventListener('click', () => {
        summaryContent.classList.remove('hidden');
        summaryContentUr.classList.add('hidden');
        setAriaPressed(btnSummaryLangEn, true);
        setAriaPressed(btnSummaryLangUr, false);
    });
    btnSummaryLangUr.addEventListener('click', () => {
        if (!summaryContentUr.innerHTML.trim()) {
            alert('Urdu translation is not available for this summary.');
            return;
        }
        summaryContent.classList.add('hidden');
        summaryContentUr.classList.remove('hidden');
        setAriaPressed(btnSummaryLangEn, false);
        setAriaPressed(btnSummaryLangUr, true);
    });
}

// Toggle for daily summary English/Urdu
if (btnDailyLangEn && btnDailyLangUr && dailySummaryText && dailySummaryTextUr) {
    btnDailyLangEn.addEventListener('click', () => {
        dailySummaryText.classList.remove('hidden');
        dailySummaryTextUr.classList.add('hidden');
        setAriaPressed(btnDailyLangEn, true);
        setAriaPressed(btnDailyLangUr, false);
    });
    btnDailyLangUr.addEventListener('click', () => {
        if (!dailySummaryTextUr.innerHTML.trim()) {
            alert('Urdu translation is not available for today\'s summary.');
            return;
        }
        dailySummaryText.classList.add('hidden');
        dailySummaryTextUr.classList.remove('hidden');
        setAriaPressed(btnDailyLangEn, false);
        setAriaPressed(btnDailyLangUr, true);
    });
}

// Toggle for full chapter English/Urdu with on-demand translation & caching
const btnFullChapterEn = document.getElementById('full-chapter-lang-en');
const btnFullChapterUr = document.getElementById('full-chapter-lang-ur');
if (btnFullChapterEn && btnFullChapterUr && fullChapter && fullChapterUr && fullChapterLang) {
    btnFullChapterEn.addEventListener('click', () => {
        fullChapter.classList.remove('hidden');
        fullChapterUr.classList.add('hidden');
        setAriaPressed(btnFullChapterEn, true);
        setAriaPressed(btnFullChapterUr, false);
    });
    btnFullChapterUr.addEventListener('click', async () => {
        // Show inline translating loader and disable buttons
        let inlineLoader = document.getElementById('full-chapter-translate-loading');
        if (!inlineLoader) {
            inlineLoader = document.createElement('span');
            inlineLoader.id = 'full-chapter-translate-loading';
            inlineLoader.className = 'inline-loading';
            inlineLoader.innerHTML = `<span class="spinner spinner--small" aria-hidden="true"></span><span class="inline-note">Translating…</span>`;
            fullChapterLang.parentElement.insertBefore(inlineLoader, fullChapterLang.nextSibling);
        }
        inlineLoader.classList.remove('hidden');
        btnFullChapterEn.disabled = true;
        btnFullChapterUr.disabled = true;
        // Build cache key from current header text
        const title = chapterTitle?.textContent || '';
        const m = title.match(/^(.*?) Chapter (\d+)/i);
        if (!m) return;
        const book = m[1].trim();
        const chap = m[2];
        const t = translationSelect ? translationSelect.value : 'kjv';
        const key = `${book}|${chap}|${t}`;

        if (!fullChapterUrCache.has(key)) {
            try {
                const plain = fullChapter.innerText || '';
                const resp = await fetch('/api/translate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: plain, targetLang: 'Urdu' })
                });
                if (resp.ok) {
                    const j = await resp.json();
                    // Preserve newlines as paragraphs
                    const html = (j.translatedText || '').split(/\n+/).map(p => `<p>${p}</p>`).join('');
                    fullChapterUrCache.set(key, html);
                } else {
                    fullChapterUrCache.set(key, '<p>Urdu translation unavailable.</p>');
                }
            } catch (e) {
                fullChapterUrCache.set(key, '<p>Urdu translation failed.</p>');
            }
        }

        fullChapterUr.innerHTML = fullChapterUrCache.get(key);
        fullChapter.classList.add('hidden');
        fullChapterUr.classList.remove('hidden');
        setAriaPressed(btnFullChapterEn, false);
        setAriaPressed(btnFullChapterUr, true);
        // Hide loader and re-enable buttons
        if (inlineLoader) inlineLoader.classList.add('hidden');
        btnFullChapterEn.disabled = false;
        btnFullChapterUr.disabled = false;
    });
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


// Populate book select with Testament grouping
if (bookSelect) {
    // First 39 books are Old Testament (Genesis .. Malachi)
    const otBooks = bibleBooks.slice(0, 39);
    const ntBooks = bibleBooks.slice(39);

    const otGroup = document.createElement('optgroup');
    otGroup.label = 'Old Testament';
    otGroup.setAttribute('aria-label', 'Old Testament');

    otBooks.forEach(book => {
        const option = document.createElement('option');
        option.value = book.name.toLowerCase();
        option.textContent = book.name;
        otGroup.appendChild(option);
    });

    const ntGroup = document.createElement('optgroup');
    ntGroup.label = 'New Testament';
    ntGroup.setAttribute('aria-label', 'New Testament');

    ntBooks.forEach(book => {
        const option = document.createElement('option');
        option.value = book.name.toLowerCase();
        option.textContent = book.name;
        ntGroup.appendChild(option);
    });

    bookSelect.appendChild(otGroup);
    bookSelect.appendChild(ntGroup);
}

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
    const translation = translationSelect ? translationSelect.value : 'kjv';
    
    if (!book || !chapter) {
        alert('Please select both a book and a chapter');
        return;
    }
    
    // Show loading, hide results + inline spinner on button
    loadingDiv.classList.remove('hidden');
    resultsDiv.classList.add('hidden');
    const originalExploreHtml = exploreBtn.innerHTML;
    exploreBtn.disabled = true;
    exploreBtn.innerHTML = `<span class="spinner spinner--small" aria-hidden="true"></span> Exploring...`;
    
    try {
        const response = await fetch(`/api/summarize`, { // Changed to relative path
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ book, chapter, translation }),
        });
        
        if (!response.ok) {
            let errorData;
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                errorData = await response.json();
                const message = errorData?.details
                    ? `${errorData.error || 'Request failed'}: ${errorData.details}`
                    : (errorData.error || `Request failed: ${response.status} ${response.statusText}`);
                throw new Error(message);
            } else {
                const responseText = await response.text();
                console.error("Server returned non-JSON error for /api/summarize:", responseText);
                throw new Error(`Server returned an unexpected response: ${response.status} ${response.statusText}`);
            }
        }
        
        const data = await response.json();
        
        // Display results
        const tLabel = (data.translation || translation.toUpperCase());
        chapterTitle.textContent = `${book.charAt(0).toUpperCase() + book.slice(1)} Chapter ${chapter} (${tLabel})`;
        summaryContent.innerHTML = data.summary
            .split('\n\n')
            .map(p => `<p>${p}</p>`)
            .join('');
        originalSummaryContent = summaryContent.innerHTML; // Store clean version
        // Urdu summary if available
        if (summaryContentUr) {
            if (data.summaryUr) {
                summaryContentUr.innerHTML = data.summaryUr
                    .split('\n\n')
                    .map(p => `<p>${p}</p>`)
                    .join('');
            } else {
                summaryContentUr.innerHTML = '';
            }
        }
        // Hide and clear citations under main summary (requested: do not show)
        const summaryCitations = document.getElementById('summary-citations');
        if (summaryCitations) {
            summaryCitations.innerHTML = '';
            summaryCitations.classList.add('hidden');
        }
        
        // Handle images section
        const imagesSection = document.querySelector('.images-section');
        if (data.images && data.images.length > 0) {
            imagesContainer.innerHTML = data.images
                .map(url => `<img src="${url}" alt="Bible illustration">`)
                .join('');
            if (imagesSection) imagesSection.classList.remove('hidden');
        } else {
            imagesContainer.innerHTML = ''; // Clear any previous images
            if (imagesSection) imagesSection.classList.add('hidden'); // Hide images section if no images
        }
        
        // Hide loading, show results
        loadingDiv.classList.add('hidden');
        resultsDiv.classList.remove('hidden');

        // Render full chapter verses and enable toggle
        if (fullChapter && fullChapterToggle) {
            const escapeHtml = (s) => String(s)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/\"/g, '&quot;')
                .replace(/'/g, '&#39;');

            let versesHtml = '';
            if (Array.isArray(data.verses) && data.verses.length > 0) {
                versesHtml = data.verses
                    .map(v => `<p><strong>(${v.number})</strong> ${escapeHtml(v.text).trim()}</p>`)
                    .join('');
            } else if (data.passageText) {
                versesHtml = data.passageText
                    .split('\n')
                    .map(line => `<p>${escapeHtml(line)}</p>`)
                    .join('');
            } else {
                versesHtml = '<p>Full chapter text is unavailable.</p>';
            }

            fullChapter.innerHTML = versesHtml;
            fullChapter.classList.add('hidden');
            fullChapterToggle.style.display = 'inline-block';
            fullChapterToggle.textContent = 'Show Full Chapter';
            fullChapterToggle.setAttribute('aria-expanded', 'false');
            if (fullChapterLang) fullChapterLang.classList.add('hidden');
            if (fullChapterUr) fullChapterUr.classList.add('hidden');

            if (!fullChapterToggle.dataset.bound) {
                fullChapterToggle.addEventListener('click', () => {
                    const isHidden = fullChapter.classList.contains('hidden');
                    if (isHidden) {
                        fullChapter.classList.remove('hidden');
                        fullChapterToggle.textContent = 'Hide Full Chapter';
                        fullChapterToggle.setAttribute('aria-expanded', 'true');
                        if (fullChapterLang) fullChapterLang.classList.remove('hidden');
                    } else {
                        fullChapter.classList.add('hidden');
                        fullChapterToggle.textContent = 'Show Full Chapter';
                        fullChapterToggle.setAttribute('aria-expanded', 'false');
                        if (fullChapterLang) fullChapterLang.classList.add('hidden');
                        if (fullChapterUr) fullChapterUr.classList.add('hidden');
                    }
                });
                fullChapterToggle.dataset.bound = '1';
            }
        }
    } catch (error) {
        console.error('Error during explore:', error);
        loadingDiv.classList.add('hidden');
        let displayMessage = error.message;
        if (error instanceof SyntaxError) { // If JSON parsing failed
            displayMessage = "Failed to understand server's response. It might be temporarily unavailable.";
        }
        alert(`An error occurred: ${displayMessage}. Please try again.`);
    } finally {
        // Restore Explore button
        exploreBtn.disabled = false;
        exploreBtn.innerHTML = originalExploreHtml;
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
