// State Variables
let allRawEntries = [];
let allParsedUpdates = [];
let selectedUpdates = []; // Array of update objects
let currentFilter = 'all';
let currentSearch = '';
let isManuallyEdited = false;

// DOM Elements
const refreshBtn = document.getElementById('refresh-btn');
const refreshIcon = document.getElementById('refresh-icon');
const lastSyncTime = document.getElementById('last-sync-time');
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search-btn');
const filterChipsContainer = document.getElementById('filter-chips-container');
const feedContainer = document.getElementById('feed-container');

// Composer Elements
const composerEmptyState = document.getElementById('composer-empty-state');
const composerActiveState = document.getElementById('composer-active-state');
const digestModeLabel = document.getElementById('digest-mode-label');
const composerModeRadios = document.getElementsByName('composer-mode');
const tweetTextarea = document.getElementById('tweet-textarea');
const charCountSpan = document.getElementById('char-count');
const charProgressCircle = document.getElementById('char-progress');
const charProgressIndicator = charProgressCircle.closest('.char-limit-indicator');
const selectedItemsList = document.getElementById('selected-items-list');
const copyTweetBtn = document.getElementById('copy-tweet-btn');
const clearSelectionBtn = document.getElementById('clear-selection-btn');
const tweetBtn = document.getElementById('tweet-btn');
const characterWarning = document.getElementById('character-warning');
const selectionPill = document.getElementById('selection-pill');

// Toast Notification
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toast-message');

// Max Character limit for standard X (Twitter) post
const MAX_TWEET_CHARS = 280;

// Initialize on DOM Content Loaded
document.addEventListener('DOMContentLoaded', () => {
    fetchReleaseNotes(false);
    setupEventListeners();
});

// Event Listeners Setup
function setupEventListeners() {
    // Refresh Button
    refreshBtn.addEventListener('click', () => {
        fetchReleaseNotes(true);
    });

    // Search Input
    searchInput.addEventListener('input', (e) => {
        currentSearch = e.target.value.toLowerCase().trim();
        clearSearchBtn.style.display = currentSearch.length > 0 ? 'flex' : 'none';
        renderFeed();
    });

    // Clear Search Button
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        currentSearch = '';
        clearSearchBtn.style.display = 'none';
        renderFeed();
        searchInput.focus();
    });

    // Category Filter Chips
    const chips = filterChipsContainer.querySelectorAll('.chip');
    chips.forEach(chip => {
        chip.addEventListener('click', () => {
            chips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentFilter = chip.getAttribute('data-filter');
            renderFeed();
        });
    });

    // Composer Textarea input listener to track character counts
    tweetTextarea.addEventListener('input', () => {
        isManuallyEdited = true;
        updateCharCounter();
    });

    // Composer mode switcher (Single vs Digest)
    composerModeRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            isManuallyEdited = false;
            generateTweetDraft();
        });
    });

    // Composer Actions
    copyTweetBtn.addEventListener('click', copyTweetToClipboard);
    clearSelectionBtn.addEventListener('click', clearAllSelections);
    tweetBtn.addEventListener('click', openTwitterWebIntent);
}

// Fetch Release Notes from Flask API
function fetchReleaseNotes(forceRefresh = false) {
    // Show spinner active and loading state in feed
    refreshIcon.classList.add('active');
    refreshBtn.disabled = true;
    
    if (forceRefresh) {
        showToast('Fetching latest BigQuery release notes...');
    }

    // Set skeleton loading
    feedContainer.innerHTML = `
        <div class="skeleton-container">
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
        </div>
    `;

    const url = `/api/release-notes${forceRefresh ? '?refresh=true' : ''}`;

    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(res => {
            if (res.status === 'success') {
                allRawEntries = res.data;
                lastSyncTime.textContent = res.last_fetched;
                
                // Parse individual update items from entries HTML
                allParsedUpdates = [];
                allRawEntries.forEach(entry => {
                    const parsed = parseEntryContent(entry);
                    allParsedUpdates = allParsedUpdates.concat(parsed);
                });

                showToast(forceRefresh ? 'Feed successfully refreshed!' : 'Release notes loaded.');
                renderFeed();
            } else {
                showToast(`Error: ${res.message}`, true);
                renderErrorState(res.message);
            }
        })
        .catch(error => {
            console.error('Error fetching release notes:', error);
            showToast('Failed to fetch release notes from server.', true);
            renderErrorState(error.message);
        })
        .finally(() => {
            refreshIcon.classList.remove('active');
            refreshBtn.disabled = false;
        });
}

