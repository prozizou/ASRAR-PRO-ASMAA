// domManager.js — v2.0 (Refonte professionnelle)
import { calculatePoidsMystique, generateAllWafq3x3, generateAllWafq3x3Vide, generateAllWafq4x4, getElementalOrderFromText, toEasternArabic } from './abjad.js';
import { playAudio } from './audio.js';
import { handleTasbihAction, resetTasbih, updateTasbihSettings } from './tasbihLogic.js';

// ── RÉFÉRENCES DOM ───────────────────────────────────────────
export const elements = {
    container:      document.getElementById('cardsContainer'),
    searchInput:    document.getElementById('searchInput'),
    countSpan:      document.getElementById('countDisplay'),
    clearBtn:       document.getElementById('clearSearch'),
    suggestionsBox: document.getElementById('suggestionsBox'),
    themeToggle:    document.getElementById('themeToggle'),
    viewToggle:     document.getElementById('viewToggle'),
    favoritesBtn:   document.getElementById('showFavoritesBtn'),
    modal:          document.getElementById('nameModal'),
    modalArabic:    document.getElementById('modalArabic'),
    modalTranslit:  document.getElementById('modalTranslit'),
    modalNumber:    document.getElementById('modalNumber'),
    modalMeaning:   document.getElementById('modalMeaning'),
    modalBenefit:   document.getElementById('modalBenefit'),
    modalBenefitSection: document.getElementById('modalBenefitSection'),
    modalPlay:      document.getElementById('modalPlayAudio'),
    modalFavBtn:    document.getElementById('modalToggleFavorite'),
    modalClose:     document.querySelector('.modal-close'),
    toast:          document.getElementById('toast'),
};

// ── ÉTAT ─────────────────────────────────────────────────────
let currentData       = [];
let currentSearchTerm = '';
let viewMode          = localStorage.getItem('viewMode') || 'grid';
let currentModalItem  = null;
let toastTimer        = null;

// Favoris
let savedFavs = [];
try { savedFavs = JSON.parse(localStorage.getItem('favorites')) || []; }
catch(e) { localStorage.removeItem('favorites'); }
let favorites = new Set(savedFavs);

// ── OBSERVER (lazy loading) ───────────────────────────────────
const cardObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            hydrateCard(entry.target);
            observer.unobserve(entry.target);
        }
    });
}, { root: null, rootMargin: '120px', threshold: 0.05 });

// ── TOAST ─────────────────────────────────────────────────────
export function showToast(message, duration = 2200) {
    if (!elements.toast) return;
    clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add('show');
    toastTimer = setTimeout(() => elements.toast.classList.remove('show'), duration);
}

// ── THÈME ─────────────────────────────────────────────────────
export function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const icon = elements.themeToggle.querySelector('i');
    icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    localStorage.setItem('theme', theme);
}

// ── SQUELETTES ────────────────────────────────────────────────
export function showSkeletons(count = 9) {
    elements.container.innerHTML = Array(count).fill(
        '<div class="skeleton-card" aria-hidden="true"></div>'
    ).join('');
}

// ── DÉLÉGATION D'ÉVÉNEMENTS (cartes) ─────────────────────────
function initEventDelegation() {
    elements.container.addEventListener('click', (e) => {
        const card = e.target.closest('.glass-card');
        if (!card || card.classList.contains('skeleton-card')) return;

        const id   = card.dataset.id;
        const item = currentData.find(d => d.id === id);
        if (!item) return;

        if (e.target.closest('.favorite-btn')) {
            e.stopPropagation();
            const isFav = toggleFavorite(id);
            const btn   = e.target.closest('.favorite-btn');
            btn.classList.toggle('active', isFav);
            btn.querySelector('i').className = isFav ? 'fas fa-star' : 'far fa-star';
            showToast(isFav ? '⭐ Ajouté aux favoris' : '✕ Retiré des favoris');
        }
        else if (e.target.closest('.audio-btn')) {
            e.stopPropagation();
            playAudio(item);
        }
        else if (e.target.closest('.tasbih-btn')) {
            e.stopPropagation();
            const tasbihEl = card.querySelector('.inline-tasbih');
            tasbihEl.classList.toggle('active');
        }
        else if (e.target.closest('.reset-zikr-btn')) {
            e.stopPropagation();
            resetTasbih(card, id);
        }
        else if (e.target.closest('.inline-tasbih')) {
            if (e.target.closest('.tasbih-settings')) return;
            handleTasbihAction(card, id);
        }
        else if (e.target.closest('.toggle-numeral-btn')) {
            const cb = e.target.closest('.toggle-numeral-btn');
            const wc = cb.closest('.wafq-container-global');
            wc.classList.toggle('show-eastern', cb.checked);
        }
        else if (e.target.closest('.wafq-expander')) {
            return; // Laisser le <details> gérer nativement
        }
        else {
            showModal(item);
        }
    });

    elements.container.addEventListener('input', (e) => {
        if (e.target.classList.contains('zikr-input')) {
            updateTasbihSettings(e.target, e.target.dataset.id, e.target.value);
        }
    });
}

