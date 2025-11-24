const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');
const JWT_SECRET = process.env.JWT_SECRET || 'super-geheim-kokolores';

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signToken(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const segments = [base64url(JSON.stringify(header)), base64url(JSON.stringify(payload))];
  const data = segments.join('.');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64');
  const jwt = `${data}.${base64url(signature)}`;
  return jwt;
}

function verifyToken(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const data = `${header}.${payload}`;
  const expected = base64url(
    crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64')
  );
  if (expected !== signature) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64').toString());
    return decoded;
  } catch (err) {
    return null;
  }
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(derived, 'hex'));
}

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
  }
  if (!fs.existsSync(DATA_FILE)) {
    const now = new Date().toISOString();
    const defaultData = {
      users: [
        {
          id: 'u-admin',
          name: 'Admin',
          e_mail: 'admin@kokolores.bar',
          rolle: 'admin',
          passwort_hash: hashPassword('admin123'),
          erstellt_am: now,
        },
        {
          id: 'u-tekendienst',
          name: 'Tekendienst',
          e_mail: 'tekendienst@kokolores.bar',
          rolle: 'tekendienst',
          passwort_hash: hashPassword('service123'),
          erstellt_am: now,
        },
      ],
      produkte: seedProducts(now),
      events: seedEvents(now),
      bestand: [],
      cash_data: [],
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2));
  }
}

function seedProducts(timestamp) {
  const products = [
    { name: 'fritz-kola 0,33', kategorie: 'Alkoholfrei', einheit: 'Flasche 0,33', ek_preis: 0.93, vk_preis: 2.0 },
    { name: 'fritz-kola light 0,33', kategorie: 'Alkoholfrei', einheit: 'Flasche 0,33', ek_preis: 0.93, vk_preis: 2.0 },
    { name: 'fritz-limo Orange 0,33', kategorie: 'Alkoholfrei', einheit: 'Flasche 0,33', ek_preis: 0.93, vk_preis: 2.0 },
    { name: 'fritz-limo Zitrone 0,33', kategorie: 'Alkoholfrei', einheit: 'Flasche 0,33', ek_preis: 0.93, vk_preis: 2.0 },
    { name: 'fritz-limo Apfel-Kirsch 0,33', kategorie: 'Alkoholfrei', einheit: 'Flasche 0,33', ek_preis: 0.93, vk_preis: 2.0 },
    { name: 'fritz Anjola 0,33', kategorie: 'Alkoholfrei', einheit: 'Flasche 0,33', ek_preis: 0.93, vk_preis: 2.0 },
    { name: 'fritz Spritz Apfel 0,33', kategorie: 'Alkoholfrei', einheit: 'Flasche 0,33', ek_preis: 1.1, vk_preis: 2.0 },
    { name: 'fritz Spritz Traube 0,33', kategorie: 'Alkoholfrei', einheit: 'Flasche 0,33', ek_preis: 1.1, vk_preis: 2.0 },
    { name: 'VC Spezi 0,33', kategorie: 'Alkoholfrei', einheit: 'Flasche 0,33', ek_preis: 0.59, vk_preis: 2.0 },
    { name: 'Sprudel 0,5', kategorie: 'Alkoholfrei', einheit: 'Flasche 0,5', ek_preis: 0.4, vk_preis: 1.0 },
    { name: 'Wasser still 0,5', kategorie: 'Alkoholfrei', einheit: 'Flasche 0,5', ek_preis: 0.4, vk_preis: 1.0 },
    { name: 'Sprite 1l', kategorie: 'Zum Mischen', einheit: '1l', ek_preis: 1.65, vk_preis: 0 },
    { name: 'Cola 1l', kategorie: 'Zum Mischen', einheit: '1l', ek_preis: 1.65, vk_preis: 0 },
    { name: 'Energy 1,5l', kategorie: 'Zum Mischen', einheit: '1,5l', ek_preis: null, vk_preis: 0 },
    { name: 'Schweppes 1l', kategorie: 'Zum Mischen', einheit: '1l', ek_preis: null, vk_preis: 0 },
    { name: 'Wein rot (Ausschank 0,2)', kategorie: 'Wein', einheit: 'Flasche 1l', ek_preis: 4.55, vk_preis: 3.5 },
    { name: 'Wein weiß (Ausschank 0,2)', kategorie: 'Wein', einheit: 'Flasche 1l', ek_preis: 4.55, vk_preis: 3.5 },
    { name: 'Joster 1l', kategorie: 'Shots', einheit: 'Flasche 1l', ek_preis: 6.49, vk_preis: 2.0 },
    { name: 'Pfeffi 0,7', kategorie: 'Shots', einheit: 'Flasche 0,7', ek_preis: 4.99, vk_preis: 2.0 },
    { name: 'Vodka 0,7', kategorie: 'Longdrink', einheit: 'Flasche 0,7', ek_preis: 7.99, vk_preis: 3.5 },
    { name: 'Asbach 0,7', kategorie: 'Longdrink', einheit: 'Flasche 0,7', ek_preis: 13.49, vk_preis: 3.5 },
    { name: 'Jägermeister 0,7', kategorie: 'Shots', einheit: 'Flasche 0,7', ek_preis: 14.99, vk_preis: 2.0 },
    { name: 'Herbsthäuser Epi 0,33', kategorie: 'Bier', einheit: 'Flasche 0,33', ek_preis: 0.77, vk_preis: 2.0 },
    { name: 'Augustiner Helles 0,5', kategorie: 'Bier', einheit: 'Flasche 0,5', ek_preis: 1.19, vk_preis: 2.5 },
  ];
  return products.map((p, idx) => ({
    id: `p-${idx + 1}`,
    aktiv: true,
    erstellt_am: timestamp,
    geandert_am: timestamp,
    ...p,
  }));
}

