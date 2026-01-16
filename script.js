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

// State
let currentPhraseIndex = 0;
let attemptCount = 0;
let isListening = false;
let problematicWordIndex = -1;
let hasResult = false;

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
        isListening = true;
        recognizedText = "";
        hasResult = false;
        updateUIState();

        // Safety timeout: 8 seconds
        clearTimeout(recognitionTimeout);
        recognitionTimeout = setTimeout(() => {
            if (isListening) {
                console.log("Recognition timed out");
                recognition.stop();
            }
        }, 8000);
    };

    recognition.onend = () => {
        isListening = false;
        clearTimeout(recognitionTimeout);
        updateUIState();

        if (hasResult) {
            handleSpeechResult(recognizedText);
        } else {
            handleMistake();
        }
        hasResult = false;
    };

    recognition.onresult = (event) => {
        if (event.results && event.results[0] && event.results[0][0]) {
            hasResult = true;
            recognizedText = event.results[0][0].transcript;
        }
    };

    recognition.onerror = (event) => {
        console.error("Speech recognition error", event.error);
        clearTimeout(recognitionTimeout);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            statusMessage.textContent = "Necesito permiso para escucharte.";
            isListening = false;
            updateUIState();
        }
    };

    recognition.onnomatch = () => {
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
        if (!isListening && recognition) {
            try {
                recognition.start();
                statusMessage.textContent = "Te escucho...";
            } catch (e) {
                console.error("Error starting recognition:", e);
                recognition.stop();
            }
        }
    });
}

function loadPhrase(index) {
    if (index >= songData.length) {
        textDisplay.innerHTML = "<div style='width:100%'>¡Muy bien! 🎉<br>Terminaste la canción.</div>";
        readBtn.style.display = 'none';
        statusMessage.textContent = "";
        return;
    }

    const phrase = songData[index];
    const words = phrase.split(' ');
    textDisplay.innerHTML = '';
    words.forEach((word, i) => {
        const span = document.createElement('span');
        span.textContent = word;
        span.className = 'word';
        span.id = `word-${i}`;
        span.dataset.word = normalize(word);
        textDisplay.appendChild(span);
    });

    attemptCount = 0;
    problematicWordIndex = -1;
    statusMessage.textContent = "Vamos a leer";
}

function updateUIState() {
    if (isListening) {
        readBtn.classList.add('listening');
        readBtn.querySelector('.label').textContent = "Escuchando...";
    } else {
        readBtn.classList.remove('listening');
        readBtn.querySelector('.label').textContent = "Lee conmigo";
    }
}

function cleanWord(word) {
    return word.toLowerCase().replace(/[.,¡!¿?]/g, '');
}

function normalize(word) {
    return cleanWord(word).replace(/s$/, '').replace(/es$/, '');
}

// --- SIMPLIFIED EVALUATION ---
// Success if:
// 1. Child says at least 50% of the words
// 2. Main words appear in any order
function handleSpeechResult(transcript) {
    console.log("Heard:", transcript);

    if (!transcript || transcript.trim().length === 0) {
        handleMistake();
        return;
    }

    const targetPhrase = songData[currentPhraseIndex];
    const targetWords = targetPhrase.split(' ').map(normalize);
    const spokenWords = transcript.split(' ').map(normalize);

    // Count how many target words were spoken (in any order)
    let matchCount = 0;
    let firstMissedIndex = -1;

    for (let i = 0; i < targetWords.length; i++) {
        const target = targetWords[i];
        if (spokenWords.includes(target)) {
            matchCount++;
        } else {
            if (firstMissedIndex === -1) {
                firstMissedIndex = i;
            }
        }
    }

    // Success: at least 50% of words spoken
    const isSuccess = matchCount >= Math.ceil(targetWords.length / 2);

    if (isSuccess) {
        successSound.play();
        statusMessage.textContent = "¡Muy bien! 🌟";
        document.querySelectorAll('.word').forEach(el => {
            el.style.color = 'var(--success-color)';
            el.style.visibility = 'visible';
            el.style.opacity = '1';
        });

        setTimeout(() => {
            currentPhraseIndex++;
            loadPhrase(currentPhraseIndex);
        }, 1500);
    } else {
        // If no specific error found, default to 0
        problematicWordIndex = firstMissedIndex !== -1 ? firstMissedIndex : 0;
        handleMistake();
    }
}

function handleMistake() {
    attemptCount++;
    gentleSound.play();

    const words = document.querySelectorAll('.word');

    words.forEach((w, i) => {
        w.classList.remove('highlight', 'dimmed', 'syllables');
        w.style.visibility = 'visible';
        w.style.opacity = '1';
        w.textContent = songData[currentPhraseIndex].split(' ')[i];
    });

    if (attemptCount === 1) {
        statusMessage.textContent = "Casi... mira esta palabra";
        if (words[problematicWordIndex]) {
            words[problematicWordIndex].classList.add('highlight');
        }
    } else if (attemptCount === 2) {
        statusMessage.textContent = "Vamos despacito, solo esta palabra";
        words.forEach((w, i) => {
            if (i === problematicWordIndex) {
                w.classList.add('highlight');
            } else {
                w.style.visibility = 'hidden';
            }
        });
    } else {
        statusMessage.textContent = "Repite conmigo sílaba por sílaba";
        words.forEach((w, i) => {
            if (i === problematicWordIndex) {
                const originalWord = songData[currentPhraseIndex].split(' ')[i];
                const syllables = syllabify(originalWord);
                w.textContent = syllables;
                w.classList.add('syllables');
                speakSyllables(originalWord);
            } else {
                w.style.visibility = 'hidden';
            }
        });
    }
}

function syllabify(word) {
    const manual = {
        "que": "que",
        "canten": "can - ten",
        "los": "los",
        "niños": "ni - ños",
        "alcancen": "al - can - cen",
        "el": "el",
        "cielo": "cie - lo",
        "viven": "vi - ven",
        "en": "en",
        "paz": "paz",
        "y": "y",
        "aquellos": "a - que - llos",
        "sufren": "su - fren",
        "dolor": "do - lor",
        "por": "por",
        "esos": "e - sos",
        "no": "no",
        "cantarán": "can - ta - rán"
    };

    const clean = cleanWord(word);
    if (manual[clean]) return manual[clean];

    return word.split('').join(' - ');
}

function speakSyllables(word) {
    if ('speechSynthesis' in window) {
        const clean = cleanWord(word);
        const manual = {
            "canten": "can... ten...",
            "niños": "ni... ños...",
            "alcancen": "al... can... cen...",
            "cielo": "cie... lo...",
            "viven": "vi... ven...",
            "aquellos": "a... que... llos...",
            "sufren": "su... fren...",
            "dolor": "do... lor...",
            "cantarán": "can... ta... rán...",
            "esos": "e... sos..."
        };

        const textToSay = manual[clean] || word;
        const utterance = new SpeechSynthesisUtterance(textToSay);
        utterance.lang = 'es-ES';
        utterance.rate = 0.5;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
    }
}

// Start
init();
