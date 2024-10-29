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
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const storage = getStorage(app);

// DOM Elements
const bookList = document.querySelector('.book-list');
const addBookBtn = document.querySelector('.add-book-btn');
const bookTitleInput = document.getElementById('book-title');
const coverUpload = document.getElementById('cover-upload');

// State management
let selectedBookId = null;
let currentBook = null;

// Initialize books listener
function initializeBooksListener() {
    const booksRef = ref(database, 'books');
    onValue(booksRef, (snapshot) => {
        const books = snapshot.val() || {};
        renderBookList(books);
    });
}

// Render book list
function renderBookList(books) {
    bookList.innerHTML = '';
    Object.entries(books).forEach(([id, book]) => {
        const li = document.createElement('li');
        li.className = `book-item ${selectedBookId === id ? 'selected' : ''}`;
        li.innerHTML = `
            <span>${book.title || 'Untitled Book'}</span>
            <span class="status-badge status-${book.status || 'draft'}">${book.status || 'draft'}</span>
        `;
        li.addEventListener('click', () => selectBook(id));
        bookList.appendChild(li);
    });
}

// Select a book
async function selectBook(bookId) {
    selectedBookId = bookId;
    const bookRef = ref(database, `books/${bookId}`);
    const snapshot = await get(bookRef);
    currentBook = snapshot.val();
    
    // Update UI
    bookTitleInput.value = currentBook.title || '';
    // TODO: Load book pages and assets
    
    // Update selected state in list
    document.querySelectorAll('.book-item').forEach(item => {
        item.classList.remove('selected');
        if (item.dataset.id === bookId) {
            item.classList.add('selected');
        }
    });
}

// Create new book
async function createNewBook() {
    const booksRef = ref(database, 'books');
    const newBookRef = push(booksRef);
    const newBook = {
        title: 'Untitled Book',
        status: 'draft',
        createdAt: new Date().toISOString(),
        pages: {}
    };
    
    await set(newBookRef, newBook);
    selectBook(newBookRef.key);
}

// Update book title
async function updateBookTitle(title) {
    if (!selectedBookId) return;
    const updates = {
        [`books/${selectedBookId}/title`]: title
    };
    await update(ref(database), updates);
}

// Upload file to Firebase Storage
async function uploadFile(file, path) {
    const fileRef = storageRef(storage, path);
    await uploadBytes(fileRef, file);
    return await getDownloadURL(fileRef);
}

// Event Listeners
addBookBtn.addEventListener('click', createNewBook);

bookTitleInput.addEventListener('change', (e) => {
    updateBookTitle(e.target.value);
});

coverUpload.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (file && selectedBookId) {
            const path = `books/${selectedBookId}/cover.jpg`;
            const url = await uploadFile(file, path);
            await update(ref(database), {
                [`books/${selectedBookId}/coverUrl`]: url
            });
            // TODO: Update cover preview
        }
    };
    input.click();
});

// Initialize the app
initializeBooksListener();