function seedEvents(timestamp) {
  return [
    {
      id: 'e-1',
      titel: 'Konzert Frühlingsklänge',
      datum_start: new Date().toISOString(),
      datum_ende: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      typ: 'Konzert',
      notiz_intern: 'Probe-Event für den Start',
      erstellt_am: timestamp,
    },
    {
      id: 'e-2',
      titel: 'Party Nachtflug',
      datum_start: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      datum_ende: new Date(Date.now() + 27 * 60 * 60 * 1000).toISOString(),
      typ: 'Party',
      notiz_intern: '',
      erstellt_am: timestamp,
    },
  ];
}

function readDb() {
  ensureDataFile();
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}

function writeDb(db) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

function parseBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        resolve({});
      }
    });
  });
}

function send(res, status, data, headers = {}) {
  const body = data ? JSON.stringify(data) : '';
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    ...headers,
  });
  res.end(body);
}

function serveStatic(req, res) {
  const filePath = path.join(
    __dirname,
    'public',
    req.url === '/' ? 'index.html' : req.url.split('?')[0]
  );
  if (!filePath.startsWith(path.join(__dirname, 'public'))) {
    res.writeHead(403);
    res.end('Forbidden');
    return true;
  }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    const mime =
      ext === '.html'
        ? 'text/html'
        : ext === '.css'
        ? 'text/css'
        : ext === '.js'
        ? 'application/javascript'
        : 'text/plain';
    res.writeHead(200, {
      'Content-Type': mime,
      'Access-Control-Allow-Origin': '*',
    });
    fs.createReadStream(filePath).pipe(res);
    return true;
  }
  return false;
}

function requireAuth(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');
  return verifyToken(token);
}

function getStockEntry(db, eventId, productId, typ) {
  return db.bestand.find(
    (b) => b.event_id === eventId && b.produkt_id === productId && b.zeitpunkt_typ === typ
  );
}

