import { auth, db } from './firebase.js';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';
// NOUVEAU : Ajout de onValue pour lire les avis
import { ref, get, set, onValue } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js';

// 🔴 REMPLACEZ PAR VOTRE NUMERO (sans espace, ni +)
const NUMERO_WHATSAPP = "221786144737"; 

document.addEventListener('DOMContentLoaded', () => {
    
    // ── 1. GESTION DE LA CONNEXION ──────────────────────────────────────────────
    const loginBtn = document.getElementById('loginBtn');
    
    onAuthStateChanged(auth, (user) => {
        if (user) {
            checkAccessAndRedirect(user);
        }
    });

    loginBtn.addEventListener('click', async (e) => {
        e.preventDefault(); 
        
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' }); 

        try {
            const result = await signInWithPopup(auth, provider);
            checkAccessAndRedirect(result.user);
        } catch (error) {
            console.error("Erreur de connexion :", error);
        }
    });

    async function checkAccessAndRedirect(user) {
        const safeEmail = user.email.replace(/\./g, ','); 
        const userRef = ref(db, `allowedUsers/${safeEmail}`);
        const snapshot = await get(userRef);

        if (snapshot.exists()) {
            const val = snapshot.val();
            const now = Date.now(); // Date de l'instant présent en millisecondes

            // 1. ACCÈS VALIDE (À vie ou Date non dépassée)
            if (val === true || (typeof val === 'number' && val > now)) {
                window.location.href = 'index.html';
            } 
            // 2. ABONNEMENT EXPIRÉ
            else if (typeof val === 'number' && val <= now) {
                alert(`⏳ ABONNEMENT TERMINÉ\n\nVotre forfait pour le compte ${user.email} est arrivé à expiration. Veuillez renouveler votre accès via WhatsApp.`);
                handleUnauthorizedUser(user.email); // Active le bouton WhatsApp
                signOut(auth);
            } 
            // 3. ERREUR DE DONNÉE
            else {
                alert(`🔒 Erreur d'accès.\nVeuillez contacter l'assistance.`);
                handleUnauthorizedUser(user.email);
                signOut(auth);
            }
        } else {
            // 4. NOUVEAU COMPTE (Non présent dans la base)
            alert(`🔒 ACCÈS RESTREINT\n\nLe compte ${user.email} ne possède pas d'abonnement actif. Choisissez un forfait ci-dessous.`);
            handleUnauthorizedUser(user.email);
            signOut(auth);
        }
    }

    // ── 2. LOGIQUE WHATSAPP ET ABONNEMENTS ──────────────────────────────────────
    function updateWhatsAppLink() {
        const selectedPlan = document.querySelector('input[name="sub_plan"]:checked');
        if (!selectedPlan) return;
        
        const planName = selectedPlan.value;
        const planPrice = selectedPlan.dataset.price;
        
        const waHint = document.getElementById('wa-email-hint');
        const userEmail = waHint ? waHint.dataset.email : ''; 
        
        const waBtn = document.getElementById('wa-btn');

        if (!userEmail) {
            // SI PAS D'EMAIL : On désactive le bouton
            waBtn.classList.add('disabled');
            waBtn.removeAttribute('target');
            waBtn.href = "#";
        } else {
            // SI L'EMAIL EST CAPTURÉ : On active le bouton WhatsApp
            waBtn.classList.remove('disabled');
            waBtn.setAttribute('target', '_blank'); // Permet d'ouvrir un nouvel onglet
            
            let message = `Bonjour, je souhaite souscrire à l'abonnement *${planName}* (${planPrice} FCFA) pour accéder à ASRAR PRO.\n\nVoici l'email que j'utilise pour me connecter : ${userEmail}`;
            waBtn.href = `https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(message)}`;
        }
    }

    function handleUnauthorizedUser(email) {
        const waHint = document.getElementById('wa-email-hint');
        if (waHint) {
            waHint.dataset.email = email; 
            waHint.style.display = 'block';
            updateWhatsAppLink(); // Cela va maintenant activer le bouton !
        }
    }

    // Écouteurs pour les changements de forfait
    document.querySelectorAll('input[name="sub_plan"]').forEach(radio => {
        radio.addEventListener('change', updateWhatsAppLink);
    });
    updateWhatsAppLink();

    // 🔴 NOUVEAU : Intercepter le clic si le bouton est désactivé
    const waBtn = document.getElementById('wa-btn');
    const waBtnContainer = document.getElementById('waBtnContainer');

    waBtn.addEventListener('click', (e) => {
        if (waBtn.classList.contains('disabled')) {
            e.preventDefault(); // Empêche de suivre le lien
            
            // Affiche l'info-bulle (tooltip)
            waBtnContainer.classList.add('show-tooltip');
            
            // Cache l'info-bulle après 4 secondes
            setTimeout(() => {
                waBtnContainer.classList.remove('show-tooltip');
            }, 4000);
        }
    });

    // ── 3. SOUMISSION DES AVIS ──────────────────────────────────────────────────
    let currentRating = 0;
    const stars = document.querySelectorAll('#star-rating i');
    const submitBtn = document.getElementById('submit-testi-btn');

    if (stars.length && submitBtn) {
        stars.forEach(star => {
            star.addEventListener('click', (e) => {
                currentRating = parseInt(e.target.dataset.val);
                stars.forEach((s, index) => {
                    if (index < currentRating) s.classList.replace('far', 'fas');
                    else s.classList.replace('fas', 'far');
                });
            });
        });

        submitBtn.addEventListener('click', async () => {
            const email = document.getElementById('testi-email').value.trim();
            const text = document.getElementById('testi-text').value.trim();
            const name = document.getElementById('testi-name').value.trim() || 'Anonyme';

            if (currentRating === 0) { alert("Veuillez sélectionner une note avec les étoiles."); return; }
            if (!email || !email.includes('@')) { alert("Veuillez entrer une adresse email valide."); return; }
            if (text === "") { alert("Veuillez écrire un court témoignage."); return; }

            const safeEmailKey = email.replace(/\./g, ',');
            const avisRef = ref(db, `AVIS/${safeEmailKey}`);

            try {
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Envoi...';
                submitBtn.disabled = true;

                await set(avisRef, {
                    nom: name, 
                    note: currentRating, 
                    texte: text, 
                    date: new Date().toISOString()
                });

                document.getElementById('testi-email').value = '';
                document.getElementById('testi-text').value = '';
                document.getElementById('testi-name').value = '';
                stars.forEach(s => s.classList.replace('fas', 'far'));
                currentRating = 0;
                
                submitBtn.innerHTML = '<i class="fas fa-check"></i> Merci !';
                setTimeout(() => {
                    submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Envoyer';
                    submitBtn.disabled = false;
                }, 3000);
            } catch (error) {
                console.error("Erreur d'envoi :", error);
                alert("Erreur lors de l'envoi. Autorisation refusée.");
                submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Envoyer';
                submitBtn.disabled = false;
            }
        });
    }

    // ── 4. LECTURE ET AFFICHAGE DES AVIS 5 ÉTOILES ──────────────────────────────
    function loadBestReviews() {
        const avisRef = ref(db, 'AVIS');
        onValue(avisRef, (snapshot) => {
            const showcase = document.getElementById('testimonialsShowcase');
            const grid = document.getElementById('reviewsGrid');
            if (!showcase || !grid) return;

            const val = snapshot.val();
            if (!val) {
                showcase.style.display = 'none';
                return;
            }

            // Convertir en tableau, filtrer note == 5, et trier par date décroissante
            const topReviews = Object.values(val)
                .filter(avis => avis.note === 5)
                .sort((a, b) => new Date(b.date) - new Date(a.date));

            if (topReviews.length === 0) {
                showcase.style.display = 'none';
                return;
            }

            // Générer le HTML des cartes
            grid.innerHTML = topReviews.map(r => `
                <div class="review-card">
                    <i class="fas fa-quote-right review-quote-icon"></i>
                    <div class="review-stars">
                        <i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i>
                    </div>
                    <p class="review-text">"${r.texte}"</p>
                    <p class="review-author">— ${r.nom || 'Un pratiquant'}</p>
                </div>
            `).join('');

            // Rendre la section visible
            showcase.style.display = 'block';
        });
    }

    // Lancer le chargement des avis au démarrage
    loadBestReviews();
});