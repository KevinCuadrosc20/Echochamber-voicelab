let recognition;
let isListening = false;
let detectedGender = 'neutral';
let wordCount = 0;

// Variables para el análisis de audio (Frecuencia)
let audioContext;
let analyser;
let microphoneStream;
let audioAnalysisInterval;

// Configuración de umbral para género
// < 165Hz suele ser masculino, > 165Hz suele ser femenino
const GENDER_THRESHOLD_HZ = 165; 

// Detectar si es móvil
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

// Crear estrellas en el fondo
function createStars() {
    const background = document.querySelector('.lab-background');
    background.innerHTML = '<div class="lab-floor"></div>'; // Limpiar estrellas viejas
    
    const starCount = window.innerWidth < 768 ? 20 : 50; 
    
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
        alert("⚠️ ERROR: Tu navegador no soporta esta tecnología. Usa Google Chrome.");
        return;
    }

    document.getElementById('startScreen').classList.remove('active');
    document.getElementById('gameScreen').classList.add('active');
    createStars();
    
    // Configuramos el reconocimiento
    setupSpeechRecognition();
    
    showStatus('Listo. Presiona el botón "Hablar"');
}


async function startAudioAnalysis() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContext = new AudioContext();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;

        // Pedimos acceso al micrófono para analizar los Hz
        microphoneStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true
            } 
        });

        const source = audioContext.createMediaStreamSource(microphoneStream);
        source.connect(analyser);

        console.log("✅ Analizador de frecuencia iniciado");
        // Analizamos cada 200ms
        audioAnalysisInterval = setInterval(analyzePitch, 200);

    } catch (error) {
        console.error("⚠️ Error en análisis de audio:", error);
        // Si falla (común en algunos móviles), usaremos una detección aleatoria como respaldo
        // para que el juego no se rompa.
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

    // Buscar el pico de volumen/frecuencia
    let maxVal = 0;
    let maxIndex = 0;

    for (let i = 0; i < bufferLength; i++) {
        if (dataArray[i] > maxVal) {
            maxVal = dataArray[i];
            maxIndex = i;
        }
    }

    // Fórmula matemática para sacar los Hz
    const hz = maxIndex * (audioContext.sampleRate / analyser.fftSize);

    // Filtro de ruido (ignorar silencio o ruidos extraños)
    if (maxVal < 100 || hz < 50 || hz > 500) return;

    // Lógica simple: Grave = Hombre, Agudo = Mujer
    if (hz < GENDER_THRESHOLD_HZ) {
        detectedGender = 'male';
    } else {
        detectedGender = 'female';
    }

    // Actualizar el color del personaje en tiempo real
    updateCharacter(detectedGender);
}

// ==========================================
// RECONOCIMIENTO DE VOZ (TEXTO)
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
        
        showStatus('¡HABLA AHORA! Detectando voz...');
        
        // TRUCO: Iniciamos el análisis de frecuencia justo cuando el micro se abre
        startAudioAnalysis();
    };

    recognition.onend = function() {
        isListening = false;
        document.getElementById('micBtn').classList.remove('listening');
        document.getElementById('micBtn').innerHTML = '🎤 Hablar';
        
        // Detenemos análisis para ahorrar batería
        stopAudioAnalysis();
        
        if (!window.speechSynthesis.speaking) {
            document.getElementById('character').classList.remove('speaking');
        }
    };

    recognition.onresult = function(event) {
        const transcript = event.results[0][0].transcript;
        console.log(`📝 Texto: "${transcript}"`);
        processVoiceInput(transcript);
    };

    recognition.onerror = function(event) {
        console.error('Error:', event.error);
        stopAudioAnalysis();
        document.getElementById('character').classList.remove('speaking');
        showStatus('No entendí. Intenta de nuevo.', true);
        isListening = false;
        document.getElementById('micBtn').classList.remove('listening');
    };
}

function toggleListening() {
    window.speechSynthesis.cancel(); // Calla al personaje si estaba hablando

    if (isListening) {
        recognition.stop();
    } else {
        detectedGender = 'neutral'; 
        updateCharacter('neutral');
        try {
            recognition.start();
        } catch (e) {
            // Reinicio forzado si se traba
            setupSpeechRecognition();
            setTimeout(() => recognition.start(), 200);
        }
    }
}

// ==========================================
// PROCESAMIENTO Y RESPUESTA 
// ==========================================
function processVoiceInput(text) {
    wordCount = text.split(' ').filter(w => w.length > 0).length;
    document.getElementById('wordCount').textContent = wordCount;
    document.getElementById('speechText').textContent = `Dijiste: "${text}"`;
    
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
    } else if (gender === 'female') {
        character.classList.add('female');
        genderLabel.classList.add('female');
        genderLabel.textContent = 'Femenino';
    } else {
        genderLabel.textContent = 'Analizando...';
    }
}

// ESTA ES LA FUNCIÓN MEJORADA PARA QUE LA VOZ SUENE MEJOR
function speakText(text, gender) {
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES';
    utterance.volume = 1.0;

    const voices = window.speechSynthesis.getVoices();
    let selectedVoice = null;

    if (gender === 'female') {
        // === CONFIGURACIÓN MUJER (Suave) ===
        utterance.pitch = 1.15; // Tono natural (antes era 1.5 ardilla)
        utterance.rate = 1.05;

        // Buscamos voces de alta calidad (Microsoft Helena/Sabina o Google)
        selectedVoice = voices.find(v => 
            v.name.includes('Helena') || 
            v.name.includes('Sabina') || 
            v.name.includes('Laura') ||
            (v.lang.includes('es') && v.name.includes('Google'))
        );
        
        // Si no, cualquiera de mujer
        if (!selectedVoice) {
            selectedVoice = voices.find(v => v.lang.includes('es') && (v.name.includes('Female') || v.name.includes('Mujer')));
        }

    } else {
        // === CONFIGURACIÓN HOMBRE (Firme) ===
        utterance.pitch = 0.9; // Tono firme (antes era 0.7 monstruo)
        utterance.rate = 0.95;

        // Buscamos voces de alta calidad (Microsoft Pablo/Raul o Google)
        selectedVoice = voices.find(v => 
            v.name.includes('Pablo') || 
            v.name.includes('Raul') || 
            (v.lang.includes('es') && v.name.includes('Google'))
        );

        // Si no, cualquiera de hombre
        if (!selectedVoice) {
            selectedVoice = voices.find(v => v.lang.includes('es') && (v.name.includes('Male') || v.name.includes('Hombre')));
        }
    }

    if (selectedVoice) utterance.voice = selectedVoice;

    // Animación: Mover la boca mientras habla
    const charDiv = document.getElementById('character');
    utterance.onstart = () => charDiv.classList.add('speaking');
    utterance.onend = () => charDiv.classList.remove('speaking');
    utterance.onerror = () => charDiv.classList.remove('speaking');

    // Pequeña pausa para asegurar carga en móviles
    setTimeout(() => {
        window.speechSynthesis.speak(utterance);
    }, 50);
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

// Cargar voces al inicio
if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
    };
}
















