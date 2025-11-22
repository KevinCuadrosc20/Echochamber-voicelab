/* ==========================================
   ECHO CHAMBER - SCRIPT CORREGIDO PARA ANDROID
   Soluciona: 
   1. Falta de audio en respuesta (Garbage Collection)
   2. Detección intermitente (Umbral de ruido)
   ========================================== */

let recognition;
let isListening = false;
let detectedGender = 'neutral';
let wordCount = 0;
let currentUtterance = null; // VARIABLE GLOBAL PARA QUE ANDROID NO LA BORRE

// Variables audio
let audioContext;
let analyser;
let microphoneStream;
let audioAnalysisInterval;

// Umbral de frecuencia (Hz)
const GENDER_THRESHOLD_HZ = 165; 

// Detectar si es móvil
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

function createStars() {
    const background = document.querySelector('.lab-background');
    background.innerHTML = '<div class="lab-floor"></div>';
    const starCount = isMobile ? 20 : 50; 
    for (let i = 0; i < starCount; i++) {
        const star = document.createElement('div');
        star.className = 'stars';
        star.style.left = Math.random() * 100 + '%';
        star.style.top = Math.random() * 80 + '%';
        star.style.animationDelay = Math.random() * 2 + 's';
        background.appendChild(star);
    }
}

function startGame() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("⚠️ Error: Navegador no compatible. Usa Google Chrome.");
        return;
    }
    
    // Truco: Desbloquear el audio del celular inmediatamente
    unlockAudio();

    document.getElementById('startScreen').classList.remove('active');
    document.getElementById('gameScreen').classList.add('active');
    createStars();
    setupSpeechRecognition();
    showStatus('Listo. Presiona el botón "Hablar"');
}

// TRUCO IMPORTANTE PARA ANDROID: Reproducir silencio para "despertar" al sintetizador
function unlockAudio() {
    if ('speechSynthesis' in window) {
        const empty = new SpeechSynthesisUtterance('');
        window.speechSynthesis.speak(empty);
    }
}

// ==========================================
// 1. ANÁLISIS DE FRECUENCIA (GÉNERO)
// ==========================================
async function startAudioAnalysis() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContext = new AudioContext();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;

        microphoneStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true // Importante para celulares
            } 
        });

        const source = audioContext.createMediaStreamSource(microphoneStream);
        source.connect(analyser);
        audioAnalysisInterval = setInterval(analyzePitch, 200);

    } catch (error) {
        console.error("⚠️ Error audio:", error);
    }
}

function stopAudioAnalysis() {
    if (audioAnalysisInterval) clearInterval(audioAnalysisInterval);
    if (microphoneStream) {
        microphoneStream.getTracks().forEach(track => track.stop());
        microphoneStream = null;
    }
    if (audioContext && audioContext.state !== 'closed') {
        audioContext.close();
    }
}

function analyzePitch() {
    if (!analyser) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    let maxVal = 0;
    let maxIndex = 0;

    for (let i = 0; i < bufferLength; i++) {
        if (dataArray[i] > maxVal) {
            maxVal = dataArray[i];
            maxIndex = i;
        }
    }

    const hz = maxIndex * (audioContext.sampleRate / analyser.fftSize);

    // HE BAJADO EL UMBRAL DE RUIDO A 50 (Antes 100) PARA QUE DETECTE MEJOR
    if (maxVal < 50 || hz < 50 || hz > 800) return;

    if (hz < GENDER_THRESHOLD_HZ) {
        detectedGender = 'male';
    } else {
        detectedGender = 'female';
    }
    updateCharacter(detectedGender);
}

