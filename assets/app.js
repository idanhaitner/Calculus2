/* ================= figure engine =================
   Every <figure class="fig" data-fig="NAME"> is drawn by FIGS.NAME(fig, ui).
   Each figure draws a fixed default state on load, so the print/PDF version is a clean static figure;
   the controls (.ctrls) are hidden in print. */
var SVGNS = "http://www.w3.org/2000/svg";
var FIGS = {};
function mk(tag, attrs, parent, ns) {
  var e = ns === false ? document.createElement(tag) : document.createElementNS(SVGNS, tag);
  if (attrs) for (var k in attrs) { if (attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, attrs[k]); }
  if (parent) parent.appendChild(e);
  return e;
}
function fmt(v, d) { if (!isFinite(v)) return v > 0 ? "∞" : "−∞"; d = d === undefined ? 3 : d; var s = (+v).toFixed(d); s = s.replace(/\.?0+$/, ""); return s === "-0" ? "0" : s.replace("-", "−"); }
/* SVG text with correct bidi: Hebrew strings run RTL, math runs LTR. "anchor" is geometric (start = left edge at x). */
var HEB = /[\u0590-\u05FF]/;
function svgText(parent, x, y, s, cls, anchor) {
  var rtl = HEB.test(s); anchor = anchor || "middle";
  if (rtl && anchor !== "middle") anchor = anchor === "start" ? "end" : "start";
  var t = mk("text", { x: x, y: y, "class": cls, "text-anchor": anchor, direction: rtl ? "rtl" : "ltr" }, parent);
  t.textContent = s; return t;
}
function cssv(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function linspace(a, b, n) { var r = []; for (var i = 0; i <= n; i++) r.push(a + (b - a) * i / n); return r; }

/* 2D plot in math coordinates */
function Plot(parent, o) {
  o = o || {};
  this.W = o.w || 640; this.H = o.h || 320;
  var p = o.pad || [24, 24, 30, 30]; // top right bottom left
  this.x0 = o.x[0]; this.x1 = o.x[1]; this.y0 = o.y[0]; this.y1 = o.y[1];
  this.L = p[3]; this.R = this.W - p[1]; this.T = p[0]; this.B = this.H - p[2];
  if (o.equal) { // equal aspect: shrink one direction
    var sx = (this.R - this.L) / (this.x1 - this.x0), sy = (this.B - this.T) / (this.y1 - this.y0), s = Math.min(sx, sy);
    var cx = (this.L + this.R) / 2, cy = (this.T + this.B) / 2;
    this.L = cx - s * (this.x1 - this.x0) / 2; this.R = cx + s * (this.x1 - this.x0) / 2;
    this.T = cy - s * (this.y1 - this.y0) / 2; this.B = cy + s * (this.y1 - this.y0) / 2;
  }
  this.svg = mk("svg", { viewBox: "0 0 " + this.W + " " + this.H, width: this.W, height: this.H, "class": "fsvg", role: "img" }, parent);
  if (o.label) this.svg.setAttribute("aria-label", o.label);
  this.g = this.svg;
}
Plot.prototype.X = function (x) { return this.L + (x - this.x0) / (this.x1 - this.x0) * (this.R - this.L); };
Plot.prototype.Y = function (y) { return this.B - (y - this.y0) / (this.y1 - this.y0) * (this.B - this.T); };
Plot.prototype.layer = function () { this.g = mk("g", null, this.svg); return this.g; };
Plot.prototype.clear = function (g) { g = g || this.g; while (g.firstChild) g.removeChild(g.firstChild); };
Plot.prototype.d = function (pts) { var self = this; return pts.map(function (q, i) { return (i ? "L" : "M") + self.X(q[0]).toFixed(1) + " " + self.Y(q[1]).toFixed(1); }).join(""); };
Plot.prototype.path = function (pts, cls, close) { return mk("path", { d: this.d(pts) + (close ? "Z" : ""), "class": cls || "kt nf w2" }, this.g); };
Plot.prototype.fn = function (f, a, b, cls, n) {
  n = n || 240; var pts = [], seg = [], self = this, out = [];
  for (var i = 0; i <= n; i++) { var x = a + (b - a) * i / n, y = f(x);
    if (isFinite(y) && y > self.y0 - 3 * (self.y1 - self.y0) && y < self.y1 + 3 * (self.y1 - self.y0)) seg.push([x, y]);
    else { if (seg.length > 1) out.push(seg); seg = []; } }
  if (seg.length > 1) out.push(seg);
  out.forEach(function (s) { self.path(s, cls || "k1 nf w3"); });
};
Plot.prototype.param = function (fx, fy, a, b, cls, n) { n = n || 240; var pts = []; for (var i = 0; i <= n; i++) { var t = a + (b - a) * i / n; pts.push([fx(t), fy(t)]); } return this.path(pts, cls || "k1 nf w3"); };
Plot.prototype.area = function (f, a, b, cls, g, n) { // between f and g (default 0)
  n = n || 160; var top = [], bot = [];
  for (var i = 0; i <= n; i++) { var x = a + (b - a) * i / n; top.push([x, f(x)]); bot.push([x, g ? g(x) : 0]); }
  return this.path(top.concat(bot.reverse()), cls || "f1", true);
};
Plot.prototype.rect = function (xa, ya, xb, yb, cls) { return mk("rect", { x: Math.min(this.X(xa), this.X(xb)), y: Math.min(this.Y(ya), this.Y(yb)), width: Math.abs(this.X(xb) - this.X(xa)), height: Math.abs(this.Y(yb) - this.Y(ya)), "class": cls || "f1 k1 w1" }, this.g); };
Plot.prototype.seg = function (xa, ya, xb, yb, cls) { return mk("line", { x1: this.X(xa), y1: this.Y(ya), x2: this.X(xb), y2: this.Y(yb), "class": cls || "kt w1" }, this.g); };
Plot.prototype.dot = function (x, y, cls, r) { return mk("circle", { cx: this.X(x), cy: this.Y(y), r: r || 4, "class": cls || "F1" }, this.g); };
Plot.prototype.ring = function (x, y, cls, r) { return mk("circle", { cx: this.X(x), cy: this.Y(y), r: r || 4, "class": (cls || "k1") + " Fs w2" }, this.g); };
Plot.prototype.circle = function (x, y, rr, cls) { return mk("ellipse", { cx: this.X(x), cy: this.Y(y), rx: Math.abs(this.X(x + rr) - this.X(x)), ry: Math.abs(this.Y(y + rr) - this.Y(y)), "class": cls || "k1 nf w2" }, this.g); };
Plot.prototype.text = function (x, y, s, cls, dx, dy, anchor) {
  return svgText(this.g, this.X(x) + (dx || 0), this.Y(y) + (dy || 0), s, cls === undefined ? "m" : cls, anchor);
};
Plot.prototype.ptext = function (px, py, s, cls, anchor) { return svgText(this.g, px, py, s, cls === undefined ? "m" : cls, anchor); };
Plot.prototype.arrow = function (xa, ya, xb, yb, cls, head) {
  head = head || 9; var X1 = this.X(xa), Y1 = this.Y(ya), X2 = this.X(xb), Y2 = this.Y(yb);
  return arrowPx(this.g, X1, Y1, X2, Y2, cls, head);
};
function arrowPx(g, X1, Y1, X2, Y2, cls, head) {
  head = head || 9; cls = cls || "kt"; var a = Math.atan2(Y2 - Y1, X2 - X1), L = Math.hypot(X2 - X1, Y2 - Y1);
  var h = Math.min(head, L * 0.45);
  var bx = X2 - h * Math.cos(a), by = Y2 - h * Math.sin(a);
  var grp = mk("g", null, g);
  mk("line", { x1: X1, y1: Y1, x2: bx, y2: by, "class": cls + " w2" }, grp);
  var w = h * 0.5;
  mk("path", { d: "M" + X2 + " " + Y2 + "L" + (bx + w * Math.sin(a)) + " " + (by - w * Math.cos(a)) + "L" + (bx - w * Math.sin(a)) + " " + (by + w * Math.cos(a)) + "Z", "class": cls.replace(/k(\w)/, "F$1") + " " }, grp)
    .setAttribute("style", "stroke:none");
  return grp;
}
Plot.prototype.axes = function (o) {
  o = o || {}; var g = this.g;
  var yAt = o.yAt !== undefined ? o.yAt : clamp(0, this.x0, this.x1), xAt = o.xAt !== undefined ? o.xAt : clamp(0, this.y0, this.y1);
  if (o.grid) { var s = o.grid; for (var gx = Math.ceil(this.x0 / s) * s; gx <= this.x1 + 1e-9; gx += s) this.seg(gx, this.y0, gx, this.y1, "gr"); for (var gy = Math.ceil(this.y0 / s) * s; gy <= this.y1 + 1e-9; gy += s) this.seg(this.x0, gy, this.x1, gy, "gr"); }
  arrowPx(g, this.L - 4, this.Y(xAt), this.R + 6, this.Y(xAt), "km", 8);
  arrowPx(g, this.X(yAt), this.B + 4, this.X(yAt), this.T - 8, "km", 8);
  this.ptext(this.R + 6, this.Y(xAt) + 18, o.xl || "x", "m mut", "end");
  this.ptext(this.X(yAt) + 12, this.T - 2, o.yl || "y", "m mut", "start");
  var self = this;
  (o.xt || []).forEach(function (t) { var v = t[0] !== undefined ? t[0] : t, lab = t[1] !== undefined ? t[1] : fmt(t); self.seg(v, xAt, v, xAt, "km"); mk("line", { x1: self.X(v), x2: self.X(v), y1: self.Y(xAt) - 4, y2: self.Y(xAt) + 4, "class": "km w1" }, g); self.ptext(self.X(v), self.Y(xAt) + 18, lab, "m sm"); });
  (o.yt || []).forEach(function (t) { var v = t[0] !== undefined ? t[0] : t, lab = t[1] !== undefined ? t[1] : fmt(t); mk("line", { x1: self.X(yAt) - 4, x2: self.X(yAt) + 4, y1: self.Y(v), y2: self.Y(v), "class": "km w1" }, g); self.ptext(self.X(yAt) - 8, self.Y(v) + 4, lab, "m sm", "end"); });
};

/* ---------- UI helpers ---------- */
function UI(fig) { this.fig = fig; this.body = mk("div", { "class": "fig-body" }, null, false); this.ctrls = null; var cap = fig.querySelector("figcaption"); fig.insertBefore(this.body, cap); this.cap = cap; }
UI.prototype.c = function () { if (!this.ctrls) { this.ctrls = mk("div", { "class": "ctrls" }, null, false); this.fig.insertBefore(this.ctrls, this.cap); } return this.ctrls; };
UI.prototype.range = function (label, min, max, step, val, cb) {
  var l = mk("label", null, this.c(), false); l.appendChild(document.createTextNode(label));
  var r = mk("input", { type: "range", min: min, max: max, step: step, value: val }, l, false);
  var vb = mk("b", { "class": "rv" }, l, false); var dg = String(step).indexOf(".") < 0 ? 0 : String(step).split(".")[1].length;
  function show() { vb.textContent = fmt(parseFloat(r.value), dg); }
  r.addEventListener("input", function () { show(); cb(parseFloat(r.value)); });
  var desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  Object.defineProperty(r, "value", { get: function () { return desc.get.call(r); }, set: function (v) { desc.set.call(r, v); show(); } });
  show(); return r;
};
UI.prototype.seg = function (label, opts, val, cb) {
  var w = mk("span", { style: "display:inline-flex;align-items:center;gap:8px;font-weight:600" }, this.c(), false);
  if (label) w.appendChild(document.createTextNode(label));
  var s = mk("span", { "class": "seg" }, w, false), bs = [];
  opts.forEach(function (o) { var b = mk("button", { type: "button" }, s, false); b.textContent = o[1]; if (o[0] === val) b.className = "on";
    b.addEventListener("click", function () { bs.forEach(function (x) { x.className = ""; }); b.className = "on"; cb(o[0]); }); bs.push(b); });
  return s;
};
UI.prototype.readout = function () { return mk("span", { "class": "ro" }, this.c(), false); };
UI.prototype.play = function (label, step, ms) { // step() returns false to stop
  var b = mk("button", { type: "button", "class": "play" }, this.c(), false), t = null; b.textContent = "▶ " + label;
  function stop() { clearInterval(t); t = null; b.textContent = "▶ " + label; }
  b.addEventListener("click", function () {
    if (t) { stop(); return; }
    b.textContent = "❚❚ עצור"; t = setInterval(function () { if (step() === false) stop(); }, ms || 60);
  });
  return b;
};

/* ---------- marching squares: segments of f(x,y)=c ---------- */
function contour(f, xr, yr, N, c) {
  var segs = [], dx = (xr[1] - xr[0]) / N, dy = (yr[1] - yr[0]) / N, v = [];
  for (var i = 0; i <= N; i++) { v[i] = []; for (var j = 0; j <= N; j++) v[i][j] = f(xr[0] + i * dx, yr[0] + j * dy) - c; }
  function ip(x1, y1, a, x2, y2, b) { var t = a / (a - b); return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)]; }
  for (i = 0; i < N; i++) for (j = 0; j < N; j++) {
    var x = xr[0] + i * dx, y = yr[0] + j * dy;
    var a = v[i][j], b = v[i + 1][j], cc = v[i + 1][j + 1], d = v[i][j + 1];
    if (!isFinite(a + b + cc + d)) continue;
    var P = [];
    if ((a > 0) !== (b > 0)) P.push(ip(x, y, a, x + dx, y, b));
    if ((b > 0) !== (cc > 0)) P.push(ip(x + dx, y, b, x + dx, y + dy, cc));
    if ((cc > 0) !== (d > 0)) P.push(ip(x + dx, y + dy, cc, x, y + dy, d));
    if ((d > 0) !== (a > 0)) P.push(ip(x, y + dy, d, x, y, a));
    if (P.length === 2) segs.push([P[0], P[1]]);
    else if (P.length === 4) { segs.push([P[0], P[1]]); segs.push([P[2], P[3]]); }
  }
  return segs;
}
Plot.prototype.contour = function (f, c, cls, N) { var self = this, d = ""; contour(f, [this.x0, this.x1], [this.y0, this.y1], N || 70, c).forEach(function (s) { d += "M" + self.X(s[0][0]).toFixed(1) + " " + self.Y(s[0][1]).toFixed(1) + "L" + self.X(s[1][0]).toFixed(1) + " " + self.Y(s[1][1]).toFixed(1); }); return mk("path", { d: d, "class": cls || "k1 nf w2" }, this.g); };

