// app.js — v4.0 (Complet)
import { auth } from './firebase.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';
import { loadNames } from './firebase.js';
import {
    elements, applyTheme, showSkeletons, renderCards,
    setCurrentData, toggleView, showSuggestions, 
    initModal, initScrollButtons, showToast
} from './domManager.js';

// ── 1. DÉVERROUILLAGE AUDIO CONTEXT ───────────────────────────
document.body.addEventListener('pointerdown', () => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
        const ctx = new AudioContext();
        if (ctx.state === 'suspended') ctx.resume();
    }
}, { once: true });

// ── 2. VÉRIFICATION DE SÉCURITÉ (LE VIDEUR) ───────────────────
onAuthStateChanged(auth, (user) => {
    if (!user) {
        // Pas connecté = redirection vers le login
        window.location.replace('login.html');
    } else {
        // Connecté = On initialise l'interface
        init();
    }
});

// ── 3. GESTION DE LA DÉCONNEXION ──────────────────────────────
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        if(confirm("Voulez-vous vraiment vous déconnecter de ASRAR PRO ?")) {
            signOut(auth).then(() => {
                window.location.replace('login.html');
            }).catch((error) => {
                console.error("Erreur déconnexion :", error);
                showToast("Erreur lors de la déconnexion.");
            });
        }
    });
}

// ── 4. INITIALISATION DE L'APPLICATION (LE MOTEUR) ────────────
function init() {
    // Restaurer le thème (clair/sombre)
    const savedTheme = localStorage.getItem('theme') || 'dark';
    applyTheme(savedTheme);
    
    if (elements.themeToggle) {
        elements.themeToggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
        });
    }

    // Afficher des fausses cartes clignotantes pendant le chargement
    showSkeletons(12);

    // Charger les noms depuis Firebase
    loadNames((data) => {
        // Sauvegarder les données en mémoire
        setCurrentData(data);
        
        // Activer la barre de recherche
        if (elements.searchInput) {
            elements.searchInput.addEventListener('input', (e) => {
                const term = e.target.value;
                elements.clearBtn.style.display = term ? 'flex' : 'none';
                showSuggestions(term, data);
                renderCards(data, term, elements.favoritesBtn.classList.contains('active'));
            });
        }

        // Activer le bouton pour effacer la recherche
        if (elements.clearBtn) {
            elements.clearBtn.addEventListener('click', () => {
                elements.searchInput.value = '';
                elements.clearBtn.style.display = 'none';
                elements.suggestionsBox.style.display = 'none';
                renderCards(data, '', elements.favoritesBtn.classList.contains('active'));
            });
        }

        // Activer les boutons Vue (Grille/Liste) et Favoris
        if (elements.viewToggle) {
            elements.viewToggle.addEventListener('click', toggleView);
        }
        if (elements.favoritesBtn) {
            elements.favoritesBtn.addEventListener('click', () => {
                elements.favoritesBtn.classList.toggle('active');
                renderCards(data, elements.searchInput.value, elements.favoritesBtn.classList.contains('active'));
            });
        }

        // Initialiser les modales et les boutons de défilement
        initModal();
        initScrollButtons();

        // 🔴 AFFICHER LES CARTES À L'ÉCRAN
        renderCards(data);

    }, (error) => {
        // Si Firebase renvoie une erreur (ex: permission refusée)
        elements.container.innerHTML = `
            <div class="empty-message">
                <i class="fas fa-exclamation-triangle" style="color: #ff7070;"></i>
                <p>Erreur de base de données : <br><small>${error}</small></p>
            </div>`;
    });
}

// ── 5. SERVICE WORKER (PWA) ───────────────────────────────────
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(err => {
            console.warn("Erreur d'enregistrement du Service Worker :", err);
        });
    });
}
// ── 6. INSTALLATION PWA (Bouton "Ajouter à l'écran d'accueil") ───────────────
let deferredPrompt;
const installBtn = document.getElementById('installAppBtn');

// Écoute l'événement système qui dit "L'app est prête à être installée"
window.addEventListener('beforeinstallprompt', (e) => {
    // Empêche la mini-bannière automatique de Google
    e.preventDefault();
    // On sauvegarde l'événement pour le déclencher au clic
    deferredPrompt = e;
    // On affiche notre joli bouton d'installation
    if (installBtn) {
        installBtn.style.display = 'flex';
    }
});

if (installBtn) {
    installBtn.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        
        // Affiche la vraie boîte de dialogue d'installation du téléphone/PC
        deferredPrompt.prompt();
        
        // Attend la réponse de l'utilisateur (Installé ou Annulé)
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`Résultat de l'installation : ${outcome}`);
        
        // On réinitialise la variable
        deferredPrompt = null;
        // On cache le bouton
        installBtn.style.display = 'none';
    });
}

// Optionnel : Message quand l'installation est réussie
window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    if (installBtn) installBtn.style.display = 'none';
    showToast("✅ ASRAR PRO est installée sur votre appareil !");
});
