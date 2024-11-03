import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { 
    getDatabase,
    ref, 
    set, 
    onValue,
    get,
    push,
    update,
    remove
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";
import {
    getStorage,
    ref as storageRef,
    uploadBytes,
    getDownloadURL,
    deleteObject
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";

// Initialize Firebase
console.log('Initializing Firebase...');
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const storage = getStorage(app);

// DOM Elements
const bookList = document.querySelector('.book-list');
const addBookBtn = document.querySelector('.add-book-btn');
const bookTitleInput = document.getElementById('book-title');
const coverUpload = document.getElementById('cover-upload');
const coverPreview = coverUpload.querySelector('.asset-preview');
const pagesContainer = document.getElementById('pages-container');
const addPageBtn = document.getElementById('add-page-btn');

// State management
let selectedBookId = null;
let currentBook = null;
let currentPages = {};

// Show save indicator
function showSaveIndicator(message = 'Saving...') {
    const indicator = document.createElement('div');
    indicator.style.position = 'fixed';
    indicator.style.top = '20px';
    indicator.style.right = '20px';
    indicator.style.padding = '10px 20px';
    indicator.style.backgroundColor = '#1a73e8';
    indicator.style.color = 'white';
    indicator.style.borderRadius = '4px';
    indicator.style.zIndex = '1000';
    indicator.textContent = message;
    document.body.appendChild(indicator);
    
    setTimeout(() => {
        indicator.textContent = 'Saved!';
        setTimeout(() => {
            document.body.removeChild(indicator);
        }, 1000);
    }, 500);
}

// Initialize books listener
function initializeBooksListener() {
    console.log('Setting up books listener...');
    const booksRef = ref(database, 'books');
    onValue(booksRef, (snapshot) => {
        const books = snapshot.val() || {};
        console.log('Books updated:', books);
        renderBookList(books);
    });
}

// Render book list
function renderBookList(books) {
    bookList.innerHTML = '';
    Object.entries(books).forEach(([id, book]) => {
        const li = document.createElement('li');
        li.className = `book-item ${selectedBookId === id ? 'selected' : ''}`;
        li.dataset.id = id;
        li.innerHTML = `
            <span>${book.title || 'Untitled Book'}</span>
            <span class="status-badge status-${book.status || 'draft'}" data-id="${id}">
                ${book.status || 'draft'}
            </span>
        `;
        li.addEventListener('click', () => selectBook(id));
        
        // Add click handler for status badge
        const statusBadge = li.querySelector('.status-badge');
        statusBadge.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleBookStatus(id);
        });
        
        bookList.appendChild(li);
    });
}

// Page template function
function createPageHTML(pageNumber, pageData = {}) {
    return `
        <div class="page-card" data-page="${pageNumber}">
            <div class="page-header">
                <span class="page-number">Page ${pageNumber}</span>
                <div class="page-controls">
                    ${pageNumber > 1 ? '<button class="page-control-btn move-up">↑</button>' : ''}
                    ${pageNumber < Object.keys(currentPages).length ? '<button class="page-control-btn move-down">↓</button>' : ''}
                    <button class="page-control-btn delete-page">×</button>
                </div>
            </div>
            <div class="asset-section">
                <div class="asset-upload" data-type="icon">
                    <div class="asset-preview">
                        ${pageData.iconUrl ? `<img src="${pageData.iconUrl}" alt="Icon">` : 'Drop icon here'}
                    </div>
                    <span>Icon</span>
                </div>
                <div class="asset-upload" data-type="scene">
                    <div class="asset-preview">
                        ${pageData.sceneUrl ? `<img src="${pageData.sceneUrl}" alt="Scene">` : 'Drop scene here'}
                    </div>
                    <span>Scene</span>
                </div>
                <div class="asset-upload" data-type="audio">
                    <div class="asset-preview">
                        ${pageData.audioUrl ? `<audio controls src="${pageData.audioUrl}" class="audio-preview"></audio>` : 'Drop audio here'}
                    </div>
                    <span>Audio</span>
                </div>
            </div>
            <textarea class="page-text" placeholder="Enter page text">${pageData.text || ''}</textarea>
        </div>
    `;
}
// Select a book
async function selectBook(bookId) {
    console.log('Selecting book:', bookId);
    selectedBookId = bookId;
    const bookRef = ref(database, `books/${bookId}`);
    const snapshot = await get(bookRef);
    currentBook = snapshot.val();
    
    // Update UI
    bookTitleInput.value = currentBook.title || '';
    updateCoverPreview(currentBook.coverUrl);
    
    // Load and render pages
    await loadPages();
    
    // Update selected state in list
    document.querySelectorAll('.book-item').forEach(item => {
        item.classList.remove('selected');
        if (item.dataset.id === bookId) {
            item.classList.add('selected');
        }
    });
}

