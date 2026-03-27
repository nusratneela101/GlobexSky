/* ==========================================================================
   Currency Forward Contracts & Hedging — JavaScript Module
   ========================================================================== */
(function () {
  'use strict';

  /* ─── Configuration ─────────────────────────────────────────────────────── */
  const STORAGE_KEY = 'gsky_hedge_contracts';
  const SETTINGS_KEY = 'gsky_hedge_settings';
  const REFRESH_INTERVAL = 30000; // 30 seconds simulated refresh

  /* ─── Mock Exchange Rate Data (vs USD) ──────────────────────────────────── */
  const BASE_RATES = {
    EUR: { rate: 0.9185, name: 'Euro', symbol: '€', flag: '🇪🇺', interestRate: 3.75 },
    GBP: { rate: 0.7892, name: 'British Pound', symbol: '£', flag: '🇬🇧', interestRate: 5.25 },
    CNY: { rate: 7.2450, name: 'Chinese Yuan', symbol: '¥', flag: '🇨🇳', interestRate: 3.45 },
    JPY: { rate: 149.85, name: 'Japanese Yen', symbol: '¥', flag: '🇯🇵', interestRate: 0.10 },
    INR: { rate: 83.12, name: 'Indian Rupee', symbol: '₹', flag: '🇮🇳', interestRate: 6.50 },
    USD: { rate: 1.0000, name: 'US Dollar', symbol: '$', flag: '🇺🇸', interestRate: 5.50 }
  };

  let currentRates = {};
  let rateHistory = {};
  let refreshTimer = null;

  /* ─── Rate Simulation ───────────────────────────────────────────────────── */
  function initRates() {
    Object.keys(BASE_RATES).forEach(function (code) {
      var base = BASE_RATES[code];
      currentRates[code] = {
        rate: base.rate,
        change: 0,
        changePercent: 0,
        high24h: base.rate * 1.005,
        low24h: base.rate * 0.995,
        lastUpdate: new Date().toISOString()
      };
    });
    generateRateHistory();
  }

  function generateRateHistory() {
    Object.keys(BASE_RATES).forEach(function (code) {
      if (code === 'USD') return;
      var base = BASE_RATES[code].rate;
      var history = [];
      for (var i = 30; i >= 0; i--) {
        var d = new Date();
        d.setDate(d.getDate() - i);
        var variance = (Math.random() - 0.5) * 0.02 * base;
        history.push({
          date: d.toISOString().split('T')[0],
          rate: parseFloat((base + variance).toFixed(4))
        });
      }
      rateHistory[code] = history;
    });
  }

  function simulateRateUpdate() {
    Object.keys(BASE_RATES).forEach(function (code) {
      if (code === 'USD') return;
      var prev = currentRates[code].rate;
      var volatility = 0.001;
      var change = (Math.random() - 0.5) * 2 * volatility * prev;
      var newRate = parseFloat((prev + change).toFixed(4));
      currentRates[code] = {
        rate: newRate,
        change: parseFloat((newRate - prev).toFixed(4)),
        changePercent: parseFloat(((newRate - prev) / prev * 100).toFixed(3)),
        high24h: Math.max(currentRates[code].high24h, newRate),
        low24h: Math.min(currentRates[code].low24h, newRate),
        lastUpdate: new Date().toISOString()
      };
    });
    renderRateDashboard();
    updateKPIs();
  }

  /* ─── Forward Rate Calculation (Interest Rate Differential) ─────────────── */
  function calculateForwardRate(baseCurrency, quoteCurrency, spotRate, days) {
    var baseIR = BASE_RATES[baseCurrency] ? BASE_RATES[baseCurrency].interestRate / 100 : 0.05;
    var quoteIR = BASE_RATES[quoteCurrency] ? BASE_RATES[quoteCurrency].interestRate / 100 : 0.05;
    var yearFraction = days / 365;
    var forwardRate = spotRate * ((1 + quoteIR * yearFraction) / (1 + baseIR * yearFraction));
    var premium = forwardRate - spotRate;
    var premiumPercent = (premium / spotRate) * 100;
    return {
      forwardRate: parseFloat(forwardRate.toFixed(4)),
      spotRate: spotRate,
      premium: parseFloat(premium.toFixed(4)),
      premiumPercent: parseFloat(premiumPercent.toFixed(3)),
      isPremium: premium > 0,
      days: days,
      baseInterestRate: baseIR * 100,
      quoteInterestRate: quoteIR * 100
    };
  }

  /* ─── Currency Converter Utility ────────────────────────────────────────── */
  function convertCurrency(amount, fromCurrency, toCurrency) {
    if (fromCurrency === toCurrency) return amount;
    var fromRate = fromCurrency === 'USD' ? 1 : currentRates[fromCurrency].rate;
    var toRate = toCurrency === 'USD' ? 1 : currentRates[toCurrency].rate;
    var usdAmount = amount / fromRate;
    return parseFloat((usdAmount * toRate).toFixed(2));
  }

  /* ─── Risk Score Calculation ────────────────────────────────────────────── */
  function calculateRiskScore(currencyPair, amount, days) {
    var volatilityScores = { EUR: 20, GBP: 35, CNY: 45, JPY: 40, INR: 55 };
    var code = currencyPair.replace('/USD', '').replace('USD/', '');
    var baseVolatility = volatilityScores[code] || 30;
    var tenorFactor = Math.min(days / 180, 1) * 20;
    var amountFactor = Math.min(amount / 1000000, 1) * 15;
    var score = Math.min(Math.round(baseVolatility + tenorFactor + amountFactor), 100);
    var level, description;
    if (score <= 35) {
      level = 'low';
      description = 'Low risk — stable currency pair with short tenor. Hedging optional.';
    } else if (score <= 65) {
      level = 'medium';
      description = 'Moderate risk — consider forward contracts to lock in rates.';
    } else {
      level = 'high';
      description = 'High risk — strong recommendation to hedge this exposure.';
    }
    return { score: score, level: level, description: description };
  }

  /* ─── Contract CRUD (localStorage) ──────────────────────────────────────── */
  function getContracts() {
    try {
      var data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  function saveContracts(contracts) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(contracts));
  }

  function createContract(contractData) {
    var contracts = getContracts();
    var contract = {
      id: 'FWD-' + Date.now().toString(36).toUpperCase(),
      currencyPair: contractData.currencyPair,
      buySell: contractData.buySell,
      amount: parseFloat(contractData.amount),
      spotRate: contractData.spotRate,
      forwardRate: contractData.forwardRate,
      premium: contractData.premium,
      days: parseInt(contractData.days, 10),
      maturityDate: contractData.maturityDate,
      status: 'active',
      createdAt: new Date().toISOString(),
      notes: contractData.notes || ''
    };
    contracts.unshift(contract);
    saveContracts(contracts);
    return contract;
  }

  function cancelContract(id) {
    var contracts = getContracts();
    for (var i = 0; i < contracts.length; i++) {
      if (contracts[i].id === id && contracts[i].status === 'active') {
        contracts[i].status = 'cancelled';
        contracts[i].cancelledAt = new Date().toISOString();
        break;
      }
    }
    saveContracts(contracts);
  }

  function settleContract(id) {
    var contracts = getContracts();
    for (var i = 0; i < contracts.length; i++) {
      if (contracts[i].id === id && contracts[i].status === 'active') {
        contracts[i].status = 'settled';
        contracts[i].settledAt = new Date().toISOString();
        contracts[i].settlementRate = currentRates[contracts[i].currencyPair.split('/')[0]]
          ? currentRates[contracts[i].currencyPair.split('/')[0]].rate
          : contracts[i].forwardRate;
        break;
      }
    }
    saveContracts(contracts);
  }

  /* ─── Sample Contracts Data ─────────────────────────────────────────────── */
  function loadSampleContracts() {
    var contracts = getContracts();
    if (contracts.length > 0) return;

    var now = new Date();
    var samples = [
      {
        id: 'FWD-S001',
        currencyPair: 'EUR/USD',
        buySell: 'buy',
        amount: 250000,
        spotRate: 0.9185,
        forwardRate: 0.9142,
        premium: -0.0043,
        days: 90,
        maturityDate: new Date(now.getTime() + 60 * 86400000).toISOString().split('T')[0],
        status: 'active',
        createdAt: new Date(now.getTime() - 30 * 86400000).toISOString(),
        notes: 'Q2 supplier payment hedge'
      },
      {
        id: 'FWD-S002',
        currencyPair: 'GBP/USD',
        buySell: 'sell',
        amount: 150000,
        spotRate: 0.7892,
        forwardRate: 0.7875,
        premium: -0.0017,
        days: 60,
        maturityDate: new Date(now.getTime() + 20 * 86400000).toISOString().split('T')[0],
        status: 'active',
        createdAt: new Date(now.getTime() - 40 * 86400000).toISOString(),
        notes: 'UK export receivable'
      },
      {
        id: 'FWD-S003',
        currencyPair: 'CNY/USD',
        buySell: 'buy',
        amount: 1000000,
        spotRate: 7.2450,
        forwardRate: 7.2120,
        premium: -0.0330,
        days: 180,
        maturityDate: new Date(now.getTime() + 120 * 86400000).toISOString().split('T')[0],
        status: 'active',
        createdAt: new Date(now.getTime() - 60 * 86400000).toISOString(),
        notes: 'China manufacturing import'
      },
      {
        id: 'FWD-S004',
        currencyPair: 'JPY/USD',
        buySell: 'buy',
        amount: 50000000,
        spotRate: 149.85,
        forwardRate: 146.20,
        premium: -3.65,
        days: 90,
        maturityDate: new Date(now.getTime() - 5 * 86400000).toISOString().split('T')[0],
        status: 'settled',
        createdAt: new Date(now.getTime() - 95 * 86400000).toISOString(),
        settledAt: new Date(now.getTime() - 5 * 86400000).toISOString(),
        settlementRate: 148.50,
        notes: 'Japan electronics purchase'
      },
      {
        id: 'FWD-S005',
        currencyPair: 'INR/USD',
        buySell: 'sell',
        amount: 5000000,
        spotRate: 83.12,
        forwardRate: 83.55,
        premium: 0.43,
        days: 30,
        maturityDate: new Date(now.getTime() - 15 * 86400000).toISOString().split('T')[0],
        status: 'expired',
        createdAt: new Date(now.getTime() - 45 * 86400000).toISOString(),
        notes: 'India IT services payment'
      }
    ];

    saveContracts(samples);
  }

  /* ─── Settings / Rate Alerts ────────────────────────────────────────────── */
  function getSettings() {
    try {
      var data = localStorage.getItem(SETTINGS_KEY);
      return data ? JSON.parse(data) : { alerts: [] };
    } catch (e) {
      return { alerts: [] };
    }
  }

  function saveSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  /* ─── DOM Rendering ─────────────────────────────────────────────────────── */
  function renderRateDashboard() {
    var grid = document.getElementById('rate-dashboard');
    if (!grid) return;

    var html = '';
    Object.keys(BASE_RATES).forEach(function (code) {
      if (code === 'USD') return;
      var info = BASE_RATES[code];
      var rate = currentRates[code];
      var changeClass = rate.change > 0 ? 'up' : rate.change < 0 ? 'down' : 'neutral';
      var changeIcon = rate.change > 0 ? 'fa-arrow-up' : rate.change < 0 ? 'fa-arrow-down' : 'fa-minus';
      html += '<div class="rate-card-hedge">' +
        '<div class="currency-flag">' + info.flag + '</div>' +
        '<div class="currency-pair">' + code + '/USD</div>' +
        '<div class="currency-rate">' + rate.rate.toFixed(4) + '</div>' +
        '<div class="rate-change ' + changeClass + '">' +
          '<i class="fas ' + changeIcon + '"></i> ' +
          Math.abs(rate.changePercent).toFixed(3) + '%' +
        '</div>' +
      '</div>';
    });
    grid.innerHTML = html;
  }

  function updateKPIs() {
    var contracts = getContracts();
    var activeContracts = contracts.filter(function (c) { return c.status === 'active'; });
    var totalNotional = activeContracts.reduce(function (sum, c) { return sum + c.amount; }, 0);
    var avgDays = activeContracts.length > 0
      ? Math.round(activeContracts.reduce(function (sum, c) { return sum + c.days; }, 0) / activeContracts.length)
      : 0;

    setTextContent('kpi-active-contracts', activeContracts.length);
    setTextContent('kpi-total-notional', formatCurrency(totalNotional));
    setTextContent('kpi-avg-tenor', avgDays + ' days');
    setTextContent('kpi-total-contracts', contracts.length);
  }

  function renderActiveContracts() {
    var tbody = document.getElementById('active-contracts-body');
    if (!tbody) return;

    var contracts = getContracts();
    var active = contracts.filter(function (c) { return c.status === 'active'; });

    if (active.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="hedge-empty">' +
        '<i class="fas fa-file-contract"></i><p>No active forward contracts</p></td></tr>';
      return;
    }

    var html = '';
    active.forEach(function (c) {
      html += '<tr>' +
        '<td><strong>' + escapeHtml(c.id) + '</strong></td>' +
        '<td>' + escapeHtml(c.currencyPair) + '</td>' +
        '<td><span class="badge-status ' + (c.buySell === 'buy' ? 'active' : 'settled') + '">' +
          c.buySell.toUpperCase() + '</span></td>' +
        '<td>' + formatNumber(c.amount) + '</td>' +
        '<td>' + c.forwardRate.toFixed(4) + '</td>' +
        '<td>' + escapeHtml(c.maturityDate) + '</td>' +
        '<td><span class="badge-status active">Active</span></td>' +
        '<td>' +
          '<button class="btn-hedge sm secondary" onclick="CurrencyHedging.settleContract(\'' + escapeHtml(c.id) + '\')">' +
            '<i class="fas fa-check"></i></button> ' +
          '<button class="btn-hedge sm danger" onclick="CurrencyHedging.cancelContract(\'' + escapeHtml(c.id) + '\')">' +
            '<i class="fas fa-times"></i></button>' +
        '</td>' +
      '</tr>';
    });
    tbody.innerHTML = html;
  }

  function renderContractHistory() {
    var tbody = document.getElementById('history-contracts-body');
    if (!tbody) return;

    var contracts = getContracts();
    var history = contracts.filter(function (c) { return c.status !== 'active'; });

    if (history.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="hedge-empty">' +
        '<i class="fas fa-history"></i><p>No contract history yet</p></td></tr>';
      return;
    }

    var html = '';
    history.forEach(function (c) {
      html += '<tr>' +
        '<td><strong>' + escapeHtml(c.id) + '</strong></td>' +
        '<td>' + escapeHtml(c.currencyPair) + '</td>' +
        '<td>' + formatNumber(c.amount) + '</td>' +
        '<td>' + c.forwardRate.toFixed(4) + '</td>' +
        '<td><span class="badge-status ' + escapeHtml(c.status) + '">' +
          capitalize(c.status) + '</span></td>' +
        '<td>' + formatDate(c.createdAt) + '</td>' +
        '<td>' + (c.settlementRate ? c.settlementRate.toFixed(4) : '—') + '</td>' +
      '</tr>';
    });
    tbody.innerHTML = html;
  }

  function renderRiskAssessment() {
    var pair = getSelectValue('calc-pair');
    var amount = getInputNumber('calc-amount');
    var days = getInputNumber('calc-tenor');
    if (!pair || !amount || !days) return;

    var code = pair.split('/')[0];
    var risk = calculateRiskScore(pair, amount, days);

    setTextContent('risk-score', risk.score);
    var gauge = document.getElementById('risk-gauge');
    if (gauge) {
      gauge.className = 'risk-gauge ' + risk.level;
    }
    setTextContent('risk-label', capitalize(risk.level) + ' Risk');
    setTextContent('risk-desc', risk.description);

    var factorsEl = document.getElementById('risk-factors');
    if (factorsEl) {
      var volatility = risk.score > 50 ? 'High' : risk.score > 30 ? 'Moderate' : 'Low';
      var volColor = risk.score > 50 ? 'red' : risk.score > 30 ? 'orange' : 'green';
      var tenorRisk = days > 90 ? 'Extended' : days > 30 ? 'Standard' : 'Short';
      var tenorColor = days > 90 ? 'orange' : 'green';
      var exposure = amount > 500000 ? 'Large' : amount > 100000 ? 'Medium' : 'Small';
      var expColor = amount > 500000 ? 'orange' : 'green';

      factorsEl.innerHTML =
        '<div class="risk-factor">' +
          '<div class="factor-icon ' + volColor + '"><i class="fas fa-chart-line"></i></div>' +
          '<div><div class="factor-name">Volatility</div><div class="factor-value">' + volatility + '</div></div>' +
        '</div>' +
        '<div class="risk-factor">' +
          '<div class="factor-icon ' + tenorColor + '"><i class="fas fa-clock"></i></div>' +
          '<div><div class="factor-name">Tenor</div><div class="factor-value">' + tenorRisk + ' (' + days + 'd)</div></div>' +
        '</div>' +
        '<div class="risk-factor">' +
          '<div class="factor-icon ' + expColor + '"><i class="fas fa-dollar-sign"></i></div>' +
          '<div><div class="factor-name">Exposure</div><div class="factor-value">' + exposure + '</div></div>' +
        '</div>' +
        '<div class="risk-factor">' +
          '<div class="factor-icon blue"><i class="fas fa-percentage"></i></div>' +
          '<div><div class="factor-name">IR Differential</div><div class="factor-value">' +
            (BASE_RATES[code] ? Math.abs(BASE_RATES['USD'].interestRate - BASE_RATES[code].interestRate).toFixed(2) : '—') +
            '%</div></div>' +
        '</div>';
    }
  }

  /* ─── Chart Rendering ───────────────────────────────────────────────────── */
  var trendChart = null;

  function renderTrendChart(currencyCode) {
    var ctx = document.getElementById('trend-chart');
    if (!ctx || typeof Chart === 'undefined') return;

    currencyCode = currencyCode || 'EUR';
    var history = rateHistory[currencyCode];
    if (!history) return;

    var labels = history.map(function (h) { return h.date.slice(5); });
    var data = history.map(function (h) { return h.rate; });

    if (trendChart) {
      trendChart.destroy();
    }

    try {
      trendChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: currencyCode + '/USD Rate',
            data: data,
            borderColor: '#0052CC',
            backgroundColor: 'rgba(0, 82, 204, 0.08)',
            fill: true,
            tension: 0.4,
            pointRadius: 2,
            pointHoverRadius: 5,
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#0a0e27',
              titleFont: { family: 'Poppins', size: 12 },
              bodyFont: { family: 'Inter', size: 11 },
              padding: 10,
              cornerRadius: 8
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { font: { family: 'Inter', size: 10 }, color: '#94a3b8', maxRotation: 0 }
            },
            y: {
              grid: { color: '#f1f5f9' },
              ticks: { font: { family: 'Inter', size: 10 }, color: '#94a3b8' }
            }
          },
          interaction: { intersect: false, mode: 'index' }
        }
      });
    } catch (e) {
      // Chart.js not available — graceful degradation
    }
  }

  /* ─── Calculator Logic ──────────────────────────────────────────────────── */
  function runCalculator() {
    var pair = getSelectValue('calc-pair');
    var amount = getInputNumber('calc-amount');
    var tenor = getSelectValue('calc-tenor');
    if (!pair || !amount || !tenor) return;

    var parts = pair.split('/');
    var baseCur = parts[0];
    var quoteCur = parts[1];
    var spotRate = baseCur === 'USD'
      ? (currentRates[quoteCur] ? currentRates[quoteCur].rate : 1)
      : (currentRates[baseCur] ? currentRates[baseCur].rate : 1);
    var days = parseInt(tenor, 10);

    var result = calculateForwardRate(baseCur, quoteCur, spotRate, days);

    var resultEl = document.getElementById('calc-result');
    if (resultEl) {
      resultEl.style.display = 'block';

      setTextContent('result-spot-rate', result.spotRate.toFixed(4));
      setTextContent('result-forward-rate', result.forwardRate.toFixed(4));
      setTextContent('result-premium', (result.isPremium ? '+' : '') + result.premium.toFixed(4) +
        ' (' + (result.isPremium ? '+' : '') + result.premiumPercent.toFixed(3) + '%)');
      setTextContent('result-maturity', days + ' days');

      var spotCost = amount * spotRate;
      var forwardCost = amount * result.forwardRate;
      var savings = Math.abs(spotCost - forwardCost);
      var savingsDirection = forwardCost < spotCost ? 'save' : 'cost';

      var savingsEl = document.getElementById('result-savings');
      if (savingsEl) {
        savingsEl.innerHTML = '<i class="fas fa-' +
          (savingsDirection === 'save' ? 'arrow-down' : 'arrow-up') + '"></i>' +
          '<span class="savings-text">Forward contract would ' +
          (savingsDirection === 'save' ? 'save' : 'cost an additional') +
          ' ' + formatCurrency(savings) + ' compared to spot rate</span>';
      }
    }

    renderRiskAssessment();
  }

  /* ─── New Contract Modal ────────────────────────────────────────────────── */
  function openNewContractModal() {
    var modal = document.getElementById('new-contract-modal');
    if (modal) modal.classList.add('show');
  }

  function closeNewContractModal() {
    var modal = document.getElementById('new-contract-modal');
    if (modal) modal.classList.remove('show');
  }

  function submitNewContract(e) {
    if (e) e.preventDefault();

    var pair = getSelectValue('modal-pair');
    var buySell = getSelectValue('modal-buy-sell');
    var amount = getInputNumber('modal-amount');
    var tenor = getSelectValue('modal-tenor');
    var notes = getInputValue('modal-notes');

    if (!pair || !amount || !tenor) {
      showToast('Please fill all required fields', 'error');
      return;
    }

    var parts = pair.split('/');
    var baseCur = parts[0];
    var quoteCur = parts[1];
    var spotRate = baseCur === 'USD'
      ? (currentRates[quoteCur] ? currentRates[quoteCur].rate : 1)
      : (currentRates[baseCur] ? currentRates[baseCur].rate : 1);
    var days = parseInt(tenor, 10);
    var fwd = calculateForwardRate(baseCur, quoteCur, spotRate, days);

    var maturityDate = new Date();
    maturityDate.setDate(maturityDate.getDate() + days);

    var contract = createContract({
      currencyPair: pair,
      buySell: buySell,
      amount: amount,
      spotRate: spotRate,
      forwardRate: fwd.forwardRate,
      premium: fwd.premium,
      days: days,
      maturityDate: maturityDate.toISOString().split('T')[0],
      notes: notes
    });

    closeNewContractModal();
    renderActiveContracts();
    renderContractHistory();
    updateKPIs();
    showToast('Forward contract ' + contract.id + ' created successfully!', 'success');
  }

  /* ─── Toast Notification ────────────────────────────────────────────────── */
  function showToast(message, type) {
    var existing = document.querySelector('.hedge-toast');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.className = 'hedge-toast ' + (type || 'info');
    var icon = type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle';
    toast.innerHTML = '<i class="fas fa-' + icon + '"></i> ' + escapeHtml(message);
    document.body.appendChild(toast);

    setTimeout(function () { toast.classList.add('show'); }, 50);
    setTimeout(function () {
      toast.classList.remove('show');
      setTimeout(function () { toast.remove(); }, 300);
    }, 3500);
  }

  /* ─── Chart Tab Handling ────────────────────────────────────────────────── */
  function handleChartTab(code) {
    var tabs = document.querySelectorAll('.chart-tab');
    tabs.forEach(function (tab) {
      tab.classList.toggle('active', tab.getAttribute('data-currency') === code);
    });
    renderTrendChart(code);
  }

  /* ─── Helper Functions ──────────────────────────────────────────────────── */
  function formatCurrency(amount) {
    return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function formatNumber(num) {
    return num.toLocaleString('en-US');
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    var d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function escapeHtml(str) {
    if (typeof str !== 'string') return str;
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function setTextContent(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function getSelectValue(id) {
    var el = document.getElementById(id);
    return el ? el.value : '';
  }

  function getInputValue(id) {
    var el = document.getElementById(id);
    return el ? el.value : '';
  }

  function getInputNumber(id) {
    var el = document.getElementById(id);
    return el ? parseFloat(el.value) || 0 : 0;
  }

  /* ─── Initialization ────────────────────────────────────────────────────── */
  function init() {
    initRates();
    loadSampleContracts();
    renderRateDashboard();
    updateKPIs();
    renderActiveContracts();
    renderContractHistory();
    renderRiskAssessment();

    // Chart tabs
    document.querySelectorAll('.chart-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        handleChartTab(this.getAttribute('data-currency'));
      });
    });

    // Calculator
    var calcBtn = document.getElementById('calc-btn');
    if (calcBtn) {
      calcBtn.addEventListener('click', function (e) {
        e.preventDefault();
        runCalculator();
      });
    }

    // Auto-update calculator on input change
    ['calc-pair', 'calc-amount', 'calc-tenor'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', runCalculator);
        if (el.tagName === 'INPUT') {
          el.addEventListener('input', runCalculator);
        }
      }
    });

    // New contract modal
    var newBtn = document.getElementById('btn-new-contract');
    if (newBtn) {
      newBtn.addEventListener('click', openNewContractModal);
    }

    var closeBtn = document.getElementById('modal-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', closeNewContractModal);
    }

    var modalOverlay = document.getElementById('new-contract-modal');
    if (modalOverlay) {
      modalOverlay.addEventListener('click', function (e) {
        if (e.target === modalOverlay) closeNewContractModal();
      });
    }

    var contractForm = document.getElementById('new-contract-form');
    if (contractForm) {
      contractForm.addEventListener('submit', submitNewContract);
    }

    // Chart tab click and initial render
    renderTrendChart('EUR');

    // Auto-refresh simulation
    refreshTimer = setInterval(simulateRateUpdate, REFRESH_INTERVAL);

    // Update chart tab on pair change
    var pairSelect = document.getElementById('calc-pair');
    if (pairSelect) {
      pairSelect.addEventListener('change', function () {
        var code = this.value.split('/')[0];
        if (code !== 'USD') {
          handleChartTab(code);
        }
      });
    }
  }

  /* ─── Public API ────────────────────────────────────────────────────────── */
  window.CurrencyHedging = {
    init: init,
    calculateForwardRate: calculateForwardRate,
    convertCurrency: convertCurrency,
    calculateRiskScore: calculateRiskScore,
    getContracts: getContracts,
    createContract: createContract,
    runCalculator: runCalculator,
    openNewContractModal: openNewContractModal,
    closeNewContractModal: closeNewContractModal,
    settleContract: function (id) {
      settleContract(id);
      renderActiveContracts();
      renderContractHistory();
      updateKPIs();
      showToast('Contract ' + id + ' settled', 'success');
    },
    cancelContract: function (id) {
      cancelContract(id);
      renderActiveContracts();
      renderContractHistory();
      updateKPIs();
      showToast('Contract ' + id + ' cancelled', 'info');
    },
    handleChartTab: handleChartTab,
    showToast: showToast
  };

  // Auto-init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
