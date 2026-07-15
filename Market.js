// ============================================================
//  market.js — генератор "живого" рынка
//  Цена — детерминированная функция времени и seed акции,
//  поэтому у ВСЕХ игроков в один момент времени одинаковый график,
//  без необходимости в сервере, который постоянно что-то считает.
// ============================================================

// маленький хэш числа -> число [-1, 1], стабильный и быстрый (без циклов)
function fakexHash(seed, x) {
  const s = Math.sin(seed * 12.9898 + x * 78.233) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1; // [-1, 1]
}

// строит "личность" акции из seed: несколько волн разной частоты/фазы
function buildWaveProfile(seed) {
  const waves = [];
  for (let i = 0; i < 4; i++) {
    const freq = 0.02 + Math.abs(fakexHash(seed, i * 3 + 1)) * 0.15;   // разная скорость колебаний
    const phase = fakexHash(seed, i * 3 + 2) * Math.PI * 2;
    const amp = 0.03 + Math.abs(fakexHash(seed, i * 3 + 3)) * 0.09;    // разная амплитуда
    waves.push({ freq, phase, amp });
  }
  // лёгкий долгосрочный тренд (вверх или вниз) — у каждой акции свой характер
  const drift = fakexHash(seed, 99) * 0.15; // за "день" +-15%
  return { waves, drift };
}

const profileCache = new Map();
function getProfile(seed) {
  if (!profileCache.has(seed)) profileCache.set(seed, buildWaveProfile(seed));
  return profileCache.get(seed);
}

/**
 * Текущая цена акции.
 * @param {number} basePrice  цена на момент листинга
 * @param {number} seed       уникальное число акции
 * @param {number} createdAtMs время листинга (мс)
 * @param {number} nowMs      момент, для которого считаем цену (мс)
 */
function priceAt(basePrice, seed, createdAtMs, nowMs) {
  const t = Math.max(0, (nowMs - createdAtMs) / 1000); // секунды с листинга
  const { waves, drift } = getProfile(seed);

  let mult = 1;
  for (const w of waves) mult += w.amp * Math.sin(w.freq * t + w.phase);
  mult += drift * (t / 86400); // тренд за сутки

  // мелкий "тик-шум", свой для каждой секунды — придаёт живости
  const tickSecond = Math.floor(t);
  mult += fakexHash(seed, tickSecond) * 0.006;

  const price = basePrice * Math.max(0.02, mult); // цена не уходит в ноль/минус
  return Math.round(price * 100) / 100;
}

/**
 * Массив точек для графика за последние `seconds` секунд с шагом `stepSec`.
 */
function priceHistory(basePrice, seed, createdAtMs, nowMs, seconds = 120, stepSec = 2) {
  const points = [];
  const steps = Math.floor(seconds / stepSec);
  for (let i = steps; i >= 0; i--) {
    const at = nowMs - i * stepSec * 1000;
    if (at < createdAtMs) continue;
    points.push({ t: at, p: priceAt(basePrice, seed, createdAtMs, at) });
  }
  if (points.length === 0) points.push({ t: nowMs, p: priceAt(basePrice, seed, createdAtMs, nowMs) });
  return points;
}
