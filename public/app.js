const apiBase = '';
let token = localStorage.getItem('token') || '';
let currentUser = null;
let produkteCache = [];
let currentEvent = null;
let currentZeitpunkt = 'vor_event';
let stockDraft = {};
let viewingInactive = false;
let editingProductId = null;

const loginSection = document.getElementById('loginSection');
const eventSection = document.getElementById('eventSection');
const stockSection = document.getElementById('stockSection');
const adminSection = document.getElementById('adminSection');
const productSection = document.getElementById('productSection');

const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const eventsList = document.getElementById('eventsList');
const roleView = document.getElementById('roleView');
const stockList = document.getElementById('stockList');
const stockTitle = document.getElementById('stockTitle');
const stockHint = document.getElementById('stockHint');
const stockSearch = document.getElementById('stockSearch');
const stockStatus = document.getElementById('stockStatus');
const adminMetrics = document.getElementById('adminMetrics');
const summaryTable = document.getElementById('summaryTable');
const adminEventTitle = document.getElementById('adminEventTitle');
const userInfo = document.getElementById('userInfo');

const cashUmsatz = document.getElementById('cashUmsatz');
const cashGewinn = document.getElementById('cashGewinn');
const cashTip = document.getElementById('cashTip');
const cashNote = document.getElementById('cashNote');

async function api(path, options = {}) {
  const res = await fetch(apiBase + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (res.status === 401) {
    logout();
    throw new Error('Nicht eingeloggt');
  }
  if (res.headers.get('content-type')?.includes('text/csv')) {
    return res.text();
  }
  return res.json();
}

function show(section) {
  [loginSection, eventSection, stockSection, adminSection, productSection].forEach((s) =>
    s.classList.add('hidden')
  );
  section.classList.remove('hidden');
}

async function login() {
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  try {
    const res = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    token = res.token;
    localStorage.setItem('token', token);
    currentUser = res.user;
    userInfo.textContent = `${currentUser.name} (${currentUser.rolle})`;
    await loadEvents();
    show(eventSection);
  } catch (err) {
    alert('Login fehlgeschlagen');
  }
}

function logout() {
  token = '';
  currentUser = null;
  localStorage.removeItem('token');
  show(loginSection);
}

async function loadEvents() {
  const res = await api('/api/events');
  eventsList.innerHTML = '';
  res.events.forEach((ev) => {
    const card = document.createElement('div');
    card.className = 'event-card';
    card.innerHTML = `
      <div class="title">${ev.titel}</div>
      <div class="meta">${new Date(ev.datum_start).toLocaleString('de-DE')} – ${new Date(ev.datum_ende).toLocaleString('de-DE')}</div>
      <div class="buttons">
        <button data-id="${ev.id}" data-action="vor">Vor-Event</button>
        <button data-id="${ev.id}" data-action="nach">Nach-Event</button>
        ${currentUser?.rolle === 'admin' ? '<button data-action="admin" data-id="' + ev.id + '">Auswertung</button>' : ''}
      </div>
    `;
    card.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => handleEventAction(ev, btn.dataset.action));
    });
    eventsList.appendChild(card);
  });
  const options = [
    { label: 'Tekendienst-Ansicht', value: 'tekendienst' },
    { label: 'Admin-Ansicht', value: 'admin' },
  ];
  roleView.innerHTML = options
    .filter((o) => o.value === currentUser?.rolle || currentUser?.rolle === 'admin')
    .map((o) => `<option value="${o.value}">${o.label}</option>`) // admin can preview both
    .join('');
  roleView.value = currentUser?.rolle;
  if (currentUser?.rolle === 'admin') {
    productSection.classList.remove('hidden');
    loadProducts();
  } else {
    productSection.classList.add('hidden');
  }
}

async function handleEventAction(event, action) {
  currentEvent = event;
  if (action === 'vor' || action === 'nach') {
    currentZeitpunkt = action === 'vor' ? 'vor_event' : 'nach_event';
    stockTitle.textContent = `${event.titel}`;
    stockHint.textContent = `${action === 'vor' ? 'Bestand vor Event' : 'Bestand nach Event'} · ${
      roleView.value
    }`;
    await loadProdukte();
    await loadBestand();
    show(stockSection);
  } else if (action === 'admin') {
    await openAdmin(event);
  }
}

async function loadProdukte() {
  const res = await api(`/api/produkte${roleView.value === 'admin' ? '?alle=1' : ''}`);
  produkteCache = res.produkte;
}

async function loadBestand() {
  const res = await api(`/api/bestand/${currentEvent.id}`);
  stockDraft = {};
  res.bestand.forEach((b) => {
    stockDraft[`${b.zeitpunkt_typ}-${b.produkt_id}`] = b.menge;
  });
  renderStock();
}

