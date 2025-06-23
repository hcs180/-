const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const resultText = document.getElementById("resultText");
const statusText = document.getElementById("statusText");
const fontSizeSelect = document.getElementById("fontSizeSelect");
const translateBtn = document.getElementById("translateBtn");
const langSelect = document.getElementById("langSelect");
const translationResults = document.getElementById("translationResults");
const micSelect = document.getElementById("micSelect");

let recognition;
let finalTranscript = "";
let selectedDeviceId = null;

fontSizeSelect.addEventListener("change", () => {
  resultText.style.fontSize = fontSizeSelect.value;
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

// 開始錄音
startBtn.addEventListener("click", async () => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert("瀏覽器不支援語音辨識，請使用 Chrome");
    return;
  }

  if (!selectedDeviceId) {
    alert("請先選擇麥克風");
    return;
  }

  // 取得指定麥克風音源
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: { exact: selectedDeviceId } },
    });
    // 停止流避免雜音，因Web Speech API直接開啟麥克風
    stream.getTracks().forEach(track => track.stop());
  } catch (err) {
    alert("無法存取麥克風：" + err.message);
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "zh-TW";
  recognition.continuous = true;
  recognition.interimResults = true;

  finalTranscript = "";
  resultText.innerText = "";
  statusText.innerText = "🎙️ 錄音中，請開始說話...";
  statusText.className = "text-danger";

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
    resultText.innerText = finalTranscript + interimTranscript;
  };

  recognition.onerror = (event) => {
    statusText.innerText = "❌ 語音辨識錯誤：" + event.error;
    statusText.className = "text-danger";
    startBtn.disabled = false;
    stopBtn.disabled = true;
  };

  recognition.onend = () => {
    statusText.innerText = "🛑 停止錄音";
    statusText.className = "text-muted";
    startBtn.disabled = false;
    stopBtn.disabled = true;
  };

  recognition.start();
  startBtn.disabled = true;
  stopBtn.disabled = false;
});

// 停止錄音
stopBtn.addEventListener("click", () => {
  if (recognition) recognition.stop();
});

// 翻譯功能
translateBtn.addEventListener("click", async () => {
  const targetLang = langSelect.value;
  const text = resultText.innerText.trim();
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

      html += `
        <div class="card mb-2">
          <div class="card-body">
            <p><strong>中文：</strong> ${sentence}</p>
            <button class="btn btn-sm btn-outline-primary me-2" onclick="speak('${sentence.replace(/'/g, "\\'")}', 'zh-TW')">🔊 播放中文</button>
            <hr />
            <p><strong>翻譯：</strong> ${data.translatedText}</p>
            <button class="btn btn-sm btn-outline-success" onclick="speak('${data.translatedText.replace(/'/g, "\\'")}', getLangCode('${targetLang}'))">🔊 播放翻譯</button>
          </div>
        </div>
      `;
    } catch (e) {
      html += `<p class="text-danger">翻譯失敗：${e.message}</p>`;
    }
  }
  translationResults.innerHTML = html;
});

// 語音播放
function speak(text, lang) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  speechSynthesis.speak(utterance);
}

// 取得語言代碼對應
function getLangCode(lang) {
  const map = {
    en: "en-US",
    id: "id-ID",
    vi: "vi-VN",
    tl: "tl-PH",
  };
  return map[lang] || "en-US";
}

// 頁面載入列出麥克風
navigator.mediaDevices.getUserMedia({ audio: true })
  .then(listMicrophones)
  .catch(err => {
    alert("無法取得麥克風：" + err.message);
  });
const playOriginalBtn = document.getElementById("playOriginalBtn");

// 播放語音轉文字結果
playOriginalBtn.addEventListener("click", () => {
  const text = resultText.innerText.trim();
  if (!text) {
    alert("沒有可播放的文字");
    return;
  }
  speak(text, "zh-TW");
});

// 修改 speak 函式：保留，無需改動
function speak(text, lang) {
  if (!window.speechSynthesis) {
    alert("此瀏覽器不支援語音合成");
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  speechSynthesis.speak(utterance);
}

// 呼叫 LibreTranslate API 的函式
async function translateText(text, targetLang) {
  if (!text) return "";
  try {
    const response = await fetch("https://secret-dusk-49002-0a1ad6459a8f.herokuapp.com/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: text,
        source: "zh",
        target: targetLang,
        format: "text",
      }),
    });

    if (!response.ok) throw new Error(`API錯誤，狀態碼 ${response.status}`);

    const data = await response.json();
    return data.translatedText;
  } catch (error) {
    console.error("翻譯錯誤", error);
    alert("翻譯失敗，請稍後再試");
    return "";
  }
  
}

// 翻譯按鈕事件
document.getElementById("translateBtn").addEventListener("click", async () => {
  const text = document.getElementById("resultText").innerText.trim();
  const targetLang = document.getElementById("langSelect").value;

  if (!text) {
    alert("請先錄音並轉換成文字");
    return;
  }

  // 可自行拆句，這裡簡化直接翻譯全文
  const translated = await translateText(text, targetLang);

  // 顯示翻譯結果（可改為逐句顯示）
  const translationResults = document.getElementById("translationResults");
  translationResults.innerHTML = `
    <div class="card">
      <div class="card-body">
        <p><strong>原文：</strong> ${text}</p>
        <p><strong>翻譯：</strong> ${translated}</p>
        <button class="btn btn-outline-success" onclick="speak('${translated.replace(/'/g, "\\'")}', getLangCode('${targetLang}'))">🔊 播放翻譯</button>
      </div>
    </div>
  `;
});

