/**
 * carry.js – CarryService module for GlobexSky Carry (traveller courier) feature.
 * Handles flight validation, earnings calculation, product selection, weight slider,
 * and withdrawal processing.
 */

const CarryService = (() => {
  // ─── Internal State ───────────────────────────────────────────────────────
  let _selectedProducts = [];
  let _currentWeight = 0;
  let _balance = 0; // loaded from DOM on init

  // ─── Utility ──────────────────────────────────────────────────────────────

  /**
   * Format a number as a USD currency string.
   * @param {number} amount
   * @returns {string}
   */
  const formatCurrency = (amount) => `$${Number(amount).toFixed(2)}`;

  /**
   * Show an inline validation error beneath a field.
   * @param {HTMLElement} field
   * @param {string} message
   */
  const _showFieldError = (field, message) => {
    _clearFieldError(field);
    field.style.borderColor = '#ef4444';
    const err = document.createElement('span');
    err.className = 'carry-field-error';
    err.style.cssText = 'color:#ef4444;font-size:.78rem;display:block;margin-top:4px';
    err.textContent = message;
    field.parentNode.appendChild(err);
  };

  const _clearFieldError = (field) => {
    field.style.borderColor = '';
    const prev = field.parentNode.querySelector('.carry-field-error');
    if (prev) prev.remove();
  };

  // ─── Validation ───────────────────────────────────────────────────────────

  /**
   * Validate flight details form fields.
   * @param {HTMLFormElement} form
   * @returns {{ valid: boolean, errors: string[] }}
   */
  const validateFlightDetails = (form) => {
    const errors = [];
    const fields = {
      origin: form.querySelector('[name="origin"]'),
      destination: form.querySelector('[name="destination"]'),
      flightNumber: form.querySelector('[name="flightNumber"]'),
      travelDate: form.querySelector('[name="travelDate"]'),
    };

    // Clear previous errors
    Object.values(fields).forEach((f) => { if (f) _clearFieldError(f); });

    if (!fields.origin || !fields.origin.value.trim()) {
      errors.push('Origin city/airport is required.');
      if (fields.origin) _showFieldError(fields.origin, 'Origin is required.');
    }

    if (!fields.destination || !fields.destination.value.trim()) {
      errors.push('Destination city/airport is required.');
      if (fields.destination) _showFieldError(fields.destination, 'Destination is required.');
    }

    if (fields.origin && fields.destination &&
        fields.origin.value.trim().toLowerCase() === fields.destination.value.trim().toLowerCase()) {
      errors.push('Origin and destination cannot be the same.');
      if (fields.destination) _showFieldError(fields.destination, 'Must differ from origin.');
    }

    if (!fields.flightNumber || !fields.flightNumber.value.trim()) {
      errors.push('Flight number is required.');
      if (fields.flightNumber) _showFieldError(fields.flightNumber, 'Flight number is required.');
    } else if (!/^[A-Z0-9]{2,8}$/i.test(fields.flightNumber.value.trim())) {
      errors.push('Flight number format is invalid (e.g. GS1234).');
      if (fields.flightNumber) _showFieldError(fields.flightNumber, 'Invalid format (e.g. GS1234).');
    }

    if (!fields.travelDate || !fields.travelDate.value) {
      errors.push('Travel date is required.');
      if (fields.travelDate) _showFieldError(fields.travelDate, 'Travel date is required.');
    } else {
      const chosen = new Date(fields.travelDate.value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (chosen < today) {
        errors.push('Travel date cannot be in the past.');
        if (fields.travelDate) _showFieldError(fields.travelDate, 'Date cannot be in the past.');
      }
    }

    return { valid: errors.length === 0, errors };
  };

  // ─── Earnings Calculation ─────────────────────────────────────────────────

  /**
   * Calculate earnings for a carry trip.
   * @param {Array<{name: string, kgRate: number}>} products  Selected products.
   * @param {number} weight  Total weight in kg.
   * @returns {{ baseEarnings: number, bonuses: { onTime: number, volumeBonus: number }, total: number }}
   */
  const calculateEarnings = (products, weight) => {
    if (!products.length || weight <= 0) {
      return { baseEarnings: 0, bonuses: { onTime: 15, volumeBonus: 0 }, total: 15 };
    }

    // Base: weighted average kg rate × weight
    const avgRate = products.reduce((sum, p) => sum + p.kgRate, 0) / products.length;
    const baseEarnings = parseFloat((avgRate * weight).toFixed(2));

    // Volume bonus: extra 10% if carrying 10+ kg
    const volumeBonus = weight >= 10 ? parseFloat((baseEarnings * 0.1).toFixed(2)) : 0;

    // On-time delivery bonus is always $15 (paid after confirmation)
    const onTime = 15;

    const total = parseFloat((baseEarnings + onTime + volumeBonus).toFixed(2));

    return { baseEarnings, bonuses: { onTime, volumeBonus }, total };
  };

  // ─── DOM Updates ──────────────────────────────────────────────────────────

  /**
   * Read selected products and weight from DOM, then refresh the earnings display.
   */
  const updateEarningsDisplay = () => {
    const breakdown = calculateEarnings(_selectedProducts, _currentWeight);

    const setEl = (sel, val) => {
      const el = document.querySelector(sel);
      if (el) el.textContent = val;
    };

    setEl('#earn-base', formatCurrency(breakdown.baseEarnings));
    setEl('#earn-on-time', formatCurrency(breakdown.bonuses.onTime));
    setEl('#earn-volume', formatCurrency(breakdown.bonuses.volumeBonus));
    setEl('#earn-total', formatCurrency(breakdown.total));
    setEl('#earn-weight-display', `${_currentWeight.toFixed(1)} kg`);
    setEl('#earn-products-count', `${_selectedProducts.length} product(s) selected`);
  };

  // ─── Product Selection ────────────────────────────────────────────────────

  /**
   * Initialise click handlers on product cards (.carry-product-card).
   * Each card must have data-product-name and data-kg-rate attributes.
   */
  const initProductSelection = () => {
    const cards = document.querySelectorAll('.carry-product-card');
    cards.forEach((card) => {
      card.style.cursor = 'pointer';
      card.addEventListener('click', () => {
        const name = card.dataset.productName || card.dataset.name || 'Product';
        const kgRate = parseFloat(card.dataset.kgRate || card.dataset.rate || '5');

        const idx = _selectedProducts.findIndex((p) => p.name === name);
        if (idx === -1) {
          _selectedProducts.push({ name, kgRate });
          card.classList.add('selected');
          card.style.borderColor = '#0052CC';
          card.style.boxShadow = '0 0 0 3px rgba(0,82,204,.2)';
        } else {
          _selectedProducts.splice(idx, 1);
          card.classList.remove('selected');
          card.style.borderColor = '';
          card.style.boxShadow = '';
        }

        updateEarningsDisplay();
      });
    });
  };

  // ─── Weight Slider ────────────────────────────────────────────────────────

  /**
   * Bind the weight slider (#carry-weight-slider) and sync its display label.
   */
  const initWeightSlider = () => {
    const slider = document.querySelector('#carry-weight-slider');
    const display = document.querySelector('#carry-weight-value');
    if (!slider) return;

    _currentWeight = parseFloat(slider.value) || 0;

    slider.addEventListener('input', () => {
      _currentWeight = parseFloat(slider.value) || 0;
      if (display) display.textContent = `${_currentWeight.toFixed(1)} kg`;
      updateEarningsDisplay();
    });
  };

  // ─── Withdrawal ───────────────────────────────────────────────────────────

  /**
   * Validate and process a withdrawal request.
   * @param {HTMLFormElement} form
   * @returns {boolean} Whether the withdrawal was valid and submitted.
   */
  const handleWithdrawal = (form) => {
    const amountInput = form.querySelector('[name="amount"]');
    const methodInput = form.querySelector('[name="method"]');
    const errors = [];

    if (amountInput) _clearFieldError(amountInput);
    if (methodInput) _clearFieldError(methodInput);

    const amount = parseFloat(amountInput?.value || '0');

    if (!amountInput || isNaN(amount) || amount <= 0) {
      errors.push('Amount must be greater than $0.');
      if (amountInput) _showFieldError(amountInput, 'Enter a valid amount.');
    } else if (amount > _balance) {
      errors.push(`Amount exceeds available balance (${formatCurrency(_balance)}).`);
      if (amountInput) _showFieldError(amountInput, `Max available: ${formatCurrency(_balance)}.`);
    }

    const method = methodInput?.value?.trim();
    if (!method) {
      errors.push('Please select a withdrawal method.');
      if (methodInput) _showFieldError(methodInput, 'Select a method.');
    }

    if (errors.length > 0) return false;

    // Show confirmation
    const confirmed = window.confirm(
      `Confirm withdrawal of ${formatCurrency(amount)} via ${method}?`
    );
    if (confirmed) {
      _balance -= amount;
      const balEl = document.querySelector('#carry-balance-display');
      if (balEl) balEl.textContent = formatCurrency(_balance);
      form.reset();
      alert(`Withdrawal of ${formatCurrency(amount)} submitted successfully.`);
    }
    return confirmed;
  };

  // ─── Initialisation ───────────────────────────────────────────────────────

  /**
   * Wire up all event listeners. Called on DOMContentLoaded.
   */
  const init = () => {
    // Load balance from DOM
    const balEl = document.querySelector('#carry-balance-display');
    if (balEl) _balance = parseFloat(balEl.textContent.replace(/[^0-9.]/g, '')) || 0;

    initProductSelection();
    initWeightSlider();
    updateEarningsDisplay();

    // Flight details form
    const flightForm = document.querySelector('#carry-flight-form');
    if (flightForm) {
      flightForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const { valid, errors } = validateFlightDetails(flightForm);
        if (valid) {
          alert('Flight details saved successfully!');
        } else {
          console.warn('Flight form errors:', errors);
        }
      });
    }

    // Withdrawal form
    const withdrawForm = document.querySelector('#carry-withdraw-form');
    if (withdrawForm) {
      withdrawForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleWithdrawal(withdrawForm);
      });
    }
  };

  // ─── Public API ───────────────────────────────────────────────────────────
  return {
    validateFlightDetails,
    calculateEarnings,
    updateEarningsDisplay,
    initProductSelection,
    initWeightSlider,
    handleWithdrawal,
    formatCurrency,
    init,
  };
})();

// Auto-initialise on DOM ready
document.addEventListener('DOMContentLoaded', CarryService.init);

// Expose globally
window.CarryService = CarryService;
