// audio.js — v2.0

let audioCtx = null;

function getAudioCtx() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
}

// Fonction utilitaire pour générer le son d'un grain de bois massif
function synthBead(ctx) {
    const now = ctx.currentTime;

    // Simulation acoustique d'un bloc de bois
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    // L'onde triangle donne le côté plein/mat du bois
    osc.type = 'triangle';

    // Chute de fréquence très rapide pour le côté "clic" d'impact
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.03);

    // Attaque immédiate et silence brutal
    gain.gain.setValueAtTime(1.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    // Filtre passe-bande pour imiter la petite caisse de résonance du bois
    filter.type = 'bandpass';
    filter.frequency.value = 550; // Fréquence de résonance du bois
    filter.Q.value = 2.0;

    // Connexion des modules audio
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    // Déclenchement (durée ultra courte : 40ms)
    osc.start(now);
    osc.stop(now + 0.05);
}

/**
 * Son doux d'un grain de chapelet (click + résonance)
 */
export function playBeadSound() {
    try {
        const ctx = getAudioCtx();
        // Gérer correctement la promesse de reprise
        if (ctx.state === 'suspended') {
            ctx.resume().then(() => synthBead(ctx));
        } else {
            synthBead(ctx);
        }
    } catch(e) {
        // Silencieux si AudioContext non disponible
    }
}

/**
 * Mélodie de succès (objectif atteint) — accord ascendant
 */
export function playGoalSound() {
    try {
        const ctx  = getAudioCtx();
        
        const playMelody = () => {
            const notes = [523.25, 659.25, 783.99, 1046.5]; // Do, Mi, Sol, Do+
            notes.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const g   = ctx.createGain();
                osc.connect(g);
                g.connect(ctx.destination);
                osc.type = 'triangle';
                const t = ctx.currentTime + i * 0.10;
                osc.frequency.setValueAtTime(freq, t);
                g.gain.setValueAtTime(0, t);
                g.gain.linearRampToValueAtTime(0.35, t + 0.04);
                g.gain.exponentialRampToValueAtTime(0.01, t + 0.45);
                osc.start(t);
                osc.stop(t + 0.48);
            });
        };

        if (ctx.state === 'suspended') {
            ctx.resume().then(() => playMelody());
        } else {
            playMelody();
        }
    } catch(e) {}
}

/**
 * Lecture de la prononciation arabe via Web Speech API
 */
export function playAudio(item) {
    if (!item?.name) return;
    try {
        const utterance  = new SpeechSynthesisUtterance(item.name);
        utterance.lang   = 'ar-SA';
        utterance.rate   = 0.85;
        utterance.pitch  = 1.0;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
    } catch(e) {
        console.warn('SpeechSynthesis non disponible');
    }
}

export { getAudioCtx as initAudio };

