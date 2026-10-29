/* NAMI 波 — интерфейс: прелоадер, плавный скролл, анимации, меню, корзина, смена языка.
   Скрипт обычный (не модуль), поэтому сайт открывается даже двойным кликом по index.html:
   Three.js подгружается динамическим import() с CDN. */
(() => {
  'use strict';

  const I = window.NamiI18n, D = window.NamiData;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const html = document.documentElement;
  const hasG = !!window.gsap;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const small = matchMedia('(max-width: 760px)').matches;
  const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
  const byId = Object.fromEntries(D.menu.map((m) => [m.id, m]));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let lenis = null;
  let scene = null;
  let introPlayed = false;
  const splits = []; // все SplitText — их нужно пересобрать при смене языка

  /* ====================== Узор сейгайха (волны) ====================== */
  function seigaiha(bg, line) {
    const fan = (x, y) => `<g transform="translate(${x} ${y})"><circle r="20" fill="${bg}"/>` +
      [16, 12, 8, 4].map((r) => `<circle r="${r}" fill="none" stroke="${line}" stroke-width="1.3"/>`).join('') + '</g>';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20">${[[20, -10], [0, 0], [40, 0], [20, 10], [0, 20], [40, 20], [20, 30]].map(([x, y]) => fan(x, y)).join('')}</svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }
  html.style.setProperty('--seigaiha-dark', seigaiha('#0c0a09', '#221a16'));
  html.style.setProperty('--seigaiha-salmon', seigaiha('#ff6a3d', '#d94c22'));

  /* ============================ Разметка ============================ */
  function renderMenu() {
    const badgeClass = { chef: 'badge--green', week: 'badge--gold' };
    $('[data-menu-grid]').innerHTML = D.menu.map((m) => `
      <article class="card" data-id="${m.id}" data-cat="${m.cat}">
        <div class="card__media" data-view="card" data-model="${m.model}" data-cursor="view" data-fallback="寿司">
          <span class="card__jp" lang="ja">${m.jp}</span>
          ${m.badge ? `<span class="badge card__badge ${badgeClass[m.badge] || ''}" data-i18n="badge.${m.badge}"></span>` : ''}
        </div>
        <div class="card__body">
          <div class="card__row"><h3 class="card__title" data-i18n="item.${m.id}.name"></h3><span class="card__meta" data-meta="${m.id}"></span></div>
          <p class="card__desc" data-i18n="item.${m.id}.desc"></p>
          <div class="card__foot">
            <span class="card__price"><span data-price="${m.id}"></span>${m.oldPrice ? `<s data-price-old="${m.id}"></s>` : ''}</span>
            <button type="button" class="add-btn" data-add="${m.id}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><span data-i18n="menu.add"></span></button>
          </div>
        </div>
      </article>`).join('');
  }

  function renderStack() {
    const tagClass = { core: 'badge--gold', lib: 'badge--green', gsap: '' };
    $('[data-stack]').innerHTML = D.plugins.map((p, i) => `
      <li class="plugin" data-tilt>
        <span class="plugin__n">${String(i + 1).padStart(2, '0')}</span>
        <h3>${p.name}<small>${p.ver}</small></h3>
        <p data-i18n="${p.key}"></p>
        <span class="badge ${tagClass[p.tag]}" data-i18n="stack.tag.${p.tag}"></span>
      </li>`).join('');
  }

  // Тексты, которые собираются из данных: цены, граммы, aria-подписи
  function renderDynamic() {
    $$('[data-price]').forEach((el) => { el.textContent = I.money(byId[el.dataset.price].price); });
    $$('[data-price-old]').forEach((el) => { el.textContent = I.money(byId[el.dataset.priceOld].oldPrice); });
    $$('[data-meta]').forEach((el) => {
      const m = byId[el.dataset.meta];
      el.textContent = I.t('unit.pcs', { n: m.pcs }) + ' · ' + I.t('unit.g', { n: I.num(m.g) });
    });
    $$('[data-add]').forEach((el) => el.setAttribute('aria-label', I.t('menu.addAria', { name: I.t('item.' + el.dataset.add + '.name') })));
    $$('[data-plate-price]').forEach((el) => { el.textContent = I.money(D.plates[el.dataset.platePrice].price); });
    $$('[data-count]').forEach((el) => { if (el.dataset.done) el.textContent = I.num(+el.dataset.count); });
  }

  /* ============================= Корзина ============================= */
  let cart = {};
  try { cart = JSON.parse(localStorage.getItem('nami-cart')) || {}; } catch (e) { cart = {}; }
  const cartEl = $('[data-cart]'), cartPanel = $('.cart__panel'), header = $('[data-header]');
  let cartOpen = false, mnavOpen = false;

  const isPlate = (k) => k.indexOf('plate:') === 0;
  const itemOf = (k) => byId[isPlate(k) ? k.slice(6) : k];
  const priceOf = (k) => (isPlate(k) ? D.plates[itemOf(k).plate].price : itemOf(k).price);
  const nameOf = (k) => (isPlate(k) ? I.t('cart.plate', { name: I.t('item.' + k.slice(6) + '.name') }) : I.t('item.' + k + '.name'));
  const saveCart = () => { try { localStorage.setItem('nami-cart', JSON.stringify(cart)); } catch (e) { /* приватный режим */ } };

  function renderCart() {
    const keys = Object.keys(cart).filter((k) => cart[k] > 0 && itemOf(k));
    $('[data-cart-list]').innerHTML = keys.map((k) => {
      const m = itemOf(k), plate = isPlate(k);
      const thumb = plate
        ? `<span class="cart__thumb cart__thumb--plate" style="--c:${D.plates[m.plate].color}">${priceOf(k)}</span>`
        : `<span class="cart__thumb" lang="ja">${m.jp.charAt(0)}</span>`;
      return `<li class="cart__item">${thumb}
        <div><span class="cart__name">${esc(nameOf(k))}</span><span class="cart__unit">${I.money(priceOf(k))}</span></div>
        <div class="qty"><button type="button" data-dec="${k}" aria-label="${esc(I.t('cart.dec'))}">−</button><span>${cart[k]}</span><button type="button" data-inc="${k}" aria-label="${esc(I.t('cart.inc'))}">+</button></div>
      </li>`;
    }).join('');
    const count = keys.reduce((s, k) => s + cart[k], 0);
    const total = keys.reduce((s, k) => s + cart[k] * priceOf(k), 0);
    $('[data-cart-count]').textContent = count;
    $('[data-cart-total]').textContent = I.money(total);
    $('[data-cart-empty]').hidden = count > 0;
    $('[data-checkout]').disabled = count === 0;
    const left = D.freeDelivery - total;
    $('[data-cart-free]').textContent = left > 0 ? I.t('cart.free', { x: I.money(left) }) : I.t('cart.freeDone');
    $('[data-cart-freebar]').style.transform = `scaleX(${Math.min(1, total / D.freeDelivery)})`;
  }

  function addToCart(key, from) {
    cart[key] = (cart[key] || 0) + 1;
    saveCart();
    renderCart();
    toast(I.t('toast.added', { name: nameOf(key) }));
    if (from && hasG) fly(from); else bump();
  }

  function openCart() {
    cartOpen = true;
    cartEl.classList.add('is-open');
    cartEl.setAttribute('aria-hidden', 'false');
    cartPanel.inert = false;
    header.classList.remove('is-hidden');
    if (lenis) lenis.stop();
    setTimeout(() => $('.cart__head .round-btn').focus(), 120);
  }
  function closeCart() {
    if (!cartOpen) return;
    cartOpen = false;
    cartEl.classList.remove('is-open');
    cartEl.setAttribute('aria-hidden', 'true');
    cartPanel.inert = true;
    if (lenis) lenis.start();
    $('[data-cart-done]').hidden = true;
  }
  cartPanel.inert = true;

  function initCart() {
    renderCart();
    document.addEventListener('click', (e) => {
      const add = e.target.closest('[data-add]');
      if (add) { addToCart(add.dataset.add, add); return; }
      if (e.target.closest('[data-cart-open]')) { openCart(); return; }
      if (e.target.closest('[data-cart-close]')) { closeCart(); return; }
      const inc = e.target.closest('[data-inc]'), dec = e.target.closest('[data-dec]');
      if (inc) { cart[inc.dataset.inc]++; saveCart(); renderCart(); }
      if (dec) { const k = dec.dataset.dec; cart[k]--; if (cart[k] <= 0) delete cart[k]; saveCart(); renderCart(); }
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeCart(); closeMnav(); } });
    $('[data-checkout]').addEventListener('click', (e) => {
      const done = $('[data-cart-done]');
      done.hidden = false;
      if (hasG) gsap.from(done.children, { y: 30, opacity: 0, stagger: 0.08, duration: 0.9, ease: 'expo.out' });
      const r = e.currentTarget.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top, true);
      cart = {};
      saveCart();
      renderCart();
    });
    $('[data-cart-again]').addEventListener('click', () => {
      closeCart();
      scrollToTarget($('#menu'));
    });
  }

  /* ===================== Тосты, «полёт» в корзину, конфетти ===================== */
  function toast(msg) {
    const wrap = $('[data-toasts]');
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = '<i lang="ja">寿</i><span></span>';
    el.lastChild.textContent = msg;
    wrap.appendChild(el);
    while (wrap.children.length > 3) wrap.firstChild.remove();
    if (!hasG) { setTimeout(() => el.remove(), 2600); return; }
    gsap.fromTo(el, { y: 24, opacity: 0, scale: 0.9 }, { y: 0, opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(2)' });
    gsap.to(el, { y: -10, opacity: 0, duration: 0.4, delay: 2.4, onComplete: () => el.remove() });
  }

  function bump() {
    if (!hasG) return;
    gsap.fromTo('[data-cart-count]', { scale: 1.7 }, { scale: 1, duration: 0.7, ease: 'elastic.out(1, 0.4)' });
    gsap.fromTo('.cart-btn svg', { rotate: -16 }, { rotate: 0, duration: 0.7, ease: 'elastic.out(1, 0.4)' });
  }

  // Кусочек летит в корзину по дуге (MotionPathPlugin)
  function fly(from) {
    const r = from.getBoundingClientRect ? from.getBoundingClientRect() : { left: from.x, top: from.y, width: 0, height: 0 };
    const sx = r.left + r.width / 2, sy = r.top + r.height / 2;
    const wasHidden = header.classList.contains('is-hidden');
    header.classList.remove('is-hidden');
    const c = $('.cart-btn').getBoundingClientRect();
    const ex = c.left + c.width / 2, ey = c.top + c.height / 2 + (wasHidden ? header.offsetHeight * 1.05 : 0);
    const dot = document.createElement('div');
    dot.className = 'fly-dot';
    document.body.appendChild(dot);
    gsap.set(dot, { x: sx, y: sy });
    gsap.to(dot, {
      duration: 0.85, ease: 'power2.inOut', scale: 0.45,
      motionPath: { path: [{ x: sx, y: sy }, { x: (sx + ex) / 2, y: Math.min(sy, ey) - 150 }, { x: ex, y: ey }], curviness: 1.3 },
      onComplete: () => { dot.remove(); bump(); }
    });
  }

  let sesameShape = null;
  try {
    if (window.confetti && confetti.shapeFromPath) sesameShape = confetti.shapeFromPath({ path: 'M6 0C9.6 3.2 9.6 10.8 6 14C2.4 10.8 2.4 3.2 6 0Z' });
  } catch (e) { sesameShape = null; }

  // Салют из кунжута (canvas-confetti)
  function burst(x, y, big) {
    if (!window.confetti || reduced) return;
    confetti({
      particleCount: big ? 170 : 45, spread: big ? 110 : 70, startVelocity: big ? 48 : 30,
      gravity: 1.1, ticks: big ? 260 : 160, scalar: big ? 1.25 : 0.95, zIndex: 200,
      origin: { x: x / window.innerWidth, y: y / window.innerHeight },
      colors: ['#f6efe4', '#f0dfbd', '#1c1815', '#ff6a3d', '#a9cd4e'],
      shapes: sesameShape ? [sesameShape, sesameShape, 'circle'] : ['circle'],
      disableForReducedMotion: true
    });
  }

  /* ============================ Смена языка ============================ */
  let switching = false;
  function switchLang(l) {
    if (l === I.get() || switching) return;
    switching = true;
    $('[data-wipe-label]').textContent = I.NAMES[l];
    const swap = () => {
      splits.forEach((s) => s.revert());   // сначала вернуть исходный HTML, иначе revert() вернёт старый язык
      I.set(l);
      splits.forEach((s) => s.split());
      if (hasG) ScrollTrigger.refresh();
    };
    if (!hasG || reduced) { swap(); switching = false; return; }
    const wipe = $('.wipe');
    gsap.timeline({ onComplete: () => { switching = false; } })
      .set(wipe, { visibility: 'visible', clipPath: 'inset(100% 0% 0% 0%)' })
      .to(wipe, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.6, ease: 'expo.inOut' })
      .from('.wipe__inner > *', { y: 40, opacity: 0, stagger: 0.07, duration: 0.55, ease: 'expo.out' }, '-=0.3')
      .add(swap)
      .to(wipe, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.65, ease: 'expo.inOut', delay: 0.25 })
      .set(wipe, { visibility: 'hidden' });
  }

  I.onChange(() => {
    renderDynamic();
    renderCart();
    if (scene) scene.relabel();
    refreshCursorLabel();
  });

  /* ============================ Прелоадер ============================ */
  function preloader() {
    const root = $('[data-preloader]'), num = $('[data-preload-num]'), status = $('[data-preload-status]');
    let p = 0, target = 8, step = 1, finish = null;
    const setStatus = (i) => { step = i; status.textContent = I.t('preload.' + i); };
    setStatus(1);
    I.onChange(() => setStatus(step));
    gsap.fromTo('.enso__path', { drawSVG: '0%' }, { drawSVG: '100%', duration: 2, ease: 'power2.inOut' });
    gsap.from('.preloader__kanji', { opacity: 0, scale: 0.6, duration: 1.4, ease: 'expo.out', delay: 0.3 });
    // счёт идёт по времени, а не по кадрам: в фоновой вкладке rAF редкий
    const tick = (time, dtMs) => {
      p += (target - p) * (1 - Math.exp(-Math.min(dtMs, 400) / 1000 * 5));
      num.textContent = Math.round(p);
      if (finish && p > 99.4) {
        gsap.ticker.remove(tick);
        num.textContent = '100';
        const done = finish;
        finish = null;
        gsap.timeline({ onComplete: () => root.classList.add('is-done') })
          .to('.preloader__center', { opacity: 0, scale: 0.9, duration: 0.5, ease: 'power2.in' })
          .to('.preloader__panel--top', { yPercent: -100, duration: 1.1, ease: 'expo.inOut' }, '-=0.1')
          .to('.preloader__panel--bottom', { yPercent: 100, duration: 1.1, ease: 'expo.inOut' }, '<')
          .add(done, '-=0.85');
      }
    };
    gsap.ticker.add(tick);
    return {
      step(v, s) { target = Math.max(target, v); if (s) setStatus(s); },
      done() { return new Promise((res) => { target = 100; setStatus(4); finish = res; }); }
    };
  }

  /* ========================= Плавный скролл ========================= */
  function initScroll() {
    if (!reduced && window.Lenis) {
      lenis = new Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 0.95, touchMultiplier: 1.4 });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((time) => lenis.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
      lenis.stop();
    }
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute('href');
      const target = id === '#top' ? 0 : $(id);
      if (target === null) return;
      e.preventDefault();
      closeMnav();
      scrollToTarget(target);
    });
  }
  function scrollToTarget(target) {
    if (lenis) { lenis.scrollTo(target, { duration: 1.6 }); return; }
    if (target === 0) window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    else target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
  }

  /* ============================ Анимации ============================ */
  function splitHero() {
    $$('.hero__line').forEach((el, i) => {
      splits.push(SplitText.create(el, {
        type: 'words,chars',
        charsClass: 'char',
        onSplit(self) {
          const tw = gsap.from(self.chars, {
            yPercent: 90, rotateX: -95, opacity: 0, transformOrigin: '50% 100%', transformPerspective: 700,
            stagger: 0.024, duration: 1.15, ease: 'expo.out', paused: !introPlayed
          });
          el._tw = tw;
          el._delay = 0.35 + i * 0.13;
          return tw;
        }
      }));
    });
  }

  function heroIntro() {
    introPlayed = true;
    $$('.hero__line').forEach((el) => { if (el._tw) el._tw.delay(el._delay).restart(true); });
    const tl = gsap.timeline();
    tl.from('.header > *', { y: -30, opacity: 0, stagger: 0.08, duration: 1, ease: 'expo.out', clearProps: 'transform,opacity' }, 0.2)
      .from('.hero__eyebrow', { y: 20, opacity: 0, duration: 0.9, ease: 'expo.out' }, 0.25)
      .from('.hero__lead, .hero__cta > *, .hero__stats li', { y: 34, opacity: 0, stagger: 0.07, duration: 1.1, ease: 'expo.out', clearProps: 'transform' }, 0.75)
      .from('.hero__vertical, .hero__hint, .hero__scroll', { opacity: 0, duration: 1.2 }, 1.1);
    if (scene) scene.introHero();
  }

  function initAnimations() {
    // --- Hero: заголовок по буквам, уход при скролле ---
    splitHero();
    ScrollTrigger.create({
      trigger: '.hero', start: 'top top', end: 'bottom top',
      onUpdate: (self) => { if (scene) scene.hero.out = self.progress; }
    });
    gsap.to('.hero__inner', { yPercent: -22, opacity: 0, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.hero__kanji', { yPercent: 30, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

    // --- Анатомия: секция закреплена, скролл раскладывает ролл на слои ---
    const anat = scene ? scene.anat : { explode: 0 };
    const bar = $('[data-anat-bar]');
    gsap.timeline({
      scrollTrigger: {
        trigger: '.anatomy', start: 'top top', end: () => '+=' + Math.round(window.innerHeight * 2.2),
        pin: true, scrub: 0.9, anticipatePin: 1, invalidateOnRefresh: true,
        onUpdate: (self) => { bar.style.transform = `scaleX(${self.progress.toFixed(3)})`; }
      }
    })
      .to(anat, { explode: 1, ease: 'power2.inOut', duration: 1 }, 0.12)
      .to({}, { duration: 0.3 });
    gsap.to('.anatomy__hint', { opacity: 0, scrollTrigger: { trigger: '.anatomy', start: 'top top', end: () => '+=' + Math.round(window.innerHeight * 0.6), scrub: true } });

    // --- Заголовки секций: слова поднимаются в 3D ---
    $$('[data-split]').forEach((el) => {
      splits.push(SplitText.create(el, {
        type: 'words',
        wordsClass: 'word',
        onSplit(self) {
          return gsap.from(self.words, {
            yPercent: 70, rotateX: -70, opacity: 0, transformOrigin: '50% 100%', transformPerspective: 800,
            stagger: 0.06, duration: 1.1, ease: 'expo.out',
            scrollTrigger: { trigger: el, start: 'top 88%', once: true }
          });
        }
      }));
    });

    // --- Цитата: слова «проявляются» вместе со скроллом ---
    const quote = $('[data-words]');
    splits.push(SplitText.create(quote, {
      type: 'words',
      onSplit(self) {
        return gsap.fromTo(self.words, { opacity: 0.13 }, {
          opacity: 1, stagger: 0.1, ease: 'none',
          scrollTrigger: { trigger: quote, start: 'top 80%', end: 'bottom 50%', scrub: 0.6 }
        });
      }
    }));

    // --- Появление блоков ---
    if (!reduced) {
      $$('.section-head .eyebrow, .section-head .lead, .anatomy__copy > .eyebrow, .anatomy__copy > .lead, .anatomy__spec, .anatomy__progress, .filters, .promo__card, .kaiten__stage, .philo .eyebrow, .philo__author, .reviews__copy > :not(.h2), .delivery__copy > :not(.h2), .delivery__map, .reviews__swiper, .footer__cols > *, .footer__bottom')
        .forEach((el) => gsap.from(el, { y: 40, opacity: 0, duration: 1.1, ease: 'expo.out', clearProps: 'transform', scrollTrigger: { trigger: el, start: 'top 90%', once: true } }));
      const batch = (sel) => {
        gsap.set(sel, { opacity: 0, y: 70 });
        ScrollTrigger.batch(sel, { start: 'top 92%', once: true, onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, stagger: 0.08, duration: 1.1, ease: 'expo.out', clearProps: 'transform' }) });
      };
      batch('.card');
      batch('.plugin');
      batch('.stat');
      gsap.from('.footer__big span', { yPercent: 80, opacity: 0, stagger: 0.07, duration: 1.3, ease: 'expo.out', clearProps: 'transform,opacity', scrollTrigger: { trigger: '.footer__big', start: 'top 92%', once: true } });
    }

    // --- Бегущая строка: скорость и направление от скролла ---
    const rows = $$('[data-marquee]').map((row) => ({ el: row.querySelector('.marquee__track'), row, dir: +row.dataset.marquee, x: 0 }));
    rows.forEach((r) => { r.el.innerHTML += r.el.innerHTML; });
    let vel = 0, sign = 1;
    const skew = rows.map((r) => gsap.quickTo(r.row, 'skewX', { duration: 0.5, ease: 'power3' }));
    gsap.ticker.add((time, dtMs) => {
      const dt = Math.min(dtMs / 1000, 0.05);
      const v = lenis ? lenis.velocity : 0;
      vel += (v - vel) * 0.12;
      if (Math.abs(vel) > 0.6) sign = vel > 0 ? 1 : -1;
      const speed = reduced ? 0 : 2.4 * (1 + Math.min(Math.abs(vel) * 0.12, 7));
      rows.forEach((r, i) => {
        r.x = gsap.utils.wrap(-50, 0, r.x - r.dir * sign * speed * dt);
        r.el.style.transform = `translate3d(${r.x}%,0,0)`;
        skew[i](gsap.utils.clamp(-12, 12, -vel * 0.35));
      });
      if (scene && lenis) scene.boost(Math.abs(lenis.velocity));
    });

    // --- Доставка: DrawSVG рисует маршрут, MotionPath везёт курьера ---
    const route = $('#route');
    gsap.timeline({ scrollTrigger: { trigger: '.delivery__map', start: 'top 72%', end: 'bottom 50%', scrub: 1 } })
      .fromTo(route, { drawSVG: '0%' }, { drawSVG: '100%', ease: 'none', duration: 1 }, 0)
      .to('#courier', { motionPath: { path: route, align: route, alignOrigin: [0.5, 0.5] }, ease: 'none', duration: 1, immediateRender: true }, 0)
      .fromTo('.map__pin--end', { scale: 0, transformOrigin: '50% 100%' }, { scale: 1, ease: 'back.out(3)', duration: 0.12 }, 0.88)
      .fromTo('.map__time', { opacity: 0, scale: 0.6, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: 0.15, ease: 'back.out(2)' }, 0.5);

    // --- Счётчики ---
    $$('[data-count]').forEach((el) => {
      const end = +el.dataset.count, o = { v: 0 };
      el.textContent = I.num(0);
      gsap.to(o, {
        v: end, duration: 2.2, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 92%', once: true },
        onUpdate: () => { el.textContent = I.num(Math.round(o.v)); },
        onComplete: () => { el.dataset.done = '1'; }
      });
    });

    // --- Шапка: прячется при скролле вниз, прогресс страницы, активный пункт ---
    ScrollTrigger.create({
      start: 0, end: 'max',
      onUpdate: (self) => {
        const y = self.scroll();
        header.classList.toggle('is-scrolled', y > 30);
        if (!cartOpen && !mnavOpen) header.classList.toggle('is-hidden', self.direction === 1 && y > window.innerHeight * 0.6);
      }
    });
    gsap.to('.progress i', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });
    let active = null;
    const setActive = (id) => { active = id; $$('[data-nav]').forEach((a) => a.classList.toggle('is-active', a.dataset.nav === id)); };
    ['anatomy', 'menu', 'kaiten', 'reviews', 'delivery'].forEach((id) => ScrollTrigger.create({
      trigger: '#' + id, start: 'top 55%', end: 'bottom 55%',
      onToggle: (self) => { if (self.isActive) setActive(id); else if (active === id) setActive(null); }
    }));

    // --- Меню: фильтры с плагином Flip ---
    $('[data-filters]').addEventListener('click', (e) => {
      const b = e.target.closest('[data-filter]');
      if (!b || b.classList.contains('is-active')) return;
      $$('[data-filter]').forEach((x) => { const on = x === b; x.classList.toggle('is-active', on); x.setAttribute('aria-pressed', String(on)); });
      const cat = b.dataset.filter, cards = $$('.card');
      const state = Flip.getState(cards);
      cards.forEach((c) => c.classList.toggle('is-hidden', cat !== 'all' && c.dataset.cat !== cat));
      Flip.from(state, {
        duration: 0.75, ease: 'power3.inOut', scale: true, absolute: true, stagger: 0.03,
        onEnter: (els) => gsap.fromTo(els, { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: 0.6, delay: 0.2 }),
        onLeave: (els) => gsap.to(els, { opacity: 0, scale: 0.85, duration: 0.35 }),
        onComplete: () => ScrollTrigger.refresh()
      });
    });

    // --- Навигация: «шифровка» текста при наведении (ScrambleText) ---
    if (fine) $$('[data-scramble]').forEach((el) => el.addEventListener('mouseenter', () => {
      if (el._busy) return;
      el._busy = true;
      el.style.width = el.offsetWidth + 'px';
      gsap.to(el, {
        duration: 0.7, scrambleText: { text: I.t(el.dataset.i18n), chars: '波寿司鮭米海苔NAMI', revealDelay: 0.15, speed: 0.6 },
        onComplete: () => { el.style.width = ''; el._busy = false; }
      });
    }));

    // --- Отзывы: Swiper с 3D-эффектом «карточки» ---
    if (window.Swiper) {
      const sw = new Swiper('.reviews__swiper', {
        effect: 'cards', grabCursor: true, rewind: true, speed: 650,
        cardsEffect: { perSlideOffset: 9, perSlideRotate: 3, rotate: true, slideShadows: false },
        autoplay: reduced ? false : { delay: 4500, disableOnInteraction: false, pauseOnMouseEnter: true },
        navigation: { prevEl: '[data-rev-prev]', nextEl: '[data-rev-next]' },
        pagination: { el: '.reviews__dots', clickable: true }
      });
      if (sw.autoplay && !reduced) {
        sw.autoplay.stop();
        ScrollTrigger.create({ trigger: '.reviews', start: 'top bottom', end: 'bottom top', onToggle: (self) => (self.isActive ? sw.autoplay.start() : sw.autoplay.stop()) });
      }
    }

    // --- Обратный отсчёт до воскресенья ---
    const cd = { d: $('[data-cd="d"]'), h: $('[data-cd="h"]'), m: $('[data-cd="m"]'), s: $('[data-cd="s"]') };
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ((7 - now.getDay()) % 7), 23, 59, 59);
    if (end < now) end.setDate(end.getDate() + 7);
    const pad = (n) => String(n).padStart(2, '0');
    const tickCd = () => {
      let s = Math.max(0, Math.floor((end - Date.now()) / 1000));
      const d = Math.floor(s / 86400); s %= 86400;
      const h = Math.floor(s / 3600); s %= 3600;
      const m = Math.floor(s / 60); s %= 60;
      cd.d.textContent = pad(d); cd.h.textContent = pad(h); cd.m.textContent = pad(m);
      if (cd.s.textContent !== pad(s)) {
        cd.s.textContent = pad(s);
        if (!reduced) gsap.fromTo(cd.s, { yPercent: -40, opacity: 0.3 }, { yPercent: 0, opacity: 1, duration: 0.4, ease: 'power3.out' });
      }
    };
    tickCd();
    setInterval(tickCd, 1000);
  }

  /* ===================== Курсор, магниты, наклон ===================== */
  const cursor = { el: $('.cursor'), label: $('.cursor__label'), key: null, override: null };
  function refreshCursorLabel() {
    const key = cursor.override || cursor.key;
    if (key) cursor.label.textContent = I.t('cursor.' + key);
  }
  function setCursor(type, hover) {
    cursor.el.classList.toggle('is-label', !!type);
    cursor.el.classList.toggle('is-hover', !type && hover);
    refreshCursorLabel();
  }
  function initCursor() {
    if (!fine) return;
    html.classList.add('has-cursor');
    const dot = $('.cursor__dot'), ring = $('.cursor__ring');
    const dx = gsap.quickTo(dot, 'x', { duration: 0.08 }), dy = gsap.quickTo(dot, 'y', { duration: 0.08 });
    const rx = gsap.quickTo(ring, 'x', { duration: 0.45, ease: 'power3' }), ry = gsap.quickTo(ring, 'y', { duration: 0.45, ease: 'power3' });
    let hoverEl = null;
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY);
      cursor.el.classList.remove('is-hidden');
    }, { passive: true });
    document.addEventListener('pointerover', (e) => {
      const t = e.target.closest('[data-cursor], a, button, .swiper, [data-tilt]');
      hoverEl = t;
      cursor.key = t && t.dataset.cursor ? t.dataset.cursor : null;
      setCursor(cursor.override || cursor.key, !!t);
    });
    document.documentElement.addEventListener('mouseleave', () => cursor.el.classList.add('is-hidden'));
    // наведение на тарелку в кайтене приходит из 3D-сцены
    cursor.setOverride = (on) => { cursor.override = on ? 'take' : null; setCursor(cursor.override || cursor.key, !!hoverEl); };
  }

  function initMagnetic() {
    if (!fine) return;
    $$('[data-magnetic]').forEach((el) => {
      const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3' }), yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * 0.3);
        yTo((e.clientY - (r.top + r.height / 2)) * 0.35);
      });
      el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
    });
  }

  function initTilt() {
    if (!fine || reduced || !window.VanillaTilt) return;
    VanillaTilt.init($$('[data-tilt]'), { max: 9, speed: 900, glare: true, 'max-glare': 0.18, scale: 1.02, perspective: 900 });
  }

  /* ========================= Мобильное меню ========================= */
  const burger = $('[data-burger]'), mnav = $('[data-mnav]');
  function openMnav() {
    mnavOpen = true;
    mnav.hidden = false;
    burger.setAttribute('aria-expanded', 'true');
    if (lenis) lenis.stop();
    if (!hasG) return;
    gsap.fromTo(mnav, { clipPath: 'circle(0% at 100% 0%)' }, { clipPath: 'circle(150% at 100% 0%)', duration: 0.8, ease: 'expo.inOut' });
    gsap.from('.mnav__links a', { y: 40, opacity: 0, stagger: 0.06, duration: 0.7, ease: 'expo.out', delay: 0.25 });
  }
  function closeMnav() {
    if (!mnavOpen) return;
    mnavOpen = false;
    burger.setAttribute('aria-expanded', 'false');
    if (lenis) lenis.start();
    if (!hasG) { mnav.hidden = true; return; }
    gsap.to(mnav, { clipPath: 'circle(0% at 100% 0%)', duration: 0.6, ease: 'expo.inOut', onComplete: () => { mnav.hidden = true; } });
  }
  burger.addEventListener('click', () => (mnavOpen ? closeMnav() : openMnav()));

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-lang]');
    if (b) switchLang(b.dataset.lang);
  });

  /* ============================== Старт ============================== */
  async function boot() {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    renderMenu();
    renderStack();
    I.init();
    renderDynamic();
    initCart();

    if (!hasG) {
      $('[data-preloader]').classList.add('is-done');
      html.classList.remove('is-loading');
      return;
    }
    gsap.registerPlugin(...[window.ScrollTrigger, window.SplitText, window.Flip, window.DrawSVGPlugin, window.MotionPathPlugin, window.ScrambleTextPlugin].filter(Boolean));
    html.style.overflow = 'hidden';
    $('[data-preloader]').classList.add('is-js'); // дальше прелоадером управляет JS, CSS-предохранитель не нужен
    initScroll();
    const pre = preloader();

    const fonts = (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => pre.step(35, 2));
    const three = import(THREE_URL).then((m) => { pre.step(60, 3); return m; }).catch((err) => { console.warn('Three.js не загрузился:', err); return null; });
    const [THREE] = await Promise.all([three, fonts, wait(1300)]);

    if (THREE && window.NamiModels && window.NamiScene) {
      try {
        const kit = NamiModels(THREE, { quality: small ? 0.6 : 1 });
        scene = NamiScene(THREE, kit, {
          canvas: $('#gl'), data: D, mobile: small || !fine, reduced,
          t: I.t, money: I.money,
          onTake: (item, x, y) => {
            addToCart('plate:' + item.id, { x, y });
            burst(x, y, false);
            const c = $('[data-kaiten-count]');
            c.textContent = +c.textContent + 1;
            gsap.fromTo(c, { scale: 1.6 }, { scale: 1, duration: 0.7, ease: 'elastic.out(1, 0.4)' });
          },
          onHover: (on) => { if (cursor.setOverride) cursor.setOverride(on); }
        });
        pre.step(80);
        await scene.warmup();
      } catch (err) {
        console.error('3D-сцена не запустилась:', err);
        scene = null;
      }
    }
    if (!scene) html.classList.add('no-webgl');

    initAnimations();
    if (scene) gsap.ticker.add((time, dtMs) => scene.render(time, Math.min(dtMs / 1000, 0.05)));

    await pre.done();
    html.style.overflow = '';
    html.classList.remove('is-loading');
    if (lenis) lenis.start();
    ScrollTrigger.refresh();
    heroIntro();
    initCursor();
    initMagnetic();
    initTilt();
  }

  // Прелоадер не должен «зависнуть», даже если что-то пошло не так
  boot().catch((err) => {
    console.error('NAMI: ошибка запуска', err);
    $('[data-preloader]').classList.add('is-done');
    html.style.overflow = '';
    if (lenis) lenis.start();
  });
})();