// Normalize Update Category Strings
function normalizeCategory(type) {
    const t = type.toLowerCase().trim();
    if (t.includes('feature')) return 'Feature';
    if (t.includes('announcement')) return 'Announcement';
    if (t.includes('deprecat')) return 'Deprecated';
    if (t.includes('fix')) return 'Fixed';
    if (t.includes('change')) return 'Changed';
    return 'General';
}

// Parse Atom Entry Content HTML
function parseEntryContent(entry) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(entry.content, 'text/html');
    const nodes = Array.from(doc.body.childNodes);
    
    const updates = [];
    let currentType = 'General';
    let currentHtmlNodes = [];
    
    function saveCurrentSection() {
        if (currentHtmlNodes.length > 0) {
            const tempDiv = document.createElement('div');
            // Move nodes into temp wrapper
            currentHtmlNodes.forEach(node => tempDiv.appendChild(node.cloneNode(true)));
            
            const text = tempDiv.innerText.trim();
            if (text.length > 0) {
                updates.push({
                    id: `${entry.id.split('#')[1] || Math.random().toString(36).substr(2, 9)}_${updates.length}`,
                    date: entry.title,
                    isoDate: entry.updated,
                    link: entry.link || `https://cloud.google.com/bigquery/docs/release-notes#${entry.id.split('#')[1]}`,
                    type: normalizeCategory(currentType),
                    originalType: currentType,
                    html: tempDiv.innerHTML,
                    text: text
                });
            }
        }
    }
    
    nodes.forEach(node => {
        // Check if node is a heading (H1-H6)
        if (node.nodeType === Node.ELEMENT_NODE && /^H[1-6]$/i.test(node.tagName)) {
            saveCurrentSection();
            currentType = node.textContent.trim();
            currentHtmlNodes = [];
        } else {
            // Include element nodes or non-empty text nodes
            if (node.nodeType === Node.ELEMENT_NODE || (node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== '')) {
                currentHtmlNodes.push(node);
            }
        }
    });
    
    // Save final section
    saveCurrentSection();
    
    // Fallback if no headings found
    if (updates.length === 0 && entry.content.trim() !== '') {
        updates.push({
            id: `${entry.id.split('#')[1] || Math.random().toString(36).substr(2, 9)}_0`,
            date: entry.title,
            isoDate: entry.updated,
            link: entry.link || `https://cloud.google.com/bigquery/docs/release-notes#${entry.id.split('#')[1]}`,
            type: 'General',
            originalType: 'General',
            html: entry.content,
            text: doc.body.innerText.trim()
        });
    }
    
    return updates;
}

