// ═══════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════
let state = { screen: 'lines', lineKey: null, stopId: null };
let mapLayers = [];
let countdownInterval = null;

// ═══════════════════════════════════════════════════
//  MAP INIT
// ═══════════════════════════════════════════════════
const map = L.map('map', { zoomControl: false }).setView([37.9750, 23.7350], 13);
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© Carto © OpenStreetMap', maxZoom: 19,
}).addTo(map);
L.control.zoom({ position: 'topright' }).addTo(map);

const tooltipStyle = document.createElement('style');
tooltipStyle.textContent = `.leaflet-tooltip-custom{background:rgba(255,255,255,0.97);color:#111827;border:1px solid rgba(0,0,0,0.10);border-radius:8px;font-family:Inter,sans-serif;font-size:12px;padding:4px 10px;box-shadow:0 4px 16px rgba(0,0,0,0.12);}`;
document.head.appendChild(tooltipStyle);

setTimeout(() => map.invalidateSize(), 100);
window.addEventListener('resize', () => map.invalidateSize());

function clearMapLayers() {
    mapLayers.forEach(l => map.removeLayer(l));
    mapLayers = [];
}

function addToMap(layer) { layer.addTo(map); mapLayers.push(layer); }

// Draw all lines faintly on home screen
function drawAllLinesFaint() {
    clearMapLayers();
    Object.entries(LINES).forEach(([, line]) => {
        const coords = line.stops.map(s => s.coords);
        addToMap(L.polyline(coords, { color: line.color, weight: 2.5, opacity: 0.2, dashArray: '7,6' }));
        line.stops.forEach(s => {
            addToMap(L.circleMarker(s.coords, { radius: 4, color: '#fff', fillColor: line.color, fillOpacity: 0.4, weight: 1.5 }));
        });
    });
}

function drawLine(lineKey, selectedStopId = null) {
    clearMapLayers();
    const line = LINES[lineKey];
    const coords = line.stops.map(s => s.coords);

    // Glow + solid polyline
    addToMap(L.polyline(coords, { color: line.color, weight: 12, opacity: 0.12 }));
    addToMap(L.polyline(coords, { color: line.color, weight: 4, opacity: 0.9 }));

    // Stop markers
    line.stops.forEach(s => {
        const isSelected = s.id === selectedStopId;
        const isTerminal = !!s.terminal;
        const r = isSelected ? 11 : (isTerminal ? 8 : 6);
        const marker = L.circleMarker(s.coords, {
            radius: r,
            color: '#fff', fillColor: isSelected ? '#fff' : line.color,
            fillOpacity: isSelected ? 1 : 1,
            weight: isSelected ? 3 : 2,
            zIndexOffset: isSelected ? 1000 : 0,
        }).addTo(map);
        marker.bindTooltip(`<b>${s.name}</b>`, { className: 'leaflet-tooltip-custom' });
        mapLayers.push(marker);

        if (isSelected) {
            // Pulsing ring
            const ring = L.circleMarker(s.coords, {
                radius: 18, color: line.color, fillColor: 'transparent',
                weight: 2, opacity: 0.5,
            }).addTo(map);
            mapLayers.push(ring);
        }
    });

    // Fit bounds
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
    const now = new Date();
    const mins = now.getMinutes();
    const rem = freq - (mins % freq);
    return rem === freq ? 0 : rem;
}

function buildSchedule(line, nowMins) {
    const [sh, sm] = line.hours.start.split(':').map(Number);
    const [eh, em] = line.hours.end.split(':').map(Number);
    const startM = sh * 60 + sm;
    const endM = eh * 60 + em;
    const times = [];
    for (let t = startM; t <= endM; t += line.freq) {
        const h = String(Math.floor(t / 60)).padStart(2, '0');
        const m = String(t % 60).padStart(2, '0');
        times.push({ label: `${h}:${m}`, totalMin: t });
    }
    return times;
}