function renderStock() {
  const filter = stockSearch.value.toLowerCase();
  stockList.innerHTML = '';
  produkteCache
    .filter((p) => p.name.toLowerCase().includes(filter))
    .forEach((p) => {
      const key = `${currentZeitpunkt}-${p.id}`;
      const value = stockDraft[key] ?? '';
      const row = document.createElement('div');
      row.className = 'stock-row';
      row.innerHTML = `
        <div>
          <h4>${p.name}</h4>
          <small>${p.kategorie} • ${p.einheit}</small>
        </div>
        <div class="counter">
          <button class="minus">-</button>
          <input type="number" step="0.1" min="0" value="${value}" />
          <button class="plus">+</button>
        </div>
        <div class="info">${p.aktiv === false ? '<span class="badge">Inaktiv</span>' : ''}</div>
      `;
      const input = row.querySelector('input');
      const setVal = (v) => {
        const clean = Math.max(0, Number(v) || 0);
        stockDraft[key] = clean;
        input.value = clean;
        stockStatus.textContent = 'Zwischengespeichert ' + new Date().toLocaleTimeString('de-DE');
      };
      row.querySelector('.minus').addEventListener('click', () => setVal((Number(input.value) || 0) - 1));
      row.querySelector('.plus').addEventListener('click', () => setVal((Number(input.value) || 0) + 1));
      input.addEventListener('change', (e) => setVal(e.target.value));
      stockList.appendChild(row);
    });
}

async function saveStock() {
  const items = produkteCache.map((p) => ({
    produktId: p.id,
    menge: stockDraft[`${currentZeitpunkt}-${p.id}`] || 0,
  }));
  await api('/api/bestand', {
    method: 'POST',
    body: JSON.stringify({ eventId: currentEvent.id, zeitpunkt_typ: currentZeitpunkt, items }),
  });
  stockStatus.textContent = 'Gespeichert ' + new Date().toLocaleTimeString('de-DE');
  alert('Bestand gespeichert');
}

async function openAdmin(event) {
  currentEvent = event;
  adminEventTitle.textContent = `${event.titel} (${new Date(event.datum_start).toLocaleDateString('de-DE')})`;
  await refreshSummary();
  show(adminSection);
}

