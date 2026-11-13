/**
 * The report page's stylesheet and its one small script (filters, theme
 * toggle, crosshair and per-mark tooltips). Both are plain strings, inlined
 * into `report.html`; nothing is fetched.
 */
import { themeCss } from './palette.ts';

const CSS = `
* { box-sizing: border-box; }
html { background: var(--page); }
body { margin: 0; }
.viz-root {
  background: var(--page); color: var(--ink-1);
  font: 14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif;
  padding: 24px 16px 64px; min-height: 100vh;
}
.wrap { max-width: 800px; margin: 0 auto; }
h1 { font-size: 22px; margin: 0 0 4px; font-weight: 600; }
h2 { font-size: 16px; margin: 0; font-weight: 600; }
h3 { font-size: 13px; margin: 12px 0 0; font-weight: 600; color: var(--ink-2); }
.meta, .sub { color: var(--ink-2); margin: 0; }
.sub { font-size: 13px; margin-top: 2px; }
.filters {
  position: sticky; top: 0; z-index: 2; display: flex; flex-wrap: wrap; gap: 12px;
  padding: 10px 0; margin: 16px 0; background: var(--page); border-bottom: 1px solid var(--grid);
}
.filters label { display: flex; flex-direction: column; font-size: 12px; color: var(--ink-2); gap: 2px; }
.filters select {
  font: inherit; font-size: 13px; color: var(--ink-1); background: var(--surface);
  border: 1px solid var(--border); border-radius: 6px; padding: 4px 8px;
}
.card {
  background: var(--surface); border: 1px solid var(--border); border-radius: 10px;
  padding: 16px; margin: 0 0 16px;
}
.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; }
.tile { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; }
.tile .k { font-size: 12px; color: var(--ink-2); }
.tile .v { font-size: 24px; font-weight: 600; margin: 2px 0; }
.tile .s { font-size: 12px; color: var(--ink-2); display: flex; gap: 4px; align-items: center; }
.icon-good { color: var(--good); font-weight: 700; }
.icon-bad { color: var(--critical); font-weight: 700; }
.plot { position: relative; margin-top: 8px; }
.legend { list-style: none; display: flex; flex-wrap: wrap; gap: 4px 14px; padding: 0; margin: 10px 0 0; font-size: 12px; color: var(--ink-2); }
.legend li { display: flex; align-items: center; gap: 6px; }
.key { width: 12px; height: 12px; }
.key-line { width: 24px; }
.key line { stroke-width: 2; }
.viz-svg { width: 100%; height: auto; display: block; font: 11px system-ui, -apple-system, "Segoe UI", sans-serif; overflow: visible; }
.viz-svg .grid { stroke: var(--grid); stroke-width: 1; }
.viz-svg .axis { stroke: var(--axis); stroke-width: 1; }
.viz-svg .tick { fill: var(--muted); font-variant-numeric: tabular-nums; }
.viz-svg .axis-title, .viz-svg .label { fill: var(--ink-2); }
.viz-svg .empty, .viz-svg .missing { fill: var(--muted); }
.viz-svg .line { fill: none; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
.viz-svg .band { opacity: 0.12; stroke: none; }
.viz-svg .area { opacity: 0.8; stroke: none; }
.viz-svg .area-gap { fill: none; stroke: var(--surface); stroke-width: 2; }
.viz-svg .range { stroke-width: 2; stroke-linecap: round; }
.viz-svg .ring { stroke: var(--surface); stroke-width: 2; }
.viz-svg .xhair { stroke: var(--ink-2); stroke-width: 1; pointer-events: none; }
.viz-svg .pt-focus { fill: none; stroke: var(--ink-1); stroke-width: 1.5; pointer-events: none; }
.viz-svg .hit { fill: transparent; cursor: crosshair; }
.viz-svg .mark-hit { fill: transparent; outline: none; }
.viz-svg .mark-hit:hover, .viz-svg .mark-hit:focus { fill: var(--ink-1); fill-opacity: 0.06; }
.viz-svg .cell-empty { fill: none; stroke: var(--grid); }
.viz-svg .cell-v { font-variant-numeric: tabular-nums; fill: #ffffff; }
.viz-svg .cell-v.v1, .viz-svg .cell-v.v2 { fill: #0b0b0b; }
:root[data-theme="dark"] .viz-svg .cell-v { fill: #ffffff; }
:root[data-theme="dark"] .viz-svg .cell-v.v4, :root[data-theme="dark"] .viz-svg .cell-v.v5 { fill: #0b0b0b; }
@media (prefers-color-scheme: dark) {
  :root:where(:not([data-theme="light"])) .viz-svg .cell-v { fill: #ffffff; }
  :root:where(:not([data-theme="light"])) .viz-svg .cell-v.v4,
  :root:where(:not([data-theme="light"])) .viz-svg .cell-v.v5 { fill: #0b0b0b; }
}
.viz-svg:focus-visible { outline: 2px solid var(--s1); outline-offset: 2px; }
details { margin-top: 10px; font-size: 13px; }
summary { cursor: pointer; color: var(--ink-2); }
table { border-collapse: collapse; margin-top: 8px; width: 100%; font-size: 12px; }
th, td { text-align: right; padding: 3px 8px; border-bottom: 1px solid var(--grid); font-variant-numeric: tabular-nums; }
th:first-child, td:first-child { text-align: left; }
th { color: var(--ink-2); font-weight: 600; }
.tables-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 640px) { .tables-2 { grid-template-columns: 1fr; } }
#tip {
  position: fixed; z-index: 10; pointer-events: none; max-width: 280px;
  background: var(--surface); color: var(--ink-1); border: 1px solid var(--border);
  border-radius: 8px; padding: 8px 10px; font-size: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.12);
}
#tip .h { color: var(--ink-2); margin-bottom: 4px; }
#tip .r { display: flex; align-items: center; gap: 6px; }
#tip .r b { font-weight: 600; font-variant-numeric: tabular-nums; }
#tip .r span { color: var(--ink-2); }
#tip svg { width: 16px; height: 8px; flex: none; }
[hidden] { display: none !important; }
@media print { .filters { position: static; } }
`;

