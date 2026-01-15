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

// DOM Elements
const textDisplay = document.getElementById('text-display');
const readBtn = document.getElementById('read-btn');
const statusMessage = document.getElementById('status-message');
const successSound = document.getElementById('success-sound');
const gentleSound = document.getElementById('gentle-sound');

// Speech Recognition Setup
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
        isListening = true;
        updateUIState();
    };

    recognition.onend = () => {
        isListening = false;
        updateUIState();
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        handleSpeechResult(transcript);
    };

    recognition.onerror = (event) => {
        console.error("Speech recognition error", event.error);
        statusMessage.textContent = "No te escuché bien, ¿probamos de nuevo?";
        isListening = false;
        updateUIState();
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
            recognition.start();
            statusMessage.textContent = "Te escucho...";
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
        span.dataset.word = cleanWord(word);
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

function handleSpeechResult(transcript) {
    console.log("Heard:", transcript);
    const targetPhrase = songData[currentPhraseIndex];
    const targetWords = targetPhrase.split(' ').map(cleanWord);
    const spokenWords = transcript.split(' ').map(cleanWord);

    // Simple fuzzy matching: check if most words are present in order
    let matchCount = 0;
    let firstErrorIndex = -1;
    let spokenIndex = 0;

    for (let i = 0; i < targetWords.length; i++) {
        const target = targetWords[i];
        let found = false;

        // Look ahead a bit in spoken words to allow for skipped words or extra noise
        for (let j = spokenIndex; j < Math.min(spokenIndex + 3, spokenWords.length); j++) {
            if (spokenWords[j] === target) {
                found = true;
                spokenIndex = j + 1;
                break;
            }
        }

        if (found) {
            matchCount++;
        } else if (firstErrorIndex === -1) {
            firstErrorIndex = i;
        }
    }

    const accuracy = matchCount / targetWords.length;

    // Threshold: 70% accuracy or if phrase is very short (<=2 words), need 100% or 1 mismatch
    const isSuccess = accuracy >= 0.7 || (targetWords.length <= 3 && matchCount >= targetWords.length - 1);

    if (isSuccess) {
        successSound.play();
        statusMessage.textContent = "¡Muy bien! 🌟";

        // Highlight all green
        document.querySelectorAll('.word').forEach(el => el.style.color = 'var(--success-color)');

        setTimeout(() => {
            currentPhraseIndex++;
            loadPhrase(currentPhraseIndex);
        }, 1500);
    } else {
        problematicWordIndex = firstErrorIndex !== -1 ? firstErrorIndex : 0;
        handleMistake();
    }
}

function handleMistake() {
    attemptCount++;
    gentleSound.play();

    const words = document.querySelectorAll('.word');

    // Reset styles first
    words.forEach(w => {
        w.classList.remove('highlight', 'dimmed', 'syllables');
        w.textContent = songData[currentPhraseIndex].split(' ')[Array.from(words).indexOf(w)]; // Reset text
    });

    if (attemptCount === 1) {
        // Attempt 1: Highlight problematic word
        statusMessage.textContent = "¡Casi! Fíjate en esta palabra";
        if (words[problematicWordIndex]) {
            words[problematicWordIndex].classList.add('highlight');
        }
    } else if (attemptCount === 2) {
        // Attempt 2: Dim others, highlight problematic
        statusMessage.textContent = "Vamos despacito, solo esta palabra";
        words.forEach((w, i) => {
            if (i === problematicWordIndex) {
                w.classList.add('highlight');
            } else {
                w.classList.add('dimmed');
            }
        });
    } else {
        // Attempt 3: Syllabification
        statusMessage.textContent = "Repite conmigo sílaba por sílaba";
        words.forEach((w, i) => {
            if (i === problematicWordIndex) {
                const originalWord = songData[currentPhraseIndex].split(' ')[i];
                const syllables = syllabify(originalWord);
                w.textContent = syllables;
                w.classList.add('syllables');

                // Speak syllables slowly
                speakSyllables(originalWord);
            } else {
                w.classList.add('dimmed');
            }
        });
    }
}

function syllabify(word) {
    // Very basic Spanish syllabification for demo purposes
    // Real implementation would be more complex
    // VCV -> V-CV pattern mainly
    const vowels = 'aeiouáéíóúü';
    let syllables = [];
    let current = '';

    for (let i = 0; i < word.length; i++) {
        current += word[i];
        const isVowel = vowels.includes(word[i].toLowerCase());
        const nextIsVowel = i + 1 < word.length && vowels.includes(word[i + 1].toLowerCase());
        const nextNextIsVowel = i + 2 < word.length && vowels.includes(word[i + 2].toLowerCase());

        if (isVowel && !nextIsVowel && i + 1 < word.length) {
            // End of syllable usually?
            // Simple heuristic: V-CV
            if (i + 2 < word.length && nextNextIsVowel) {
                syllables.push(current);
                current = '';
            }
        }
    }
    syllables.push(current);

    // Fallback for better demo if heuristic fails (it's hard to do perfect regex syllabification in one go)
    // Let's use a simpler approach: just separating by dashes if manually defined, 
    // or use a library. Since we can't use external libs easily, let's use a dictionary or robust heuristic.

    // Better heuristic:
    // 1. Replace known words with manual syllables
    const manual = {
        "canten": "can - ten",
        "niños": "ni - ños",
        "alcancen": "al - can - cen",
        "cielo": "cie - lo",
        "viven": "vi - ven",
        "aquellos": "a - que - llos",
        "sufren": "su - fren",
        "dolor": "do - lor",
        "cantarán": "can - ta - rán",
        "esos": "e - sos"
    };

    const clean = cleanWord(word);
    if (manual[clean]) return manual[clean];

    // Fallback: split every 2-3 chars roughly (not ideal but works for unknown)
    return word.split('').join(' ');
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
        utterance.rate = 0.5; // Slow
        window.speechSynthesis.speak(utterance);
    }
}

// Start
init();