async function refreshSummary() {
  const res = await api(`/api/events/${currentEvent.id}/summary`);
  const s = res.summary;
  adminMetrics.innerHTML = '';
  const metrics = [
    { label: 'Umsatz (brutto)', value: formatCurrency(s.summen.umsatz) },
    { label: 'Wareneinsatz (brutto)', value: formatCurrency(s.summen.wareneinsatz) },
    { label: 'Gewinn (brutto)', value: formatCurrency(s.summen.gewinn) },
    { label: 'Umsatz laut Kasse', value: s.summen.umsatz_laut_kasse != null ? formatCurrency(s.summen.umsatz_laut_kasse) : '–' },
    { label: 'Schankverlust Betrag', value: s.summen.schankverlust_betrag != null ? formatCurrency(s.summen.schankverlust_betrag) : '–' },
    { label: 'Schankverlust %', value: s.summen.schankverlust_prozent != null ? (s.summen.schankverlust_prozent * 100).toFixed(2) + '%' : '–' },
  ];
  metrics.forEach((m) => {
    const el = document.createElement('div');
    el.className = 'metric';
    el.innerHTML = `<div class="label">${m.label}</div><div class="value">${m.value}</div>`;
    adminMetrics.appendChild(el);
  });
  const table = document.createElement('table');
  table.className = 'table';
  table.innerHTML = `
    <thead><tr><th>Produkt</th><th>Vor</th><th>Nach</th><th>Verkauft</th><th>Umsatz</th><th>Wareneinsatz</th><th>Gewinn</th><th></th></tr></thead>
    <tbody></tbody>
  `;
  const body = table.querySelector('tbody');
  s.positionen.forEach((p) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${p.name}</td>
      <td>${p.bestand_vor}</td>
      <td>${p.bestand_nach}</td>
      <td>${p.verkauft}</td>
      <td>${formatCurrency(p.umsatz)}</td>
      <td>${formatCurrency(p.wareneinsatz)}</td>
      <td>${formatCurrency(p.gewinn)}</td>
      <td>${p.warnung ? '<span class="badge">Check</span>' : ''}</td>
    `;
    body.appendChild(tr);
  });
  summaryTable.innerHTML = '';
  summaryTable.appendChild(table);
  cashUmsatz.value = s.summen.umsatz_laut_kasse ?? '';
  cashGewinn.value = s.summen.gewinn_laut_kasse ?? '';
  cashTip.value = s.summen.trinkgeld ?? '';
}

function formatCurrency(value) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value || 0);
}

async function saveCash() {
  await api(`/api/events/${currentEvent.id}/cash`, {
    method: 'PUT',
    body: JSON.stringify({
      umsatz_laut_kasse: Number(cashUmsatz.value || 0),
      gewinn_laut_kasse: cashGewinn.value === '' ? null : Number(cashGewinn.value),
      trinkgeld: cashTip.value === '' ? null : Number(cashTip.value),
      notiz_kasse: cashNote.value,
    }),
  });
  await refreshSummary();
  alert('Kassendaten gespeichert');
}

async function loadProducts() {
  const res = await api(`/api/produkte?alle=${viewingInactive ? 1 : 0}`);
  const list = document.getElementById('productList');
  list.innerHTML = '';
  res.produkte.forEach((p) => {
    const row = document.createElement('div');
    row.className = 'product-item';
    row.innerHTML = `
      <div class="info">
        <strong>${p.name}</strong>
        <small>${p.kategorie} • ${p.einheit}</small>
        <small>EK: ${p.ek_preis ?? '–'}€ (brutto) · VK: ${p.vk_preis ?? '–'}€ (brutto)</small>
      </div>
      <div class="actions">
        <button data-id="${p.id}" class="edit">Bearbeiten</button>
        <button data-id="${p.id}" class="deactivate">${p.aktiv ? 'Deaktivieren' : 'Aktivieren'}</button>
      </div>
    `;
    row.querySelector('.edit').addEventListener('click', () => openProductForm(p));
    row.querySelector('.deactivate').addEventListener('click', () => toggleProduct(p));
    list.appendChild(row);
  });
}

function openProductForm(p = null) {
  const wrap = document.getElementById('productFormWrap');
  wrap.classList.remove('hidden');
  editingProductId = p?.id || null;
  document.getElementById('productFormTitle').textContent = p ? 'Produkt bearbeiten' : 'Neues Produkt';
  document.getElementById('prodName').value = p?.name || '';
  document.getElementById('prodCategory').value = p?.kategorie || '';
  document.getElementById('prodUnit').value = p?.einheit || '';
  document.getElementById('prodEk').value = p?.ek_preis ?? '';
  document.getElementById('prodVk').value = p?.vk_preis ?? '';
  document.getElementById('prodActive').checked = p?.aktiv ?? true;
}

async function saveProduct() {
  const payload = {
    name: document.getElementById('prodName').value,
    kategorie: document.getElementById('prodCategory').value,
    einheit: document.getElementById('prodUnit').value,
    ek_preis: parseFloat(document.getElementById('prodEk').value || '0'),
    vk_preis: parseFloat(document.getElementById('prodVk').value || '0'),
    aktiv: document.getElementById('prodActive').checked,
  };
  if (editingProductId) {
    await api(`/api/produkte/${editingProductId}`, { method: 'PUT', body: JSON.stringify(payload) });
  } else {
    await api('/api/produkte', { method: 'POST', body: JSON.stringify(payload) });
  }
  document.getElementById('productFormWrap').classList.add('hidden');
  await loadProducts();
}

async function toggleProduct(p) {
  await api(`/api/produkte/${p.id}`, { method: 'PUT', body: JSON.stringify({ aktiv: !p.aktiv }) });
  await loadProducts();
}

async function downloadCsv() {
  const csv = await api(`/api/events/${currentEvent.id}/export`);
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `event-${currentEvent.id}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Event listeners
loginBtn.addEventListener('click', login);
logoutBtn.addEventListener('click', logout);
stockSearch.addEventListener('input', renderStock);
stockSection.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    stockSection.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentZeitpunkt = btn.dataset.zeitpunkt;
    renderStock();
  });
});

document.getElementById('closeStock').addEventListener('click', () => show(eventSection));

document.getElementById('saveStock').addEventListener('click', saveStock);
document.getElementById('saveCash').addEventListener('click', saveCash);
document.getElementById('refreshSummary').addEventListener('click', refreshSummary);
document.getElementById('downloadCsv').addEventListener('click', downloadCsv);
document.getElementById('newProduct').addEventListener('click', () => openProductForm());
document.getElementById('saveProduct').addEventListener('click', saveProduct);
document.getElementById('cancelProduct').addEventListener('click', () => document.getElementById('productFormWrap').classList.add('hidden'));
document.getElementById('toggleInactive').addEventListener('click', async () => {
  viewingInactive = !viewingInactive;
  await loadProducts();
});

if (token) {
  api('/api/profile')
    .then((res) => {
      currentUser = res.user;
      userInfo.textContent = `${currentUser.name} (${currentUser.rolle})`;
      loadEvents();
      show(eventSection);
    })
    .catch(() => logout());
} else {
  show(loginSection);
}