function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r},${g},${b}`;
}

// ═══════════════════════════════════════════════════
//  NAVIGATION
// ═══════════════════════════════════════════════════
function navigate(screen, lineKey = null, stopId = null) {
    state = { screen, lineKey, stopId };
    if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
    render();
}

function render() {
    const { screen, lineKey, stopId } = state;
    const backBtn = document.getElementById('backBtn');
    const title = document.getElementById('sheetTitle');
    const sub = document.getElementById('sheetSub');
    const body = document.getElementById('sheetBody');
    const fab = document.getElementById('mapFab');

    if (screen === 'lines') {
        backBtn.classList.add('hidden');
        title.textContent = 'Επίλεξε Γραμμή';
        sub.textContent = 'Δημοτική Συγκοινωνία';
        drawAllLinesFaint();
        renderLinesFab();
        body.innerHTML = buildLinesScreen();
    } else if (screen === 'stops') {
        const line = LINES[lineKey];
        backBtn.classList.remove('hidden');
        title.textContent = line.name;
        sub.textContent = line.tag;
        title.style.color = line.color;
        drawLine(lineKey);
        renderStopsFab(lineKey);
        body.innerHTML = buildStopsScreen(lineKey);
    } else if (screen === 'arrival') {
        const line = LINES[lineKey];
        const stop = line.stops.find(s => s.id === stopId);
        backBtn.classList.remove('hidden');
        title.textContent = stop.name;
        sub.textContent = line.name;
        title.style.color = line.color;
        drawLine(lineKey, stopId);
        fab.style.display = 'none';
        body.innerHTML = buildArrivalScreen(lineKey, stopId);
        startCountdown(lineKey, stopId);

        // Pan to selected stop
        if (window.innerWidth < 700) {
            const h = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sheet-mid') || '55') * window.innerHeight / 100;
            map.panTo(stop.coords, { animate: true });
        } else {
            map.panTo(stop.coords, { animate: true });
        }
    }

    setSheetState('mid');
}

// ─────────────── LINES SCREEN ───────────────
function buildLinesScreen() {
    let html = `<div class="section-label">Διαθέσιμες Γραμμές</div>`;
    Object.entries(LINES).forEach(([key, line]) => {
        const nextBus = minutesUntil(line.freq);
        const rgb = hexToRgb(line.color);
        html += `
          <div class="line-card" style="--lc:${line.color}" onclick="navigate('stops','${key}')">
            <div class="line-badge" style="background:rgba(${rgb},0.15);color:${line.color}">${key}</div>
            <div class="line-info">
              <div class="line-name">${line.name}</div>
              <div class="line-tag">${line.tag}</div>
            </div>
            <div class="line-meta">
              <div class="line-freq">${nextBus === 0 ? 'Τώρα' : nextBus + ' λεπτά'}</div>
              <div class="line-freq-lbl">επόμενο</div>
              <div class="line-stops-count">${line.stops.length} στάσεις</div>
            </div>
            <div class="chevron">›</div>
          </div>`;
    });
    return html;
}

function renderLinesFab() {
    const fab = document.getElementById('mapFab');
    const items = document.getElementById('fabItems');
    document.getElementById('fabTitle').textContent = 'Γραμμές';
    fab.style.display = 'block';
    items.innerHTML = Object.entries(LINES).map(([key, l]) =>
        `<div class="fab-item">
          <div class="fab-dot" style="background:${l.color}"></div>
          <div class="fab-label">${key} – ${l.tag.split('→')[0].trim()}</div>
        </div>`
    ).join('');
}

// ─────────────── STOPS SCREEN ───────────────
function buildStopsScreen(lineKey) {
    const line = LINES[lineKey];
    const nextBus = minutesUntil(line.freq);
    let html = `
        <div class="section-label" style="color:${line.color}">Στάσεις • ${line.stops.length} συνολικά</div>
        <div class="stop-list" style="--lc:${line.color}">`;
    line.stops.forEach((s, i) => {
        const isFirst = i === 0;
        const isLast = i === line.stops.length - 1;
        const badge = isFirst ? `<span class="stop-badge start">Αφετηρία</span>`
            : isLast ? `<span class="stop-badge end">Τέρμα</span>`
                : '';
        html += `
          <div class="stop-row ${s.terminal ? 'terminal' : ''}" onclick="navigate('arrival','${lineKey}','${s.id}')">
            <div class="stop-dot-wrap"><div class="stop-dot"></div></div>
            <div class="stop-info">
              <div class="stop-name">${s.name}</div>
              <div class="stop-sub">Επόμενο σε ${nextBus === 0 ? '<b style="color:var(--green)">Τώρα!</b>' : `<b>${nextBus} λεπτά</b>`}</div>
            </div>
            ${badge}
            <div class="stop-chevron">›</div>
          </div>`;
    });
    html += `</div>`;
    return html;
}

function renderStopsFab(lineKey) {
    const line = LINES[lineKey];
    const fab = document.getElementById('mapFab');
    const items = document.getElementById('fabItems');
    document.getElementById('fabTitle').textContent = line.name;
    fab.style.display = 'block';
    items.innerHTML = line.stops.map(s =>
        `<div class="fab-item">
          <div class="fab-dot" style="background:${line.color}"></div>
          <div class="fab-label">${s.name}</div>
        </div>`
    ).join('');
}

// ─────────────── ARRIVAL SCREEN ───────────────
function buildArrivalScreen(lineKey, stopId) {
    const line = LINES[lineKey];
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

    // next 3 arrivals
    const nextThree = [];
    let m = minutesUntil(line.freq);
    for (let i = 0; i < 3; i++) {
        const arrivalTime = new Date(now.getTime() + (m + i * line.freq) * 60000);
        nextThree.push(arrivalTime.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' }));
    }

    const nextBusesHTML = nextThree.map((t, i) => `
        <div class="next-bus-chip" style="${i === 0 ? 'border-color:rgba(59, 126, 246, 0.4);' : ''}">
          <div class="chip-time" style="${i === 0 ? 'color:var(--accent)' : ''}">${t}</div>
          <div class="chip-lbl">${i === 0 ? 'Επόμενο' : i === 1 ? '2ο' : '3ο'}</div>
        </div>`).join('');

    // Schedule chips
    const chipsHTML = times.map(t => {
        const isPast = t.totalMin < nowMins;
        const isNext = !isPast && t.totalMin >= nowMins && t.totalMin < nowMins + line.freq;
        return `<div class="sched-chip ${isPast ? 'past' : isNext ? 'next' : ''}">${t.label}</div>`;
    }).join('');

    return `
        <div class="stop-info-card" style="--lc:${line.color}">
          <div class="stop-info-icon">🚏</div>
          <div class="stop-info-text">
            <h4>${stop.name}</h4>
            <p>${line.name} · Συχνότητα ανά ${line.freq} λεπτά</p>
          </div>
        </div>

        <div class="arrival-card" style="--lc:${line.color}">
          ${arrivalHTML}
          <div class="next-buses">${nextBusesHTML}</div>
        </div>

        <div class="schedule-title">Δρομολόγια σήμερα (${line.hours.start} – ${line.hours.end})</div>
        <div class="schedule-grid">${chipsHTML}</div>
      `;
}

function startCountdown(lineKey, stopId) {
    const line = LINES[lineKey];
    const update = () => {
        const mins = minutesUntil(line.freq);
        const numEl = document.getElementById('cdNum');
        const lblEl = document.getElementById('cdLabel');
        if (!numEl) { clearInterval(countdownInterval); return; }
        if (mins === 0) {
            numEl.textContent = '0';
            if (lblEl) lblEl.textContent = 'Φτάνει τώρα!';
        } else {
            numEl.textContent = mins;
        }
    };
    countdownInterval = setInterval(update, 30000);
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
        setTimeout(() => map.invalidateSize(), 380);
    };

    let sy = 0, sh0 = 0, dragging = false;

    function start(y) {
        if (!isMobile()) return;
        dragging = true; sy = y;
        sh0 = sheet.getBoundingClientRect().height;
        sheet.style.transition = 'none';
    }

    function move(y) {
        if (!dragging || !isMobile()) return;
        const newH = Math.min(window.innerHeight * 0.93, Math.max(PEEK, sh0 + (sy - y)));
        sheet.style.height = newH + 'px';
    }

    function end(y) {
        if (!dragging || !isMobile()) return;
        dragging = false;
        sheet.style.transition = '';
        const dy = sy - y;
        const midH = window.innerHeight * 0.55;
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

    // Tap handle → toggle peek ↔ mid
    zone.addEventListener('click', () => {
        if (!isMobile()) return;
        const cur = sheet.classList.contains('peek') ? 'peek' : 'mid';
        setSheetState(cur === 'peek' ? 'mid' : 'peek');
        sheet.style.height = '';
    });
})();

// ═══════════════════════════════════════════════════
//  BACK BUTTON
// ═══════════════════════════════════════════════════
document.getElementById('backBtn').addEventListener('click', () => {
    if (state.screen === 'arrival') navigate('stops', state.lineKey);
    else if (state.screen === 'stops') navigate('lines');
});

// ═══════════════════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════════════════
document.getElementById('sheetTitle').style.color = '';
navigate('lines');