// Render release notes feed based on filters/search
function renderFeed() {
    // 1. Filter and search logic
    const filteredUpdates = allParsedUpdates.filter(update => {
        // Category Filter
        const matchesCategory = currentFilter === 'all' || update.type === currentFilter;
        
        // Search Filter
        const matchesSearch = currentSearch === '' || 
                              update.text.toLowerCase().includes(currentSearch) ||
                              update.type.toLowerCase().includes(currentSearch) ||
                              update.date.toLowerCase().includes(currentSearch);
                              
        return matchesCategory && matchesSearch;
    });

    // Update chip count numbers dynamically based on current search
    updateChipCounts();

    // 2. Empty state rendering
    if (filteredUpdates.length === 0) {
        feedContainer.innerHTML = `
            <div class="empty-feed card">
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <h3>No Updates Found</h3>
                <p>We couldn't find any updates matching "${currentSearch}" in the ${currentFilter === 'all' ? 'entire' : currentFilter} feed. Try clearing the search or choosing another filter.</p>
            </div>
        `;
        return;
    }

    // 3. Build HTML feed cards
    feedContainer.innerHTML = '';
    filteredUpdates.forEach(update => {
        const isChecked = selectedUpdates.some(item => item.id === update.id);
        
        const card = document.createElement('div');
        card.className = `update-card card ${isChecked ? 'selected' : ''}`;
        card.setAttribute('data-id', update.id);
        card.setAttribute('data-category', update.type);
        
        card.innerHTML = `
            <div class="card-header">
                <div class="card-meta">
                    <div class="card-select-checkbox">
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </div>
                    <div class="date-badge">
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        <span>${update.date}</span>
                    </div>
                    <span class="category-badge ${update.type.toLowerCase()}">${update.originalType}</span>
                </div>
                <div class="card-actions">
                    <button class="btn-card-action btn-x-share" title="Generate Tweet draft for this item">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="card-body">
                ${update.html}
            </div>
        `;

        // Card Select click handlers
        // Clicking anywhere on the card toggles it, except clicking link tags
        card.addEventListener('click', (e) => {
            if (e.target.tagName === 'A' || e.target.closest('a')) {
                return; // Let links be clickable directly without triggering select
            }
            
            // If share button is clicked specifically, focus selection to JUST this item and compose
            const shareBtn = e.target.closest('.btn-x-share');
            if (shareBtn) {
                e.stopPropagation();
                setSelectedUpdate(update);
                return;
            }
            
            toggleSelection(update, card);
        });

        feedContainer.appendChild(card);
    });
}

// Render Error State
function renderErrorState(message) {
    feedContainer.innerHTML = `
        <div class="empty-feed card" style="border-left: 4px solid var(--color-deprecated)">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <h3>Connection Error</h3>
            <p>${message || 'Could not reach the BigQuery Release Notes RSS server. Please check your connection and try again.'}</p>
            <button class="btn btn-primary" onclick="fetchReleaseNotes(true)" style="margin-top: 10px;">Retry Connect</button>
        </div>
    `;
}

// Update Filter Chips item counters dynamically
function updateChipCounts() {
    const counts = {
        all: 0,
        Feature: 0,
        Announcement: 0,
        Changed: 0,
        Deprecated: 0,
        Fixed: 0
    };

    allParsedUpdates.forEach(update => {
        // Match current search filter
        const matchesSearch = currentSearch === '' || 
                              update.text.toLowerCase().includes(currentSearch) ||
                              update.type.toLowerCase().includes(currentSearch) ||
                              update.date.toLowerCase().includes(currentSearch);
        
        if (matchesSearch) {
            counts.all++;
            if (counts[update.type] !== undefined) {
                counts[update.type]++;
            }
        }
    });

    // Populate counts in UI
    document.getElementById('count-all').textContent = counts.all;
    document.getElementById('count-feature').textContent = counts.Feature;
    document.getElementById('count-announcement').textContent = counts.Announcement;
    document.getElementById('count-changed').textContent = counts.Changed;
    document.getElementById('count-deprecated').textContent = counts.Deprecated;
    document.getElementById('count-fixed').textContent = counts.Fixed;
}

// Toggle selection state for checkboxes
function toggleSelection(update, cardElement) {
    const index = selectedUpdates.findIndex(item => item.id === update.id);
    
    if (index === -1) {
        selectedUpdates.push(update);
        cardElement.classList.add('selected');
    } else {
        selectedUpdates.splice(index, 1);
        cardElement.classList.remove('selected');
    }

    isManuallyEdited = false;
    onSelectionChange();
}

// Force select only one item (from single share icon)
function setSelectedUpdate(update) {
    // Clear old visual selections
    const cards = feedContainer.querySelectorAll('.update-card');
    cards.forEach(c => c.classList.remove('selected'));
    
    // Add selection class to the matching card in the current view (if exists)
    const card = feedContainer.querySelector(`.update-card[data-id="${update.id}"]`);
    if (card) card.classList.add('selected');

    selectedUpdates = [update];
    isManuallyEdited = false;
    onSelectionChange();
    
    // Scroll composer sidebar into view on mobile
    if (window.innerWidth <= 1024) {
        document.getElementById('composer-sidebar').scrollIntoView({ behavior: 'smooth' });
    }
}

