/**
 * Globex Sky — Simple CSS/SVG Charts
 * Pure CSS/SVG charts without any external library dependencies.
 * Supports: bar, line, and donut chart types.
 */
(function () {
  'use strict';

  var SimpleChart = {
    /* ── Bar Chart ── */
    bar(container, data, options) {
      options = options || {};
      var maxVal = data.reduce(function (m, d) { return d.value > m ? d.value : m; }, 0);
      if (maxVal === 0) maxVal = 1;
      var color = options.color || '#ff6b35';

      var barsHtml = data.map(function (d) {
        var pct = ((d.value / maxVal) * 100).toFixed(1);
        return '<div class="chart-bar-wrapper">' +
          '<div class="chart-bar" style="height:' + pct + '%;background:' + color + '">' +
            '<span class="chart-value">' + d.value + '</span>' +
          '</div>' +
          '<span class="chart-label">' + d.label + '</span>' +
        '</div>';
      }).join('');

      container.innerHTML =
        '<div class="simple-chart bar-chart">' +
          (options.title ? '<h3 class="chart-title">' + _esc(options.title) + '</h3>' : '') +
          '<div class="chart-bars">' + barsHtml + '</div>' +
        '</div>';
    },

    /* ── Line Chart (SVG) ── */
    line(container, data, options) {
      options = options || {};
      var w = options.width || 600;
      var h = options.height || 200;
      var color = options.color || '#ff6b35';
      var maxVal = data.reduce(function (m, d) { return d.value > m ? d.value : m; }, 0);
      if (maxVal === 0) maxVal = 1;

      var n = data.length;
      var points = data.map(function (d, i) {
        var x = n > 1 ? (i / (n - 1)) * w : w / 2;
        var y = h - (d.value / maxVal) * h;
        return x.toFixed(1) + ',' + y.toFixed(1);
      }).join(' ');

      var circles = data.map(function (d, i) {
        var x = n > 1 ? (i / (n - 1)) * w : w / 2;
        var y = h - (d.value / maxVal) * h;
        return '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="4" fill="' + color + '"/>';
      }).join('');

      var labels = data.map(function (d) {
        return '<span>' + _esc(d.label) + '</span>';
      }).join('');

      container.innerHTML =
        '<div class="simple-chart line-chart">' +
          (options.title ? '<h3 class="chart-title">' + _esc(options.title) + '</h3>' : '') +
          '<svg viewBox="0 0 ' + w + ' ' + h + '" style="width:100%;max-width:' + w + 'px">' +
            '<polyline points="' + points + '" fill="none" stroke="' + color + '" stroke-width="2"/>' +
            circles +
          '</svg>' +
          '<div class="chart-x-labels">' + labels + '</div>' +
        '</div>';
    },

    /* ── Donut Chart (CSS conic-gradient) ── */
    donut(container, data, options) {
      options = options || {};
      var total = data.reduce(function (s, d) { return s + d.value; }, 0);
      if (total === 0) total = 1;

      var cumulative = 0;
      var segments = data.map(function (d) {
        var pct = (d.value / total) * 100;
        var segment = { label: d.label, value: d.value, color: d.color || '#0052cc', offset: cumulative, percent: pct };
        cumulative += pct;
        return segment;
      });

      var gradient = segments.map(function (s) {
        return s.color + ' ' + s.offset.toFixed(2) + '% ' + (s.offset + s.percent).toFixed(2) + '%';
      }).join(', ');

      var legend = segments.map(function (s) {
        return '<span class="donut-legend-item"><i style="background:' + s.color + '"></i>' + _esc(s.label) + ': ' + s.value + '</span>';
      }).join('');

      container.innerHTML =
        '<div class="simple-chart donut-chart">' +
          (options.title ? '<h3 class="chart-title">' + _esc(options.title) + '</h3>' : '') +
          '<div class="donut-wrap">' +
            '<div class="donut" style="background:conic-gradient(' + gradient + ')">' +
              '<div class="donut-hole">' + total + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="chart-legend">' + legend + '</div>' +
        '</div>';
    },
  };

  /* HTML-escape helper */
  function _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* Inject default chart styles once */
  (function injectStyles() {
    if (document.getElementById('globex-chart-styles')) return;
    var style = document.createElement('style');
    style.id = 'globex-chart-styles';
    style.textContent = [
      '.simple-chart{font-family:Inter,sans-serif}',
      '.chart-title{font-size:.95rem;font-weight:700;margin-bottom:12px;font-family:Poppins,sans-serif}',
      '.bar-chart .chart-bars{display:flex;align-items:flex-end;gap:6px;height:160px;padding-bottom:4px}',
      '.bar-chart .chart-bar-wrapper{display:flex;flex-direction:column;align-items:center;flex:1}',
      '.bar-chart .chart-bar{width:100%;border-radius:4px 4px 0 0;position:relative;min-height:4px;transition:opacity .2s}',
      '.bar-chart .chart-bar:hover{opacity:.85}',
      '.bar-chart .chart-value{position:absolute;top:-20px;left:50%;transform:translateX(-50%);font-size:11px;font-weight:600;white-space:nowrap}',
      '.bar-chart .chart-label{font-size:11px;color:#64748b;margin-top:6px;text-align:center}',
      '.line-chart svg{display:block}',
      '.line-chart .chart-x-labels{display:flex;justify-content:space-between;margin-top:4px}',
      '.line-chart .chart-x-labels span{font-size:11px;color:#64748b}',
      '.donut-chart .donut-wrap{display:flex;justify-content:center;margin:12px 0}',
      '.donut-chart .donut{width:160px;height:160px;border-radius:50%;position:relative}',
      '.donut-chart .donut-hole{position:absolute;inset:25%;background:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;font-family:Poppins,sans-serif}',
      '.chart-legend{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}',
      '.donut-legend-item{display:flex;align-items:center;gap:5px;font-size:12px;color:#374151}',
      '.donut-legend-item i{display:inline-block;width:10px;height:10px;border-radius:2px;flex-shrink:0}',
    ].join('');
    document.head.appendChild(style);
  }());

  window.SimpleChart = SimpleChart;
}());
