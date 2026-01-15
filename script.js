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
let recognitionTimeout;
let recognizedText = "";

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'es-MX';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1; // Explicitly request single result

    recognition.onstart = () => {
        isListening = true;
        recognizedText = "";
        updateUIState();

        // Safety timeout: Stop if no result after 5 seconds
        // 4s might be too short for Android initialization + speaking time
        clearTimeout(recognitionTimeout);
        recognitionTimeout = setTimeout(() => {
            if (isListening) {
                console.log("Recognition timed out");
                recognition.stop();
            }
        }, 5000);
    };

    recognition.onend = () => {
        isListening = false;
        clearTimeout(recognitionTimeout);
        updateUIState();

        // Process the reading here
        handleSpeechResult(recognizedText);
    };

    recognition.onresult = (event) => {
        // Just capture the text
        if (event.results && event.results[0] && event.results[0][0]) {
            recognizedText = event.results[0][0].transcript;
        }
    };

    recognition.onerror = (event) => {
        console.error("Speech recognition error", event.error);
        clearTimeout(recognitionTimeout);
        // Don't stop immediately on error, let onend handle the flow
        // But if it's a fatal error, we might need to reset
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            statusMessage.textContent = "Necesito permiso para escucharte.";
            isListening = false;
            updateUIState();
        }
    };

    recognition.onnomatch = () => {
        // No match found
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
                // If already started, stop it
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

    if (!transcript || transcript.trim().length === 0) {
        handleMistake();
        return;
    }

    const targetPhrase = songData[currentPhraseIndex];
    const targetWords = targetPhrase.split(' ').map(cleanWord);
    const spokenWords = transcript.split(' ').map(cleanWord);

    // Logic: Find the first word that doesn't match
    let matchCount = 0;
    let keywordMatchCount = 0;
    let totalKeywords = 0;
    let firstErrorIndex = -1;
    let spokenIndex = 0;

    // Define stop words (common short words that might be skipped)
    const stopWords = ['que', 'el', 'la', 'los', 'las', 'y', 'en', 'de', 'por', 'no'];

    for (let i = 0; i < targetWords.length; i++) {
        const target = targetWords[i];
        const isKeyword = target.length > 3 || !stopWords.includes(target);
        if (isKeyword) totalKeywords++;

        let found = false;

        // Look ahead a bit (window of 4 to be more generous)
        for (let j = spokenIndex; j < Math.min(spokenIndex + 4, spokenWords.length); j++) {
            // Allow exact match OR very close match (e.g. singular/plural or small typo)
            // For now, strict equality is safest without a library, but we can check inclusion
            if (spokenWords[j] === target || (target.length > 4 && spokenWords[j].includes(target.substring(0, target.length - 1)))) {
                found = true;
                spokenIndex = j + 1;
                break;
            }
        }

        if (found) {
            matchCount++;
            if (isKeyword) keywordMatchCount++;
        } else {
            if (firstErrorIndex === -1) {
                firstErrorIndex = i;
            }
        }
    }

    // Relaxed Success Criteria
    const totalWords = targetWords.length;
    let isSuccess = false;

    if (totalWords <= 2) {
        // Very short phrase (1-2 words): Must match at least 1 word (if 2) or the word (if 1)
        // But if it's 2 words and one is a stop word, matching the keyword is enough
        if (totalKeywords > 0) {
            isSuccess = (keywordMatchCount === totalKeywords);
        } else {
            isSuccess = (matchCount === totalWords);
        }
    } else {
        // Longer phrase: 
        // 1. High general accuracy (> 60%)
        // 2. OR All keywords matched
        const accuracy = matchCount / totalWords;
        const keywordAccuracy = totalKeywords > 0 ? (keywordMatchCount / totalKeywords) : 1;

        isSuccess = (accuracy >= 0.6) || (keywordAccuracy >= 0.8);
    }

    // Edge case: If only 1 word was spoken and it matches, but phrase is long -> Fail?
    // "Que canten los niños" -> "canten"
    // matchCount = 1, total = 4 (25%). Keywords = 2. keywordMatch = 1 (50%). Fail. Correct.

    // "que viven en paz" -> "viven paz"
    // matchCount = 2, total = 4 (50%). Keywords = 2 ("viven", "paz"). keywordMatch = 2 (100%). Pass. Correct.

    if (isSuccess) {
        successSound.play();
        statusMessage.textContent = "¡Muy bien! 🌟";
        document.querySelectorAll('.word').forEach(el => {
            el.style.color = 'var(--success-color)';
            el.style.visibility = 'visible'; // Ensure visible
            el.style.opacity = '1';
        });

        setTimeout(() => {
            currentPhraseIndex++;
            loadPhrase(currentPhraseIndex);
        }, 1500);
    } else {
        // If no specific error found (e.g. they said completely different words), default to 0
        problematicWordIndex = firstErrorIndex !== -1 ? firstErrorIndex : 0;
        handleMistake();
    }
}

function handleMistake() {
    attemptCount++;
    gentleSound.play();

    const words = document.querySelectorAll('.word');

    // Reset styles first (but keep text content if we changed it previously?)
    // Actually, for Attempt 3 we change text. We should reset text if we are retrying?
    // The user flow implies we stay on the same phrase.
    // Let's reset text content to original word first to be safe.
    words.forEach((w, i) => {
        w.classList.remove('highlight', 'dimmed', 'syllables');
        w.style.visibility = 'visible';
        w.style.opacity = '1';
        w.textContent = songData[currentPhraseIndex].split(' ')[i];
    });

    if (attemptCount === 1) {
        // Attempt 1: Highlight problematic word, others normal
        statusMessage.textContent = "Casi... mira esta palabra";
        if (words[problematicWordIndex]) {
            words[problematicWordIndex].classList.add('highlight');
        }
    } else if (attemptCount === 2) {
        // Attempt 2: HIDE others, show problematic
        statusMessage.textContent = "Vamos despacito, solo esta palabra";
        words.forEach((w, i) => {
            if (i === problematicWordIndex) {
                w.classList.add('highlight');
            } else {
                w.style.visibility = 'hidden'; // Hide completely
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
                w.style.visibility = 'hidden'; // Hide completely
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