/* ---------- 3D surface on canvas (orthographic, drag to rotate) ---------- */
function Surface(parent, o) {
  var self = this; this.o = o;
  this.Wc = o.w || 420; this.Hc = o.h || 330; var dpr = 2;
  this.cv = mk("canvas", { width: this.Wc * dpr, height: this.Hc * dpr, style: "width:" + this.Wc + "px", role: "img", "aria-label": o.label || "משטח תלת־ממדי" }, parent, false);
  this.ctx = this.cv.getContext("2d"); this.ctx.scale(dpr, dpr);
  this.az = o.az !== undefined ? o.az : -0.75; this.el = o.el !== undefined ? o.el : 0.55;
  var drag = null;
  this.cv.addEventListener("pointerdown", function (e) { drag = [e.clientX, e.clientY, self.az, self.el]; self.cv.setPointerCapture(e.pointerId); });
  this.cv.addEventListener("pointermove", function (e) { if (!drag) return; self.az = drag[2] - (e.clientX - drag[0]) * 0.01; self.el = clamp(drag[3] + (e.clientY - drag[1]) * 0.01, -0.2, 1.45); self.draw(); });
  this.cv.addEventListener("pointerup", function () { drag = null; });
  if (o.hint !== false) { var h = mk("div", { "class": "hint3d" }, parent, false); h.textContent = "גררו את המשטח כדי לסובב אותו"; }
  SURFACES.push(this);
}
var SURFACES = [];
Surface.prototype.proj = function (x, y, z) {
  var o = this.o, s = o.scale || 70, zs = o.zs || 1;
  var ca = Math.cos(this.az), sa = Math.sin(this.az), ce = Math.cos(this.el), se = Math.sin(this.el);
  var X = x * ca - y * sa, Y = x * sa + y * ca;   // rotate about z
  var depth = Y * ce - z * zs * se;               // larger = farther... (towards viewer is negative Y)
  var sy = z * zs * ce + Y * se;
  return [this.Wc / 2 + X * s, this.Hc * (o.cy || 0.56) - sy * s, depth];
};
Surface.prototype.draw = function () {
  var o = this.o, ctx = this.ctx, self = this, N = o.n || 26, xr = o.xr, yr = o.yr, f = o.f;
  ctx.clearRect(0, 0, this.Wc, this.Hc);
  var zmin = o.zr ? o.zr[0] : Infinity, zmax = o.zr ? o.zr[1] : -Infinity, G = [];
  for (var i = 0; i <= N; i++) { G[i] = []; for (var j = 0; j <= N; j++) { var x = xr[0] + (xr[1] - xr[0]) * i / N, y = yr[0] + (yr[1] - yr[0]) * j / N, z = f(x, y);
    if (o.clip) z = clamp(z, o.clip[0], o.clip[1]);
    if (o.mask && !o.mask(x, y)) z = NaN;
    G[i][j] = [x, y, z]; if (!o.zr && isFinite(z)) { zmin = Math.min(zmin, z); zmax = Math.max(zmax, z); } } }
  var c1 = cssv("--c1"), c2 = cssv("--c2"), c3 = cssv("--c3"), line = cssv("--surface"), axc = cssv("--muted");
  function hex(c) { var m = c.match(/^#(..)(..)(..)$/); return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [120, 100, 200]; }
  var A = hex(c2), B = hex(c1), C = hex(c3);
  function col(t, shade) { t = clamp(t, 0, 1); var u = t < .5 ? t * 2 : (t - .5) * 2, P = t < .5 ? A : B, Q = t < .5 ? B : C;
    var r = P[0] + (Q[0] - P[0]) * u, g = P[1] + (Q[1] - P[1]) * u, b = P[2] + (Q[2] - P[2]) * u; shade = shade || 1;
    return "rgba(" + (r * shade | 0) + "," + (g * shade | 0) + "," + (b * shade | 0) + "," + (o.alpha || 0.92) + ")"; }
  // axes
  if (o.axes !== false) {
    var ax = o.axlen || [xr[1] * 1.25, yr[1] * 1.25, (o.zr ? o.zr[1] : zmax) * 1.2];
    var O = this.proj(0, 0, 0);
    [[ax[0], 0, 0, "x"], [0, ax[1], 0, "y"], [0, 0, ax[2], "z"]].forEach(function (a) { var P = self.proj(a[0], a[1], a[2]);
      ctx.strokeStyle = axc; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(O[0], O[1]); ctx.lineTo(P[0], P[1]); ctx.stroke();
      ctx.fillStyle = axc; ctx.font = "italic 15px Times New Roman"; ctx.direction = "ltr"; ctx.fillText(a[3], P[0] + 4, P[1] - 4); });
  }
  var quads = [];
  for (i = 0; i < N; i++) for (j = 0; j < N; j++) {
    var q = [G[i][j], G[i + 1][j], G[i + 1][j + 1], G[i][j + 1]];
    if (q.some(function (p) { return !isFinite(p[2]); })) continue;
    var pp = q.map(function (p) { return self.proj(p[0], p[1], p[2]); });
    var zc = (q[0][2] + q[1][2] + q[2][2] + q[3][2]) / 4;
    // simple light: normal from cross product
    var ux = q[1][0] - q[0][0], uy = q[1][1] - q[0][1], uz = (q[1][2] - q[0][2]) * (o.zs || 1), vx = q[3][0] - q[0][0], vy = q[3][1] - q[0][1], vz = (q[3][2] - q[0][2]) * (o.zs || 1);
    var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, nl = Math.hypot(nx, ny, nz) || 1;
    var sh = 0.72 + 0.28 * Math.abs(nz / nl);
    quads.push({ pp: pp, d: (pp[0][2] + pp[1][2] + pp[2][2] + pp[3][2]) / 4, c: col((zc - zmin) / ((zmax - zmin) || 1), sh) });
  }
  quads.sort(function (a, b) { return b.d - a.d; });
  quads.forEach(function (q) { ctx.beginPath(); ctx.moveTo(q.pp[0][0], q.pp[0][1]); for (var k = 1; k < 4; k++) ctx.lineTo(q.pp[k][0], q.pp[k][1]); ctx.closePath();
    ctx.fillStyle = q.c; ctx.fill(); ctx.strokeStyle = line; ctx.globalAlpha = 0.35; ctx.lineWidth = 0.6; ctx.stroke(); ctx.globalAlpha = 1; });
  if (o.extra) o.extra(this, ctx);
};
Surface.prototype.line3 = function (pts, color, w, dash) { var ctx = this.ctx, self = this; ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = w || 2.5; if (dash) ctx.setLineDash(dash); ctx.beginPath();
  pts.forEach(function (p, i) { var P = self.proj(p[0], p[1], p[2]); if (i) ctx.lineTo(P[0], P[1]); else ctx.moveTo(P[0], P[1]); }); ctx.stroke(); ctx.restore(); };
Surface.prototype.segs3 = function (segs, z, color, w) { var ctx = this.ctx, self = this; ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = w || 2.5; ctx.beginPath();
  segs.forEach(function (s) { var A = self.proj(s[0][0], s[0][1], typeof z === "function" ? z(s[0][0], s[0][1]) : z), B = self.proj(s[1][0], s[1][1], typeof z === "function" ? z(s[1][0], s[1][1]) : z); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); }); ctx.stroke(); ctx.restore(); };
Surface.prototype.dot3 = function (x, y, z, color, r) { var P = this.proj(x, y, z), ctx = this.ctx; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(P[0], P[1], r || 4.5, 0, 7); ctx.fill(); };

/* ---------- 3D wire helper for SVG (static isometric-ish) ---------- */
function Iso(parent, o) {
  this.W = o.w || 420; this.H = o.h || 300; this.s = o.scale || 60; this.cx = o.cx || this.W / 2; this.cy = o.cy || this.H * 0.62;
  this.az = o.az !== undefined ? o.az : -0.7; this.el = o.el !== undefined ? o.el : 0.45;
  this.svg = mk("svg", { viewBox: "0 0 " + this.W + " " + this.H, width: this.W, height: this.H, "class": "fsvg", role: "img" }, parent); this.g = this.svg;
}
Iso.prototype.P = function (x, y, z) { var ca = Math.cos(this.az), sa = Math.sin(this.az), ce = Math.cos(this.el), se = Math.sin(this.el);
  var X = x * ca - y * sa, Y = x * sa + y * ca; return [this.cx + X * this.s, this.cy - (z * ce + Y * se) * this.s]; };
Iso.prototype.path = function (pts, cls, close) { var self = this; return mk("path", { d: pts.map(function (p, i) { var q = self.P(p[0], p[1], p[2]); return (i ? "L" : "M") + q[0].toFixed(1) + " " + q[1].toFixed(1); }).join("") + (close ? "Z" : ""), "class": cls || "kt nf w2" }, this.g); };
Iso.prototype.arrow = function (a, b, cls) { var A = this.P(a[0], a[1], a[2]), B = this.P(b[0], b[1], b[2]); return arrowPx(this.g, A[0], A[1], B[0], B[1], cls || "kt", 10); };
Iso.prototype.text = function (p, s, cls, dx, dy, anchor) { var q = this.P(p[0], p[1], p[2]); return svgText(this.g, q[0] + (dx || 0), q[1] + (dy || 0), s, cls === undefined ? "m" : cls, anchor); };
Iso.prototype.dot = function (p, cls, r) { var q = this.P(p[0], p[1], p[2]); return mk("circle", { cx: q[0], cy: q[1], r: r || 4, "class": cls || "F1" }, this.g); };
Iso.prototype.axes = function (L) { var self = this; L = L || [2.2, 2.2, 2]; [[L[0], 0, 0, "x"], [0, L[1], 0, "y"], [0, 0, L[2], "z"]].forEach(function (a) { self.arrow([0, 0, 0], [a[0], a[1], a[2]], "km"); self.text([a[0], a[1], a[2]], a[3], "m mut", 8, -4); }); };

/* ---------- flow diagrams (boxes + arrows, pixel coordinates) ---------- */
function Flow(parent, w, h, label) { this.svg = mk("svg", { viewBox: "0 0 " + w + " " + h, width: w, height: h, "class": "fsvg", role: "img", "aria-label": label || "" }, parent); this.g = this.svg; }
Flow.prototype.box = function (x, y, w, h, lines, cls, href) {
  var par = this.g; if (href) { par = mk("a", { href: href }, this.g); }
  mk("rect", { x: x - w / 2, y: y - h / 2, width: w, height: h, rx: 10, "class": "node " + (cls || "") }, par);
  var n = lines.length; lines.forEach(function (s, i) { var str = typeof s === "object" ? s[0] : s, cl = typeof s === "object" ? s[1] : (HEB.test(s) ? "he" : "m");
    svgText(par, x, y + (i - (n - 1) / 2) * 19 + 5, str, cl, "middle"); });
  return { x: x, y: y, w: w, h: h };
};
Flow.prototype.link = function (a, b, cls, label, side) {
  // connect box a to box b, from nearest edges
  var x1 = a.x, y1 = a.y, x2 = b.x, y2 = b.y, dx = x2 - x1, dy = y2 - y1;
  var vertical = Math.abs(dy) * a.w > Math.abs(dx) * a.h;
  if (vertical) { y1 += Math.sign(dy) * a.h / 2; y2 -= Math.sign(dy) * b.h / 2; }
  else { x1 += Math.sign(dx) * a.w / 2; x2 -= Math.sign(dx) * b.w / 2; }
  arrowPx(this.g, x1, y1, x2, y2, cls || "km", 9);
  // horizontal arrow: label sits just above the line. Vertical arrow: the gap between boxes is short,
  // so the label goes beside the arrow, vertically centred in the gap (+5 centres the small font's glyph box in the gap; measured)
  if (label) svgText(this.g, (x1 + x2) / 2 + (side || 0), vertical ? (y1 + y2) / 2 + 5 : (y1 + y2) / 2 - 4, label, "he sm mut", "middle");
};
Flow.prototype.text = function (x, y, s, cls, anchor) { return svgText(this.g, x, y, s, cls || "he", anchor); };

/* ================= figures: course map + part A ================= */
FIGS.riemann = function (fig, ui) {
  var f = function (x) { return 1 + Math.sin(x) + x / 2; }, a = 0.3, b = 5;
  var P = new Plot(ui.body, { x: [0, 5.4], y: [0, 3.4], w: 640, h: 320, label: "סכומי רימן" });
  P.axes({ xt: [[a, "a"], [b, "b"]] });
  var Lr = P.layer(), Lc = P.layer();
  var exact = (function () { var F = function (x) { return x - Math.cos(x) + x * x / 4; }; return F(b) - F(a); })();
  var st = { n: 6, mode: "both" };
  function supinf(x0, x1) { var M = -1e9, m = 1e9; for (var k = 0; k <= 40; k++) { var v = f(x0 + (x1 - x0) * k / 40); M = Math.max(M, v); m = Math.min(m, v); } return [M, m]; }
  var ro;
  function draw() {
    P.clear(Lr); P.clear(Lc); P.g = Lr;
    var n = st.n, h = (b - a) / n, S = 0, U = 0, Lw = 0;
    for (var i = 0; i < n; i++) {
      var x0 = a + i * h, x1 = x0 + h, sm = supinf(x0, x1);
      U += sm[0] * h; Lw += sm[1] * h;
      if (st.mode === "both") { P.rect(x0, sm[1], x1, sm[0], "f3 k3 w1"); P.rect(x0, 0, x1, sm[1], "f1 k1 w1"); }
      else {
        var t = st.mode === "left" ? x0 : st.mode === "right" ? x1 : st.mode === "mid" ? (x0 + x1) / 2 : null;
        var y = t !== null ? f(t) : (st.mode === "upper" ? sm[0] : sm[1]);
        S += y * h; P.rect(x0, 0, x1, y, "f1 k1 w1");
        if (t !== null && n <= 40) { P.seg(t, 0, t, y, "k3 w1 dash"); P.dot(t, y, "F3", 3.2); }
      }
    }
    P.g = Lc; P.fn(f, 0.05, 5.3, "k1 nf w3");
    P.text(5.25, f(5.25), "y = f(x)", "m", -6, -10, "end");
    var names = { left: "קצה שמאלי", right: "קצה ימני", mid: "אמצע", upper: "סכום עליון", lower: "סכום תחתון" };
    ro.textContent = st.mode === "both"
      ? "L = " + fmt(Lw) + "   ≤   ∫ = " + fmt(exact) + "   ≤   U = " + fmt(U) + "     U − L = " + fmt(U - Lw)
      : "S = " + fmt(S) + "     ∫ = " + fmt(exact) + "     |S − ∫| = " + fmt(Math.abs(S - exact));
  }
  var r = ui.range("n =", 1, 60, 1, st.n, function (v) { st.n = v; draw(); });
  ui.seg("", [["both", "עליון+תחתון"], ["left", "שמאל"], ["mid", "אמצע"], ["right", "ימין"]], st.mode, function (m) { st.mode = m; draw(); });
  ui.play("הגדל את n", function () { if (st.n >= 60) { st.n = 1; } st.n++; r.value = st.n; draw(); return st.n < 60; }, 120);
  ro = ui.readout();
  draw();
};

FIGS.signedarea = function (fig, ui) {
  var P = new Plot(ui.body, { x: [-0.3, 6.9], y: [-1.35, 1.35], w: 600, h: 230 });
  P.area(Math.sin, 0, Math.PI, "f2"); P.area(Math.sin, Math.PI, 2 * Math.PI, "f4");
  P.axes({ xt: [[Math.PI, "π"], [2 * Math.PI, "2π"]] });
  P.fn(Math.sin, -0.2, 6.8, "k1 nf w3");
  P.text(Math.PI / 2, 0.45, "+2", "t2"); P.text(3 * Math.PI / 2, -0.45, "−2", "t4");
  P.text(Math.PI / 2, 0.15, "שטח נספר בפלוס", "he sm"); P.text(3 * Math.PI / 2, -0.75, "שטח נספר במינוס", "he sm");
};

FIGS.mvt = function (fig, ui) {
  var f = function (x) { return 1.2 + 0.7 * Math.sin(1.3 * x) + 0.18 * x; }, a = 0.5, b = 5;
  var n = 400, s = 0; for (var i = 0; i < n; i++) s += f(a + (i + .5) * (b - a) / n) * (b - a) / n;
  var avg = s / (b - a), c = a, best = 9; for (i = 0; i <= 600; i++) { var x = a + (b - a) * i / 600; if (Math.abs(f(x) - avg) < best) { best = Math.abs(f(x) - avg); c = x; } }
  var P = new Plot(ui.body, { x: [0, 5.5], y: [0, 2.6], w: 600, h: 260 });
  P.area(f, a, b, "f2");
  P.rect(a, 0, b, avg, "f1 k1 w2");
  P.axes({ xt: [[a, "a"], [c, "c"], [b, "b"]], yt: [[avg, "f(c)"]] });
  P.fn(f, 0.2, 5.3, "k2 nf w3");
  P.seg(c, 0, c, avg, "k3 w2 dash"); P.dot(c, avg, "F3", 5);
  P.text(b, f(b), "f", "m t2", 12, 0);
};

FIGS.ftc = function (fig, ui) {
  var f = function (t) { return 1.3 * Math.sin(1.1 * t) + 0.25; }, a = 0, b = 6.2, N = 620, Fv = [0];
  for (var i = 1; i <= N; i++) { var t0 = a + (b - a) * (i - 1) / N, t1 = a + (b - a) * i / N; Fv.push(Fv[i - 1] + (f(t0) + f(t1)) / 2 * (t1 - t0)); }
  function F(x) { var k = clamp(Math.round((x - a) / (b - a) * N), 0, N); return Fv[k]; }
  var top = new Plot(ui.body, { x: [-0.2, 6.5], y: [-1.3, 1.8], w: 620, h: 210, label: "f והשטח המצטבר" });
  var Ltop = top.layer(); top.g = top.svg; // area layer first, so it sits under the axes and the curve
  top.axes({ yl: "f(t)", xl: "t" }); top.fn(f, 0, 6.3, "k1 nf w3");
  var bot = new Plot(ui.body, { x: [-0.2, 6.5], y: [-0.4, 2.6], w: 620, h: 210, label: "הגרף של F" });
  bot.axes({ yl: "F(x)" }); bot.fn(F, 0, 6.2, "km nf w1 dash"); var Lbot = bot.layer();
  var st = { x: 2.2 }, ro;
  function draw() {
    var x = st.x;
    top.clear(Ltop); top.g = Ltop;
    // positive and negative parts of the accumulated area
    top.area(function (t) { return Math.max(f(t), 0); }, 0, x, "f2");
    top.area(function (t) { return Math.min(f(t), 0); }, 0, x, "f4");
    top.seg(x, 0, x, f(x), "k3 w3"); top.dot(x, f(x), "F3", 5); top.text(x, 0, "x", "m t3", 0, 18);
    bot.clear(Lbot); bot.g = Lbot;
    bot.fn(F, 0, x, "k2 nf w3");
    var s = f(x), d = 0.7; bot.seg(x - d, F(x) - s * d, x + d, F(x) + s * d, "k3 w2");
    bot.dot(x, F(x), "F3", 5); bot.seg(x, 0, x, F(x), "km w1 dot");
    ro.textContent = "F(x) = " + fmt(F(x), 2) + "      F′(x) = f(x) = " + fmt(s, 2);
  }
  var r = ui.range("x =", 0.05, 6.15, 0.01, st.x, function (v) { st.x = v; draw(); });
  ui.play("הזז את x", function () { st.x += 0.03; if (st.x > 6.15) { st.x = 0.05; } r.value = st.x; draw(); return true; }, 40);
  ro = ui.readout();
  draw();
};

FIGS.subst = function (fig, ui) {
  var g = function (x) { return 2 * x * Math.sin(x * x); }, x0 = 1.0, dx = 0.13;
  var L = new Plot(ui.body, { x: [-0.1, 2.0], y: [-0.4, 3.0], w: 330, h: 230, label: "לפני ההצבה" });
  L.area(g, 0, Math.sqrt(Math.PI), "f1"); L.area(g, x0, x0 + dx, "f3");
  L.axes({ xt: [[Math.sqrt(Math.PI), "√π"]], yl: "" }); L.fn(g, 0, 1.95, "k1 nf w3");
  L.text(1.0, 2.75, "2x·sin(x²)  ,  dx", "m"); L.text(0.95, 0.6, "= 2", "m t1");
  var R = new Plot(ui.body, { x: [-0.2, 3.6], y: [-0.4, 3.0], w: 330, h: 230, label: "אחרי ההצבה" });
  R.area(Math.sin, 0, Math.PI, "f2"); R.area(Math.sin, x0 * x0, (x0 + dx) * (x0 + dx), "f3");
  R.axes({ xt: [[Math.PI, "π"]], xl: "t", yl: "" }); R.fn(Math.sin, 0, 3.5, "k2 nf w3");
  R.text(1.7, 2.75, "sin t  ,  dt = 2x dx", "m"); R.text(1.57, 0.4, "= 2", "m t2");
};

FIGS.byparts = function (fig, ui) {
  var u = function (t) { return 1 + 2 * t; }, v = function (t) { return 1 + 1.6 * t * t; }, pts = [];
  for (var i = 0; i <= 80; i++) pts.push([u(i / 80), v(i / 80)]);
  var P = new Plot(ui.body, { x: [-0.3, 3.6], y: [-0.3, 3.1], w: 520, h: 330, equal: true });
  P.path(pts.concat([[3, 0], [1, 0]]), "f1 k1 w1", true);
  P.path(pts.concat([[0, 2.6], [0, 1]]), "f2 k2 w1", true);
  P.rect(0, 0, 1, 1, "f3 k3 w1");
  P.axes({ xl: "u", yl: "v", xt: [[1, "u(a)"], [3, "u(b)"]], yt: [[1, "v(a)"], [2.6, "v(b)"]] });
  P.seg(3, 0, 3, 2.6, "km w1 dash"); P.seg(0, 2.6, 3, 2.6, "km w1 dash");
  P.path(pts, "kt nf w3"); P.dot(1, 1, "Ft"); P.dot(3, 2.6, "Ft");
  P.text(2.1, 0.7, "∫ v du", "m t1"); P.text(0.75, 1.85, "∫ u dv", "m t2"); P.text(0.5, 0.45, "u(a)v(a)", "m sm");
};

FIGS.pftree = function (fig, ui) {
  var f = new Flow(ui.body, 720, 430, "תרשים שברים חלקיים");
  var a = f.box(360, 30, 200, 40, [["P(x) / Q(x)", "m"]], "a");
  var q = f.box(360, 100, 280, 44, ["מעלת המונה ≥ מעלת המכנה?"], "g");
  var d = f.box(610, 100, 180, 56, ["חילוק ארוך", ["M(x) + r(x)/Q(x)", "m sm"]], "");
  var fac = f.box(360, 182, 300, 44, ["מפרקים את המכנה לגורמים"], "a");
  f.link(a, q); f.link(q, d, "km", "כן"); f.link(q, fac, "km", "לא", 18);
  mk("path", { d: "M610 128 C610 182 570 182 512 182", "class": "km nf w2 dash" }, f.g);
  var b1 = f.box(120, 278, 210, 72, ["גורם לינארי", ["(x − α)", "m sm"], ["A / (x − α)", "m"]], "t");
  var b2 = f.box(360, 278, 220, 72, ["גורם לינארי חוזר", ["(x − α)ᵏ", "m sm"], ["B₁/(x−α) + … + Bₖ/(x−α)ᵏ", "m sm"]], "t");
  var b3 = f.box(600, 278, 220, 72, ["גורם ריבועי בלי שורשים", ["x² + px + q", "m sm"], ["(Ax + B)/(x² + px + q)", "m sm"]], "t");
  f.link(fac, b1); f.link(fac, b2); f.link(fac, b3);
  var r1 = f.box(120, 385, 200, 44, [["A·ln|x − α|", "m"]], "r");
  var r2 = f.box(360, 385, 200, 44, [["−B / ((k−1)(x−α)ᵏ⁻¹)", "m sm"]], "r");
  var r3 = f.box(600, 385, 220, 50, ["השלמה לריבוע", ["ln + arctan", "m sm"]], "r");
  f.link(b1, r1); f.link(b2, r2); f.link(b3, r3);
};

FIGS.trigsub = function (fig, ui) {
  var P = new Plot(ui.body, { x: [-1.35, 1.35], y: [-0.3, 1.3], w: 560, h: 300, equal: true });
  P.axes({ xt: [[-1, "−a"], [1, "a"]] });
  P.param(function (t) { return Math.cos(t); }, function (t) { return Math.sin(t); }, 0, Math.PI, "km nf w2");
  var L = P.layer(), st = { th: 0.6 }, ro;
  function draw() {
    P.clear(L); P.g = L; var th = st.th, x = Math.sin(th), h = Math.cos(th);
    P.path([[0, 0], [x, 0], [x, h]], "f1 k1 w2", true);
    P.seg(0, 0, x, h, "k1 w3");
    var s = 0.07 * Math.sign(x || 1); P.path([[x - s, 0], [x - s, 0.07], [x, 0.07]], "kt nf w1");
    P.text(x / 2, 0, "x = a·sin θ", "m t1", 0, 18);
    P.text(x, h / 2, "√(a² − x²) = a·cos θ", "m t2", x >= 0 ? 8 : -8, 4, x >= 0 ? "start" : "end");
    P.text(x / 2, h / 2, "a", "m", x >= 0 ? -10 : 10, -6);
    // angle θ at the top vertex, between the vertical leg and the hypotenuse
    var r = 0.16, a0 = -Math.PI / 2, a1 = -Math.PI / 2 - th, arc = [];
    for (var i = 0; i <= 20; i++) { var t = a0 + (a1 - a0) * i / 20; arc.push([x + r * Math.cos(t), h + r * Math.sin(t)]); }
    P.path(arc, "k3 nf w2"); P.text(x - 0.24 * Math.sin(th / 2) , h - 0.26, "θ", "m t3");
    P.dot(x, h, "F1", 5);
    ro.textContent = "θ = " + fmt(th, 2) + "   x/a = sin θ = " + fmt(x, 3) + "   √(a²−x²)/a = cos θ = " + fmt(h, 3);
  }
  ui.range("θ =", -1.45, 1.45, 0.01, st.th, function (v) { st.th = v; draw(); });
  ro = ui.readout(); draw();
};

FIGS.weier = function (fig, ui) {
  var P = new Plot(ui.body, { x: [-1.5, 1.7], y: [-1.6, 1.6], w: 480, h: 340, equal: true });
  P.axes({ xt: [[-1, "−1"], [1, "1"]] });
  P.circle(0, 0, 1, "km nf w2");
  var L = P.layer(), st = { x: 1.1 }, ro;
  function draw() {
    P.clear(L); P.g = L; var x = st.x, c = Math.cos(x), s = Math.sin(x), t = Math.tan(x / 2);
    P.seg(-1, 0, 0, t, "k1 w2"); P.seg(0, t, c, s, "k1 w2 dash");
    P.seg(0, 0, c, s, "km w1");
    var arc = []; for (var i = 0; i <= 30; i++) { var a = x * i / 30; arc.push([0.28 * Math.cos(a), 0.28 * Math.sin(a)]); } P.path(arc, "k2 nf w2");
    P.text(0.42 * Math.cos(x / 2), 0.42 * Math.sin(x / 2), "x", "m t2");
    var arc2 = []; for (i = 0; i <= 30; i++) { var b = (x / 2) * i / 30; arc2.push([-1 + 0.32 * Math.cos(b), 0.32 * Math.sin(b)]); } P.path(arc2, "k3 nf w2");
    P.text(-1 + 0.5 * Math.cos(x / 4), 0.5 * Math.sin(x / 4), "x/2", "m t3");
    P.dot(-1, 0, "Ft"); P.dot(c, s, "F2", 5); P.dot(0, t, "F1", 5);
    P.text(0, t, "t", "m t1", -12, 4, "end");
    ro.textContent = "t = tan(x/2) = " + fmt(t, 3) + "    2t/(1+t²) = " + fmt(2 * t / (1 + t * t), 3) + " = sin x    (1−t²)/(1+t²) = " + fmt((1 - t * t) / (1 + t * t), 3) + " = cos x";
  }
  ui.range("x =", -2.6, 2.6, 0.01, st.x, function (v) { st.x = v; draw(); });
  ro = ui.readout(); draw();
};

FIGS.areabetween = function (fig, ui) {
  var f = function (x) { return 2 * x - x * x + 0.6; }, g = function (x) { return 0.5 * x * x - 0.4; };
  // intersections of f and g: 2x - x^2 + .6 = .5x^2 - .4  ->  1.5x^2 - 2x - 1 = 0
  var r = Math.sqrt(4 + 6), a = (2 - r) / 3, b = (2 + r) / 3, xs = 0.9, dx = 0.12;
  var P = new Plot(ui.body, { x: [-0.8, 2.3], y: [-0.7, 1.9], w: 560, h: 300 });
  P.area(f, a, b, "f2", g);
  P.area(f, xs, xs + dx, "f3", g);
  P.axes({ xt: [[a, "a"], [b, "b"]] });
  P.fn(f, -0.7, 2.2, "k1 nf w3"); P.fn(g, -0.7, 2.2, "k5 nf w3");
  P.seg(xs + dx / 2, g(xs + dx / 2), xs + dx / 2, f(xs + dx / 2), "k3 w2");
  P.text(2.15, f(2.15), "f", "m t1", 10, 0, "start"); P.text(2.15, g(2.15), "g", "m", 10, 0, "start");
  P.text(xs + dx / 2, f(xs) + 0.12, "dx", "m t3"); P.dot(a, f(a), "Ft", 3.5); P.dot(b, f(b), "Ft", 3.5);
};

FIGS.revolve = function (fig, ui) {
  var st = { phi: 2 * Math.PI * 0.75 }, R = function (x) { return Math.sqrt(x); };
  var S = new Surface(ui.body, { w: 470, h: 320, scale: 50, az: -0.3, el: 0.32, cy: 0.55, axes: false, label: "גוף סיבוב",
    xr: [0, 4], yr: [0, 1], n: 30, zr: [-2, 2], f: function () { return 0; } });
  // custom drawing: replace default surface by a parametric solid of revolution
  S.draw = function () {
    var ctx = S.ctx, self = S, N = 30, M = 36, quads = [];
    ctx.clearRect(0, 0, S.Wc, S.Hc);
    var c1 = cssv("--c2"), c3 = cssv("--c3"), line = cssv("--surface"), mut = cssv("--muted");
    function P(x, th) { var r = R(x); return self.proj(x - 2, -r * Math.sin(th), r * Math.cos(th)); }
    for (var i = 0; i < N; i++) for (var j = 0; j < M; j++) {
      var x0 = 4 * i / N, x1 = 4 * (i + 1) / N, t0 = st.phi * j / M, t1 = st.phi * (j + 1) / M;
      var pp = [P(x0, t0), P(x1, t0), P(x1, t1), P(x0, t1)];
      var sh = 0.65 + 0.35 * Math.abs(Math.cos((t0 + t1) / 2 - 0.8));
      quads.push({ pp: pp, d: (pp[0][2] + pp[2][2]) / 2, sh: sh });
    }
    quads.sort(function (a, b) { return b.d - a.d; });
    ctx.save(); var axA = self.proj(-2.4, 0, 0), axB = self.proj(2.6, 0, 0);
    ctx.strokeStyle = mut; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(axA[0], axA[1]); ctx.lineTo(axB[0], axB[1]); ctx.stroke();
    ctx.fillStyle = mut; ctx.font = "italic 15px Times New Roman"; ctx.fillText("x", axB[0] + 4, axB[1] + 4);
    quads.forEach(function (q) { ctx.beginPath(); ctx.moveTo(q.pp[0][0], q.pp[0][1]); for (var k = 1; k < 4; k++) ctx.lineTo(q.pp[k][0], q.pp[k][1]); ctx.closePath();
      ctx.globalAlpha = 0.78; ctx.fillStyle = c1; ctx.fill(); ctx.globalAlpha = 1 - q.sh; ctx.fillStyle = "#000"; ctx.fill(); ctx.globalAlpha = 0.25; ctx.strokeStyle = line; ctx.lineWidth = 0.6; ctx.stroke(); ctx.globalAlpha = 1; });
    // the generating curve and one disk
    var pts = []; for (var k = 0; k <= 60; k++) pts.push([4 * k / 60 - 2, 0, R(4 * k / 60)]); self.line3(pts, cssv("--c1"), 3);
    var xd = 2.6, disk = []; for (k = 0; k <= 48; k++) { var th = 2 * Math.PI * k / 48; disk.push([xd - 2, -R(xd) * Math.sin(th), R(xd) * Math.cos(th)]); }
    self.line3(disk, c3, 3); self.line3([[xd - 2, 0, 0], [xd - 2, 0, R(xd)]], c3, 2, [4, 3]);
    ctx.restore();
  };
  ui.range("זווית סיבוב", 0.2, 6.283, 0.01, st.phi, function (v) { st.phi = v; S.draw(); });
  ui.play("סובב", function () { st.phi += 0.08; if (st.phi > 6.283) st.phi = 0.2; S.draw(); return true; }, 40);
};

FIGS.arclen = function (fig, ui) {
  var f = function (x) { return 0.6 + 0.9 * Math.sin(1.4 * x) + 0.25 * x; }, a = 0, b = 4;
  var exact = 0, N = 4000; for (var i = 0; i < N; i++) { var x = a + (b - a) * (i + .5) / N, d = 0.9 * 1.4 * Math.cos(1.4 * x) + 0.25; exact += Math.sqrt(1 + d * d) * (b - a) / N; }
  var P = new Plot(ui.body, { x: [-0.3, 4.4], y: [-0.6, 2.4], w: 600, h: 260 });
  P.axes({ xt: [[a, "a"], [b, "b"]] }); P.fn(f, a, b, "k1 nf w3");
  var L = P.layer(), st = { n: 4 }, ro;
  function draw() {
    P.clear(L); P.g = L; var pts = [], len = 0;
    for (var i = 0; i <= st.n; i++) { var x = a + (b - a) * i / st.n; pts.push([x, f(x)]); if (i) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); }
    P.path(pts, "k3 nf w3"); pts.forEach(function (q) { P.dot(q[0], q[1], "F3", 3.5); });
    ro.textContent = "Σ = " + fmt(len) + "     L = " + fmt(exact);
  }
  var r = ui.range("n =", 1, 40, 1, st.n, function (v) { st.n = v; draw(); });
  ui.play("עדן", function () { st.n = st.n >= 40 ? 1 : st.n + 1; r.value = st.n; draw(); return st.n < 40; }, 160);
  ro = ui.readout(); draw();
};

