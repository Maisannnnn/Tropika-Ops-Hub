// Tropika Ops Hub — app logic

let supabase;
try {
  if (!window.supabase) throw new Error('Supabase library did not load from the CDN.');
  supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
} catch (err) {
  window.addEventListener('load', () => {
    const el = document.getElementById('authStatus');
    if (el) el.innerHTML = `<span style="color:#a83232">Setup error: ${err.message}</span>`;
  });
}

let allProperties = [];
let allRooms = [];
let allAgents = [];
let allBookings = [];
let searchResults = {}; // id -> { data, selected }
let currentIsland = '';

// ---------- Auth ----------

async function signUp() {
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const { error } = await supabase.auth.signUp({ email, password });
  setAuthStatus(error ? error.message : 'Account created — check email for confirmation if required, then sign in.', !!error);
}

async function signIn() {
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    setAuthStatus(error.message, true);
    return;
  }
  onSignedIn();
}

async function signOut() {
  await supabase.auth.signOut();
  document.getElementById('appShell').style.display = 'none';
  document.getElementById('authGate').style.display = 'flex';
}

function setAuthStatus(text, isError) {
  document.getElementById('authStatus').innerHTML = text ? `<span style="color:${isError ? '#a83232' : '#555'}">${escapeHtml(text)}</span>` : '';
}

async function onSignedIn() {
  document.getElementById('authGate').style.display = 'none';
  document.getElementById('appShell').style.display = 'flex';
  document.getElementById('arrivalsWindowLabel').textContent = CONFIG.ARRIVALS_WINDOW_DAYS;
  await refreshAll();
}

async function checkExistingSession() {
  const { data } = await supabase.auth.getSession();
  if (data.session) onSignedIn();
}

