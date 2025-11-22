let recognition;
let isListening = false;
let detectedGender = 'neutral';
let wordCount = 0;
let currentUtterance = null;
let lastGender = 'female'; // Para alternar en móvil si es necesario

// Variables audio (Solo PC)
let audioContext;
let analyser;
let microphoneStream;
let audioAnalysisInterval;

const GENDER_THRESHOLD_HZ = 165; 
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

function createStars() {
    const background = document.querySelector('.lab-background');
    background.innerHTML = '<div class="lab-floor"></div>';
    const starCount = isMobile ? 15 : 50; 
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
        alert("⚠️ Error: Tu navegador no soporta reconocimiento de voz. Usa Chrome.");
        return;
    }
    
    // Desbloquear audio inmediatamente
    unlockAudio();

    document.getElementById('startScreen').classList.remove('active');
    document.getElementById('gameScreen').classList.add('active');
    createStars();
    
    setupSpeechRecognition();
    
    const msg = isMobile ? 'Modo Móvil Activado. Presiona "Hablar"' : 'Listo. Presiona "Hablar"';
    showStatus(msg);
}

function unlockAudio() {
    if ('speechSynthesis' in window) {
        const empty = new SpeechSynthesisUtterance('');
        window.speechSynthesis.speak(empty);
    }
}

// ==========================================
// 1. LÓGICA DE GÉNERO (HÍBRIDA)
// ==========================================
async function startAudioAnalysis() {
    // EN MÓVIL: NO ACTIVAMOS EL ANÁLISIS REAL
    // Esto evita que el micrófono se sature y falle el reconocimiento de texto.
    if (isMobile) {
        console.log("📱 Móvil detectado: Usando lógica ligera.");
        return;
    }

    // EN PC: SÍ USAMOS ANÁLISIS REAL
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContext = new AudioContext();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;

        microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const source = audioContext.createMediaStreamSource(microphoneStream);
        source.connect(analyser);
        audioAnalysisInterval = setInterval(analyzePitchPC, 200);
    } catch (error) {
        console.error("⚠️ Error audio PC:", error);
    }
}

function stopAudioAnalysis() {
    if (audioAnalysisInterval) clearInterval(audioAnalysisInterval);
    // Solo cerramos tracks si existen
    if (microphoneStream) {
        microphoneStream.getTracks().forEach(track => track.stop());
        microphoneStream = null;
    }
    if (audioContext && audioContext.state !== 'closed') {
        audioContext.close();
    }
}

// SOLO PARA PC
function analyzePitchPC() {
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
    if (maxVal < 50 || hz < 50 || hz > 800) return;

    detectedGender = (hz < GENDER_THRESHOLD_HZ) ? 'male' : 'female';
    updateCharacter(detectedGender);
}

// LÓGICA PARA MÓVIL (Simulación basada en Texto o Alternancia)
function determineMobileGender(text) {
    const lowerText = text.toLowerCase();
    
    // 1. Buscar pistas en el texto
    if (lowerText.includes('hombre') || lowerText.includes('niño') || lowerText.includes('chico')) return 'male';
    if (lowerText.includes('mujer') || lowerText.includes('niña') || lowerText.includes('chica')) return 'female';
    
    // 2. Si no hay pistas, alternar para mostrar que funcionan ambos colores
    lastGender = (lastGender === 'male') ? 'female' : 'male';
    return lastGender;
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
        document.getElementById('micBtn').classList.add('listening');
        document.getElementById('micBtn').innerHTML = '👂 Escuchando...';
        document.getElementById('character').classList.add('speaking');
        showStatus('¡HABLA AHORA!');
        
        // Solo iniciamos análisis Hz en PC
        startAudioAnalysis();
    };

    recognition.onend = function() {
        isListening = false;
        document.getElementById('micBtn').classList.remove('listening');
        document.getElementById('micBtn').innerHTML = '🎤 Hablar';
        
        stopAudioAnalysis();
        
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
        // En móvil, el error 'no-speech' es muy común, lo ignoramos visualmente
        if (event.error !== 'no-speech') {
            showStatus('Error: ' + event.error, true);
        } else {
            showStatus('No te escuché. Intenta de nuevo.', true);
        }
        isListening = false;
        document.getElementById('micBtn').classList.remove('listening');
    };
}

function toggleListening() {
    window.speechSynthesis.cancel();
    unlockAudio(); // Importante en móvil

    if (isListening) {
        recognition.stop();
    } else {
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
    
    // EN MÓVIL: Usamos la lógica simulada. EN PC: Usamos lo que detectó el analizador
    if (isMobile) {
        detectedGender = determineMobileGender(text);
        updateCharacter(detectedGender);
    }
    
    const genderText = detectedGender === 'male' ? 'Masculino' : 'Femenino';
    showStatus(`Género: ${genderText} | Respondiendo...`);
    
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
    } else {
        character.classList.add('female');
        genderLabel.classList.add('female');
        genderLabel.textContent = 'Femenino';
    }
}

// ==========================================
// 3. SINTESIS DE VOZ (SIMPLIFICADA PARA MÓVIL)
// ==========================================
function speakText(text, gender) {
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();

    currentUtterance = new SpeechSynthesisUtterance(text);
    currentUtterance.lang = 'es-ES';
    currentUtterance.volume = 1.0;

    // CONFIGURACIÓN ROBUSTA (A prueba de fallos)
    if (gender === 'female') {
        currentUtterance.pitch = 1.4; // Agudo
        currentUtterance.rate = 1.1;
    } else {
        currentUtterance.pitch = 0.7; // Grave
        currentUtterance.rate = 0.9;
    }

    // En PC intentamos buscar voces bonitas. En Móvil NO (para evitar fallos)
    if (!isMobile) {
        const voices = window.speechSynthesis.getVoices();
        let selectedVoice = null;
        if (gender === 'female') {
            selectedVoice = voices.find(v => v.name.includes('Helena') || v.name.includes('Sabina') || v.name.includes('Google'));
        } else {
            selectedVoice = voices.find(v => v.name.includes('Pablo') || v.name.includes('Raul'));
        }
        if (selectedVoice) currentUtterance.voice = selectedVoice;
    }

    // Animación
    const charDiv = document.getElementById('character');
    currentUtterance.onstart = () => charDiv.classList.add('speaking');
    currentUtterance.onend = () => charDiv.classList.remove('speaking');
    currentUtterance.onerror = () => charDiv.classList.remove('speaking');

    // Hablar
    window.speechSynthesis.speak(currentUtterance);
    if (window.speechSynthesis.paused) window.speechSynthesis.resume();
}

function resetGame() {
    window.speechSynthesis.cancel();
    document.getElementById('speechText').textContent = '¡Hola! Presiona el botón y habla...';
    wordCount = 0;
    document.getElementById('wordCount').textContent = '0';
    updateCharacter('neutral');
    showStatus('Juego reiniciado');
}

function showStatus(message, isError = false) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.style.color = isError ? '#ff6b6b' : 'white';
}

if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}

