// ==========================================
// 2. RECONOCIMIENTO DE VOZ
// ==========================================
function setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.continuous = false; 
    recognition.interimResults = false;

    recognition.onstart = function() {
        isListening = true;
        const micBtn = document.getElementById('micBtn');
        micBtn.classList.add('listening');
        micBtn.innerHTML = '👂 Escuchando...';
        document.getElementById('character').classList.add('speaking');
        showStatus('¡HABLA AHORA! Detectando...');
        startAudioAnalysis();
    };

    recognition.onend = function() {
        isListening = false;
        document.getElementById('micBtn').classList.remove('listening');
        document.getElementById('micBtn').innerHTML = '🎤 Hablar';
        stopAudioAnalysis();
        
        // Solo quitamos la animación si NO va a hablar inmediatamente
        if (!window.speechSynthesis.speaking) {
            document.getElementById('character').classList.remove('speaking');
        }
    };

    recognition.onresult = function(event) {
        const transcript = event.results[0][0].transcript;
        processVoiceInput(transcript);
    };

    recognition.onerror = function(event) {
        stopAudioAnalysis();
        document.getElementById('character').classList.remove('speaking');
        showStatus('No te escuché bien. Intenta de nuevo.', true);
        isListening = false;
        document.getElementById('micBtn').classList.remove('listening');
    };
}

function toggleListening() {
    window.speechSynthesis.cancel(); // Callar si estaba hablando
    
    // Truco: Despertar audio de nuevo al hacer click
    unlockAudio();

    if (isListening) {
        recognition.stop();
    } else {
        detectedGender = 'neutral'; 
        updateCharacter('neutral');
        try {
            recognition.start();
        } catch (e) {
            setupSpeechRecognition();
            setTimeout(() => recognition.start(), 200);
        }
    }
}

function processVoiceInput(text) {
    wordCount = text.split(' ').filter(w => w.length > 0).length;
    document.getElementById('wordCount').textContent = wordCount;
    document.getElementById('speechText').textContent = `Dijiste: "${text}"`;
    
    const genderText = detectedGender === 'male' ? 'Masculino' : 'Femenino';
    showStatus(`Género: ${genderText} | Respondiendo...`);
    
    // LLAMAR A LA FUNCIÓN DE HABLAR CORREGIDA
    speakText(text, detectedGender);
}

function updateCharacter(gender) {
    const character = document.getElementById('character');
    const genderLabel = document.getElementById('genderLabel');
    character.classList.remove('male', 'female');
    genderLabel.classList.remove('male', 'female');
    
    if (gender === 'male') {
        character.classList.add('male');
        genderLabel.classList.add('male');
        genderLabel.textContent = 'Masculino';
    } else if (gender === 'female') {
        character.classList.add('female');
        genderLabel.classList.add('female');
        genderLabel.textContent = 'Femenino';
    } else {
        genderLabel.textContent = 'Analizando...';
    }
}

// ==========================================
// 3. SINTESIS DE VOZ (PARA ANDROID)
// ==========================================
function speakText(text, gender) {
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();

    // USAMOS LA VARIABLE GLOBAL
    currentUtterance = new SpeechSynthesisUtterance(text);
    currentUtterance.lang = 'es-ES';
    currentUtterance.volume = 1.0;

    // En Android, a veces es mejor dejar la voz por defecto y solo cambiar el Pitch
    // porque buscar voces específicas suele fallar.
    if (gender === 'female') {
        currentUtterance.pitch = 1.3; // Agudo (Mujer)
        currentUtterance.rate = 1.1;
    } else {
        currentUtterance.pitch = 0.8; // Grave (Hombre)
        currentUtterance.rate = 0.9;
    }

    // Animación del personaje
    const charDiv = document.getElementById('character');
    
    currentUtterance.onstart = () => {
        charDiv.classList.add('speaking');
    };
    
    currentUtterance.onend = () => {
        charDiv.classList.remove('speaking');
    };
    
    currentUtterance.onerror = (e) => {
        console.error("Error al hablar:", e);
        charDiv.classList.remove('speaking');
    };

    // Forzar la reproducción
    window.speechSynthesis.speak(currentUtterance);
    
    // Si Android pausa el audio, lo forzamos a continuar
    if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
    }
}

function resetGame() {
    window.speechSynthesis.cancel();
    document.getElementById('speechText').textContent = '¡Hola! Presiona el botón y habla...';
    wordCount = 0;
    document.getElementById('wordCount').textContent = '0';
    detectedGender = 'neutral';
    updateCharacter('neutral');
    showStatus('Juego reiniciado');
}

function showStatus(message, isError = false) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.style.color = isError ? '#ff6b6b' : 'white';
}

















