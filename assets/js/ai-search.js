/**
 * GlobexSky — AI Search Frontend
 * Handles voice search (Web Audio API), image search with upload/preview,
 * debounced autocomplete, and AI-powered semantic search submission.
 */

(function () {
  'use strict';

  // ─── Configuration ──────────────────────────────────────────────────────────
  const API_BASE = '/api/v1/ai';
  const DEBOUNCE_MS = 300;
  const MAX_RECORDING_DURATION_MS = 10000;

  // ─── Utility: debounce ───────────────────────────────────────────────────────
  function debounce(fn, delay) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  // ─── Utility: API helper ─────────────────────────────────────────────────────
  async function apiPost(path, body) {
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Request failed: ${res.status}`);
    }
    return res.json();
  }

  async function apiGet(path) {
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    const res = await fetch(`${API_BASE}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    return res.json();
  }

  // ─── Voice Search ────────────────────────────────────────────────────────────

  let mediaRecorder = null;
  let audioChunks = [];
  let isRecording = false;

  /**
   * Initialise voice search button if present.
   */
  function initVoiceSearch() {
    const voiceBtn = document.getElementById('ai-voice-btn');
    const searchInput = document.getElementById('ai-search-input');
    const voiceStatus = document.getElementById('ai-voice-status');

    if (!voiceBtn) return;

    voiceBtn.addEventListener('click', async () => {
      if (isRecording) {
        stopRecording();
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        showToast('Microphone not supported in this browser.', 'error');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunks = [];
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
        mediaRecorder.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          const blob = new Blob(audioChunks, { type: 'audio/webm' });
          await submitVoiceSearch(blob);
        };

        mediaRecorder.start();
        isRecording = true;
        voiceBtn.classList.add('recording');
        voiceBtn.setAttribute('aria-label', 'Stop recording');
        if (voiceStatus) voiceStatus.textContent = 'Recording… click to stop';
        voiceBtn.style.color = '#ef4444';

        // Auto-stop after configured max duration
        setTimeout(() => { if (isRecording) stopRecording(); }, MAX_RECORDING_DURATION_MS);
      } catch (err) {
        showToast('Microphone access denied: ' + err.message, 'error');
      }
    });
  }

  function stopRecording() {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      isRecording = false;
      const voiceBtn = document.getElementById('ai-voice-btn');
      const voiceStatus = document.getElementById('ai-voice-status');
      if (voiceBtn) { voiceBtn.style.color = ''; voiceBtn.classList.remove('recording'); voiceBtn.setAttribute('aria-label', 'Voice search'); }
      if (voiceStatus) voiceStatus.textContent = 'Processing…';
    }
  }

  async function submitVoiceSearch(audioBlob) {
    const searchInput = document.getElementById('ai-search-input');
    const voiceStatus = document.getElementById('ai-voice-status');

    try {
      // Convert blob to base64 for API transport
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onload = async () => {
        const base64 = reader.result.split(',')[1];
        setLoading(true);
        try {
          const data = await apiPost('/search/voice', { audio_base64: base64 });
          if (voiceStatus) voiceStatus.textContent = `Heard: "${data.transcription || ''}"`;
          if (searchInput && data.transcription) searchInput.value = data.transcription;
          renderSearchResults(data.products || data.data || []);
        } finally {
          setLoading(false);
        }
      };
    } catch (err) {
      if (voiceStatus) voiceStatus.textContent = '';
      showToast('Voice search failed: ' + err.message, 'error');
      setLoading(false);
    }
  }

  // ─── Image Search ────────────────────────────────────────────────────────────

  function initImageSearch() {
    const imageBtn = document.getElementById('ai-image-btn');
    const imageInput = document.getElementById('ai-image-input');
    const imagePreview = document.getElementById('ai-image-preview');

    if (!imageBtn || !imageInput) return;

    imageBtn.addEventListener('click', () => imageInput.click());

    imageInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // Show preview
      if (imagePreview) {
        const url = URL.createObjectURL(file);
        imagePreview.src = url;
        imagePreview.style.display = 'block';
      }

      // Convert to base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result.split(',')[1];
        setLoading(true);
        try {
          const data = await apiPost('/search/image', { image: base64 });
          renderSearchResults(data.data || []);
          if (data.extractedAttributes) {
            showAttributeBadges(data.extractedAttributes);
          }
        } catch (err) {
          showToast('Image search failed: ' + err.message, 'error');
        } finally {
          setLoading(false);
        }
      };
      reader.readAsDataURL(file);
      // Reset input to allow re-upload of same file
      imageInput.value = '';
    });
  }

  // ─── Autocomplete ────────────────────────────────────────────────────────────

  let autocompleteDropdown = null;

  function initAutocomplete() {
    const searchInput = document.getElementById('ai-search-input');
    if (!searchInput) return;

    autocompleteDropdown = document.createElement('ul');
    autocompleteDropdown.id = 'ai-autocomplete-list';
    autocompleteDropdown.setAttribute('role', 'listbox');
    Object.assign(autocompleteDropdown.style, {
      position: 'absolute',
      top: '100%',
      left: '0',
      right: '0',
      background: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: '0 0 12px 12px',
      boxShadow: '0 8px 24px rgba(0,0,0,.1)',
      listStyle: 'none',
      padding: '4px 0',
      margin: '0',
      zIndex: '1000',
      display: 'none',
      maxHeight: '280px',
      overflowY: 'auto',
    });

    const wrap = searchInput.closest('.search-bar') || searchInput.parentElement;
    if (wrap) {
      wrap.style.position = 'relative';
      wrap.appendChild(autocompleteDropdown);
    }

    searchInput.addEventListener('input', debounce(async () => {
      const q = searchInput.value.trim();
      if (q.length < 2) { hideAutocomplete(); return; }
      try {
        const data = await apiGet(`/search/suggestions?q=${encodeURIComponent(q)}`);
        const suggestions = data.suggestions || data.data || [];
        renderAutocomplete(suggestions, searchInput);
      } catch (_e) { hideAutocomplete(); }
    }, DEBOUNCE_MS));

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!searchInput.contains(e.target)) hideAutocomplete();
    });
  }

  function renderAutocomplete(suggestions, input) {
    if (!autocompleteDropdown || !suggestions.length) { hideAutocomplete(); return; }

    autocompleteDropdown.innerHTML = '';
    suggestions.forEach((s) => {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.textContent = s;
      Object.assign(li.style, {
        padding: '9px 16px',
        cursor: 'pointer',
        fontSize: '.85rem',
        color: '#1a1a2e',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      });
      li.addEventListener('mouseenter', () => { li.style.background = '#f0f4ff'; });
      li.addEventListener('mouseleave', () => { li.style.background = ''; });
      li.addEventListener('click', () => {
        input.value = s;
        hideAutocomplete();
        triggerSearch(s);
      });
      autocompleteDropdown.appendChild(li);
    });

    autocompleteDropdown.style.display = 'block';
  }

  function hideAutocomplete() {
    if (autocompleteDropdown) autocompleteDropdown.style.display = 'none';
  }

  // ─── Text Search ─────────────────────────────────────────────────────────────

  function initTextSearch() {
    const form = document.getElementById('ai-search-form');
    const searchBtn = document.getElementById('ai-search-btn');
    const searchInput = document.getElementById('ai-search-input');

    if (searchBtn) searchBtn.addEventListener('click', () => triggerSearch());
    if (form) form.addEventListener('submit', (e) => { e.preventDefault(); triggerSearch(); });
    if (searchInput) {
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); hideAutocomplete(); triggerSearch(); }
      });
    }
  }

  async function triggerSearch(query) {
    const searchInput = document.getElementById('ai-search-input');
    const q = query || searchInput?.value?.trim() || '';
    if (!q) return;

    hideAutocomplete();
    setLoading(true);

    try {
      const data = await apiPost('/search', { query: q });
      renderSearchResults(data.data || data.products || []);
    } catch (err) {
      showToast('Search failed: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  // ─── Render search results ────────────────────────────────────────────────────

  function renderSearchResults(products) {
    const container = document.getElementById('ai-search-results');
    if (!container) return;

    if (!products.length) {
      container.innerHTML = '<p style="text-align:center;color:#64748b;padding:24px;">No products found. Try a different search.</p>';
      return;
    }

    container.innerHTML = '';
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px;';

    products.forEach((p) => {
      const score = p.relevanceScore ? Math.round(p.relevanceScore * 100) : null;
      const card = document.createElement('div');
      card.style.cssText = 'background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.07);cursor:pointer;transition:transform .15s;';
      card.innerHTML = `
        <img src="${p.images?.[0] || '/assets/images/placeholder.png'}" alt="${escapeHtml(p.title || '')}"
          style="width:100%;height:160px;object-fit:cover;">
        <div style="padding:10px;">
          ${score !== null ? `<span style="font-size:.68rem;background:#eff6ff;color:#0052CC;padding:2px 7px;border-radius:6px;font-weight:600;">${score}% match</span>` : ''}
          <h4 style="font-size:.82rem;font-weight:600;color:#0a0e27;margin:6px 0 4px;line-height:1.3;
            display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
            ${escapeHtml(p.title || p.name || '')}
          </h4>
          <p style="font-size:.88rem;font-weight:700;color:#0052CC;margin:0;">$${p.price}</p>
          ${p.average_rating ? `<p style="font-size:.72rem;color:#f59e0b;margin:2px 0 0;">★ ${p.average_rating}</p>` : ''}
        </div>`;
      card.addEventListener('mouseenter', () => { card.style.transform = 'translateY(-2px)'; });
      card.addEventListener('mouseleave', () => { card.style.transform = ''; });
      card.addEventListener('click', () => window.location.href = `/pages/product/?id=${p.id}`);
      grid.appendChild(card);
    });

    container.appendChild(grid);
  }

  // ─── Attribute badges (image search) ────────────────────────────────────────

  function showAttributeBadges(attrs) {
    const container = document.getElementById('ai-search-filters') || document.getElementById('ai-search-results');
    if (!container) return;

    const badges = document.createElement('div');
    badges.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;';
    Object.entries(attrs).forEach(([k, v]) => {
      if (!v || k === 'keywords') return;
      const badge = document.createElement('span');
      badge.style.cssText = 'background:#eff6ff;color:#0052CC;padding:4px 10px;border-radius:20px;font-size:.75rem;font-weight:600;';
      badge.textContent = `${k}: ${v}`;
      badges.appendChild(badge);
    });

    container.insertBefore(badges, container.firstChild);
  }

  // ─── Loading state ────────────────────────────────────────────────────────────

  function setLoading(loading) {
    const loader = document.getElementById('ai-search-loader');
    const resultsEl = document.getElementById('ai-search-results');
    if (loader) loader.style.display = loading ? 'flex' : 'none';
    if (resultsEl && loading) resultsEl.innerHTML = '';
  }

  // ─── Toast notification ───────────────────────────────────────────────────────

  function showToast(msg, type = 'info') {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
      background:${type === 'error' ? '#ef4444' : '#0052CC'};color:#fff;
      padding:10px 20px;border-radius:10px;font-size:.83rem;font-weight:500;
      box-shadow:0 4px 16px rgba(0,0,0,.2);z-index:99999;
      animation:fadeInToast .3s ease;`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  }

  // ─── Utility ─────────────────────────────────────────────────────────────────

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(str || ''));
    return d.innerHTML;
  }

  // ─── Init ─────────────────────────────────────────────────────────────────────

  function init() {
    initVoiceSearch();
    initImageSearch();
    initAutocomplete();
    initTextSearch();

    // Inject animation CSS
    const style = document.createElement('style');
    style.textContent = '@keyframes fadeInToast{from{opacity:0;transform:translate(-50%,10px)}to{opacity:1;transform:translate(-50%,0)}}';
    document.head.appendChild(style);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
