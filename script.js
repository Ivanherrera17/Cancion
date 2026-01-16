// Song Data: "Que canten los niños"
const songData = [
    "Que canten los niños",
    "que alcancen el cielo",
    "que canten los niños",
    "que viven en paz",
    "y aquellos que sufren",
    "dolor",
    "que canten por esos",
    "que no cantarán"
];

const STOP_WORDS = ['que', 'el', 'la', 'los', 'las', 'y', 'en', 'de', 'por', 'no'];

// State
let currentPhraseIndex = 0;
let attemptCount = 0;
let isListening = false;
let isStarting = false;
let isTransitioning = false;
let problematicWordIndex = -1;
let hasResult = false;
let currentPhraseWords = [];
let recognizedText = "";

// DOM Elements
const textDisplay = document.getElementById('text-display');
const readBtn = document.getElementById('read-btn');
const statusMessage = document.getElementById('status-message');
const successSound = document.getElementById('success-sound');
const gentleSound = document.getElementById('gentle-sound');

// Speech Recognition Setup
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;
let recognitionTimeout;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'es-MX';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
        isStarting = false;
        isListening = true;
        hasResult = false;
        recognizedText = "";

        // --- CORRECCIÓN CRÍTICA ---
        // Antes de escuchar, limpiamos visualmente para que el niño vea el verso completo
        resetVisualsToAttempt();

        updateUIState();
        clearTimeout(recognitionTimeout);
        recognitionTimeout = setTimeout(() => {
            if (isListening) recognition.stop();
        }, 8000);
    };

    recognition.onend = () => {
        isStarting = false;
        isListening = false;
        clearTimeout(recognitionTimeout);
        updateUIState();

        if (isTransitioning) return;

        // Decisión forzada para evitar bloqueos
        if (hasResult && recognizedText.trim().length > 0) {
            handleSpeechResult(recognizedText);
        } else {
            handleMistake();
        }
    };

    recognition.onresult = (event) => {
        if (event.results && event.results[0]) {
            hasResult = true;
            recognizedText = event.results[0][0].transcript;
        }
    };

    recognition.onerror = () => {
        isStarting = false;
        updateUIState();
    };

} else {
    alert("Navegador no soportado.");
}

// --- FUNCIONES DE LIMPIEZA VISUAL (BLINDAJE) ---

// Restaura el verso a su estado normal (limpia resaltados y devuelve palabras ocultas)
function resetVisualsToAttempt() {
    const wordsElements = document.querySelectorAll('.word');
    wordsElements.forEach(w => {
        w.classList.remove('highlight', 'dimmed', 'syllables', 'success-flash');
        w.style.display = "inline-block";
        w.style.opacity = "1";
        // Si estaba en sílabas, restauramos la palabra original
        const original = w.getAttribute('data-original');
        if (original) w.textContent = original;
    });
}

// --- LOGICA DE CARGA ---

function loadPhrase(index) {
    attemptCount = 0;
    problematicWordIndex = -1;
    recognizedText = "";

    if (index >= songData.length) {
        textDisplay.innerHTML = "<h2 style='color:#2ecc71'>¡Lo lograste! 🎉</h2><p>Lees muy bien.</p>";
        readBtn.style.display = 'none';
        statusMessage.textContent = "";
        return;
    }

    currentPhraseWords = songData[index].split(' ');
    textDisplay.innerHTML = '';

    currentPhraseWords.forEach((word) => {
        const span = document.createElement('span');
        span.textContent = word;
        span.className = 'word';
        span.setAttribute('data-original', word); // Respaldamos la palabra
        textDisplay.appendChild(span);
    });

    statusMessage.textContent = "Presiona el micro y lee";
}

// --- NORMALIZACIÓN Y COMPARACIÓN ---

function cleanWord(word) {
    return word.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[.,¡!¿?]/g, '');
}

function normalizeForComparison(word) {
    let w = cleanWord(word);
    w = w.replace(/ñ/g, 'n');
    w = w.replace(/s$/, ''); // Ignorar plurales (niños/niño)
    return w;
}

function isCloseEnough(spoken, target) {
    const s = normalizeForComparison(spoken);
    const t = normalizeForComparison(target);
    if (s === t || s.startsWith(t) || t.startsWith(s)) return true;

    if (Math.abs(s.length - t.length) <= 1) {
        let mismatches = 0;
        for (let i = 0; i < Math.min(s.length, t.length); i++) {
            if (s[i] !== t[i]) mismatches++;
        }
        return mismatches <= 1;
    }
    return false;
}