function setStockEntry(db, eventId, productId, typ, menge, userId) {
  const existing = getStockEntry(db, eventId, productId, typ);
  const now = new Date().toISOString();
  if (existing) {
    existing.menge = menge;
    existing.timestamp = now;
    existing.angelegt_von_user_id = userId;
  } else {
    db.bestand.push({
      id: `b-${db.bestand.length + 1}`,
      event_id: eventId,
      produkt_id: productId,
      zeitpunkt_typ: typ,
      menge,
      angelegt_von_user_id: userId,
      timestamp: now,
    });
  }
}

function buildSummary(db, eventId) {
  const event = db.events.find((e) => e.id === eventId);
  if (!event) return null;
  const rows = [];
  let sumUmsatz = 0;
  let sumEinsatz = 0;
  db.produkte.forEach((p) => {
    const before = getStockEntry(db, eventId, p.id, 'vor_event');
    const after = getStockEntry(db, eventId, p.id, 'nach_event');
    if (!before && !after) return;
    const bestandVor = before ? Number(before.menge) : 0;
    const bestandNach = after ? Number(after.menge) : 0;
    const verkauft = Number((bestandVor - bestandNach).toFixed(3));
    const umsatz = Number((verkauft * (p.vk_preis || 0)).toFixed(2));
    const wareneinsatz = Number((verkauft * (p.ek_preis || 0)).toFixed(2));
    const gewinn = Number((umsatz - wareneinsatz).toFixed(2));
    sumUmsatz += umsatz;
    sumEinsatz += wareneinsatz;
    rows.push({
      produkt_id: p.id,
      name: p.name,
      kategorie: p.kategorie,
      einheit: p.einheit,
      bestand_vor: bestandVor,
      bestand_nach: bestandNach,
      verkauft,
      umsatz,
      wareneinsatz,
      gewinn,
      warnung: verkauft < 0,
    });
  });
  const cash = db.cash_data.find((c) => c.event_id === eventId);
  const gesamtGewinn = Number((sumUmsatz - sumEinsatz).toFixed(2));
  const kassenUmsatz = cash?.umsatz_laut_kasse;
  const kassenGewinn = cash?.gewinn_laut_kasse;
  const trinkgeld = cash?.trinkgeld;
  const schankverlustBetrag =
    typeof kassenUmsatz === 'number' ? Number((sumUmsatz - kassenUmsatz).toFixed(2)) : null;
  const schankverlustProzent =
    typeof kassenUmsatz === 'number' && sumUmsatz !== 0
      ? Number(((sumUmsatz - kassenUmsatz) / sumUmsatz).toFixed(4))
      : null;
  return {
    event,
    positionen: rows,
    summen: {
      umsatz: Number(sumUmsatz.toFixed(2)),
      wareneinsatz: Number(sumEinsatz.toFixed(2)),
      gewinn: gesamtGewinn,
      umsatz_laut_kasse: kassenUmsatz ?? null,
      gewinn_laut_kasse: typeof kassenGewinn === 'number' ? kassenGewinn : null,
      trinkgeld: typeof trinkgeld === 'number' ? trinkgeld : null,
      schankverlust_betrag: schankverlustBetrag,
      schankverlust_prozent: schankverlustProzent,
    },
  };
}

function exportCsv(summary) {
  const header = [
    'Produkt',
    'Kategorie',
    'Einheit',
    'Bestand vor',
    'Bestand nach',
    'Verkauft',
    'Umsatz (brutto)',
    'Wareneinsatz (brutto)',
    'Gewinn (brutto)',
    'Warnung',
  ];
  const rows = summary.positionen.map((p) => [
    p.name,
    p.kategorie,
    p.einheit,
    p.bestand_vor,
    p.bestand_nach,
    p.verkauft,
    p.umsatz,
    p.wareneinsatz,
    p.gewinn,
    p.warnung ? 'Negativer Verkauf' : '',
  ]);
  rows.push([]);
  rows.push(['GESAMT', '', '', '', '', '', summary.summen.umsatz, summary.summen.wareneinsatz, summary.summen.gewinn]);
  if (summary.summen.umsatz_laut_kasse !== null) {
    rows.push(['Umsatz laut Kasse', '', '', '', '', '', summary.summen.umsatz_laut_kasse]);
    rows.push(['Schankverlust Betrag', '', '', '', '', '', summary.summen.schankverlust_betrag]);
    rows.push(['Schankverlust %', '', '', '', '', '', summary.summen.schankverlust_prozent]);
  }
  return [header, ...rows].map((r) => r.join(';')).join('\n');
}