// Update cover preview
function updateCoverPreview(url) {
    if (url) {
        coverPreview.innerHTML = `<img src="${url}" alt="Book cover">`;
    } else {
        coverPreview.innerHTML = '<span>Drop cover image here or click to upload</span>';
    }
}

// Load pages for selected book
async function loadPages() {
    if (!selectedBookId) return;
    
    const pagesRef = ref(database, `books/${selectedBookId}/pages`);
    const snapshot = await get(pagesRef);
    currentPages = snapshot.val() || {};
    renderPages();
}

// Render all pages
function renderPages() {
    pagesContainer.innerHTML = '';
    Object.entries(currentPages)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .forEach(([pageNumber, pageData]) => {
            pagesContainer.innerHTML += createPageHTML(parseInt(pageNumber), pageData);
        });
    
    // Update add page button state
    addPageBtn.disabled = Object.keys(currentPages).length >= 10;
    
    // Add event listeners to new elements
    attachPageEventListeners();
}

// Create new book
async function createNewBook() {
    console.log('Creating new book...');
    const booksRef = ref(database, 'books');
    const newBookRef = push(booksRef);
    const newBook = {
        title: 'Untitled Book',
        status: 'draft',
        createdAt: new Date().toISOString(),
        pages: {}
    };
    
    await set(newBookRef, newBook);
    showSaveIndicator('Book created!');
    selectBook(newBookRef.key);
}

// Upload file to Firebase Storage
async function uploadFile(file, path) {
    console.log('Uploading file:', path);
    const fileRef = storageRef(storage, path);
    try {
        const snapshot = await uploadBytes(fileRef, file);
        console.log('File uploaded successfully');
        const url = await getDownloadURL(fileRef);
        console.log('Download URL:', url);
        return url;
    } catch (error) {
        console.error('Error uploading file:', error);
        throw error;
    }
}

// Handle file upload for cover
async function handleCoverUpload(file) {
    if (!file || !selectedBookId) return;
    
    try {
        showSaveIndicator('Uploading cover...');
        const path = `books/${selectedBookId}/cover.jpg`;
        const url = await uploadFile(file, path);
        await update(ref(database), {
            [`books/${selectedBookId}/coverUrl`]: url
        });
        updateCoverPreview(url);
        showSaveIndicator('Cover uploaded!');
    } catch (error) {
        console.error('Error uploading cover:', error);
        showSaveIndicator('Error uploading cover');
    }
}

// Add a new page
async function addPage() {
    if (Object.keys(currentPages).length >= 10) return;
    
    const newPageNumber = Object.keys(currentPages).length + 1;
    const pageData = {
        text: '',
        order: newPageNumber,
        createdAt: new Date().toISOString()
    };
    
    currentPages[newPageNumber] = pageData;
    await update(ref(database), {
        [`books/${selectedBookId}/pages/${newPageNumber}`]: pageData
    });
    
    renderPages();
}

// Move page up or down
async function movePage(pageNumber, direction) {
    const targetNumber = direction === 'up' ? pageNumber - 1 : pageNumber + 1;
    if (targetNumber < 1 || targetNumber > Object.keys(currentPages).length) return;
    
    // Swap pages
    const tempPage = currentPages[pageNumber];
    currentPages[pageNumber] = currentPages[targetNumber];
    currentPages[targetNumber] = tempPage;
    
    // Update database
    await update(ref(database), {
        [`books/${selectedBookId}/pages/${pageNumber}`]: currentPages[pageNumber],
        [`books/${selectedBookId}/pages/${targetNumber}`]: currentPages[targetNumber]
    });
    
    renderPages();
}

