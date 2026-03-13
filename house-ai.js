(function () {
  const PARENT_FLAG = '__houseAiEmbedded__';
  const FRAME_ID = 'house-ai-frame';
  const COLLAPSED_WIDTH = 96;
  const COLLAPSED_HEIGHT = 96;
  const EXPANDED_WIDTH = 392;
  const EXPANDED_HEIGHT = 616;

  function sendHostState(isOpen) {
    try {
      window.parent.postMessage({
        source: 'house-ai',
        type: 'HOUSE_AI_TOGGLE',
        open: !!isOpen,
        width: isOpen ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
        height: isOpen ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT
      }, '*');
    } catch (err) {}
  }

  // Parent page mode: auto inject iframe once when this script is included from a normal system page.
  if (window.top === window.self && !window[PARENT_FLAG] && !document.getElementById('houseAIChat')) {
    window[PARENT_FLAG] = true;

    const currentScript = document.currentScript;
    const htmlPath = (currentScript && currentScript.dataset && currentScript.dataset.houseAiHtml) || 'house-ai.html';

    if (!document.getElementById(FRAME_ID)) {
      const iframe = document.createElement('iframe');
      iframe.id = FRAME_ID;
      iframe.src = htmlPath;
      iframe.title = 'House AI';
      iframe.setAttribute('aria-label', 'House AI');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = COLLAPSED_WIDTH + 'px';
      iframe.style.height = COLLAPSED_HEIGHT + 'px';
      iframe.style.border = 'none';
      iframe.style.background = 'transparent';
      iframe.style.overflow = 'hidden';
      iframe.style.zIndex = '99999';
      iframe.style.pointerEvents = 'auto';
      iframe.allowTransparency = true;
      document.body.appendChild(iframe);

      window.addEventListener('message', function (event) {
        const data = event && event.data;
        if (!data || data.source !== 'house-ai' || data.type !== 'HOUSE_AI_TOGGLE') return;
        iframe.style.width = (data.width || COLLAPSED_WIDTH) + 'px';
        iframe.style.height = (data.height || COLLAPSED_HEIGHT) + 'px';
      });
    }

    return;
  }

  // Widget mode inside house-ai.html
  function getChat() { return document.getElementById('houseAIChat'); }
  function getInput() { return document.getElementById('houseAIInput'); }
  function getMessages() { return document.getElementById('houseAIMessages'); }

  function houseAIToggle() {
    const chat = getChat();
    if (!chat) return;
    const isOpen = chat.style.display === 'flex';
    chat.style.display = isOpen ? 'none' : 'flex';
    sendHostState(!isOpen);
  }

  function houseAIClose() {
    const chat = getChat();
    if (!chat) return;
    chat.style.display = 'none';
    sendHostState(false);
  }

  function houseAISend() {
    const input = getInput();
    const container = getMessages();
    if (!input || !container) return;

    const msg = (input.value || '').trim();
    if (!msg) return;

    const user = document.createElement('div');
    user.className = 'house-ai-msg user';
    user.innerText = msg;
    container.appendChild(user);

    const ai = document.createElement('div');
    ai.className = 'house-ai-msg ai';

    if (msg.includes('205-2')) {
      ai.innerText = '205-2 阿秀：近期生命徵象穩定，建議持續觀察。';
    } else if (msg.includes('傷口')) {
      ai.innerText = '目前示範：系統可以查詢進行中的傷口個案。';
    } else if (msg.includes('護理')) {
      ai.innerText = '護理紀錄草稿：住民今日生命徵象穩定，精神狀況良好。';
    } else {
      ai.innerText = '這是示範版 House AI，之後可以接 OpenAI 與 Firebase。';
    }

    container.appendChild(ai);
    container.scrollTop = container.scrollHeight;
    input.value = '';
  }

  window.houseAIToggle = houseAIToggle;
  window.houseAIClose = houseAIClose;
  window.houseAISend = houseAISend;

  document.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
      const input = getInput();
      if (document.activeElement === input) {
        houseAISend();
      }
    }
  });

  window.addEventListener('load', function () {
    sendHostState(false);
  });
})();