FIGS.improper = function (fig, ui) {
  var st = { p: 2, R: 6, eps: 0.2, mode: "inf" }, ro;
  var P = new Plot(ui.body, { x: [-0.3, 10.5], y: [-0.4, 4.2], w: 620, h: 270 });
  P.axes({ xt: [[1, "1"]] }); var L = P.layer();
  function F(p, A, B) { return Math.abs(p - 1) < 1e-9 ? Math.log(B / A) : (Math.pow(B, 1 - p) - Math.pow(A, 1 - p)) / (1 - p); }
  function draw() {
    P.clear(L); P.g = L; var p = st.p, f = function (x) { return Math.pow(x, -p); };
    if (st.mode === "inf") {
      P.area(f, 1, st.R, "f2"); P.seg(st.R, 0, st.R, f(st.R), "k3 w3"); P.text(st.R, 0, "R", "m t3", 0, 18);
      var v = F(p, 1, st.R), lim = p > 1 ? fmt(1 / (p - 1)) : "∞";
      ro.textContent = "∫₁ᴿ x^(−p) dx = " + fmt(v) + "      R → ∞ :  " + lim + (p > 1 ? "  ✓" : "  ✗");
    } else {
      P.area(f, st.eps, 1, "f2"); P.seg(st.eps, 0, st.eps, Math.min(f(st.eps), 4.2), "k3 w3"); P.text(st.eps, 0, "ε", "m t3", 0, 18);
      var w = F(p, st.eps, 1), lim2 = p < 1 ? fmt(1 / (1 - p)) : "∞";
      ro.textContent = "∫ε¹ x^(−p) dx = " + fmt(w) + "      ε → 0⁺ :  " + lim2 + (p < 1 ? "  ✓" : "  ✗");
    }
    P.fn(f, 0.05, 10.4, "k1 nf w3");
    P.text(9.8, 3.7, "y = 1/xᵖ ,  p = " + fmt(p, 2), "m", 0, 0, "end");
  }
  ui.seg("", [["inf", "בעיה באינסוף"], ["zero", "בעיה ליד 0"]], st.mode, function (m) { st.mode = m; draw(); });
  ui.range("p =", 0.3, 3, 0.05, st.p, function (v) { st.p = v; draw(); });
  ui.range("R =", 1.5, 10, 0.1, st.R, function (v) { st.R = v; draw(); });
  ui.range("ε =", 0.01, 0.9, 0.01, st.eps, function (v) { st.eps = v; draw(); });
  ro = ui.readout(); draw();
};

