/* Liquid glass controls (Nov 24 2026).
   Motion ported from uibrik's Segmented Control (21st.dev, free): one pill slides
   between options on a spring, squishes when the selected option is pressed, and
   can be dragged across the others (iOS style). Skin follows jahed's "Apple Tahoe
   Liquid Glass Button" frost path: blur + saturate lens, two-tone rim light and a
   pointer-tracked glow. Refraction maps skipped on purpose: the site's ground is
   near-black, so the bend is invisible and costs iPhone GPU memory. */
(function () {
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* Spring: same maths as the glass component (duration + bounce -> stiffness/damping) */
  function Spring(v, duration, bounce) {
    var w = (2 * Math.PI) / duration;
    this.k = w * w;
    this.c = bounce >= 0 ? (4 * Math.PI * (1 - bounce)) / duration : (4 * Math.PI) / (duration * (1 + bounce));
    this.v = v; this.t = v; this.vel = 0;
  }
  Spring.prototype.step = function (dt) {
    var a = -this.k * (this.v - this.t) - this.c * this.vel;
    this.vel += a * dt; this.v += this.vel * dt;
    if (Math.abs(this.v - this.t) < 0.05 && Math.abs(this.vel) < 0.05) { this.v = this.t; this.vel = 0; return true; }
    return false;
  };
  Spring.prototype.jump = function (v) { this.v = this.t = v; this.vel = 0; };

  /* Pointer glow on every glass surface */
  function glow(el) {
    if (!finePointer) return;
    el.addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect();
      el.style.setProperty('--gx', (e.clientX - r.left) + 'px');
      el.style.setProperty('--gy', (e.clientY - r.top) + 'px');
    });
    el.addEventListener('pointerenter', function () { el.style.setProperty('--glow', '1'); });
    el.addEventListener('pointerleave', function () { el.style.setProperty('--glow', '0'); });
  }

  /* Sliding pill for one segmented group */
  function pill(seg, attr) {
    attr = attr || 'aria-pressed';
    var btns = [].slice.call(seg.querySelectorAll('button'));
    if (!btns.length) return;
    var p = document.createElement('i');
    p.className = 'lg-pill'; p.setAttribute('aria-hidden', 'true');
    seg.prepend(p); seg.classList.add('lg-seg');
    var L = new Spring(0, 0.38, 0), R = new Spring(0, 0.38, 0), S = new Spring(1, 0.25, 0);
    var fastL = new Spring(0, 0.26, 0), fastR = new Spring(0, 0.26, 0);
    var raf = 0, last = 0, held = -1, first = true, dir = 0;

    function sel() { for (var i = 0; i < btns.length; i++) if (btns[i].getAttribute(attr) === 'true') return i; return -1; }
    function box(i) { var b = btns[i]; return { l: b.offsetLeft, r: b.offsetLeft + b.offsetWidth, t: b.offsetTop, h: b.offsetHeight }; }
    function paint() {
      /* leading edge rides the fast spring, trailing edge the slow one = stretch while travelling */
      var l = dir > 0 ? L.v : fastL.v, r = dir > 0 ? fastR.v : R.v;
      if (dir === 0) { l = L.v; r = R.v; }
      p.style.transform = 'translate3d(' + l.toFixed(2) + 'px,0,0) scale(' + S.v.toFixed(4) + ')';
      p.style.width = Math.max(0, r - l).toFixed(2) + 'px';
    }
    function tick(now) {
      var dt = Math.min(0.032, (now - last) / 1000 || 0.016); last = now;
      var done = L.step(dt) & R.step(dt) & S.step(dt) & fastL.step(dt) & fastR.step(dt);
      paint();
      raf = done ? 0 : requestAnimationFrame(tick);
    }
    function go(i) {
      if (i < 0) { p.style.opacity = '0'; return; }
      var b = box(i);
      p.style.opacity = '1'; p.style.top = b.t + 'px'; p.style.height = b.h + 'px';
      if (first || reduce) { first = false; [L, fastL].forEach(function (s) { s.jump(b.l); }); [R, fastR].forEach(function (s) { s.jump(b.r); }); paint(); return; }
      dir = b.l > L.t ? 1 : b.l < L.t ? -1 : 0;
      L.t = fastL.t = b.l; R.t = fastR.t = b.r;
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
    }
    function squish(on) { S.t = on ? 0.94 : 1; if (reduce) S.jump(S.t); if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } }

    /* follow the real selection, whatever sets it (click, Surprise me, code) */
    new MutationObserver(function () { if (held < 0) go(sel()); }).observe(seg, { subtree: true, attributes: true, attributeFilter: [attr] });
    if ('ResizeObserver' in window) new ResizeObserver(function () { first = true; go(held >= 0 ? held : sel()); }).observe(seg);

    /* iOS-style scrub: press the selected option and drag across the others */
    var scrubbed = false, swallow = false;
    /* after a scrub the browser still fires a click on the option the press started on; eat it */
    seg.addEventListener('click', function (e) { if (swallow && e.isTrusted) { swallow = false; e.stopImmediatePropagation(); e.preventDefault(); } }, true);
    function nearest(x) {
      var best = 0, d = 1e9;
      btns.forEach(function (b, i) { var r = b.getBoundingClientRect(); var dd = x < r.left ? r.left - x : x > r.right ? x - r.right : 0; if (dd < d) { d = dd; best = i; } });
      return best;
    }
    btns.forEach(function (b, i) {
      b.addEventListener('pointerdown', function (e) {
        if (e.button !== 0) return;
        scrubbed = false; swallow = false;
        squish(true);
        if (i === sel()) { held = i; try { b.setPointerCapture(e.pointerId); } catch (_) {} }
      });
      b.addEventListener('pointermove', function (e) {
        if (held < 0) return;
        var n = nearest(e.clientX);
        if (n !== held) { held = n; scrubbed = true; go(n); }
      });
      function end(commit) {
        squish(false);
        if (held < 0) return;
        var n = held; held = -1;
        if (commit && scrubbed && n !== sel()) { btns[n].click(); swallow = true; setTimeout(function () { swallow = false; }, 400); } else go(sel());
      }
      b.addEventListener('pointerup', function () { end(true); });
      b.addEventListener('pointercancel', function () { end(false); });
      b.addEventListener('lostpointercapture', function () { if (held >= 0) end(true); });
      
    });
    requestAnimationFrame(function () { go(sel()); });
  }

  function init() {
    document.querySelectorAll('#cfg .bar2 .seg').forEach(function (s) { pill(s); });
    var ct = document.querySelector('#cfg .ctabs');
    if (ct) { pill(ct, 'aria-selected'); ct.classList.add('lg-tabs'); }
    var panel = document.querySelector('#cfg .ctl');
    if (panel) { panel.classList.add('lg-sheet'); glow(panel); }
    /* the orange trail is drawn once from the page height; redraw it whenever that height changes
       (Customize opening, late images), so it never cuts through content */
    var story = document.getElementById('story');
    if (story && 'ResizeObserver' in window && typeof R !== 'undefined' && R.build) {
      var h0 = story.scrollHeight, t = 0;
      new ResizeObserver(function () {
        var h = story.scrollHeight; if (Math.abs(h - h0) < 2) return; h0 = h;
        clearTimeout(t); t = setTimeout(function () { R.build(); if (R.update) R.update(); }, 90);
      }).observe(story);
    }
    var glassSel = '#cfg .bar2 .seg,#cfg .acts .shuf,#cfg .more-b,#cfg .gnav,.snd,.xp,#cfg .tile .cap';
    document.querySelectorAll(glassSel).forEach(function (el) { el.classList.add('lg'); glow(el); });
    document.documentElement.classList.add('lg-on');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