function isKeyword(word) {
    const clean = cleanWord(word);
    return clean.length > 2 && !STOP_WORDS.includes(clean);
}

// --- EVALUACIÓN ---

function handleSpeechResult(transcript) {
    const spokenWords = transcript.split(' ');
    const targetKeywords = [];
    const keywordIndices = [];

    currentPhraseWords.forEach((word, i) => {
        if (isKeyword(word)) {
            targetKeywords.push(word);
            keywordIndices.push(i);
        }
    });

    if (targetKeywords.length === 0) {
        const match = spokenWords.some(sw => isCloseEnough(sw, currentPhraseWords[0]));
        if (match) return showSuccess();
        problematicWordIndex = 0;
        return handleMistake();
    }

    let foundCount = 0;
    let firstMissedIdx = -1;

    targetKeywords.forEach((keyword, index) => {
        const found = spokenWords.some(sw => isCloseEnough(sw, keyword));
        if (found) {
            foundCount++;
        } else if (firstMissedIdx === -1) {
            firstMissedIdx = keywordIndices[index];
        }
    });

    const successRate = foundCount / targetKeywords.length;

    if (successRate >= 0.7) {
        showSuccess();
    } else {
        // Blindaje de índice: siempre debe haber una palabra que señalar
        problematicWordIndex = firstMissedIdx !== -1 ? firstMissedIdx : (keywordIndices[0] || 0);
        handleMistake();
    }
}

function showSuccess() {
    isTransitioning = true;
    if (successSound) successSound.play();
    statusMessage.textContent = "¡Muy bien! 🌟";

    document.querySelectorAll('.word').forEach(el => el.classList.add('success-flash'));

    setTimeout(() => {
        currentPhraseIndex++;
        loadPhrase(currentPhraseIndex);
        isTransitioning = false;
    }, 1800);
}

function handleMistake() {
    attemptCount++;
    if (gentleSound) gentleSound.play();

    if (problematicWordIndex === -1) problematicWordIndex = 0;
    const wordsElements = document.querySelectorAll('.word');

    // Nivel 1: Resaltar
    if (attemptCount === 1) {
        statusMessage.textContent = "¡Casi! Inténtalo de nuevo";
        if (wordsElements[problematicWordIndex]) {
            wordsElements[problematicWordIndex].classList.add('highlight');
        }
    }
    // Nivel 2: Enfocar
    else if (attemptCount === 2) {
        statusMessage.textContent = "Mira esta palabra...";
        wordsElements.forEach((w, i) => {
            if (i !== problematicWordIndex) w.classList.add('dimmed');
            else w.classList.add('highlight');
        });
    }
    // Nivel 3: Sílabas
    else {
        statusMessage.textContent = "Digámoslo por trocitos";
        const targetWord = currentPhraseWords[problematicWordIndex];
        const syllables = syllabify(targetWord);

        const el = wordsElements[problematicWordIndex];
        el.textContent = syllables;
        el.classList.add('syllables');

        wordsElements.forEach((w, i) => {
            if (i !== problematicWordIndex) w.style.display = "none";
        });

        speakSyllables(targetWord);
    }
}

// --- UTILIDADES ---

function syllabify(word) {
    const manual = {
        "canten": "can-ten", "niños": "ni-ños", "alcancen": "al-can-cen",
        "cielo": "cie-lo", "viven": "vi-ven", "aquellos": "a-que-llos",
        "sufren": "su-fren", "dolor": "do-lor", "esos": "e-sos", "cantarán": "can-ta-ran"
    };
    const clean = cleanWord(word);
    return manual[clean] || word.split('').join('-');
}

function speakSyllables(word) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(syllabify(word).replace(/-/g, '... '));
        utterance.lang = 'es-MX';
        utterance.rate = 0.5;
        window.speechSynthesis.speak(utterance);
    }
}

function updateUIState() {
    if (isListening || isStarting) {
        readBtn.classList.add('listening');
        readBtn.innerHTML = "<span><span>🎤</span> Escuchando...</span>";
    } else {
        readBtn.classList.remove('listening');
        readBtn.innerHTML = "<span>Lee conmigo</span>";
    }
}

function init() {
    loadPhrase(currentPhraseIndex);
    readBtn.addEventListener('click', () => {
        if (!isListening && !isStarting && !isTransitioning && recognition) {
            isStarting = true;
            recognition.start();
        }
    });
}

init();
