import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// State management
let currentPage = 1;
let totalPages = 0;
let currentAudio = null;
let isTransitioning = false;
let autoplayEnabled = false;
let bookData = null;

// Get book ID from URL parameters
function getBookId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

// Initialize book
async function initializeBook() {
    try {
        const bookId = getBookId();
        console.log('Loading book:', bookId);
        
        if (!bookId) {
            document.getElementById('root').innerHTML = '<div class="error">No book specified</div>';
            return;
        }

        const bookRef = ref(database, `books/${bookId}`);
        const snapshot = await get(bookRef);
        bookData = snapshot.val();
        
        console.log('Book data:', bookData);
        
        if (!bookData || bookData.status !== 'published') {
            document.getElementById('root').innerHTML = '<div class="error">Book not found or not published</div>';
            return;
        }

        totalPages = Object.keys(bookData.pages).length;
        renderBook(bookData);
        setupEventListeners();
        createPageNavigation(bookData);
        checkAutoplaySupport();
    } catch (error) {
        console.error('Error loading book:', error);
        document.getElementById('root').innerHTML = '<div class="error">Error loading book: ' + error.message + '</div>';
    }
}

// Create page navigation
function createPageNavigation(bookData) {
    const navigation = document.createElement('div');
    navigation.className = 'page-navigation';
    
    const sortedPages = Object.entries(bookData.pages)
        .sort(([a], [b]) => parseInt(a) - parseInt(b));

    sortedPages.forEach(([pageNum, page]) => {
        const button = document.createElement('button');
        button.className = `page-nav-button ${pageNum === '1' ? 'active' : ''}`;
        button.setAttribute('data-page', pageNum);
        
        // Create image container
        const imgContainer = document.createElement('div');
        imgContainer.className = 'nav-image-container';
        
        // Add icon image
        if (page.iconUrl) {
            const img = document.createElement('img');
            img.src = page.iconUrl;
            img.alt = `Page ${pageNum}`;
            img.className = 'nav-icon';
            imgContainer.appendChild(img);
        }
        
        button.appendChild(imgContainer);
        button.addEventListener('click', () => navigateToPage(parseInt(pageNum)));
        navigation.appendChild(button);
    });

    document.body.appendChild(navigation);
}

// Render book structure
function renderBook(bookData) {
    // Add autoplay message element
    const autoplayMessage = document.createElement('div');
    autoplayMessage.className = 'audio-autoplay-message';
    autoplayMessage.textContent = 'Tap anywhere to enable audio autoplay';

    const pages = Object.entries(bookData.pages)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .map(([pageNum, page]) => `
            <div class="page ${pageNum === '1' ? 'active' : ''}" data-page="${pageNum}">
                <div class="page-content">
                    ${page.sceneUrl ? `<img src="${page.sceneUrl}" alt="Scene" class="page-image">` : ''}
                    <div class="page-text">${page.text || ''}</div>
                    ${page.audioUrl ? `
                        <div class="audio-control">
                            <audio src="${page.audioUrl}" preload="auto"></audio>
                        </div>
                    ` : ''}
                </div>
            </div>
        `).join('');

    const root = document.getElementById('root');
    root.innerHTML = pages;
    document.body.appendChild(autoplayMessage);
}

// Navigate to specific page
function navigateToPage(targetPage) {
    if (isTransitioning || targetPage === currentPage) return;
    isTransitioning = true;

    // Update navigation buttons
    document.querySelectorAll('.page-nav-button').forEach(button => {
        button.classList.toggle('active', parseInt(button.dataset.page) === targetPage);
    });

    // Handle page transition
    const currentPageElement = document.querySelector(`.page[data-page="${currentPage}"]`);
    const nextPageElement = document.querySelector(`.page[data-page="${targetPage}"]`);

    // Handle audio
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
    }

    // Update page visibility
    currentPageElement.classList.remove('active');
    nextPageElement.classList.add('active');

    // Play audio of new page if available and autoplay is enabled
    const nextAudioElement = nextPageElement.querySelector('audio');
    if (nextAudioElement && autoplayEnabled) {
        setTimeout(() => {
            nextAudioElement.play().catch(console.log);
        }, 100);
    }

    currentPage = targetPage;
    
    setTimeout(() => {
        isTransitioning = false;
    }, 300);
}

// Setup event listeners
function setupEventListeners() {
    const root = document.getElementById('root');

    // Click/tap navigation
    root.addEventListener('click', (e) => {
        if (!e.target.closest('.audio-control') && !e.target.closest('.page-navigation')) {
            if (!autoplayEnabled) {
                enableAutoplay();
            }
            const nextPage = currentPage >= totalPages ? 1 : currentPage + 1;
            navigateToPage(nextPage);
        }
    });

    // Audio management
    document.querySelectorAll('audio').forEach(audio => {
        audio.addEventListener('play', () => {
            if (currentAudio && currentAudio !== audio) {
                currentAudio.pause();
                currentAudio.currentTime = 0;
            }
            currentAudio = audio;
        });

        audio.addEventListener('ended', () => {
            currentAudio = null;
        });
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
            const prevPage = currentPage <= 1 ? totalPages : currentPage - 1;
            navigateToPage(prevPage);
        } else if (e.key === 'ArrowRight' || e.key === ' ') {
            const nextPage = currentPage >= totalPages ? 1 : currentPage + 1;
            navigateToPage(nextPage);
        }
    });
}

// Check autoplay support
async function checkAutoplaySupport() {
    const audio = document.querySelector('audio');
    if (!audio) return;

    try {
        await audio.play();
        audio.pause();
        audio.currentTime = 0;
        autoplayEnabled = true;
        document.querySelector('.audio-autoplay-message').classList.remove('show');
    } catch (error) {
        console.log('Autoplay not allowed initially');
        document.querySelector('.audio-autoplay-message').classList.add('show');
    }
}

// Enable autoplay
function enableAutoplay() {
    autoplayEnabled = true;
    const message = document.querySelector('.audio-autoplay-message');
    if (message) {
        message.classList.remove('show');
    }
}

// Initialize the book when the page loads
document.addEventListener('DOMContentLoaded', initializeBook);
