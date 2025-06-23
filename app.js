document.addEventListener("DOMContentLoaded", () => {
    const startBtn = document.getElementById("startBtn");   
    const continueBtn = document.getElementById("continueBtn");
    const stopBtn = document.getElementById("stopBtn");
    const resultText = document.getElementById("resultText");
    const statusText = document.getElementById("statusText"); // 建議你 HTML 裡加個顯示狀態的元素，或用 alert 代替
    const fontSizeSelect = document.getElementById("fontSizeSelect"); // 如果有的話
    const translateBtn = document.getElementById("translateBtn");
    const langSelect = document.getElementById("langSelect");
    const translationResults = document.getElementById("translationResults");
    const micSelect = document.getElementById("micSelect");
    const playOriginalBtn = document.getElementById("playOriginalBtn");

  

    let recognition;
    let finalTranscript = "";
    let selectedDeviceId = null;

    // 字體大小選擇器
    fontSizeSelect.addEventListener("change", () => {
        const newSize = fontSizeSelect.value;
        resultText.style.fontSize = newSize;
        translationResults.style.fontSize = newSize;  
    });

    // 取得麥克風列表
    async function listMicrophones() {
        try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        micSelect.innerHTML = "";
        devices.forEach((device) => {
            if (device.kind === "audioinput") {
            const option = document.createElement("option");
            option.value = device.deviceId;
            option.text = device.label || `麥克風 ${micSelect.length + 1}`;
            micSelect.appendChild(option);
            }
        });
        if (micSelect.options.length > 0) {
            selectedDeviceId = micSelect.value;
        }
        } catch (e) {
        alert("無法取得麥克風列表：" + e.message);
        }
    }

    micSelect.addEventListener("change", () => {
        selectedDeviceId = micSelect.value;
    });

    

    // 清空並開始錄音
    startBtn.addEventListener("click", async () => {
        if (!selectedDeviceId) {
        alert("請先選擇麥克風");
        return;
        }

        finalTranscript = "";
        resultText.value = "";

        startRecognition(true);
    });

    // 繼續錄音，保留文字
    continueBtn.addEventListener("click", async () => {
        if (!selectedDeviceId) {
        alert("請先選擇麥克風");
        return;
        }

        startRecognition(false);
    });

    function startRecognition(clearBeforeStart) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
        alert("瀏覽器不支援語音辨識，請使用 Chrome");
        return;
        }

        recognition = new SpeechRecognition();
        recognition.lang = "zh-TW";
        recognition.continuous = true;
        recognition.interimResults = true;

        statusText && (statusText.innerText = "🎙️ 錄音中，請開始說話...");
        statusText && (statusText.className = "text-danger");

        if (clearBeforeStart) {
        finalTranscript = "";
        resultText.value = "";
        }

        recognition.onresult = (event) => {
        let interimTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
            finalTranscript += transcript;
            } else {
            interimTranscript += transcript;
            }
        }
        resultText.value = finalTranscript + interimTranscript;
        };

        recognition.onerror = (event) => {
        statusText && (statusText.innerText = "❌ 語音辨識錯誤：" + event.error);
        statusText && (statusText.className = "text-danger");
        startBtn.disabled = false;
        stopBtn.disabled = true;
        };

        recognition.onend = () => {
        statusText && (statusText.innerText = "🛑 停止錄音");
        statusText && (statusText.className = "text-muted");
        startBtn.disabled = false;
        stopBtn.disabled = true;
        };

        recognition.start();
        startBtn.disabled = true;
        stopBtn.disabled = false;
    }

    stopBtn.addEventListener("click", () => {
        if (recognition) recognition.stop();
    });

    // ─── 在 translateBtn 的 click handler 裡 ───
    translateBtn.addEventListener("click", async () => {
    const targetLang = langSelect.value;
    const text = resultText.value.trim();
    if (!text) {
        alert("請先錄音並轉成文字");
        return;
    }

    const sentences = text.split(/(?<=[。！？…])/);
    translationResults.innerHTML = '<div class="text-muted">翻譯中，請稍候...</div>';

    let html = "";
    for (const sentence of sentences) {
        if (!sentence.trim()) continue;

        try {
        const response = await fetch("https://secret-dusk-49002-0a1ad6459a8f.herokuapp.com/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
            q: sentence,
            source: "zh",
            target: targetLang,
            format: "text",
            }),
        });
        const data = await response.json();

        // 只編碼一次，避免二次編碼
        const safeSentence        = encodeURIComponent(sentence);
        const safeTranslatedText  = encodeURIComponent(data.translatedText || "");

            html += `
                <div class="card mb-2">
                <div class="card-body">
                    <p><strong>中文：</strong> ${sentence}</p>
                    <button class="btn btn-sm btn-outline-primary me-2 play-btn"
                            data-text="${safeSentence}"
                            data-lang="zh-TW">
                    🔊 播放中文(損壞，暫未修復)
                    </button>
                    <hr />
                    <p><strong>翻譯：</strong> ${data.translatedText || ""}</p>
                    <button class="btn btn-sm btn-outline-success play-btn"
                            data-text="${safeTranslatedText}"
                            data-lang="${targetLang}">
                    🔊 播放翻譯
                    </button>
                </div>
                </div>
            `;
            } catch (e) {
            html += `<p class="text-danger">翻譯失敗：${e.message}</p>`;
            }
        }
        translationResults.innerHTML = html;
    });

    // ─── 更健壯的事件委派 ───
    translationResults.addEventListener("click", e => {
    let btn = e.target;
    // 點到裡面的 <i> 也能往上找到 button.play-btn
    if (!btn.classList.contains("play-btn")) {
        btn = btn.closest(".play-btn");
    }
    if (!btn) return;

    const text = decodeURIComponent(btn.getAttribute("data-text"));
    const lang = btn.getAttribute("data-lang");
    speak(text, getLangCode(lang));
    });


    // 語音播放函式
    async function speak(text, lang) {
        if (!window.speechSynthesis) {
        alert("此瀏覽器不支援語音合成");
        return;
        }
        const voices = await loadVoices();
        let voice = voices.find(v => v.lang.toLowerCase() === lang.toLowerCase());
        if (!voice) {
            voice = voices.find(v => v.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()));
        }
        if (!voice) voice = voices[0];
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.voice = voice;
        utterance.lang = lang;
        speechSynthesis.speak(utterance);
    }

    playOriginalBtn.addEventListener("click", () => {
        const text = resultText.value.trim();
        if (!text) {
            alert("沒有可播放的文字");
            return;
        }
        speak(text, "zh-TW");
    });
    // 取得語音列表
    function loadVoices() {
        return new Promise((resolve) => {
        let voices = speechSynthesis.getVoices();
        if (voices.length) {
            resolve(voices);
            return;
        }
        speechSynthesis.onvoiceschanged = () => {
            voices = speechSynthesis.getVoices();
            resolve(voices);
        };
        });
    }

    // 取得語言代碼對應
    function getLangCode(lang) {
        const map = {
        en: "en-US",
        ko: "ko-KR",
        ja: "ja-JP",
        id: "id-ID",
        vi: "vi-VN",
        tl: "tl-PH",
        };
        return map[lang] || "en-US";
    }

    // 取得麥克風列表
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(listMicrophones)
        .catch(err => {
        alert("無法取得麥克風：" + err.message);
        });
});
