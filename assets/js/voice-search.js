/**
 * Globex Sky — voice-search.js
 * Standalone voice search module:
 *   - Web Speech API integration
 *   - Visual feedback (waveform animation)
 *   - Speech-to-text with language detection
 *   - Voice command shortcuts
 *   - Voice search history
 *   - Fallback for unsupported browsers
 */

'use strict';

const GlobexVoiceSearch = (() => {

  const HISTORY_KEY = 'globexVoiceHistory';
  const MAX_HISTORY = 30;
  let recognition = null;
  let isListening = false;
  let currentLang = 'en-US';

  const SUPPORTED_LANGS = [
    { code: 'en-US', label: 'English (US)' },
    { code: 'en-GB', label: 'English (UK)' },
    { code: 'zh-CN', label: '中文 (简体)' },
    { code: 'ar-SA', label: 'العربية' },
    { code: 'es-ES', label: 'Español' },
    { code: 'fr-FR', label: 'Français' },
    { code: 'de-DE', label: 'Deutsch' },
    { code: 'ja-JP', label: '日本語' },
    { code: 'ko-KR', label: '한국어' },
    { code: 'bn-BD', label: 'বাংলা' },
  ];

  // Shortcut commands: pattern → search query transformation
  const VOICE_COMMANDS = [
    { pattern: /show me (.+) under \$?(\d+)/i, transform: (m) => `${m[1]} max price $${m[2]}` },
    { pattern: /find (.+) from (.+)/i, transform: (m) => `${m[1]} supplier ${m[2]}` },
    { pattern: /search for (.+)/i, transform: (m) => m[1] },
    { pattern: /buy (.+)/i, transform: (m) => m[1] },
    { pattern: /I need (.+)/i, transform: (m) => m[1] },
  ];

  /* ── Browser Support Check ──────────────────────────────────────────── */
  function isSupported() {
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  }

  /* ── Speech Recognition ─────────────────────────────────────────────── */
  function createRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;
    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = currentLang;
    rec.maxAlternatives = 3;
    return rec;
  }

  function applyVoiceCommand(text) {
    for (const cmd of VOICE_COMMANDS) {
      const match = text.match(cmd.pattern);
      if (match) return cmd.transform(match);
    }
    return text;
  }

  function start(onResult, onError) {
    if (!isSupported()) {
      const msg = 'Voice search is not supported in this browser. Please use Chrome or Edge.';
      showFallback(msg);
      if (onError) onError(msg);
      return;
    }

    if (isListening) { stop(); return; }

    recognition = createRecognition();
    if (!recognition) return;

    recognition.onstart = () => {
      isListening = true;
      showListeningUI(true);
      updateStatus('Listening… speak now');
      startWaveform();
    };

    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      updateInterim(interimTranscript);

      if (finalTranscript) {
        const processed = applyVoiceCommand(finalTranscript.trim());
        saveToHistory(processed);
        updateStatus(`"${processed}"`);
        if (onResult) onResult(processed, finalTranscript);
        // Auto-fill search input
        const searchInput = document.getElementById('main-search-input') ||
                            document.getElementById('voice-target-input');
        if (searchInput) {
          searchInput.value = processed;
          searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        stop();
      }
    };

    recognition.onerror = (event) => {
      isListening = false;
      showListeningUI(false);
      stopWaveform();
      let msg = 'Voice search error.';
      if (event.error === 'no-speech') msg = 'No speech detected. Please try again.';
      else if (event.error === 'not-allowed') msg = 'Microphone access denied.';
      else if (event.error === 'network') msg = 'Network error. Please check connection.';
      updateStatus(msg);
      if (onError) onError(msg);
    };

    recognition.onend = () => {
      isListening = false;
      showListeningUI(false);
      stopWaveform();
    };

    recognition.start();
  }

  function stop() {
    if (recognition) {
      try { recognition.stop(); } catch (_) {}
    }
    isListening = false;
    showListeningUI(false);
    stopWaveform();
  }

  /* ── UI Helpers ─────────────────────────────────────────────────────── */
  function showListeningUI(active) {
    const btn = document.getElementById('btn-voice-search');
    const overlay = document.getElementById('voice-overlay');
    if (btn) {
      btn.classList.toggle('listening', active);
      btn.setAttribute('aria-pressed', String(active));
      btn.title = active ? 'Stop voice search' : 'Start voice search';
    }
    if (overlay) {
      overlay.classList.toggle('visible', active);
    }
  }

  function updateStatus(msg) {
    const el = document.getElementById('voice-status-text');
    if (el) el.textContent = msg;
  }

  function updateInterim(text) {
    const el = document.getElementById('voice-interim-text');
    if (el) el.textContent = text;
  }

  function showFallback(msg) {
    const el = document.getElementById('voice-fallback-msg');
    if (el) { el.textContent = msg; el.hidden = false; }
  }

  /* ── Waveform Animation ─────────────────────────────────────────────── */
  let waveInterval = null;

  function startWaveform() {
    const bars = document.querySelectorAll('.voice-waveform-bar');
    if (!bars.length) return;
    waveInterval = setInterval(() => {
      bars.forEach(bar => {
        bar.style.height = (Math.random() * 32 + 8) + 'px';
      });
    }, 120);
  }

  function stopWaveform() {
    if (waveInterval) { clearInterval(waveInterval); waveInterval = null; }
    const bars = document.querySelectorAll('.voice-waveform-bar');
    bars.forEach(bar => { bar.style.height = '8px'; });
  }

  /* ── Voice Search History ───────────────────────────────────────────── */
  function saveToHistory(query) {
    if (!query) return;
    let history = getHistory().filter(h => h.query.toLowerCase() !== query.toLowerCase());
    history.unshift({ query, timestamp: new Date().toISOString() });
    history = history.slice(0, MAX_HISTORY);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    renderHistory();
  }

  function getHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
    catch (_) { return []; }
  }

  function clearHistory() {
    localStorage.removeItem(HISTORY_KEY);
    renderHistory();
  }

  function renderHistory() {
    const container = document.getElementById('voice-history-list');
    if (!container) return;
    const history = getHistory();
    if (!history.length) {
      container.innerHTML = '<li style="color:#94a3b8;font-size:.85rem;padding:8px 0">No voice searches yet.</li>';
      return;
    }
    container.innerHTML = history.slice(0, 10).map(h => `
      <li class="voice-history-item" onclick="GlobexVoiceSearch.useHistoryItem('${h.query.replace(/'/g, "\\'")}')">
        <i class="fas fa-microphone" style="color:#0052CC;margin-right:8px;font-size:.8rem"></i>
        <span>${h.query}</span>
        <span style="color:#94a3b8;font-size:.75rem;margin-left:auto">${new Date(h.timestamp).toLocaleDateString()}</span>
      </li>
    `).join('');
  }

  function useHistoryItem(query) {
    const searchInput = document.getElementById('main-search-input') ||
                        document.getElementById('voice-target-input');
    if (searchInput) {
      searchInput.value = query;
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      searchInput.form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    }
  }

  /* ── Language Selection ─────────────────────────────────────────────── */
  function setLanguage(langCode) {
    currentLang = langCode;
    if (recognition) recognition.lang = langCode;
    localStorage.setItem('globexVoiceLang', langCode);
  }

  function initLangSelector() {
    const select = document.getElementById('voice-lang-select');
    if (!select) return;
    select.innerHTML = SUPPORTED_LANGS.map(l =>
      `<option value="${l.code}" ${l.code === currentLang ? 'selected' : ''}>${l.label}</option>`
    ).join('');
    select.addEventListener('change', e => setLanguage(e.target.value));
  }

  /* ── Init ───────────────────────────────────────────────────────────── */
  function init() {
    const savedLang = localStorage.getItem('globexVoiceLang');
    if (savedLang) currentLang = savedLang;

    initLangSelector();
    renderHistory();

    if (!isSupported()) {
      const btn = document.getElementById('btn-voice-search');
      if (btn) {
        btn.disabled = true;
        btn.title = 'Voice search not supported in this browser';
      }
      showFallback('Voice search requires Chrome, Edge, or Safari 14.1+.');
    }

    const voiceBtn = document.getElementById('btn-voice-search');
    if (voiceBtn) {
      voiceBtn.addEventListener('click', () => start());
    }

    const cancelBtn = document.getElementById('btn-voice-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', stop);

    const clearBtn = document.getElementById('btn-voice-clear-history');
    if (clearBtn) clearBtn.addEventListener('click', clearHistory);
  }

  return {
    init,
    start,
    stop,
    isSupported,
    isListening: () => isListening,
    setLanguage,
    getHistory,
    clearHistory,
    saveToHistory,
    useHistoryItem,
    SUPPORTED_LANGS,
    VOICE_COMMANDS,
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('btn-voice-search')) {
    GlobexVoiceSearch.init();
  }
});

window.GlobexVoiceSearch = GlobexVoiceSearch;