FIGS.compare = function (fig, ui) {
  var f = function (x) { return 1.6 / (x * x) + 0.02; }, g = function (x) { return (1 + 0.45 * Math.sin(3 * x)) / (x * x) * 0.75; };
  var P = new Plot(ui.body, { x: [0.5, 8], y: [-0.1, 1.9], w: 580, h: 230 });
  P.area(f, 1, 7.8, "f5"); P.area(g, 1, 7.8, "f2");
  P.axes({ yAt: 0.5, xt: [[1, "1"]] }); P.fn(f, 0.9, 7.9, "k5 nf w3"); P.fn(g, 0.9, 7.9, "k2 nf w3");
  P.text(1.35, f(1.35), "f", "m", 12, 0, "start"); P.text(1.6, g(1.6) * 0.5, "0 ≤ g ≤ f", "m t2", 0, 0, "start");
};

/* ================= figures: part B ================= */
FIGS.dotproj = function (fig, ui) {
  var P = new Plot(ui.body, { x: [-3.2, 3.6], y: [-1.6, 3.0], w: 560, h: 330, equal: true });
  P.axes({ grid: 1 });
  var X = [3, 0.8], L = P.layer(), st = { ang: 50 }, ro, lx = Math.hypot(X[0], X[1]), ux = [X[0] / lx, X[1] / lx];
  function draw() {
    P.clear(L); P.g = L;
    var a0 = Math.atan2(X[1], X[0]), a = a0 + st.ang * Math.PI / 180, ly = 2.4, Y = [ly * Math.cos(a), ly * Math.sin(a)];
    var pr = Y[0] * ux[0] + Y[1] * ux[1], foot = [pr * ux[0], pr * ux[1]];
    P.seg(-3 * ux[0], -3 * ux[1], 3.5 * ux[0], 3.5 * ux[1], "km w1 dash");
    P.seg(Y[0], Y[1], foot[0], foot[1], "km w1 dot");
    P.arrow(0, 0, foot[0], foot[1], "k3", 0.1); mk("line", { x1: P.X(0), y1: P.Y(0), x2: P.X(foot[0]), y2: P.Y(foot[1]), "class": "k3", style: "stroke-width:6;opacity:.55" }, L);
    var arc = [], n = 24; for (var i = 0; i <= n; i++) { var t = a0 + (a - a0) * i / n; arc.push([0.6 * Math.cos(t), 0.6 * Math.sin(t)]); } P.path(arc, "k2 nf w2");
    P.text(0.85 * Math.cos((a0 + a) / 2), 0.85 * Math.sin((a0 + a) / 2), "φ", "m t2");
    P.arrow(0, 0, X[0], X[1], "k1"); P.arrow(0, 0, Y[0], Y[1], "k5");
    P.text(X[0], X[1], "x", "m t1", 10, -6, "start"); P.text(Y[0], Y[1], "y", "m", 8, -8, "start");
    var dot = X[0] * Y[0] + X[1] * Y[1];
    ro.textContent = "φ = " + st.ang + "°    cos φ = " + fmt(Math.cos(st.ang * Math.PI / 180), 3) + "    proj = " + fmt(pr, 2) + "    x·y = " + fmt(dot, 2);
  }
  ui.range("φ =", 0, 180, 1, st.ang, function (v) { st.ang = v; draw(); });
  ro = ui.readout(); draw();
};

FIGS.cross = function (fig, ui) {
  var I = new Iso(ui.body, { w: 460, h: 330, scale: 62, az: -0.6, el: 0.4, cy: 250 });
  I.axes([2.6, 2.6, 2.8]);
  var a = [2, 0.3, 0], b = [0.6, 1.8, 0], n = [0, 0, 2.2];
  I.path([[0, 0, 0], a, [a[0] + b[0], a[1] + b[1], 0], b], "f1 k1 w1", true);
  I.arrow([0, 0, 0], a, "k1"); I.arrow([0, 0, 0], b, "k5"); I.arrow([0, 0, 0], n, "k2");
  I.text(a, "a", "m t1", 8, 14); I.text(b, "b", "m", -4, 16); I.text(n, "a × b", "m t2", 10, 2, "start");
  I.text([1.3, 1.05, 0], "שטח = |a × b|", "he sm", 0, 4);
  // little right-angle marks between n and the plane
  I.path([[0, 0, 0.3], [0.3 * a[0] / 2, 0.3 * a[1] / 2, 0.3], [0.3 * a[0] / 2, 0.3 * a[1] / 2, 0]], "km nf w1");
};

