// firebase.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import { getDatabase, ref, onValue, get } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';

const CACHE_KEY = 'asma_data_v3'; 
const CACHE_EXPIRY = 0; // 0 = Temps réel

const firebaseConfig = {
    apiKey:            "AIzaSyBLzPKzbiNYitUz7sv9Ftqm0oF20rA32Zk",
    authDomain:        "asrar-bc059.firebaseapp.com",
    databaseURL:       "https://asrar-bc059.firebaseio.com",
    projectId:         "asrar-bc059",
    storageBucket:     "asrar-bc059.appspot.com",
    messagingSenderId: "199810893447",
    appId:             "1:199810893447:web:044629472e10f9eb68da22"
};

// Initialisation globale de Firebase
const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);

// ... (Garder la fonction applyVocabularyFilter ici) ...
function applyVocabularyFilter(text) {
    if (!text) return text;
    return text
        .replace(/\bzeker\b/gi, "pratiquant")
        .replace(/\bl'aura\b/gi, "le coeur") 
        .replace(/\baura\b/gi, "le coeur")
        .replace(/\bwafq\b/gi, "carré magique")
        .replace(/\bruhaniyat\b/gi, "Asrar");
}

function normalizeName(k, v) {
    return {
        id: k,
        number: parseInt(v.number) || 999,
        name: v.name.trim(),
        translit: v.translit.trim(),
        meaning: applyVocabularyFilter(v.meaning.trim()),
        benefit: v.benefit ? applyVocabularyFilter(v.benefit.trim()) : ''
    };
}

export async function loadNames(callback, errorCallback) {
    const dbRef = ref(db, 'data/appData/asmaUlHusna');
    const timeout = setTimeout(() => {
        console.warn("Timeout Firebase");
    }, 6000);

    onValue(dbRef, (snapshot) => {
        clearTimeout(timeout);
        const val = snapshot.val();
        if (!val) return; 

        const names = Object.entries(val)
            .filter(([, v]) => v && v.name && v.translit && v.meaning)
            .map(([k, v]) => normalizeName(k, v))
            .sort((a, b) => (a.number || 999) - (b.number || 999));

        if (names.length > 0) {
            callback(names);
        }
    }, (err) => {
        clearTimeout(timeout);
        errorCallback?.(`Erreur Firebase : ${err.message}`);
    });
}