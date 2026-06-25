/* =========================================================
   ONROL — editorial / premium. One code path for every device.
   Progressive enhancement: the page is fully readable with JS
   off. All effects are event-driven or short — nothing polls
   per-frame except brief count-ups, so it stays light.
   ========================================================= */
'use strict';
/* This site is motion-forward by design, so animations always play — even when
   the OS "Reduce motion" setting is on (that was why the page looked static).
   Flip ALWAYS_ANIMATE to false to respect the user's reduced-motion preference. */
const ALWAYS_ANIMATE = true;
const prefersReduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const reduceMotion = ALWAYS_ANIMATE ? false : prefersReduce;
const root = document.documentElement;

/* ===== Disable page zoom ==================================================
   The viewport meta blocks mobile pinch-zoom; this blocks desktop ctrl+wheel
   (and trackpad pinch), ctrl +/-/0, and Safari's gesture zoom. */
(function () {
  window.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0'].indexOf(e.key) !== -1) e.preventDefault();
  });
  ['gesturestart', 'gesturechange', 'gestureend'].forEach((g) => window.addEventListener(g, (e) => e.preventDefault()));
})();

/* ===== Smooth inertia scroll (Lenis) — the gliding, momentum feel ===========
   Lenis scrolls the real window, so every existing scroll-driven effect
   (progress bar, parallax, velocity marquee) keeps working — just smoothed.
   `lenis` is shared at module scope so the track-detail modal can pause it. */
let lenis = null;
(function () {
  if (reduceMotion || typeof Lenis === 'undefined') return;
  lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // expo-out: heavy glide that settles softly
    smoothWheel: true,
    syncTouch: false // leave native touch momentum alone on phones/trackpads-as-touch
  });
  (function raf(time) { lenis.raf(time); requestAnimationFrame(raf); })(0);

  // route in-page anchor jumps through Lenis so they glide instead of snapping
  const navH = parseInt(getComputedStyle(root).getPropertyValue('--nav-h'), 10) || 62;
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const href = a.getAttribute('href');
      if (!href || href === '#') return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: href === '#top' ? 0 : -(navH + 4) });
    });
  });
})();

/* ===== Theme toggle (light default, dark optional) ===== */
(function () {
  const btn = document.getElementById('themeBtn');
  if (!btn) return;
  function apply() {
    const dark = root.classList.contains('dark');
    btn.textContent = dark ? '☀' : '☾';
    btn.setAttribute('aria-label', dark ? 'Switch to light' : 'Switch to dark');
  }
  btn.addEventListener('click', () => {
    const dark = root.classList.toggle('dark');
    try { localStorage.setItem('onrol-theme', dark ? 'dark' : 'light'); } catch (e) {}
    apply();
  });
  apply();
})();

/* ===== Scroll progress bar (rAF-throttled; cheap) ===== */
(function () {
  const bar = document.getElementById('scrollProg');
  if (!bar) return;
  let ticking = false;
  function update() {
    ticking = false;
    const h = document.documentElement.scrollHeight - window.innerHeight;
    const p = h > 0 ? Math.min(1, Math.max(0, window.scrollY / h)) : 0;
    bar.style.height = (p * (window.innerHeight - 56)).toFixed(1) + 'px';
  }
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  window.addEventListener('resize', update, { passive: true });
  update();
})();

/* ===== Stagger indices for grid children (drives --i in the reveal delay) ===== */
(function () {
  document.querySelectorAll('.cards, .steps, .metrics, .chips').forEach((group) => {
    Array.prototype.forEach.call(group.children, (child, i) => child.style.setProperty('--i', i));
  });
})();

/* ===== Segment reveal (cells build one-by-one) =============================
   Every cell in a ruled grid (steps, tracks, metrics, chips, footer) wipes in
   on its own stagger as its grid scrolls into view — the section assembles
   itself segment by segment. Claims those cells off the generic .reveal path
   (it runs first) so there's no double-animation; the hero's text keeps .reveal. */
(function () {
  if (reduceMotion || !('IntersectionObserver' in window)) return;
  const grids = document.querySelectorAll('.mod:not(.hero) .cells, .foot__grid');
  if (!grids.length) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      Array.prototype.forEach.call(e.target.querySelectorAll(':scope > .cell'), (c, i) => {
        c.style.setProperty('--i', i);
        c.classList.add('is-in');
      });
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  grids.forEach((g) => {
    Array.prototype.forEach.call(g.querySelectorAll(':scope > .cell'), (c) => {
      c.classList.remove('reveal'); // hand control of cells to the segment wipe
      c.classList.add('seg');
    });
    io.observe(g);
  });
})();