FIGS.lineplane = function (fig, ui) {
  var I = new Iso(ui.body, { w: 520, h: 330, scale: 55, az: -0.65, el: 0.42, cy: 230 });
  var c = [[-1.6, -1.6, 0], [2.4, -1.6, 0], [2.4, 2.2, 0], [-1.6, 2.2, 0]];
  I.path(c, "f2 k2 w1", true);
  var P0 = [0.2, 0.2, 0], Pp = [1.7, 1.2, 0];
  I.arrow(P0, [0.2, 0.2, 1.9], "k1"); I.text([0.2, 0.2, 1.9], "n", "m t1", 10, 0, "start");
  I.arrow(P0, Pp, "k3"); I.dot(P0, "Ft"); I.dot(Pp, "Ft");
  I.text(P0, "P₀", "m", -12, 14); I.text(Pp, "P", "m", 10, 12);
  I.path([[0.2, 0.2, 0.28], [0.2 + 0.28 * 0.83, 0.2 + 0.28 * 0.55, 0.28], [0.2 + 0.28 * 0.83, 0.2 + 0.28 * 0.55, 0]], "km nf w1");
  // a line above the plane
  var A = [-1.2, 1.4, 1.6], l = [1.2, -0.5, 0.35];
  I.path([[A[0] - 1.2 * l[0], A[1] - 1.2 * l[1], A[2] - 1.2 * l[2]], [A[0] + 3.2 * l[0], A[1] + 3.2 * l[1], A[2] + 3.2 * l[2]]], "k5 nf w2");
  I.arrow(A, [A[0] + l[0], A[1] + l[1], A[2] + l[2]], "k5"); I.dot(A, "F5"); I.text(A, "A", "m", -10, -6);
  I.text([A[0] + l[0], A[1] + l[1], A[2] + l[2]], "l", "m", 6, -8, "start");
  I.text([2.2, -1.4, 0], "n · (P − P₀) = 0", "m t2", 0, 22);
};

FIGS.planedist = function (fig, ui) {
  var I = new Iso(ui.body, { w: 480, h: 300, scale: 55, az: -0.65, el: 0.38, cy: 220 });
  I.path([[-1.8, -1.6, 0], [2.4, -1.6, 0], [2.4, 2, 0], [-1.8, 2, 0]], "f2 k2 w1", true);
  var P0 = [-0.6, 0.6, 0], M = [1.2, -0.2, 1.8], F = [1.2, -0.2, 0];
  I.arrow(P0, [P0[0], P0[1], 1.4], "k1"); I.text([P0[0], P0[1], 1.4], "n", "m t1", 10, 0, "start");
  I.arrow(P0, M, "k5"); I.path([M, F], "k3 nf w3"); I.path([P0, F], "km nf w1 dash");
  I.dot(P0, "Ft"); I.dot(M, "F3", 5); I.dot(F, "Ft", 3);
  I.text(P0, "P₀", "m", -12, 14); I.text(M, "M", "m", 10, -4, "start"); I.text([1.2, -0.2, 0.9], "d", "m t3", 12, 0, "start");
};

/* ================= figures: part C ================= */
function surfaceWithContours(fig, ui, FN, start, opt) {
  opt = opt || {};
  var st = { k: start, c: FN[start].c0 }, F = FN[st.k];
  var S = new Surface(ui.body, { w: 400, h: 320, scale: 62, az: -0.75, el: 0.5, cy: 0.62, n: 30, xr: F.r, yr: F.r, f: F.f, zs: F.zs, zr: F.zr, axlen: [2, 2, 2.2] });
  var Pm = new Plot(ui.body, { x: F.r, y: F.r, w: 300, h: 300, equal: true, pad: [14, 14, 22, 22] });
  var L = Pm.layer(), slider;
  function draw() {
    F = FN[st.k];
    S.o.f = F.f; S.o.zs = F.zs; S.o.zr = F.zr; S.o.xr = F.r; S.o.yr = F.r;
    S.o.extra = function (s) { s.segs3(contour(F.f, F.r, F.r, 60, st.c), st.c, cssv("--c3"), 3.2); if (opt.dot) s.dot3(0, 0, F.f(0, 0), cssv("--c4"), 5); };
    S.draw();
    Pm.clear(L); Pm.g = L;
    Pm.seg(F.r[0], 0, F.r[1], 0, "gr"); Pm.seg(0, F.r[0], 0, F.r[1], "gr");
    F.levels.forEach(function (c) { Pm.contour(F.f, c, "k1 nf w1", 80); });
    Pm.contour(F.f, st.c, "k3 nf w3", 90);
    if (opt.dot) Pm.dot(0, 0, "F4", 4.5);
    Pm.ptext(Pm.W - 6, 16, "f = " + fmt(st.c, 2), "m t3", "end");
  }
  if (Object.keys(FN).length > 1) ui.seg("", Object.keys(FN).map(function (k) { return [k, FN[k].name]; }), st.k, function (k) {
    st.k = k; st.c = FN[k].c0; slider.min = FN[k].cr[0]; slider.max = FN[k].cr[1]; slider.value = st.c; draw(); });
  slider = ui.range("c =", F.cr[0], F.cr[1], 0.01, st.c, function (v) { st.c = v; draw(); });
  draw();
}
FIGS.surface3d = function (fig, ui) {
  var lv = function (a, b, n) { var r = []; for (var i = 1; i < n; i++) r.push(a + (b - a) * i / n); return r; };
  surfaceWithContours(fig, ui, {
    bowl: { name: "קערה", f: function (x, y) { return x * x + y * y; }, r: [-1.5, 1.5], zs: 0.42, zr: [0, 4.5], cr: [0.05, 4], c0: 1.2, levels: lv(0, 4.5, 9) },
    saddle: { name: "אוכף", f: function (x, y) { return x * x - y * y; }, r: [-1.5, 1.5], zs: 0.5, zr: [-2.25, 2.25], cr: [-2, 2], c0: 0.6, levels: lv(-2.25, 2.25, 10) },
    cone: { name: "חרוט", f: function (x, y) { return Math.sqrt(x * x + y * y); }, r: [-1.5, 1.5], zs: 0.85, zr: [0, 2.1], cr: [0.05, 2], c0: 0.9, levels: lv(0, 2.1, 8) },
    hills: { name: "שתי גבעות", f: function (x, y) { return 1.6 * Math.exp(-((x - .6) * (x - .6) + (y - .5) * (y - .5)) / .5) + 1.1 * Math.exp(-((x + .7) * (x + .7) + (y + .6) * (y + .6)) / .35); }, r: [-1.6, 1.6], zs: 0.9, zr: [0, 1.65], cr: [0.05, 1.55], c0: 0.6, levels: lv(0, 1.65, 8) }
  }, "bowl");
};
FIGS.extrema = function (fig, ui) {
  var lv = function (a, b, n) { var r = []; for (var i = 1; i < n; i++) r.push(a + (b - a) * i / n); return r; };
  surfaceWithContours(fig, ui, {
    min: { name: "מינימום", f: function (x, y) { return x * x + 0.6 * y * y; }, r: [-1.5, 1.5], zs: 0.5, zr: [0, 3.6], cr: [0.05, 3], c0: 0.8, levels: lv(0, 3.6, 9) },
    max: { name: "מקסימום", f: function (x, y) { return -x * x - 0.6 * y * y; }, r: [-1.5, 1.5], zs: 0.5, zr: [-3.6, 0], cr: [-3, -0.05], c0: -0.8, levels: lv(-3.6, 0, 9) },
    saddle: { name: "אוכף", f: function (x, y) { return x * x - y * y; }, r: [-1.5, 1.5], zs: 0.5, zr: [-2.25, 2.25], cr: [-2, 2], c0: 0, levels: lv(-2.25, 2.25, 10) }
  }, "saddle", { dot: true });
};

FIGS.pathfield = function (fig, ui) {
  var I = new Iso(ui.body, { w: 320, h: 300, scale: 70, az: -0.6, el: 0.35, cy: 250 });
  I.axes([1.6, 1.6, 2.9]);
  var pts = []; for (var i = 0; i <= 200; i++) { var t = 4 * Math.PI * i / 200; pts.push([Math.cos(t), Math.sin(t), t / 4.6]); }
  I.path(pts, "k1 nf w3");
  var t0 = 2.3, P = [Math.cos(t0), Math.sin(t0), t0 / 4.6], V = [-Math.sin(t0), Math.cos(t0), 1 / 4.6];
  I.arrow(P, [P[0] + 0.8 * V[0], P[1] + 0.8 * V[1], P[2] + 0.8 * V[2]], "k3"); I.dot(P, "F3", 5);
  I.text([P[0] + 0.8 * V[0], P[1] + 0.8 * V[1], P[2] + 0.8 * V[2]], "p′(t)", "m t3", 6, -6, "start");
  var Q = new Plot(ui.body, { x: [-2.2, 2.2], y: [-2.2, 2.2], w: 300, h: 300, equal: true, pad: [10, 10, 20, 20] });
  Q.axes({});
  for (var x = -2; x <= 2.01; x += 0.5) for (var y = -2; y <= 2.01; y += 0.5) { if (Math.abs(x) + Math.abs(y) < 0.01) continue;
    var vx = -y, vy = x, m = Math.hypot(vx, vy), s = 0.38 * Math.min(1, 0.45 + m / 4) / m; Q.arrow(x - vx * s / 2, y - vy * s / 2, x + vx * s / 2, y + vy * s / 2, "k5", 6); }
};

FIGS.topo = function (fig, ui) {
  var P = new Plot(ui.body, { x: [-2.4, 2.6], y: [-1.9, 1.9], w: 560, h: 320, equal: true });
  var r = function (t) { return 1.35 + 0.22 * Math.sin(3 * t) + 0.12 * Math.cos(2 * t); };
  P.param(function (t) { return r(t) * Math.cos(t); }, function (t) { return 0.85 * r(t) * Math.sin(t); }, 0, 2 * Math.PI, "f2 k2 w2", 300);
  P.text(-0.6, 0.6, "Ω", "m t2");
  var ti = 0.9, bx = r(ti) * Math.cos(ti), by = 0.85 * r(ti) * Math.sin(ti);
  P.circle(-0.2, -0.3, 0.38, "k2 nf w2 dash"); P.dot(-0.2, -0.3, "F2", 5); P.text(-0.2, -0.3, "פנימית", "he", 0, 50);
  P.circle(bx, by, 0.38, "k3 nf w2 dash"); P.dot(bx, by, "F3", 5); P.text(bx, by, "שפה", "he", 0, -36);
  P.circle(2.05, -0.9, 0.38, "k4 nf w2 dash"); P.dot(2.05, -0.9, "F4", 5); P.text(2.05, -0.9, "חיצונית", "he", 0, 50);
};

FIGS.limitpaths = function (fig, ui) {
  var f = function (x, y) { var d = x * x * x * x + y * y; return d ? x * x * y / d : 0; };
  var D = new Plot(ui.body, { x: [-1, 1], y: [-1, 1], w: 300, h: 300, equal: true, pad: [10, 10, 20, 20] });
  var N = 44, h = 2 / N;
  for (var i = 0; i < N; i++) for (var j = 0; j < N; j++) { var x = -1 + (i + .5) * h, y = -1 + (j + .5) * h, v = f(x, y);
    var rc = D.rect(-1 + i * h, -1 + j * h, -1 + (i + 1) * h, -1 + (j + 1) * h, v >= 0 ? "F2" : "F4"); rc.setAttribute("opacity", Math.min(1, Math.abs(v) * 1.8).toFixed(2)); rc.setAttribute("stroke", "none"); }
  D.axes({}); var LD = D.layer();
  var G = new Plot(ui.body, { x: [0, 1.05], y: [-0.65, 0.65], w: 330, h: 300, pad: [16, 16, 30, 36] });
  G.axes({ xl: "|x|", yl: "f", yt: [[0.5, "½"], [-0.5, "−½"]] }); var LG = G.layer();
  var st = { type: "line", m: 1 }, ro;
  function draw() {
    D.clear(LD); D.g = LD; G.clear(LG); G.g = LG;
    var py = st.type === "line" ? function (x) { return st.m * x; } : function (x) { return st.m * x * x; };
    D.fn(py, -1, 1, "k3 nf w3"); D.dot(0, 0, "Ft", 4);
    var vals = []; for (var k = 1; k <= 200; k++) { var x = k / 200; vals.push([x, f(x, py(x))]); }
    G.path(vals, "k3 nf w3"); G.seg(0, 0, 1.05, 0, "km w1 dash");
    var lim = st.type === "line" ? 0 : st.m / (1 + st.m * st.m);
    G.dot(0, lim, "F3", 5);
    ro.textContent = (st.type === "line" ? "y = " + fmt(st.m, 2) + "·x" : "y = " + fmt(st.m, 2) + "·x²") + "   →   f → " + fmt(lim, 3);
  }
  ui.seg("", [["line", "ישר y=mx"], ["par", "פרבולה y=kx²"]], st.type, function (t) { st.type = t; draw(); });
  ui.range("m / k =", -3, 3, 0.05, st.m, function (v) { st.m = v; draw(); });
  ro = ui.readout(); draw();
};