initEventDelegation();

// ── BOUTONS DE SCROLL ─────────────────────────────────────────
export function initScrollButtons() {
    document.getElementById('scrollTopBtn')?.addEventListener('click', () =>
        window.scrollTo({ top: 0, behavior: 'smooth' })
    );
    document.getElementById('scrollBottomBtn')?.addEventListener('click', () =>
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
    );
}

// ── AFFICHAGE DES CARTES ──────────────────────────────────────
export function renderCards(data, filterTerm = '', showFavoritesOnly = false) {
    currentSearchTerm = filterTerm.trim();

    let filtered = data;

    if (showFavoritesOnly) {
        filtered = data.filter(item => {
            const count = parseInt(localStorage.getItem(`tasbih_asma_${item.id}`)) || 0;
            return favorites.has(item.id) || count > 0;
        });
    }

    if (currentSearchTerm) {
        const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const term = norm(currentSearchTerm);
        filtered = filtered.filter(item =>
            [item.name, item.translit, item.meaning, item.benefit, String(item.number)]
                .some(f => norm(f).includes(term))
        );
    }

    elements.countSpan.textContent = filtered.length;
    elements.container.className   = `cards-grid${viewMode === 'list' ? ' list-view' : ''}`;
    elements.container.innerHTML   = '';

    if (filtered.length === 0) {
        elements.container.innerHTML = `
            <div class="empty-message">
                <i class="fas fa-moon"></i>
                <p>Aucun nom trouvé pour « ${currentSearchTerm} »</p>
            </div>`;
        return;
    }

    // Utilisation d'un DocumentFragment pour améliorer les performances DOM
    const fragment = document.createDocumentFragment();
    filtered.forEach((item, index) => {
        const shell         = document.createElement('div');
        shell.className     = 'glass-card skeleton-card';
        shell.dataset.id    = item.id;
        shell._data         = item;
        shell.style.animationDelay = `${Math.min(index * 30, 300)}ms`;
        fragment.appendChild(shell);
        cardObserver.observe(shell);
    });
    elements.container.appendChild(fragment);
}

