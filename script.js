// =========================================
// CONFIGURACIÓN DE INTERVALOS CERRADOS
// =========================================
const MALE_MIN = 80;
const MALE_MAX = 120;
const FEMALE_MIN = 125;
const FEMALE_MAX = 180;

// =========================================
// ELEMENTOS DEL DOM 
// =========================================
const statusText = document.getElementById("status");
const genderLabel = document.getElementById("genderLabel");
const speechText = document.getElementById("speechText");
const wordCount = document.getElementById("wordCount");
const micBtn = document.getElementById("micBtn");
const character = document.getElementById("character");

let audioContext;
let analyser;
let micStream;
let buffer;

// =========================================
// DETECTOR DE PITCH (Lógica Intacta)
// =========================================
function detectPitch(buf, sampleRate) {
    let SIZE = buf.length;
    let rms = 0;

    for (let i = 0; i < SIZE; i++) {
        rms += buf[i] * buf[i];
    }
    rms = Math.sqrt(rms / SIZE);
    if (rms < 0.01) return 0; // silencio real

    let bestOffset = -1;
    let bestCorrelation = 0;

    for (let offset = 15; offset < 1000; offset++) {
        let correlation = 0;

        for (let i = 0; i < SIZE - offset; i++) {
            correlation += buf[i] * buf[i + offset];
        }

        correlation = correlation / (SIZE - offset);

        if (correlation > bestCorrelation) {
            bestCorrelation = correlation;
            bestOffset = offset;
        }
    }

    if (bestOffset === -1) return 0;

    let pitch = sampleRate / bestOffset;
    return pitch;
}

// =========================================
// CLASIFICACIÓN (FORZADA - SIN NEUTRAL)
// =========================================
function classifyGender(pitch) {
    if (pitch < FEMALE_MIN) return "Masculino";
    return "Femenino";
}

// =========================================
// HABLAR (CON ANIMACIÓN DE BOCA AGREGADA)
// =========================================
function speak(text, gender) {
    // Cancelamos audio anterior para que no se cruce
    window.speechSynthesis.cancel();

    const u = new SpeechSynthesisUtterance(text);

    if (gender === "Masculino") u.pitch = 0.8;
    else u.pitch = 1.4;

    // [AGREGADO] Animación de la boca y salto
    u.onstart = function() {
        character.classList.add("speaking");
    };

    u.onend = function() {
        character.classList.remove("speaking");
    };

    u.onerror = function() {
        character.classList.remove("speaking");
    };

    speechSynthesis.speak(u);
}

// =========================================
// LISTENING LOOP (CON CAMBIO DE COLOR AGREGADO)
// =========================================
function audioLoop() {
    requestAnimationFrame(audioLoop);

    if (!analyser) return; // Seguridad

    analyser.getFloatTimeDomainData(buffer);

    const pitch = detectPitch(buffer, audioContext.sampleRate);

    if (pitch > 60 && pitch < 300) {
        const gender = classifyGender(pitch);

        genderLabel.textContent = gender;

        // [MODIFICADO] Ahora cambiamos texto Y color del personaje
        if (gender === "Masculino") {
            // Color Texto
            genderLabel.style.color = "#0077ff"; 
            // Color Personaje (Azul)
            character.classList.add("male");
            character.classList.remove("female");
        } else {
            // Color Texto
            genderLabel.style.color = "#ff4fa3";
            // Color Personaje (Rosa)
            character.classList.add("female");
            character.classList.remove("male");
        }
    }
}

// =========================================
// INICIAR MICROFONO
// =========================================
async function startMic() {
    try {
        audioContext = new AudioContext();

        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        let src = audioContext.createMediaStreamSource(micStream);

        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;

        buffer = new Float32Array(analyser.fftSize);

        src.connect(analyser);

        audioLoop();
    } catch (e) {
        console.error("Error al acceder al micrófono:", e);
        alert("Por favor permite el micrófono para jugar.");
    }
}

// =========================================
// RECONOCIMIENTO DE VOZ
// =========================================
function startRecognition() {
    // Compatibilidad para Chrome
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SpeechRecognition();
    
    rec.lang = "es-PE";
    rec.continuous = false;
    rec.interimResults = false;

    rec.start();
    statusText.textContent = "Escuchando...";
    // [AGREGADO] Feedback visual en el botón
    micBtn.classList.add("listening");

    rec.onresult = (e) => {
        let text = e.results[0][0].transcript;
        speechText.textContent = text;

        let words = text.split(" ").length;
        wordCount.textContent = words;

        let gender = genderLabel.textContent;

        speak(`Detecté voz ${gender}. Dijiste: ${text}`, gender);

        statusText.textContent = "Listo para escuchar";
        // [AGREGADO] Quitar estado listening del botón
        micBtn.classList.remove("listening");
        listening = false;
        micBtn.textContent = "🎤 Hablar";
    };

    rec.onerror = () => {
        statusText.textContent = "Error. Intenta hablar otra vez";
        micBtn.classList.remove("listening");
        listening = false;
        micBtn.textContent = "🎤 Hablar";
    };
    
    rec.onend = () => {
        // Aseguramos limpieza si termina sin resultados
        if(listening) {
             micBtn.classList.remove("listening");
             listening = false;
             micBtn.textContent = "🎤 Hablar";
        }
    }; 
}

// =========================================
// CONTROL DEL MIC
// =========================================
let listening = false;

function toggleListening() {
    // Truco para 'despertar' el audio en móviles/navegadores
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }

    if (!listening) {
        listening = true;
        micBtn.textContent = "🛑 Escuchando...";
        startRecognition();
    } 
    // La detención manual es compleja con la API básica, 
    // mejor dejar que termine solo o recargue.
}

// =========================================
// INICIAR AL ABRIR JUEGO
// =========================================
function startGame() {
    document.getElementById("startScreen").classList.remove("active");
    document.getElementById("gameScreen").classList.add("active");

    startMic();
}

function resetGame() {
    location.reload();
}



