function smoothSurf(ui, o) { return new Surface(ui.body, { w: 470, h: 330, scale: 74, az: -0.85, el: 0.48, cy: 0.66, n: 26, xr: [-1.4, 1.4], yr: [-1.4, 1.4], zs: 0.7, alpha: 0.85, f: o.f, extra: o.extra, axlen: [1.9, 1.9, 2.3] }); }
FIGS.partials = function (fig, ui) {
  var f = function (x, y) { return 1.6 - 0.35 * x * x - 0.55 * y * y + 0.15 * x * y; }, x0 = 0.5, y0 = 0.45;
  var fx = -0.7 * x0 + 0.15 * y0, fy = -1.1 * y0 + 0.15 * x0, z0 = f(x0, y0);
  smoothSurf(ui, { f: f, extra: function (s) {
    var A = [], B = []; for (var i = 0; i <= 60; i++) { var t = -1.4 + 2.8 * i / 60; A.push([t, y0, f(t, y0)]); B.push([x0, t, f(x0, t)]); }
    var ctx = s.ctx, c3 = cssv("--c3"), pl = [[-0.55, -0.55], [0.55, -0.55], [0.55, 0.55], [-0.55, 0.55]].map(function (d) { return s.proj(x0 + d[0], y0 + d[1], z0 + fx * d[0] + fy * d[1]); });
    ctx.save(); ctx.globalAlpha = 0.3; ctx.fillStyle = c3; ctx.beginPath(); pl.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.closePath(); ctx.fill(); ctx.restore();
    s.line3(A, cssv("--c1"), 3.2); s.line3(B, cssv("--c5"), 3.2);
    s.line3([[x0 - .7, y0, z0 - .7 * fx], [x0 + .7, y0, z0 + .7 * fx]], c3, 2.6); s.line3([[x0, y0 - .7, z0 - .7 * fy], [x0, y0 + .7, z0 + .7 * fy]], c3, 2.6);
    s.dot3(x0, y0, z0, cssv("--text"), 5);
  } });
};
FIGS.tangentplane = function (fig, ui) {
  var f = function (x, y) { return 0.9 + 0.5 * Math.sin(1.6 * x) * Math.cos(1.3 * y) + 0.15 * (x + y); }, st = { x0: 0.3, y0: 0.2 };
  var S = smoothSurf(ui, { f: f, extra: function (s) {
    var x0 = st.x0, y0 = st.y0, e = 1e-4, z0 = f(x0, y0), fx = (f(x0 + e, y0) - f(x0 - e, y0)) / (2 * e), fy = (f(x0, y0 + e) - f(x0, y0 - e)) / (2 * e);
    var ctx = s.ctx, c3 = cssv("--c3"), pl = [[-0.7, -0.7], [0.7, -0.7], [0.7, 0.7], [-0.7, 0.7]].map(function (d) { return s.proj(x0 + d[0], y0 + d[1], z0 + fx * d[0] + fy * d[1]); });
    ctx.save(); ctx.globalAlpha = 0.42; ctx.fillStyle = c3; ctx.beginPath(); pl.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1; ctx.strokeStyle = c3; ctx.lineWidth = 2; ctx.stroke(); ctx.restore(); s.dot3(x0, y0, z0, cssv("--text"), 5);
  } });
  ui.range("a =", -1, 1, 0.01, st.x0, function (v) { st.x0 = v; S.draw(); });
  ui.range("b =", -1, 1, 0.01, st.y0, function (v) { st.y0 = v; S.draw(); });
};

FIGS.diffchain = function (fig, ui) {
  var F = new Flow(ui.body, 740, 300, "היררכיית התנאים");
  var a = F.box(640, 70, 180, 56, ["נגזרות חלקיות", "רציפות (C¹)"], "t");
  var b = F.box(400, 70, 170, 56, ["דיפרנציאבילית"], "a");
  var c = F.box(150, 70, 170, 56, ["רציפה"], "t");
  var d = F.box(400, 230, 210, 56, ["נגזרות חלקיות", "(וכיווניות) קיימות"], "t");
  F.link(a, b, "k2"); F.link(b, c, "k2"); F.link(b, d, "k2");
  F.text(520, 58, "⟹", "m t2"); F.text(275, 58, "⟹", "m t2");
  mk("path", { d: "M300 230 C 200 230 150 170 150 100", "class": "k4 nf w2 dash" }, F.g);
  F.text(170, 210, "קיימות ⇏ רציפה", "he sm t4"); F.text(170, 228, "xy/(x²+y²)", "m sm");
  F.text(400, 140, "רציפה ⇏ דיפרנציאבילית:", "he sm t4"); F.text(400, 158, "√(x²+y²)", "m sm");
  F.text(640, 140, "דיפ׳ ⇏ C¹:", "he sm t4"); F.text(640, 158, "(x²+y²)·sin(1/√(x²+y²))", "m sm");
};

FIGS.chaintree = function (fig, ui) {
  var F = new Flow(ui.body, 520, 270, "עץ כלל השרשרת");
  var z = F.box(260, 34, 120, 44, [["z = f(x, y)", "m"]], "a");
  var x = F.box(140, 135, 80, 42, [["x", "m"]], "t"), y = F.box(380, 135, 80, 42, [["y", "m"]], "t");
  var t = F.box(260, 236, 80, 42, [["t", "m"]], "g");
  F.link(z, x, "k1"); F.link(z, y, "k1"); F.link(x, t, "k3"); F.link(y, t, "k3");
  F.text(170, 82, "∂f/∂x", "m sm t1"); F.text(350, 82, "∂f/∂y", "m sm t1");
  F.text(170, 198, "dx/dt", "m sm t3"); F.text(350, 198, "dy/dt", "m sm t3");
};

FIGS.gradient = function (fig, ui) {
  var f = function (x, y) { return x * x + 2 * y * y; };
  var P = new Plot(ui.body, { x: [-2.4, 2.4], y: [-1.6, 1.6], w: 560, h: 370, equal: true });
  [0.5, 1, 1.6, 2.4, 3.4, 4.6, 6].forEach(function (c) { P.contour(f, c, "k1 nf w1", 90); });
  P.axes({}); var L = P.layer(), st = { a: 20 }, ro, p = [1, 0.6], g = [2 * p[0], 4 * p[1]], gl = Math.hypot(g[0], g[1]);
  P.contour(f, f(p[0], p[1]), "k1 nf w3", 120);
  function draw() {
    P.clear(L); P.g = L; var s = 0.3;
    P.arrow(p[0], p[1], p[0] + g[0] * s, p[1] + g[1] * s, "k2");
    P.text(p[0] + g[0] * s, p[1] + g[1] * s, "∇f", "m t2", 8, -4, "start");
    var a = st.a * Math.PI / 180, v = [Math.cos(a), Math.sin(a)];
    P.arrow(p[0], p[1], p[0] + v[0] * 0.9, p[1] + v[1] * 0.9, "k3"); P.text(p[0] + v[0] * 0.9, p[1] + v[1] * 0.9, "v", "m t3", 8, 4, "start");
    P.dot(p[0], p[1], "Ft", 4.5); P.text(p[0], p[1], "P", "m", -10, 16);
    var D = g[0] * v[0] + g[1] * v[1], th = Math.acos(clamp(D / gl, -1, 1)) * 180 / Math.PI;
    ro.textContent = "|∇f| = " + fmt(gl, 2) + "    θ = " + fmt(th, 0) + "°    D_v f = ∇f·v = " + fmt(D, 2);
  }
  ui.range("כיוון v (מעלות)", 0, 359, 1, st.a, function (v) { st.a = v; draw(); });
  ro = ui.readout(); draw();
};

FIGS.implicit = function (fig, ui) {
  var P = new Plot(ui.body, { x: [-1.8, 1.8], y: [-1.35, 1.35], w: 520, h: 360, equal: true });
  P.axes({ xt: [[-1, "−1"], [1, "1"]] }); P.circle(0, 0, 1, "k1 nf w2");
  var L = P.layer(), st = { t: 60 }, ro;
  function draw() {
    P.clear(L); P.g = L; var t = st.t * Math.PI / 180, x = Math.cos(t), y = Math.sin(t);
    if (Math.abs(y) > 0.06) {
      var w = Math.min(0.42, 0.9 * Math.abs(y)), xs = [], sg = y > 0 ? 1 : -1;
      var a = Math.max(-1, x - w), b = Math.min(1, x + w);
      P.rect(a, y - 0.45, b, y + 0.45, "f3 k3 w1 dash");
      for (var i = 0; i <= 40; i++) { var u = a + (b - a) * i / 40; xs.push([u, sg * Math.sqrt(Math.max(0, 1 - u * u))]); }
      P.path(xs, "k3 nf w3");
      var m = -x / y; P.seg(x - 0.5, y - 0.5 * m, x + 0.5, y + 0.5 * m, "k2 w2");
      ro.textContent = "F_y = 2y = " + fmt(2 * y, 2) + " ≠ 0   →   y = φ(x),  φ′ = −x/y = " + fmt(m, 2);
    } else {
      P.seg(x, -0.6, x, 0.6, "k4 w2"); P.circle(x, y, 0.3, "k4 nf w2 dash");
      ro.textContent = "F_y = 2y = 0   →   ✗  y = φ(x)";
    }
    P.dot(x, y, Math.abs(y) > 0.06 ? "F3" : "F4", 5);
  }
  ui.range("זווית", 0, 360, 1, st.t, function (v) { st.t = v; draw(); });
  ro = ui.readout(); draw();
};

FIGS.lagrange = function (fig, ui) {
  var P = new Plot(ui.body, { x: [-3.6, 3.6], y: [-2.3, 2.3], w: 600, h: 390, equal: true });
  P.axes({}); var g = function (x, y) { return x * x / 8 + y * y / 2; };
  P.contour(g, 1, "k5 nf w3", 120);
  var L = P.layer(), st = { c: 1.2 }, ro;
  function draw() {
    P.clear(L); P.g = L; var c = st.c;
    P.fn(function (x) { return c / x; }, 0.05, 3.6, "k1 nf w3"); P.fn(function (x) { return c / x; }, -3.6, -0.05, "k1 nf w3");
    var disc = 16 - 4 * c * c, msg;
    if (disc > 1e-3) {
      [4 + Math.sqrt(disc), 4 - Math.sqrt(disc)].forEach(function (x2) { var x = Math.sqrt(x2); [[x, c / x], [-x, -c / x]].forEach(function (q) { P.dot(q[0], q[1], "F3", 5); }); });
      msg = "c = " + fmt(c, 2) + "    |{f = c} ∩ {g = 1}| = 4    ↑ c";
    } else if (Math.abs(disc) <= 0.35) {
      [[2, 1], [-2, -1]].forEach(function (q) { P.dot(q[0], q[1], "F3", 6);
        P.arrow(q[0], q[1], q[0] + 0.6 * q[1], q[1] + 0.6 * q[0], "k2"); P.arrow(q[0], q[1], q[0] + 0.6 * q[0] / 4, q[1] + 0.6 * q[1], "k3"); });
      P.text(2.5, 2.05, "∇f ∥ ∇g", "m t2"); msg = "c = 2    ∇f = 2·∇g    ✓ max";
    } else msg = "c = " + fmt(c, 2) + "    {f = c} ∩ {g = 1} = ∅";
    ro.textContent = msg;
  }
  ui.range("c =", 0.2, 3.2, 0.01, st.c, function (v) { st.c = Math.abs(v - 2) < 0.04 ? 2 : v; draw(); });
  ro = ui.readout(); draw();
};

/* ================= figures: part D ================= */
FIGS.columns = function (fig, ui) {
  var f = function (x, y) { return 0.8 + 0.5 * Math.sin(1.5 * x) * Math.cos(1.2 * y) + 0.25 * (x + y); }, st = { n: 5 }, ro;
  var S = new Surface(ui.body, { w: 470, h: 340, scale: 78, az: -0.8, el: 0.45, cy: 0.7, n: 24, xr: [0, 2], yr: [0, 2], zs: 0.9, f: f, axes: false });
  S.draw = function () {
    var ctx = S.ctx, s = S; ctx.clearRect(0, 0, S.Wc, S.Hc);
    var n = st.n, h = 2 / n, boxes = [], c1 = cssv("--c1"), c2 = cssv("--c2"), line = cssv("--surface"), vol = 0;
    function face(pts, col, a) { var P = pts.map(function (p) { return s.proj(p[0] - 1, p[1] - 1, p[2]); }); ctx.beginPath(); P.forEach(function (q, i) { if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }); ctx.closePath(); ctx.globalAlpha = a; ctx.fillStyle = col; ctx.fill(); ctx.globalAlpha = 0.6; ctx.strokeStyle = line; ctx.lineWidth = 0.8; ctx.stroke(); ctx.globalAlpha = 1; }
    for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) { var x0 = i * h, y0 = j * h, z = f(x0 + h / 2, y0 + h / 2); vol += z * h * h; boxes.push({ x0: x0, y0: y0, z: z, d: s.proj(x0 + h / 2 - 1, y0 + h / 2 - 1, 0)[2] }); }
    boxes.sort(function (a, b) { return b.d - a.d; });
    boxes.forEach(function (b) { var x0 = b.x0, y0 = b.y0, x1 = x0 + h, y1 = y0 + h, z = b.z;
      face([[x0, y0, 0], [x1, y0, 0], [x1, y0, z], [x0, y0, z]], c2, 0.85); face([[x0, y1, 0], [x1, y1, 0], [x1, y1, z], [x0, y1, z]], c2, 0.85);
      face([[x0, y0, 0], [x0, y1, 0], [x0, y1, z], [x0, y0, z]], c2, 0.7); face([[x1, y0, 0], [x1, y1, 0], [x1, y1, z], [x1, y0, z]], c2, 0.7);
      face([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], c1, 0.9); });
    var ex = 0, N = 200; for (i = 0; i < N; i++) for (j = 0; j < N; j++) ex += f((i + .5) * 2 / N, (j + .5) * 2 / N) * 4 / (N * N);
    ro.textContent = "Σ f·ΔA = " + fmt(vol) + "      ∬ f dA = " + fmt(ex);
  };
  var r = ui.range("n =", 1, 24, 1, st.n, function (v) { st.n = v; S.draw(); });
  ui.play("עדן", function () { st.n = st.n >= 24 ? 1 : st.n + 1; r.value = st.n; S.draw(); return st.n < 24; }, 250);
  ro = ui.readout();
};

