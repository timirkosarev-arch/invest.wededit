// ============================================================
//  app.js — вся логика FAKEX
// ============================================================

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let userData = null;           // { balance, portfolio: {ticker: qty} }
let stocksCache = {};          // ticker -> stock doc data
let selectedTicker = null;
let priceChart = null;

const DEFAULT_STOCKS = [
  { ticker: "MEOW",  name: "Meow Corp",        basePrice: 12 },
  { ticker: "VOID",  name: "Void Industries",  basePrice: 30 },
  { ticker: "TOAST", name: "Toast Holdings",   basePrice: 5  },
  { ticker: "GLUE",  name: "Glue Dynamics",    basePrice: 18 },
  { ticker: "NOPE",  name: "Nope Airlines",    basePrice: 45 },
];

// ---------- helpers ----------
const $ = (id) => document.getElementById(id);
function showToast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(showToast._h);
  showToast._h = setTimeout(() => t.classList.remove("show"), 2400);
}
function fmt(n) { return "$" + Number(n).toFixed(2); }

// ---------- auth ----------
$("google-login-btn").addEventListener("click", () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch((err) => {
    showToast("Ошибка входа: " + err.message);
  });
});
$("logout-btn").addEventListener("click", () => auth.signOut());

auth.onAuthStateChanged(async (user) => {
  if (user) {
    currentUser = user;
    $("login-screen").classList.add("hidden");
    $("app-screen").classList.remove("hidden");
    $("user-avatar").src = user.photoURL || "";
    await ensureUserDoc(user);
    await ensureDefaultStocks();
    listenUserDoc();
    listenStocks();
  } else {
    currentUser = null;
    $("login-screen").classList.remove("hidden");
    $("app-screen").classList.add("hidden");
  }
});

async function ensureUserDoc(user) {
  const ref = db.collection("users").doc(user.uid);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      name: user.displayName || "Игрок",
      balance: STARTING_BALANCE,
      portfolio: {},
      createdAt: Date.now(),
    });
  }
}

async function ensureDefaultStocks() {
  const snap = await db.collection("stocks").limit(1).get();
  if (!snap.empty) return; // рынок уже кто-то создал
  const batch = db.batch();
  const now = Date.now();
  DEFAULT_STOCKS.forEach((s) => {
    const ref = db.collection("stocks").doc(s.ticker);
    batch.set(ref, {
      ticker: s.ticker,
      name: s.name,
      basePrice: s.basePrice,
      seed: Math.floor(Math.random() * 1000000),
      createdAt: now,
      createdBy: "system",
    });
  });
  await batch.commit();
}

function listenUserDoc() {
  db.collection("users").doc(currentUser.uid).onSnapshot((snap) => {
    if (!snap.exists) return;
    userData = snap.data();
    $("balance-value").textContent = fmt(userData.balance);
    renderPortfolio();
    updateTradeTotal();
  });
}

function listenStocks() {
  db.collection("stocks").onSnapshot((snap) => {
    snap.forEach((doc) => { stocksCache[doc.id] = doc.data(); });
    renderMarket();
    renderTicker();
    renderPortfolio();
    if (selectedTicker) renderChartHeader();
  });
}

// ---------- tabs ----------
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    $("tab-" + btn.dataset.tab).classList.add("active");
  });
});
$("listing-cost-label").textContent = LISTING_COST.toFixed(0);
$("listing-cost-label-2").textContent = fmt(LISTING_COST);

// ---------- market rendering ----------
function renderMarket() {
  const list = $("market-list");
  const tickers = Object.keys(stocksCache).sort();
  if (tickers.length === 0) {
    list.innerHTML = '<div class="m-empty">Рынок пуст. Будь первым — выставь свою акцию.</div>';
    return;
  }
  const now = Date.now();
  list.innerHTML = "";
  tickers.forEach((tk) => {
    const s = stocksCache[tk];
    const price = priceAt(s.basePrice, s.seed, s.createdAt, now);
    const priceAgo = priceAt(s.basePrice, s.seed, s.createdAt, now - 30000);
    const change = priceAgo > 0 ? ((price - priceAgo) / priceAgo) * 100 : 0;
    const row = document.createElement("div");
    row.className = "market-row";
    row.innerHTML = `
      <div class="m-left">
        <span class="m-ticker">${s.ticker}</span>
        <span class="m-name">${escapeHtml(s.name)}</span>
      </div>
      <div class="m-right">
        <div class="m-price">${fmt(price)}</div>
        <div class="m-change ${change >= 0 ? "up" : "down"}">${change >= 0 ? "▲" : "▼"} ${Math.abs(change).toFixed(2)}%</div>
      </div>`;
    row.addEventListener("click", () => openChart(tk));
    list.appendChild(row);
  });
}

