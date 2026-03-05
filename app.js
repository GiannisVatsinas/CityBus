// ═══════════════════════════════════════════════════
//  STATE & DATA
// ═══════════════════════════════════════════════════
const API_BASE_URL = "https://rldqhflxdvyzjcjhcole.supabase.co/functions/v1";
let MUNICIPALITIES_DATA = {};
let state = { screen: 'municipalities', municipalityId: null, lineKey: null, stopId: null };
let mapLayers = [];
let countdownInterval = null;
let mapVisible = false; // map is hidden by default


// ═══════════════════════════════════════════════════
//  MAP INIT
// ═══════════════════════════════════════════════════
const map = L.map('map', { zoomControl: false }).setView([37.935, 23.715], 13);
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© Carto © OpenStreetMap', maxZoom: 19,
}).addTo(map);
L.control.zoom({ position: 'topright' }).addTo(map);

const tooltipStyle = document.createElement('style');
tooltipStyle.textContent = `.leaflet-tooltip-custom{background:rgba(255,255,255,0.97);color:#111827;border:1px solid rgba(0,0,0,0.10);border-radius:8px;font-family:Inter,sans-serif;font-size:12px;padding:4px 10px;box-shadow:0 4px 16px rgba(0,0,0,0.12);}`;
document.head.appendChild(tooltipStyle);

// Start with map hidden
document.getElementById('app').classList.add('map-hidden');

setTimeout(() => map.invalidateSize(), 100);
window.addEventListener('resize', () => map.invalidateSize());


function clearMapLayers() {
    mapLayers.forEach(l => map.removeLayer(l));
    mapLayers = [];
}

function addToMap(layer) { layer.addTo(map); mapLayers.push(layer); }

// Show all municipality center markers on the home screen
function drawMunicipalitiesOverview() {
    clearMapLayers();
    Object.values(MUNICIPALITIES_DATA).forEach(mun => {
        if (!mun.center) return;
        const marker = L.circleMarker(mun.center, {
            radius: 9, color: '#fff', fillColor: '#3b7ef6', fillOpacity: 1, weight: 2.5
        }).addTo(map);
        marker.bindTooltip(`<b>${mun.name}</b>`, { className: 'leaflet-tooltip-custom', permanent: true, direction: 'top' });
        mapLayers.push(marker);
    });
    const coords = Object.values(MUNICIPALITIES_DATA).filter(m => m.center).map(m => m.center);
    if (coords.length > 0) map.fitBounds(L.latLngBounds(coords), { padding: [50, 50] });
}

// Draw all lines of a municipality faintly
function drawAllLinesFaint(municipalityId) {
    clearMapLayers();
    const mun = MUNICIPALITIES_DATA[municipalityId];
    if (!mun || !mun.lines) return;
    Object.values(mun.lines).forEach(line => {
        if (!line.stops || line.stops.length === 0) return;
        const coords = line.stops.map(s => s.coords);
        addToMap(L.polyline(coords, { color: line.color, weight: 2.5, opacity: 0.25, dashArray: '7,6' }));
        line.stops.forEach(s => {
            addToMap(L.circleMarker(s.coords, { radius: 4, color: '#fff', fillColor: line.color, fillOpacity: 0.45, weight: 1.5 }));
        });
    });
}