// Delete page
async function deletePage(pageNumber) {
    if (!confirm(`Delete page ${pageNumber}?`)) return;
    
    // Delete from storage if assets exist
    const page = currentPages[pageNumber];
    if (page.iconUrl) await deleteObject(storageRef(storage, page.iconUrl));
    if (page.sceneUrl) await deleteObject(storageRef(storage, page.sceneUrl));
    if (page.audioUrl) await deleteObject(storageRef(storage, page.audioUrl));
    
    // Remove from database
    delete currentPages[pageNumber];
    await remove(ref(database, `books/${selectedBookId}/pages/${pageNumber}`));
    
    // Reorder remaining pages
    const updates = {};
    Object.entries(currentPages)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .forEach(([oldNumber, pageData], index) => {
            const newNumber = index + 1;
            if (oldNumber !== newNumber.toString()) {
                updates[`books/${selectedBookId}/pages/${newNumber}`] = pageData;
                delete currentPages[oldNumber];
                currentPages[newNumber] = pageData;
            }
        });
    
    if (Object.keys(updates).length) {
        await update(ref(database), updates);
    }
    
    renderPages();
}

// Handle asset upload
async function handleAssetUpload(file, pageNumber, assetType) {
    if (!file || !selectedBookId) return;
    
    try {
        showSaveIndicator(`Uploading ${assetType}...`);
        const extension = assetType === 'audio' ? 'mp3' : 'jpg';
        const path = `books/${selectedBookId}/pages/${pageNumber}/${assetType}.${extension}`;
        const url = await uploadFile(file, path);
        
        currentPages[pageNumber] = {
            ...currentPages[pageNumber],
            [`${assetType}Url`]: url
        };
        
        await update(ref(database), {
            [`books/${selectedBookId}/pages/${pageNumber}/${assetType}Url`]: url
        });
        
        renderPages();
        showSaveIndicator(`${assetType} uploaded!`);
    } catch (error) {
        console.error(`Error uploading ${assetType}:`, error);
        showSaveIndicator(`Error uploading ${assetType}`);
    }
}

// Handle page text update
async function updatePageText(pageNumber, text) {
    if (!selectedBookId) return;
    
    currentPages[pageNumber] = {
        ...currentPages[pageNumber],
        text
    };
    
    await update(ref(database), {
        [`books/${selectedBookId}/pages/${pageNumber}/text`]: text
    });
}

// Toggle book status
async function toggleBookStatus(bookId) {
    if (!bookId) return;
    
    const newStatus = currentBook.status === 'published' ? 'draft' : 'published';
    await update(ref(database), {
        [`books/${bookId}/status`]: newStatus
    });
    
    showSaveIndicator(`Book ${newStatus}!`);
}

// Update book title
async function updateBookTitle(title) {
    if (!selectedBookId) return;
    console.log('Updating book title:', title);
    const updates = {
        [`books/${selectedBookId}/title`]: title
    };
    await update(ref(database), updates);
    showSaveIndicator();
}

// Attach event listeners
function attachPageEventListeners() {
    // Move page up/down
    document.querySelectorAll('.move-up, .move-down').forEach(button => {
        button.addEventListener('click', (e) => {
            const pageCard = e.target.closest('.page-card');
            const pageNumber = parseInt(pageCard.dataset.page);
            movePage(pageNumber, e.target.classList.contains('move-up') ? 'up' : 'down');
        });
    });
    
    // Delete page
    document.querySelectorAll('.delete-page').forEach(button => {
        button.addEventListener('click', (e) => {
            const pageCard = e.target.closest('.page-card');
            const pageNumber = parseInt(pageCard.dataset.page);
            deletePage(pageNumber);
        });
    });
    
    // Asset uploads
    document.querySelectorAll('.asset-upload').forEach(uploadZone => {
        uploadZone.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = uploadZone.dataset.type === 'audio/mp3' ? 'audio/*' : 'image/*';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    const pageCard = uploadZone.closest('.page-card');
                    const pageNumber = parseInt(pageCard.dataset.page);
                    handleAssetUpload(file, pageNumber, uploadZone.dataset.type);
                }
            };
            
            input.click();
        });
    });
    
    // Page text updates
    document.querySelectorAll('.page-text').forEach(textarea => {
        textarea.addEventListener('change', (e) => {
            const pageCard = e.target.closest('.page-card');
            const pageNumber = parseInt(pageCard.dataset.page);
            updatePageText(pageNumber, e.target.value);
        });
    });
}

// Book title input handler
bookTitleInput.addEventListener('change', (e) => {
    updateBookTitle(e.target.value);
});

// Cover upload handler
coverUpload.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            handleCoverUpload(file);
        }
    };
    input.click();
});

// Add new book handler
addBookBtn.addEventListener('click', createNewBook);

// Add new page handler
addPageBtn.addEventListener('click', addPage);

// Initialize the app
console.log('Starting app initialization...');
initializeBooksListener();