// ---------- Tabs ----------

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach((el) => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach((el) => el.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  document.querySelector(`.nav-item[data-tab="${tab}"]`).classList.add('active');
}

// ---------- Data refresh ----------

async function refreshAll() {
  await Promise.all([loadProperties(), loadAgents(), loadBookings(), loadInvoices()]);
  renderPropertiesTable();
  renderAgentsTable();
  renderBookingsTable();
  renderInvoicesTable();
  renderArrivalsTable();
  populateBookingDropdowns();
}

async function loadProperties() {
  const { data: props } = await supabase.from('properties').select('*').order('created_at', { ascending: false });
  const { data: rooms } = await supabase.from('property_rooms').select('*');
  allProperties = props || [];
  allRooms = rooms || [];
}
async function loadAgents() {
  const { data } = await supabase.from('agents').select('*').order('created_at', { ascending: false });
  allAgents = data || [];
}
async function loadBookings() {
  const { data } = await supabase.from('bookings').select('*').order('created_at', { ascending: false });
  allBookings = data || [];
}
let allInvoices = [];
async function loadInvoices() {
  const { data } = await supabase.from('invoices').select('*').order('created_at', { ascending: false });
  allInvoices = data || [];
}

// ---------- Properties: manual add + directory ----------

async function addPropertyManually() {
  const row = {
    name: val('pName'), island: val('pIsland'), address: val('pAddress'),
    phone: val('pPhone'), website: val('pWebsite'), status: val('pStatus'),
    contact_person: val('pContactPerson'), contact_email: val('pContactEmail'),
  };
  if (!row.name) { showStatus('Property name is required.', true); return; }
  const { error } = await supabase.from('properties').insert(row);
  if (error) { showStatus('Error: ' + error.message, true); return; }
  showStatus('Property added.');
  ['pName','pIsland','pAddress','pPhone','pWebsite','pContactPerson','pContactEmail'].forEach((id) => document.getElementById(id).value = '');
  await loadProperties();
  renderPropertiesTable();
  populateBookingDropdowns();
}

function renderPropertiesTable() {
  const tbody = document.querySelector('#propertiesTable tbody');
  tbody.innerHTML = allProperties.map((p) => `
    <tr>
      <td>${escapeHtml(p.name)}</td>
      <td>${escapeHtml(p.island || '')}</td>
      <td><span class="badge">${escapeHtml(p.status || '')}</span></td>
      <td>${escapeHtml(p.contact_person || '')} ${p.contact_email ? '· ' + escapeHtml(p.contact_email) : ''}</td>
    </tr>`).join('');
}

// ---------- Agents ----------

async function addAgent() {
  const row = {
    name: val('aName'), agency_name: val('aAgency'), country: val('aCountry'),
    whatsapp: val('aWhatsapp'), email: val('aEmail'), relationship_stage: val('aStage'),
  };
  if (!row.name) { showStatus('Agent name is required.', true); return; }
  const { error } = await supabase.from('agents').insert(row);
  if (error) { showStatus('Error: ' + error.message, true); return; }
  showStatus('Agent added.');
  ['aName','aAgency','aCountry','aWhatsapp','aEmail'].forEach((id) => document.getElementById(id).value = '');
  await loadAgents();
  renderAgentsTable();
  populateBookingDropdowns();
}

function renderAgentsTable() {
  const tbody = document.querySelector('#agentsTable tbody');
  tbody.innerHTML = allAgents.map((a) => `
    <tr>
      <td>${escapeHtml(a.name)}</td>
      <td>${escapeHtml(a.agency_name || '')}</td>
      <td>${escapeHtml(a.country || '')}</td>
      <td><span class="badge">${escapeHtml(a.relationship_stage || '')}</span></td>
      <td>${escapeHtml(a.whatsapp || '')} ${a.email ? '· ' + escapeHtml(a.email) : ''}</td>
    </tr>`).join('');
}

// ---------- Bookings ----------

function populateBookingDropdowns() {
  const propSel = document.getElementById('bProperty');
  propSel.innerHTML = '<option value="">Select property</option>' +
    allProperties.map((p) => `<option value="${p.id}">${escapeHtml(p.name)} (${escapeHtml(p.island || '')})</option>`).join('');

  const agentSel = document.getElementById('bAgent');
  agentSel.innerHTML = '<option value="">Select agent</option>' +
    allAgents.map((a) => `<option value="${a.id}">${escapeHtml(a.name)} — ${escapeHtml(a.agency_name || '')}</option>`).join('');

  const bookingSel = document.getElementById('iBooking');
  bookingSel.innerHTML = '<option value="">Select booking</option>' +
    allBookings.map((b) => `<option value="${b.id}">${escapeHtml(b.guest_name || 'Guest')} — ${escapeHtml(propertyName(b.property_id))} (${b.check_in || ''})</option>`).join('');

  onBookingPropertyChange();
}

function onBookingPropertyChange() {
  const propId = document.getElementById('bProperty').value;
  const roomSel = document.getElementById('bRoom');
  const rooms = allRooms.filter((r) => r.property_id === propId);
  roomSel.innerHTML = '<option value="">Select room type</option>' +
    rooms.map((r) => `<option value="${r.id}">${escapeHtml(r.room_type || 'Room')} — $${r.rate_usd_per_night || 0}/night</option>`).join('');
}

function generateBookingRequest() {
  const propId = document.getElementById('bProperty').value;
  const prop = allProperties.find((p) => p.id === propId);
  const roomId = document.getElementById('bRoom').value;
  const room = allRooms.find((r) => r.id === roomId);
  const guestName = val('bGuestName');
  const guestCount = val('bGuestCount');
  const checkIn = val('bCheckIn');
  const checkOut = val('bCheckOut');

  if (!prop) { showStatus('Select a property first.', true); return; }

  const text = `Booking Request — Tropika Travel & Tours

Property: ${prop.name}
Room type: ${room ? room.room_type : '(not specified)'}
Guest name: ${guestName || '(TBC)'}
Number of guests: ${guestCount || '(TBC)'}
Check-in: ${checkIn || '(TBC)'}
Check-out: ${checkOut || '(TBC)'}

Could you please confirm availability and rate for the above dates?

Thank you,
Tropika Travel & Tours`;

  document.getElementById('bRequestText').value = text;
}

async function saveBooking() {
  const row = {
    property_id: document.getElementById('bProperty').value || null,
    room_id: document.getElementById('bRoom').value || null,
    agent_id: document.getElementById('bAgent').value || null,
    guest_name: val('bGuestName'),
    guest_count: val('bGuestCount') ? parseInt(val('bGuestCount'), 10) : null,
    check_in: val('bCheckIn') || null,
    check_out: val('bCheckOut') || null,
    quote_amount_usd: val('bQuoteAmount') ? parseFloat(val('bQuoteAmount')) : null,
    status: document.getElementById('bRequestText').value ? 'request_sent' : 'draft',
    booking_form_sent_at: document.getElementById('bRequestText').value ? new Date().toISOString() : null,
  };
  if (!row.property_id) { showStatus('Select a property first.', true); return; }

  const { error } = await supabase.from('bookings').insert(row);
  if (error) { showStatus('Error: ' + error.message, true); return; }
  showStatus('Booking saved.');
  await loadBookings();
  renderBookingsTable();
  renderArrivalsTable();
  populateBookingDropdowns();
}

async function updateBookingStatus(id, status) {
  const { error } = await supabase.from('bookings').update({ status }).eq('id', id);
  if (error) { showStatus('Error: ' + error.message, true); return; }
  await loadBookings();
  renderArrivalsTable();
}

const BOOKING_STATUSES = ['draft', 'request_sent', 'confirmed_by_hotel', 'deposit_received', 'balance_paid', 'completed', 'cancelled'];

function propertyName(id) {
  const p = allProperties.find((p) => p.id === id);
  return p ? p.name : '(unknown)';
}
function agentName(id) {
  const a = allAgents.find((a) => a.id === id);
  return a ? a.name : '';
}

function renderBookingsTable() {
  const tbody = document.querySelector('#bookingsTable tbody');
  tbody.innerHTML = allBookings.map((b) => `
    <tr>
      <td>${escapeHtml(b.guest_name || '')}</td>
      <td>${escapeHtml(propertyName(b.property_id))}</td>
      <td>${escapeHtml(agentName(b.agent_id))}</td>
      <td>${b.check_in || ''}</td>
      <td>${b.check_out || ''}</td>
      <td>${b.quote_amount_usd ? '$' + b.quote_amount_usd : ''}</td>
      <td>
        <select onchange="updateBookingStatus('${b.id}', this.value)">
          ${BOOKING_STATUSES.map((s) => `<option value="${s}" ${s === b.status ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </td>
    </tr>`).join('');
}

// ---------- Finances ----------

async function addInvoice() {
  const row = {
    booking_id: document.getElementById('iBooking').value || null,
    invoice_number: val('iNumber'),
    amount_usd: val('iAmount') ? parseFloat(val('iAmount')) : null,
    date_issued: val('iDateIssued') || null,
    due_date: val('iDueDate') || null,
    status: val('iStatus'),
  };
  const { error } = await supabase.from('invoices').insert(row);
  if (error) { showStatus('Error: ' + error.message, true); return; }
  showStatus('Invoice added.');
  await loadInvoices();
  renderInvoicesTable();
}

function renderInvoicesTable() {
  const tbody = document.querySelector('#invoicesTable tbody');
  tbody.innerHTML = allInvoices.map((inv) => {
    const booking = allBookings.find((b) => b.id === inv.booking_id);
    return `
    <tr>
      <td>${escapeHtml(inv.invoice_number || '')}</td>
      <td>${booking ? escapeHtml(booking.guest_name || '') + ' — ' + escapeHtml(propertyName(booking.property_id)) : ''}</td>
      <td>${inv.amount_usd ? '$' + inv.amount_usd : ''}</td>
      <td>${inv.date_issued || ''}</td>
      <td>${inv.due_date || ''}</td>
      <td><span class="badge">${escapeHtml(inv.status || '')}</span></td>
    </tr>`;
  }).join('');
}

// ---------- Arrivals ----------

function renderArrivalsTable() {
  const today = new Date();
  const windowEnd = new Date();
  windowEnd.setDate(today.getDate() + CONFIG.ARRIVALS_WINDOW_DAYS);

  const arrivals = allBookings.filter((b) => {
    if (!b.check_in) return false;
    if (!['confirmed_by_hotel', 'deposit_received', 'balance_paid'].includes(b.status)) return false;
    const checkIn = new Date(b.check_in);
    return checkIn >= today && checkIn <= windowEnd;
  }).sort((a, b) => new Date(a.check_in) - new Date(b.check_in));

  const tbody = document.querySelector('#arrivalsTable tbody');
  tbody.innerHTML = arrivals.map((b) => `
    <tr>
      <td>${escapeHtml(b.guest_name || '')}</td>
      <td>${escapeHtml(propertyName(b.property_id))}</td>
      <td>${b.check_in}</td>
      <td>${b.check_out || ''}</td>
      <td>${b.guest_count || ''}</td>
      <td><span class="badge">${escapeHtml(b.status || '')}</span></td>
    </tr>`).join('');
}

// ---------- Google Places discovery (feeds into Properties) ----------

async function geocodeIsland(island) {
  const resp = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': CONFIG.PLACES_API_KEY, 'X-Goog-FieldMask': 'places.location,places.id' },
    body: JSON.stringify({ textQuery: `${island}, Maldives`, pageSize: 1 }),
  });
  if (!resp.ok) throw new Error('Could not locate island: ' + (await resp.text()));
  const data = await resp.json();
  return data.places && data.places.length ? data.places[0].location : null;
}

function buildBoundingBox(center, pad) {
  return { low: { latitude: center.latitude - pad, longitude: center.longitude - pad }, high: { latitude: center.latitude + pad, longitude: center.longitude + pad } };
}

const FIELD_MASK = 'places.id,places.displayName,places.rating,places.userRatingCount,places.formattedAddress,places.websiteUri,places.internationalPhoneNumber,nextPageToken';

async function searchOnePagedQuery(query, rectangle) {
  const collected = [];
  let pageToken = null;
  let pagesFetched = 0;
  do {
    const body = { textQuery: query, pageSize: 20 };
    if (rectangle) body.locationRestriction = { rectangle };
    if (pageToken) body.pageToken = pageToken;
    const resp = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': CONFIG.PLACES_API_KEY, 'X-Goog-FieldMask': FIELD_MASK },
      body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error(`Places API error (${resp.status}): ${await resp.text()}`);
    const data = await resp.json();
    (data.places || []).forEach((p) => collected.push(p));
    pageToken = data.nextPageToken || null;
    pagesFetched += 1;
    if (pageToken && pagesFetched < CONFIG.MAX_PAGES_PER_QUERY) {
      await new Promise((r) => setTimeout(r, 2000));
    } else {
      pageToken = null;
    }
  } while (pageToken);
  return collected;
}

async function runSearch() {
  const island = document.getElementById('islandInput').value.trim();
  if (!island) return;
  currentIsland = island;
  searchResults = {};
  document.getElementById('loading').style.display = 'block';
  document.getElementById('searchBtn').disabled = true;
  document.getElementById('searchGrid').innerHTML = '';
  document.getElementById('searchPushRow').style.display = 'none';

  try {
    const center = await geocodeIsland(island);
    const rectangle = center ? buildBoundingBox(center, CONFIG.ISLAND_BOX_PADDING_DEG) : null;
    const queries = [`guesthouses in ${island}, Maldives`, `hotels in ${island}, Maldives`, `resorts in ${island}, Maldives`];
    const seen = {};
    const results = [];
    for (const q of queries) {
      const places = await searchOnePagedQuery(q, rectangle);
      places.forEach((p) => {
        if (seen[p.id]) return;
        seen[p.id] = true;
        const addr = (p.formattedAddress || '').toLowerCase();
        if (rectangle && addr && !addr.includes(island.toLowerCase())) return;
        results.push({
          id: p.id, name: p.displayName ? p.displayName.text : '(unnamed)',
          rating: p.rating || 0, reviewCount: p.userRatingCount || 0,
          address: p.formattedAddress || '', website: p.websiteUri || '', phone: p.internationalPhoneNumber || '',
        });
      });
    }
    results.sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount);
    renderSearchGrid(results);
  } catch (err) {
    showStatus('Error: ' + (err.message || String(err)), true);
  } finally {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('searchBtn').disabled = false;
  }
}

function isRecommended(item) {
  return item.rating >= CONFIG.RECOMMENDED_MIN_RATING && item.reviewCount >= CONFIG.RECOMMENDED_MIN_REVIEWS;
}

function renderSearchGrid(results) {
  const grid = document.getElementById('searchGrid');
  if (!results.length) { grid.innerHTML = '<div class="hint">No properties found.</div>'; return; }
  grid.innerHTML = results.map((item) => {
    searchResults[item.id] = { data: item, selected: isRecommended(item) };
    return `
      <div class="card">
        <input type="checkbox" class="card-select" ${isRecommended(item) ? 'checked' : ''} onchange="toggleSearchSelect('${item.id}', this.checked)">
        <div class="card-name">${escapeHtml(item.name)}</div>
        <div class="card-meta">★ ${item.rating.toFixed(1)} (${item.reviewCount})</div>
        <div class="card-meta">${escapeHtml(item.address)}</div>
      </div>`;
  }).join('');
  document.getElementById('searchPushRow').style.display = 'flex';
  updateSelectedCount();
}

function toggleSearchSelect(id, checked) {
  searchResults[id].selected = checked;
  updateSelectedCount();
}
function updateSelectedCount() {
  const count = Object.values(searchResults).filter((i) => i.selected).length;
  document.getElementById('selectedCount').textContent = `${count} selected`;
}

async function pushSelectedToProperties() {
  const selected = Object.values(searchResults).filter((i) => i.selected).map((i) => ({
    name: i.data.name, island: currentIsland, address: i.data.address,
    phone: i.data.phone, website: i.data.website, rating: i.data.rating, status: 'prospect',
  }));
  if (!selected.length) { showStatus('Nothing selected.', true); return; }
  const { error } = await supabase.from('properties').insert(selected);
  if (error) { showStatus('Error: ' + error.message, true); return; }
  showStatus(`Added ${selected.length} propert${selected.length === 1 ? 'y' : 'ies'} to Properties.`);
  await loadProperties();
  renderPropertiesTable();
  populateBookingDropdowns();
}

// ---------- Helpers ----------

function val(id) { return document.getElementById(id).value.trim(); }

function showStatus(text, isError) {
  const el = document.createElement('div');
  el.className = 'status-line' + (isError ? ' err' : '');
  el.textContent = text;
  let container = document.getElementById('status');
  if (!container) {
    container = document.createElement('div');
    container.id = 'status';
    document.body.appendChild(container);
  }
  container.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

window.addEventListener('load', checkExistingSession);
