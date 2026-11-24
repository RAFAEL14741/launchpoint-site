/* Pricing v2 motion (Nov 24 2026): Apple-style reveals, scroll-linked price card,
   one-time/monthly toggle (glass pill comes from glass.js), smooth "Good to know". */
(function () {
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.getElementById('pricing');
  if (!root) return;

  /* 1. staggered reveals: siblings in the same parent get rising delays */
  var els = [].slice.call(root.querySelectorAll('[data-rv]'));
  if (!reduce && 'IntersectionObserver' in window) {
    els.forEach(function (el) {
      var sib = [].slice.call(el.parentNode.children).filter(function (c) { return c.hasAttribute('data-rv'); });
      el.style.setProperty('--d', Math.min(sib.indexOf(el), 7));
    });
    document.documentElement.classList.add('rv-on');
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (el) {
      /* anything already scrolled past (hash landing) shows at once */
      if (el.getBoundingClientRect().bottom < 0) el.classList.add('in'); else io.observe(el);
    });
  }

  /* 2. price card grows and its glow warms as it rises into view */
  var pq = document.getElementById('pq');
  if (pq && !reduce) {
    var tick = 0;
    var upd = function () {
      tick = 0;
      var r = pq.getBoundingClientRect(), vh = innerHeight;
      var p = Math.max(0, Math.min(1, (vh - r.top) / (vh * 0.7)));
      p = 1 - Math.pow(1 - p, 3);
      pq.style.setProperty('--pg', p.toFixed(3));
    };
    addEventListener('scroll', function () { if (!tick) tick = requestAnimationFrame(upd); }, { passive: true });
    addEventListener('resize', upd); upd();
  }

  /* 3. one-time / monthly */
  var tog = document.getElementById('prTog'), box = document.getElementById('pxBox'), note = document.getElementById('pxNote');
  var notes = ['Priced by what you actually need. Always fair.', 'Optional. Cancel anytime.'];
  if (tog && box) {
    var panes = [].slice.call(box.querySelectorAll('.px-pane'));
    tog.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b || b.getAttribute('aria-pressed') === 'true') return;
      var n = +b.dataset.p;
      [].forEach.call(tog.querySelectorAll('button'), function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      var h0 = box.offsetHeight;
      panes.forEach(function (p, i) { p.classList.toggle('on', i === n); p.setAttribute('aria-hidden', i === n ? 'false' : 'true'); });
      if (note) { note.style.opacity = 0; setTimeout(function () { note.textContent = notes[n]; note.style.opacity = ''; }, 200); }
      if (reduce) return;
      var h1 = panes[n].offsetHeight;
      box.style.height = h0 + 'px'; box.offsetHeight;
      box.style.height = h1 + 'px';
      clearTimeout(box._t); box._t = setTimeout(function () { box.style.height = ''; }, 650);
    });
  }

  /* 4. "Good to know" opens and closes with height motion instead of a jump */
  var d = root.querySelector('.pf'), body = d && d.querySelector('.pf-b');
  if (d && body && !reduce) {
    d.querySelector('summary').addEventListener('click', function (e) {
      e.preventDefault();
      if (d.open) {
        body.style.height = body.scrollHeight + 'px'; body.offsetHeight; body.style.height = '0px';
        setTimeout(function () { d.open = false; body.style.height = ''; }, 560);
      } else {
        d.open = true; body.style.height = '0px'; body.offsetHeight;
        body.style.height = body.scrollHeight + 'px';
        setTimeout(function () { body.style.height = ''; }, 560);
      }
    });
  }
})();