function renderTicker() {
  const track = $("ticker-track");
  const now = Date.now();
  const tickers = Object.keys(stocksCache).sort();
  if (tickers.length === 0) { track.innerHTML = ""; return; }
  track.innerHTML = tickers.map((tk) => {
    const s = stocksCache[tk];
    const price = priceAt(s.basePrice, s.seed, s.createdAt, now);
    const priceAgo = priceAt(s.basePrice, s.seed, s.createdAt, now - 30000);
    const change = priceAgo > 0 ? ((price - priceAgo) / priceAgo) * 100 : 0;
    const cls = change >= 0 ? "tk-up" : "tk-down";
    return `<span>${s.ticker} <span class="${cls}">${fmt(price)} ${change >= 0 ? "▲" : "▼"}${Math.abs(change).toFixed(1)}%</span></span>`;
  }).join("");
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

// ---------- chart / trading ----------
function openChart(ticker) {
  selectedTicker = ticker;
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
  document.querySelector('.tab-btn[data-tab="chart"]').classList.add("active");
  $("tab-chart").classList.add("active");
  renderChartHeader();
  drawChart();
  updateTradeTotal();
}

function renderChartHeader() {
  const s = stocksCache[selectedTicker];
  if (!s) return;
  const now = Date.now();
  const price = priceAt(s.basePrice, s.seed, s.createdAt, now);
  $("chart-title").textContent = `${s.ticker} — ${s.name}`;
  $("chart-price").textContent = `Текущая цена: ${fmt(price)}`;
}

function drawChart() {
  const s = stocksCache[selectedTicker];
  if (!s) return;
  const now = Date.now();
  const points = priceHistory(s.basePrice, s.seed, s.createdAt, now, 120, 2);
  const labels = points.map((p) => new Date(p.t).toLocaleTimeString());
  const data = points.map((p) => p.p);
  const rising = data[data.length - 1] >= data[0];

  if (priceChart) priceChart.destroy();
  const ctx = $("price-chart").getContext("2d");
  priceChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        data,
        borderColor: rising ? "#1fd97e" : "#ff4f5e",
        backgroundColor: rising ? "rgba(31,217,126,0.08)" : "rgba(255,79,94,0.08)",
        borderWidth: 2,
        pointRadius: 0,
        fill: true,
        tension: 0.25,
      }],
    },
    options: {
      responsive: true,
      animation: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { display: false },
        y: { ticks: { color: "#8891a3" }, grid: { color: "#232833" } },
      },
    },
  });
}

// перерисовываем всё живьём каждые 2 секунды
setInterval(() => {
  renderMarket();
  renderTicker();
  if (selectedTicker) { renderChartHeader(); drawChart(); }
}, 2000);

$("trade-qty").addEventListener("input", updateTradeTotal);
function updateTradeTotal() {
  if (!selectedTicker || !stocksCache[selectedTicker]) { $("trade-total").textContent = "$0.00"; return; }
  const s = stocksCache[selectedTicker];
  const price = priceAt(s.basePrice, s.seed, s.createdAt, Date.now());
  const qty = parseFloat($("trade-qty").value) || 0;
  $("trade-total").textContent = fmt(price * qty);
}

$("buy-btn").addEventListener("click", () => trade("buy"));
$("sell-btn").addEventListener("click", () => trade("sell"));