function drawLine(municipalityId, lineKey, selectedStopId = null) {
    clearMapLayers();
    const mun = MUNICIPALITIES_DATA[municipalityId];
    if (!mun || !mun.lines || !mun.lines[lineKey]) return;
    const line = mun.lines[lineKey];
    if (!line.stops || line.stops.length === 0) return;
    const coords = line.stops.map(s => s.coords);

    addToMap(L.polyline(coords, { color: line.color, weight: 12, opacity: 0.12 }));
    addToMap(L.polyline(coords, { color: line.color, weight: 4, opacity: 0.9 }));

    line.stops.forEach(s => {
        const isSelected = s.id === selectedStopId;
        const isTerminal = !!s.terminal;
        const r = isSelected ? 11 : (isTerminal ? 8 : 6);
        const marker = L.circleMarker(s.coords, {
            radius: r,
            color: '#fff', fillColor: isSelected ? '#fff' : line.color,
            fillOpacity: 1,
            weight: isSelected ? 3 : 2,
            zIndexOffset: isSelected ? 1000 : 0,
        }).addTo(map);
        marker.bindTooltip(`<b>${s.name}</b>`, { className: 'leaflet-tooltip-custom' });
        mapLayers.push(marker);

        if (isSelected) {
            const ring = L.circleMarker(s.coords, {
                radius: 18, color: line.color, fillColor: 'transparent', weight: 2, opacity: 0.5,
            }).addTo(map);
            mapLayers.push(ring);
        }
    });

    const bounds = L.latLngBounds(coords);
    const isMobile = window.innerWidth < 700;
    const pad = isMobile
        ? [40, parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sheet-mid') || '55') * window.innerHeight / 100 + 20]
        : [60, 60];
    map.fitBounds(bounds, { paddingTopLeft: [pad[0], pad[0]], paddingBottomRight: [pad[0], pad[1]] });
}

// ═══════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════
function minutesUntil(freq) {
    if (!freq) return 15; // Default if not provided
    const now = new Date();
    const rem = freq - (now.getMinutes() % freq);
    return rem === freq ? 0 : rem;
}

function buildSchedule(line, nowMins) {
    const startStr = line.hours?.start || "06:00";
    const endStr = line.hours?.end || "22:00";
    const freq = line.freq || 20;

    const [sh, sm] = startStr.split(':').map(Number);
    const [eh, em] = endStr.split(':').map(Number);
    const times = [];
    for (let t = sh * 60 + sm; t <= eh * 60 + em; t += freq) {
        times.push({ label: `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`, totalMin: t });
    }
    return times;
}

function hexToRgb(hex) {
    if (!hex || hex[0] !== '#') return "59,126,246";
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r},${g},${b}`;
}

// ═══════════════════════════════════════════════════
//  MAP TOGGLE
// ═══════════════════════════════════════════════════
function toggleMap() {
    mapVisible = !mapVisible;
    const app = document.getElementById('app');
    const btn = document.getElementById('mapToggleBtn');
    if (mapVisible) {
        app.classList.remove('map-hidden');
        btn.classList.add('active');
        btn.title = 'Απόκρυψη χάρτη';
        setTimeout(() => {
            map.invalidateSize();
            // Re-render map layers after map becomes visible
            const { screen, municipalityId, lineKey, stopId } = state;
            if (screen === 'municipalities') drawMunicipalitiesOverview();
            else if (screen === 'lines') drawAllLinesFaint(municipalityId);
            else if (screen === 'stops') drawLine(municipalityId, lineKey);
            else if (screen === 'arrival') drawLine(municipalityId, lineKey, stopId);
            setSheetState('mid');
        }, 50);
    } else {
        app.classList.add('map-hidden');
        btn.classList.remove('active');
        btn.title = 'Εμφάνιση χάρτη';
        // Let sheet fill the screen
        const sheet = document.getElementById('sheet');
        sheet.classList.remove('peek', 'expanded');
    }
}

document.getElementById('mapToggleBtn').addEventListener('click', toggleMap);

// ═══════════════════════════════════════════════════
//  NAVIGATION
// ═══════════════════════════════════════════════════
async function navigate(screen, municipalityId = state.municipalityId, lineKey = state.lineKey, stopId = state.stopId) {
    state = { screen, municipalityId, lineKey, stopId };
    if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
    
    // Data fetching for specific screens
    if (screen === 'lines' && municipalityId && (!MUNICIPALITIES_DATA[municipalityId].lines || Object.keys(MUNICIPALITIES_DATA[municipalityId].lines).length === 0)) {
        await fetchLines(municipalityId);
    } else if ((screen === 'stops' || screen === 'arrival') && municipalityId && lineKey) {
        const line = MUNICIPALITIES_DATA[municipalityId].lines[lineKey];
        if (!line.stops || line.stops.length === 0) {
            await fetchRouteDetails(municipalityId, lineKey, line.id);
        }
    }
    
    render();
}


function render() {
    const { screen, municipalityId, lineKey, stopId } = state;
    const backBtn = document.getElementById('backBtn');
    const title = document.getElementById('sheetTitle');
    const sub = document.getElementById('sheetSub');
    const body = document.getElementById('sheetBody');
    const fab = document.getElementById('mapFab');

    if (screen === 'municipalities') {
        backBtn.classList.add('hidden');
        title.textContent = 'Επίλεξε Δήμο';
        sub.textContent = 'Δημοτική Συγκοινωνία';
        title.style.color = '';
        drawMunicipalitiesOverview();
        fab.style.display = 'none';
        body.innerHTML = buildMunicipalitiesScreen();

    } else if (screen === 'lines') {
        const mun = MUNICIPALITIES_DATA[municipalityId];
        backBtn.classList.remove('hidden');
        title.textContent = 'Επίλεξε Γραμμή';
        sub.textContent = mun.name;
        title.style.color = '';
        drawAllLinesFaint(municipalityId);
        renderLinesFab(municipalityId);
        body.innerHTML = buildLinesScreen(municipalityId);
        if (mun.center) map.flyTo(mun.center, 14, { animate: true, duration: 1.5 });

    } else if (screen === 'stops') {
        const mun = MUNICIPALITIES_DATA[municipalityId];
        const line = mun.lines[lineKey];
        backBtn.classList.remove('hidden');
        title.textContent = line.name;
        sub.textContent = mun.name;
        title.style.color = line.color;
        drawLine(municipalityId, lineKey);
        renderStopsFab(municipalityId, lineKey);
        body.innerHTML = buildStopsScreen(municipalityId, lineKey);

    } else if (screen === 'arrival') {
        const mun = MUNICIPALITIES_DATA[municipalityId];
        const line = mun.lines[lineKey];
        const stop = line.stops.find(s => s.id === stopId);
        backBtn.classList.remove('hidden');
        title.textContent = stop.name;
        sub.textContent = line.name;
        title.style.color = line.color;
        drawLine(municipalityId, lineKey, stopId);
        fab.style.display = 'none';
        body.innerHTML = buildArrivalScreen(municipalityId, lineKey, stopId);
        startCountdown(municipalityId, lineKey);
        map.panTo(stop.coords, { animate: true });
    }

    setSheetState(mapVisible ? 'mid' : 'full');
}


// ─────────────── MUNICIPALITIES SCREEN ───────────────
function buildMunicipalitiesScreen() {
    let html = `<div class="section-label">Διαθέσιμοι Δήμοι</div>`;
    Object.values(MUNICIPALITIES_DATA).forEach(mun => {
        const linesCount = mun.totalRoutes || 0;
        html += `
          <div class="line-card" style="--lc:#3b7ef6" onclick="navigate('lines', '${mun.id}')">
            <div class="line-badge" style="background:rgba(59,126,246,0.12);color:#3b7ef6">🏛</div>
            <div class="line-info">
              <div class="line-name">${mun.name}</div>
              <div class="line-tag">${mun.region || 'Δημοτική Συγκοινωνία'}</div>
            </div>
            <div class="line-meta">
              <div class="line-freq">${linesCount}</div>
              <div class="line-freq-lbl">γραμμές</div>
            </div>
            <div class="chevron">›</div>
          </div>`;
    });
    return html;
}

// ─────────────── LINES SCREEN ───────────────
function buildLinesScreen(municipalityId) {
    let html = `<div class="section-label">Διαθέσιμες Γραμμές</div>`;
    const lines = MUNICIPALITIES_DATA[municipalityId].lines || {};
    Object.entries(lines).forEach(([key, line]) => {
        const nextBus = minutesUntil(line.freq);
        const rgb = hexToRgb(line.color);
        const routeTag = (line.stops && line.stops.length > 1) 
            ? `${line.stops[0].name} → ${line.stops[line.stops.length - 1].name}`
            : (line.status === 'active' ? 'Ενεργή Γραμμή' : 'Μη διαθέσιμη');

        html += `
          <div class="line-card" style="--lc:${line.color}" onclick="navigate('stops', '${municipalityId}', '${key}')">
            <div class="line-badge" style="background:rgba(${rgb},0.15);color:${line.color}">${line.code || key}</div>
            <div class="line-info">
              <div class="line-name">${line.name}</div>
              <div class="line-tag">${routeTag}</div>
            </div>
            <div class="line-meta">
              <div class="line-freq">${nextBus === 0 ? 'Τώρα' : nextBus + ' λεπτά'}</div>
              <div class="line-freq-lbl">επόμενο</div>
              <div class="line-stops-count">${line.stops?.length || 0} στάσεις</div>
            </div>
            <div class="chevron">›</div>
          </div>`;
    });
    return html;
}

function renderLinesFab(municipalityId) {
    const fab = document.getElementById('mapFab');
    const items = document.getElementById('fabItems');
    document.getElementById('fabTitle').textContent = 'Γραμμές';
    fab.style.display = 'block';
    const lines = MUNICIPALITIES_DATA[municipalityId].lines || {};
    items.innerHTML = Object.entries(lines).map(([key, l]) =>
        `<div class="fab-item">
          <div class="fab-dot" style="background:${l.color}"></div>
          <div class="fab-label">${l.code || key}</div>
        </div>`
    ).join('');
}

// ─────────────── STOPS SCREEN ───────────────
function buildStopsScreen(municipalityId, lineKey) {
    const line = MUNICIPALITIES_DATA[municipalityId].lines[lineKey];
    const nextBus = minutesUntil(line.freq);
    let html = `
        <div class="section-label" style="color:${line.color}">Στάσεις • ${line.stops?.length || 0} συνολικά</div>
        <div class="stop-list" style="--lc:${line.color}">`;
    
    if (line.stops) {
        line.stops.forEach((s, i) => {
            const isFirst = i === 0;
            const isLast = i === line.stops.length - 1;
            const badge = isFirst ? `<span class="stop-badge start">Αφετηρία</span>`
                : isLast ? `<span class="stop-badge end">Τέρμα</span>` : '';
            html += `
              <div class="stop-row ${isFirst || isLast ? 'terminal' : ''}" onclick="navigate('arrival', '${municipalityId}', '${lineKey}', '${s.id}')">
                <div class="stop-dot-wrap"><div class="stop-dot"></div></div>
                <div class="stop-info">
                  <div class="stop-name">${s.name}</div>
                  <div class="stop-sub">Επόμενο σε ${nextBus === 0 ? '<b style="color:var(--green)">Τώρα!</b>' : `<b>${nextBus} λεπτά</b>`}</div>
                </div>
                ${badge}
                <div class="stop-chevron">›</div>
              </div>`;
        });
    }
    html += `</div>`;
    return html;
}

function renderStopsFab(municipalityId, lineKey) {
    const line = MUNICIPALITIES_DATA[municipalityId].lines[lineKey];
    const fab = document.getElementById('mapFab');
    const items = document.getElementById('fabItems');
    document.getElementById('fabTitle').textContent = line.name;
    fab.style.display = 'block';
    if (line.stops) {
        items.innerHTML = line.stops.map(s =>
            `<div class="fab-item">
              <div class="fab-dot" style="background:${line.color}"></div>
              <div class="fab-label">${s.name}</div>
            </div>`
        ).join('');
    }
}

// ─────────────── ARRIVAL SCREEN ───────────────
function buildArrivalScreen(municipalityId, lineKey, stopId) {
    const line = MUNICIPALITIES_DATA[municipalityId].lines[lineKey];
    const stop = line.stops.find(s => s.id === stopId);
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const times = buildSchedule(line, nowMins);
    const nextBus = minutesUntil(line.freq);

    const arrivalHTML = nextBus === 0
        ? `<div class="arrival-now"><div class="pulse-dot"></div> Φτάνει τώρα!</div>`
        : `<div class="arrival-countdown">
            <div class="countdown-num" id="cdNum">${nextBus}</div>
            <div class="countdown-unit">λεπτά</div>
           </div>
           <div class="arrival-label" id="cdLabel">μέχρι το επόμενο λεωφορείο</div>`;

    const nextThree = [];
    let m = minutesUntil(line.freq);
    for (let i = 0; i < 3; i++) {
        const t = new Date(now.getTime() + (m + i * (line.freq || 20)) * 60000);
        nextThree.push(t.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' }));
    }

    const nextBusesHTML = nextThree.map((t, i) => `
        <div class="next-bus-chip" style="${i === 0 ? 'border-color:rgba(59,126,246,0.4);' : ''}">
          <div class="chip-time" style="${i === 0 ? 'color:var(--accent)' : ''}">${t}</div>
          <div class="chip-lbl">${i === 0 ? 'Επόμενο' : i === 1 ? '2ο' : '3ο'}</div>
        </div>`).join('');

    const chipsHTML = times.map(t => {
        const isPast = t.totalMin < nowMins;
        const isNext = !isPast && t.totalMin >= nowMins && t.totalMin < nowMins + (line.freq || 20);
        return `<div class="sched-chip ${isPast ? 'past' : isNext ? 'next' : ''}">${t.label}</div>`;
    }).join('');

    const startH = line.hours?.start || "06:00";
    const endH = line.hours?.end || "22:00";

    return `
        <div class="stop-info-card" style="--lc:${line.color}">
          <div class="stop-info-icon">🚏</div>
          <div class="stop-info-text">
            <h4>${stop.name}</h4>
            <p>${line.name} · Συχνότητα ανά ${line.freq || 20} λεπτά</p>
          </div>
        </div>
        <div class="arrival-card" style="--lc:${line.color}">
          ${arrivalHTML}
          <div class="next-buses">${nextBusesHTML}</div>
        </div>
        <div class="schedule-title">Δρομολόγια σήμερα (${startH} – ${endH})</div>
        <div class="schedule-grid">${chipsHTML}</div>`;
}

function startCountdown(municipalityId, lineKey) {
    const line = MUNICIPALITIES_DATA[municipalityId].lines[lineKey];
    countdownInterval = setInterval(() => {
        const mins = minutesUntil(line.freq);
        const numEl = document.getElementById('cdNum');
        const lblEl = document.getElementById('cdLabel');
        if (!numEl) { clearInterval(countdownInterval); return; }
        numEl.textContent = mins;
        if (mins === 0 && lblEl) lblEl.textContent = 'Φτάνει τώρα!';
    }, 30000);
}

// ═══════════════════════════════════════════════════
//  BOTTOM SHEET DRAG
// ═══════════════════════════════════════════════════
(function () {
    const sheet = document.getElementById('sheet');
    const zone = document.getElementById('dragZone');
    const PEEK = 88;

    function isMobile() { return window.innerWidth < 700; }

    window.setSheetState = function (s) {
        if (!isMobile()) return;
        sheet.classList.remove('peek', 'expanded');
        if (s === 'peek') sheet.classList.add('peek');
        if (s === 'expanded') sheet.classList.add('expanded');
        // 'mid' and 'full' both remove classes; 'full' just means map is hidden (handled by CSS)
        setTimeout(() => map.invalidateSize(), 380);
    };


    let sy = 0, sh0 = 0, dragging = false;

    function start(y) { if (!isMobile()) return; dragging = true; sy = y; sh0 = sheet.getBoundingClientRect().height; sheet.style.transition = 'none'; }
    function move(y) { if (!dragging || !isMobile()) return; sheet.style.height = Math.min(window.innerHeight * 0.93, Math.max(PEEK, sh0 + (sy - y))) + 'px'; }
    function end(y) {
        if (!dragging || !isMobile()) return;
        dragging = false; sheet.style.transition = '';
        const dy = sy - y, midH = window.innerHeight * 0.55;
        if (dy > 80) setSheetState('expanded');
        else if (dy < -80) setSheetState('peek');
        else {
            const h = sheet.getBoundingClientRect().height;
            if (h < midH * 0.5) setSheetState('peek');
            else if (h > midH * 1.3) setSheetState('expanded');
            else setSheetState('mid');
        }
        sheet.style.height = '';
    }

    zone.addEventListener('touchstart', e => start(e.touches[0].clientY), { passive: true });
    window.addEventListener('touchmove', e => move(e.touches[0].clientY), { passive: true });
    window.addEventListener('touchend', e => end(e.changedTouches[0].clientY));
    zone.addEventListener('mousedown', e => { start(e.clientY); e.preventDefault(); });
    window.addEventListener('mousemove', e => { if (dragging) move(e.clientY); });
    window.addEventListener('mouseup', e => { if (dragging) end(e.clientY); });
    zone.addEventListener('click', () => {
        if (!isMobile()) return;
        setSheetState(sheet.classList.contains('peek') ? 'mid' : 'peek');
        sheet.style.height = '';
    });
})();

// ═══════════════════════════════════════════════════
//  BACK BUTTON
// ═══════════════════════════════════════════════════
document.getElementById('backBtn').addEventListener('click', () => {
    if (state.screen === 'arrival') navigate('stops', state.municipalityId, state.lineKey);
    else if (state.screen === 'stops') navigate('lines', state.municipalityId);
    else if (state.screen === 'lines') navigate('municipalities');
});

// ═══════════════════════════════════════════════════
//  API CALLS
// ═══════════════════════════════════════════════════

async function fetchMunicipalities() {
    try {
        const response = await fetch(`${API_BASE_URL}/transport-api`);
        const data = await response.json();
        
        // Convert API format to app format
        const formatted = {};
        data.municipalities.forEach(m => {
            formatted[m.id] = {
                id: m.id,
                name: m.municipality,
                region: m.region,
                totalRoutes: m.totalRoutes,
                // Center will be updated when we get lines or use a default
                center: m.id === 'athens' ? [37.9838, 23.7275] : [37.935, 23.715], 
                lines: {}
            };
        });
        MUNICIPALITIES_DATA = formatted;
    } catch (e) {
        console.error('Error fetching municipalities:', e);
        throw e;
    }
}

async function fetchLines(municipalityId) {
    try {
        const response = await fetch(`${API_BASE_URL}/transport-api?municipality=${municipalityId}`);
        const data = await response.json();
        
        const mun = MUNICIPALITIES_DATA[municipalityId];
        mun.lines = {};
        
        data.routes.forEach(r => {
            // Using r.id as key for state, but keeping code for display
            mun.lines[r.id] = {
                id: r.id,
                code: r.code,
                name: r.name,
                color: r.status === 'delayed' ? '#ef4444' : '#3b7ef6', // API doesn't provide color
                freq: r.frequency_minutes || 20,
                status: r.status,
                hours: { start: "06:00", end: "22:00" }, // API doesn't provide hours
                stops: []
            };
        });
    } catch (e) {
        console.error(`Error fetching lines for ${municipalityId}:`, e);
    }
}

async function fetchRouteDetails(municipalityId, lineKey, routeId) {
    try {
        const response = await fetch(`${API_BASE_URL}/transport-api?route=${routeId}`);
        const data = await response.json();
        
        const line = MUNICIPALITIES_DATA[municipalityId].lines[lineKey];
        line.stops = data.stops.map(s => ({
            id: s.id,
            name: s.name,
            coords: [s.latitude, s.longitude],
            terminal: s.is_terminal
        }));
        
        // Update municipality center based on first stop if not already set meaningfully
        if (line.stops.length > 0) {
            MUNICIPALITIES_DATA[municipalityId].center = line.stops[0].coords;
        }
    } catch (e) {
        console.error(`Error fetching route details for ${routeId}:`, e);
    }
}

// ═══════════════════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════════════════
async function init() {
    try {
        await fetchMunicipalities();
        navigate('municipalities');
    } catch (e) {
        console.error('Σφάλμα φόρτωσης δεδομένων:', e);
        document.getElementById('sheetBody').innerHTML =
            `<p style="color:red;padding:20px;">Σφάλμα σύνδεσης με το API. Παρακαλώ δοκιμάστε αργότερα.</p>`;
    }
}

init();