// Handle updates in selection state
function onSelectionChange() {
    const count = selectedUpdates.length;
    selectionPill.textContent = `${count} Selected`;
    
    if (count === 0) {
        composerEmptyState.style.display = 'flex';
        composerActiveState.style.display = 'none';
        return;
    }

    composerEmptyState.style.display = 'none';
    composerActiveState.style.display = 'flex';

    // Toggle single vs digest mode views
    if (count > 1) {
        digestModeLabel.style.display = 'block';
    } else {
        digestModeLabel.style.display = 'none';
        // Auto select single mode if they were in digest but reduced count to 1
        const activeRadio = Array.from(composerModeRadios).find(r => r.checked);
        if (activeRadio && activeRadio.value === 'digest') {
            document.querySelector('input[name="composer-mode"][value="single"]').checked = true;
        }
    }

    // Update selection summary listing in the composer sidebar
    renderSelectedItemsList();
    
    // Generate draft if not manually overridden by typing
    if (!isManuallyEdited) {
        generateTweetDraft();
    } else {
        updateCharCounter();
    }
}

// Render the selected list items under the composer textarea
function renderSelectedItemsList() {
    selectedItemsList.innerHTML = '';
    selectedUpdates.forEach(update => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span><strong>${update.type}:</strong> ${update.date}</span>
            <button title="Remove from selection">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        `;
        
        // Setup remove handler
        li.querySelector('button').addEventListener('click', (e) => {
            e.stopPropagation();
            const card = feedContainer.querySelector(`.update-card[data-id="${update.id}"]`);
            toggleSelection(update, card || document.createElement('div'));
        });

        selectedItemsList.appendChild(li);
    });
}

// Clear all selected items
function clearAllSelections() {
    selectedUpdates = [];
    const cards = feedContainer.querySelectorAll('.update-card');
    cards.forEach(c => c.classList.remove('selected'));
    isManuallyEdited = false;
    onSelectionChange();
    showToast('Selection cleared.');
}

// Generate the draft tweet content based on selections
function generateTweetDraft() {
    const activeRadio = Array.from(composerModeRadios).find(r => r.checked);
    const mode = activeRadio ? activeRadio.value : 'single';
    
    if (selectedUpdates.length === 0) return;
    
    let draftText = '';
    
    if (mode === 'single') {
        const item = selectedUpdates[0];
        const hashtags = "\n\n#BigQuery #GoogleCloud #GCP";
        const linkStr = `\n\nNotes: ${item.link}`;
        
        // Calculate overhead
        const header = `BigQuery Update: ${item.type} (${item.date})\n\n`;
        
        // Base lengths (Twitter treats all links as 23 characters)
        const overheadLength = header.length + 2 + 7 + 23 + hashtags.length; // +2 for newlines, +7 for "Notes: " text, 23 for link
        const maxSummaryLength = MAX_TWEET_CHARS - overheadLength;
        
        let summary = item.text;
        
        // If summary exceeds maximum allowed length, truncate it
        if (summary.length > maxSummaryLength) {
            summary = summary.substring(0, maxSummaryLength - 4) + '...';
        }
        
        draftText = `${header}${summary}${linkStr}${hashtags}`;
    } else {
        // Digest mode: Combine multiple items into a summary listing
        const dates = selectedUpdates.map(u => u.date);
        const uniqueDates = [...new Set(dates)];
        
        // Sort dates chronologically or just show range
        const dateRange = uniqueDates.length > 1 ? `${uniqueDates[uniqueDates.length - 1]} - ${uniqueDates[0]}` : uniqueDates[0];
        
        const header = `Latest #BigQuery Updates (${dateRange}):\n\n`;
        const hashtags = "\n\n#GoogleCloud #GCP";
        
        // Standard link placeholder
        const baseLink = selectedUpdates[0].link.split('#')[0] || "https://cloud.google.com/bigquery/docs/release-notes";
        const linkStr = `\n\nRead more: ${baseLink}`;
        
        // Overhead
        const overheadLength = header.length + 2 + 11 + 23 + hashtags.length; // +2 for newlines, +11 for "Read more: " text, 23 for link
        const maxBulletCharsTotal = MAX_TWEET_CHARS - overheadLength;
        
        let bulletPoints = [];
        
        // Compile short titles/bullets
        selectedUpdates.forEach((item, index) => {
            // Extract a very brief summary (first line or first 60 chars)
            let descSnippet = item.text.split('\n')[0];
            if (descSnippet.length > 60) {
                descSnippet = descSnippet.substring(0, 57) + '...';
            }
            
            bulletPoints.push(`${index + 1}. [${item.type}] ${descSnippet}`);
        });
        
        let bulletsText = bulletPoints.join('\n');
        
        // Truncate bullets if they overflow
        if (bulletsText.length > maxBulletCharsTotal) {
            bulletsText = '';
            for (let i = 0; i < bulletPoints.length; i++) {
                const tempText = bulletsText + (i > 0 ? '\n' : '') + bulletPoints[i];
                if (tempText.length + 4 > maxBulletCharsTotal) {
                    bulletsText += '\n...and more';
                    break;
                }
                bulletsText = tempText;
            }
        }
        
        draftText = `${header}${bulletsText}${linkStr}${hashtags}`;
    }
    
    tweetTextarea.value = draftText;
    updateCharCounter();
}