ensureDataFile();

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    send(res, 200, {});
    return;
  }

  if (serveStatic(req, res)) return;

  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  const db = readDb();

  // Auth endpoints
  if (req.method === 'POST' && urlObj.pathname === '/api/auth/login') {
    const body = await parseBody(req);
    const user = db.users.find((u) => u.e_mail === (body.email || body.e_mail));
    if (!user || !verifyPassword(body.password || '', user.passwort_hash)) {
      send(res, 401, { message: 'Login fehlgeschlagen' });
      return;
    }
    const token = signToken({ id: user.id, rolle: user.rolle, name: user.name, email: user.e_mail });
    send(res, 200, { token, user: { id: user.id, name: user.name, rolle: user.rolle, e_mail: user.e_mail } });
    return;
  }

  if (urlObj.pathname === '/api/profile') {
    const session = requireAuth(req);
    if (!session) {
      send(res, 401, { message: 'Nicht eingeloggt' });
      return;
    }
    const user = db.users.find((u) => u.id === session.id);
    send(res, 200, { user });
    return;
  }

  // Events listing
  if (req.method === 'GET' && urlObj.pathname === '/api/events') {
    const session = requireAuth(req);
    if (!session) return send(res, 401, { message: 'Nicht eingeloggt' });
    const events = db.events.sort((a, b) => new Date(a.datum_start) - new Date(b.datum_start));
    send(res, 200, { events });
    return;
  }

  // Products listing
  if (req.method === 'GET' && urlObj.pathname === '/api/produkte') {
    const session = requireAuth(req);
    if (!session) return send(res, 401, { message: 'Nicht eingeloggt' });
    const includeInactive = session.rolle === 'admin' && urlObj.searchParams.get('alle') === '1';
    const list = db.produkte.filter((p) => includeInactive || p.aktiv);
    if (session.rolle !== 'admin') {
      const trimmed = list.map(({ ek_preis, vk_preis, ...rest }) => rest);
      send(res, 200, { produkte: trimmed });
    } else {
      send(res, 200, { produkte: list });
    }
    return;
  }

  if (req.method === 'POST' && urlObj.pathname === '/api/produkte') {
    const session = requireAuth(req);
    if (!session || session.rolle !== 'admin') return send(res, 403, { message: 'Keine Rechte' });
    const body = await parseBody(req);
    const id = `p-${db.produkte.length + 1}`;
    const now = new Date().toISOString();
    const produkt = {
      id,
      name: body.name,
      kategorie: body.kategorie,
      einheit: body.einheit,
      ek_preis: Number(body.ek_preis) || 0,
      vk_preis: Number(body.vk_preis) || 0,
      aktiv: body.aktiv !== false,
      erstellt_am: now,
      geandert_am: now,
    };
    db.produkte.push(produkt);
    writeDb(db);
    send(res, 201, { produkt });
    return;
  }

  if (req.method === 'PUT' && urlObj.pathname.startsWith('/api/produkte/')) {
    const session = requireAuth(req);
    if (!session || session.rolle !== 'admin') return send(res, 403, { message: 'Keine Rechte' });
    const id = urlObj.pathname.split('/').pop();
    const produkt = db.produkte.find((p) => p.id === id);
    if (!produkt) return send(res, 404, { message: 'Produkt nicht gefunden' });
    const body = await parseBody(req);
    Object.assign(produkt, {
      name: body.name ?? produkt.name,
      kategorie: body.kategorie ?? produkt.kategorie,
      einheit: body.einheit ?? produkt.einheit,
      ek_preis: body.ek_preis !== undefined ? Number(body.ek_preis) : produkt.ek_preis,
      vk_preis: body.vk_preis !== undefined ? Number(body.vk_preis) : produkt.vk_preis,
      aktiv: body.aktiv !== undefined ? !!body.aktiv : produkt.aktiv,
      geandert_am: new Date().toISOString(),
    });
    writeDb(db);
    send(res, 200, { produkt });
    return;
  }

  // Stock entries
  if (req.method === 'GET' && urlObj.pathname.startsWith('/api/bestand/')) {
    const session = requireAuth(req);
    if (!session) return send(res, 401, { message: 'Nicht eingeloggt' });
    const eventId = urlObj.pathname.split('/').pop();
    const entries = db.bestand.filter((b) => b.event_id === eventId);
    send(res, 200, { bestand: entries });
    return;
  }

  if (req.method === 'POST' && urlObj.pathname === '/api/bestand') {
    const session = requireAuth(req);
    if (!session) return send(res, 401, { message: 'Nicht eingeloggt' });
    const body = await parseBody(req);
    const { eventId, zeitpunkt_typ, items } = body;
    if (!eventId || !zeitpunkt_typ || !Array.isArray(items)) {
      send(res, 400, { message: 'Ungültige Anfrage' });
      return;
    }
    items.forEach((item) => {
      setStockEntry(db, eventId, item.produktId, zeitpunkt_typ, Number(item.menge || 0), session.id);
    });
    writeDb(db);
    send(res, 200, { message: 'Bestand gespeichert' });
    return;
  }

  // Cash data
  if (req.method === 'PUT' && urlObj.pathname.startsWith('/api/events/') && urlObj.pathname.endsWith('/cash')) {
    const session = requireAuth(req);
    if (!session || session.rolle !== 'admin') return send(res, 403, { message: 'Keine Rechte' });
    const eventId = urlObj.pathname.split('/')[3];
    const body = await parseBody(req);
    let cash = db.cash_data.find((c) => c.event_id === eventId);
    if (!cash) {
      cash = { event_id: eventId };
      db.cash_data.push(cash);
    }
    cash.umsatz_laut_kasse = body.umsatz_laut_kasse !== undefined ? Number(body.umsatz_laut_kasse) : null;
    cash.trinkgeld = body.trinkgeld !== undefined ? Number(body.trinkgeld) : null;
    cash.notiz_kasse = body.notiz_kasse || '';
    cash.gewinn_laut_kasse = body.gewinn_laut_kasse !== undefined ? Number(body.gewinn_laut_kasse) : null;
    cash.timestamp = new Date().toISOString();
    writeDb(db);
    send(res, 200, { cash });
    return;
  }

  // Summary
  if (req.method === 'GET' && urlObj.pathname.startsWith('/api/events/') && urlObj.pathname.endsWith('/summary')) {
    const session = requireAuth(req);
    if (!session || session.rolle !== 'admin') return send(res, 403, { message: 'Keine Rechte' });
    const eventId = urlObj.pathname.split('/')[3];
    const summary = buildSummary(db, eventId);
    if (!summary) return send(res, 404, { message: 'Event nicht gefunden' });
    send(res, 200, { summary });
    return;
  }

  // Export
  if (req.method === 'GET' && urlObj.pathname.startsWith('/api/events/') && urlObj.pathname.endsWith('/export')) {
    const session = requireAuth(req);
    if (!session || session.rolle !== 'admin') return send(res, 403, { message: 'Keine Rechte' });
    const eventId = urlObj.pathname.split('/')[3];
    const summary = buildSummary(db, eventId);
    if (!summary) return send(res, 404, { message: 'Event nicht gefunden' });
    const csv = exportCsv(summary);
    res.writeHead(200, {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="event-${eventId}.csv"`,
      'Access-Control-Allow-Origin': '*',
    });
    res.end(csv);
    return;
  }

  send(res, 404, { message: 'Nicht gefunden' });
});

server.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});
