/**
 * Globex Sky — Reviews Frontend
 * Handles product reviews: display, create, vote helpful, report.
 */
(function () {
  'use strict';

  const API = (window.GlobexConfig && window.GlobexConfig.API_BASE) || '/api/v1';

  /* ── State ──────────────────────────────────────────────────────────────── */
  let reviews = [];
  let currentProductId = null;
  let averageRating = 0;

  /* ── DOM Refs ───────────────────────────────────────────────────────────── */
  const reviewListEl      = document.getElementById('reviewList');
  const reviewFormEl      = document.getElementById('reviewForm');
  const ratingInputEl     = document.getElementById('reviewRating');
  const avgRatingEl       = document.getElementById('avgRating');
  const ratingCountEl     = document.getElementById('ratingCount');
  const ratingBarsEl      = document.getElementById('ratingBars');
  const submitReviewBtn   = document.getElementById('submitReviewBtn');
  const starInputs        = document.querySelectorAll('[data-star]');
  const starDisplay       = document.querySelectorAll('.star-interactive');

  /* ── Auth helper ────────────────────────────────────────────────────────── */
  function getToken() {
    return localStorage.getItem('token') || sessionStorage.getItem('token') || '';
  }

  function authHeaders() {
    return { 'Content-Type': 'application/json', Authorization: 'Bearer ' + getToken() };
  }

  /* ── API calls ──────────────────────────────────────────────────────────── */
  async function fetchReviews(productId) {
    currentProductId = productId;
    try {
      const res = await fetch(API + '/reviews/product/' + productId, { headers: { 'Content-Type': 'application/json' } });
      if (!res.ok) return;
      const json = await res.json();
      reviews = json.data || [];
      computeStats();
      renderReviews();
      renderStats();
    } catch (e) {
      console.warn('Reviews: failed to load', e);
    }
  }

  async function submitReview(payload) {
    try {
      const res = await fetch(API + '/reviews', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Failed to submit review.');
        return false;
      }
      await fetchReviews(currentProductId);
      return true;
    } catch (e) {
      console.warn('Reviews: failed to submit', e);
      return false;
    }
  }

  async function markHelpful(reviewId) {
    try {
      await fetch(API + '/reviews/' + reviewId + '/helpful', { method: 'POST', headers: authHeaders() });
      await fetchReviews(currentProductId);
    } catch (e) { console.warn('Reviews: mark helpful failed', e); }
  }

  async function deleteReview(reviewId) {
    if (!confirm('Delete this review?')) return;
    try {
      await fetch(API + '/reviews/' + reviewId, { method: 'DELETE', headers: authHeaders() });
      await fetchReviews(currentProductId);
    } catch (e) { console.warn('Reviews: delete failed', e); }
  }

  /* ── Compute stats ──────────────────────────────────────────────────────── */
  function computeStats() {
    if (!reviews.length) { averageRating = 0; return; }
    const sum = reviews.reduce((acc, r) => acc + (r.rating || 0), 0);
    averageRating = sum / reviews.length;
  }

  /* ── Render reviews ─────────────────────────────────────────────────────── */
  function renderReviews() {
    if (!reviewListEl) return;
    if (!reviews.length) {
      reviewListEl.innerHTML = '<div style="text-align:center;padding:32px;color:#94a3b8;font-size:.88rem;">No reviews yet. Be the first to review!</div>';
      return;
    }
    reviewListEl.innerHTML = reviews.map(r => {
      const name = r.reviewer ? (r.reviewer.full_name || 'Anonymous') : 'Anonymous';
      const initials = getInitials(name);
      const stars = renderStars(r.rating);
      const time = formatDate(r.created_at);
      const photos = (r.photos || []).map(p => `<img src="${escHtml(p)}" style="width:60px;height:60px;object-fit:cover;border-radius:6px;cursor:pointer;" onclick="window.open('${escHtml(p)}','_blank')">`).join('');
      return `<div class="review-item" style="padding:20px;border-bottom:1px solid #f1f5f9;">
        <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:10px;">
          <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#0052CC,#00C9A7);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:.85rem;flex-shrink:0;">${escHtml(initials)}</div>
          <div style="flex:1;">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <span style="font-weight:600;font-size:.9rem;color:#0a0e27;">${escHtml(name)}</span>
              ${r.is_verified_purchase ? '<span style="background:#d1fae5;color:#059669;font-size:.7rem;padding:2px 8px;border-radius:50px;font-weight:600;">✓ Verified</span>' : ''}
              <span style="font-size:.75rem;color:#94a3b8;margin-left:auto;">${time}</span>
            </div>
            <div style="margin-top:4px;">${stars}</div>
            ${r.title ? `<div style="font-weight:600;font-size:.88rem;color:#1e293b;margin-top:6px;">${escHtml(r.title)}</div>` : ''}
          </div>
        </div>
        ${r.content || r.comment ? `<p style="font-size:.88rem;color:#374151;line-height:1.6;margin-bottom:10px;">${escHtml(r.content || r.comment)}</p>` : ''}
        ${photos ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">${photos}</div>` : ''}
        ${r.seller_response ? `<div style="background:#f0f4ff;border-radius:8px;padding:10px 14px;margin-bottom:10px;font-size:.83rem;"><span style="font-weight:600;color:#0052CC;">Seller:</span> ${escHtml(r.seller_response)}</div>` : ''}
        <div style="display:flex;align-items:center;gap:12px;">
          <button class="helpful-btn" data-id="${r.id}" style="background:none;border:1px solid #e2e8f0;padding:4px 12px;border-radius:50px;font-size:.78rem;cursor:pointer;color:#64748b;transition:all .15s;">
            <i class="fas fa-thumbs-up"></i> Helpful (${r.helpful_count || 0})
          </button>
          <button class="report-btn" data-id="${r.id}" style="background:none;border:none;font-size:.78rem;cursor:pointer;color:#94a3b8;">Report</button>
        </div>
      </div>`;
    }).join('');

    reviewListEl.querySelectorAll('.helpful-btn').forEach(btn => {
      btn.addEventListener('click', () => markHelpful(btn.dataset.id));
      btn.addEventListener('mouseenter', () => { btn.style.background = '#f0f4ff'; btn.style.color = '#0052CC'; btn.style.borderColor = '#0052CC'; });
      btn.addEventListener('mouseleave', () => { btn.style.background = 'none'; btn.style.color = '#64748b'; btn.style.borderColor = '#e2e8f0'; });
    });

    reviewListEl.querySelectorAll('.report-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const reason = prompt('Please state your reason for reporting this review:');
        if (reason) {
          fetch(API + '/reviews/' + btn.dataset.id + '/report', {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ reason }),
          }).then(() => alert('Report submitted. Thank you.'))
            .catch(() => alert('Failed to submit report.'));
        }
      });
    });
  }

  /* ── Render rating stats ────────────────────────────────────────────────── */
  function renderStats() {
    if (avgRatingEl) {
      avgRatingEl.textContent = averageRating ? averageRating.toFixed(1) : '0';
    }
    if (ratingCountEl) {
      ratingCountEl.textContent = '(' + reviews.length + ' review' + (reviews.length !== 1 ? 's' : '') + ')';
    }

    if (ratingBarsEl) {
      const dist = [5, 4, 3, 2, 1].map(star => {
        const count = reviews.filter(r => r.rating === star).length;
        const pct = reviews.length ? Math.round((count / reviews.length) * 100) : 0;
        return { star, count, pct };
      });
      ratingBarsEl.innerHTML = dist.map(d => `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
          <span style="font-size:.78rem;color:#64748b;width:30px;text-align:right;">${d.star}★</span>
          <div style="flex:1;height:8px;background:#f1f5f9;border-radius:4px;overflow:hidden;">
            <div style="height:100%;width:${d.pct}%;background:${d.star >= 4 ? '#22c55e' : d.star === 3 ? '#f59e0b' : '#ef4444'};border-radius:4px;transition:width .4s;"></div>
          </div>
          <span style="font-size:.75rem;color:#94a3b8;width:28px;">${d.count}</span>
        </div>`).join('');
    }
  }

  /* ── Star rating input ──────────────────────────────────────────────────── */
  let selectedRating = 0;

  starInputs.forEach(star => {
    star.addEventListener('click', () => {
      selectedRating = parseInt(star.dataset.star, 10);
      if (ratingInputEl) ratingInputEl.value = selectedRating;
      updateStarDisplay(selectedRating);
    });
    star.addEventListener('mouseenter', () => updateStarDisplay(parseInt(star.dataset.star, 10)));
    star.addEventListener('mouseleave', () => updateStarDisplay(selectedRating));
  });

  function updateStarDisplay(rating) {
    starInputs.forEach(s => {
      const val = parseInt(s.dataset.star, 10);
      s.style.color = val <= rating ? '#f59e0b' : '#d1d5db';
    });
  }

  /* ── Review form submission ─────────────────────────────────────────────── */
  if (reviewFormEl) {
    reviewFormEl.addEventListener('submit', async e => {
      e.preventDefault();
      if (!selectedRating) { alert('Please select a star rating.'); return; }
      if (!currentProductId) { alert('No product selected.'); return; }

      const commentEl = document.getElementById('reviewComment');
      const titleEl   = document.getElementById('reviewTitle');

      const payload = {
        product_id: currentProductId,
        rating: selectedRating,
        title: titleEl ? titleEl.value.trim() : '',
        comment: commentEl ? commentEl.value.trim() : '',
      };

      if (submitReviewBtn) { submitReviewBtn.disabled = true; submitReviewBtn.textContent = 'Submitting…'; }
      const ok = await submitReview(payload);
      if (submitReviewBtn) { submitReviewBtn.disabled = false; submitReviewBtn.textContent = 'Submit Review'; }
      if (ok) {
        reviewFormEl.reset();
        selectedRating = 0;
        updateStarDisplay(0);
        alert('Review submitted successfully!');
      }
    });
  }

  /* ── Helpers ────────────────────────────────────────────────────────────── */
  function renderStars(rating) {
    return Array.from({ length: 5 }, (_, i) =>
      `<i class="fas fa-star" style="color:${i < rating ? '#f59e0b' : '#e2e8f0'};font-size:.85rem;"></i>`
    ).join('');
  }

  function getInitials(name) {
    return name.split(' ').map(n => n[0] || '').slice(0, 2).join('').toUpperCase() || 'A';
  }

  function formatDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ── Auto-init from data attribute ─────────────────────────────────────── */
  function init() {
    const container = document.getElementById('reviewsSection') || document.getElementById('reviewList');
    if (container && container.dataset.productId) {
      fetchReviews(container.dataset.productId);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for use on product pages
  window.GlobexReviews = {
    load: fetchReviews,
    submit: submitReview,
  };
}());