/* ===== Cursor spotlight on tiles (GitHub-style) ==========================
   Feed the hovered cell the pointer position so its gradient border lights up
   toward the cursor. Delegated + rAF-throttled so it's one write per frame. */
(function () {
  if (reduceMotion || !(window.matchMedia && window.matchMedia('(pointer: fine)').matches)) return;
  let raf = 0, cell = null, x = 0, y = 0;
  function apply() { raf = 0; if (cell) { cell.style.setProperty('--mx', x + 'px'); cell.style.setProperty('--my', y + 'px'); } }
  document.addEventListener('mousemove', (e) => {
    const t = e.target.closest ? e.target.closest('.cell') : null;
    if (!t) return;
    const r = t.getBoundingClientRect();
    x = e.clientX - r.left; y = e.clientY - r.top; cell = t;
    if (!raf) raf = requestAnimationFrame(apply);
  }, { passive: true });
})();

/* ===== Reveal on scroll ===== */
(function () {
  const items = document.querySelectorAll('.reveal');
  if (!items.length) return;
  if (reduceMotion || !('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  items.forEach((el) => io.observe(el));
})();

/* ===== Count-up metrics ===== */
(function () {
  const nums = document.querySelectorAll('.metric__num');
  if (!nums.length || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target; io.unobserve(el);
      const raw = el.textContent.trim();
      const m = raw.match(/[\d.,]+/);
      if (!m || reduceMotion) return;
      const target = parseFloat(m[0].replace(/,/g, ''));
      const dec = (m[0].split('.')[1] || '').length;
      const pre = raw.slice(0, m.index), suf = raw.slice(m.index + m[0].length);
      const t0 = performance.now(), dur = 1300;
      (function tick(now) {
        const p = Math.min(1, (now - t0) / dur);
        const v = target * (1 - Math.pow(1 - p, 3));
        const s = dec ? v.toFixed(dec) : Math.round(v).toLocaleString('en-US');
        el.textContent = pre + s + suf;
        if (p < 1) requestAnimationFrame(tick);
      })(t0);
    });
  }, { threshold: 0.4 });
  nums.forEach((n) => io.observe(n));
})();

/* ===== Live counter (nash-style: counts up, then ticks live) ===== */
(function () {
  const el = document.getElementById('liveNum');
  if (!el) return;
  let n = 10000;
  function render() { el.textContent = n.toLocaleString('en-US'); }
  if (reduceMotion) { render(); return; }
  // count up to the base on first view
  let shown = false;
  const start = () => {
    if (shown) return; shown = true;
    const t0 = performance.now(), dur = 1400, base = n; let cur = 0;
    (function tick(now) {
      const p = Math.min(1, (now - t0) / dur);
      cur = Math.round(base * (1 - Math.pow(1 - p, 3)));
      el.textContent = cur.toLocaleString('en-US');
      if (p < 1) requestAnimationFrame(tick);
      else { render(); live(); }
    })(t0);
  };
  // subtle "live" increments so it feels real (very light: one timer)
  function live() {
    setInterval(() => { n += Math.floor(Math.random() * 3) + 1; render(); }, 4200);
  }
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => { es.forEach((e) => { if (e.isIntersecting) { start(); io.disconnect(); } }); }, { threshold: 0.6 });
    io.observe(el);
  } else { start(); }
})();

