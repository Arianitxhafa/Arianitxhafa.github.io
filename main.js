// Arianit Xhafa — portfolio interactions (no dependencies). The 3D lanyard card lives in lanyard.js.
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Loading screen: the percentage follows real progress (fonts, page, photo, QR, 3D card), never faster than ~1 s ── */
  const loader = document.querySelector('.loader');
  window.siteReady = new Promise((resolve) => {
    if (!loader) return resolve();
    const num = loader.querySelector('.loader__num span');
    const bar = loader.querySelector('.loader__bar i');
    const label = loader.querySelector('.loader__label');
    const img = (src) => new Promise((r) => { const i = new Image(); i.onload = i.onerror = r; i.src = src; });
    const tasks = [
      document.fonts ? document.fonts.ready : Promise.resolve(),
      document.readyState === 'complete' ? Promise.resolve() : new Promise((r) => addEventListener('load', r, { once: true })),
      new Promise((r) => document.addEventListener('lanyard:ready', r, { once: true })),
      img('assets/me.webp'),
      img('assets/qr-linkedin.png'),
    ];
    let done = 0;
    tasks.forEach((t) => t.then(() => done++));
    const start = performance.now(), minMs = reduced ? 0 : 1100, maxMs = 8000;
    let shown = 0;
    const finish = () => {
      document.documentElement.classList.add('is-loaded');
      loader.setAttribute('aria-hidden', 'true');
      resolve();
    };
    const tick = (t) => {
      const elapsed = t - start;
      const real = elapsed > maxMs ? 100 : (done / tasks.length) * 100;
      const goal = Math.min(real, minMs ? (elapsed / minMs) * 100 : 100);
      shown = Math.min(goal, shown + Math.max(0.6, (goal - shown) * 0.14));
      const pct = Math.floor(shown);
      num.textContent = pct;
      bar.style.transform = `scaleX(${shown / 100})`;
      loader.setAttribute('aria-valuenow', pct);
      label.textContent = pct < 45 ? 'Loading assets…' : pct < 85 ? 'Building the 3D card…' : 'Almost there…';
      if (pct >= 100) return setTimeout(finish, reduced ? 0 : 260);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  /* ── About photo: a hologram scanner. The pointer leaves a fading trail that reveals a holographic, code-covered
     version of the photo, with a glowing lens at the pointer, sparks drifting off the trail, a scan line sweeping
     down and small glitches. A click or tap sends a ripple that reveals the whole hologram for a moment. ── */
  const reveal = document.querySelector('.intro__reveal');
  if (reveal && !reduced) {
    const pic = reveal.parentElement;
    const ctx = reveal.getContext('2d');
    const mask = document.createElement('canvas');
    const mctx = mask.getContext('2d');
    const layer = document.createElement('canvas');
    const lctx = layer.getContext('2d');
    const holo = new Image();
    // The hologram image (≈220 KB) loads only when the About photo is getting close, not with the first page load.
    new IntersectionObserver(([entry], io) => {
      if (entry.isIntersecting) { holo.src = reveal.dataset.src; io.disconnect(); }
    }, { rootMargin: '600px 0px' }).observe(reveal.parentElement);
    const trail = [], sparks = [], ripples = [];
    let raf = 0, w = 0, h = 0, dpr = 1, ptr = null, scan = 0, glitchUntil = 0, nextGlitch = 0, last = 0;
    const size = () => {
      dpr = Math.min(devicePixelRatio || 1, 2);
      w = pic.clientWidth; h = pic.clientHeight;
      for (const c of [reveal, mask, layer]) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    };
    const draw = (t) => {
      raf = 0;
      if (!w) size();
      const dt = Math.min(50, t - (last || t)); last = t;
      const now = performance.now();
      for (let i = trail.length - 1; i >= 0; i--) if (now - trail[i].t > 1100) trail.splice(i, 1);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, reveal.width, reveal.height);
      const busy = trail.length || sparks.length || ripples.length || ptr;
      if (!busy || !holo.naturalWidth) return; // (an image with no src yet counts as "complete")
      // 1. Mask: soft blobs along the trail, plus expanding ripples
      mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      mctx.clearRect(0, 0, w, h);
      for (const p of trail) {
        const life = 1 - (now - p.t) / 1100;
        const r = 30 + 44 * life;
        const g = mctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        g.addColorStop(0, `rgba(0,0,0,${0.95 * life})`); g.addColorStop(0.55, `rgba(0,0,0,${0.75 * life})`); g.addColorStop(1, 'rgba(0,0,0,0)');
        mctx.fillStyle = g;
        mctx.beginPath(); mctx.arc(p.x, p.y, r, 0, Math.PI * 2); mctx.fill();
      }
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i];
        rp.r += dt * 0.9; rp.life -= dt / 1400;
        if (rp.life <= 0) { ripples.splice(i, 1); continue; }
        mctx.fillStyle = `rgba(0,0,0,${Math.min(1, rp.life * 1.4)})`;
        mctx.beginPath(); mctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2); mctx.fill();
      }
      // 2. Hologram layer: the code photo, with a couple of glitched slices now and then
      lctx.setTransform(1, 0, 0, 1, 0, 0);
      lctx.clearRect(0, 0, layer.width, layer.height);
      lctx.drawImage(holo, 0, 0, layer.width, layer.height);
      if (now > nextGlitch) { glitchUntil = now + 120; nextGlitch = now + 600 + Math.random() * 900; }
      if (now < glitchUntil) {
        for (let k = 0; k < 3; k++) {
          const sy = Math.random() * layer.height, sh = (6 + Math.random() * 18) * dpr, off = (Math.random() - 0.5) * 22 * dpr;
          lctx.drawImage(holo, 0, (sy / layer.height) * holo.naturalHeight, holo.naturalWidth, (sh / layer.height) * holo.naturalHeight, off, sy, layer.width, sh);
        }
      }
      // Scan line sweeping down the photo
      scan = (scan + dt * 0.25) % (h + 60);
      const sg = lctx.createLinearGradient(0, (scan - 30) * dpr, 0, (scan + 4) * dpr);
      sg.addColorStop(0, 'rgba(140,210,255,0)'); sg.addColorStop(1, 'rgba(200,240,255,0.85)');
      lctx.globalCompositeOperation = 'source-atop';
      lctx.fillStyle = sg;
      lctx.fillRect(0, (scan - 30) * dpr, layer.width, 34 * dpr);
      lctx.globalCompositeOperation = 'destination-in';
      lctx.drawImage(mask, 0, 0);
      lctx.globalCompositeOperation = 'source-over';
      // 3. Composite: chromatic split (red/cyan ghosts), then the hologram itself
      ctx.globalAlpha = 0.35;
      ctx.globalCompositeOperation = 'lighter';
      ctx.filter = 'hue-rotate(150deg)';
      ctx.drawImage(layer, -3 * dpr, 0);
      ctx.filter = 'none';
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(layer, 0, 0);
      // 4. Lens glow at the pointer and ripple rings
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = 'lighter';
      if (ptr) {
        const g = ctx.createRadialGradient(ptr.x, ptr.y, 0, ptr.x, ptr.y, 46);
        g.addColorStop(0, 'rgba(120,180,255,0.35)'); g.addColorStop(1, 'rgba(120,180,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(ptr.x, ptr.y, 46, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(170,215,255,0.55)';
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(ptr.x, ptr.y, 30 + Math.sin(now / 160) * 3, 0, Math.PI * 2); ctx.stroke();
      }
      for (const rp of ripples) {
        ctx.strokeStyle = `rgba(150,205,255,${rp.life * 0.8})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2); ctx.stroke();
      }
      // 5. Sparks drifting up off the trail
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx * dt * 0.06; s.y += s.vy * dt * 0.06; s.vy -= dt * 0.0012; s.life -= dt / 900;
        if (s.life <= 0) { sparks.splice(i, 1); continue; }
        ctx.fillStyle = `rgba(${s.c},${s.life})`;
        ctx.fillRect(s.x, s.y, s.s, s.s);
      }
      ctx.globalCompositeOperation = 'source-over';
      raf = requestAnimationFrame(draw);
    };
    const wake = () => { if (!raf) raf = requestAnimationFrame(draw); };
    const at = (e) => { const r = pic.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    pic.addEventListener('pointermove', (e) => {
      const p = at(e), lastP = trail[trail.length - 1], t = performance.now();
      const steps = lastP ? Math.min(8, Math.floor(Math.hypot(p.x - lastP.x, p.y - lastP.y) / 12)) : 0;
      for (let i = 1; i <= steps; i++) trail.push({ x: lastP.x + ((p.x - lastP.x) * i) / (steps + 1), y: lastP.y + ((p.y - lastP.y) * i) / (steps + 1), t });
      trail.push({ ...p, t });
      if (trail.length > 180) trail.splice(0, trail.length - 180);
      ptr = p;
      for (let i = 0; i < 2; i++) {
        sparks.push({ x: p.x + (Math.random() - 0.5) * 30, y: p.y + (Math.random() - 0.5) * 30, vx: (Math.random() - 0.5) * 1.2, vy: -0.4 - Math.random() * 1.2, life: 1, s: 1 + Math.random() * 2, c: Math.random() < 0.5 ? '170,220,255' : '120,240,255' });
      }
      if (sparks.length > 220) sparks.splice(0, sparks.length - 220);
      wake();
    });
    pic.addEventListener('pointerleave', () => { ptr = null; });
    pic.addEventListener('pointerdown', (e) => {
      const p = at(e);
      ripples.push({ x: p.x, y: p.y, r: 8, life: 1 });
      for (let i = 0; i < 40; i++) {
        const a = Math.random() * Math.PI * 2, v = 1 + Math.random() * 3;
        sparks.push({ x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, s: 1.5 + Math.random() * 2, c: '170,220,255' });
      }
      window.__tick?.('flip');
      wake();
    });
    new ResizeObserver(size).observe(pic);
  }

  /* ── Starfield: twinkling, slowly drifting stars and a steady stream of shooting stars ── */
  const sky = document.querySelector('.sky');
  if (sky) {
    const ctx = sky.getContext('2d');
    let stars = [], w = 0, h = 0, dpr = 1, nextShot = 0, raf = 0, scrollY = 0, last = 0;
    const shots = [];
    const resize = () => {
      dpr = Math.min(devicePixelRatio || 1, 2);
      w = innerWidth; h = innerHeight;
      sky.width = w * dpr; sky.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(260, (w * h) / 5200));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        r: Math.random() < 0.08 ? 1.3 + Math.random() * 0.8 : 0.3 + Math.random() * 0.9,
        a: 0.25 + Math.random() * 0.7, t: Math.random() * Math.PI * 2, s: 0.4 + Math.random() * 1.6,
        depth: 0.2 + Math.random() * 0.8,
        warm: Math.random() < 0.12,
      }));
      if (reduced) draw(0);
    };
    const draw = (time) => {
      const dt = Math.min(50, time - (last || time)) / 16.7; // frames' worth of motion, steady at any refresh rate
      last = time;
      ctx.clearRect(0, 0, w, h);
      for (const st of stars) {
        if (!reduced) st.x -= 0.035 * st.depth * dt; // slow drift to the left
        if (st.x < -4) st.x += w + 8;
        const twinkle = reduced ? 1 : 0.55 + 0.45 * Math.sin(st.t + time * 0.0012 * st.s);
        const y = (st.y - scrollY * 0.06 * st.depth + h * 10) % h; // gentle parallax with scroll
        ctx.globalAlpha = st.a * twinkle;
        ctx.fillStyle = st.warm ? '#a9c4ff' : '#f2f5ff';
        ctx.beginPath(); ctx.arc(st.x, y, st.r, 0, Math.PI * 2); ctx.fill();
        if (st.r > 1.4 && !reduced) {
          // Small glints on the brightest stars
          ctx.globalAlpha = st.a * twinkle * 0.35;
          ctx.fillRect(st.x - st.r * 3, y - 0.4, st.r * 6, 0.8);
          ctx.fillRect(st.x - 0.4, y - st.r * 3, 0.8, st.r * 6);
        }
      }
      if (!reduced) {
        // A new shooting star every 0.7–2 s (up to four at once), streaking from the upper right down to the left.
        if (time > nextShot && shots.length < 4) {
          const speed = 9 + Math.random() * 8;
          const angle = Math.PI * (0.78 + Math.random() * 0.08);
          shots.push({
            x: w * (0.3 + Math.random() * 0.8), y: -20 + Math.random() * h * 0.45,
            vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
            len: 90 + Math.random() * 140, life: 1, warm: Math.random() < 0.45,
          });
          nextShot = time + 700 + Math.random() * 1300;
        }
        for (let i = shots.length - 1; i >= 0; i--) {
          const s = shots[i];
          const k = s.len / Math.hypot(s.vx, s.vy);
          const tx = s.x - s.vx * k, ty = s.y - s.vy * k;
          const color = s.warm ? '150, 190, 255' : '225, 232, 255';
          const g = ctx.createLinearGradient(s.x, s.y, tx, ty);
          g.addColorStop(0, `rgba(${color}, ${0.95 * s.life})`); g.addColorStop(1, `rgba(${color}, 0)`);
          ctx.globalAlpha = 1; ctx.strokeStyle = g; ctx.lineWidth = 1.7; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(tx, ty); ctx.stroke();
          ctx.fillStyle = `rgba(${color}, ${s.life})`;
          ctx.beginPath(); ctx.arc(s.x, s.y, 1.6, 0, Math.PI * 2); ctx.fill();
          s.x += s.vx * dt; s.y += s.vy * dt; s.life -= 0.009 * dt;
          if (s.life <= 0 || s.x < -300 || s.y > h + 300) shots.splice(i, 1);
        }
      }
      ctx.globalAlpha = 1;
    };
    const loop = (t) => { draw(t); raf = requestAnimationFrame(loop); };
    addEventListener('resize', resize);
    addEventListener('scroll', () => { scrollY = window.scrollY; if (reduced) draw(0); }, { passive: true });
    resize();
    if (!reduced) {
      raf = requestAnimationFrame(loop);
      document.addEventListener('visibilitychange', () => {
        cancelAnimationFrame(raf);
        if (!document.hidden) raf = requestAnimationFrame(loop);
      });
    }
  }

  /* ── Navigation: a pill slides under the link of the section in view ── */
  const links = [...document.querySelectorAll('[data-nav]')];
  const pill = document.querySelector('.nav__pill');
  const movePill = (link) => {
    if (!pill || !link) return;
    links.forEach((a) => a.classList.toggle('is-active', a === link));
    pill.style.width = `${link.offsetWidth}px`;
    pill.style.transform = `translateX(${link.offsetLeft}px)`;
    pill.style.opacity = '1';
  };
  const sections = links.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean);
  const current = () => {
    const mid = innerHeight * 0.35;
    let active = links[0];
    sections.forEach((sec, i) => { if (sec.getBoundingClientRect().top <= mid) active = links[i]; });
    // At the very bottom the last section is the active one even if it is short.
    if (innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) active = links[links.length - 1];
    return active;
  };
  let ticking = false;
  addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { movePill(current()); ticking = false; });
  }, { passive: true });
  addEventListener('resize', () => movePill(current()));
  addEventListener('load', () => movePill(current()));
  document.fonts?.ready.then(() => movePill(current()));
  movePill(current());

  /* ── Reveal on scroll (staggered inside each group) ── */
  const revealables = [...document.querySelectorAll('[data-reveal]')];
  if ('IntersectionObserver' in window && !reduced) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealables.forEach((el) => {
      const siblings = [...el.parentElement.children].filter((c) => c.hasAttribute('data-reveal'));
      el.style.setProperty('--d', `${Math.min(siblings.indexOf(el), 5) * 0.08}s`);
      io.observe(el);
    });
  } else {
    revealables.forEach((el) => el.classList.add('is-in'));
  }

  /* ── Typing role line ── */
  const typer = document.querySelector('.typer');
  if (typer && !reduced) {
    const words = typer.dataset.words.split('|');
    let wi = 0, ci = words[0].length, deleting = true;
    const tick = () => {
      const word = words[wi];
      if (deleting) {
        ci--;
        if (ci <= 0) { deleting = false; wi = (wi + 1) % words.length; }
      } else {
        ci++;
        if (ci >= words[wi].length) { deleting = true; typer.textContent = words[wi]; return setTimeout(tick, 1900); }
      }
      typer.textContent = (deleting ? word : words[wi]).slice(0, Math.max(ci, 0));
      setTimeout(tick, deleting ? 38 : 70);
    };
    setTimeout(tick, 2200);
  }

  /* ── Count-up numbers ── */
  const nums = document.querySelectorAll('[data-count]');
  if ('IntersectionObserver' in window && !reduced) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        const el = e.target, end = Number(el.dataset.count), start = performance.now(), dur = 1300;
        const step = (t) => {
          const p = Math.min(1, (t - start) / dur);
          el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3)));
          if (p < 1) requestAnimationFrame(step);
        };
        el.textContent = '0';
        requestAnimationFrame(step);
      }
    }, { threshold: 0.6 });
    nums.forEach((n) => io.observe(n));
  }

  /* ── Local time in Kosovo ── */
  const clocks = document.querySelectorAll('.clock');
  const fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Belgrade' });
  const tickClock = () => clocks.forEach((c) => (c.textContent = fmt.format(new Date())));
  tickClock();
  setInterval(tickClock, 20000);
  document.querySelectorAll('.year').forEach((y) => (y.textContent = new Date().getFullYear()));

  /* ── Portfolio tabs (WAI-ARIA tabs: click, arrow keys, Home/End) ── */
  const tablist = document.querySelector('.tabs');
  if (tablist) {
    const tabs = [...tablist.querySelectorAll('[role="tab"]')];
    const tabPill = tablist.querySelector('.tabs__pill');
    const placePill = (tab) => {
      if (!tabPill) return;
      tabPill.style.width = `${tab.offsetWidth}px`;
      tabPill.style.transform = `translateX(${tab.offsetLeft}px)`;
    };
    const select = (tab, focus = true) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      });
      placePill(tab);
      if (focus) tab.focus();
    };
    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => select(tab, false));
      tab.addEventListener('keydown', (e) => {
        const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
        if (next === undefined) return;
        e.preventDefault();
        select(tabs[(next + tabs.length) % tabs.length]);
      });
    });
    const current = () => tabs.find((t) => t.getAttribute('aria-selected') === 'true');
    addEventListener('resize', () => placePill(current()));
    document.fonts?.ready.then(() => placePill(current()));
    placePill(current());
  }

  /* ── Dialogs: project details and full-size certificates ── */
  const openModal = (dialog, opener) => {
    dialog.showModal();
    dialog.scrollTop = 0;
    dialog.addEventListener('close', () => opener?.focus(), { once: true });
  };
  document.querySelectorAll('.modal').forEach((dialog) => {
    dialog.querySelector('.modal__close').addEventListener('click', () => dialog.close());
    // A click on the backdrop (outside the dialog box) closes it.
    dialog.addEventListener('click', (e) => {
      if (e.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close();
    });
  });

  // Project details open as a full page with its own address (#project-faturo), so the browser's Back button
  // closes it and the link can be shared.
  const details = document.querySelector('.modal--details');
  const showProject = (id, opener) => {
    const tpl = document.getElementById(`details-${id}`);
    if (!tpl || !details) return false;
    const body = details.querySelector('.modal__body');
    const content = tpl.content.cloneNode(true);
    const gallery = content.querySelector('.details__gallery');
    gallery?.remove();
    const text = document.createElement('div');
    text.className = 'details__text';
    text.append(content);
    body.replaceChildren(text, ...(gallery ? [gallery] : []));
    const title = body.querySelector('h3');
    title?.setAttribute('id', 'details-title');
    details.querySelector('.crumbs__current').textContent = title?.textContent || '';
    if (!details.open) openModal(details, opener);
    details.scrollTop = 0;
    return true;
  };
  const projectFromHash = () => (location.hash.match(/^#project-([\w-]+)$/) || [])[1];
  document.querySelectorAll('[data-details]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.details;
      if (showProject(id, btn)) history.pushState({ project: id }, '', `#project-${id}`);
    });
  });
  // Back (button, Escape or browser) returns to the projects without leaving the page.
  details?.addEventListener('close', () => {
    // Closed with ← Back or Escape: point the address back at the projects (the browser's Back already did that
    // itself when it was used, so then there is nothing to do).
    if (projectFromHash()) history.replaceState(null, '', '#portfolio');
  });
  addEventListener('popstate', () => {
    const id = projectFromHash();
    if (id) showProject(id, null);
    else if (details?.open) details.close();
  });
  // Opened straight from a shared link
  if (projectFromHash()) window.siteReady.then(() => showProject(projectFromHash(), null));

  const zoom = document.querySelector('.modal--zoom');
  document.querySelectorAll('[data-zoom]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!zoom) return;
      const img = zoom.querySelector('img');
      img.src = btn.dataset.zoom;
      img.alt = btn.querySelector('img')?.alt || '';
      zoom.querySelector('figcaption').textContent = btn.dataset.caption || '';
      openModal(zoom, btn);
    });
  });

  /* ── Click sounds: a short soft "tick" on every button and link, made with the Web Audio API (no files).
     The speaker button in the navbar turns them off; the choice is remembered on this device. ── */
  const soundBtn = document.querySelector('.nav__sound');
  let soundOn = true;
  try { soundOn = localStorage.getItem('ax-sound') !== 'off'; } catch (e) {}
  let audio = null;
  const tick = (kind = 'click') => {
    if (!soundOn) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const t = audio.currentTime;
      const osc = audio.createOscillator(), gain = audio.createGain();
      const [f1, f2, len, vol] = kind === 'flip' ? [520, 1040, 0.16, 0.07] : kind === 'tab' ? [880, 660, 0.07, 0.05] : [1250, 620, 0.06, 0.06];
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f1, t);
      osc.frequency.exponentialRampToValueAtTime(f2, t + len);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(vol, t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + len);
      osc.connect(gain).connect(audio.destination);
      osc.start(t);
      osc.stop(t + len + 0.02);
    } catch (e) {}
  };
  const showSound = () => {
    if (!soundBtn) return;
    soundBtn.setAttribute('aria-pressed', String(soundOn));
    soundBtn.setAttribute('aria-label', soundOn ? 'Click sounds on' : 'Click sounds off');
  };
  showSound();
  soundBtn?.addEventListener('click', () => {
    soundOn = !soundOn;
    try { localStorage.setItem('ax-sound', soundOn ? 'on' : 'off'); } catch (e) {}
    showSound();
    tick();
  });
  document.addEventListener('click', (e) => {
    const el = e.target.closest('a, button, [role="tab"], summary, label');
    if (!el || el === soundBtn) return;
    tick(el.getAttribute('role') === 'tab' ? 'tab' : 'click');
  }, true);
  document.addEventListener('lanyard:flip', () => tick('flip'));
  window.__tick = tick;

  /* ── Contact form: validates, then opens the visitor's email app with the message filled in ── */
  const form = document.querySelector('.contact__form');
  if (form) {
    const note = form.querySelector('.form__note');
    const defaultNote = note.textContent;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fields = ['name', 'email', 'message'].map((n) => form.elements[n]);
      let bad = null;
      for (const f of fields) {
        const ok = f.value.trim() !== '' && (f.type !== 'email' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.value.trim()));
        f.setAttribute('aria-invalid', String(!ok));
        if (!ok && !bad) bad = f;
      }
      if (bad) {
        note.textContent = bad.name === 'email' && bad.value.trim() ? 'That email address doesn’t look right.' : 'Please fill in your name, email and message.';
        note.className = 'form__note is-error';
        bad.focus();
        return;
      }
      const [name, email, message] = fields.map((f) => f.value.trim());
      const subject = `Portfolio message from ${name}`;
      const body = `${message}\n\n— ${name} (${email})`;
      window.location.href = `mailto:arianitxhafa95@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      // Not every computer has an email app set up: also copy the message, so it can be pasted into any webmail.
      const show = (copied) => {
        note.textContent = copied
          ? 'Your email app should open with the message ready. If it doesn’t, your message is copied — paste it into an email to arianitxhafa95@gmail.com.'
          : 'Your email app should open with the message ready. If it doesn’t, write to arianitxhafa95@gmail.com.';
        note.className = 'form__note is-ok';
      };
      show(false);
      try {
        navigator.clipboard?.writeText(`${subject}\n\n${body}`).then(() => show(true), () => {});
      } catch { /* no clipboard access: the address in the note is enough */ }
      setTimeout(() => { note.textContent = defaultNote; note.className = 'form__note'; }, 14000);
    });
    form.addEventListener('input', (e) => e.target.removeAttribute('aria-invalid'));
  }

  /* ── Spotify: the real player loads by itself once the visitor scrolls near it (so the first page load stays
     fast); the "Deep Focus" card shows until it's ready, then the player fades in over it. A click loads it at once. ── */
  const facade = document.querySelector('.music__facade');
  if (facade) {
    let loaded = false;
    const loadPlayer = (focus) => {
      if (loaded) return;
      loaded = true;
      const frame = document.createElement('iframe');
      frame.title = 'Spotify playlist: Deep Focus';
      frame.src = facade.dataset.embed;
      frame.width = '100%';
      frame.height = '352';
      frame.loading = 'eager';
      frame.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
      frame.className = 'music__frame';
      frame.addEventListener('load', () => {
        frame.classList.add('is-ready');
        setTimeout(() => facade.remove(), 450);
        if (focus) frame.focus();
      }, { once: true });
      facade.after(frame);
      facade.tabIndex = -1;
    };
    facade.addEventListener('click', () => loadPlayer(true));
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry], io) => {
        if (entry.isIntersecting) { io.disconnect(); loadPlayer(false); }
      }, { rootMargin: '700px 0px' }).observe(facade);
    } else {
      loadPlayer(false);
    }
  }
})();
