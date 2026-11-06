/* Arianit Xhafa — portfolio interactions */
(() => {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const G = window.gsap;
  const ST = window.ScrollTrigger;
  const anim = !!(G && ST) && !reduced;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  if (reduced) root.classList.add('reduced');
  if (G && ST) G.registerPlugin(ST);

  /* ---------- Text splitting ---------- */
  $$('[data-split]').forEach((el) => {
    const text = el.textContent;
    el.textContent = '';
    for (const c of text) {
      const s = document.createElement('span');
      s.className = 'char';
      s.textContent = c;
      el.appendChild(s);
    }
  });

  $$('[data-reveal-title]').forEach((el) => {
    const words = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    words.forEach((w, i) => {
      const outer = document.createElement('span');
      outer.className = 'word';
      const inner = document.createElement('span');
      inner.textContent = w;
      outer.appendChild(inner);
      el.appendChild(outer);
      if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
  });

  const wrapWords = (node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) frag.appendChild(document.createTextNode(part));
          else {
            const s = document.createElement('span');
            s.className = 'w';
            s.textContent = part;
            frag.appendChild(s);
          }
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1) wrapWords(n);
    });
  };
  const statement = $('[data-words]');
  if (statement) wrapWords(statement);

  /* ---------- Smooth scroll ---------- */
  let lenis = null;
  if (window.Lenis && !reduced) {
    lenis = new window.Lenis({ lerp: 0.1, wheelMultiplier: 1 });
    if (anim) {
      lenis.on('scroll', ST.update);
      G.ticker.add((t) => lenis.raf(t * 1000));
      G.ticker.lagSmoothing(0);
    } else {
      const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      const target = id === '#top' ? 0 : $(id);
      if (target === null || !lenis) return;
      e.preventDefault();
      lenis.scrollTo(target, { duration: 1.6 });
    });
  });

  /* ---------- Theme ---------- */
  const themeBtn = $('.theme');
  themeBtn?.addEventListener('click', () => {
    const next = root.dataset.theme === 'light' ? 'dark' : 'light';
    root.dataset.theme = next;
    try { localStorage.setItem('ax-theme', next); } catch (e) {}
    field.refreshColors();
  });

  /* ---------- Hero dot field ---------- */
  const field = (() => {
    const c = $('.hero__field');
    const api = { refreshColors() {} };
    if (!c) return api;
    const ctx = c.getContext('2d');
    const gap = 30;
    let w = 0, h = 0, dots = [], running = true, ink = '242,239,234', signal = '255,90,31';
    const m = { x: -9999, y: -9999, tx: -9999, ty: -9999 };

    const toRGB = (v) => {
      const probe = document.createElement('i');
      probe.style.color = v;
      document.body.appendChild(probe);
      const rgb = getComputedStyle(probe).color.match(/\d+/g).slice(0, 3).join(',');
      probe.remove();
      return rgb;
    };
    api.refreshColors = () => {
      const cs = getComputedStyle(root);
      ink = toRGB(cs.getPropertyValue('--ink').trim());
      signal = toRGB(cs.getPropertyValue('--signal').trim());
      if (reduced) draw(0);
    };
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = c.clientWidth; h = c.clientHeight;
      c.width = w * dpr; c.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dots = [];
      for (let y = gap / 2; y < h; y += gap) for (let x = gap / 2; x < w; x += gap) dots.push({ x, y });
      if (reduced) draw(0);
    };
    const R = 190;
    function draw(t) {
      ctx.clearRect(0, 0, w, h);
      m.x += (m.tx - m.x) * 0.14;
      m.y += (m.ty - m.y) * 0.14;
      ctx.fillStyle = `rgba(${ink},0.16)`;
      ctx.beginPath();
      const hot = [];
      for (const d of dots) {
        const wave = Math.sin(t * 0.0009 + d.x * 0.011 + d.y * 0.007);
        const dx = d.x - m.x, dy = d.y - m.y;
        const dist = Math.hypot(dx, dy);
        if (dist < R) { hot.push([d, dx, dy, dist]); continue; }
        const r = 1 + wave * 0.35;
        ctx.moveTo(d.x + r, d.y);
        ctx.arc(d.x, d.y, r, 0, Math.PI * 2);
      }
      ctx.fill();
      for (const [d, dx, dy, dist] of hot) {
        const f = 1 - dist / R, ff = f * f;
        const ox = (dx / (dist || 1)) * ff * 26, oy = (dy / (dist || 1)) * ff * 26;
        ctx.fillStyle = `rgba(${signal},${0.25 + ff * 0.75})`;
        ctx.beginPath();
        ctx.arc(d.x + ox, d.y + oy, 1.2 + ff * 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const loop = (t) => { if (running) draw(t); requestAnimationFrame(loop); };
    window.addEventListener('resize', resize);
    c.parentElement.addEventListener('pointermove', (e) => {
      const r = c.getBoundingClientRect();
      m.tx = e.clientX - r.left; m.ty = e.clientY - r.top;
      if (m.x < -1000) { m.x = m.tx; m.y = m.ty; }
    });
    c.parentElement.addEventListener('pointerleave', () => { m.tx = -9999; m.ty = -9999; });
    new IntersectionObserver(([en]) => { running = en.isIntersecting; }).observe(c);
    api.refreshColors();
    resize();
    if (!reduced) requestAnimationFrame(loop);
    return api;
  })();

  /* ---------- Rotating role ---------- */
  const roles = $$('.rotator span');
  if (roles.length > 1 && !reduced) {
    let i = 0;
    setInterval(() => {
      const cur = roles[i];
      i = (i + 1) % roles.length;
      const next = roles[i];
      cur.classList.replace('is-active', 'is-leaving');
      next.classList.add('is-active');
      setTimeout(() => {
        cur.style.transition = 'none';
        cur.classList.remove('is-leaving');
        void cur.offsetWidth;
        cur.style.transition = '';
      }, 900);
    }, 2600);
  }

  /* ---------- Local clock ---------- */
  const clock = $('.clock__time');
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Belgrade', hour: '2-digit', minute: '2-digit' });
  const tick = () => { if (clock) clock.textContent = `${fmt.format(new Date())} CET`; };
  tick(); setInterval(tick, 20000);

  /* ---------- Nav + progress ---------- */
  const nav = $('.nav');
  const bar = $('.progress');
  let lastY = 0;
  const onScroll = () => {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - innerHeight;
    if (bar) bar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    nav.classList.toggle('is-scrolled', y > 40);
    nav.classList.toggle('is-hidden', y > 300 && y > lastY);
    lastY = y;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Cursor ---------- */
  if (finePointer) {
    root.classList.add('has-cursor');
    const cur = $('.cursor'), dot = $('.cursor__dot'), ring = $('.cursor__ring'), label = $('.cursor__label');
    let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
    window.addEventListener('pointermove', (e) => {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = `translate(${mx}px, ${my}px)`;
      cur.classList.remove('is-hidden');
    });
    document.addEventListener('pointerleave', () => cur.classList.add('is-hidden'));
    const follow = () => {
      rx += (mx - rx) * (reduced ? 1 : 0.18);
      ry += (my - ry) * (reduced ? 1 : 0.18);
      ring.style.transform = `translate(${rx}px, ${ry}px)`;
      requestAnimationFrame(follow);
    };
    follow();
    document.addEventListener('pointerover', (e) => {
      const link = e.target.closest('a, button');
      const labelled = e.target.closest('[data-cursor]');
      cur.classList.remove('is-link', 'is-label');
      if (link && link.hasAttribute('data-cursor')) {
        label.textContent = link.dataset.cursor; cur.classList.add('is-label');
      } else if (link) {
        cur.classList.add('is-link');
      } else if (labelled) {
        label.textContent = labelled.dataset.cursor; cur.classList.add('is-label');
      }
    });
  }

  /* ---------- Magnetic + tilt ---------- */
  if (finePointer && anim) {
    $$('[data-magnetic]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        G.to(el, { x: x * 0.3, y: y * 0.4, duration: 0.6, ease: 'power3.out' });
      });
      el.addEventListener('pointerleave', () => G.to(el, { x: 0, y: 0, duration: 1, ease: 'elastic.out(1, 0.35)' }));
    });
    $$('[data-tilt]').forEach((el) => {
      const glow = $('.glow', el);
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        G.to(el, { rotateY: px * 10, rotateX: -py * 10, transformPerspective: 1000, duration: 0.8, ease: 'power3.out' });
        if (glow) G.to(glow, { x: px * 120, y: py * 120, duration: 1, ease: 'power3.out' });
      });
      el.addEventListener('pointerleave', () => {
        G.to(el, { rotateY: 0, rotateX: 0, duration: 1.2, ease: 'expo.out' });
        if (glow) G.to(glow, { x: 0, y: 0, duration: 1.2, ease: 'expo.out' });
      });
    });
  }

  /* ---------- Terminal ---------- */
  const termLines = [
    ['p', '$ whoami'],
    ['o', 'arianit xhafa — cs & engineering student, final year'],
    ['p', '$ cat focus.txt'],
    ['o', 'mobile (react native · expo) / full-stack web (node · next.js) / databases'],
    ['p', '$ ls ~/projects'],
    ['o', 'rentigo/   trimtime/   next-project/'],
    ['p', '$ cat languages.txt'],
    ['o', 'albanian (native) · english (B2) · french (A1)'],
    ['p', '$ ./status --now'],
    ['g', '✓ open to internships & junior roles'],
  ];
  const termCode = $('.terminal__body code');
  let typed = false;
  const typeTerminal = async () => {
    if (!termCode || typed) return;
    typed = true;
    for (const [cls, text] of termLines) {
      const span = document.createElement('span');
      span.className = cls;
      termCode.appendChild(span);
      if (cls === 'p' && !reduced) {
        for (const ch of text) { span.textContent += ch; await sleep(26 + Math.random() * 45); }
        await sleep(260);
      } else {
        span.textContent = text;
        if (!reduced) await sleep(160);
      }
      termCode.appendChild(document.createTextNode('\n'));
    }
  };

  /* ---------- Counters ---------- */
  const runCount = (el) => {
    const end = +el.dataset.count, suffix = el.dataset.suffix || '';
    if (!anim) { el.textContent = end + suffix; return; }
    const o = { v: 0 };
    G.to(o, { v: end, duration: 2, ease: 'expo.out', onUpdate: () => { el.textContent = Math.round(o.v) + suffix; } });
  };

  /* ---------- No-animation fallback ---------- */
  const loader = $('.loader');
  if (!anim) {
    loader?.remove();
    $$('[data-count]').forEach(runCount);
    typeTerminal();
    return;
  }

  /* ---------- Initial states (hidden behind loader) ---------- */
  G.set('.hero__name .char', { yPercent: 115, rotate: 8 });
  G.set('[data-hero-fade]', { opacity: 0, y: 26 });
  G.set('.nav', { yPercent: -120 });
  G.set('.hero__field', { opacity: 0 });

  const heroIntro = () => {
    const tl = G.timeline({ defaults: { ease: 'expo.out' } });
    tl.to('.hero__name .char', { yPercent: 0, rotate: 0, duration: 1.6, stagger: 0.05 }, 0)
      .to('.hero__field', { opacity: 1, duration: 2.4, ease: 'power2.out' }, 0)
      .to('[data-hero-fade]', { opacity: 1, y: 0, duration: 1.3, stagger: 0.12 }, 0.45)
      .to('.nav', { yPercent: 0, duration: 1.2 }, 0.5);
  };

  /* ---------- Loader (first visit per session only) ---------- */
  let seen = false;
  try { seen = sessionStorage.getItem('ax-seen') === '1'; sessionStorage.setItem('ax-seen', '1'); } catch (e) {}
  if (seen) {
    loader.remove();
    heroIntro();
  } else {
    document.body.classList.add('is-loading');
    lenis?.stop();
    const num = $('.loader__num', loader);
    const counter = { v: 0 };
    G.set(loader, { clipPath: 'inset(0% 0% 0% 0%)' });
    G.timeline()
      .to(counter, { v: 100, duration: 1.1, ease: 'power3.inOut', onUpdate: () => { num.textContent = Math.round(counter.v); } }, 0)
      .to('.loader__bar i', { scaleX: 1, duration: 1.1, ease: 'power3.inOut' }, 0)
      .to('.loader__count, .loader__top', { yPercent: -30, opacity: 0, duration: 0.45, ease: 'power3.in' }, '+=0.05')
      .to(loader, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.9, ease: 'expo.inOut' }, '-=0.15')
      .add(() => { document.body.classList.remove('is-loading'); lenis?.start(); heroIntro(); }, '-=0.6')
      .add(() => loader.remove());
  }

  /* ---------- Scroll animations ---------- */
  // Hero parallax
  G.to('.hero__inner', { yPercent: -14, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

  // Velocity-reactive marquee
  const track = $('.marquee__track');
  if (track) {
    let x = 0, dir = 1, boost = 0;
    const wrap = G.utils.wrap(-50, 0);
    ST.create({ onUpdate: (self) => { const v = self.getVelocity(); dir = v < 0 ? -1 : 1; boost = Math.min(Math.abs(v) / 250, 6); } });
    G.ticker.add((_, dt) => {
      boost *= 0.94;
      x = wrap(x - dir * (0.018 + boost * 0.03) * (dt / 16.7));
      G.set(track, { xPercent: x });
    });
  }

  // Word titles
  $$('[data-reveal-title]').forEach((el) => {
    G.from($$('.word > span', el), { yPercent: 115, duration: 1.3, ease: 'expo.out', stagger: 0.08, scrollTrigger: { trigger: el, start: 'top 88%' } });
  });

  // Generic reveal
  $$('[data-reveal]').forEach((el) => {
    G.from(el, { y: 60, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 90%' } });
  });

  // Statement highlight
  if (statement) {
    G.fromTo($$('.w', statement), { opacity: 0.14 }, { opacity: 1, stagger: 0.05, ease: 'none', scrollTrigger: { trigger: statement, start: 'top 80%', end: 'bottom 50%', scrub: true } });
  }

  // Counters + terminal
  $$('[data-count]').forEach((el) => ST.create({ trigger: el, start: 'top 90%', once: true, onEnter: () => runCount(el) }));
  if (termCode) ST.create({ trigger: termCode, start: 'top 85%', once: true, onEnter: typeTerminal });

  // Stacked project cards (desktop)
  G.matchMedia().add('(min-width: 901px)', () => {
    const cards = $$('.project');
    cards.forEach((card, i) => {
      if (i === cards.length - 1) return;
      const next = cards[i + 1];
      G.to(card, {
        scale: 0.92, filter: 'brightness(0.55)', ease: 'none',
        scrollTrigger: {
          trigger: next,
          start: () => `top ${Math.min(innerHeight, 90 + i * 22 + card.offsetHeight)}px`,
          end: () => `top ${90 + (i + 1) * 22}px`,
          scrub: true,
          invalidateOnRefresh: true,
        },
      });
    });
  });
  $$('.project').forEach((card) => {
    G.from($$('.project__title, .project__tag, .project__desc', card), { y: 40, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: 0.08, scrollTrigger: { trigger: card, start: 'top 75%' } });
    const bars = $$('.spark i', card);
    if (bars.length) G.from(bars, { scaleY: 0, transformOrigin: 'bottom', duration: 1.2, ease: 'expo.out', stagger: 0.06, scrollTrigger: { trigger: card, start: 'top 70%' } });
  });

  // Timeline progress
  G.to('.timeline__line i', { scaleY: 1, ease: 'none', scrollTrigger: { trigger: '.timeline', start: 'top 70%', end: 'bottom 60%', scrub: true } });

  // Footer wordmark rise
  G.from('.footer__big', { yPercent: 70, opacity: 0.2, ease: 'none', scrollTrigger: { trigger: '.footer', start: 'top bottom', end: 'bottom bottom', scrub: true } });

  if (document.fonts?.ready) document.fonts.ready.then(() => ST.refresh());
})();