FIGS.typeregions = function (fig, ui) {
  var lo = function (x) { return x * x; }, hi = function (x) { return Math.sqrt(x); };
  [["v", "dy dx"], ["h", "dx dy"]].forEach(function (mode) {
    var P = new Plot(ui.body, { x: [-0.15, 1.3], y: [-0.15, 1.25], w: 300, h: 280, equal: true, pad: [14, 14, 26, 26] });
    P.area(hi, 0, 1, "f2", lo); P.axes({ xt: [[1, "1"]], yt: [[1, "1"]] });
    if (mode[0] === "v") { for (var x = 0.08; x < 1; x += 0.12) P.seg(x, lo(x), x, hi(x), "k3 w1"); var xs = 0.56; P.seg(xs, lo(xs), xs, hi(xs), "k3 w3"); P.text(xs, lo(xs), "y = x²", "m sm", 26, 18); P.text(xs, hi(xs), "y = √x", "m sm", -18, -8, "end"); }
    else { for (var y = 0.08; y < 1; y += 0.12) P.seg(y * y, y, Math.sqrt(y), y, "k5 w1"); var ys = 0.55; P.seg(ys * ys, ys, Math.sqrt(ys), ys, "k5 w3"); P.text(ys * ys, ys, "x = y²", "m sm", -8, -8, "end"); P.text(Math.sqrt(ys), ys, "x = √y", "m sm", 8, 4, "start"); }
    P.fn(lo, 0, 1.08, "k1 nf w2"); P.fn(hi, 0, 1.25, "k1 nf w2");
    P.ptext(150, 18, mode[1], "m t" + (mode[0] === "v" ? "3" : "1"));
  });
};

FIGS.swaporder = function (fig, ui) {
  var P = new Plot(ui.body, { x: [-0.2, 1.35], y: [-0.2, 1.25], w: 420, h: 340, equal: true });
  P.path([[0, 0], [1, 0], [1, 1]], "f2 k2 w2", true); P.axes({ xt: [[1, "1"]], yt: [[1, "1"]] });
  P.fn(function (x) { return x; }, 0, 1.15, "k1 nf w1 dash"); P.text(1.12, 1.12, "y = x", "m sm", 6, 0, "start");
  var L = P.layer(), st = { m: "h" }, ro;
  function draw() {
    P.clear(L); P.g = L;
    if (st.m === "h") { for (var y = 0.06; y < 1; y += 0.1) P.seg(y, y, 1, y, "k5 w2"); ro.textContent = "∫₀¹ ∫ᵧ¹ e^(x²) dx dy   ✗"; }
    else { for (var x = 0.06; x < 1; x += 0.1) P.seg(x, 0, x, x, "k3 w2"); ro.textContent = "∫₀¹ ∫₀ˣ e^(x²) dy dx = ∫₀¹ x·e^(x²) dx = (e − 1)/2   ✓"; }
  }
  ui.seg("", [["h", "פרוסות אופקיות"], ["v", "פרוסות אנכיות"]], st.m, function (m) { st.m = m; draw(); });
  ro = ui.readout(); draw();
};

FIGS.jacobian = function (fig, ui) {
  var P = new Plot(ui.body, { x: [-1.2, 2.3], y: [-0.4, 2.3], w: 560, h: 400, equal: true });
  P.axes({}); var L = P.layer(), st = { t: 1 };
  function map(r, th, t) { var X = r * Math.cos(th), Y = r * Math.sin(th), U = r, V = th; return [U + (X - U) * t, V + (Y - V) * t]; }
  function draw() {
    P.clear(L); P.g = L; var t = st.t, R = [0.2, 2], T = [0, Math.PI / 2], nr = 6, nt = 6, i, j, k, pts;
    for (i = 0; i <= nr; i++) { var r = R[0] + (R[1] - R[0]) * i / nr; pts = []; for (k = 0; k <= 40; k++) pts.push(map(r, T[0] + (T[1] - T[0]) * k / 40, t)); P.path(pts, "k1 nf w1"); }
    for (j = 0; j <= nt; j++) { var th = T[0] + (T[1] - T[0]) * j / nt; pts = []; for (k = 0; k <= 20; k++) pts.push(map(R[0] + (R[1] - R[0]) * k / 20, th, t)); P.path(pts, "k5 nf w1"); }
    [[1, 1, "f3 k3 w2"], [5, 1, "f4 k4 w2"]].forEach(function (c) {
      var r0 = R[0] + (R[1] - R[0]) * c[0] / nr, r1 = R[0] + (R[1] - R[0]) * (c[0] + 1) / nr, t0 = T[0] + (T[1] - T[0]) * c[1] / nt, t1 = T[0] + (T[1] - T[0]) * (c[1] + 1) / nt, q = [];
      for (k = 0; k <= 10; k++) q.push(map(r0 + (r1 - r0) * k / 10, t0, t)); for (k = 0; k <= 10; k++) q.push(map(r1, t0 + (t1 - t0) * k / 10, t));
      for (k = 10; k >= 0; k--) q.push(map(r0 + (r1 - r0) * k / 10, t1, t)); for (k = 10; k >= 0; k--) q.push(map(r0, t0 + (t1 - t0) * k / 10, t));
      P.path(q, c[2], true); });
    P.ptext(P.W - 12, 22, t < 0.5 ? "מישור (r, θ)" : "מישור (x, y)", "he", "end");
  }
  ui.range("מעבר", 0, 1, 0.01, st.t, function (v) { st.t = v; draw(); });
  ui.play("הנפש", function () { st.t = st.t >= 1 ? 0 : Math.min(1, st.t + 0.02); draw(); return st.t < 1; }, 40);
  draw();
};

FIGS.sticks = function (fig, ui) {
  var A = new Iso(ui.body, { w: 320, h: 290, scale: 120, az: -0.75, el: 0.4, cy: 235 });
  A.axes([1.3, 1.3, 1.25]);
  A.path([[1, 0, 0], [0, 1, 0], [0, 0, 1]], "f1 k1 w2", true); A.path([[0, 0, 0], [1, 0, 0], [0, 1, 0]], "f2 k2 w1", true);
  var p = [0.3, 0.25]; A.path([[p[0], p[1], 0], [p[0], p[1], 1 - p[0] - p[1]]], "k3 nf w3"); A.dot([p[0], p[1], 0], "F3"); A.dot([p[0], p[1], 1 - p[0] - p[1]], "F3");
  A.text([0.55, 0.45, 0], "D", "m t2", 0, 14);
  var B = new Iso(ui.body, { w: 320, h: 290, scale: 120, az: -0.75, el: 0.4, cy: 235 });
  B.axes([1.3, 1.3, 1.25]);
  B.path([[1, 0, 0], [0, 1, 0], [0, 0, 1]], "f1 k1 w1", true);
  var z = 0.4; B.path([[0, 0, z], [1 - z, 0, z], [0, 1 - z, z]], "f3 k3 w3", true); B.text([0.65, 0, z], "D(z)", "m t3", 14, 0, "start");
};

FIGS.cylsph = function (fig, ui) {
  var A = new Iso(ui.body, { w: 320, h: 300, scale: 70, az: -0.7, el: 0.35, cy: 250 });
  A.axes([1.8, 1.8, 2.6]);
  var r = 1.2, th = 0.7, z = 1.4, P = [r * Math.cos(th), r * Math.sin(th), z];
  A.path([[0, 0, 0], [P[0], P[1], 0]], "k1 nf w2"); A.path([[P[0], P[1], 0], P], "k3 nf w2 dash");
  var arc = []; for (var k = 0; k <= 20; k++) arc.push([0.5 * Math.cos(th * k / 20), 0.5 * Math.sin(th * k / 20), 0]); A.path(arc, "k5 nf w2");
  var circ = []; for (k = 0; k <= 60; k++) circ.push([r * Math.cos(2 * Math.PI * k / 60), r * Math.sin(2 * Math.PI * k / 60), 0]); A.path(circ, "km nf w1 dash");
  A.dot(P, "F3", 5); A.text([P[0] / 2, P[1] / 2, 0], "r", "m t1", 0, 16); A.text([0.6, 0.25, 0], "θ", "m", 8, 4, "start"); A.text([P[0], P[1], z / 2], "z", "m t3", 10, 0, "start");
  var B = new Iso(ui.body, { w: 320, h: 300, scale: 70, az: -0.7, el: 0.35, cy: 250 });
  B.axes([1.8, 1.8, 2.6]);
  var rho = 2, ph = 0.6, Q = [rho * Math.sin(ph) * Math.cos(th), rho * Math.sin(ph) * Math.sin(th), rho * Math.cos(ph)];
  B.path([[0, 0, 0], Q], "k1 nf w2"); B.path([[Q[0], Q[1], 0], Q], "k3 nf w1 dash"); B.path([[0, 0, 0], [Q[0], Q[1], 0]], "km nf w1 dash");
  var a2 = []; for (k = 0; k <= 20; k++) { var p = ph * k / 20; a2.push([0.7 * Math.sin(p) * Math.cos(th), 0.7 * Math.sin(p) * Math.sin(th), 0.7 * Math.cos(p)]); } B.path(a2, "k2 nf w2");
  var a3 = []; for (k = 0; k <= 20; k++) a3.push([0.5 * Math.cos(th * k / 20), 0.5 * Math.sin(th * k / 20), 0]); B.path(a3, "k5 nf w2");
  B.dot(Q, "F3", 5); B.text([Q[0] / 2, Q[1] / 2, Q[2] / 2], "ρ", "m t1", -10, -4); B.text([0.15, 0.1, 0.85], "φ", "m t2", 8, 0, "start"); B.text([0.6, 0.25, 0], "θ", "m", 8, 4, "start");
};

/* ================= figures: exam-prep decision charts ================= */
function decisionChart(ui, W, rows, label) {
  // rows: [question, answerBox, partClass, chapterLink]; question boxes on the right, answers on the left
  var H = rows.length * 74 + 20, F = new Flow(ui.body, W, H, label), prev = null;
  rows.forEach(function (r, i) {
    var y = 44 + i * 74;
    var q = F.box(W - 190, y, 340, 50, r[0], "g");
    var a = F.box(170, y, 300, 50, r[1], r[2], r[3]);
    F.link(q, a, "k2", "כן");
    if (prev) F.link(prev, q, "km", "לא", 16);
    prev = q;
  });
}
FIGS.flowint = function (fig, ui) {
  decisionChart(ui, 760, [
    [["מהטבלה, או כמעט?", ["(פיצול, פתיחת סוגריים)", "he sm mut"]], ["ישר מהטבלה", ["∫f(ax+b) = F(ax+b)/a", "m sm"]], "pA", "#c2"],
    [["יש פונקציה פנימית", "והנגזרת שלה?"], ["הצבה t = g(x)", ["פרק 3", "he sm mut"]], "pA", "#c3"],
    [["מכפלה של סוגים שונים?", ["פולינום·eˣ, ln, arctan, sin", "m sm"]], ["בחלקים (LIATE)", ["פרק 3", "he sm mut"]], "pA", "#c3"],
    [["חזקות של sin ו־cos?"], ["לפי זוגיות החזקות", ["פרק 3", "he sm mut"]], "pA", "#c3"],
    [["מנה של פולינומים?"], ["חילוק + שברים חלקיים", ["פרק 4", "he sm mut"]], "pA", "#c4"],
    [["שורש של ביטוי ריבועי?", ["√(a²−x²), √(a²+x²), √(x²−a²)", "m sm"]], ["השלמה לריבוע + הצבה טריג׳", ["פרק 4", "he sm mut"]], "pA", "#c4"],
    [["רציונלית ב־sin, cos?"], ["t = tan(x/2)", ["פרק 4", "he sm mut"]], "pA", "#c4"],
    [["קטע אינסופי או פונקציה", "לא חסומה?"], ["גבול / מבחני השוואה", ["פרק 6", "he sm mut"]], "pA", "#c6"]
  ], "איזו שיטת אינטגרציה");
};
FIGS.flowext = function (fig, ui) {
  var F = new Flow(ui.body, 760, 400, "תרשים קיצון");
  var s = F.box(380, 34, 260, 46, ["מה שואלים?"], "a");
  var a = F.box(130, 130, 230, 56, ["קיצון מקומי", ["בלי אילוץ", "he sm mut"]], "pC", "#c15");
  var b = F.box(380, 130, 230, 56, ["קיצון מוחלט בתחום", ["סגור וחסום", "he sm mut"]], "pC", "#c15");
  var c = F.box(630, 130, 230, 56, ["קיצון על עקומה/משטח", ["g = c", "m sm"]], "pC", "#c16");
  F.link(s, a); F.link(s, b); F.link(s, c);
  var a1 = F.box(130, 230, 230, 50, [["∇f = 0", "m"], ["נקודות קריטיות", "he sm mut"]], "t");
  var a2 = F.box(130, 330, 230, 56, [["D = fxx·fyy − fxy²", "m sm"], ["D>0 קיצון, D<0 אוכף", "he sm"]], "t");
  F.link(a, a1); F.link(a1, a2);
  var b1 = F.box(380, 230, 230, 50, ["ויירשטראס ⇒ קיימים", ["פנים: ∇f = 0", "he sm"]], "t");
  var b2 = F.box(380, 330, 230, 56, ["שפה: פרמטריזציה או לגרנז׳", ["+ פינות, ואז משווים", "he sm mut"]], "t");
  F.link(b, b1); F.link(b1, b2);
  var c1 = F.box(630, 230, 230, 50, [["∇f = λ∇g ,  g = c", "m"]], "t");
  var c2 = F.box(630, 330, 230, 56, [["+ נקודות עם ∇g = 0", "he sm"], ["ואז משווים ערכים", "he sm mut"]], "t");
  F.link(c, c1); F.link(c1, c2);
};
FIGS.flowdbl = function (fig, ui) {
  decisionChart(ui, 760, [
    [["מלבן?"], ["פוביני ישר, בכל סדר", ["פרק 17", "he sm mut"]], "pD", "#c17"],
    [["עיגול, טבעת, גזרה", "או x² + y² בפונקציה?"], ["קוטביות, dA = r dr dθ", ["פרק 19", "he sm mut"]], "pD", "#c19"],
    [["הפנימי בלתי אפשרי?", ["e^(x²), sin(x)/x", "m sm"]], ["החלפת סדר", ["פרק 18", "he sm mut"]], "pD", "#c18"],
    [["גבולות כמו xy = c, y/x = c?"], ["u, v לפי הגבולות, |J|", ["פרק 19", "he sm mut"]], "pD", "#c19"],
    [["אחרת"], ["פרוסות אנכיות או אופקיות", ["לפי מה שלא מפצל", "he sm mut"]], "pD", "#c17"]
  ], "אינטגרל כפול");
};

