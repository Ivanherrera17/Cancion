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

// Stop words (can be omitted by child)
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
let recognizedText = "";

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'es-MX';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
        console.log("Recognition started");
        isStarting = false;
        isListening = true;
        recognizedText = "";
        hasResult = false;
        updateUIState();

        // Safety timeout: 8 seconds
        clearTimeout(recognitionTimeout);
        recognitionTimeout = setTimeout(() => {
            if (isListening) {
                console.log("Recognition timed out (safety)");
                recognition.stop();
            }
        }, 8000);
    };

    recognition.onend = () => {
        console.log("Recognition ended. hasResult:", hasResult);
        isStarting = false;
        isListening = false;
        clearTimeout(recognitionTimeout);
        updateUIState();

        // If we are already in a success transition, do nothing
        if (isTransitioning) return;

        // Process result or handle as mistake
        if (hasResult && recognizedText.trim().length > 0) {
            handleSpeechResult(recognizedText);
        } else {
            // Silence, timeout, or error
            handleMistake();
        }

        // Reset for next attempt
        hasResult = false;
        recognizedText = "";
    };

    recognition.onresult = (event) => {
        if (event.results && event.results[0] && event.results[0][0]) {
            hasResult = true;
            recognizedText = event.results[0][0].transcript;
            console.log("Result captured:", recognizedText);
        }
    };

    recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        clearTimeout(recognitionTimeout);

        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            statusMessage.textContent = "Necesito permiso para escucharte.";
        }

        isStarting = false;
        updateUIState();
    };

    recognition.onnomatch = () => {
        console.log("No match found");
        clearTimeout(recognitionTimeout);
    };

} else {
    alert("Lo siento, tu navegador no soporta reconocimiento de voz. Prueba con Chrome o Safari.");
    readBtn.disabled = true;
}

// Initialization
function init() {
    loadPhrase(currentPhraseIndex);

    readBtn.addEventListener('click', () => {
        if (!isListening && !isStarting && !isTransitioning && recognition) {
            try {
                isStarting = true;
                recognition.start();
                statusMessage.textContent = "Te escucho...";
                updateUIState();
            } catch (e) {
                console.error("Error starting recognition:", e);
                isStarting = false;
                isListening = false;
                updateUIState();
                try { recognition.stop(); } catch (err) { }
            }
        }
    });
}

// --- FUNCIÓN DE LIMPIEZA OBLIGATORIA ---
function clearAllVisualStates() {
    const wordsElements = document.querySelectorAll('.word');
    wordsElements.forEach(w => {
        w.classList.remove('highlight', 'dimmed', 'syllables', 'success-flash');
        w.style.display = "inline-block";
        w.style.opacity = "1";
        w.style.color = "";
        w.style.fontWeight = "";
        // Restaurar texto original si estaba en sílabas
        const original = w.getAttribute('data-original');
        if (original) w.textContent = original;
    });
}

function loadPhrase(index) {
    // Reset de estado lógico
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
        // Guardamos el original desde el nacimiento del elemento
        span.setAttribute('data-original', word);
        textDisplay.appendChild(span);
    });

    statusMessage.textContent = "Presiona el micro y lee";
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

// --- LÓGICA DE NORMALIZACIÓN MEJORADA ---

function cleanWord(word) {
    return word.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Quita tildes pero mantiene la letra
        .replace(/[.,¡!¿?]/g, '');
}

function normalizeForComparison(word) {
    let w = cleanWord(word);
    w = w.replace(/ñ/g, 'n'); // El ASR a veces confunde ñ con n
    w = w.replace(/s$/, '');  // Ignorar plurales (niños vs niño)
    return w;
}

// --- COMPARACIÓN FLEXIBLE (TOLERANCIA A ERRORES) ---

function isCloseEnough(spoken, target) {
    const s = normalizeForComparison(spoken);
    const t = normalizeForComparison(target);

    if (s === t) return true;
    if (s.startsWith(t) || t.startsWith(s)) return true;

    // Distancia Levenshtein simple: permite 1 error de caracter
    if (Math.abs(s.length - t.length) <= 1) {
        let mismatches = 0;
        let i = 0, j = 0;
        while (i < s.length && j < t.length) {
            if (s[i] !== t[j]) mismatches++;
            i++; j++;
        }
        return mismatches <= 1;
    }
    return false;
}

function isKeyword(word) {
    const clean = cleanWord(word);
    return clean.length > 2 && !STOP_WORDS.includes(clean);
}

// --- EVALUACIÓN PEDAGÓGICA ---

