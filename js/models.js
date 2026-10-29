/* NAMI 波 — процедурные 3D-модели суши.
   Ни картинок, ни glTF: геометрия собирается из примитивов Three.js,
   текстуры лосося, тунца, угря, риса, нори и дерева рисуются на <canvas>.
   Рис — это сотни отдельных зёрен (InstancedMesh), икра — глянцевые сферы. */
window.NamiModels = function (THREE, opts) {
  'use strict';

  const Q = (opts && opts.quality) || 1; // плотность зёрен и икринок (на телефонах меньше)
  const TAU = Math.PI * 2;

  // Детерминированный генератор случайных чисел: модели одинаковые при каждой загрузке
  let seed = 1029;
  const rand = () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rr = (a, b) => a + (b - a) * rand();
  const cnt = (n) => Math.max(3, Math.round(n * Q));

  /* ============================ Текстуры ============================ */

  function canvasTex(w, h, draw, srgb = true) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    return t;
  }
  const withRepeat = (tex, x, y = x) => { const t = tex.clone(); t.repeat.set(x, y); t.needsUpdate = true; return t; };

  // Рисует элемент бесшовно: у краёв дублирует его с противоположной стороны
  function tiled(w, h, x, y, m, fn) {
    for (const dx of [0, -w, w]) for (const dy of [0, -h, h]) {
      if (dx && (x + dx < -m || x + dx > w + m)) continue;
      if (dy && (y + dy < -m || y + dy > h + m)) continue;
      fn(x + dx, y + dy);
    }
  }

  // Лосось: тёплый градиент + мягкие белые прожилки жира по диагонали
  const salmonTex = canvasTex(512, 512, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, w, h);
    grd.addColorStop(0, '#ff8d55'); grd.addColorStop(0.5, '#ff7040'); grd.addColorStop(1, '#f2582a');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 220; i++) {
      g.fillStyle = `rgba(255,${150 + rand() * 60 | 0},${90 + rand() * 50 | 0},${rr(0.04, 0.1)})`;
      g.beginPath(); g.arc(rand() * w, rand() * h, rr(4, 22), 0, TAU); g.fill();
    }
    g.lineCap = 'round';
    for (let i = -4; i < 16; i++) {
      const x = i * w / 11 + rr(-8, 8);
      for (const [lw, a] of [[18, 0.08], [9, 0.22], [3.5, 0.55]]) {
        g.lineWidth = lw * rr(0.8, 1.2);
        g.strokeStyle = `rgba(255,240,228,${a})`;
        g.beginPath(); g.moveTo(x - w * 0.3, h + 12);
        g.bezierCurveTo(x - w * 0.08, h * 0.65, x + w * 0.02, h * 0.35, x + w * 0.3, -12);
        g.stroke();
      }
    }
  });

  // Тунец аками: глубокий красный, едва заметные светлые волокна
  const tunaTex = canvasTex(512, 512, (g, w, h) => {
    const grd = g.createLinearGradient(0, h, w, 0);
    grd.addColorStop(0, '#9c0f27'); grd.addColorStop(0.5, '#c8223d'); grd.addColorStop(1, '#a3132c');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 300; i++) {
      g.fillStyle = `rgba(${200 + rand() * 55 | 0},${40 + rand() * 40 | 0},${60 + rand() * 40 | 0},${rr(0.03, 0.09)})`;
      g.beginPath(); g.arc(rand() * w, rand() * h, rr(3, 20), 0, TAU); g.fill();
    }
    g.lineCap = 'round';
    for (let i = -4; i < 14; i++) {
      const x = i * w / 9 + rr(-10, 10);
      g.lineWidth = rr(2, 5); g.strokeStyle = `rgba(255,150,160,${rr(0.07, 0.15)})`;
      g.beginPath(); g.moveTo(x - w * 0.25, h + 10); g.quadraticCurveTo(x, h * 0.5, x + w * 0.25, -10); g.stroke();
    }
  });

  // Угорь унаги: карамельно-коричневый с полосками гриля
  const eelTex = canvasTex(512, 256, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#80421a'); grd.addColorStop(0.6, '#5e2c10'); grd.addColorStop(1, '#3a1a08');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      const x = i * w / 13 + rr(-6, 6);
      g.fillStyle = `rgba(30,12,4,${rr(0.25, 0.45)})`;
      g.save(); g.translate(x, h / 2); g.rotate(0.35); g.fillRect(-rr(3, 7), -h, rr(6, 12), h * 2); g.restore();
    }
    for (let i = 0; i < 160; i++) {
      g.fillStyle = `rgba(255,190,120,${rr(0.03, 0.08)})`;
      g.beginPath(); g.arc(rand() * w, rand() * h, rr(2, 10), 0, TAU); g.fill();
    }
  });

  // Тамаго: слоистый омлет
  const tamagoTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#f6c843'; g.fillRect(0, 0, w, h);
    for (let y = 6; y < h; y += rr(14, 22)) { g.fillStyle = `rgba(214,150,30,${rr(0.25, 0.45)})`; g.fillRect(0, y, w, rr(1.5, 3)); }
    for (let i = 0; i < 60; i++) {
      g.fillStyle = `rgba(190,120,30,${rr(0.05, 0.15)})`;
      g.beginPath(); g.arc(rand() * w, rand() * h, rr(3, 12), 0, TAU); g.fill();
    }
  });

  // Рис на срезе: сотни зёрнышек с тенью (под настоящими 3D-зёрнами)
  const riceTex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#e6ddcd'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1500; i++) {
      const x = rand() * w, y = rand() * h, a = rand() * Math.PI, l = rr(9, 12), s = rr(3.8, 4.8);
      const b = 236 + rand() * 19 | 0;
      tiled(w, h, x, y, 14, (px, py) => {
        g.save(); g.translate(px, py); g.rotate(a);
        g.fillStyle = 'rgba(140,120,95,0.28)'; g.beginPath(); g.ellipse(1.2, 1.6, l, s, 0, 0, TAU); g.fill();
        g.fillStyle = `rgb(${b},${b - 4},${b - 12})`; g.beginPath(); g.ellipse(0, 0, l, s, 0, 0, TAU); g.fill();
        g.restore();
      });
    }
  });

  // Нори: почти чёрный зелёный с волокнами
  const noriTex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#15221a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4200; i++) {
      const x = rand() * w, y = rand() * h, a = rand() * TAU, l = rr(2, 9);
      g.strokeStyle = rand() < 0.6 ? `rgba(70,105,62,${rr(0.12, 0.3)})` : `rgba(0,0,0,${rr(0.2, 0.4)})`;
      g.lineWidth = rr(0.6, 1.6);
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
  });

  // Лист шисо с прожилками
  const shisoTex = canvasTex(256, 256, (g, w, h) => {
    const grd = g.createRadialGradient(w * 0.5, h * 0.5, 10, w * 0.5, h * 0.5, w * 0.6);
    grd.addColorStop(0, '#5ea43f'); grd.addColorStop(1, '#2d6623');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(175,225,125,0.55)'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
    g.lineWidth = 1.5;
    for (let i = 1; i < 8; i++) {
      const x = i * w / 8;
      g.beginPath(); g.moveTo(x, h / 2); g.quadraticCurveTo(x + 18, h * 0.3, x + 34, h * 0.08);
      g.moveTo(x, h / 2); g.quadraticCurveTo(x + 18, h * 0.7, x + 34, h * 0.92); g.stroke();
    }
  });

  // Светлое дерево хиноки
  const woodTex = canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#b8874f'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 80; i++) {
      const y = rand() * h, amp = rr(1, 4), ph = rr(0, 6);
      g.strokeStyle = rand() < 0.5 ? `rgba(90,55,25,${rr(0.12, 0.35)})` : `rgba(215,175,125,${rr(0.12, 0.3)})`;
      g.lineWidth = rr(0.8, 3);
      g.beginPath(); g.moveTo(0, y);
      for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x * 0.02 + ph) * amp);
      g.stroke();
    }
  });

  // Мягкая тень под объектом
  const blobTex = canvasTex(128, 128, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, 'rgba(0,0,0,0.62)'); grd.addColorStop(0.45, 'rgba(0,0,0,0.3)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  }, false);
  blobTex.wrapS = blobTex.wrapT = THREE.ClampToEdgeWrapping;

  /* ============================ Материалы ============================ */

  const phys = (o) => new THREE.MeshPhysicalMaterial(o);
  const std = (o) => new THREE.MeshStandardMaterial(o);

  const M = {
    riceBody: std({ map: withRepeat(riceTex, 1.4, 0.7), roughness: 0.62 }),
    riceCut: std({ map: withRepeat(riceTex, 0.32), roughness: 0.64 }),
    grain: phys({ color: 0xffffff, roughness: 0.42, clearcoat: 0.25, clearcoatRoughness: 0.5, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new THREE.Color('#fff4e2') }),
    salmon: phys({ map: salmonTex, roughness: 0.36, clearcoat: 0.8, clearcoatRoughness: 0.22, sheen: 0.5, sheenRoughness: 0.4, sheenColor: new THREE.Color('#ffc09e') }),
    salmonWrap: phys({ map: withRepeat(salmonTex, 2.3, 0.32), roughness: 0.36, clearcoat: 0.8, clearcoatRoughness: 0.22, sheen: 0.5, sheenRoughness: 0.4, sheenColor: new THREE.Color('#ffc09e'), side: THREE.DoubleSide }),
    tuna: phys({ map: tunaTex, roughness: 0.34, clearcoat: 0.7, clearcoatRoughness: 0.25 }),
    eel: phys({ map: eelTex, roughness: 0.26, clearcoat: 1, clearcoatRoughness: 0.08 }),
    tamago: std({ map: tamagoTex, roughness: 0.55 }),
    nori: std({ map: withRepeat(noriTex, 0.6), roughness: 0.52, side: THREE.DoubleSide }),
    cheese: std({ color: '#fbf5ea', roughness: 0.75 }),
    avocado: std({ color: '#b9d15a', roughness: 0.42 }),
    avocadoSkin: std({ color: '#355d1f', roughness: 0.5 }),
    cucumber: std({ color: '#cfe79a', roughness: 0.4 }),
    cucumberSkin: std({ color: '#2e5a20', roughness: 0.45 }),
    crab: std({ color: '#fff4ec', roughness: 0.65 }),
    crabRed: std({ color: '#ef5a3c', roughness: 0.55 }),
    roe: phys({ color: '#ff5512', emissive: '#9a2400', emissiveIntensity: 0.45, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.04 }),
    masago: phys({ color: '#ff7a22', emissive: '#7a2600', emissiveIntensity: 0.3, roughness: 0.25, clearcoat: 0.7 }),
    seed: std({ color: 0xffffff, roughness: 0.5 }),
    sauce: phys({ color: '#2b1307', roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.04 }),
    shiso: std({ map: shisoTex, roughness: 0.55, side: THREE.DoubleSide }),
    ginger: phys({ color: '#f29a91', roughness: 0.35, clearcoat: 0.5, sheen: 0.8, sheenRoughness: 0.4, sheenColor: new THREE.Color('#ffc9bf'), side: THREE.DoubleSide }),
    wasabi: std({ color: '#8db63b', roughness: 0.8 }),
    lacquer: phys({ color: '#8c1c12', roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 }),
    bamboo: std({ color: '#d9bb8b', roughness: 0.6 }),
    gold: std({ color: '#d7a74e', metalness: 1, roughness: 0.3 }),
    wood: std({ map: woodTex, roughness: 0.65 }),
    woodDark: std({ map: woodTex, color: '#7a5a40', roughness: 0.6 }),
    ceramic: phys({ color: '#f3eee5', roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.1 }),
    metal: std({ color: '#c9c3bb', metalness: 0.9, roughness: 0.32 }),
    copper: std({ color: '#c77b45', metalness: 1, roughness: 0.35 }),
    belt: std({ color: '#34302d', metalness: 0.35, roughness: 0.42 }),
    beltBase: std({ color: '#121010', roughness: 0.8 }),
    slate: std({ color: '#221e1b', roughness: 0.85 }),
    shadow: new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, toneMapped: false })
  };

  const plateMats = {};
  const plateMaterial = (color) => (plateMats[color] = plateMats[color] || phys({ color, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.12 }));

  /* ========================= Общие геометрии ========================= */

  const G = {
    grain: new THREE.CapsuleGeometry(0.034, 0.075, 2, 6),
    roe: new THREE.SphereGeometry(1, 14, 10),
    bead: new THREE.SphereGeometry(1, 6, 5),
    seed: new THREE.SphereGeometry(1, 8, 6),
    plane: new THREE.PlaneGeometry(1, 1)
  };

  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
  const _s = new THREE.Vector3(), _p = new THREE.Vector3(), _n = new THREE.Vector3(), _t = new THREE.Vector3();
  const _c = new THREE.Color();
  const UP = new THREE.Vector3(0, 1, 0);

  const finish = (mesh) => {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.computeBoundingBox();
    return mesh;
  };

  // Зёрна риса по поверхности. sampler(p, n) задаёт точку и нормаль.
  function grains(n, sampler, scale = 1) {
    n = cnt(n);
    const mesh = new THREE.InstancedMesh(G.grain, M.grain, n);
    for (let i = 0; i < n; i++) {
      sampler(_p, _n);
      _t.set(rr(-1, 1), rr(-1, 1), rr(-1, 1)).cross(_n);
      if (_t.lengthSq() < 1e-5) _t.set(1, 0, 0);
      _t.normalize().addScaledVector(_n, rr(-0.3, 0.3)).normalize();
      _q.setFromUnitVectors(UP, _t);
      const k = scale * rr(0.85, 1.15);
      _p.addScaledVector(_n, 0.014 * scale);
      mesh.setMatrixAt(i, _m.compose(_p, _q, _s.set(k, k, k)));
      const b = rr(0.86, 1);
      mesh.setColorAt(i, _c.setRGB(b, b * 0.985, b * rr(0.9, 0.95)));
    }
    return finish(mesh);
  }

  // Икринки масаго / бусины
  function beads(geo, mat, n, sampler, r) {
    n = cnt(n);
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    _q.identity();
    for (let i = 0; i < n; i++) {
      sampler(_p, _n);
      const k = r * rr(0.85, 1.15);
      _p.addScaledVector(_n, k * 0.7);
      mesh.setMatrixAt(i, _m.compose(_p, _q, _s.set(k, k, k)));
    }
    return finish(mesh);
  }

  // Кунжут: плоские «зёрнышки», светлые и чёрные
  function sesame(n, sampler, black = 0.3, scale = 1) {
    n = cnt(n);
    const mesh = new THREE.InstancedMesh(G.seed, M.seed, n);
    for (let i = 0; i < n; i++) {
      sampler(_p, _n);
      _q.setFromUnitVectors(UP, _n).multiply(_q2.setFromAxisAngle(UP, rr(0, TAU)));
      _p.addScaledVector(_n, 0.008 * scale);
      mesh.setMatrixAt(i, _m.compose(_p, _q, _s.set(0.034 * scale, 0.011 * scale, 0.021 * scale)));
      mesh.setColorAt(i, rand() < black ? _c.set('#1c1815') : _c.set('#f0dfbd'));
    }
    return finish(mesh);
  }

  const onDisc = (rIn, rOut, y) => (p, n) => {
    const a = rand() * TAU, r = Math.sqrt(rr(rIn * rIn, rOut * rOut));
    p.set(Math.cos(a) * r, y, Math.sin(a) * r); n.set(0, 1, 0);
  };
  const onTube = (r, y0, y1) => (p, n) => {
    const a = rand() * TAU;
    n.set(Math.cos(a), 0, Math.sin(a)); p.set(n.x * r, rr(y0, y1), n.z * r);
  };

  /* ============================ Формы ============================ */

  // Профиль, вытянутый по оси Y и отцентрованный по высоте. Ось Z фигуры → −Z мира.
  function shapeGeo(shape, h, seg = 12) {
    const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: seg });
    g.rotateX(-Math.PI / 2);
    g.translate(0, -h / 2, 0);
    return g;
  }
  function circleShape(r, cx = 0, cy = 0) { const s = new THREE.Shape(); s.absarc(cx, cy, r, 0, TAU, false); return s; }
  function ringGeo(rOut, rIn, h, seg = 56) {
    const s = circleShape(rOut);
    const hole = new THREE.Path(); hole.absarc(0, 0, rIn, 0, TAU, true); s.holes.push(hole);
    return shapeGeo(s, h, seg);
  }
  function rrect(w, h, r, cx = 0, cy = 0) {
    const s = new THREE.Shape(), x = cx - w / 2, y = cy - h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }
  function superEllipse(a, b, asPath = false, n = 2.6, seg = 64) {
    const s = asPath ? new THREE.Path() : new THREE.Shape();
    for (let i = 0; i < seg; i++) {
      const th = (i / seg) * TAU, c = Math.cos(th), sn = Math.sin(th);
      const x = a * Math.sign(c) * Math.pow(Math.abs(c), 2 / n), y = b * Math.sign(sn) * Math.pow(Math.abs(sn), 2 / n);
      i === 0 ? s.moveTo(x, y) : s.lineTo(x, y);
    }
    s.closePath();
    return s;
  }
  function stadiumShape(Ls, r, asPath = false) {
    const s = asPath ? new THREE.Path() : new THREE.Shape();
    s.moveTo(-Ls / 2, -r);
    s.lineTo(Ls / 2, -r);
    s.absarc(Ls / 2, 0, r, -Math.PI / 2, Math.PI / 2, false);
    s.lineTo(-Ls / 2, r);
    s.absarc(-Ls / 2, 0, r, Math.PI / 2, Math.PI * 1.5, false);
    return s;
  }
  function stadiumRing(Ls, r1, r2) {
    const s = stadiumShape(Ls, r2);
    s.holes.push(stadiumShape(Ls, r1, true));
    return s;
  }

  function shadow(sx, sz = sx) {
    const m = new THREE.Mesh(G.plane, M.shadow);
    m.rotation.x = -Math.PI / 2;
    m.scale.set(sx, sz, 1);
    m.renderOrder = -1;
    return m;
  }

  // Обёртка: объект стоит на y = 0 и отцентрован по X/Z
  function grounded(obj) {
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj);
    const wrap = new THREE.Group();
    obj.position.x -= (box.min.x + box.max.x) / 2;
    obj.position.y -= box.min.y;
    obj.position.z -= (box.min.z + box.max.z) / 2;
    wrap.add(obj);
    return wrap;
  }
  // Обёртка: центр габаритов в нуле (для вращения «в воздухе»)
  function centered(obj) {
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj);
    const c = box.getCenter(new THREE.Vector3());
    const wrap = new THREE.Group();
    obj.position.sub(c);
    wrap.add(obj);
    wrap.userData.size = box.getSize(new THREE.Vector3());
    return wrap;
  }

  /* ============================ Нигири ============================ */

  // Рисовая «подушка» с приплюснутым дном и зёрнами по поверхности
  function riceBall({ lx = 0.95, ly = 0.4, lz = 0.5, n = 340 } = {}) {
    const surf = (x, y, z, out) => {
      const b = 1 + 0.03 * Math.sin(x * 9 + z * 7) * Math.cos(y * 8 + x * 3);
      let yy = y * ly * b;
      const floor = -ly * 0.45;
      if (yy < floor) yy = floor + (yy - floor) * 0.25;
      return out.set(x * lx * b, yy, z * lz * b);
    };
    const geo = new THREE.SphereGeometry(1, 44, 26);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      surf(pos.getX(i), pos.getY(i), pos.getZ(i), _p);
      pos.setXYZ(i, _p.x, _p.y, _p.z);
    }
    geo.computeVertexNormals();
    const g = new THREE.Group();
    g.add(new THREE.Mesh(geo, M.riceBody));
    g.add(grains(n, (p, nrm) => {
      let x, y, z, l;
      do {
        x = rr(-1, 1); y = rr(-1, 1); z = rr(-1, 1); l = x * x + y * y + z * z;
      } while (l > 1 || l < 0.05 || y / Math.sqrt(l) < -0.42 || (y / Math.sqrt(l) > 0.6 && rand() < 0.85));
      l = Math.sqrt(l); x /= l; y /= l; z /= l;
      surf(x, y, z, p);
      nrm.set(x / lx, y / ly, z / lz).normalize();
    }));
    return g;
  }

  // Ломтик рыбы, «наброшенный» на рис: деформированный параллелепипед
  function netaDeform(len, wid, { drape = 0.3, wrap = 0.36, skew = 0.2 } = {}) {
    return (v) => {
      const u = v.x / (len / 2), w = v.z / (wid / 2);
      const taper = Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(u), 4)));
      v.z *= 0.62 + 0.38 * taper;
      v.y *= 0.6 + 0.4 * taper * (1 - 0.3 * w * w);
      v.x += v.z * skew;
      // к торцам бока провисают меньше — иначе торец выгибается аркой и видна изнанка
      v.y += -drape * u * u - wrap * w * w * (0.22 + 0.78 * (1 - u * u)) + 0.022 * Math.sin(u * 4 + w * 2);
      return v;
    };
  }
  function netaGeo(len, wid, thick, o) {
    const geo = new THREE.BoxGeometry(len, thick, wid, 40, 2, 14);
    const f = netaDeform(len, wid, o), pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) { f(_p.fromBufferAttribute(pos, i)); pos.setXYZ(i, _p.x, _p.y, _p.z); }
    geo.computeVertexNormals();
    return { geo, f };
  }

  // Полоска нори вокруг нигири (сечение — суперэллипс)
  function belt(rz, ry, cy, width = 0.34, t = 0.024) {
    const outer = superEllipse(rz + t, ry + t);
    outer.holes.push(superEllipse(rz, ry, true));
    const geo = new THREE.ExtrudeGeometry(outer, { depth: width, bevelEnabled: false, curveSegments: 4 });
    geo.translate(0, 0, -width / 2);
    geo.rotateY(Math.PI / 2);
    const m = new THREE.Mesh(geo, M.nori);
    m.position.y = cy;
    return m;
  }

  function nigiri(kind = 'salmon', { q = 1 } = {}) {
    const g = new THREE.Group();
    g.add(riceBall({ n: 340 * q }));
    if (kind === 'tamago') {
      const geo = new THREE.BoxGeometry(2.0, 0.3, 1.04, 24, 4, 10);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        _p.fromBufferAttribute(pos, i);
        const u = _p.x / 1.0, w = _p.z / 0.52;
        if (_p.y > 0) _p.y -= 0.05 * Math.pow(Math.abs(w), 6) + 0.05 * Math.pow(Math.abs(u), 8);
        _p.y += -0.12 * u * u - 0.06 * w * w;
        pos.setXYZ(i, _p.x, _p.y, _p.z);
      }
      geo.computeVertexNormals();
      const top = new THREE.Mesh(geo, M.tamago);
      top.position.y = 0.52;
      g.add(top, belt(0.56, 0.48, 0.24));
      return g;
    }
    const eel = kind === 'eel';
    const thick = eel ? 0.2 : 0.17;
    const { geo, f } = netaGeo(2.3, 1.06, thick, eel ? { drape: 0.26, wrap: 0.32, skew: 0.05 } : undefined);
    const neta = new THREE.Mesh(geo, kind === 'tuna' ? M.tuna : eel ? M.eel : M.salmon);
    neta.position.y = 0.45;
    g.add(neta);
    if (eel) {
      g.add(sesame(30 * q, (p, n) => {
        f(p.set(rr(-0.95, 0.95), thick / 2, rr(-0.32, 0.32)));
        p.y += 0.45; n.set(0, 1, 0);
      }, 0.15));
      g.add(belt(0.56, 0.46, 0.2));
    }
    return g;
  }

  /* ============================ Роллы ============================ */

  // Начинки на срезе (координаты фигуры; на сцене z = −y)
  const FILL = {
    philadelphia: [
      { w: 0.34, h: 0.2, x: -0.04, y: 0.08, mat: 'cheese', layer: 3 },
      { w: 0.13, h: 0.13, x: 0.15, y: -0.1, mat: 'cucumber', layer: 4 },
      { w: 0.18, h: 0.11, x: -0.1, y: -0.13, mat: 'avocado', layer: 5 }
    ],
    california: [
      { w: 0.3, h: 0.155, x: 0, y: 0.1175, mat: 'crab', layer: 3, crab: true },
      { w: 0.12, h: 0.12, x: 0.12, y: -0.09, mat: 'cucumber', layer: 4 },
      { w: 0.16, h: 0.12, x: -0.11, y: -0.08, mat: 'avocado', layer: 5 }
    ],
    dragon: [
      { w: 0.3, h: 0.14, x: 0, y: 0.08, mat: 'eel', layer: 3 },
      { w: 0.12, h: 0.1, x: 0.12, y: -0.1, mat: 'cucumber', layer: 4 },
      { w: 0.16, h: 0.12, x: -0.1, y: -0.1, mat: 'cheese', layer: 5 }
    ]
  };

  function avocadoSliceGeo() {
    const s = new THREE.Shape();
    s.moveTo(-0.34, 0);
    s.quadraticCurveTo(-0.3, 0.21, 0, 0.22);
    s.quadraticCurveTo(0.3, 0.21, 0.34, 0);
    s.quadraticCurveTo(0, 0.06, -0.34, 0);
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2, curveSegments: 16 });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0, 0.11);
    return geo;
  }

  // Урамаки (рис снаружи). Слои: 0 рыба, 1 рис, 2 нори, 3–5 начинки — для «разборки» в анатомии
  function roll(type = 'philadelphia', { q = 1 } = {}) {
    const g = new THREE.Group();
    const h = 0.62, rIn = 0.33, rNori = 0.36;
    const rRice = type === 'philadelphia' ? 0.66 : 0.7;
    const layers = [0, 1, 2, 3, 4, 5].map(() => new THREE.Group());
    const info = [];

    layers[1].add(new THREE.Mesh(ringGeo(rRice, rNori, h), M.riceCut));
    const disc = circleShape(rIn);
    for (const f of FILL[type]) {
      disc.holes.push(rrect(f.w, f.h, Math.min(f.w, f.h) * 0.3, f.x, f.y));
      if (f.crab) {
        layers[f.layer].add(new THREE.Mesh(shapeGeo(rrect(f.w, 0.12, 0.035, f.x, f.y - 0.0175), h - 0.006), M.crab));
        layers[f.layer].add(new THREE.Mesh(shapeGeo(rrect(f.w, 0.035, 0.012, f.x, f.y + 0.06), h - 0.006), M.crabRed));
      } else {
        layers[f.layer].add(new THREE.Mesh(shapeGeo(rrect(f.w, f.h, Math.min(f.w, f.h) * 0.3, f.x, f.y), h - 0.006), M[f.mat]));
      }
      info[f.layer] = { c: new THREE.Vector3(f.x, 0, -f.y), r: f.w / 2 };
    }
    layers[1].add(new THREE.Mesh(shapeGeo(disc, h - 0.002, 40), M.riceCut));
    layers[1].add(grains(120 * q, onDisc(rNori + 0.075, rRice - 0.075, h / 2)));
    layers[2].add(new THREE.Mesh(ringGeo(rNori, rIn, h + 0.006), M.nori));
    info[0] = { c: new THREE.Vector3(), r: 0.72 };
    info[1] = { c: new THREE.Vector3(), r: rRice };
    info[2] = { c: new THREE.Vector3(), r: rNori };

    if (type === 'philadelphia') {
      // лосось обёрнут снаружи
      const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, h + 0.004, 72, 1, true), M.salmonWrap);
      const cap = new THREE.Mesh(new THREE.RingGeometry(rRice - 0.004, 0.72, 72), M.salmon);
      cap.rotation.x = -Math.PI / 2; cap.position.y = h / 2 + 0.003;
      const capB = cap.clone(); capB.rotation.x = Math.PI / 2; capB.position.y = -h / 2 - 0.003;
      layers[0].add(wrap, cap, capB);
    } else if (type === 'california') {
      layers[1].add(beads(G.bead, M.masago, 520 * q, onTube(rRice, -h / 2 + 0.02, h / 2 - 0.02), 0.026));
      layers[1].add(beads(G.bead, M.masago, 90 * q, onDisc(rRice - 0.06, rRice - 0.008, h / 2), 0.024));
      layers[1].add(grains(90 * q, onTube(rRice, -h / 2 + 0.06, h / 2 - 0.06)));
    } else if (type === 'dragon') {
      layers[1].add(grains(220 * q, onTube(rRice, -h / 2 + 0.06, h / 2 - 0.06)));
      layers[1].add(sesame(110 * q, onTube(rRice + 0.01, -h / 2 + 0.03, h / 2 - 0.03), 0.35));
      // авокадо черепицей сверху и зигзаг соуса унаги
      const top = new THREE.Group();
      const slice = avocadoSliceGeo();
      // ломтики лежат выше зёрен риса, иначе зёрна их перекрывают
      for (let i = 0; i < 3; i++) {
        const sl = new THREE.Mesh(slice, [M.avocado, M.avocadoSkin]);
        sl.scale.setScalar(1.3);
        sl.position.set(-0.3 + i * 0.3, h / 2 + 0.06 + i * 0.016, 0.07 - i * 0.06);
        sl.rotation.set(rr(-0.06, 0.06), 0.5 - i * 0.18, rr(-0.05, 0.05));
        top.add(sl);
      }
      const pts = [];
      for (let i = 0; i <= 8; i++) pts.push(new THREE.Vector3(-0.6 + i * 0.15, h / 2 + 0.135 + (i % 2) * 0.01, (i % 2 ? 0.34 : -0.34) * (1 - Math.abs(i - 4) / 7)));
      const sauce = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 90, 0.022, 6), M.sauce);
      top.add(sauce);
      top.add(sesame(30 * q, (p, n) => { p.set(rr(-0.4, 0.4), h / 2 + 0.13, rr(-0.3, 0.3)); n.set(0, 1, 0); }, 0.3));
      layers[0].add(top);
    }

    layers.forEach((l) => g.add(l));
    g.userData = { layers, info, h };
    return g;
  }

  // Хосомаки (нори снаружи), начинка — лосось
  function hosomaki({ q = 1 } = {}) {
    const g = new THREE.Group(), h = 0.64;
    const core = () => rrect(0.3, 0.26, 0.06);
    const rice = circleShape(0.455);
    rice.holes.push(core());
    g.add(new THREE.Mesh(ringGeo(0.48, 0.455, h + 0.006), M.nori));
    g.add(new THREE.Mesh(shapeGeo(rice, h, 40), M.riceCut));
    g.add(new THREE.Mesh(shapeGeo(core(), h - 0.004), M.salmon));
    g.add(grains(70 * q, onDisc(0.23, 0.385, h / 2), 0.9));
    return g;
  }

  /* ======================== Гункан и темаки ======================== */

  function ellipseRing(rx, rz, t, height) {
    const s = new THREE.Shape(); s.absellipse(0, 0, rx + t, rz + t, 0, TAU, false, 0);
    const hole = new THREE.Path(); hole.absellipse(0, 0, rx, rz, 0, TAU, true, 0);
    s.holes.push(hole);
    return new THREE.Mesh(shapeGeo(s, height, 48), M.nori);
  }

  function gunkan({ q = 1 } = {}) {
    const g = new THREE.Group();
    g.add(riceBall({ lx: 0.6, ly: 0.3, lz: 0.42, n: 50 * q }));
    const band = ellipseRing(0.66, 0.48, 0.024, 0.8);
    band.position.y = 0.23;
    g.add(band);
    // икра горкой: случайная упаковка без пересечений
    const r = 0.085, roe = [], want = cnt(48);
    for (let tries = 0; tries < 1500 && roe.length < want; tries++) {
      const a = rand() * TAU, d = Math.sqrt(rand());
      const x = Math.cos(a) * d * 0.56, z = Math.sin(a) * d * 0.38;
      const y = 0.3 + r + (1 - d * d) * 0.2 + rr(0, 0.04);
      if (roe.every((o) => (o.x - x) ** 2 + (o.y - y) ** 2 + (o.z - z) ** 2 > (r * 1.75) ** 2)) roe.push({ x, y, z });
    }
    const mesh = new THREE.InstancedMesh(G.roe, M.roe, roe.length);
    roe.forEach((o, i) => { const k = r * rr(0.9, 1.08); mesh.setMatrixAt(i, _m.compose(_p.set(o.x, o.y, o.z), _q.identity(), _s.set(k, k, k))); });
    g.add(finish(mesh));
    const cuc = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.03, 28), [M.cucumberSkin, M.cucumber, M.cucumber]);
    cuc.position.set(-0.34, 0.52, -0.16);
    cuc.rotation.set(1.15, 0.4, 0.25);
    g.add(cuc);
    return g;
  }

  function temaki({ q = 1 } = {}) {
    const g = new THREE.Group();
    const H = 1.9, R = 0.62;
    const geo = new THREE.ConeGeometry(R, H, 48, 10, true);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      _p.fromBufferAttribute(pos, i);
      const t = (H / 2 - _p.y) / H;
      const a = Math.atan2(_p.z, _p.x);
      _p.y -= t * t * 0.42 * (1 + Math.cos(a)) * 0.5; // косой срез раструба
      pos.setXYZ(i, _p.x, _p.y, _p.z);
    }
    geo.computeVertexNormals();
    geo.rotateX(Math.PI);
    g.add(new THREE.Mesh(geo, M.nori));
    const riceTop = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 12, 0, TAU, 0, Math.PI / 2), M.riceBody);
    riceTop.scale.set(1.08, 0.45, 1.08);
    riceTop.position.y = 0.74;
    g.add(riceTop);
    g.add(grains(70 * q, (p, n) => {
      const a = rand() * TAU, d = Math.sqrt(rand()) * 0.46;
      p.set(Math.cos(a) * d * 1.08, 0.74 + 0.225 * Math.sqrt(Math.max(0, 1 - (d / 0.5) ** 2)), Math.sin(a) * d * 1.08);
      n.set(p.x * 0.6, 1, p.z * 0.6).normalize();
    }));
    const fish = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, 0.42), M.salmon);
    fish.position.set(0.12, 1.02, -0.05); fish.rotation.z = -0.25;
    const avo = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.62, 0.3), M.avocado);
    avo.position.set(-0.17, 0.98, 0.12); avo.rotation.z = 0.32;
    g.add(fish, avo);
    for (let i = 0; i < 3; i++) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.72, 0.07), [M.cucumberSkin, M.cucumberSkin, M.cucumber, M.cucumber, M.cucumberSkin, M.cucumberSkin]);
      c.position.set(-0.04 + i * 0.09, 1.04, -0.24 + i * 0.05);
      c.rotation.set(rr(-0.2, 0.2), 0, rr(-0.35, 0.35));
      g.add(c);
    }
    return g;
  }

  /* ======================= Сашими и гарниры ======================= */

  function leaf() {
    const s = new THREE.Shape();
    s.moveTo(-1.3, 0);
    s.bezierCurveTo(-0.7, 0.75, 0.5, 0.78, 1.25, 0);
    s.bezierCurveTo(0.5, -0.78, -0.7, -0.75, -1.3, 0);
    const geo = new THREE.ShapeGeometry(s, 24);
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      uv.setXY(i, (x + 1.3) / 2.55, (y + 0.6) / 1.2);
      pos.setZ(i, 0.08 * (y / 0.6) ** 2 + 0.03 * Math.sin(x * 2));
    }
    geo.computeVertexNormals();
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, M.shiso);
    m.position.y = 0.01;
    return m;
  }

  function sashimiSliceGeo() {
    const geo = new THREE.BoxGeometry(0.16, 0.56, 1.0, 2, 8, 16);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      _p.fromBufferAttribute(pos, i);
      const u = _p.z / 0.5, v = _p.y / 0.28;
      _p.y *= 1 - 0.18 * u * u;
      _p.z *= 1 - 0.06 * v * v;
      _p.x += 0.03 * Math.sin(u * 2.5);
      pos.setXYZ(i, _p.x, _p.y, _p.z);
    }
    geo.computeVertexNormals();
    return geo;
  }

  function wasabi() {
    const geo = new THREE.SphereGeometry(0.3, 32, 20);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      _p.fromBufferAttribute(pos, i);
      _p.multiplyScalar(1 + 0.07 * Math.sin(_p.x * 22) * Math.sin(_p.y * 25) * Math.sin(_p.z * 19));
      _p.y = _p.y < 0 ? _p.y * 0.35 : _p.y * 0.9;
      if (_p.y > 0.1) { const k = (_p.y - 0.1) / 0.18; _p.x *= 1 - 0.45 * k; _p.z *= 1 - 0.45 * k; _p.y += 0.12 * k * k; }
      pos.setXYZ(i, _p.x, _p.y, _p.z);
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, M.wasabi);
    m.position.y = 0.105;
    const g = new THREE.Group();
    g.add(m);
    return g;
  }

  function ginger(n = 5) {
    const g = new THREE.Group();
    for (let i = 0; i < n; i++) {
      const geo = new THREE.RingGeometry(0.02, 0.32, 28, 5, 0, Math.PI * 1.55);
      const pos = geo.attributes.position;
      for (let j = 0; j < pos.count; j++) {
        const x = pos.getX(j), y = pos.getY(j), r = Math.hypot(x, y), a = Math.atan2(y, x);
        pos.setZ(j, 0.5 * x * x + 0.035 * Math.sin(a * 7) * r / 0.32);
      }
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, M.ginger);
      m.rotation.set(-Math.PI / 2 + rr(-0.5, 0.5), 0, rr(0, TAU));
      m.position.set(rr(-0.12, 0.12), 0.03 + i * 0.045, rr(-0.12, 0.12));
      g.add(m);
    }
    return g;
  }

  function sashimi({ n = 5 } = {}) {
    const g = new THREE.Group();
    g.add(leaf());
    const geo = sashimiSliceGeo();
    const span = (n - 1) * 0.3;
    for (let i = 0; i < n; i++) {
      const s = new THREE.Mesh(geo, M.salmon);
      s.position.set(-span / 2 + i * 0.3 - 0.1, 0.24, 0);
      s.rotation.z = -0.95;
      g.add(s);
    }
    const w = wasabi(); w.scale.setScalar(0.55); w.position.set(span / 2 + 0.42, 0.02, 0.42);
    g.add(w);
    return g;
  }

  function chopsticks() {
    const g = new THREE.Group();
    const stick = (x, rz) => {
      const s = new THREE.Group();
      const a = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 2.6, 16), M.lacquer); a.position.y = 0.55;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.047, 0.06, 16), M.gold); band.position.y = -0.72;
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.045, 1.3, 16), M.bamboo); b.position.y = -1.4;
      s.add(a, band, b);
      s.position.x = x; s.rotation.z = rz;
      return s;
    };
    g.add(stick(-0.09, -0.02), stick(0.09, 0.07));
    return g;
  }

  /* ============================ Сет на гэта ============================ */

  function setBoard() {
    const g = new THREE.Group();
    const board = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.16, 2.2), M.wood);
    board.position.y = 0.26;
    g.add(board);
    for (const x of [-1.75, 1.75]) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 2.0), M.woodDark);
      f.position.set(x, 0.1, 0); g.add(f);
    }
    const top = 0.34;
    const put = (obj, x, z, s, ry = 0) => {
      const w = grounded(obj);
      w.scale.setScalar(s); w.position.set(x, top, z); w.rotation.y = ry;
      g.add(w);
    };
    put(roll('philadelphia', { q: 0.5 }), -1.72, -0.45, 0.6, 0.3);
    put(roll('philadelphia', { q: 0.5 }), -1.72, 0.48, 0.6, -0.4);
    put(roll('california', { q: 0.45 }), -0.84, -0.45, 0.6, 0.9);
    put(roll('california', { q: 0.45 }), -0.84, 0.48, 0.6, 0.2);
    put(nigiri('salmon', { q: 0.45 }), 0.32, -0.5, 0.5, Math.PI / 2 + 0.08);
    put(nigiri('tuna', { q: 0.45 }), 0.92, -0.5, 0.5, Math.PI / 2 - 0.06);
    put(gunkan({ q: 0.5 }), 0.5, 0.5, 0.58, 0.1);
    put(nigiri('tamago', { q: 0.4 }), 1.5, 0.15, 0.46, Math.PI / 2);
    put(ginger(5), 1.95, -0.55, 0.9);
    put(wasabi(), 2.0, 0.7, 0.8);
    return g;
  }

  /* ============================ Кайтен ============================ */

  const plateGeo = new THREE.LatheGeometry(
    [[0, 0.07], [0.6, 0.07], [0.64, 0], [0.7, 0], [0.74, 0.07], [0.93, 0.13], [0.99, 0.17], [1.01, 0.185], [0.98, 0.19], [0.92, 0.155], [0.74, 0.105], [0, 0.105]]
      .map(([x, y]) => new THREE.Vector2(x, y)), 56);
  const plateDisc = new THREE.CircleGeometry(0.72, 48);
  plateDisc.rotateX(-Math.PI / 2);

  function plate(color) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(plateGeo, plateMaterial(color));
    const disc = new THREE.Mesh(plateDisc, M.ceramic);
    disc.position.y = 0.107;
    g.add(body, disc);
    g.userData.body = body;
    return g;
  }

  // Порция для тарелки кайтена (влезает в круг радиусом ~0.7)
  function plateItem(id) {
    const g = new THREE.Group();
    const add = (obj, x, z, s, ry = 0) => { const w = grounded(obj); w.scale.setScalar(s); w.position.set(x, 0, z); w.rotation.y = ry; g.add(w); };
    const nig = { sake: 'salmon', maguro: 'tuna', unagi: 'eel', tamago: 'tamago' }[id];
    if (nig) {
      add(nigiri(nig, { q: 0.4 }), 0, -0.3, 0.5, 0.08);
      add(nigiri(nig, { q: 0.4 }), 0.04, 0.3, 0.5, -0.06);
    } else if (id === 'philadelphia' || id === 'california' || id === 'dragon') {
      add(roll(id, { q: 0.4 }), -0.34, 0, 0.46, 0.3);
      add(roll(id, { q: 0.4 }), 0.34, 0.04, 0.46, -0.6);
    } else if (id === 'sakemaki') {
      add(hosomaki({ q: 0.5 }), -0.27, -0.17, 0.55);
      add(hosomaki({ q: 0.5 }), 0.27, -0.17, 0.55, 1);
      add(hosomaki({ q: 0.5 }), 0, 0.3, 0.55, 2);
    } else if (id === 'ikura') {
      add(gunkan({ q: 0.5 }), -0.29, 0, 0.5, Math.PI / 2);
      add(gunkan({ q: 0.5 }), 0.3, 0.02, 0.5, Math.PI / 2 + 0.2);
    } else if (id === 'temaki') {
      const t = temaki({ q: 0.5 });
      t.rotation.z = Math.PI / 2 - 0.28;
      add(t, 0, 0, 0.55, 0.4);
    } else if (id === 'sashimi') {
      add(sashimi({ n: 3 }), 0, 0, 0.48);
    }
    return g;
  }

  // Конвейер: лента-«стадион», борта, стойка, островок повара
  function conveyor({ Ls = 6.2, R = 2.25, bw = 1.5 } = {}) {
    const g = new THREE.Group();
    const L = 2 * Ls + TAU * R;
    const path = (s, out, tan) => {
      s = ((s % L) + L) % L;
      if (s < Ls) { out.set(-Ls / 2 + s, 0, R); tan.set(1, 0, 0); return out; }
      s -= Ls;
      if (s < Math.PI * R) { const a = s / R; out.set(Ls / 2 + Math.sin(a) * R, 0, Math.cos(a) * R); tan.set(Math.cos(a), 0, -Math.sin(a)); return out; }
      s -= Math.PI * R;
      if (s < Ls) { out.set(Ls / 2 - s, 0, -R); tan.set(-1, 0, 0); return out; }
      s -= Ls;
      const a = s / R;
      out.set(-Ls / 2 - Math.sin(a) * R, 0, -Math.cos(a) * R); tan.set(-Math.cos(a), 0, Math.sin(a));
      return out;
    };

    const base = new THREE.Mesh(shapeGeo(stadiumRing(Ls, R - bw / 2, R + bw / 2), 0.08, 24), M.beltBase);
    base.position.y = -0.04;
    const railO = new THREE.Mesh(shapeGeo(stadiumRing(Ls, R + bw / 2, R + bw / 2 + 0.07), 0.22, 24), M.metal);
    const railI = new THREE.Mesh(shapeGeo(stadiumRing(Ls, R - bw / 2 - 0.07, R - bw / 2), 0.22, 24), M.metal);
    railO.position.y = railI.position.y = 0.03;
    const counterW = 0.95;
    const counter = new THREE.Mesh(shapeGeo(stadiumRing(Ls, R + bw / 2 + 0.07, R + bw / 2 + counterW), 0.16, 24), M.wood);
    counter.position.y = -0.04;
    const island = new THREE.Mesh(shapeGeo(stadiumShape(Ls, R - bw / 2 - 0.07), 0.16, 24), M.slate);
    island.position.y = -0.04;
    g.add(base, railO, railI, counter, island);

    // Хангири — кадка с рисом на островке
    const tub = new THREE.Mesh(new THREE.LatheGeometry([[0, 0.02], [0.78, 0.02], [0.86, 0.06], [0.88, 0.34], [0.84, 0.36], [0.8, 0.12], [0, 0.12]].map(([x, y]) => new THREE.Vector2(x, y)), 48), M.wood);
    const hoop1 = new THREE.Mesh(new THREE.TorusGeometry(0.875, 0.018, 8, 64), M.copper); hoop1.rotation.x = Math.PI / 2; hoop1.position.y = 0.12;
    const hoop2 = hoop1.clone(); hoop2.position.y = 0.27;
    const riceIn = new THREE.Mesh(new THREE.CircleGeometry(0.8, 40), M.riceCut); riceIn.rotation.x = -Math.PI / 2; riceIn.position.y = 0.24;
    const hangiri = new THREE.Group();
    hangiri.add(tub, hoop1, hoop2, riceIn, grains(160, onDisc(0, 0.74, 0.24)));
    hangiri.position.set(-Ls / 2 + 0.2, 0.04, 0);
    g.add(hangiri);

    // Макису — бамбуковый коврик
    const mat = new THREE.Group();
    const slat = new THREE.CylinderGeometry(0.03, 0.03, 1.1, 8);
    for (let i = 0; i < 18; i++) {
      const s = new THREE.Mesh(slat, M.bamboo);
      s.rotation.x = Math.PI / 2; s.position.set(-0.53 + i * 0.062, 0.07, 0);
      mat.add(s);
    }
    mat.position.set(Ls / 2 - 0.1, 0.04, 0); mat.rotation.y = 0.2;
    g.add(mat);

    // Доска с блоком лосося и ножом
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.8), M.wood); board.position.set(0.6, 0.08, 0);
    const block = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.22, 0.34), M.salmon); block.position.set(0.5, 0.23, -0.05); block.rotation.y = 0.15;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.012, 0.11), M.metal); blade.position.set(0.7, 0.13, 0.26); blade.rotation.y = -0.2;
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.42, 10), M.woodDark); handle.rotation.z = Math.PI / 2; handle.position.set(1.32, 0.15, 0.13); handle.rotation.y = -0.2;
    g.add(board, block, blade, handle);

    // Чашки для чая на стойке сзади
    const cupGeo = new THREE.LatheGeometry([[0, 0], [0.16, 0], [0.2, 0.05], [0.22, 0.36], [0.2, 0.37], [0.18, 0.08], [0, 0.08]].map(([x, y]) => new THREE.Vector2(x, y)), 32);
    for (let i = 0; i < 4; i++) {
      const c = new THREE.Mesh(cupGeo, M.ceramic);
      c.position.set(-Ls / 2 + 0.6 + i * (Ls - 1.2) / 3, 0.04, -(R + bw / 2 + counterW * 0.55));
      g.add(c);
    }

    // Сегменты ленты: двигаются каждый кадр
    const segN = Math.round(L / 0.3);
    const segs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.27, 0.05, bw - 0.1), M.belt, segN);
    segs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const update = (offset) => {
      for (let i = 0; i < segN; i++) {
        path(offset + i * L / segN, _p, _t);
        _q.setFromAxisAngle(UP, Math.atan2(-_t.z, _t.x));
        _p.y = 0.03 + (i % 2) * 0.004; // разные высоты — без z-fighting на поворотах
        segs.setMatrixAt(i, _m.compose(_p, _q, _s.set(1, 1, 1)));
      }
      segs.instanceMatrix.needsUpdate = true;
    };
    update(0);
    segs.computeBoundingSphere();
    g.add(segs);

    // габариты вместе со стойкой — камера вписывает конвейер целиком, без обрезки по краям
    return { group: g, L, path, update, size: new THREE.Vector3(Ls + 2 * (R + bw / 2 + counterW), 0.6, 2 * (R + bw / 2 + counterW)) };
  }

  /* ======================== Композиции для карточек ======================== */

  function cardModel(key) {
    const g = new THREE.Group();
    const add = (obj, x, z, s = 1, ry = 0) => { const w = grounded(obj); w.scale.setScalar(s); w.position.set(x, 0, z); w.rotation.y = ry; g.add(w); return w; };
    const trio = (make) => {
      add(make(1), 0.05, 0.55, 1, 0.4);
      add(make(0.7), -0.95, -0.42, 1, -0.6);
      const lying = make(0.7);
      lying.rotation.z = Math.PI / 2;
      add(lying, 0.98, -0.35, 1, 0.55);
    };
    const NIG = { nigiriSalmon: 'salmon', nigiriTuna: 'tuna', nigiriEel: 'eel', nigiriTamago: 'tamago' };
    if (key === 'philadelphia' || key === 'california' || key === 'dragon') trio((q) => roll(key, { q }));
    else if (key === 'hosomaki') trio((q) => hosomaki({ q }));
    else if (NIG[key]) { add(nigiri(NIG[key]), -0.08, -0.6, 1, 0.12); add(nigiri(NIG[key], { q: 0.8 }), 0.12, 0.62, 1, -0.06); }
    else if (key === 'gunkan') { add(gunkan(), -0.6, 0, 1, Math.PI / 2 + 0.15); add(gunkan(), 0.62, 0.06, 1, Math.PI / 2 - 0.12); }
    else if (key === 'temaki') { const t = temaki(); t.rotation.z = Math.PI / 2 - 0.22; add(t, 0, 0, 1, -0.35); add(ginger(4), 0.9, 0.95, 0.9); }
    else if (key === 'sashimi') add(sashimi(), 0, 0);
    else if (key === 'set') add(setBoard(), 0, 0);
    g.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(g);
    const size = box.getSize(new THREE.Vector3());
    const sh = shadow(size.x * 1.25, size.z * 1.4);
    sh.position.y = 0.004;
    g.add(sh);
    g.userData.size = size;
    return g;
  }

  return {
    M, G,
    nigiri, roll, hosomaki, gunkan, temaki, sashimi, setBoard, chopsticks, ginger, wasabi,
    plate, plateMaterial, plateItem, conveyor, cardModel, shadow, grounded, centered
  };
};
