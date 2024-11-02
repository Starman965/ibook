import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { 
    getDatabase,
    ref, 
    get
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// DOM Elements
const loadingElement = document.getElementById('loading');
const errorElement = document.getElementById('error');
const contentElement = document.getElementById('content');
const sceneElement = document.getElementById('scene');
const iconContainer = document.getElementById('icon-container');
const textContent = document.getElementById('text-content');

// State management
let currentBook = null;
let currentPageNumber = 1;
let totalPages = 0;

// Get book ID from URL
function getBookId() {
    const pathParts = window.location.pathname.split('/');
    const filename = pathParts[pathParts.length - 1];
    return filename.replace('.html', '');
}

// Show error message
function showError(message) {
    loadingElement.style.display = 'none';
    errorElement.textContent = message;
    errorElement.style.display = 'block';
}

// Handle click/touch navigation
async function goToNextPage(e) {
    // Ignore if clicking on audio controls
    if (e.target.tagName === 'AUDIO' || e.target.closest('audio')) {
        return;
    }

    // Prevent default behavior for touch events
    if (e.type === 'touchend') {
        e.preventDefault();
    }

    // Calculate next page
    currentPageNumber = currentPageNumber >= totalPages ? 1 : currentPageNumber + 1;
    await loadPage(currentPageNumber);
}

// Load page content
async function loadPage(pageNumber) {
    const page = currentBook.pages[pageNumber];
    if (!page) return;

    // Handle existing audio
    const existingAudio = contentElement.querySelector('audio');
    if (existingAudio) {
        existingAudio.pause();
        existingAudio.remove();
    }

    // Update scene image
    sceneElement.innerHTML = page.sceneUrl ? 
        `<img src="${page.sceneUrl}" alt="Scene ${pageNumber}">` : '';

    // Update icon
    iconContainer.innerHTML = page.iconUrl ? 
        `<img src="${page.iconUrl}" alt="Icon ${pageNumber}">` : '';

    // Update text
    textContent.textContent = page.text || '';

    // Add new audio if exists
    if (page.audioUrl) {
        const audio = document.createElement('audio');
        audio.src = page.audioUrl;
        audio.controls = true;
        
        // Wait for audio to be ready before appending and playing
        await new Promise((resolve) => {
            audio.addEventListener('loadeddata', () => {
                contentElement.appendChild(audio);
                audio.play().catch(err => console.log('Autoplay prevented:', err));
                resolve();
            });
            
            // Add error handling
            audio.addEventListener('error', () => {
                console.error('Error loading audio');
                resolve();
            });
        });
    }
}

// Initialize book data
async function loadBookData() {
    try {
        const bookId = getBookId();
        if (!bookId) {
            throw new Error('No book ID provided');
        }

        const bookRef = ref(database, `books/${bookId}`);
        const snapshot = await get(bookRef);
        const book = snapshot.val();

        if (!book || book.status !== 'published') {
            throw new Error('Book not found or not published');
        }

        currentBook = book;
        totalPages = Object.keys(book.pages || {}).length;
        
        // Update page title
        document.title = book.title || 'Interactive Book';

        // Hide loading, show content
        loadingElement.style.display = 'none';
        contentElement.style.display = 'block';

        // Load first page
        await loadPage(1);

        // Add event listeners for navigation
        const elements = [sceneElement, iconContainer, textContent];
        elements.forEach(element => {
            element.addEventListener('click', goToNextPage);
            element.addEventListener('touchend', goToNextPage, { passive: false });
        });

    } catch (error) {
        console.error('Error loading book:', error);
        showError('Unable to load book. Please try again later.');
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadBookData);
} else {
    loadBookData();
}