/* ===== Track cards -> detail ===== */
(function () {
  const detail = document.getElementById('detail');
  if (!detail) return;
  const dEye = document.getElementById('dEye');
  const dTitle = document.getElementById('dTitle');
  const dLead = document.getElementById('dLead');
  const dList = document.getElementById('dList');
  let lastFocus = null;

  const DATA = [
    { eye: 'Track 01', title: 'AI Automations', lead: 'Automate the busywork so your day runs itself.', bullets: ['Lead routing & follow-ups', 'Research & summarization', 'Daily operations on autopilot'] },
    { eye: 'Track 02', title: 'AI Agents', lead: 'Agents that reason, call tools and finish multi-step tasks.', bullets: ['Tool & API calling', 'Multi-step task completion', 'Guardrails & evaluation'] },
    { eye: 'Track 03', title: 'Vibe-Coded Websites', lead: 'Ship polished, real products with AI-assisted coding.', bullets: ['AI-assisted coding', 'Deploy & iterate fast', 'Shippable apps and pages'] },
    { eye: 'Track 04', title: 'A real portfolio', lead: 'Everything you build is deployable and yours to show.', bullets: ['Live, shipped projects', 'Proof of execution', 'Something to show employers & clients'] }
  ];

  function open(i) {
    const d = DATA[i]; if (!d) return;
    lastFocus = document.activeElement;
    dEye.textContent = d.eye; dTitle.textContent = d.title; dLead.textContent = d.lead;
    dList.innerHTML = '';
    d.bullets.forEach((b) => { const li = document.createElement('li'); li.textContent = b; dList.appendChild(li); });
    detail.classList.add('is-open'); detail.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    if (lenis) lenis.stop();
    const c = document.getElementById('detailClose'); if (c) c.focus();
  }
  function close() {
    detail.classList.remove('is-open'); detail.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (lenis) lenis.start();
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  document.querySelectorAll('.card[data-detail]').forEach((c) => c.addEventListener('click', () => open(+c.dataset.detail)));
  document.getElementById('detailClose').addEventListener('click', close);
  detail.addEventListener('click', (e) => { if (e.target === detail) close(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && detail.classList.contains('is-open')) close(); });
})();

/* ===== Accordion ===== */
(function () {
  const acc = document.getElementById('acc');
  if (!acc) return;
  acc.addEventListener('click', (e) => {
    const head = e.target.closest('.acc__head'); if (!head) return;
    const row = head.closest('.acc__row');
    const open = row.classList.toggle('is-open');
    head.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
})();

/* ===== Demo (describe a task -> animated build) ===== */
(function () {
  const form = document.getElementById('demoForm');
  const input = document.getElementById('demoInput');
  const steps = document.getElementById('demoSteps');
  if (!form || !steps) return;
  let running = false;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (running) return;
    const task = (input.value || 'email new leads').trim();
    const plan = [
      'Understanding: "' + task + '"',
      'Planning the steps',
      'Calling tools & APIs',
      'Running the workflow',
      'Done — shipped'
    ];
    steps.innerHTML = '';
    const lis = plan.map((txt) => {
      const li = document.createElement('li');
      const tick = document.createElement('span'); tick.className = 'tick'; tick.textContent = '+';
      const label = document.createElement('span'); label.textContent = txt;
      li.appendChild(tick); li.appendChild(label); steps.appendChild(li); return li;
    });
    running = true;
    let i = 0;
    (function next() {
      if (i > 0) { lis[i - 1].classList.add('done'); lis[i - 1].querySelector('.tick').textContent = '✓'; }
      if (i < lis.length) { lis[i].classList.add('show'); i++; setTimeout(next, reduceMotion ? 180 : 680); }
      else running = false;
    })();
  });
})();

/* ===== Personas ===== */
(function () {
  const chips = document.getElementById('chips');
  const out = document.getElementById('chipsOut');
  if (!chips || !out) return;
  chips.addEventListener('click', (e) => {
    const c = e.target.closest('.chip'); if (!c) return;
    chips.querySelectorAll('.chip').forEach((x) => x.classList.toggle('is-active', x === c));
    out.innerHTML = '';
    out.appendChild(document.createTextNode('We’d start you on '));
    const em = document.createElement('em'); em.textContent = c.dataset.rec; out.appendChild(em);
    out.appendChild(document.createTextNode('.'));
  });
})();

/* ===== Apply ===== */
(function () {
  const form = document.getElementById('applyForm');
  const msg = document.getElementById('applyMsg');
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('applyName').value.trim();
    const email = document.getElementById('applyEmail').value.trim();
    if (!name || !email) return;
    msg.textContent = 'Thanks, ' + name + ' — opening your email to confirm…';
    setTimeout(() => {
      window.location.href = 'mailto:info@onrol.in?subject=' +
        encodeURIComponent('Application — ' + name) +
        '&body=' + encodeURIComponent('Name: ' + name + '\nEmail: ' + email + '\n\nI\'d like to apply to the next ONROL cohort.');
    }, 650);
  });
})();

/* =========================================================
   DYNAMIC MOTION (marinkurir-style). All transform/opacity,
   rAF-driven, reduced-motion aware, desktop-only where noted.
   ========================================================= */