// ── MISE EN ÉVIDENCE RECHERCHE ────────────────────────────────
function highlightText(text) {
    if (!currentSearchTerm || !text) return String(text ?? '');
    const safe  = currentSearchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${safe})`, 'gi');
    return String(text).replace(regex, '<mark class="search-highlight">$1</mark>');
}

// ── CONSTRUCTION HTML WAFQ ────────────────────────────────────
function buildWafqSliderHtml(squaresData, orderedKeys, numericTarget, typeName) {
    if (!squaresData) return '';
    
    // Correction : on détecte juste le chiffre 3 ou 4 dans le titre
    const is3x3 = typeName.includes('3');
    const cols = is3x3 ? 3 : 4;

    const slidesHtml = orderedKeys.map((key, index) => {
        const sq        = squaresData[key];
        const isPrimary = index === 0;
        
        // Le point central décoratif uniquement pour le 4x4
        const extraDot  = !is3x3 ? `<div class="wafq-center-dot"></div>` : '';

        const cellsHtml = sq.grid.map((row, rIndex) =>
            row.map((cell, cIndex) => {
                if (cell.s === 'V') {
                    return `<div class="wafq-cell center-vide">
                        <span class="num-w">${cell.v}</span>
                        <span class="num-e" style="display:none">${toEasternArabic(cell.v)}</span>
                    </div>`;
                }
                let stepClass = 'step-right';
                // L'encoche des numéros d'étape change de côté sur certaines cases du 4x4
                if (!is3x3 && cIndex === 1 && (rIndex === 1 || rIndex === 2)) {
                    stepClass = 'step-left';
                }
                return `<div class="wafq-cell">
                    <span class="cell-step ${stepClass}" title="Ordre de remplissage">${cell.s}</span>
                    <span class="cell-val">
                        <span class="num-w">${cell.v}</span>
                        <span class="num-e" style="display:none">${toEasternArabic(cell.v)}</span>
                    </span>
                </div>`;
            }).join('')
        ).join('');

        return `<div class="wafq-slide ${isPrimary ? 'primary-element' : ''}">
            <div class="wafq-nature-badge">${sq.icon} ${sq.arabic}</div>
            <div class="wafq-title">${typeName}${isPrimary ? ' ✦' : ''}</div>
            <div class="wafq-subtitle">Constante: ${numericTarget} · ${sq.name}</div>
            <div class="wafq-grid grid-${cols}x${cols}">
                ${cellsHtml}
                ${extraDot}
            </div>
        </div>`;
    }).join('');

    return `<div class="wafq-slider-wrapper">
        <div class="swipe-hint">
            <i class="fas fa-arrows-left-right"></i> Glissez pour voir les autres éléments
        </div>
        <div class="wafq-slider">${slidesHtml}</div>
    </div>`;
}

// ── HYDRATATION D'UNE CARTE ───────────────────────────────────
function hydrateCard(cardElement) {
    const item       = cardElement._data;
    const isFav      = favorites.has(item.id);
    const savedCount = parseInt(localStorage.getItem(`tasbih_asma_${item.id}`)) || 0;

    const poidsMystique = calculatePoidsMystique(item.name);
    const autoTarget    = poidsMystique > 0 ? poidsMystique * 9 : '';

    let finalTarget  = localStorage.getItem(`tasbih_target_${item.id}`);
    if (finalTarget === null || finalTarget === '') finalTarget = autoTarget;
    let numericTarget = parseInt(finalTarget);
    if (isNaN(numericTarget) || numericTarget === 0) numericTarget = parseInt(autoTarget);

    const savedLoopMax     = localStorage.getItem(`tasbih_loopmax_${item.id}`) || '';
    const savedLoopCurrent = parseInt(localStorage.getItem(`tasbih_loopcur_${item.id}`)) || 0;

    // Wafq (carrés magiques)
    let gridsHtml = '';
    const orderedKeys = getElementalOrderFromText(item.meaning, item.benefit);
    if (numericTarget >= 15) gridsHtml += buildWafqSliderHtml(generateAllWafq3x3(numericTarget),     orderedKeys, numericTarget, '3×3 Classique');
    if (numericTarget >= 15) gridsHtml += buildWafqSliderHtml(generateAllWafq3x3Vide(numericTarget), orderedKeys, numericTarget, '3×3 Vide');
    if (numericTarget >= 34) gridsHtml += buildWafqSliderHtml(generateAllWafq4x4(numericTarget),     orderedKeys, numericTarget, '4×4 Murabba');

    const wafqHtml = gridsHtml ? `
        <details class="wafq-expander wafq-container-global" aria-label="Carrés Magiques">
            <summary class="wafq-summary">
                <span><i class="fas fa-table-cells" style="margin-right:6px"></i>Awfaq — Carrés Magiques</span>
                <i class="fas fa-chevron-down toggle-icon"></i>
            </summary>
            <div class="wafq-controls">
                <span style="font-size:0.8rem">123</span>
                <label class="switch-numeral" title="Chiffres arabes orientaux">
                    <input type="checkbox" class="toggle-numeral-btn" aria-label="Basculer chiffres arabes">
                    <span class="slider-numeral round"></span>
                </label>
                <span style="font-size:1rem">١٢٣</span>
            </div>
            ${gridsHtml}
        </details>` : '';

    // Textes avec mise en évidence
    const hName    = highlightText(item.name);
    const hTranslit = highlightText(item.translit);
    const hMeaning  = highlightText(item.meaning);
    const hBenefit  = highlightText(item.benefit || '');
    const numLabel  = item.number && item.number < 999 ? `<span class="stat-pill" style="font-size:0.72rem"><i class="fas fa-hashtag"></i><span>${item.number}</span></span>` : '';

cardElement.innerHTML = `
        <div class="card-header-row">
            <div class="name-group">
                ${numLabel ? `<div style="margin-bottom:0.4rem">${numLabel}</div>` : ''}
                <div class="arabic-name">${hName}</div>
                <div class="translit-name">${hTranslit}</div>
            </div>
            
            ${poidsMystique > 0 ? `
            <div class="poids-badge" title="Poids abjad × 9 = objectif recommandé">
                <i class="fas fa-scale-balanced"></i>
                Poids <strong>${poidsMystique}</strong>
                <span style="opacity:0.5;margin:0 2px">·</span>
                Obj. <strong>${numericTarget || '—'}</strong>
            </div>` : ''}
        </div>

        <div class="card-content-row">
            ${wafqHtml ? `<div class="wafq-wrapper">${wafqHtml}</div>` : ''}
            
            <div class="text-wrapper">
                <div class="meaning">
                    <i class="fas fa-gem"></i>
                    <span>${hMeaning}</span>
                </div>
                ${hBenefit ? `<div class="benefit">
                    <i class="fas fa-leaf"></i>
                    <span>${hBenefit}</span>
                </div>` : ''}
            </div>
        </div>

        <div class="card-footer">
            <button class="card-action-btn favorite-btn ${isFav ? 'active' : ''}" aria-label="${isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}">
                <i class="${isFav ? 'fas' : 'far'} fa-star"></i>
            </button>
            <button class="card-action-btn audio-btn" aria-label="Écouter la prononciation">
                <i class="fas fa-volume-low"></i>
            </button>
            <button class="card-action-btn tasbih-btn" aria-label="Ouvrir le tasbih">
                <i class="fas fa-fingerprint"></i>
                <span class="tasbih-counter" id="badge-${item.id}">${savedCount}</span>
            </button>
        </div>

        <div class="inline-tasbih" id="inline-tasbih-${item.id}" role="region" aria-label="Compteur de dhikr">
            <div class="tasbih-settings">
                <div class="setting-group" title="Objectif de récitation (Poids × 9 par défaut)">
                    <i class="fas fa-bullseye"></i>
                    <input type="number" id="input-target-${item.id}" data-id="${item.id}"
                           class="zikr-input" placeholder="Obj." value="${finalTarget}" min="0">
                </div>
                <div class="setting-group" title="Nombre de séries">
                    <i class="fas fa-rotate"></i>
                    <input type="number" id="input-loop-${item.id}" data-id="${item.id}"
                           class="zikr-input" placeholder="Séries" value="${savedLoopMax}" min="0">
                </div>
                <div class="loop-display" id="loop-display-${item.id}"
                     style="display:${savedLoopMax ? 'flex' : 'none'};align-items:center;gap:4px">
                    Série <span id="loop-current-${item.id}">${savedLoopCurrent}</span>/<span id="loop-max-${item.id}">${savedLoopMax || 0}</span>
                </div>
                <button class="reset-zikr-btn" aria-label="Réinitialiser le compteur">
                    <i class="fas fa-rotate-left"></i>
                </button>
            </div>

            <div class="inline-counter" id="counter-${item.id}" aria-live="polite" aria-atomic="true">
                ${savedCount.toString().padStart(2, '0')}
            </div>

            <div class="inline-bead-string" aria-hidden="true">
                <div class="inline-bead-line"></div>
                <div class="inline-beads-container" id="beads-container-${item.id}">
                    ${'<div class="inline-bead"></div>'.repeat(9)}
                </div>
            </div>

            <p class="tasbih-hint">Appuyez pour égrainer</p>
        </div>
    `;

    cardElement.classList.remove('skeleton-card');
}

// ── FAVORIS ───────────────────────────────────────────────────
export function toggleFavorite(id) {
    if (favorites.has(id)) {
        favorites.delete(id);
    } else {
        favorites.add(id);
    }
    localStorage.setItem('favorites', JSON.stringify([...favorites]));
    return favorites.has(id);
}

// ── MODAL ─────────────────────────────────────────────────────
export function initModal() {
    elements.modalClose.addEventListener('click', hideModal);
    elements.modal.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-backdrop')) hideModal();
    });
    elements.modalPlay.addEventListener('click', () => {
        if (currentModalItem) {
            playAudio(currentModalItem);
            showToast('🔊 Lecture en cours…');
        }
    });
    elements.modalFavBtn.addEventListener('click', () => {
        if (!currentModalItem) return;
        const isFav = toggleFavorite(currentModalItem.id);
        updateModalFavoriteButton(currentModalItem.id);
        showToast(isFav ? '⭐ Ajouté aux favoris' : '✕ Retiré des favoris');
        renderCards(currentData, elements.searchInput.value,
            elements.favoritesBtn.classList.contains('active'));
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !elements.modal.hidden) hideModal();
    });
}

export function showModal(item) {
    if (!item) return;
    currentModalItem = item;
    elements.modalArabic.textContent   = item.name;
    elements.modalTranslit.textContent = item.translit;
    elements.modalMeaning.textContent  = item.meaning;
    elements.modalBenefit.textContent  = item.benefit || '';

    // Badge numéro
    if (elements.modalNumber) {
        if (item.number && item.number < 999) {
            elements.modalNumber.innerHTML = `<span class="stat-pill"><i class="fas fa-hashtag"></i><span>${item.number}</span> sur 99</span>`;
        } else {
            elements.modalNumber.innerHTML = '';
        }
    }

    // Section bénéfice conditionnelle
    if (elements.modalBenefitSection) {
        elements.modalBenefitSection.style.display = item.benefit ? '' : 'none';
    }

    updateModalFavoriteButton(item.id);
    elements.modal.hidden = false;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => elements.modalClose.focus());
}

function updateModalFavoriteButton(id) {
    const isFav = favorites.has(id);
    elements.modalFavBtn.innerHTML = isFav
        ? '<i class="fas fa-star"></i> Retirer des favoris'
        : '<i class="far fa-star"></i> Ajouter aux favoris';
    elements.modalFavBtn.classList.toggle('is-fav', isFav);
}

export function hideModal() {
    elements.modal.hidden = true;
    document.body.style.overflow = '';
    currentModalItem = null;
}

// ── SUGGESTIONS ───────────────────────────────────────────────
export function showSuggestions(term, data) {
    if (!term) { elements.suggestionsBox.style.display = 'none'; return; }

    const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const suggestions = data
        .filter(item =>
            norm(item.translit).startsWith(norm(term)) ||
            norm(item.meaning).includes(norm(term))
        )
        .slice(0, 6);

    if (suggestions.length === 0) { elements.suggestionsBox.style.display = 'none'; return; }

    elements.suggestionsBox.innerHTML = suggestions.map(s =>
        `<div class="suggestion-item" data-id="${s.id}" role="option" tabindex="0">
            ${s.translit} <span style="color:var(--text-3);font-size:0.82em">· ${s.meaning}</span>
        </div>`
    ).join('');

    elements.suggestionsBox.style.display = 'block';

    elements.suggestionsBox.querySelectorAll('.suggestion-item').forEach(el => {
        el.addEventListener('click', () => {
            const id   = el.dataset.id;
            const item = data.find(d => d.id === id);
            if (item) {
                elements.searchInput.value = item.translit;
                elements.clearBtn.hidden   = false;
                elements.suggestionsBox.style.display = 'none';
                renderCards(data, item.translit, elements.favoritesBtn.classList.contains('active'));
            }
        });
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') el.click();
        });
    });
}

// ── TOGGLE VUE ────────────────────────────────────────────────
export function toggleView() {
    viewMode = viewMode === 'grid' ? 'list' : 'grid';
    localStorage.setItem('viewMode', viewMode);
    elements.viewToggle.innerHTML = viewMode === 'grid'
        ? '<i class="fas fa-th-large"></i>'
        : '<i class="fas fa-list"></i>';
    renderCards(currentData, elements.searchInput.value,
        elements.favoritesBtn.classList.contains('active'));
}

// ── GETTERS / SETTERS ─────────────────────────────────────────
export function setCurrentData(data) { currentData = data; }
export function getCurrentData()     { return currentData; }