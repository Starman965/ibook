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

// Handle page navigation
function handlePageNavigation(e) {
    // Prevent clicking on audio controls from triggering navigation
    if (e.target.tagName === 'AUDIO' || e.target.closest('audio')) {
        return;
    }
    
    console.log(`Current page: ${currentPageNumber}, Total pages: ${totalPages}`); // Debug log
    
    if (currentPageNumber < totalPages) {
        currentPageNumber++;
        loadPage(currentPageNumber);
    } else {
        console.log('At last page'); // Debug log
    }
}

// Load page content
async function loadPage(pageNumber) {
    if (!currentBook || !currentBook.pages || !currentBook.pages[pageNumber]) {
        showError('Page not found');
        return;
    }

    const page = currentBook.pages[pageNumber];
    
    // Clear any existing audio element
    const existingAudio = contentElement.querySelector('audio');
    if (existingAudio) {
        existingAudio.remove();
    }
    
    // Update scene image
    if (page.sceneUrl) {
        sceneElement.innerHTML = `<img src="${page.sceneUrl}" alt="Scene ${pageNumber}">`;
    } else {
        sceneElement.innerHTML = '';
    }
    
    // Update icon
    if (page.iconUrl) {
        iconContainer.innerHTML = `<img src="${page.iconUrl}" alt="Icon ${pageNumber}">`;
    } else {
        iconContainer.innerHTML = '';
    }
    
    // Update text
    if (page.text) {
        textContent.textContent = page.text;
    } else {
        textContent.textContent = '';
    }
    
    // Update audio
    if (page.audioUrl) {
        const audioElement = document.createElement('audio');
        audioElement.src = page.audioUrl;
        audioElement.controls = true;
        contentElement.appendChild(audioElement);
        
        // Auto-play audio when page loads
        try {
            await audioElement.play();
        } catch (error) {
            console.log('Auto-play prevented by browser');
        }
    }
    
    console.log(`Loaded page ${pageNumber} of ${totalPages}`); // Debug log
}

// Load book data
async function loadBookData() {
    try {
        const bookId = getBookId();
        if (!bookId) {
            throw new Error("No book ID provided");
        }

        const bookRef = ref(database, `books/${bookId}`);
        const snapshot = await get(bookRef);
        const book = snapshot.val();

        if (!book || book.status !== "published") {
            throw new Error("Book not found or not published");
        }

        currentBook = book;
        document.title = book.title;

        // Set total pages
        totalPages = Object.keys(book.pages || {}).length;
        currentPageNumber = 1;
        
        console.log(`Book loaded with ${totalPages} pages`); // Debug log

        // Hide loading and show content
        loadingElement.style.display = 'none';
        contentElement.style.display = 'block';

        // Load first page
        loadPage(currentPageNumber);
        
        // Add click handlers after content is loaded
        sceneElement.addEventListener('click', handlePageNavigation);
        iconContainer.addEventListener('click', handlePageNavigation);
        textContent.addEventListener('click', handlePageNavigation);
        contentElement.addEventListener('click', handlePageNavigation);
    } catch (error) {
        console.error('Error loading book:', error);
        showError('Error loading book content. Please try again later.');
    }
}

// Initialize the book
document.addEventListener('DOMContentLoaded', () => {
    loadBookData();
});