/* ===== Letter-by-letter reveal + hover wave (marinkurir-style) =============
   Split headings into .word > .char spans so each letter can rise + fade on
   its own stagger (the signature "alive" feel). <br> line breaks and inline
   wrappers like .accent are preserved, so colour and layout are untouched. */
(function () {
  if (reduceMotion) return;

  // wrap every character of `el` in a span, keeping words intact (no mid-word
  // wrapping) and recursing through inline elements. Returns the char count.
  function split(el) {
    let i = 0;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach((child) => {
        if (child.nodeType === 3) { // text node -> words -> chars
          if (!child.textContent.trim()) return;
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((tok) => {
            if (tok === '') return;
            if (/^\s+$/.test(tok)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span'); w.className = 'word';
            Array.prototype.forEach.call(tok, (ch) => {
              const c = document.createElement('span'); c.className = 'char';
              c.style.setProperty('--c', i++); c.textContent = ch;
              w.appendChild(c);
            });
            frag.appendChild(w);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1 && child.nodeName !== 'BR') {
          walk(child); // recurse into .accent etc., preserving the wrapper
        }
      });
    })(el);
    return i;
  }

  // 1) Headings rise letter-by-letter as they scroll into view
  const heads = document.querySelectorAll('.hero__title, .sec-title, .apply__title');
  heads.forEach((el) => { split(el); el.classList.add('txt-reveal'); });
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    heads.forEach((el) => io.observe(el));
  } else { heads.forEach((el) => el.classList.add('is-in')); }

  // 2) Track-card titles ripple letter-by-letter on every hover
  document.querySelectorAll('.card__h').forEach((el) => { split(el); el.classList.add('txt-wave'); });
})();