// Update the character count and circular progress indicator
function updateCharCounter() {
    const text = tweetTextarea.value;
    
    // Calculate length, correcting for links
    // X intent counts any web URL starting with http:// or https:// as 23 characters
    const urlPattern = /https?:\/\/[^\s]+/g;
    const urls = text.match(urlPattern) || [];
    
    let textWithoutUrls = text;
    urls.forEach(url => {
        textWithoutUrls = textWithoutUrls.replace(url, '');
    });
    
    // Calculated character length: base characters without URLs, plus 23 for each unique URL
    const calculatedLength = textWithoutUrls.length + (urls.length * 23);
    
    charCountSpan.textContent = calculatedLength;
    
    // Calculate progress (cap at 100%)
    const progressPercent = Math.min((calculatedLength / MAX_TWEET_CHARS) * 100, 100);
    
    // Circular progress stroke calculation
    // Circle circumference is 2 * Math.PI * r = 2 * 3.14159 * 8 = 50.265
    const circumference = 50.265;
    const offset = circumference - (progressPercent / 100) * circumference;
    charProgressCircle.style.strokeDashoffset = offset;
    
    // Status warning classes based on limits
    charProgressIndicator.classList.remove('warning', 'danger');
    characterWarning.style.display = 'none';
    tweetBtn.disabled = false;
    
    if (calculatedLength > MAX_TWEET_CHARS) {
        charProgressIndicator.classList.add('danger');
        characterWarning.style.display = 'flex';
        tweetBtn.disabled = true;
    } else if (calculatedLength >= 250) {
        charProgressIndicator.classList.add('warning');
    }
}

// Copy Tweet text to clipboard
function copyTweetToClipboard() {
    const text = tweetTextarea.value;
    navigator.clipboard.writeText(text)
        .then(() => {
            showToast('Tweet text copied to clipboard!');
        })
        .catch(err => {
            console.error('Clipboard copy error:', err);
            showToast('Failed to copy to clipboard.', true);
        });
}

// Open Tweet Composer in new tab via X (Twitter) Intent API
function openTwitterWebIntent() {
    const text = tweetTextarea.value;
    
    // Character limit sanity check
    updateCharCounter();
    const count = parseInt(charCountSpan.textContent, 10);
    if (count > MAX_TWEET_CHARS) {
        showToast('Draft is too long! Please shorten it before posting.', true);
        return;
    }

    const xIntentUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(xIntentUrl, '_blank', 'noopener,noreferrer');
    showToast('X Intent Composer opened!');
}

// Display top toast notification
function showToast(message, isError = false) {
    toastMessage.textContent = message;
    
    if (isError) {
        toast.style.borderLeftColor = 'var(--color-deprecated)';
    } else {
        toast.style.borderLeftColor = 'var(--accent-indigo)';
    }
    
    toast.classList.add('show');
    
    // Reset timer
    if (window.toastTimeout) {
        clearTimeout(window.toastTimeout);
    }
    
    window.toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 3500);
}