/* ================= course list =================
   Single-file build: read the chapters from the page. Multi-page site: the page defines window.COURSE
   (all chapters with their URLs), because each page only contains its own chapter. */
function courseList() {
  if (window.COURSE) return window.COURSE;
  return Array.prototype.slice.call(document.querySelectorAll("section.chapter")).map(function (sec) {
    return { id: sec.id, num: sec.querySelector(".ch-num").textContent, part: sec.dataset.part,
      title: sec.querySelector("h2").textContent, href: "#" + sec.id };
  });
}

/* ================= decorations: cover art + part openers ================= */
document.addEventListener("DOMContentLoaded", function () {
  function svg(parent, vb, par) { return mk("svg", { viewBox: vb, preserveAspectRatio: par || "xMidYMid meet" }, parent); }
  function el(tag, a, p) { return mk(tag, a, p); }
  function tx(p, x, y, s, size, color, extra) { var t = el("text", { x: x, y: y, "font-size": size, fill: color, "font-family": "Times New Roman, serif", "font-style": "italic", "text-anchor": "middle", direction: "ltr" }, p); if (extra) for (var k in extra) t.setAttribute(k, extra[k]); t.textContent = s; return t; }

  /* ---- cover ---- */
  var art = document.querySelector(".cover-art");
  if (art) {
    var S = svg(art, "0 0 1000 560", "xMidYMid slice");
    // giant integral sign
    tx(S, 210, 400, "∫", 420, "var(--pA)", { opacity: ".16", "font-style": "normal" });
    // contour ellipses (part C)
    var g = el("g", { "class": "spin" }, S);
    for (var i = 1; i <= 6; i++) el("ellipse", { cx: 330, cy: 150, rx: 18 * i + 6, ry: 11 * i + 4, fill: "none", stroke: "var(--pC)", "stroke-width": 2.2, opacity: (0.75 - i * 0.09).toFixed(2) }, g);
    el("line", { x1: 330, y1: 150, x2: 395, y2: 105, stroke: "var(--pC)", "stroke-width": 3, "stroke-linecap": "round" }, S);
    tx(S, 410, 98, "∇f", 26, "var(--pC)");
    // Riemann bars under a curve (part A)
    var base = 500, x0 = 40, w = 34, f = function (x) { return 330 - 70 * Math.sin((x - 40) / 70) - (x - 40) * 0.12; };
    for (i = 0; i < 12; i++) { var xm = x0 + i * w + w / 2, top = f(xm);
      el("rect", { x: x0 + i * w + 2, y: top, width: w - 4, height: base - top, rx: 5, fill: i % 2 ? "var(--pA)" : "var(--pD)", opacity: ".32", "class": "bar", style: "animation-delay:" + (0.05 * i) + "s" }, S); }
    var d = ""; for (var x = 30; x <= 470; x += 5) d += (x === 30 ? "M" : "L") + x + " " + f(x).toFixed(1);
    el("path", { d: d, fill: "none", stroke: "var(--pA)", "stroke-width": 5, "stroke-linecap": "round" }, S);
    // vectors (part B)
    var o = [610, 470];
    [[700, 400, "var(--pB)"], [640, 360, "var(--pB)"]].forEach(function (v) { el("line", { x1: o[0], y1: o[1], x2: v[0], y2: v[1], stroke: v[2], "stroke-width": 4, "stroke-linecap": "round" }, S); el("circle", { cx: v[0], cy: v[1], r: 6, fill: v[2] }, S); });
    el("path", { d: "M610 470 L700 400 L730 290 L640 360 Z", fill: "var(--pB)", opacity: ".14" }, S);
    // floating symbols
    [["∂", 520, 80, "var(--pC)", 0], ["π", 60, 70, "var(--pB)", 1.2], ["∞", 480, 250, "var(--pD)", 2.1], ["dx", 120, 540, "var(--pA)", .6], ["λ", 560, 200, "var(--pB)", 1.7], ["∬", 760, 520, "var(--pD)", 2.6], ["Σ", 40, 300, "var(--pA)", .3], ["e", 930, 60, "var(--pC)", 1.4]].forEach(function (q) {
      var t = tx(S, q[1], q[2], q[0], 42, q[3], { opacity: ".55" }); t.setAttribute("class", "float"); t.setAttribute("style", "animation-delay:" + q[4] + "s"); });
    // dotted grid (part D) bottom-left corner
    for (var a = 0; a < 6; a++) for (var b = 0; b < 4; b++) el("circle", { cx: 820 + a * 26, cy: 400 + b * 26, r: 3, fill: "var(--pD)", opacity: ".35" }, S);
  }

  /* ---- part openers: giant letter, mini art, chapter chips ---- */
  var LET = { A: "א", B: "ב", C: "ג", D: "ד", E: "✓" };
  document.querySelectorAll(".part-head").forEach(function (ph) {
    var P = ph.id.replace("part", "");
    var L = mk("div", { "class": "ph-letter", "aria-hidden": "true" }, null, false); L.textContent = LET[P]; ph.insertBefore(L, ph.firstChild);
    var box = mk("div", { "class": "part-art", "aria-hidden": "true" }, null, false); ph.insertBefore(box, ph.firstChild);
    var s = svg(box, "0 0 300 200"), c = "var(--pc)";
    if (P === "A") {
      var fA = function (x) { return 120 - 50 * Math.sin(x / 45) - x * 0.1; }, dd = "";
      for (var i = 0; i < 8; i++) { var xm = 30 + i * 30 + 15; el("rect", { x: 32 + i * 30, y: fA(xm), width: 26, height: Math.max(4, 185 - fA(xm)), rx: 5, fill: c, opacity: ".28", "class": "bar" }, s); }
      for (var x = 20; x <= 280; x += 4) dd += (x === 20 ? "M" : "L") + x + " " + fA(x).toFixed(1);
      el("path", { d: dd, fill: "none", stroke: c, "stroke-width": 4.5, "stroke-linecap": "round" }, s);
    } else if (P === "B") {
      el("path", { d: "M60 170 L190 130 L250 40 L120 80 Z", fill: c, opacity: ".18" }, s);
      [[190, 130], [120, 80], [70, 30]].forEach(function (v, k) { el("line", { x1: 60, y1: 170, x2: v[0], y2: v[1], stroke: c, "stroke-width": 4.5, "stroke-linecap": "round", opacity: k === 2 ? ".6" : "1" }, s); el("circle", { cx: v[0], cy: v[1], r: 7, fill: c }, s); });
      tx(s, 210, 175, "a × b", 26, c);
    } else if (P === "C") {
      var gg = el("g", { "class": "spin", style: "animation-duration:80s" }, s);
      for (var k = 1; k <= 6; k++) el("ellipse", { cx: 150, cy: 100, rx: 20 * k, ry: 12 * k, fill: "none", stroke: c, "stroke-width": 3, opacity: (1 - k * 0.12).toFixed(2) }, gg);
      el("line", { x1: 150, y1: 100, x2: 210, y2: 52, stroke: "var(--c3)", "stroke-width": 4, "stroke-linecap": "round" }, s); el("circle", { cx: 210, cy: 52, r: 6, fill: "var(--c3)" }, s);
      tx(s, 240, 48, "∇f", 26, "var(--c3)");
    } else if (P === "E") {
      for (var r = 0; r < 3; r++) {
        el("rect", { x: 50, y: 34 + r * 50, width: 200, height: 36, rx: 11, fill: c, opacity: ".16" }, s);
        el("rect", { x: 70, y: 47 + r * 50, width: 110 - r * 22, height: 10, rx: 5, fill: c, opacity: ".45" }, s);
        el("path", { d: "M206 " + (52 + r * 50) + " l9 9 l17 -18", fill: "none", stroke: c, "stroke-width": 4.5, "stroke-linecap": "round", "stroke-linejoin": "round" }, s);
      }
    } else {
      for (var a = 0; a < 6; a++) for (var b = 0; b < 4; b++) { var h = 20 + 40 * Math.exp(-((a - 2.5) * (a - 2.5) + (b - 1.5) * (b - 1.5)) / 5), X = 50 + a * 30 + b * 16, Y = 170 - b * 14;
        el("rect", { x: X, y: Y - h, width: 24, height: h, rx: 3, fill: c, opacity: (0.2 + 0.12 * b).toFixed(2), "class": "bar" }, s); }
    }
    var chips = mk("div", { "class": "ph-chaps" }, ph, false);
    courseList().filter(function (c) { return c.part === P; }).forEach(function (c) {
      var a = mk("a", { href: c.href }, chips, false);
      a.innerHTML = "<b>" + c.num + "</b>"; a.appendChild(document.createTextNode(c.title.replace(/\\\(\\mathbb\s*\{?R\}?\^n\\\)/, "ℝⁿ")));
    });
  });
});

/* ================= app ================= */
window.addEventListener("beforeprint", function () { document.querySelectorAll("details").forEach(function (d) { d.open = true; }); });
document.addEventListener("DOMContentLoaded", function () {
  /* worksheets-only output (open with ?worksheets, then print) */
  if (document.documentElement.classList.contains("ws-mode")) {
    document.title = "דפי עבודה · חדו״א 2";
    var main = document.querySelector("main");
    var sheets = main.querySelectorAll('section[id^="w"]');
    var hero = document.createElement("header");
    hero.className = "ws-hero";
    hero.innerHTML = "<h1>חדו״א 2 · דפי עבודה</h1><p>כל השאלות מדפי העבודה 1–3, ואחרי כל שאלה הפתרון המלא שלה.</p>";
    if (sheets.length) main.insertBefore(hero, sheets[0]);
    main.querySelectorAll(".wq details.sol").forEach(function (d) { d.open = true; });
  }

  /* roadmap strip under each chapter header: where am I in the course */
  var chapters = courseList();
  document.querySelectorAll("section.chapter").forEach(function (sec) {
    var idx = chapters.map(function (c) { return c.id; }).indexOf(sec.id);
    var strip = document.createElement("nav"); strip.className = "roadmap"; strip.setAttribute("aria-label", "מיקום בקורס");
    var prevPart = null;
    chapters.forEach(function (c, j) {
      var a = document.createElement("a"); a.href = c.href; a.title = c.title;
      if (j < idx) a.className = "done"; if (j === idx) a.className = "now";
      if (prevPart && c.part !== prevPart) a.className += " gap";
      a.style.setProperty("--pc", "var(--p" + c.part + ")");
      prevPart = c.part; strip.appendChild(a);
    });
    var head = sec.querySelector(".ch-head"); head.parentNode.insertBefore(strip, head.nextSibling);
  });

  /* figures */
  document.querySelectorAll("figure.fig[data-fig]").forEach(function (fig) {
    var fn = FIGS[fig.dataset.fig];
    if (!fn) { console.warn("missing figure", fig.dataset.fig); return; }
    try { fn(fig, new UI(fig)); } catch (e) { console.error("figure " + fig.dataset.fig, e); }
  });
  SURFACES.forEach(function (s) { s.draw(); });
  var mq = window.matchMedia("(prefers-color-scheme: dark)");
  if (mq.addEventListener) mq.addEventListener("change", function () { SURFACES.forEach(function (s) { s.draw(); }); });

  /* quizzes */
  var quizzes = Array.prototype.slice.call(document.querySelectorAll(".quiz"));
  var score = document.getElementById("score");
  function updateScore() {
    if (!score) return;
    var done = 0, right = 0;
    quizzes.forEach(function (q) { if (q.classList.contains("done")) { done++; if (q.dataset.result === "ok") right++; } });
    score.textContent = done === 0
      ? "יש בסיכום " + quizzes.length + " שאלות בדוק את עצמך."
      : "ענית על " + done + " מתוך " + quizzes.length + " שאלות, " + right + " מהן נכון.";
  }
  quizzes.forEach(function (q) {
    var correct = parseInt(q.dataset.correct, 10);
    var opts = Array.prototype.slice.call(q.querySelectorAll("button.opt"));
    var exp = q.querySelector(".exp");
    var verdict = document.createElement("span"); verdict.className = "verdict";
    var retry = document.createElement("button"); retry.className = "retry"; retry.type = "button";
    retry.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>נסה שוב';
    var row = document.createElement("div"); row.className = "retry-row"; row.appendChild(retry);
    exp.insertBefore(verdict, exp.firstChild); exp.appendChild(row);
    opts.forEach(function (b, i) {
      b.type = "button";
      b.addEventListener("click", function () {
        if (q.classList.contains("done")) return;
        q.classList.add("done");
        opts.forEach(function (o) { o.disabled = true; });
        opts[correct].classList.add("right");
        if (i === correct) { verdict.textContent = "נכון! "; verdict.className = "verdict ok"; q.dataset.result = "ok"; }
        else { b.classList.add("wrong"); verdict.textContent = "לא בדיוק. "; verdict.className = "verdict no"; q.dataset.result = "no"; }
        updateScore();
      });
    });
    retry.addEventListener("click", function () {
      q.classList.remove("done"); delete q.dataset.result;
      opts.forEach(function (o) { o.disabled = false; o.classList.remove("right", "wrong"); });
      updateScore();
    });
  });
  updateScore();

  /* TOC: highlight the chapter in view */
  var links = {}; document.querySelectorAll("nav.toc a").forEach(function (a) { links[a.getAttribute("href").slice(1)] = a; });
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting && links[e.target.id]) {
      Object.keys(links).forEach(function (k) { links[k].classList.remove("on"); }); links[e.target.id].classList.add("on"); } }); }, { rootMargin: "-20% 0px -70% 0px" });
    document.querySelectorAll("main section[id]").forEach(function (s) { io.observe(s); });
  }

  if (window.renderMathInElement) {
    renderMathInElement(document.body, {
      delimiters: [{ left: "\\[", right: "\\]", display: true }, { left: "\\(", right: "\\)", display: false }],
      throwOnError: false
    });
  }
});