/* ===== Velocity-reactive marquees ===== */
(function () {
  if (reduceMotion) return;
  const els = document.querySelectorAll('.marquee');
  if (!els.length) return;
  const MQ = Array.prototype.map.call(els, (m) => {
    const track = m.querySelector('.marquee__track');
    track.style.animation = 'none';
    const dir = m.classList.contains('marquee--rev') ? 1 : -1;
    const half = track.scrollWidth / 2 || 1;
    return { track, dir, half, x: dir < 0 ? 0 : -(track.scrollWidth / 2 || 1) };
  });
  window.addEventListener('resize', () => { MQ.forEach((m) => { m.half = m.track.scrollWidth / 2 || 1; }); }, { passive: true });
  let last = window.scrollY, vel = 0, prevT = 0;
  window.addEventListener('scroll', () => { const y = window.scrollY; vel += (y - last); last = y; }, { passive: true });
  function loop(t) {
    // dt is normalized to one 60fps frame, so the glide is identical on 60/120/144Hz
    // displays and self-corrects (rather than stuttering) when a frame is dropped.
    const dt = prevT ? Math.min(3, (t - prevT) / 16.667) : 1;
    prevT = t;
    vel *= Math.pow(0.9, dt);
    const av = Math.abs(vel);
    const skew = Math.max(-9, Math.min(9, vel * 0.32));
    MQ.forEach((m) => {
      m.x += (0.7 + av * 0.35) * m.dir * dt;
      if (m.dir < 0 && m.x <= -m.half) m.x += m.half;
      else if (m.dir > 0 && m.x >= 0) m.x -= m.half;
      m.track.style.transform = 'translate3d(' + m.x.toFixed(2) + 'px,0,0) skewX(' + skew.toFixed(2) + 'deg)';
    });
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();

/* ===== Parallax (numbers drift as they cross the viewport) ===== */
(function () {
  if (reduceMotion) return;
  const PX = [];
  document.querySelectorAll('.step__n').forEach((el) => PX.push([el, 0.14]));
  document.querySelectorAll('.metric__num').forEach((el) => PX.push([el, 0.1]));
  if (!PX.length) return;
  let ticking = false;
  function update() {
    ticking = false;
    const mid = window.innerHeight / 2;
    for (let i = 0; i < PX.length; i++) {
      const el = PX[i][0], sp = PX[i][1];
      const r = el.getBoundingClientRect();
      const c = (r.top + r.height / 2 - mid);
      // clamp so the drift always stays inside its grid cell (no overlap)
      const off = Math.max(-20, Math.min(20, c * -sp));
      el.style.transform = 'translate3d(0,' + off.toFixed(1) + 'px,0)';
    }
  }
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  window.addEventListener('resize', update, { passive: true });
  update();
})();

/* ===== Custom cursor: small pointy arrow (desktop) =====================
   A small arrow sits at the pointer. Native cursor is hidden only once
   this is live, so touch / reduced-motion / no-JS keep the system one. */
(function () {
  const cur = document.getElementById('cur');
  if (!cur || reduceMotion || !(window.matchMedia && window.matchMedia('(pointer: fine)').matches)) return;
  root.classList.add('cursor-on');
  let x = 0, y = 0, raf = 0, on = false, pressed = false;
  function loop() {
    raf = 0;
    cur.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)' + (pressed ? ' scale(.8)' : '');
  }
  window.addEventListener('mousemove', (e) => {
    x = e.clientX; y = e.clientY;
    if (!on) { on = true; cur.classList.add('is-on'); }
    if (!raf) raf = requestAnimationFrame(loop);
  }, { passive: true });
  document.addEventListener('mouseleave', () => { on = false; cur.classList.remove('is-on'); if (!raf) raf = requestAnimationFrame(loop); });
  window.addEventListener('mousedown', () => { pressed = true; if (!raf) raf = requestAnimationFrame(loop); });
  window.addEventListener('mouseup', () => { pressed = false; if (!raf) raf = requestAnimationFrame(loop); });
})();

/* ===== Magnetic buttons (desktop) ===== */
(function () {
  if (reduceMotion || !(window.matchMedia && window.matchMedia('(pointer: fine)').matches)) return;
  document.querySelectorAll('.btn, .icon-btn').forEach((el) => {
    let mx = 0, my = 0, raf = 0;
    function apply() { raf = 0; el.style.transform = 'translate3d(' + (mx * 0.3).toFixed(1) + 'px,' + (my * 0.45).toFixed(1) + 'px,0)'; }
    el.addEventListener('mousemove', (e) => {
      // collapse the several mousemove events that fire per frame into one transform write
      const r = el.getBoundingClientRect();
      mx = e.clientX - (r.left + r.width / 2);
      my = e.clientY - (r.top + r.height / 2);
      if (!raf) raf = requestAnimationFrame(apply);
    });
    el.addEventListener('mouseleave', () => {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      el.style.transition = 'transform .4s cubic-bezier(.16,1,.3,1)'; el.style.transform = '';
      setTimeout(() => { el.style.transition = ''; }, 420);
    });
  });
})();

/* ===== Brand wordmark: typewriter cycle through Indian languages ===== */
(function () {
  const brand = document.querySelector('.nav__brand');
  if (!brand) return;
  // "Onrol" across Indian scripts (approximate phonetic transliterations — tweak freely).
  const names = ['ONROL', 'ऑनरोल', 'অনরোল', 'ஒன்ரோல்', 'ఒన్రోల్', 'ಒನ್ರೋಲ್', 'ഓൺറോൾ', 'ઓનરોલ', 'ਓਨਰੋਲ', 'ଓନରୋଲ', 'اونرول'];
  if (reduceMotion) { brand.textContent = 'ONROL'; return; }   // honour reduced-motion: stay static
  const TYPE = 90, ERASE = 45, HOLD = 2600, GAP = 400;
  let i = 0;
  brand.classList.add('brand-type');
  brand.textContent = '';
  function typeIn(word, done) {
    const chars = Array.from(word); let n = 0;
    (function step() {
      brand.textContent = chars.slice(0, ++n).join('');
      setTimeout(n < chars.length ? step : done, n < chars.length ? TYPE : HOLD);
    })();
  }
  function eraseOut(done) {
    let chars = Array.from(brand.textContent);
    (function step() {
      chars = chars.slice(0, -1);
      brand.textContent = chars.join('');
      setTimeout(chars.length ? step : done, chars.length ? ERASE : GAP);
    })();
  }
  (function loop() {
    typeIn(names[i], function () {
      eraseOut(function () { i = (i + 1) % names.length; loop(); });
    });
  })();
})();

/* ===== Pixel bot mascot (bottom-left): reacts to user actions, many emotions ===== */
(function () {
  const bot = document.getElementById('bot');
  if (!bot) return;
  const N = 20, cells = [];
  for (let i = 0; i < N * N; i++) { const d = document.createElement('span'); d.className = 'bot__px'; bot.appendChild(d); cells.push(d); }
  function clear() { for (const d of cells) d.className = 'bot__px'; }
  function on(x, y, soft) { x = Math.round(x); y = Math.round(y); if (x < 0 || x >= N || y < 0 || y >= N) return; cells[y * N + x].className = 'bot__px on' + (soft ? ' on--soft' : ''); }
  function box(x, y, w, h, soft) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) on(x + i, y + j, soft); }

  const L = 6, R = 13; // eye columns
  function eyeOpen(c) { box(c - 1, 6, 3, 3); }
  function eyeLine(c) { box(c - 1, 8, 3, 1); }
  function eyeArc(c) { on(c - 1, 7); on(c, 6); on(c + 1, 7); }
  function eyeBig(c) { box(c - 1, 5, 4, 4); }
  function eyeHeart(c, s) { on(c - 2, 6, s); on(c - 1, 5, s); on(c, 6, s); on(c + 1, 5, s); on(c + 2, 6, s); on(c - 1, 7, s); on(c + 1, 7, s); on(c, 8, s); }
  function smile() { on(6, 13); on(13, 13); on(7, 14); on(12, 14); on(8, 15); on(9, 15); on(10, 15); on(11, 15); }
  function grinMouth() { box(7, 12, 6, 1); on(6, 13); on(13, 13); on(7, 14); on(12, 14); on(8, 15); on(9, 15); on(10, 15); on(11, 15); box(8, 13, 4, 2, true); }
  function frown() { on(6, 15); on(13, 15); on(7, 14); on(12, 14); on(8, 13); on(9, 13); on(10, 13); on(11, 13); }
  function mouthO() { box(8, 12, 4, 3); }
  function smallMouth() { box(8, 14, 4, 1); }

  const faces = {
    happy:     function () { eyeOpen(L); eyeOpen(R); smile(); },
    grin:      function () { eyeArc(L); eyeArc(R); grinMouth(); },
    wink:      function () { eyeOpen(L); eyeLine(R); smile(); },
    surprised: function () { eyeBig(L); eyeBig(R); mouthO(); },
    love:      function () { eyeHeart(L); eyeHeart(R); smile(); on(3, 11, true); on(16, 11, true); },
    cool:      function () { box(3, 7, 6, 2); box(11, 7, 6, 2); on(9, 8); smile(); },
    sleepy:    function () { eyeLine(L); eyeLine(R); smallMouth(); on(15, 4, true); on(16, 3, true); },
    sad:       function () { eyeOpen(L); eyeOpen(R); frown(); on(4, 10, true); },
    blink:     function () { eyeLine(L); eyeLine(R); smile(); },
  };
  let current = 'happy';
  function show(n) { current = n; clear(); (faces[n] || faces.happy)(); }

  let holdUntil = 0, asleep = false, sleepAt = performance.now() + 13000;
  let pi = 0, switchAt = 0, blinkAt = 1800;
  const pool = ['happy', 'happy', 'grin', 'wink', 'cool', 'love'];
  function react(n, ms) { show(n); holdUntil = performance.now() + (ms || 900); }
  function wake() { sleepAt = performance.now() + 13000; if (asleep) { asleep = false; holdUntil = 0; } }
  function tick() {
    const t = performance.now();
    if (asleep) return;
    if (t < holdUntil) return;
    if (t > sleepAt) { asleep = true; show('sleepy'); return; }
    if (t > switchAt) { show(pool[pi++ % pool.length]); switchAt = t + 3200 + Math.random() * 1800; }
    if (t > blinkAt) { const p = current; clear(); faces.blink(); blinkAt = t + 3600 + Math.random() * 3000; setTimeout(function () { if (!asleep && performance.now() >= holdUntil) show(p); }, 130); }
  }
  show('happy');
  setInterval(tick, 300);

  window.addEventListener('mousedown', function () { react('surprised', 650); wake(); }, { passive: true });
  window.addEventListener('scroll', function () { react('grin', 600); wake(); }, { passive: true });
  window.addEventListener('mousemove', wake, { passive: true });
  window.addEventListener('keydown', wake);
  bot.addEventListener('mouseenter', function () { react('love', 1200); });
  bot.addEventListener('click', function (e) { e.stopPropagation(); react('love', 1500); });
  const tb = document.getElementById('themeBtn'); if (tb) tb.addEventListener('click', function () { react('wink', 900); });
  const af = document.getElementById('applyForm'); if (af) af.addEventListener('submit', function () { react('love', 1800); });
})();
