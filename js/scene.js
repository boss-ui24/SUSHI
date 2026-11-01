/* NAMI 波 — один WebGL-рендерер на всю страницу.
   Каждая 3D-сцена привязана к DOM-элементу [data-view] и рисуется в его прямоугольник
   (viewport + scissor). Модели «живут» в карточках и секциях и скроллятся вместе с ними,
   а браузеру нужен всего один WebGL-контекст. */
window.NamiScene = function (THREE, K, opts) {
  'use strict';

  const { canvas, data: D, mobile = false, reduced = false } = opts;
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
  const rr = (a, b) => a + (b - a) * Math.random();
  const gsap = window.gsap;

  const _v = new THREE.Vector3(), _t = new THREE.Vector3(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
  const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _m = new THREE.Matrix4();

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  /* ---------- Окружение для бликов: маленькая «фотостудия» вместо HDR-картинки ---------- */
  const env = (() => {
    const pm = new THREE.PMREMGenerator(renderer);
    const s = new THREE.Scene();
    s.add(new THREE.Mesh(new THREE.BoxGeometry(12, 12, 12), new THREE.MeshBasicMaterial({ color: 0x1a1411, side: THREE.BackSide })));
    const panel = (w, h, color, k, x, y, z) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
      m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m);
    };
    panel(6, 3, '#fff3e6', 7, 0, 5.5, 1);       // софтбокс сверху
    panel(2.5, 4, '#ffd7b8', 3.2, -5.5, 1.5, 2); // тёплый слева
    panel(2.5, 4, '#e6f0ff', 2.2, 5.5, 1, -1);   // холодный справа
    panel(8, 1.2, '#ff8a5c', 1.4, 0, -1, -5.5);  // лососевый контровой
    const tex = pm.fromScene(s, 0.04).texture;
    pm.dispose();
    return tex;
  })();

  // Одинаковый набор источников во всех сценах → шейдеры компилируются один раз
  function rig(scene, { key = 2.4, fill = 1.0, rim = 1.6 } = {}) {
    scene.environment = env;
    const hemi = new THREE.HemisphereLight('#fff1e2', '#2b1d15', fill);
    const k = new THREE.DirectionalLight('#ffe5cc', key); k.position.set(-3, 5, 4);
    const r = new THREE.DirectionalLight('#ff9d70', rim); r.position.set(4, 2.5, -4);
    scene.add(hemi, k, r);
  }

  // Камера смотрит на центр c под углом elev и вписывает коробку ±(hx, hy, hz) в кадр
  function fitBox(cam, c, hx, hy, hz, elev, margin = 0.86) {
    let d = Math.max(hx, hy, hz) * 4;
    for (let it = 0; it < 6; it++) {
      cam.position.set(c.x, c.y + Math.sin(elev) * d, c.z + Math.cos(elev) * d);
      cam.lookAt(c);
      cam.updateMatrixWorld();
      let m = 0;
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
        _v.set(c.x + sx * hx, c.y + sy * hy, c.z + sz * hz).project(cam);
        m = Math.max(m, Math.abs(_v.x), Math.abs(_v.y));
      }
      d *= m / margin;
    }
  }

  /* ---------- Виды ---------- */
  const views = [];
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => entries.forEach((e) => { if (e.target.__view) e.target.__view.near = e.isIntersecting; }), { rootMargin: '30% 0px' })
    : null;
  function addView(el, scene, camera, update, extra = {}) {
    const v = Object.assign({ el, scene, camera, update, near: !io, w: 0, h: 0 }, extra);
    el.__view = v;
    views.push(v);
    if (io) io.observe(el);
    return v;
  }

  /* ============================== HERO ============================== */
  const hero = { out: 0, soft: 0, mx: 0, my: 0, sx: 0, sy: 0, rotY: 0.5, rotX: 0, vel: 0, drag: false };
  const heroEl = document.querySelector('[data-view="hero"]');
  const heroScene = new THREE.Scene();
  rig(heroScene, { key: 2.6, rim: 2.4 });
  const heroCam = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  heroCam.position.set(0, 0.3, 11);
  const heroRoot = new THREE.Group();
  heroScene.add(heroRoot);
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(heroCam.fov / 2));

  const pieces = {};
  function piece(name, obj, spin, bob, rot = [rr(0, TAU), rr(0, TAU), 0]) {
    const anchor = new THREE.Group(), intro = new THREE.Group(), turn = new THREE.Group();
    anchor.add(intro); intro.add(turn); turn.add(obj);
    turn.rotation.set(rot[0], rot[1], rot[2]);
    heroRoot.add(anchor);
    pieces[name] = { anchor, intro, turn, spin, bob, phase: rr(0, TAU) };
  }
  piece('main', K.centered(K.nigiri('salmon', { q: 1.6 })), [0, 0], [0.9, 0.1], [0, 0, 0]);
  piece('phila', K.centered(K.roll('philadelphia', { q: 0.9 })), [0.25, 0.4], [0.7, 0.16]);
  piece('gunkan', K.centered(K.gunkan()), [0.12, -0.35], [0.8, 0.14]);
  piece('tamago', K.centered(K.nigiri('tamago', { q: 0.7 })), [-0.2, 0.3], [0.6, 0.18]);
  piece('maki', K.centered(K.hosomaki()), [0.4, 0.25], [1.0, 0.12]);
  piece('sticks', K.centered(K.chopsticks()), [0.04, 0.06], [0.5, 0.08], [0.3, 0.4, 0.95]);
  piece('ginger', K.centered(K.ginger(5)), [0.3, -0.2], [0.75, 0.14]);
  piece('wasabi', K.centered(K.wasabi()), [0.2, 0.5], [0.85, 0.12]);

  // [доля полуширины кадра, доля полувысоты, глубина z, масштаб]
  const LAYOUT = {
    wide: {
      main: [0.44, -0.04, 0, 1.3], phila: [0.2, 0.7, -3, 0.95], gunkan: [0.86, -0.6, -1.2, 0.85],
      tamago: [0.92, 0.62, -3.5, 0.85], maki: [0.3, -0.7, 1, 0.72], sticks: [0.66, 0.3, -4.5, 0.9],
      ginger: [0.02, -0.86, -3, 1.0], wasabi: [1.0, 0.02, -2.5, 1.1]
    },
    // телефон: текст занимает нижнюю половину, поэтому все кусочки — выше него
    tall: {
      main: [0.02, 0.52, 0, 0.74], phila: [-0.72, 0.76, -2.5, 0.52], gunkan: [0.8, 0.34, -1.5, 0.44],
      tamago: [0.74, 0.74, -3, 0.48], maki: [-0.82, 0.36, -1, 0.42], sticks: [0.16, 0.86, -4.5, 0.5],
      ginger: [-0.6, 0.2, -4, 0.4], wasabi: [0.62, 0.17, -3, 0.42]
    }
  };

  // Кунжут, парящий в воздухе
  const SES = mobile ? 26 : 54;
  const ses = new THREE.InstancedMesh(K.G.seed, K.M.seed, SES);
  ses.frustumCulled = false;
  const sesData = [];
  const sesColor = new THREE.Color();
  for (let i = 0; i < SES; i++) {
    // в основном справа от текста и в глубине кадра
    sesData.push({ x: Math.random() < 0.75 ? rr(0.05, 1.1) : rr(-1.1, 0.05), y: rr(-1.15, 1.15), z: rr(-9, 1), s: rr(1.2, 2.2), rx: rr(0, TAU), ry: rr(0, TAU), vy: rr(0.05, 0.14), vr: rr(-1.4, 1.4) });
    ses.setColorAt(i, Math.random() < 0.3 ? sesColor.set('#1c1815') : sesColor.set('#f0dfbd'));
  }
  heroRoot.add(ses);

  function updateSesame(dt, tall) {
    for (let i = 0; i < SES; i++) {
      const d = sesData[i];
      d.y += d.vy * dt * 0.3 * (1 + hero.soft * 3);
      if (d.y > 1.15) d.y -= 2.3;
      d.rx += d.vr * dt; d.ry += d.vr * 0.7 * dt;
      const hh = (heroCam.position.z - d.z) * tanHalf, hw = hh * heroCam.aspect;
      // на телефоне кунжут летает только над текстом
      const x = tall ? (d.x * 2 - 1.1) * 0.5 : d.x, y = tall ? 0.12 + (d.y + 1.15) * 0.45 : d.y;
      _p.set(x * hw, heroCam.position.y + y * hh, d.z);
      _q.setFromEuler(_e.set(d.rx, d.ry, 0));
      ses.setMatrixAt(i, _m.compose(_p, _q, _s.set(0.034 * d.s, 0.011 * d.s, 0.021 * d.s)));
    }
    ses.instanceMatrix.needsUpdate = true;
  }

  function updateHero(time, dt, rect) {
    const tall = rect.width / rect.height < 0.9;
    const L = tall ? LAYOUT.tall : LAYOUT.wide;
    hero.sx = damp(hero.sx, hero.mx, 3, dt);
    hero.sy = damp(hero.sy, hero.my, 3, dt);
    if (!hero.drag) {
      hero.rotY += (hero.vel + (reduced ? 0.05 : 0.32)) * dt;
      hero.vel *= Math.exp(-2.2 * dt);
      hero.rotX = damp(hero.rotX, 0, 2, dt);
    }
    // на телефоне события скролла приходят неровно: без сглаживания кусочки разлетаются рывками
    const out = hero.soft = damp(hero.soft, hero.out, 12, dt);
    heroRoot.rotation.y = hero.sx * 0.1;
    heroRoot.rotation.x = hero.sy * 0.05;
    for (const k in pieces) {
      const p = pieces[k], l = L[k];
      const hh = (heroCam.position.z - l[2]) * tanHalf, hw = hh * heroCam.aspect;
      const spread = k === 'main' ? 1 : 1 + out * 0.8;
      p.anchor.position.set(l[0] * hw * spread, heroCam.position.y + l[1] * hh * spread + (k === 'main' ? out * hh * 0.45 : 0), l[2]);
      p.anchor.scale.setScalar(l[3]);
      p.turn.position.y = Math.sin(time * p.bob[0] + p.phase) * p.bob[1];
      if (k === 'main') {
        p.turn.rotation.set(0.42 + hero.rotX + hero.sy * 0.12 + out * 0.9, hero.rotY, -0.1 + hero.sx * 0.08);
      } else if (!reduced) {
        p.turn.rotation.x += p.spin[0] * dt;
        p.turn.rotation.y += p.spin[1] * dt;
      }
    }
    updateSesame(dt, tall);
  }
  addView(heroEl, heroScene, heroCam, updateHero);

  // Мышь — лёгкий параллакс всей сцены
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return; // палец на экране — это прокрутка, а не наведение
    hero.mx = e.clientX / window.innerWidth * 2 - 1;
    hero.my = e.clientY / window.innerHeight * 2 - 1;
  }, { passive: true });

  // Перетаскивание главного нигири с инерцией
  const dragEl = document.querySelector('[data-hero-drag]');
  if (dragEl) {
    let lx = 0, ly = 0, lt = 0;
    dragEl.addEventListener('pointerdown', (e) => {
      hero.drag = true; hero.vel = 0;
      lx = e.clientX; ly = e.clientY; lt = performance.now();
      dragEl.setPointerCapture(e.pointerId);
    });
    dragEl.addEventListener('pointermove', (e) => {
      if (!hero.drag) return;
      const now = performance.now(), dx = e.clientX - lx, dy = e.clientY - ly;
      // вертикальный свайп пальцем — это прокрутка страницы, нигири от него не должно дёргаться
      const touch = e.pointerType !== 'mouse';
      if (!touch || Math.abs(dx) > Math.abs(dy)) {
        hero.rotY += dx * 0.012;
        if (!touch) hero.rotX = clamp(hero.rotX + dy * 0.006, -0.7, 0.7);
        hero.vel = clamp((dx * 0.012) / Math.max(0.008, (now - lt) / 1000), -9, 9);
      }
      lx = e.clientX; ly = e.clientY; lt = now;
    });
    const end = () => { hero.drag = false; };
    dragEl.addEventListener('pointerup', end);
    dragEl.addEventListener('pointercancel', end);
  }

  function introHero() {
    if (!gsap) return;
    let i = 0;
    for (const k in pieces) {
      const p = pieces[k];
      if (k === 'main') {
        gsap.from(p.intro.position, { y: 7, duration: 1.8, ease: 'bounce.out', delay: 0.15 });
        gsap.from(p.intro.rotation, { x: -1.4, z: 0.7, duration: 2.2, ease: 'expo.out', delay: 0.15 });
      } else {
        const d = 0.45 + i * 0.07;
        gsap.from(p.intro.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 1.4, ease: 'back.out(1.8)', delay: d });
        gsap.from(p.intro.position, { y: -4, duration: 1.6, ease: 'expo.out', delay: d });
      }
      i++;
    }
    gsap.from(ses.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 2, ease: 'expo.out', delay: 0.6 });
  }

  /* ============================ АНАТОМИЯ ============================ */
  const anat = { explode: 0 };
  const anatEl = document.querySelector('[data-view="anatomy"]');
  const anatScene = new THREE.Scene();
  rig(anatScene, { key: 2.8, rim: 2.2 });
  const anatCam = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  anatCam.position.set(0, 0.4, 13);
  anatCam.lookAt(0, 0, 0);
  const anatRoll = K.roll('philadelphia', { q: 1.6 });
  const anatPivot = new THREE.Group();
  anatPivot.add(anatRoll);
  anatScene.add(anatPivot);
  const { layers, info } = anatRoll.userData;
  const OFFS = [1.5, 0.75, 0, -0.62, -1.2, -1.76];
  const TWIST = [0.55, 0.28, 0, -0.32, -0.6, -0.85];
  const meanOff = OFFS.reduce((a, b) => a + b, 0) / OFFS.length;
  const labels = Array.from(document.querySelectorAll('.alabel'));
  const svg = document.querySelector('[data-anat-lines]');
  const NS = 'http://www.w3.org/2000/svg';
  const lines = labels.map(() => {
    const l = document.createElementNS(NS, 'line'), c = document.createElementNS(NS, 'circle');
    c.setAttribute('r', '3.5');
    svg.append(l, c);
    return { l, c };
  });
  const stepEl = document.querySelector('[data-anat-step]');
  let lastStep = -1;

  function updateAnatomy(time, dt, rect) {
    const e = anat.explode, ee = e * e * (3 - 2 * e);
    const narrow = rect.width < 600;
    const S = narrow ? 1.1 : 1.45;
    anatPivot.scale.setScalar(S);
    anatPivot.rotation.x = 0.55 + ee * 0.32; // при разборке камера смотрит сильнее сверху — видно срез каждого слоя
    anatPivot.position.y = -meanOff * ee * S * 0.9;
    anatRoll.rotation.y += dt * (reduced ? 0.06 : 0.28);
    layers.forEach((L, i) => { L.position.y = OFFS[i] * ee; L.rotation.y = TWIST[i] * ee; });
    anatScene.updateMatrixWorld();

    const gap = narrow ? 16 : 46;
    let visible = 0;
    labels.forEach((el, i) => {
      const side = i % 2 === 0 ? 1 : -1;
      _v.copy(info[i].c).applyMatrix4(layers[i].matrixWorld);
      _v.x += side * info[i].r * S;
      _v.project(anatCam);
      const x = (_v.x + 1) / 2 * rect.width, y = (1 - _v.y) / 2 * rect.height;
      const o = clamp((ee - 0.25 - i * 0.07) * 5, 0, 1);
      if (o > 0.5) visible++;
      el.classList.toggle('is-left', side < 0);
      el.style.opacity = o;
      el.style.transform = `translate3d(${(x + side * gap).toFixed(1)}px,${y.toFixed(1)}px,0)`;
      const ln = lines[i];
      ln.l.setAttribute('x1', x.toFixed(1)); ln.l.setAttribute('y1', y.toFixed(1));
      ln.l.setAttribute('x2', (x + side * (gap - 8) * o).toFixed(1)); ln.l.setAttribute('y2', y.toFixed(1));
      ln.c.setAttribute('cx', x.toFixed(1)); ln.c.setAttribute('cy', y.toFixed(1));
      ln.l.style.opacity = ln.c.style.opacity = o;
    });
    if (visible !== lastStep && stepEl) {
      lastStep = visible;
      stepEl.textContent = String(visible).padStart(2, '0') + ' / 06';
    }
  }
  addView(anatEl, anatScene, anatCam, updateAnatomy);

  /* ============================ КАРТОЧКИ ============================ */
  document.querySelectorAll('[data-view="card"]').forEach((el) => {
    const scene = new THREE.Scene();
    rig(scene);
    const model = K.cardModel(el.dataset.model);
    const size = model.userData.size;
    const pivot = new THREE.Group();
    pivot.add(model);
    scene.add(pivot);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    const center = new THREE.Vector3(0, size.y * 0.5, 0);
    const rH = 0.5 * Math.hypot(size.x, size.z);
    const card = el.closest('.card, .promo__card');
    const st = { hover: 0, target: 0, mx: 0, my: 0, sx: 0, sy: 0, spin: rr(0, TAU), extra: 0 };
    const hoverEl = card || el;
    hoverEl.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') st.target = 1; });
    hoverEl.addEventListener('pointerleave', () => { st.target = 0; st.mx = st.my = 0; });
    hoverEl.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      st.mx = clamp((e.clientX - r.left) / r.width * 2 - 1, -1, 1);
      st.my = clamp((e.clientY - r.top) / r.height * 2 - 1, -1, 1);
    });
    // клик/тап — полный оборот
    el.addEventListener('click', () => { if (gsap) gsap.to(st, { extra: st.extra + TAU, duration: 1.4, ease: 'power3.inOut' }); });

    addView(el, scene, cam, (time, dt) => {
      st.hover = damp(st.hover, st.target, 6, dt);
      st.sx = damp(st.sx, st.mx, 5, dt);
      st.sy = damp(st.sy, st.my, 5, dt);
      st.spin += dt * (reduced ? 0.05 : 0.3) * (1 - st.hover * 0.8);
      pivot.rotation.y = st.spin + st.extra + st.sx * 0.8 * st.hover;
      pivot.rotation.x = st.sy * 0.22 * st.hover;
      pivot.position.y = st.hover * size.y * 0.06;
      // canvas лежит под DOM, поэтому прозрачность карточки (появление, Flip-фильтр)
      // на модель не действует — повторяем её масштабом и не рисуем скрытую
      const op = card && card.style.opacity !== '' ? parseFloat(card.style.opacity) : 1;
      if (op < 0.02) return false;
      pivot.scale.setScalar((1 + st.hover * 0.06) * (0.35 + 0.65 * op));
    // коробка ±rH описывает модель с запасом (она вращается), поэтому вписываем чуть «внахлёст»
    }, { onResize: () => fitBox(cam, center, rH, size.y * 0.5, rH, 0.5, el.classList.contains('promo__media') ? 1.02 : 1.14) });
  });

  /* ============================== КАЙТЕН ============================== */
  const kEl = document.querySelector('[data-view="kaiten"]');
  const kScene = new THREE.Scene();
  rig(kScene, { key: 2.4, fill: 1.25, rim: 1.2 });
  const kCam = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
  const conv = K.conveyor();
  const kRoot = new THREE.Group();
  kRoot.add(conv.group);
  kScene.add(kRoot);

  const pool = D.menu.filter((m) => m.plate);
  // Порции заранее, по две на блюдо: снятая тарелка возвращается с другой едой
  const contents = [];
  pool.forEach((item) => { for (let j = 0; j < 2; j++) contents.push({ item, obj: K.plateItem(item.id), used: false }); });

  const NPL = 12;
  const plates = [];
  const hitGeo = new THREE.CylinderGeometry(1.0, 1.0, 0.9, 16);
  hitGeo.translate(0, 0.45, 0);

  function setContent(p, c) {
    if (p.content) { p.lift.remove(p.content.obj); p.content.used = false; }
    c.used = true;
    p.content = c;
    p.item = c.item;
    c.obj.position.y = 0.107;
    p.lift.add(c.obj);
    p.body.material = K.plateMaterial(D.plates[c.item.plate].color);
  }

  for (let i = 0; i < NPL; i++) {
    const group = new THREE.Group(), lift = new THREE.Group();
    const pl = K.plate('#ffffff');
    lift.add(pl);
    group.add(lift);
    const sh = K.shadow(2.3);
    sh.position.y = 0.002;
    group.add(sh);
    const hit = new THREE.Mesh(hitGeo);
    hit.visible = false;
    hit.userData.index = i;
    lift.add(hit);
    kRoot.add(group);
    const p = { group, lift, body: pl.userData.body, hit, content: null, item: null, slot: i * conv.L / NPL, taken: false, hover: 0 };
    setContent(p, contents.find((c) => !c.used && c.item === pool[i % pool.length]));
    plates.push(p);
  }

  // Координаты мыши храним в пикселях окна и пересчитываем в сцену каждый кадр:
  // при скролле сцена уезжает из-под неподвижного курсора, а pointerleave не приходит
  const kst = { offset: 0, boost: 0, push: 0, hovered: -1, cx: -1, cy: -1, ndc: new THREE.Vector2() };
  window.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') { kst.cx = e.clientX; kst.cy = e.clientY; } }, { passive: true });
  document.documentElement.addEventListener('mouseleave', () => { kst.cx = kst.cy = -1; });
  function pointerOver(rect) {
    if (kst.cx < rect.left || kst.cx > rect.right || kst.cy < rect.top || kst.cy > rect.bottom) return false;
    const top = document.elementFromPoint(kst.cx, kst.cy);
    if (!top || !kEl.contains(top) || top.closest('.kaiten__legend, .kaiten__count')) return false;
    kst.ndc.set((kst.cx - rect.left) / rect.width * 2 - 1, -((kst.cy - rect.top) / rect.height) * 2 + 1);
    return true;
  }
  const ray = new THREE.Raycaster();
  const tip = document.querySelector('[data-kaiten-tip]');
  const tipName = tip.querySelector('[data-tip-name]'), tipPrice = tip.querySelector('[data-tip-price]');
  let tipItem = null;

  function pick() {
    kRoot.updateMatrixWorld();
    ray.setFromCamera(kst.ndc, kCam);
    const hits = ray.intersectObjects(plates.filter((p) => !p.taken).map((p) => p.hit), false);
    return hits.length ? hits[0].object.userData.index : -1;
  }
  function setNdc(e) {
    const r = kEl.getBoundingClientRect();
    kst.ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }

  function take(p, cx, cy) {
    if (p.taken) return;
    p.taken = true;
    if (opts.onTake) opts.onTake(p.item, cx, cy);
    if (!gsap) { p.lift.visible = false; setTimeout(() => respawn(p), 2400); return; }
    gsap.to(p.lift.position, { y: 2.4, duration: 0.7, ease: 'power3.out' });
    gsap.to(p.lift.rotation, { y: '+=' + Math.PI, duration: 0.8, ease: 'power2.out' });
    gsap.to(p.lift.scale, {
      x: 0.001, y: 0.001, z: 0.001, duration: 0.45, delay: 0.3, ease: 'back.in(2)',
      onComplete: () => { p.lift.visible = false; gsap.delayedCall(2.2, () => respawn(p)); }
    });
  }
  function respawn(p) {
    const free = contents.filter((c) => !c.used);
    setContent(p, free[Math.floor(Math.random() * free.length)]);
    p.lift.position.y = 0;
    p.lift.rotation.y = 0;
    p.lift.visible = true;
    p.hover = 0;
    if (!gsap) { p.lift.scale.set(1, 1, 1); p.taken = false; return; }
    gsap.fromTo(p.lift.scale, { x: 0.001, y: 0.001, z: 0.001 }, { x: 1, y: 1, z: 1, duration: 1, ease: 'elastic.out(1, 0.55)', onComplete: () => { p.taken = false; } });
  }

  kEl.addEventListener('click', (e) => {
    if (e.target.closest('.kaiten__legend, .kaiten__count')) return;
    setNdc(e);
    const i = pick();
    if (i >= 0) take(plates[i], e.clientX, e.clientY);
  });

  function fitKaiten(rect) {
    const portrait = rect.width / rect.height < 1;
    kRoot.rotation.y = portrait ? Math.PI / 2 : 0;
    const hx = (portrait ? conv.size.z : conv.size.x) / 2, hz = (portrait ? conv.size.x : conv.size.z) / 2;
    fitBox(kCam, _t.set(0, 0.15, 0), hx, 0.3, hz, portrait ? 0.98 : 0.86, 0.97);
  }

  function updateKaiten(time, dt, rect) {
    // скорость скролла на телефоне прыгает, поэтому лента разгоняется плавно
    kst.boost = damp(kst.boost, kst.push, kst.push > kst.boost ? 6 : 1.4, dt);
    kst.push = 0;
    kst.offset += ((reduced ? 0.25 : 0.6) + kst.boost) * dt;
    conv.update(kst.offset);
    for (const p of plates) {
      conv.path(kst.offset + p.slot, _v, _t);
      p.group.position.set(_v.x, 0.055, _v.z);
      p.group.rotation.y = Math.atan2(-_t.z, _t.x);
    }
    const h = pointerOver(rect) ? pick() : -1;
    if (h !== kst.hovered) {
      kst.hovered = h;
      if (opts.onHover) opts.onHover(h >= 0);
    }
    plates.forEach((p, i) => {
      p.hover = damp(p.hover, i === h ? 1 : 0, 10, dt);
      if (!p.taken) p.lift.position.y = p.hover * 0.3;
    });
    if (h >= 0) {
      const p = plates[h];
      p.lift.updateMatrixWorld();
      _v.set(0, 1.05, 0).applyMatrix4(p.lift.matrixWorld).project(kCam);
      if (tipItem !== p.item) {
        tipItem = p.item;
        tipName.textContent = opts.t('item.' + p.item.id + '.name');
        tipPrice.textContent = opts.money(D.plates[p.item.plate].price);
        tip.style.setProperty('--c', D.plates[p.item.plate].color);
      }
      tip.style.transform = `translate3d(${((_v.x + 1) / 2 * rect.width).toFixed(1)}px,${((1 - _v.y) / 2 * rect.height).toFixed(1)}px,0)`;
      tip.classList.add('is-on');
    } else if (tipItem) {
      tipItem = null;
      tip.classList.remove('is-on');
    }
  }
  addView(kEl, kScene, kCam, updateKaiten, {
    onResize: fitKaiten,
    onHide() {
      kst.hovered = -1;
      tipItem = null;
      tip.classList.remove('is-on');
      if (opts.onHover) opts.onHover(false);
    }
  });

  /* ============================ КОНСТРУКТОР ============================ */
  const bEl = document.querySelector('[data-view="builder"]');
  const bScene = new THREE.Scene();
  rig(bScene, { key: 2.6, rim: 2 });
  const bCam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const bModel = K.customPlate({ q: 0.9 });
  const bPivot = new THREE.Group();
  bPivot.add(bModel);
  bScene.add(bPivot);
  const bSt = { spin: 0.5, extra: 0 };
  bEl.addEventListener('click', () => { if (gsap) gsap.to(bSt, { extra: bSt.extra + TAU, duration: 1.4, ease: 'power3.inOut' }); });

  addView(bEl, bScene, bCam, (time, dt) => {
    bSt.spin += dt * (reduced ? 0.05 : 0.2);
    bPivot.rotation.y = bSt.spin + bSt.extra;
  }, { onResize: () => fitBox(bCam, _t.set(0, 0.3, 0), 2.3, 0.4, 2.3, 0.78, 1) });

  // Новая «шуба» — кусочки подпрыгивают, новая начинка — въезжает в ролл сверху
  const builder = {
    set(cfg, changed) {
      const { pieces, set } = bModel.userData;
      set(cfg);
      if (!gsap || reduced || !changed) return;
      pieces.forEach((p, i) => {
        const delay = i * 0.07;
        if (changed === 'outer' || changed === 'all') {
          gsap.fromTo(p.position, { y: p.userData.base + 0.9 }, { y: p.userData.base, duration: 0.8, ease: 'bounce.out', delay, overwrite: true });
        }
        const { slots } = p.userData;
        const moved = changed === 'main' ? [slots[0]] : changed === 'extras' ? [slots[1], slots[2]] : changed === 'all' ? slots : [];
        moved.forEach((s) => gsap.fromTo(s.position, { y: 0.8 }, { y: 0, duration: 0.6, ease: 'back.out(2)', delay, overwrite: true }));
      });
    }
  };

  /* ============================== ЦИКЛ ============================== */
  // Телефон двигает страницу в отдельном потоке, а кадр WebGL приходит позже: холст с position: fixed
  // отставал от карточек, и суши дрожали при прокрутке. Поэтому здесь холст лежит в документе:
  // браузер скроллит его вместе со страницей, а раз в кадр мы возвращаем его на экран.
  // Запас over сверху и снизу закрывает резкий свайп. Когда анатомия закреплена (sticky),
  // на месте должен стоять и холст — на это время он становится position: fixed.
  const docCanvas = mobile;
  if (docCanvas) canvas.parentElement.classList.add('is-doc');
  const stuckEl = anatEl.closest('.anatomy__pin'), stuckBox = stuckEl.parentElement;
  let W = 0, H = 0, over = 0, stuck = false, shift = null, offset = 0; // offset — верх холста в координатах окна

  function place() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w !== W || h !== H) { W = w; H = h; over = docCanvas ? Math.round(h / 6) : 0; shift = null; renderer.setSize(w, h, false); }
    if (!docCanvas) return;
    const box = stuckBox.getBoundingClientRect();
    const now = box.top <= 0 && box.bottom >= stuckEl.offsetHeight;
    if (now !== stuck) { stuck = now; canvas.style.position = now ? 'fixed' : ''; shift = null; }
    // сдвиг кратен пикселю буфера: иначе округление viewport даёт дрожь в полпикселя
    const pr = renderer.getPixelRatio(), sy = window.scrollY;
    const y = stuck ? 0 : Math.round(sy * pr) / pr;
    if (y !== shift) { shift = y; canvas.style.transform = `translate3d(0,${y - over}px,0)`; }
    offset = (stuck ? 0 : y - sy) - over;
  }

  function render(time, dt) {
    place();
    renderer.setScissorTest(false);
    renderer.clear();
    renderer.setScissorTest(true);
    for (const v of views) {
      const drawn = v.near && draw(v, time, dt);
      if (!drawn && v.visible && v.onHide) v.onHide();
      v.visible = drawn;
    }
  }
  function draw(v, time, dt) {
    const r = v.el.getBoundingClientRect();
    const bottom = r.bottom - offset; // нижний край вида внутри холста
    if (r.width < 2 || r.height < 2 || bottom < 0 || r.top - offset > H || r.right < 0 || r.left > W) return false;
    if (Math.abs(r.width - v.w) > 0.5 || Math.abs(r.height - v.h) > 0.5) {
      v.w = r.width; v.h = r.height;
      v.camera.aspect = r.width / r.height;
      v.camera.updateProjectionMatrix();
      if (v.onResize) v.onResize(r);
    }
    if (v.update(time, dt, r) === false) return false;
    renderer.setViewport(r.left, H - bottom, r.width, r.height);
    renderer.setScissor(r.left, H - bottom, r.width, r.height);
    renderer.render(v.scene, v.camera);
    return true;
  }

  // Компиляция шейдеров во время прелоадера, чтобы не было рывков на первом кадре
  async function warmup() {
    for (const v of views) {
      try {
        if (renderer.compileAsync) await renderer.compileAsync(v.scene, v.camera);
        else renderer.compile(v.scene, v.camera);
      } catch (e) { /* не критично */ }
    }
  }

  return {
    renderer, hero, anat, builder,
    render, warmup, introHero,
    boost(v) { kst.push = Math.max(kst.push, Math.min(4.5, v * 0.06)); },
    relabel() { tipItem = null; tip.classList.remove('is-on'); kst.hovered = -2; }
  };
};
