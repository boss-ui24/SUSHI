/* NAMI 波 — данные: меню, тарелки кайтена, конструктор ролла.
   Тексты блюд лежат в i18n.js под ключами item.<id>.name / item.<id>.desc. */
window.NamiData = {
  currency: '₼',
  freeDelivery: 30,

  menu: [
    { id: 'philadelphia', cat: 'rolls', model: 'philadelphia', price: 18, pcs: 8, g: 260, jp: 'フィラデルフィア', plate: 'red', badge: 'hit' },
    { id: 'california', cat: 'rolls', model: 'california', price: 15, pcs: 8, g: 240, jp: 'カリフォルニア', plate: 'yellow' },
    { id: 'dragon', cat: 'rolls', model: 'dragon', price: 21, pcs: 8, g: 280, jp: 'ドラゴン', plate: 'black', badge: 'chef' },
    { id: 'sakemaki', cat: 'rolls', model: 'hosomaki', price: 9, pcs: 6, g: 120, jp: '鮭細巻き', plate: 'green' },
    { id: 'sake', cat: 'nigiri', model: 'nigiriSalmon', price: 6, pcs: 2, g: 70, jp: 'サーモン握り', plate: 'yellow', badge: 'hit' },
    { id: 'maguro', cat: 'nigiri', model: 'nigiriTuna', price: 7, pcs: 2, g: 70, jp: 'まぐろ握り', plate: 'red' },
    { id: 'unagi', cat: 'nigiri', model: 'nigiriEel', price: 7, pcs: 2, g: 75, jp: 'うなぎ握り', plate: 'red' },
    { id: 'tamago', cat: 'nigiri', model: 'nigiriTamago', price: 4, pcs: 2, g: 80, jp: '玉子握り', plate: 'green' },
    { id: 'ikura', cat: 'gunkan', model: 'gunkan', price: 8, pcs: 2, g: 60, jp: 'いくら軍艦', plate: 'red', badge: 'new' },
    { id: 'temaki', cat: 'gunkan', model: 'temaki', price: 9, pcs: 1, g: 110, jp: '手巻き', plate: 'yellow' },
    { id: 'sashimi', cat: 'sashimi', model: 'sashimi', price: 16, pcs: 5, g: 100, jp: '刺身', plate: 'black' },
    { id: 'set', cat: 'sets', model: 'set', price: 59, oldPrice: 72, pcs: 24, g: 820, jp: '盛り合わせ', badge: 'week' }
  ],

  /* Цвет тарелки = цена, как в настоящих кайтен-барах */
  plates: {
    green: { price: 4, color: '#78b54a' },
    yellow: { price: 6, color: '#f2c14e' },
    red: { price: 8, color: '#e2483d' },
    black: { price: 12, color: '#2a2421' }
  },

  /* Цена своего ролла = base + выбранные опции. id начинок совпадают с материалами в models.js */
  builder: {
    base: 7,
    pcs: 8,
    g: 250,
    maxExtras: 2,
    start: { outer: 'sesame', main: 'salmon', extras: ['cheese', 'cucumber'] },
    outer: [
      { id: 'sesame', price: 0, color: '#f0dfbd' },
      { id: 'masago', price: 3, color: '#ff7a22' },
      { id: 'avocado', price: 4, color: '#b9d15a' },
      { id: 'salmon', price: 6, color: '#ff7f50' }
    ],
    main: [
      { id: 'crab', price: 3, color: '#ef5a3c' },
      { id: 'salmon', price: 4, color: '#ff7f50' },
      { id: 'tuna', price: 5, color: '#b3263a' },
      { id: 'eel', price: 6, color: '#7a4422' }
    ],
    extras: [
      { id: 'cucumber', price: 1, color: '#cfe79a' },
      { id: 'cheese', price: 2, color: '#fbf5ea' },
      { id: 'avocado', price: 2, color: '#b9d15a' },
      { id: 'tamago', price: 2, color: '#f2c14e' }
    ]
  }
};