/** The page CSS: theme tokens (light + dark) and layout. */
export function pageCss(): string {
  return `${themeCss()}\n${CSS}`;
}

/**
 * The page script. Reads hover data from `#hover-data`, wires the filter row
 * (`[data-filter]` selects show/hide `[data-f-*]` blocks), the theme select
 * (also `#theme=dark` in the URL), crosshair tooltips on `.has-xhover` plots
 * and per-mark tooltips on `[data-tip]`. Text goes in with `textContent` only.
 */
export const PAGE_JS = `
(function () {
  var root = document.documentElement;
  var hover = JSON.parse(document.getElementById('hover-data').textContent || '{}');
  var tip = document.getElementById('tip');
  var state = {};
  var m = /theme=(light|dark)/.exec(location.hash);
  var themeSel = document.getElementById('theme');
  function setTheme(v) {
    if (v === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', v);
  }
  if (m) { setTheme(m[1]); themeSel.value = m[1]; }
  themeSel.addEventListener('change', function () { setTheme(themeSel.value); });
  function apply() {
    document.querySelectorAll('[data-filtered]').forEach(function (el) {
      var show = true;
      for (var k in el.dataset) {
        if (k.length > 1 && k.charAt(0) === 'f' && k.charAt(1) === k.charAt(1).toUpperCase() && k !== 'filtered') {
          var name = k.charAt(1).toLowerCase() + k.slice(2);
          if (state[name] !== undefined && state[name] !== el.dataset[k]) show = false;
        }
      }
      el.hidden = !show;
    });
  }
  document.querySelectorAll('[data-filter]').forEach(function (sel) {
    state[sel.dataset.filter] = sel.value;
    sel.addEventListener('change', function () { state[sel.dataset.filter] = sel.value; hideTip(); apply(); });
  });
  apply();

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  var keyTpl = document.getElementById('key-tpl');
  function key(color, dash) {
    var s = keyTpl.content.firstElementChild.cloneNode(true);
    var l = s.firstElementChild;
    l.style.stroke = color;
    if (dash) l.setAttribute('stroke-dasharray', dash);
    return s;
  }
  function row(value, label, color, dash) {
    var r = el('div', 'r');
    if (color) r.appendChild(key(color, dash));
    r.appendChild(el('b', '', value));
    if (label) r.appendChild(el('span', '', label));
    return r;
  }
  function place(x, y) {
    tip.hidden = false;
    var w = tip.offsetWidth, h = tip.offsetHeight;
    var left = x + 14, top = y + 14;
    if (left + w > window.innerWidth - 8) left = x - w - 14;
    if (top + h > window.innerHeight - 8) top = y - h - 14;
    tip.style.left = Math.max(8, left) + 'px';
    tip.style.top = Math.max(8, top) + 'px';
  }
  function hideTip() {
    tip.hidden = true;
    document.querySelectorAll('.xhair').forEach(function (l) { l.setAttribute('visibility', 'hidden'); });
  }
  function showLines(lines, x, y) {
    tip.textContent = '';
    tip.appendChild(el('div', 'h', lines[0]));
    lines.slice(1).forEach(function (line) {
      var i = line.indexOf('  ');
      tip.appendChild(i < 0 ? row(line, '') : row(line.slice(0, i), line.slice(i + 2)));
    });
    place(x, y);
  }

  // Crosshair: snap to the nearest x, list every series there.
  document.querySelectorAll('.plot[data-hover]').forEach(function (plot) {
    var h = hover[plot.dataset.hover];
    var svg = plot.querySelector('svg');
    if (!h || !svg || !h.xs || !h.xs.length) return;
    var line = svg.querySelector('.xhair');
    var vbw = svg.viewBox.baseVal.width;
    var idx = 0;
    svg.setAttribute('tabindex', '0');
    function show(i, cx, cy) {
      idx = Math.max(0, Math.min(h.xs.length - 1, i));
      line.setAttribute('x1', h.xs[idx]); line.setAttribute('x2', h.xs[idx]);
      line.setAttribute('visibility', 'visible');
      tip.textContent = '';
      tip.appendChild(el('div', 'h', h.labels[idx]));
      h.rows.forEach(function (r) { tip.appendChild(row(r.values[idx], r.label, r.color, r.dash)); });
      place(cx, cy);
    }
    function nearest(vx) {
      var best = 0;
      for (var i = 1; i < h.xs.length; i++) if (Math.abs(h.xs[i] - vx) < Math.abs(h.xs[best] - vx)) best = i;
      return best;
    }
    svg.addEventListener('pointermove', function (e) {
      var r = svg.getBoundingClientRect();
      show(nearest((e.clientX - r.left) * vbw / r.width), e.clientX, e.clientY);
    });
    svg.addEventListener('pointerleave', hideTip);
    function atLine() {
      var r = svg.getBoundingClientRect();
      return [r.left + h.xs[idx] * r.width / vbw, r.top + h.top * r.height / svg.viewBox.baseVal.height];
    }
    svg.addEventListener('focus', function () { var p = atLine(); show(idx, p[0], p[1]); });
    svg.addEventListener('blur', hideTip);
    svg.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      idx = Math.max(0, Math.min(h.xs.length - 1, idx + d));
      var p = atLine(); show(idx, p[0], p[1]);
    });
  });

  // Dot charts: nearest point within 24px; arrow keys step through the dots.
  document.querySelectorAll('.plot[data-hover]').forEach(function (plot) {
    var h = hover[plot.dataset.hover];
    var svg = plot.querySelector('svg');
    if (!h || !h.pts || !svg) return;
    var ring = svg.querySelector('.pt-focus');
    var vb = svg.viewBox.baseVal;
    var n = h.pts.length / 2;
    var idx = 0;
    svg.setAttribute('tabindex', '0');
    function screen(i) {
      var r = svg.getBoundingClientRect();
      return [r.left + h.pts[2 * i] * r.width / vb.width, r.top + h.pts[2 * i + 1] * r.height / vb.height];
    }
    function show(i) {
      idx = i;
      ring.setAttribute('cx', h.pts[2 * i]); ring.setAttribute('cy', h.pts[2 * i + 1]);
      ring.setAttribute('visibility', 'visible');
      var p = screen(i);
      showLines(h.tips[i], p[0], p[1]);
    }
    function hide() { ring.setAttribute('visibility', 'hidden'); hideTip(); }
    svg.addEventListener('pointermove', function (e) {
      var r = svg.getBoundingClientRect();
      var x = (e.clientX - r.left) * vb.width / r.width, y = (e.clientY - r.top) * vb.height / r.height;
      var best = -1, bd = 24 * 24;
      for (var i = 0; i < n; i++) {
        var dx = h.pts[2 * i] - x, dy = h.pts[2 * i + 1] - y, d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = i; }
      }
      if (best < 0) hide(); else show(best);
    });
    svg.addEventListener('pointerleave', hide);
    svg.addEventListener('focus', function () { show(idx); });
    svg.addEventListener('blur', hide);
    svg.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      show((idx + d + n) % n);
    });
  });

  // Per-mark tooltips (bars, dots, cells): hover and keyboard focus.
  function tipFor(t) { return t && t.closest ? t.closest('[data-tip]') : null; }
  document.addEventListener('pointerover', function (e) {
    var t = tipFor(e.target);
    if (t) showLines(t.getAttribute('data-tip').split('\\n'), e.clientX, e.clientY);
  });
  document.addEventListener('pointerout', function (e) { if (tipFor(e.target)) hideTip(); });
  document.addEventListener('focusin', function (e) {
    var t = tipFor(e.target);
    if (!t) return;
    var r = t.getBoundingClientRect();
    showLines(t.getAttribute('data-tip').split('\\n'), r.left + r.width / 2, r.top);
  });
  document.addEventListener('focusout', function (e) { if (tipFor(e.target)) hideTip(); });
})();
`;
