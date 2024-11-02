import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// State management
let currentPage = 1;
let totalPages = 0;
let bookData = null;
let currentAudio = null;
let isTransitioning = false;

// DOM Elements
const rootElement = document.getElementById('root');
const loadingElement = document.getElementById('loading');
const errorElement = document.getElementById('error');

// Get book ID from URL
const bookId = window.location.pathname.split('/').pop().replace('.html', '');

// Initialize book
async function initializeBook() {
    try {
        const bookRef = ref(database, `books/${bookId}`);
        const snapshot = await get(bookRef);
        bookData = snapshot.val();
        
        if (!bookData || bookData.status !== 'published') {
            showError();
            return;
        }

        totalPages = Object.keys(bookData.pages).length;
        renderBook();
        setupEventListeners();
        hideLoading();
    } catch (error) {
        console.error('Error loading book:', error);
        showError();
    }
}

// Show/hide loading and error states
function showError() {
    loadingElement.style.display = 'none';
    errorElement.style.display = 'block';
}

function hideLoading() {
    loadingElement.style.display = 'none';
    rootElement.style.display = 'block';
}

// Render book structure
function renderBook() {
    const navigation = document.createElement('div');
    navigation.className = 'navigation';
    navigation.innerHTML = `
        <button class="nav-button prev-page" aria-label="Previous page">←</button>
        <button class="nav-button next-page" aria-label="Next page">→</button>
    `;

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

    rootElement.innerHTML = pages;
    rootElement.appendChild(navigation);
}

// Setup event listeners
function setupEventListeners() {
    // Navigation buttons
    document.querySelector('.prev-page').addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent triggering the root click
        navigatePage('prev');
    });
    
    document.querySelector('.next-page').addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent triggering the root click
        navigatePage('next');
    });

    // Click/tap navigation
    rootElement.addEventListener('click', (e) => {
        // Don't navigate if clicking on audio controls or navigation buttons
        if (!e.target.closest('.audio-control') && !e.target.closest('.navigation')) {
            navigatePage('next');
        }
    });

    // Touch events for mobile
    let touchStartX = 0;
    rootElement.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
    });

    rootElement.addEventListener('touchend', (e) => {
        const touchEndX = e.changedTouches[0].clientX;
        const diff = touchStartX - touchEndX;

        // If it's a small movement (tap) rather than a swipe
        if (Math.abs(diff) < 50) {
            // Don't navigate if tapping on audio controls or navigation buttons
            if (!e.target.closest('.audio-control') && !e.target.closest('.navigation')) {
                navigatePage('next');
            }
        }
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
            navigatePage('prev');
        } else if (e.key === 'ArrowRight' || e.key === ' ') {
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
    });
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

    // Play audio of new page if available
    const nextAudioElement = nextPageElement.querySelector('audio');
    if (nextAudioElement) {
        // Small delay to let the transition complete
        setTimeout(() => {
            nextAudioElement.play();
        }, 100);
    }

    currentPage = nextPage;
    
    // Reset transition lock after animation completes
    setTimeout(() => {
        isTransitioning = false;
    }, 300);
}

// Initialize the book when the page loads
document.addEventListener('DOMContentLoaded', initializeBook);
