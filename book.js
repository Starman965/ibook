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

// Get book ID from URL
const bookId = window.location.pathname.split('/').pop().replace('.html', '');

// Initialize book
async function initializeBook() {
    try {
        const bookRef = ref(database, `books/${bookId}`);
        const snapshot = await get(bookRef);
        const bookData = snapshot.val();
        
        if (!bookData || bookData.status !== 'published') {
            document.getElementById('root').innerHTML = '<div class="error">Book not found or not published</div>';
            return;
        }

        totalPages = Object.keys(bookData.pages).length;
        renderBook(bookData);
        setupEventListeners();
        checkAutoplaySupport();
    } catch (error) {
        console.error('Error loading book:', error);
        document.getElementById('root').innerHTML = '<div class="error">Error loading book</div>';
    }
}

// Render book structure
function renderBook(bookData) {
    const navigation = document.createElement('div');
    navigation.className = 'navigation';
    navigation.innerHTML = `
        <button class="nav-button prev-page" aria-label="Previous page">←</button>
        <button class="nav-button next-page" aria-label="Next page">→</button>
    `;

    // Add autoplay message element
    const autoplayMessage = document.createElement('div');
    autoplayMessage.className = 'audio-autoplay-message';
    autoplayMessage.textContent = 'Tap anywhere to enable audio autoplay';

    const pages = Object.entries(bookData.pages)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .map(([pageNum, page]) => `
            <div class="page ${pageNum === '1' ? 'active' : ''}" data-page="${pageNum}">
                <div class="page-content">
                    ${page.iconUrl ? `<img src="${page.iconUrl}" alt="Icon" class="page-icon">` : ''}
                    ${page.sceneUrl ? `<img src="${page.sceneUrl}" alt="Scene" class="page-image">` : ''}
                    <div class="page-text">${page.text || ''}</div>
                    ${page.audioUrl ? `
                        <div class="audio-control">
                            <audio src="${page.audioUrl}" preload="auto"></audio>
                        </div>
                    ` : ''}
                </div>
                <div class="page-number">Page ${pageNum} of ${totalPages}</div>
            </div>
        `).join('');

    const root = document.getElementById('root');
    root.innerHTML = pages;
    root.appendChild(navigation);
    document.body.appendChild(autoplayMessage);
}

// Setup event listeners
function setupEventListeners() {
    const root = document.getElementById('root');
    
    // Navigation buttons
    document.querySelector('.prev-page').addEventListener('click', (e) => {
        e.stopPropagation();
        navigatePage('prev');
    });
    
    document.querySelector('.next-page').addEventListener('click', (e) => {
        e.stopPropagation();
        navigatePage('next');
    });

    // Click/tap navigation
    root.addEventListener('click', (e) => {
        // Don't navigate if clicking on audio controls or navigation buttons
        if (!e.target.closest('.audio-control') && !e.target.closest('.navigation')) {
            if (!autoplayEnabled) {
                enableAutoplay();
            }
            navigatePage('next');
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

        // Handle audio end
        audio.addEventListener('ended', () => {
            currentAudio = null;
        });
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
            navigatePage('prev');
        } else if (e.key === 'ArrowRight' || e.key === ' ') {
            navigatePage('next');
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

// Navigate between pages
function navigatePage(direction) {
    if (isTransitioning) return;
    isTransitioning = true;

    const currentPageElement = document.querySelector(`.page[data-page="${currentPage}"]`);
    let nextPage;

    if (direction === 'next') {
        nextPage = currentPage >= totalPages ? 1 : currentPage + 1;
    } else {
        nextPage = currentPage <= 1 ? totalPages : currentPage - 1;
    }

    // Handle audio
    const currentAudioElement = currentPageElement.querySelector('audio');
    if (currentAudioElement) {
        currentAudioElement.pause();
        currentAudioElement.currentTime = 0;
    }

    // Update page visibility
    currentPageElement.classList.remove('active');
    const nextPageElement = document.querySelector(`.page[data-page="${nextPage}"]`);
    nextPageElement.classList.add('active');

    // Play audio of new page if available and autoplay is enabled
    const nextAudioElement = nextPageElement.querySelector('audio');
    if (nextAudioElement && autoplayEnabled) {
        setTimeout(() => {
            nextAudioElement.play().catch(() => {
                console.log('Audio autoplay failed');
            });
        }, 100);
    }

    currentPage = nextPage;
    
    setTimeout(() => {
        isTransitioning = false;
    }, 300);
}

// Initialize the book when the page loads
document.addEventListener('DOMContentLoaded', initializeBook);