async function trade(side) {
  if (!selectedTicker || !stocksCache[selectedTicker]) return;
  const qty = parseFloat($("trade-qty").value);
  if (!qty || qty <= 0) { showToast("Укажи количество"); return; }

  const s = stocksCache[selectedTicker];
  const price = priceAt(s.basePrice, s.seed, s.createdAt, Date.now());
  const cost = price * qty;
  const ref = db.collection("users").doc(currentUser.uid);

  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.data();
      const portfolio = data.portfolio || {};
      const held = portfolio[selectedTicker] || 0;

      if (side === "buy") {
        if (data.balance < cost) throw new Error("Не хватает денег на балансе");
        portfolio[selectedTicker] = Math.round((held + qty) * 10000) / 10000;
        tx.update(ref, { balance: Math.round((data.balance - cost) * 100) / 100, portfolio });
      } else {
        if (held < qty) throw new Error("Столько акций у тебя нет");
        portfolio[selectedTicker] = Math.round((held - qty) * 10000) / 10000;
        if (portfolio[selectedTicker] <= 0) delete portfolio[selectedTicker];
        tx.update(ref, { balance: Math.round((data.balance + cost) * 100) / 100, portfolio });
      }
    });
    showToast(side === "buy" ? `Куплено ${qty} ${selectedTicker}` : `Продано ${qty} ${selectedTicker}`);
  } catch (err) {
    showToast(err.message);
  }
}

// ---------- portfolio ----------
function renderPortfolio() {
  const list = $("portfolio-list");
  if (!userData) { list.innerHTML = ""; return; }
  const portfolio = userData.portfolio || {};
  const tickers = Object.keys(portfolio).filter((tk) => portfolio[tk] > 0);
  if (tickers.length === 0) {
    list.innerHTML = '<div class="m-empty">Портфель пуст. Купи что-нибудь на вкладке «Рынок».</div>';
    return;
  }
  const now = Date.now();
  list.innerHTML = "";
  tickers.forEach((tk) => {
    const s = stocksCache[tk];
    if (!s) return;
    const qty = portfolio[tk];
    const price = priceAt(s.basePrice, s.seed, s.createdAt, now);
    const value = price * qty;
    const row = document.createElement("div");
    row.className = "market-row";
    row.innerHTML = `
      <div class="m-left">
        <span class="m-ticker">${s.ticker}</span>
        <span class="m-name">${qty} шт. по ${fmt(price)}</span>
      </div>
      <div class="m-right">
        <div class="m-price">${fmt(value)}</div>
      </div>`;
    row.addEventListener("click", () => openChart(tk));
    list.appendChild(row);
  });
}

// ---------- listing new stock ----------
$("listing-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const ticker = $("listing-ticker").value.trim().toUpperCase();
  const name = $("listing-name").value.trim();
  const basePrice = parseFloat($("listing-price").value);

  if (!/^[A-Z0-9]{2,5}$/.test(ticker)) { showToast("Тикер: 2–5 латинских букв/цифр"); return; }
  if (!name) { showToast("Укажи название"); return; }
  if (!basePrice || basePrice <= 0) { showToast("Некорректная стартовая цена"); return; }

  const stockRef = db.collection("stocks").doc(ticker);
  const userRef = db.collection("users").doc(currentUser.uid);

  try {
    await db.runTransaction(async (tx) => {
      const stockSnap = await tx.get(stockRef);
      if (stockSnap.exists) throw new Error("Такой тикер уже занят");
      const userSnap = await tx.get(userRef);
      const data = userSnap.data();
      if (data.balance < LISTING_COST) throw new Error(`Нужно минимум ${fmt(LISTING_COST)} на балансе`);

      tx.update(userRef, { balance: Math.round((data.balance - LISTING_COST) * 100) / 100 });
      tx.set(stockRef, {
        ticker, name, basePrice,
        seed: Math.floor(Math.random() * 1000000),
        createdAt: Date.now(),
        createdBy: currentUser.uid,
      });
    });
    showToast(`${ticker} выставлен на биржу!`);
    $("listing-form").reset();
    $("listing-price").value = 10;
    document.querySelector('.tab-btn[data-tab="market"]').click();
  } catch (err) {
    showToast(err.message);
  }
});