function handleSpeechResult(transcript) {
    console.log("Evaluating:", transcript);
    const targetWords = currentPhraseWords;
    const spokenWords = transcript.split(' ');

    const targetKeywords = [];
    const keywordIndices = [];

    targetWords.forEach((word, i) => {
        if (isKeyword(word)) {
            targetKeywords.push(word);
            keywordIndices.push(i);
        }
    });

    // Si no hay keywords (frases cortas como "dolor"), usamos la palabra completa
    if (targetKeywords.length === 0) {
        const match = spokenWords.some(sw => isCloseEnough(sw, targetWords[0]));
        if (match) return showSuccess();
        problematicWordIndex = 0;
        return handleMistake();
    }

    let foundCount = 0;
    let firstMissedIdx = -1;

    // Buscamos cada keyword en el transcript
    targetKeywords.forEach((keyword, index) => {
        const found = spokenWords.some(sw => isCloseEnough(sw, keyword));
        if (found) {
            foundCount++;
        } else if (firstMissedIdx === -1) {
            firstMissedIdx = keywordIndices[index];
        }
    });

    // REGLA DE ORO: Si encuentra más del 70% de las palabras clave, damos por buena la frase
    const successRate = foundCount / targetKeywords.length;
    console.log("Success rate:", successRate);

    if (successRate >= 0.7) {
        showSuccess();
    } else {
        problematicWordIndex = firstMissedIdx !== -1 ? firstMissedIdx : keywordIndices[0];
        handleMistake();
    }
}

function showSuccess() {
    isTransitioning = true;
    if (successSound) successSound.play();
    statusMessage.textContent = "¡Muy bien! 🌟";

    // Feedback de éxito antes de limpiar
    document.querySelectorAll('.word').forEach(el => {
        el.classList.add('success-flash');
    });

    setTimeout(() => {
        currentPhraseIndex++;
        // Limpiamos TODO antes de cargar la siguiente
        clearAllVisualStates();
        loadPhrase(currentPhraseIndex);
        isTransitioning = false;
    }, 1800);
}

function handleMistake() {
    attemptCount++;
    if (gentleSound) gentleSound.play();

    if (problematicWordIndex === -1) problematicWordIndex = 0;

    const wordsElements = document.querySelectorAll('.word');

    // Limpieza preventiva antes de aplicar el nuevo nivel de ayuda
    wordsElements.forEach(el => {
        el.classList.remove('highlight', 'dimmed', 'syllables');
        el.style.display = "inline-block";
        el.style.opacity = "1";
    });

    if (attemptCount === 1) {
        statusMessage.textContent = "¡Casi! Inténtalo de nuevo";
        if (wordsElements[problematicWordIndex]) {
            wordsElements[problematicWordIndex].classList.add('highlight');
        }
    } else if (attemptCount === 2) {
        statusMessage.textContent = "Mira esta palabra...";
        wordsElements.forEach((w, i) => {
            if (i !== problematicWordIndex) w.classList.add('dimmed');
            else w.classList.add('highlight');
        });
    } else {
        // NIVEL 3: SÍLABAS (Solo aquí se transforma el texto)
        statusMessage.textContent = "Digámoslo por trocitos";
        const targetWord = currentPhraseWords[problematicWordIndex];
        const syllables = syllabify(targetWord);

        const el = wordsElements[problematicWordIndex];
        el.setAttribute('data-original', targetWord); // Guardamos para resetear luego
        el.textContent = syllables;
        el.classList.add('syllables');

        wordsElements.forEach((w, i) => {
            if (i !== problematicWordIndex) w.style.display = "none";
        });

        speakSyllables(targetWord);
    }
}

function syllabify(word) {
    const manual = {
        "canten": "can-ten",
        "niños": "ni-ños",
        "alcancen": "al-can-cen",
        "cielo": "cie-lo",
        "viven": "vi-ven",
        "aquellos": "a-que-llos",
        "sufren": "su-fren",
        "dolor": "do-lor",
        "esos": "e-sos",
        "cantaran": "can-ta-ran",
        "cantarán": "can-ta-ran"
    };
    const clean = cleanWord(word);
    return manual[clean] || word.split('').join('-');
}

function speakSyllables(word) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const syllables = syllabify(word);
        const utterance = new SpeechSynthesisUtterance(syllables.replace(/-/g, '... '));
        utterance.lang = 'es-MX';
        utterance.rate = 0.6;
        window.speechSynthesis.speak(utterance);
    }
}

// Start
init();
