/* Copied unchanged from openqarp.github.io (hero_fields.js) so both sites share one field; the blog uses only the statevector one. */
/* Hero background fields for the OpenQARP landing page.
   Three interchangeable implementations, all computed live in the browser.
   Pick one with `?hero=<name>` or by setting HERO in app.js.

     continuous  — free particle on a lattice, Visscher leapfrog (quantum
                   mechanics, not quantum computing: no qubits, no gates)
     dtqw        — discrete-time quantum walk: Grover coin + shift, the
                   primitive underneath Grover search and qubitization
     statevector — the 4,096 amplitudes of a 12-qubit HEABlock, laid out
                   as a 64 x 64 grid

   Every field exposes the same four methods, so app.js does not care which
   one it is holding: resize(), restart(), frame(dtSeconds), still().
   frame() advances and draws; still() draws one representative frozen image. */
(function (global) {
  "use strict";

  function rngFrom(seed) {
    var s = seed >>> 0;
    return function () { s = (1664525 * s + 1013904223) >>> 0; return s / 4294967296; };
  }
  function smooth(x) { x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * (3 - 2 * x); }
  function easeOut(x) { x = x < 0 ? 0 : x > 1 ? 1 : x; return 1 - Math.pow(1 - x, 3); }

  // Canvas colours cannot come from CSS, so the theme is mirrored here.
  // app.js calls QARP_HERO_THEME on load and on every toggle.
  var TH = {
    dot0: [43, 77, 255], dot1: [110, 60, 255],   // hue endpoints, swept by phase
    floor: 0.16, gainA: 0.5,
    lattice: "rgba(11,14,28,"
  };
  global.QARP_HERO_THEME = function (dark) {
    TH = dark
      ? { dot0: [125, 145, 255], dot1: [178, 120, 255], floor: 0.20, gainA: 0.55, lattice: "rgba(233,231,246," }
      : { dot0: [43, 77, 255],   dot1: [110, 60, 255],  floor: 0.16, gainA: 0.50, lattice: "rgba(11,14,28," };
  };

  // Shared look: dot area tracks probability, hue sweeps between the two
  // endpoints with phase.
  function paint(ctx, x, y, r, amp, phase, alpha) {
    var t = 0.5 + 0.5 * Math.cos(phase);
    var a = TH.dot0, b = TH.dot1;
    var cr = Math.round(a[0] + (b[0] - a[0]) * t);
    var cg = Math.round(a[1] + (b[1] - a[1]) * t);
    var cb = Math.round(a[2] + (b[2] - a[2]) * t);
    ctx.fillStyle = "rgba(" + cr + "," + cg + "," + cb + "," + (alpha * (TH.floor + TH.gainA * amp)).toFixed(3) + ")";
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
  }
  function latticeStyle(alpha) { return TH.lattice + (0.07 * alpha).toFixed(3) + ")"; }

  // The camera is a focus point in canvas pixels plus a zoom; null is the
  // identity. Set by app.js while the page flies across the field.
  function camOpen(f) {
    var ctx = f.ctx, cam = f.cam;
    ctx.save();
    if (cam) { ctx.translate(f.w / 2, f.h / 2); ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y); }
  }
  function camView(f) {
    var cam = f.cam, z = cam ? cam.z : 1, cx = cam ? cam.x : f.w / 2, cy = cam ? cam.y : f.h / 2;
    return { x0: cx - f.w / (2 * z), x1: cx + f.w / (2 * z), y0: cy - f.h / (2 * z), y1: cy + f.h / (2 * z) };
  }

  function fitCanvas(cv) {
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    var w = cv.clientWidth, h = cv.clientHeight;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    cv.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w: w, h: h };
  }

  /* ==================================================================
     continuous — the original field
     Free particle on a periodic square lattice, H = nearest-neighbour
     hopping, integrated with Visscher's staggered leapfrog (real and
     imaginary parts half a step apart), stable for dt < 2/|H|max = 0.5.
     Two Gaussian packets with opposite momenta cross and interfere.
     ================================================================== */

  function Continuous(cv) {
    this.cv = cv; this.ctx = cv.getContext("2d");
    this.spacing = 22; this.dt = 0.06;
    this.rng = rngFrom(7);
    this.gain = 1; this.alpha = 0; this.age = 0; this.cycle = 34;
    this.resize();
  }
  Continuous.prototype.resize = function () {
    var d = fitCanvas(this.cv);
    this.w = d.w; this.h = d.h;
    var s = this.spacing;
    this.nx = Math.max(24, Math.ceil(d.w / s) + 1);
    this.ny = Math.max(16, Math.ceil(d.h / s) + 1);
    this.ox = (d.w - (this.nx - 1) * s) / 2;
    this.oy = (d.h - (this.ny - 1) * s) / 2;
    this.restart();
  };
  Continuous.prototype.restart = function () {
    var n = this.nx * this.ny;
    this.R = new Float32Array(n); this.I = new Float32Array(n);
    this.HI = new Float32Array(n); this.HR = new Float32Array(n);
    var r = this.rng;
    var packets = [
      { x: this.nx * (0.25 + 0.1 * r()), y: this.ny * (0.35 + 0.3 * r()), kx: 0.8 + 0.3 * r(), ky: 0.35 * (r() - 0.5) },
      { x: this.nx * (0.65 + 0.1 * r()), y: this.ny * (0.35 + 0.3 * r()), kx: -(0.8 + 0.3 * r()), ky: 0.35 * (r() - 0.5) }
    ];
    var sigma = Math.max(3.2, Math.min(this.nx, this.ny) * 0.075);
    for (var j = 0; j < this.ny; j++) {
      for (var i = 0; i < this.nx; i++) {
        var re = 0, im = 0;
        for (var k = 0; k < packets.length; k++) {
          var p = packets[k], dx = i - p.x, dy = j - p.y;
          var env = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
          var ph = p.kx * dx + p.ky * dy;
          re += env * Math.cos(ph); im += env * Math.sin(ph);
        }
        this.R[j * this.nx + i] = re; this.I[j * this.nx + i] = im;
      }
    }
    var m = 0, q;
    for (q = 0; q < n; q++) { var v = this.R[q] * this.R[q] + this.I[q] * this.I[q]; if (v > m) m = v; }
    var sc = 1 / Math.sqrt(m || 1);
    for (q = 0; q < n; q++) { this.R[q] *= sc; this.I[q] *= sc; }
    this.applyH(this.R, this.HR);
    for (q = 0; q < n; q++) this.I[q] -= 0.5 * this.dt * this.HR[q];
    this.gain = 1; this.age = 0; this.alpha = 0;
  };
  Continuous.prototype.applyH = function (src, out) {
    var nx = this.nx, ny = this.ny;
    for (var j = 0; j < ny; j++) {
      var jm = (j === 0 ? ny - 1 : j - 1) * nx, jp = (j === ny - 1 ? 0 : j + 1) * nx, j0 = j * nx;
      for (var i = 0; i < nx; i++) {
        var im = i === 0 ? nx - 1 : i - 1, ip = i === nx - 1 ? 0 : i + 1;
        out[j0 + i] = -(src[j0 + im] + src[j0 + ip] + src[jm + i] + src[jp + i]);
      }
    }
  };
  Continuous.prototype.step = function () {
    var n = this.nx * this.ny, dt = this.dt, q;
    this.applyH(this.I, this.HI);
    for (q = 0; q < n; q++) this.R[q] += dt * this.HI[q];
    this.applyH(this.R, this.HR);
    for (q = 0; q < n; q++) this.I[q] -= dt * this.HR[q];
  };
  Continuous.prototype.draw = function () {
    var ctx = this.ctx, s = this.spacing, nx = this.nx, ny = this.ny, i, j;
    ctx.clearRect(0, 0, this.w, this.h);
    camOpen(this);
    var m = 0, n = nx * ny, q;
    for (q = 0; q < n; q++) { var v = this.R[q] * this.R[q] + this.I[q] * this.I[q]; if (v > m) m = v; }
    this.gain += (0.85 / Math.max(m, 1e-4) - this.gain) * 0.03;
    var rMax = s * 0.46;
    ctx.fillStyle = latticeStyle(this.alpha);
    for (j = 0; j < ny; j++) for (i = 0; i < nx; i++) {
      ctx.fillRect(this.ox + i * s - 0.75, this.oy + j * s - 0.75, 1.5, 1.5);
    }
    for (j = 0; j < ny; j++) {
      var y = this.oy + j * s;
      for (i = 0; i < nx; i++) {
        var idx = j * nx + i, re = this.R[idx], im = this.I[idx];
        var p = (re * re + im * im) * this.gain;
        if (p < 0.004) continue;
        var amp = Math.sqrt(Math.min(p, 1));
        paint(ctx, this.ox + i * s, y, rMax * amp, amp, Math.atan2(im, re), this.alpha);
      }
    }
    ctx.restore();
  };
  Continuous.prototype.redraw = function () { this.draw(); };
  Continuous.prototype.bounds = function () {
    var s = this.spacing;
    return { x0: this.ox, y0: this.oy, x1: this.ox + (this.nx - 1) * s, y1: this.oy + (this.ny - 1) * s, cell: s };
  };
  Continuous.prototype.frame = function (dt) {
    this.age += dt;
    this.alpha = Math.min(easeOut(this.age / 1.6), 1 - smooth((this.age - (this.cycle - 1.8)) / 1.8));
    if (this.age > this.cycle) this.restart();
    this.step(); this.draw();
  };
  Continuous.prototype.still = function () {
    for (var k = 0; k < 140; k++) this.step();
    this.alpha = 1; this.draw();
  };

  /* ==================================================================
     dtqw — discrete-time quantum walk on a 2D lattice
     Coin register (4 states: +x, -x, +y, -y) tensored with position.
     Each step is a Grover coin C = 2|s><s| - 1 on the coin register
     followed by a flip-flop shift, which is exactly the walk operator
     Grover search and qubitization are built from. Started in the
     (1, -1, -1, 1)/2 coin state, the one that does not localise.
     ================================================================== */

  function DTQW(cv) {
    this.cv = cv; this.ctx = cv.getContext("2d");
    this.spacing = 16; this.stepMs = 0.115;   // seconds per walk step
    this.alpha = 0; this.age = 0; this.acc = 0;
    this.resize();
  }
  DTQW.prototype.resize = function () {
    var d = fitCanvas(this.cv);
    this.w = d.w; this.h = d.h;
    var s = this.spacing;
    this.nx = Math.max(24, Math.ceil(d.w / s) + 1);
    this.ny = Math.max(16, Math.ceil(d.h / s) + 1);
    this.ox = (d.w - (this.nx - 1) * s) / 2;
    this.oy = (d.h - (this.ny - 1) * s) / 2;
    // ballistic spreading is one site per step, so the walk fills the short
    // axis in half that many steps; hold briefly, then start over
    this.steps = Math.floor(Math.min(this.nx, this.ny) / 2) - 1;
    this.cycle = this.steps * this.stepMs + 3.2;
    this.restart();
  };
  DTQW.prototype.restart = function () {
    var n = this.nx * this.ny;
    this.R = new Float32Array(n * 4); this.I = new Float32Array(n * 4);
    this.R2 = new Float32Array(n * 4); this.I2 = new Float32Array(n * 4);
    this.prevP = new Float32Array(n); this.curP = new Float32Array(n);
    this.ph = new Float32Array(n);
    var c = ((this.ny >> 1) * this.nx + (this.nx >> 1)) * 4;
    this.R[c] = 0.5; this.R[c + 1] = -0.5; this.R[c + 2] = -0.5; this.R[c + 3] = 0.5;
    this.measure(); this.prevP.set(this.curP);
    this.alpha = 0; this.age = 0; this.acc = 0; this.done = 0;
  };
  DTQW.prototype.step = function () {
    var nx = this.nx, ny = this.ny, R = this.R, I = this.I, R2 = this.R2, I2 = this.I2;
    var i, j, b;
    // Grover coin on the 4-state coin register: psi_c -> (sum psi)/2 - psi_c
    for (i = 0, b = R.length; i < b; i += 4) {
      var sr = (R[i] + R[i + 1] + R[i + 2] + R[i + 3]) * 0.5;
      var si = (I[i] + I[i + 1] + I[i + 2] + I[i + 3]) * 0.5;
      R[i] = sr - R[i]; R[i + 1] = sr - R[i + 1]; R[i + 2] = sr - R[i + 2]; R[i + 3] = sr - R[i + 3];
      I[i] = si - I[i]; I[i + 1] = si - I[i + 1]; I[i + 2] = si - I[i + 2]; I[i + 3] = si - I[i + 3];
    }
    R2.fill(0); I2.fill(0);
    // flip-flop shift: move along the coin's direction and reverse the coin
    for (j = 0; j < ny; j++) {
      var jp = (j === ny - 1 ? 0 : j + 1), jm = (j === 0 ? ny - 1 : j - 1);
      for (i = 0; i < nx; i++) {
        var ip = (i === nx - 1 ? 0 : i + 1), im = (i === 0 ? nx - 1 : i - 1);
        var s0 = (j * nx + i) * 4;
        var d0 = (j * nx + ip) * 4 + 1, d1 = (j * nx + im) * 4, d2 = (jp * nx + i) * 4 + 3, d3 = (jm * nx + i) * 4 + 2;
        R2[d0] += R[s0];     I2[d0] += I[s0];
        R2[d1] += R[s0 + 1]; I2[d1] += I[s0 + 1];
        R2[d2] += R[s0 + 2]; I2[d2] += I[s0 + 2];
        R2[d3] += R[s0 + 3]; I2[d3] += I[s0 + 3];
      }
    }
    this.R = R2; this.I = I2; this.R2 = R; this.I2 = I;
  };
  DTQW.prototype.measure = function () {
    var n = this.nx * this.ny, R = this.R, I = this.I, m = 0, k;
    for (k = 0; k < n; k++) {
      var o = k * 4;
      var p = R[o] * R[o] + I[o] * I[o] + R[o + 1] * R[o + 1] + I[o + 1] * I[o + 1] +
              R[o + 2] * R[o + 2] + I[o + 2] * I[o + 2] + R[o + 3] * R[o + 3] + I[o + 3] * I[o + 3];
      this.curP[k] = p; if (p > m) m = p;
      this.ph[k] = Math.atan2(I[o] + I[o + 1] + I[o + 2] + I[o + 3], R[o] + R[o + 1] + R[o + 2] + R[o + 3]);
    }
    this.max = m || 1e-6;
  };
  DTQW.prototype.draw = function (t) {
    var ctx = this.ctx, s = this.spacing, nx = this.nx, ny = this.ny, i, j;
    ctx.clearRect(0, 0, this.w, this.h);
    camOpen(this);
    ctx.fillStyle = latticeStyle(this.alpha);
    for (j = 0; j < ny; j++) for (i = 0; i < nx; i++) {
      ctx.fillRect(this.ox + i * s - 0.75, this.oy + j * s - 0.75, 1.5, 1.5);
    }
    // sqrt compresses the walk's very peaked distribution into a visible range
    var rMax = s * 0.46, inv = 1 / this.max;
    for (j = 0; j < ny; j++) {
      var y = this.oy + j * s;
      for (i = 0; i < nx; i++) {
        var k = j * nx + i;
        var p = (this.prevP[k] + (this.curP[k] - this.prevP[k]) * t) * inv;
        if (p < 0.0004) continue;
        var amp = Math.pow(Math.min(p, 1), 0.22);
        paint(ctx, this.ox + i * s, y, rMax * amp, amp, this.ph[k], this.alpha);
      }
    }
    ctx.restore();
  };
  DTQW.prototype.redraw = function () { this.draw(this.done < this.steps ? Math.min(1, this.acc / this.stepMs) : 1); };
  DTQW.prototype.bounds = function () {
    var s = this.spacing;
    return { x0: this.ox, y0: this.oy, x1: this.ox + (this.nx - 1) * s, y1: this.oy + (this.ny - 1) * s, cell: s };
  };
  DTQW.prototype.frame = function (dt) {
    this.age += dt;
    this.alpha = Math.min(easeOut(this.age / 1.6), 1 - smooth((this.age - (this.cycle - 1.8)) / 1.8));
    if (this.age > this.cycle) { this.restart(); return; }
    this.acc += dt;
    while (this.acc >= this.stepMs && this.done < this.steps) {
      this.prevP.set(this.curP);
      this.step(); this.measure();
      this.acc -= this.stepMs; this.done++;
    }
    this.draw(this.done < this.steps ? Math.min(1, this.acc / this.stepMs) : 1);
  };
  DTQW.prototype.still = function () {
    var n = Math.floor(this.steps * 0.8);
    for (var k = 0; k < n; k++) this.step();
    this.measure(); this.prevP.set(this.curP);
    this.done = n; this.alpha = 1; this.draw(1);
  };

  /* ==================================================================
     statevector — what QarpEngine actually returns
     12 qubits, so 4,096 complex amplitudes, rebuilt every frame from
     |0...0> through the exact circuit HEABlock(12, 4, real=False,
     linear=False, circular=False, use_cz=True) builds: per layer, Ry then
     Rz on every qubit, then CZ on the even pairs and the odd pairs. Only
     the angles differ, drifting instead of being bound once. The grid is
     the state under a bipartition: the low 6 qubits index the column, the
     high 6 index the row.
     ================================================================== */

  var NQ = 12, DIM = 1 << NQ, SIDE = 1 << (NQ / 2), LAYERS = 4;

  function StateVector(cv) {
    this.cv = cv; this.ctx = cv.getContext("2d");
    this.re = new Float64Array(DIM); this.im = new Float64Array(DIM);
    this.alpha = 0; this.age = 0; this.gain = 1;
    var r = rngFrom(11);
    // Every rotation gets its own rate, so the pattern never repeats and
    // different regions of the grid move at visibly different speeds.
    this.base = []; this.drift = []; this.rate = [];
    this.zbase = []; this.zdrift = []; this.zrate = [];
    for (var l = 0; l < LAYERS; l++) {
      for (var q = 0; q < NQ; q++) {
        this.base.push(0.45 + 2.2 * r());
        this.drift.push(6.283 * r());
        this.rate.push(0.322 + 0.434 * r());
        this.zbase.push(6.283 * r());
        this.zdrift.push(6.283 * r());
        this.zrate.push(0.238 + 0.385 * r());
      }
    }
    this.resize();
  }
  StateVector.prototype.resize = function () {
    var d = fitCanvas(this.cv);
    this.w = d.w; this.h = d.h;
    this.cell = Math.max(d.w / SIDE, d.h / SIDE);
    this.ox = (d.w - SIDE * this.cell) / 2 + this.cell / 2;
    this.oy = (d.h - SIDE * this.cell) / 2 + this.cell / 2;
  };
  StateVector.prototype.restart = function () { this.age = 0; this.alpha = 0; this.gain = 1; };
  StateVector.prototype.ry = function (q, th) {
    var c = Math.cos(th / 2), s = Math.sin(th / 2);
    var re = this.re, im = this.im, bit = 1 << q;
    for (var i = 0; i < DIM; i++) {
      if (i & bit) continue;
      var k = i | bit;
      var ar = re[i], ai = im[i], br = re[k], bi = im[k];
      re[i] = c * ar - s * br; im[i] = c * ai - s * bi;
      re[k] = s * ar + c * br; im[k] = s * ai + c * bi;
    }
  };
  StateVector.prototype.rz = function (q, th) {
    var c = Math.cos(th / 2), s = Math.sin(th / 2);
    var re = this.re, im = this.im, bit = 1 << q;
    for (var i = 0; i < DIM; i++) {
      var sg = (i & bit) ? s : -s;               // e^{-i th Z / 2}
      var ar = re[i], ai = im[i];
      re[i] = ar * c - ai * sg; im[i] = ar * sg + ai * c;
    }
  };
  StateVector.prototype.cz = function (a, b) {
    var re = this.re, im = this.im, m = (1 << a) | (1 << b);
    for (var i = 0; i < DIM; i++) if ((i & m) === m) { re[i] = -re[i]; im[i] = -im[i]; }
  };
  StateVector.prototype.build = function (t) {
    var re = this.re, im = this.im, i, l, q;
    re.fill(0); im.fill(0); re[0] = 1;
    var k = 0;
    for (l = 0; l < LAYERS; l++) {
      for (q = 0; q < NQ; q++, k++) {
        this.ry(q, this.base[k] + 0.75 * Math.sin(this.rate[k] * t + this.drift[k]));
        // Rz carries the phase, which is what makes the hue field move rather
        // than just the dot sizes; it is a real gate, not a global phase.
        this.rz(q, this.zbase[k] + 1.30 * Math.sin(this.zrate[k] * t + this.zdrift[k]));
      }
      // HEABlock's brickwork applies both pair sets in every layer, even
      // then odd — not one set per layer. Match it exactly, since the caption
      // names the class.
      for (q = 0; q + 1 < NQ; q += 2) this.cz(q, q + 1);
      for (q = 1; q + 1 < NQ; q += 2) this.cz(q, q + 1);
    }
    var m = 0;
    for (i = 0; i < DIM; i++) { var p = re[i] * re[i] + im[i] * im[i]; if (p > m) m = p; }
    this.max = m || 1e-9;
  };
  StateVector.prototype.draw = function () {
    var ctx = this.ctx, c = this.cell, re = this.re, im = this.im;
    ctx.clearRect(0, 0, this.w, this.h);
    this.gain += (1 / this.max - this.gain) * 0.05;
    var rMax = c * 0.264, v = camView(this);
    camOpen(this);
    // One fill per colour instead of one per dot: hue and alpha are quantised
    // (40 x 32 steps; 16 x 16 was visibly stepped) and every dot of a bucket
    // goes into the same path, so 4,096 fills become at most 1,280.
    var HUES = 40, ALPHAS = 32, buckets = this.buckets || (this.buckets = new Array(HUES * ALPHAS));
    for (var k = 0; k < buckets.length; k++) buckets[k] = null;
    for (var row = 0; row < SIDE; row++) {
      var y = this.oy + row * c;
      if (y < v.y0 - c || y > v.y1 + c) continue;
      for (var col = 0; col < SIDE; col++) {
        var x = this.ox + col * c;
        if (x < v.x0 - c || x > v.x1 + c) continue;
        var i = (row << (NQ / 2)) | col;   // high qubits pick the row, low the column
        var p = (re[i] * re[i] + im[i] * im[i]) * this.gain;
        if (p < 0.0006) continue;
        var amp = Math.pow(Math.min(p, 1), 0.30);
        var hue = Math.round((0.5 + 0.5 * Math.cos(Math.atan2(im[i], re[i]))) * (HUES - 1));
        var al = Math.round(Math.min(1, TH.floor + TH.gainA * amp) * (ALPHAS - 1));
        var b = buckets[hue * ALPHAS + al] || (buckets[hue * ALPHAS + al] = []);
        b.push(x, y, rMax * amp);
      }
    }
    var a = TH.dot0, bb = TH.dot1;
    for (var h = 0; h < HUES; h++) {
      var t = h / (HUES - 1);
      var cr = Math.round(a[0] + (bb[0] - a[0]) * t), cg = Math.round(a[1] + (bb[1] - a[1]) * t), cb = Math.round(a[2] + (bb[2] - a[2]) * t);
      for (var q = 0; q < ALPHAS; q++) {
        var dots = buckets[h * ALPHAS + q];
        if (!dots) continue;
        ctx.fillStyle = "rgba(" + cr + "," + cg + "," + cb + "," + (this.alpha * q / (ALPHAS - 1)).toFixed(3) + ")";
        ctx.beginPath();
        for (var d = 0; d < dots.length; d += 3) { ctx.moveTo(dots[d] + dots[d + 2], dots[d + 1]); ctx.arc(dots[d], dots[d + 1], dots[d + 2], 0, 6.2832); }
        ctx.fill();
      }
    }
    ctx.restore();
  };
  StateVector.prototype.redraw = function () { this.draw(); };
  StateVector.prototype.bounds = function () {
    var c = this.cell;
    return { x0: this.ox, y0: this.oy, x1: this.ox + (SIDE - 1) * c, y1: this.oy + (SIDE - 1) * c, cell: c };
  };
  // Which basis state is under this point, if a dot was actually drawn there.
  // Coordinates are CSS pixels relative to the canvas, matching draw().
  StateVector.prototype.probe = function (px, py) {
    if (this.cam) {   // screen -> field, the inverse of camOpen
      px = this.cam.x + (px - this.w / 2) / this.cam.z;
      py = this.cam.y + (py - this.h / 2) / this.cam.z;
    }
    var col = Math.round((px - this.ox) / this.cell);
    var row = Math.round((py - this.oy) / this.cell);
    if (col < 0 || col >= SIDE || row < 0 || row >= SIDE) return null;
    var i = (row << (NQ / 2)) | col;
    var re = this.re[i], im = this.im[i], p = re * re + im * im;
    if (p * this.gain < 0.0006) return null;   // below the draw threshold: no dot here
    return {
      index: i, nq: NQ, row: row, col: col,
      re: re, im: im, prob: p,
      mod: Math.sqrt(p), phase: Math.atan2(im, re)
    };
  };

  StateVector.prototype.frame = function (dt) {
    this.age += dt;
    this.alpha = easeOut(this.age / 1.8);
    this.build(this.age); this.draw();
  };
  StateVector.prototype.still = function () {
    this.age = 9; this.alpha = 1; this.gain = 1;
    this.build(this.age);
    this.gain = 1 / this.max;
    this.draw();
  };

  // Each field gets its own caption: the line under the hero has to describe
  // what is actually being computed, not what used to be.
  global.QARP_HERO_CAPTIONS = {
    continuous: "Behind this text: a two-dimensional quantum walk, integrated live in your browser.",
    dtqw: "Behind this text: a discrete-time quantum walk \u2014 Grover coin, then shift \u2014 stepping live in your browser.",
    statevector: "Behind this text: 4,096 live amplitudes of a 12-qubit HEABlock. Hover a dot to read one."
  };

  // what the pause control is pausing, so its label names the right thing
  global.QARP_HERO_SUBJECT = {
    continuous: "the quantum walk",
    dtqw: "the quantum walk",
    statevector: "the circuit"
  };

  global.QARP_HERO_FIELDS = {
    continuous: function (cv) { return new Continuous(cv); },
    dtqw: function (cv) { return new DTQW(cv); },
    statevector: function (cv) { return new StateVector(cv); }
  };
})(window);
