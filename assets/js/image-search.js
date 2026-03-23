/**
 * Globex Sky — image-search.js
 * Image search module:
 *   - Image upload for "find similar products"
 *   - Camera capture for mobile
 *   - Drag-and-drop image upload
 *   - Image preprocessing (resize, crop)
 *   - Visual similarity matching display
 *   - "Search by photo" button integration
 */

'use strict';

const GlobexImageSearch = (() => {

  const MAX_DIMENSION = 800; // px — resize before sending
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
  const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

  let currentImageData = null; // base64 data URL of the selected image

  /* ── Image Preprocessing ────────────────────────────────────────────── */
  function resizeImage(file, maxDim = MAX_DIMENSION) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function validateFile(file) {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return { valid: false, error: 'Unsupported file type. Please use JPEG, PNG, WebP, or GIF.' };
    }
    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, error: 'File too large. Maximum size is 5 MB.' };
    }
    return { valid: true };
  }

  /* ── Camera Capture ─────────────────────────────────────────────────── */
  function openCamera() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = e => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    };
    input.click();
  }

  /* ── File Handler ───────────────────────────────────────────────────── */
  async function handleFile(file) {
    const validation = validateFile(file);
    if (!validation.valid) {
      showError(validation.error);
      return;
    }

    showLoading('Processing image…');
    try {
      const dataUrl = await resizeImage(file);
      currentImageData = dataUrl;
      showPreview(dataUrl, file.name);
      hideLoading();
    } catch (err) {
      hideLoading();
      showError('Failed to process image. Please try another file.');
    }
  }

  /* ── Drag and Drop ──────────────────────────────────────────────────── */
  function initDragDrop(zone) {
    if (!zone) return;

    zone.addEventListener('dragover', e => {
      e.preventDefault();
      zone.classList.add('drag-over');
    });

    zone.addEventListener('dragleave', e => {
      if (!zone.contains(e.relatedTarget)) zone.classList.remove('drag-over');
    });

    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    });

    zone.addEventListener('paste', e => {
      const items = e.clipboardData?.items || [];
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) { handleFile(file); break; }
        }
      }
    });
  }

  /* ── Search Execution ───────────────────────────────────────────────── */
  async function performSearch() {
    if (!currentImageData) {
      showError('Please select or capture an image first.');
      return;
    }

    const searchBtn = document.getElementById('btn-image-search-confirm');
    if (searchBtn) { searchBtn.disabled = true; searchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Searching…'; }

    showLoading('Finding similar products…');
    clearResults();

    try {
      let data;
      const payload = { imageBase64: currentImageData };
      try {
        data = await window.API.post('/ai/search/image', payload);
      } catch (_) {
        data = await window.API.post('/search/image', payload);
      }
      hideLoading();
      renderResults(data.data || data.results || []);
    } catch (err) {
      hideLoading();
      showError('Image search failed. Please try again or use text search.');
    } finally {
      if (searchBtn) { searchBtn.disabled = false; searchBtn.innerHTML = '<i class="fas fa-search"></i> Search by Image'; }
    }
  }

  /* ── Results Rendering ──────────────────────────────────────────────── */
  function renderResults(products) {
    const container = document.getElementById('image-search-results');
    if (!container) return;

    if (!products.length) {
      container.innerHTML = `
        <div class="image-search-empty">
          <i class="fas fa-image" style="font-size:2.5rem;color:#94a3b8;margin-bottom:12px"></i>
          <p>No similar products found. Try a different image or <a href="/pages/search/advanced.html">advanced search</a>.</p>
        </div>`;
      return;
    }

    container.innerHTML = `
      <div class="image-results-header">
        <span>${products.length} visually similar products found</span>
      </div>
      <div class="image-results-grid">
        ${products.map(p => renderProductCard(p)).join('')}
      </div>`;
  }

  function renderProductCard(p) {
    const img = (p.images && p.images[0]) || p.image || '';
    const price = p.price != null ? `$${Number(p.price).toFixed(2)}` : 'Price on request';
    const similarity = p.similarity != null ? `<span class="similarity-badge">${Math.round(p.similarity * 100)}% match</span>` : '';
    return `
      <div class="image-result-card">
        ${similarity}
        <img src="${img}" alt="${p.name || 'Product'}" class="image-result-thumb" loading="lazy" onerror="this.src='../../assets/images/logo.png'"/>
        <div class="image-result-info">
          <div class="image-result-name">${p.name || 'Product'}</div>
          <div class="image-result-price">${price}</div>
          <a href="/pages/product/detail.html?id=${p.id || p._id}" class="btn-sm btn-primary" style="display:inline-block;margin-top:8px;text-decoration:none">View Product</a>
        </div>
      </div>`;
  }

  /* ── UI Helpers ─────────────────────────────────────────────────────── */
  function showPreview(dataUrl, filename) {
    const preview = document.getElementById('image-preview');
    const img = document.getElementById('image-preview-img');
    const name = document.getElementById('image-preview-name');
    if (preview) preview.hidden = false;
    if (img) { img.src = dataUrl; img.alt = filename || 'Selected image'; }
    if (name) name.textContent = filename || 'Selected image';
    const searchBtn = document.getElementById('btn-image-search-confirm');
    if (searchBtn) searchBtn.disabled = false;
  }

  function clearPreview() {
    currentImageData = null;
    const preview = document.getElementById('image-preview');
    if (preview) preview.hidden = true;
    const searchBtn = document.getElementById('btn-image-search-confirm');
    if (searchBtn) searchBtn.disabled = true;
    clearResults();
  }

  function clearResults() {
    const container = document.getElementById('image-search-results');
    if (container) container.innerHTML = '';
  }

  function showLoading(msg) {
    const el = document.getElementById('image-search-loading');
    if (el) { el.textContent = msg || 'Loading…'; el.hidden = false; }
  }

  function hideLoading() {
    const el = document.getElementById('image-search-loading');
    if (el) el.hidden = true;
  }

  function showError(msg) {
    const el = document.getElementById('image-search-error');
    if (el) { el.textContent = msg; el.hidden = false; setTimeout(() => { el.hidden = true; }, 5000); }
    else { alert(msg); }
  }

  /* ── Modal Support ──────────────────────────────────────────────────── */
  function openModal() {
    const modal = document.getElementById('image-search-modal');
    if (modal) modal.classList.add('open');
  }

  function closeModal() {
    const modal = document.getElementById('image-search-modal');
    if (modal) modal.classList.remove('open');
    clearPreview();
  }

  /* ── Init ───────────────────────────────────────────────────────────── */
  function init() {
    // File input
    const fileInput = document.getElementById('image-file-input');
    if (fileInput) {
      fileInput.accept = ACCEPTED_TYPES.join(',');
      fileInput.addEventListener('change', e => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
        fileInput.value = '';
      });
    }

    // Browse button
    const browseBtn = document.getElementById('btn-browse-image');
    if (browseBtn) browseBtn.addEventListener('click', () => fileInput?.click());

    // Camera button
    const cameraBtn = document.getElementById('btn-camera-capture');
    if (cameraBtn) cameraBtn.addEventListener('click', openCamera);

    // Drag-and-drop zone
    const dropZone = document.getElementById('image-drop-zone');
    initDragDrop(dropZone);

    // Search button
    const searchBtn = document.getElementById('btn-image-search-confirm');
    if (searchBtn) {
      searchBtn.disabled = true;
      searchBtn.addEventListener('click', performSearch);
    }

    // Clear preview button
    const clearBtn = document.getElementById('btn-image-clear');
    if (clearBtn) clearBtn.addEventListener('click', clearPreview);

    // Modal triggers
    const openBtns = document.querySelectorAll('[data-open-image-search]');
    openBtns.forEach(b => b.addEventListener('click', openModal));

    const closeBtns = document.querySelectorAll('[data-close-image-search]');
    closeBtns.forEach(b => b.addEventListener('click', closeModal));

    const modal = document.getElementById('image-search-modal');
    if (modal) {
      modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
    }

    // Clipboard paste on page
    document.addEventListener('paste', e => {
      const items = e.clipboardData?.items || [];
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) { handleFile(file); break; }
        }
      }
    });
  }

  return {
    init,
    openModal,
    closeModal,
    openCamera,
    handleFile,
    performSearch,
    clearPreview,
    isSupported: () => true, // Canvas is universally supported
    ACCEPTED_TYPES,
    MAX_DIMENSION,
    MAX_FILE_SIZE,
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  GlobexImageSearch.init();
});

window.GlobexImageSearch = window.GlobexImageSearch || GlobexImageSearch;
