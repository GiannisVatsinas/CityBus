// ═══════════════════════════════════════════════════
//  STATE & DATA
// ═══════════════════════════════════════════════════
const API_BASE_URL = "https://rldqhflxdvyzjcjhcole.supabase.co/functions/v1";
let MUNICIPALITIES_DATA = {};
let state = { screen: 'municipalities', municipalityId: null, lineKey: null, stopId: null, history: [] };
let mapLayers = [];
let busMarkerLayers = []; // separate layer group for live bus markers
let countdownInterval = null;
let busRefreshInterval = null; // interval for live bus position refresh
let mapVisible = false; // map is hidden by default


let favoriteMuns = JSON.parse(localStorage.getItem('favoriteMuns') || '[]');
let favoriteLines = JSON.parse(localStorage.getItem('favoriteLines') || '[]');
let favoriteStops = JSON.parse(localStorage.getItem('favoriteStops') || '[]');

// ═══════════════════════════════════════════════════
//  AUTH MODULE
// ═══════════════════════════════════════════════════
let currentUser = null; // { email } | null

/** Check auth state on page load via GET /api/me */
async function checkAuthState() {
    try {
        const res = await fetch('/api/me', { credentials: 'same-origin' });
        if (res.ok) {
            const data = await res.json();
            currentUser = { email: data.email };
        } else {
            currentUser = null;
        }
    } catch {
        currentUser = null;
    }
    updateAuthUI();
}

/** Update the profile button to reflect login state */
function updateAuthUI() {
    const btn = document.getElementById('profileBtn');
    if (!btn) return;
    if (currentUser) {
        const initial = currentUser.email.charAt(0).toUpperCase();
        btn.textContent = initial;
        btn.classList.add('logged-in');
        btn.setAttribute('aria-label', 'Προφίλ / Αποσύνδεση');
    } else {
        btn.textContent = '👤';
        btn.classList.remove('logged-in');
        btn.setAttribute('aria-label', 'Σύνδεση / Λογαριασμός');
    }
}

/** Handle click on profile button */
window.handleProfileBtnClick = function () {
    if (currentUser) {
        openAuthModal('profile');
    } else {
        openAuthModal('login');
    }
};

/** Show the auth modal on a specific panel */
function openAuthModal(panel) {
    showPanel(panel);
    document.getElementById('authModal').classList.add('visible');
}

/** Close the auth modal */
window.closeAuthModal = function () {
    document.getElementById('authModal').classList.remove('visible');
};

/** Close modal when clicking backdrop */
document.getElementById('authModal').addEventListener('click', function (e) {
    if (e.target === this) closeAuthModal();
});

/** Switch visible panel inside the modal */
window.showPanel = function (name) {
    ['login', 'register', 'forgot', 'reset', 'profile'].forEach(p => {
        const el = document.getElementById('panel' + p.charAt(0).toUpperCase() + p.slice(1));
        if (el) el.classList.toggle('hidden', p !== name);
    });
    // Populate profile panel if needed
    if (name === 'profile' && currentUser) {
        document.getElementById('profileEmail').textContent = currentUser.email;
        document.getElementById('profileAvatar').textContent = currentUser.email.charAt(0).toUpperCase();
    }
};

/** Helper to set loading state on a submit button */
function setSubmitLoading(btnId, loading, originalText) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = loading;
    btn.textContent = loading ? 'Φορτώνει...' : originalText;
}

/** POST /api/register */
window.doRegister = async function (e) {
    e.preventDefault();
    const email    = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const confirm  = document.getElementById('regConfirm').value;
    const errorEl  = document.getElementById('registerError');
    errorEl.textContent = '';

    if (password !== confirm) {
        errorEl.textContent = 'Οι κωδικοί δεν ταιριάζουν.';
        return;
    }
    setSubmitLoading('registerSubmitBtn', true, 'Εγγραφή');
    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) { errorEl.textContent = data.error || 'Σφάλμα εγγραφής.'; return; }
        currentUser = { email: data.email };
        updateAuthUI();
        closeAuthModal();
    } catch {
        errorEl.textContent = 'Σφάλμα σύνδεσης. Δοκιμάστε ξανά.';
    } finally {
        setSubmitLoading('registerSubmitBtn', false, 'Εγγραφή');
    }
};

/** POST /api/login */
window.doLogin = async function (e) {
    e.preventDefault();
    const email    = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorEl  = document.getElementById('loginError');
    errorEl.textContent = '';

    setSubmitLoading('loginSubmitBtn', true, 'Σύνδεση');
    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) { errorEl.textContent = data.error || 'Invalid credentials'; return; }
        currentUser = { email: data.email };
        updateAuthUI();
        closeAuthModal();
    } catch {
        errorEl.textContent = 'Σφάλμα σύνδεσης. Δοκιμάστε ξανά.';
    } finally {
        setSubmitLoading('loginSubmitBtn', false, 'Σύνδεση');
    }
};

/** POST /api/logout */
window.doLogout = async function () {
    try {
        await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' });
    } catch { /* ignore */ }
    currentUser = null;
    updateAuthUI();
    closeAuthModal();
};

/** POST /api/forgot-password */
window.doForgotPassword = async function (e) {
    e.preventDefault();
    const email   = document.getElementById('forgotEmail').value.trim();
    const errorEl = document.getElementById('forgotError');
    const successEl = document.getElementById('forgotSuccess');
    errorEl.textContent = '';
    successEl.textContent = '';

    setSubmitLoading('forgotSubmitBtn', true, 'Αποστολή συνδέσμου');
    try {
        const res = await fetch('/api/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ email }),
        });
        const data = await res.json();
        if (!res.ok) { errorEl.textContent = data.error || 'Σφάλμα.'; return; }
        successEl.textContent = data.message || 'Αν το email υπάρχει, θα σταλεί σύνδεσμος επαναφοράς.';
    } catch {
        errorEl.textContent = 'Σφάλμα σύνδεσης. Δοκιμάστε ξανά.';
    } finally {
        setSubmitLoading('forgotSubmitBtn', false, 'Αποστολή συνδέσμου');
    }
};

/** POST /api/reset-password */
window.doResetPassword = async function (e) {
    e.preventDefault();
    const params   = new URLSearchParams(window.location.search);
    const token    = params.get('reset_token');
    const email    = params.get('email');
    const password = document.getElementById('resetPassword').value;
    const confirm  = document.getElementById('resetConfirm').value;
    const errorEl  = document.getElementById('resetError');
    const successEl = document.getElementById('resetSuccess');
    errorEl.textContent = '';
    successEl.textContent = '';

    if (password !== confirm) { errorEl.textContent = 'Οι κωδικοί δεν ταιριάζουν.'; return; }

    setSubmitLoading('resetSubmitBtn', true, 'Αλλαγή κωδικού');
    try {
        const res = await fetch('/api/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ email, token, password }),
        });
        const data = await res.json();
        if (!res.ok) { errorEl.textContent = data.error || 'Σφάλμα.'; return; }
        successEl.textContent = data.message || 'Ο κωδικός άλλαξε επιτυχώς!';
        // Clear the token from the URL without reload
        window.history.replaceState({}, '', '/');
        setTimeout(() => { closeAuthModal(); showPanel('login'); }, 2000);
    } catch {
        errorEl.textContent = 'Σφάλμα σύνδεσης. Δοκιμάστε ξανά.';
    } finally {
        setSubmitLoading('resetSubmitBtn', false, 'Αλλαγή κωδικού');
    }
};

/** On page load, check if URL contains a reset_token and open the reset panel */
function checkResetToken() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('reset_token') && params.get('email')) {
        openAuthModal('reset');
    }
}

// ═══════════════════════════════════════════════════
//  SETTINGS MODULE
// ═══════════════════════════════════════════════════

// Map tile layers
const MAP_TILES = {
    light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    dark:  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
};
let currentTileLayer = null;

// Language strings (basic i18n)
const I18N = {
    el: {
        selectMunicipality: 'Επίλεξε Δήμο',
        municipalTransport: 'Δημοτική Συγκοινωνία',
        selectLine: 'Επίλεξε Γραμμή',
        favorites: 'Αγαπημένα',
        myChoices: 'Οι επιλογές σου'
    },
    en: {
        selectMunicipality: 'Select Municipality',
        municipalTransport: 'City Bus Transport',
        selectLine: 'Select Line',
        favorites: 'Favorites',
        myChoices: 'Your choices'
    }
};

let appSettings = {
    darkMap:        false,
    showBuses:      true,
    autoZoom:       true,
    arrivalNotif:   false,
    arrivalMinutes: 5,
    delayNotif:     false,
    language:       'el',
    fontSize:       'normal',
    compact:        false
};

/** Load settings from localStorage and apply them */
function loadSettings() {
    const saved = localStorage.getItem('citybus_settings');
    if (saved) {
        try { Object.assign(appSettings, JSON.parse(saved)); } catch {}
    }
    // Sync checkboxes / selects
    const get = id => document.getElementById(id);
    if (get('settingDarkMap'))        get('settingDarkMap').checked        = appSettings.darkMap;
    if (get('settingShowBuses'))      get('settingShowBuses').checked      = appSettings.showBuses;
    if (get('settingAutoZoom'))       get('settingAutoZoom').checked       = appSettings.autoZoom;
    if (get('settingArrivalNotif'))   get('settingArrivalNotif').checked   = appSettings.arrivalNotif;
    if (get('settingArrivalMinutes')) get('settingArrivalMinutes').value   = appSettings.arrivalMinutes;
    if (get('settingDelayNotif'))     get('settingDelayNotif').checked     = appSettings.delayNotif;
    if (get('settingLanguage'))       get('settingLanguage').value         = appSettings.language;
    if (get('settingFontSize'))       get('settingFontSize').value         = appSettings.fontSize;
    if (get('settingCompact'))        get('settingCompact').checked        = appSettings.compact;

    // Show/hide arrival minutes row
    const minRow = get('arrivalMinutesRow');
    if (minRow) minRow.style.display = appSettings.arrivalNotif ? 'flex' : 'none';

    // Apply visual effects on load
    _applyMapTheme(appSettings.darkMap);
    _applyFontSize(appSettings.fontSize);
    _applyCompact(appSettings.compact);
    if (!appSettings.showBuses) clearBusMarkers();
}

/** Called whenever any setting changes */
window.applySettings = function () {
    const get = id => document.getElementById(id);
    const prev = { ...appSettings };

    appSettings.darkMap        = get('settingDarkMap')?.checked        ?? appSettings.darkMap;
    appSettings.showBuses      = get('settingShowBuses')?.checked      ?? appSettings.showBuses;
    appSettings.autoZoom       = get('settingAutoZoom')?.checked       ?? appSettings.autoZoom;
    appSettings.arrivalNotif   = get('settingArrivalNotif')?.checked   ?? appSettings.arrivalNotif;
    appSettings.arrivalMinutes = Number(get('settingArrivalMinutes')?.value) || 5;
    appSettings.delayNotif     = get('settingDelayNotif')?.checked     ?? appSettings.delayNotif;
    appSettings.language       = get('settingLanguage')?.value         || 'el';
    appSettings.fontSize       = get('settingFontSize')?.value         || 'normal';
    appSettings.compact        = get('settingCompact')?.checked        ?? appSettings.compact;

    // Show/hide arrival minutes sub-row
    const minRow = get('arrivalMinutesRow');
    if (minRow) minRow.style.display = appSettings.arrivalNotif ? 'flex' : 'none';

    // Apply map theme
    if (prev.darkMap !== appSettings.darkMap) _applyMapTheme(appSettings.darkMap);

    // Bus markers visibility
    if (!appSettings.showBuses) {
        clearBusMarkers();
    } else if (prev.showBuses !== appSettings.showBuses) {
        // Re-draw buses for current screen
        const { screen, municipalityId, lineKey } = state;
        if (screen === 'lines')   drawAllActiveBuses(municipalityId, null);
        if (screen === 'stops' || screen === 'arrival') drawAllActiveBuses(municipalityId, lineKey);
    }

    // Notifications: request permission if toggled on
    if (appSettings.arrivalNotif || appSettings.delayNotif) {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }

    // Font size
    _applyFontSize(appSettings.fontSize);

    // Compact mode
    _applyCompact(appSettings.compact);

    // Persist
    localStorage.setItem('citybus_settings', JSON.stringify(appSettings));

    // Flash save message
    const msg = get('settingsSaveMsg');
    if (msg) {
        msg.textContent = '✅ Αποθηκεύτηκε';
        msg.classList.add('show');
        clearTimeout(msg._t);
        msg._t = setTimeout(() => msg.classList.remove('show'), 1800);
    }
};

function _applyMapTheme(dark) {
    if (currentTileLayer) map.removeLayer(currentTileLayer);
    currentTileLayer = L.tileLayer(dark ? MAP_TILES.dark : MAP_TILES.light, {
        attribution: '© Carto © OpenStreetMap', maxZoom: 19
    }).addTo(map);
}

function _applyFontSize(size) {
    document.body.classList.remove('font-small', 'font-large');
    if (size === 'small') document.body.classList.add('font-small');
    if (size === 'large') document.body.classList.add('font-large');
}

function _applyCompact(on) {
    document.body.classList.toggle('compact', on);
}

/** Open the settings bottom sheet */
window.openSettingsModal = function () {
    loadSettings(); // sync UI with current values
    document.getElementById('settingsModal').classList.add('visible');
};

/** Close the settings bottom sheet */
window.closeSettingsModal = function () {
    document.getElementById('settingsModal').classList.remove('visible');
};

// Close when clicking backdrop
document.getElementById('settingsModal').addEventListener('click', function (e) {
    if (e.target === this) closeSettingsModal();
});

/** Clear recent searches */
window.clearRecentSearches = function () {
    recentSearches = [];
    localStorage.removeItem('citybus_recent_searches');
    const msg = document.getElementById('settingsSaveMsg');
    if (msg) {
        msg.textContent = '✅ Ιστορικό εκκαθαρίστηκε';
        msg.classList.add('show');
        clearTimeout(msg._t);
        msg._t = setTimeout(() => msg.classList.remove('show'), 1800);
    }
};

/** Clear ALL favorites */
window.clearAllFavorites = function () {
    if (!confirm('Να διαγραφούν όλα τα αγαπημένα;')) return;
    favoriteMuns  = [];
    favoriteLines = [];
    favoriteStops = [];
    localStorage.removeItem('favoriteMuns');
    localStorage.removeItem('favoriteLines');
    localStorage.removeItem('favoriteStops');
    if (state.screen === 'favorites') render();
    const msg = document.getElementById('settingsSaveMsg');
    if (msg) {
        msg.textContent = '✅ Αγαπημένα διαγράφηκαν';
        msg.classList.add('show');
        clearTimeout(msg._t);
        msg._t = setTimeout(() => msg.classList.remove('show'), 1800);
    }
};

/** Export favorites as a JSON file */
window.exportFavorites = function () {
    const data = {
        exportedAt: new Date().toISOString(),
        favoriteMuns,
        favoriteLines,
        favoriteStops
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'citybus_favorites.json';
    a.click();
    URL.revokeObjectURL(url);
};

window.toggleFavorite = function (munId, e) {
    if (e) e.stopPropagation(); // prevent card click
    const idx = favoriteMuns.indexOf(munId);
    if (idx > -1) {
        favoriteMuns.splice(idx, 1);
    } else {
        favoriteMuns.push(munId);
    }
    localStorage.setItem('favoriteMuns', JSON.stringify(favoriteMuns));
    if (state.screen === 'municipalities' || state.screen === 'favorites') render();
};

window.toggleFavoriteLine = function (munId, lineKey, e) {
    if (e) e.stopPropagation(); // prevent card click
    const id = `${munId}|${lineKey}`;
    const idx = favoriteLines.indexOf(id);
    if (idx > -1) {
        favoriteLines.splice(idx, 1);
    } else {
        favoriteLines.push(id);
    }
    localStorage.setItem('favoriteLines', JSON.stringify(favoriteLines));
    if (state.screen === 'lines' || state.screen === 'favorites') render();
};

window.toggleFavoriteStop = function (munId, lineKey, stopId, e) {
    if (e) e.stopPropagation(); // prevent card click
    const id = `${munId}|${lineKey}|${stopId}`;
    const idx = favoriteStops.indexOf(id);
    if (idx > -1) {
        favoriteStops.splice(idx, 1);
    } else {
        favoriteStops.push(id);
    }
    localStorage.setItem('favoriteStops', JSON.stringify(favoriteStops));
    if (state.screen === 'stops' || state.screen === 'favorites') render();
};

// ═══════════════════════════════════════════════════
//  MAP INIT
// ═══════════════════════════════════════════════════
const map = L.map('map', { zoomControl: false }).setView([37.935, 23.715], 13);
// Tile layer is managed by the Settings module (_applyMapTheme)
currentTileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
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

function clearBusMarkers() {
    busMarkerLayers.forEach(l => map.removeLayer(l));
    busMarkerLayers = [];
}

function addToMap(layer) { layer.addTo(map); mapLayers.push(layer); }
function addBusMarker(layer) { layer.addTo(map); busMarkerLayers.push(layer); }

let userLocation = null;

// ═══════════════════════════════════════════════════
//  GEOLOCATION & DISTANCE
// ═══════════════════════════════════════════════════
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
}

function requestUserLocation() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve(null);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
            () => resolve(null),
            { timeout: 4000, maximumAge: 60000 }
        );
    });
}

// Show all municipality center markers on the home screen
function drawMunicipalitiesOverview() {
    clearMapLayers();
    Object.values(MUNICIPALITIES_DATA).forEach(mun => {
        if (!mun.center || mun.center[0] === null || mun.center[1] === null) return;
        const marker = L.circleMarker(mun.center, {
            radius: 11, color: '#fff', fillColor: '#3b7ef6', fillOpacity: 1, weight: 2.5,
            interactive: true
        }).addTo(map);
        // Always-visible name label
        marker.bindTooltip(`<b>${mun.name}</b>`,
            { className: 'leaflet-tooltip-custom', permanent: true, direction: 'top', offset: [0, -4] });
        // Click → navigate to lines for this municipality
        marker.on('click', () => navigate('lines', mun.id));
        // Hover: grow + show hint
        marker.on('mouseover', function () {
            this.setStyle({ radius: 15, fillColor: '#2563eb' });
            this.setTooltipContent(`<b>${mun.name}</b><br><span style="font-size:11px;color:#3b7ef6">Πάτα για επιλογή →</span>`);
        });
        marker.on('mouseout', function () {
            this.setStyle({ radius: 11, fillColor: '#3b7ef6' });
            this.setTooltipContent(`<b>${mun.name}</b>`);
        });
        mapLayers.push(marker);
    });
    const coords = Object.values(MUNICIPALITIES_DATA)
        .filter(m => m.center && m.center[0] !== null && m.center[1] !== null)
        .map(m => m.center);
    if (coords.length > 0) map.fitBounds(L.latLngBounds(coords), { padding: [50, 50] });
}

// Draw all routes of a municipality clearly
function drawAllMunicipalityRoutes(municipalityId) {
    console.log(`drawAllMunicipalityRoutes for ${municipalityId}...`);
    clearMapLayers();
    const mun = MUNICIPALITIES_DATA[municipalityId];
    if (!mun || !mun.lines) {
        console.warn(`No data for municipality ${municipalityId}`);
        return;
    }
    
    const allCoords = [];
    Object.entries(mun.lines).forEach(([lineKey, line]) => {
        const coords = line.stops.map(s => s.coords).filter(c => c && c[0] !== null && c[1] !== null);
        console.log(`  Line ${lineKey}: ${coords.length} valid stops`);
        if (coords.length > 1) {
            allCoords.push(...coords);
            // Solid, semi-transparent lines
            addToMap(L.polyline(coords, { color: line.color, weight: 4.5, opacity: 0.6 }));
        }
        line.stops.forEach(s => {
            if (!s.coords || s.coords[0] === null || s.coords[1] === null) return;
            const marker = L.circleMarker(s.coords, { radius: 5, color: '#fff', fillColor: line.color, fillOpacity: 0.8, weight: 1.5 });
            marker.bindTooltip(`<b>${s.name}</b><br><span style="font-size:11px;color:#666">${line.name}</span>`, { className: 'leaflet-tooltip-custom' });
            marker.on('click', () => navigate('stops', municipalityId, lineKey));
            marker.on('mouseover', function () { this.setStyle({ fillOpacity: 1, radius: 7 }); });
            marker.on('mouseout', function () { this.setStyle({ fillOpacity: 0.8, radius: 5 }); });
            addToMap(marker);
        });
    });

    if (allCoords.length > 0) {
        console.log(`  Fitting map to ${allCoords.length} points...`);
        map.fitBounds(L.latLngBounds(allCoords), { padding: [50, 50] });
    } else if (mun.center) {
        console.log(`  No route points, centering on municipality center ${mun.center}`);
        map.setView(mun.center, 15);
    }
}

function drawLine(municipalityId, lineKey, selectedStopId = null) {
    clearMapLayers();
    const mun = MUNICIPALITIES_DATA[municipalityId];
    if (!mun || !mun.lines || !mun.lines[lineKey]) return;
    const line = mun.lines[lineKey];
    const coords = line.stops.map(s => s.coords).filter(c => c && c[0] !== null && c[1] !== null);
    if (coords.length === 0) return;

    if (coords.length > 1) {
        addToMap(L.polyline(coords, { color: line.color, weight: 12, opacity: 0.12 }));
        addToMap(L.polyline(coords, { color: line.color, weight: 4, opacity: 0.9 }));
    }

    line.stops.forEach(s => {
        if (!s.coords || s.coords[0] === null || s.coords[1] === null) return;
        const isSelected = s.id === selectedStopId;
        const isTerminal = !!s.terminal;
        const r = isSelected ? 11 : (isTerminal ? 8 : 6);
        const marker = L.circleMarker(s.coords, {
            radius: r,
            color: '#fff', fillColor: isSelected ? line.color : line.color,
            fillOpacity: isSelected ? 1 : 0.85,
            weight: isSelected ? 3 : 2,
            zIndexOffset: isSelected ? 1000 : 0,
        });
        marker.bindTooltip(`<b>${s.name}</b>`, { className: 'leaflet-tooltip-custom' });
        // Click navigates to arrival screen for this stop
        marker.on('click', () => navigate('arrival', municipalityId, lineKey, s.id));
        // Hover feedback
        marker.on('mouseover', function () {
            this.setStyle({ radius: r + 3, weight: 3 });
            this.openTooltip();
        });
        marker.on('mouseout', function () {
            this.setStyle({ radius: r, weight: isSelected ? 3 : 2 });
        });
        marker.addTo(map);
        mapLayers.push(marker);

        if (isSelected) {
            const ring = L.circleMarker(s.coords, {
                radius: 18, color: line.color, fillColor: 'transparent', weight: 2, opacity: 0.5,
            }).addTo(map);
            mapLayers.push(ring);
        }
    });

    const isMobile = window.innerWidth < 700;
    const pad = isMobile
        ? [40, parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sheet-mid') || '55') * window.innerHeight / 100 + 20]
        : [60, 60];
    if (coords.length > 0) {
        const bounds = L.latLngBounds(coords);
        map.fitBounds(bounds, { paddingTopLeft: [pad[0], pad[0]], paddingBottomRight: [pad[0], pad[1]] });
    }
}

// ═══════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════
// stopIndex: position of this stop along the route (0-based)
// stopCount: total stops in the route
// Returns minutes until the bus reaches this specific stop
function minutesUntil(freq, stopIndex = 0, stopCount = 1) {
    if (!freq) freq = 15;
    const now = new Date();
    // base minutes until next departure from first stop
    const base = freq - (now.getMinutes() % freq);
    const baseMin = base === freq ? 0 : base;
    // average time between consecutive stops (assume full route takes ~0.7 * freq)
    const avgInterval = stopCount > 1 ? Math.round((freq * 0.7) / (stopCount - 1)) : 0;
    const offset = stopIndex * avgInterval;
    const total = (baseMin + offset) % freq;
    return total;
}

// ═══════════════════════════════════════════════════
//  LIVE BUS POSITIONS (timetable simulation)
// ═══════════════════════════════════════════════════

/**
 * For a given line, compute the interpolated lat/lng of each active bus
 * based on the current time and the timetable.
 * Returns an array of { lat, lng, nextStopName, minsToNext } objects.
 */
function computeBusPositions(line) {
    if (!line.stops || line.stops.length < 2) return [];
    const stops = line.stops;
    const freq = line.freq || 20;

    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;

    // Use real timetable from the first stop if available
    const firstStopTimes = stops[0]?.departureTimes;
    const useRealTimetable = firstStopTimes && firstStopTimes.length > 0;

    // Full route travel time: estimate as time from first to last stop departure
    // If we have real times, use the diff between stop[0] and stop[last]; else use 70% of freq
    let routeDurationMin;
    let stopTimes; // departure time (mins from midnight) for each stop index

    if (useRealTimetable) {
        // Build per-stop departure times from real timetable
        // Each stop's timetable lists its own departure times
        stopTimes = stops.map(s => s.departureTimes || []);
        // Duration = avg difference between last stop time and first stop time for same trip
        // We estimate departure time per stop relative to the first stop
        // (since each stop has its own departure times)
        const lastStopTimes = stops[stops.length - 1]?.departureTimes || [];
        if (lastStopTimes.length > 0 && firstStopTimes.length > 0) {
            routeDurationMin = Math.max(5, (lastStopTimes[0] - firstStopTimes[0]));
        } else {
            routeDurationMin = freq * 0.7;
        }
    } else {
        routeDurationMin = freq * 0.7;
        stopTimes = stops.map((_, i) => {
            // Generate synthetic departure times for each stop
            const startStr = line.hours?.start || '06:00';
            const endStr = line.hours?.end || '22:00';
            const [sh, sm] = startStr.split(':').map(Number);
            const [eh, em] = endStr.split(':').map(Number);
            const startMin = sh * 60 + sm;
            const endMin = eh * 60 + em;
            const stopOffset = i * (routeDurationMin / (stops.length - 1));
            const times = [];
            for (let t = startMin + stopOffset; t <= endMin + stopOffset; t += freq) {
                times.push(t);
            }
            return times;
        });
    }

    const positions = [];

    // For each departure from stop 0, find if a bus is currently between any two consecutive stops
    const departures = stopTimes[0]?.length > 0 ? stopTimes[0] : [];
    if (departures.length === 0) return positions;

    departures.forEach(dep0 => {
        // For each segment between consecutive stops, check if the bus is in that segment
        for (let i = 0; i < stops.length - 1; i++) {
            const from = stops[i];
            const to = stops[i + 1];

            // Get departure time at stop i and stop i+1 for this trip
            // Use the real per-stop times if available; otherwise estimate
            let depAtI, depAtI1;

            if (useRealTimetable && stopTimes[i]?.length > 0 && stopTimes[i + 1]?.length > 0) {
                // Find the closest departure at stop i that matches this trip (same offset as dep0)
                const offset0 = dep0 - stopTimes[0][0]; // offset from earliest trip
                depAtI = stopTimes[i][0] + offset0;
                depAtI1 = stopTimes[i + 1][0] + offset0;
            } else {
                const segDur = routeDurationMin / (stops.length - 1);
                depAtI = dep0 + i * segDur;
                depAtI1 = dep0 + (i + 1) * segDur;
            }

            if (nowMins >= depAtI && nowMins < depAtI1) {
                if (from.coords[0] === null || to.coords[0] === null) break;
                const progress = (nowMins - depAtI) / (depAtI1 - depAtI);
                const lat = from.coords[0] + (to.coords[0] - from.coords[0]) * progress;
                const lng = from.coords[1] + (to.coords[1] - from.coords[1]) * progress;
                const minsToNext = Math.max(0, Math.round((depAtI1 - nowMins)));
                positions.push({ lat, lng, nextStopName: to.name, minsToNext });
                break; // found the segment for this trip
            }
        }
    });

    return positions;
}

/** Create a custom pulsing bus icon (DivIcon). size: 'normal' | 'large' */
function createBusIcon(color, size) {
    const c = color || '#3b7ef6';
    const dim = size === 'large' ? 40 : 32;
    const font = size === 'large' ? 19 : 15;
    return L.divIcon({
        className: '',
        iconSize: [dim, dim],
        iconAnchor: [dim / 2, dim / 2],
        html: `
          <div style="
            width:${dim}px;height:${dim}px;
            background:${c};
            border-radius:50%;
            border:${size === 'large' ? 3 : 2.5}px solid #fff;
            box-shadow:0 2px 10px ${c}88;
            display:flex;align-items:center;justify-content:center;
            font-size:${font}px;
            animation:busPulse 2s ease-in-out infinite;
          ">🚌</div>`,
    });
}

/**
 * Draw ALL active buses from ALL loaded lines (across all municipalities).
 * selectedLineKey (optional): that line's bus will be displayed larger.
 */
function drawAllActiveBuses(selectedMunId, selectedLineKey) {
    clearBusMarkers();
    Object.entries(MUNICIPALITIES_DATA).forEach(([munId, mun]) => {
        if (!mun.lines) return;
        Object.entries(mun.lines).forEach(([lineKey, line]) => {
            const positions = computeBusPositions(line);
            const isSelected = munId === selectedMunId && lineKey === selectedLineKey;
            positions.forEach(pos => {
                const icon = createBusIcon(line.color, isSelected ? 'large' : 'normal');
                const marker = L.marker([pos.lat, pos.lng], { icon, zIndexOffset: isSelected ? 3000 : 2000 });
                const plateInfo = line.busPlate ? `<br><span style="color:#888;font-size:11px">🪪 ${line.busPlate}</span>` : '';
                const arrivalText = pos.minsToNext === 0
                    ? 'Φτάνει στη στάση!'
                    : `→ ${pos.nextStopName} σε ${pos.minsToNext} λεπτά`;
                const label = `<b>${line.code || lineKey}</b> · ${line.name}${plateInfo}<br>${arrivalText}`;
                marker.bindTooltip(label, { className: 'leaflet-tooltip-custom', direction: 'top', offset: [0, -(isSelected ? 17 : 14)] });
                marker.on('click', () => navigate('stops', munId, lineKey));
                addBusMarker(marker);
            });
        });
    });
}

/**
 * Background-fetch stop details for ALL lines of a municipality so buses can appear.
 * Non-blocking — failures are silently ignored.
 */
async function prefetchAllRoutes(municipalityId) {
    const mun = MUNICIPALITIES_DATA[municipalityId];
    if (!mun || !mun.lines) return;
    const promises = Object.entries(mun.lines)
        .filter(([key, line]) => !line.stops || line.stops.length === 0)
        .map(([key, line]) => fetchRouteDetails(municipalityId, key, line.id).catch(() => { }));
    await Promise.all(promises);
}

/** Start auto-refresh of bus markers every 30 seconds */
function startBusRefresh(refreshFn) {
    if (busRefreshInterval) clearInterval(busRefreshInterval);
    busRefreshInterval = setInterval(refreshFn, 30000);
}

function stopBusRefresh() {
    if (busRefreshInterval) { clearInterval(busRefreshInterval); busRefreshInterval = null; }
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
    if (!btn) {
        console.warn('mapToggleBtn not found in DOM');
        // Still toggle visibility of app if needed, but skip button styles
    }
    if (mapVisible) {
        app.classList.remove('map-hidden');
        if (btn) {
            btn.classList.add('active');
            btn.title = 'Απόκρυψη χάρτη';
        }
        setTimeout(() => {
            map.invalidateSize();
            // Re-render map layers after map becomes visible
            const { screen, municipalityId, lineKey, stopId } = state;
            if (screen === 'municipalities') drawMunicipalitiesOverview();
            else if (screen === 'lines') { drawAllMunicipalityRoutes(municipalityId); drawAllActiveBuses(municipalityId, null); }
            else if (screen === 'stops') { drawLine(municipalityId, lineKey); drawAllActiveBuses(municipalityId, lineKey); }
            else if (screen === 'arrival') { drawLine(municipalityId, lineKey, stopId); drawAllActiveBuses(municipalityId, lineKey); }
            setSheetState('mid');
        }, 50);
    } else {
        app.classList.add('map-hidden');
        if (btn) {
            btn.classList.remove('active');
            btn.title = 'Εμφάνιση χάρτη';
        }
        // Let sheet fill the screen
        const sheet = document.getElementById('sheet');
        sheet.classList.remove('peek', 'expanded');
    }
}


// ═══════════════════════════════════════════════════
//  NAVIGATION
// ═══════════════════════════════════════════════════
async function navigate(screen, municipalityId = state.municipalityId, lineKey = state.lineKey, stopId = state.stopId, isBack = false) {
    console.log(`Navigating to ${screen}: mun=${municipalityId}, line=${lineKey}, stop=${stopId}, isBack=${isBack}`);
    if (!isBack && state.screen) {
        state.history.push({
            screen: state.screen,
            municipalityId: state.municipalityId,
            lineKey: state.lineKey,
            stopId: state.stopId,
            searchVisible: document.getElementById('searchOverlay') ? document.getElementById('searchOverlay').classList.contains('visible') : false
        });
    }

    state.screen = screen;
    state.municipalityId = municipalityId;
    state.lineKey = lineKey;
    state.stopId = stopId;
    
    if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
    stopBusRefresh();

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
    console.log("RENDER CALLED:", { screen, municipalityId, lineKey, stopId });
    const backBtn = document.getElementById('backBtn');
    const title = document.getElementById('sheetTitle');
    const sub = document.getElementById('sheetSub');
    const body = document.getElementById('sheetBody');

    if (screen === 'municipalities') {
        backBtn.classList.add('hidden');
        title.textContent = 'Επίλεξε Δήμο';
        sub.textContent = 'Δημοτική Συγκοινωνία';
        title.style.color = '';
        drawMunicipalitiesOverview();
        body.innerHTML = buildMunicipalitiesScreen();

    } else if (screen === 'favorites') {
        backBtn.classList.add('hidden');
        title.textContent = 'Αγαπημένα';
        sub.textContent = 'Οι επιλογές σου';
        title.style.color = '';
        clearMapLayers();
        clearBusMarkers();
        body.innerHTML = buildFavoritesScreen();

    } else if (screen === 'lines') {
        const mun = MUNICIPALITIES_DATA[municipalityId];
        backBtn.classList.remove('hidden');
        title.textContent = 'Επίλεξε Γραμμή';
        sub.textContent = mun.name;
        title.style.color = '';
        drawAllMunicipalityRoutes(municipalityId);
        body.innerHTML = buildLinesScreen(municipalityId);
        try {
            if (mun.center) map.flyTo(mun.center, 14, { animate: true, duration: 1.5 });
        } catch (e) {
            console.error("Leaflet flyTo failed:", e);
        }
        // Prefetch all routes in background so all buses appear
        prefetchAllRoutes(municipalityId).then(() => {
            drawAllActiveBuses(municipalityId, null);
            startBusRefresh(() => drawAllActiveBuses(municipalityId, null));
        });
        // Also draw immediately any already-loaded buses
        drawAllActiveBuses(municipalityId, null);
        startBusRefresh(() => drawAllActiveBuses(municipalityId, null));

    } else if (screen === 'stops') {
        const mun = MUNICIPALITIES_DATA[municipalityId];
        const line = mun.lines[lineKey];
        backBtn.classList.remove('hidden');
        title.textContent = line.name;
        sub.textContent = mun.name;
        title.style.color = line.color;
        drawLine(municipalityId, lineKey);
        body.innerHTML = buildStopsScreen(municipalityId, lineKey);
        // Show ALL buses — selected line's bus is highlighted (larger)
        drawAllActiveBuses(municipalityId, lineKey);
        startBusRefresh(() => drawAllActiveBuses(municipalityId, lineKey));

    } else if (screen === 'arrival') {
        const mun = MUNICIPALITIES_DATA[municipalityId];
        const line = mun.lines[lineKey];
        const stop = line.stops.find(s => s.id === stopId);
        backBtn.classList.remove('hidden');
        title.textContent = stop.name;
        sub.textContent = line.name;
        title.style.color = line.color;
        drawLine(municipalityId, lineKey, stopId);
        body.innerHTML = buildArrivalScreen(municipalityId, lineKey, stopId);
        startCountdown(municipalityId, lineKey, stopId);
        if (stop.coords && stop.coords[0] !== null && stop.coords[1] !== null) {
            map.panTo(stop.coords, { animate: true });
        }
        // Show ALL buses — selected line's bus is highlighted
        drawAllActiveBuses(municipalityId, lineKey);
        startBusRefresh(() => drawAllActiveBuses(municipalityId, lineKey));
    }

    setSheetState(mapVisible ? 'mid' : 'full');
}


// ─────────────── MUNICIPALITIES SCREEN ───────────────
function buildMunicipalitiesScreen() {
    console.log("buildMunicipalitiesScreen running. MUNICIPALITIES_DATA length:", Object.keys(MUNICIPALITIES_DATA).length);
    let html = `<div class="section-label">Διαθέσιμοι Δήμοι</div>`;

    let muns = Object.values(MUNICIPALITIES_DATA).map(mun => {
        let dist = null;
        if (userLocation && mun.center) {
            dist = getDistance(userLocation.lat, userLocation.lng, mun.center[0], mun.center[1]);
        }
        return { ...mun, distance: dist };
    });

    muns.sort((a, b) => {
        if (a.distance !== null && b.distance !== null) return a.distance - b.distance;
        if (a.distance !== null) return -1;
        if (b.distance !== null) return 1;
        return a.name.localeCompare(b.name, 'el');
    });

    muns.forEach(mun => {
        const linesCount = mun.totalRoutes || 0;
        const isFav = favoriteMuns.includes(mun.id);
        const favIcon = isFav ? '♥' : '♡';

        html += `
          <div class="line-card" style="--lc:#3b7ef6" onclick="navigate('lines', '${mun.id}'); event.stopPropagation();">
            <div class="line-badge" style="background:rgba(59,126,246,0.12);color:#3b7ef6">🏛</div>
            <div class="line-info">
              <div class="line-name">${mun.name}</div>
              <div class="line-tag">${mun.region || 'Δημοτική Συγκοινωνία'}</div>
            </div>
            <div class="line-meta">
              <div class="line-freq">${linesCount}</div>
              <div class="line-freq-lbl">γραμμές</div>
            </div>
            <div class="fav-btn ${isFav ? 'active' : ''}" onclick="toggleFavorite('${mun.id}', event)">
              ${favIcon}
            </div>
            <div class="chevron">›</div>
          </div>`;
    });

    console.log("buildMunicipalitiesScreen finished. Output length:", html.length);
    return html;
}

// ─────────────── FAVORITES SCREEN ───────────────
function buildFavoritesScreen() {
    let html = '';

    // Favorites: Muns
    const favMuns = Object.values(MUNICIPALITIES_DATA).filter(m => favoriteMuns.includes(m.id));
    if (favMuns.length > 0) {
        html += `<div class="section-label">Οι Δήμοι μου</div>`;
        favMuns.forEach(mun => {
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
                <div class="fav-btn active" onclick="toggleFavorite('${mun.id}', event)">♥</div>
                <div class="chevron">›</div>
              </div>`;
        });
    }

    // Favorites: Lines
    let favLinesData = [];
    Object.values(MUNICIPALITIES_DATA).forEach(mun => {
        if (!mun.lines) return;
        Object.entries(mun.lines).forEach(([key, line]) => {
            const id = `${mun.id}|${key}`;
            if (favoriteLines.includes(id)) {
                favLinesData.push({ mun, key, line });
            }
        });
    });

    if (favLinesData.length > 0) {
        html += `<div class="section-label" style="margin-top: 15px;">Αγαπημένες Γραμμές</div>`;
        favLinesData.forEach(({ mun, key, line }) => {
            const rgb = hexToRgb(line.color);
            const routeTag = (line.stops && line.stops.length > 1) ? `${line.stops[0].name} → ${line.stops[line.stops.length - 1].name}` : 'Ενεργή Γραμμή';
            const nextBus = minutesUntil(line.freq);
            html += `
              <div class="line-card" style="--lc:${line.color}" onclick="navigate('stops', '${mun.id}', '${key}')">
                <div class="line-badge" style="background:rgba(${rgb},0.15);color:${line.color}">${line.code || key}</div>
                <div class="line-info">
                  <div class="line-name">${line.name}</div>
                  <div class="line-tag">${mun.name} · ${routeTag}</div>
                </div>
                <div class="line-meta">
                  <div class="line-freq">${nextBus === 0 ? 'Τώρα' : nextBus === 1 ? '1 λεπτό' : nextBus + ' λεπτά'}</div>
                  <div class="line-freq-lbl">επόμενο</div>
                </div>
                <div class="fav-btn active" onclick="toggleFavoriteLine('${mun.id}', '${key}', event)">♥</div>
                <div class="chevron">›</div>
              </div>`;
        });
    }

    // Favorites: Stops
    let favStopsData = [];
    Object.values(MUNICIPALITIES_DATA).forEach(mun => {
        if (!mun.lines) return;
        Object.entries(mun.lines).forEach(([key, line]) => {
            if (!line.stops) return;
            line.stops.forEach((s, idx) => {
                const id = `${mun.id}|${key}|${s.id}`;
                if (favoriteStops.includes(id)) {
                    favStopsData.push({ mun, key, line, stop: s, idx, totalStops: line.stops.length });
                }
            });
        });
    });

    if (favStopsData.length > 0) {
        html += `<div class="section-label" style="margin-top: 15px;">Αγαπημένες Στάσεις</div>`;
        favStopsData.forEach(({ mun, key, line, stop, idx, totalStops }) => {
            const isFirst = idx === 0;
            const isLast = idx === totalStops - 1;
            const badge = isFirst ? `<span class="stop-badge start">Αφετηρία</span>` : isLast ? `<span class="stop-badge end">Τέρμα</span>` : '';
            const nextBus = minutesUntil(line.freq, idx, totalStops);

            html += `
              <div class="line-card" style="--lc:${line.color}" onclick="navigate('arrival', '${mun.id}', '${key}', '${stop.id}')">
                <div class="line-badge" style="background:rgba(${hexToRgb(line.color)},0.15);color:${line.color}">🚏</div>
                <div class="line-info">
                  <div class="line-name">${stop.name}</div>
                  <div class="line-tag">${line.name}</div>
                  <div style="font-size: 11px; margin-top: 4px; color: var(--muted);">${badge} Επόμενο: ${nextBus === 0 ? '<span style="color:var(--green);font-weight:700;">Τώρα!</span>' : `<b>${nextBus} λεπτά</b>`}</div>
                </div>
                <div class="fav-btn active" onclick="toggleFavoriteStop('${mun.id}', '${key}', '${stop.id}', event)">♥</div>
                <div class="chevron">›</div>
              </div>`;
        });
    }

    if (html === '') {
        html = `
            <div style="text-align: center; padding: 40px 20px; color: var(--muted);">
                <div style="font-size: 40px; margin-bottom: 15px; opacity: 0.5;">❤️</div>
                <h3 style="font-size: 18px; margin-bottom: 8px; color: var(--text);">Δεν υπάρχουν αγαπημένα</h3>
                <p style="font-size: 14px; line-height: 1.5;">Πάτα την καρδούλα (♡) στους δήμους, στις γραμμές, ή στις στάσεις που χρησιμοποιείς πιο συχνά για να βρίσκονται εδώ!</p>
            </div>
        `;
    }

    return html;
}

// ─────────────── LINES SCREEN ───────────────
function buildLinesScreen(municipalityId) {
    console.log("buildLinesScreen starting for:", municipalityId);
    let html = `<div class="section-label">Διαθέσιμες Γραμμές</div>`;
    const lines = MUNICIPALITIES_DATA[municipalityId]?.lines || {};
    console.log("Found lines:", Object.keys(lines).length);
    Object.entries(lines).forEach(([key, line]) => {
        const nextBus = minutesUntil(line.freq);
        const rgb = hexToRgb(line.color);
        const routeTag = (line.stops && line.stops.length > 1)
            ? `${line.stops[0].name} → ${line.stops[line.stops.length - 1].name}`
            : (line.status === 'active' ? 'Ενεργή Γραμμή' : 'Μη διαθέσιμη');

        const lineId = `${municipalityId}|${key}`;
        const isFav = favoriteLines.includes(lineId);
        const favIcon = isFav ? '♥' : '♡';

        html += `
          <div class="line-card" style="--lc:${line.color}" onclick="navigate('stops', '${municipalityId}', '${key}')">
            <div class="line-badge" style="background:rgba(${rgb},0.15);color:${line.color}">${line.code || key}</div>
            <div class="line-info">
              <div class="line-name">${line.name}</div>
              <div class="line-tag">${routeTag}</div>
            </div>
            <div class="line-meta">
              <div class="line-freq">${nextBus === 0 ? 'Τώρα' : nextBus === 1 ? '1 λεπτό' : nextBus + ' λεπτά'}</div>
              <div class="line-freq-lbl">επόμενο</div>
              <div class="line-stops-count">${line.stops?.length > 0 ? line.stops.length + ' στάσεις' : (line.totalStops ? line.totalStops + ' στάσεις' : '—')}</div>
            </div>
            <div class="fav-btn ${isFav ? 'active' : ''}" onclick="toggleFavoriteLine('${municipalityId}', '${key}', event)">
              ${favIcon}
            </div>
            <div class="chevron">›</div>
          </div>`;
    });
    return html;
}



// ─────────────── STOPS SCREEN ───────────────
function buildStopsScreen(municipalityId, lineKey) {
    const line = MUNICIPALITIES_DATA[municipalityId].lines[lineKey];
    const stopCount = line.stops?.length || 1;
    let html = `
        <div class="section-label" style="color:${line.color}">Στάσεις • ${stopCount} συνολικά</div>
        <div class="stop-list" style="--lc:${line.color}">`;

    if (line.stops) {
        line.stops.forEach((s, i) => {
            const isFirst = i === 0;
            const isLast = i === line.stops.length - 1;
            const badge = isFirst ? `<span class="stop-badge start">Αφετηρία</span>`
                : isLast ? `<span class="stop-badge end">Τέρμα</span>` : '';
            const nextBus = minutesUntil(line.freq, i, stopCount);
            const stopIdStr = `${municipalityId}|${lineKey}|${s.id}`;
            const isFav = favoriteStops.includes(stopIdStr);
            const favIcon = isFav ? '♥' : '♡';

            html += `
              <div class="stop-row ${isFirst || isLast ? 'terminal' : ''}" onclick="navigate('arrival', '${municipalityId}', '${lineKey}', '${s.id}')">
                <div class="stop-dot-wrap"><div class="stop-dot"></div></div>
                <div class="stop-info">
                  <div class="stop-name">${s.name}</div>
                  <div class="stop-sub">Επόμενο σε ${nextBus === 0 ? '<b style="color:var(--green)">Τώρα!</b>' : `<b>${nextBus} λεπτά</b>`}</div>
                </div>
                ${badge}
                <div class="fav-btn ${isFav ? 'active' : ''}" onclick="toggleFavoriteStop('${municipalityId}', '${lineKey}', '${s.id}', event)" style="margin-left:auto; padding: 4px;">
                  ${favIcon}
                </div>
                <div class="stop-chevron">›</div>
              </div>`;
        });
    }
    html += `</div>`;
    return html;
}



// ─────────────── ARRIVAL SCREEN ───────────────
function buildArrivalScreen(municipalityId, lineKey, stopId) {
    const line = MUNICIPALITIES_DATA[municipalityId].lines[lineKey];
    const stop = line.stops.find(s => s.id === stopId);
    const stopIndex = line.stops.findIndex(s => s.id === stopId);
    const stopCount = line.stops.length;
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const times = buildSchedule(line, nowMins);
    const nextBus = minutesUntil(line.freq, stopIndex, stopCount);

    const arrivalHTML = nextBus === 0
        ? `<div class="arrival-now"><div class="pulse-dot"></div> Φτάνει τώρα!</div>`
        : `<div class="arrival-countdown">
            <div class="countdown-num" id="cdNum">${nextBus}</div>
            <div class="countdown-unit">λεπτά</div>
           </div>
           <div class="arrival-label" id="cdLabel">μέχρι το επόμενο λεωφορείο</div>`;

    const nextThree = [];
    for (let i = 0; i < 3; i++) {
        const t = new Date(now.getTime() + (nextBus + i * (line.freq || 20)) * 60000);
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

function startCountdown(municipalityId, lineKey, stopId) {
    const line = MUNICIPALITIES_DATA[municipalityId].lines[lineKey];
    const stopIndex = line.stops.findIndex(s => s.id === stopId);
    const stopCount = line.stops.length;
    countdownInterval = setInterval(() => {
        const mins = minutesUntil(line.freq, stopIndex, stopCount);
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
    if (state.history.length > 0) {
        const prev = state.history.pop();
        navigate(prev.screen, prev.municipalityId, prev.lineKey, prev.stopId, true);
        if (prev.searchVisible) {
            document.getElementById('searchOverlay').classList.add('visible');
            setNavTab('search');
        }
    } else {
        navigate('municipalities', null, null, null, true);
    }
});

// ═══════════════════════════════════════════════════
//  API CALLS
// ═══════════════════════════════════════════════════


// ═══════════════════════════════════════════════════
//  API CALLS (Supabase)
// ═══════════════════════════════════════════════════

async function fetchMunicipalities() {
    console.log("fetchMunicipalities starting (API)...");
    try {
        // Fetch summary list (for names, regions, totalRoutes)
        const [summaryRes, mapRes] = await Promise.all([
            fetch(`${API_BASE_URL}/transport-api`),
            fetch(`${API_BASE_URL}/transport-api?overview=map`)
        ]);
        const summaryData = await summaryRes.json();
        const mapData = await mapRes.json();

        // Build a lookup of slug → coordinates from the map overview endpoint
        const coordsBySlug = {};
        (mapData.municipalities || []).forEach(m => {
            coordsBySlug[m.slug] = [Number(m.latitude), Number(m.longitude)];
        });

        const formatted = {};
        (summaryData.municipalities || []).forEach(m => {
            // API uses m.id as the slug (e.g. "naxos", "athens")
            const mSlug = m.id;
            const mName = m.municipality;

            // Use map-overview coords (most accurate), fallback to static list
            const defaultCenters = {
                'nea-smyrni':   [37.948, 23.713],
                'palaio-faliro':[37.925, 23.698],
                'athens':       [37.9838, 23.7275],
                'thessaloniki': [40.6401, 22.9444],
                'naxos':        [37.1065, 25.3753]
            };
            const center = coordsBySlug[mSlug] || defaultCenters[mSlug] || [37.9838, 23.7275];

            formatted[mSlug] = {
                id: mSlug,
                slug: m.slug || mSlug,
                name: mName,
                region: m.region,
                totalRoutes: m.totalRoutes,
                center: center,
                lines: MUNICIPALITIES_DATA[mSlug]?.lines || {}
            };
        });

        MUNICIPALITIES_DATA = { ...MUNICIPALITIES_DATA, ...formatted };
        console.log("fetchMunicipalities completed. Loaded municipalities:", Object.keys(MUNICIPALITIES_DATA));
    } catch (e) {
        console.error('Error fetching municipalities:', e);
        throw e;
    }
}

async function fetchLines(municipalityId) {
    console.log(`fetchLines for ${municipalityId} (API)...`);
    try {
        // Use the municipality slug (which is also the id in our app)
        const response = await fetch(`${API_BASE_URL}/transport-api?municipality=${municipalityId}`);
        const data = await response.json();

        if (data.error) {
            console.warn(`fetchLines: API error for ${municipalityId}:`, data.error);
            return;
        }

        const mun = MUNICIPALITIES_DATA[municipalityId];
        if (!mun) return;
        if (!mun.lines) mun.lines = {};

        (data.routes || []).forEach(r => {
            if (!mun.lines[r.id]) {
                mun.lines[r.id] = { stops: [] };
            }
            Object.assign(mun.lines[r.id], {
                id: r.id,
                code: r.code,
                name: r.name,
                color: r.status === 'delayed' ? '#ef4444' : '#3b7ef6',
                freq: r.frequency_minutes || 20,
                status: r.status,
                busPlate: r.bus_plate || null,
                driverName: r.driver_name || null,
                hours: { start: "06:00", end: "22:00" },
            });
        });
        render();
    } catch (e) {
        console.error(`Error fetching lines for ${municipalityId}:`, e);
    }
}

async function fetchRouteDetails(municipalityId, lineKey, routeId) {
    console.log(`fetchRouteDetails for ${routeId} (API)...`);
    try {
        const response = await fetch(`${API_BASE_URL}/transport-api?route=${routeId}`);
        const data = await response.json();

        if (data.error) {
            console.warn(`fetchRouteDetails: API error for route ${routeId}:`, data.error);
            return;
        }

        const line = MUNICIPALITIES_DATA[municipalityId]?.lines?.[lineKey];
        if (!line) return;

        // Update route metadata if provided
        if (data.route?.bus_plate)   line.busPlate   = data.route.bus_plate;
        if (data.route?.driver_name) line.driverName = data.route.driver_name;
        if (data.route?.frequency_minutes) line.freq = data.route.frequency_minutes;

        // Map stops to app format
        line.stops = (data.stops || []).map(s => ({
            id: s.id,
            name: s.name,
            coords: [Number(s.latitude), Number(s.longitude)],
            terminal: s.is_terminal,
            orderIndex: s.order_index,
            departureTimes: (s.timetable || [])
                .filter(t => t.day_type === 'weekday')
                .map(t => {
                    const [h, m] = t.departure_time.split(':').map(Number);
                    return h * 60 + m;
                })
                .sort((a, b) => a - b)
        }));

    } catch (e) {
        console.error(`Error fetching route details for ${routeId}:`, e);
    }
}



let recentSearches = JSON.parse(localStorage.getItem('citybus_recent_searches')) || [];

function saveRecentSearch(query) {
    const q = query.trim();
    if (!q) return;
    recentSearches = recentSearches.filter(item => item !== q);
    recentSearches.unshift(q);
    if (recentSearches.length > 5) recentSearches.pop();
    localStorage.setItem('citybus_recent_searches', JSON.stringify(recentSearches));
}

function executeRecentSearch(query) {
    const input = document.getElementById('searchInput');
    input.value = query;
    document.getElementById('searchResults').innerHTML = buildSearchResults(query);
    input.focus();
}

// ═══════════════════════════════════════════════════
//  GLOBAL SEARCH
// ═══════════════════════════════════════════════════
let isDataPrefetched = false;
let isPrefetching = false;

async function prefetchAllData() {
    if (isDataPrefetched || isPrefetching) return;
    isPrefetching = true;
    try {
        const muns = Object.keys(MUNICIPALITIES_DATA);
        await Promise.all(muns.map(async munId => {
            if (!MUNICIPALITIES_DATA[munId].lines || Object.keys(MUNICIPALITIES_DATA[munId].lines).length === 0) {
                await fetchLines(munId);
            }
        }));
        await Promise.all(muns.map(munId => prefetchAllRoutes(munId)));
        isDataPrefetched = true;
        
        // If search is currently visible, update results
        const searchOverlay = document.getElementById('searchOverlay');
        if (searchOverlay && searchOverlay.classList.contains('visible')) {
            const input = document.getElementById('searchInput');
            if (input) {
                document.getElementById('searchResults').innerHTML = buildSearchResults(input.value);
            }
        }
    } catch (e) {
        console.error("Data prefetch error:", e);
    } finally {
        isPrefetching = false;
    }
}

function buildSearchResults(query) {
    const q = query.trim().toLowerCase();
    if (!q) {
        if (recentSearches.length === 0) return '';
        let html = '<div class="section-label" style="padding: 0 16px;">Πρόσφατες Αναζητήσεις</div>';
        recentSearches.forEach(rs => {
            html += `
              <div class="stop-row" onclick="executeRecentSearch('${rs.replace(/'/g, "\\'")}')" style="padding: 12px 16px; margin-bottom: 4px; background: var(--surface); border-radius: 12px;">
                <span style="font-size: 16px; margin-right: 12px; opacity: 0.5;">🕒</span>
                <div class="stop-info"><div class="stop-name" style="font-weight: 500;">${rs}</div></div>
              </div>`;
        });
        return html;
    }

    let lineResults = [];
    let stopResults = [];

    Object.values(MUNICIPALITIES_DATA).forEach(mun => {
        if (!mun.lines) return;
        Object.entries(mun.lines).forEach(([lineKey, line]) => {
            const nameMatch = line.name?.toLowerCase().includes(q);
            const codeMatch = line.code?.toLowerCase().includes(q);
            if (nameMatch || codeMatch) {
                lineResults.push({ mun, lineKey, line });
            }
            if (line.stops) {
                line.stops.forEach(s => {
                    if (s.name?.toLowerCase().includes(q)) {
                        stopResults.push({ mun, lineKey, line, stop: s });
                    }
                });
            }
        });
    });

    if (lineResults.length === 0 && stopResults.length === 0) {
        return `<div class="search-empty">Δεν βρέθηκαν αποτελέσματα για «${query}»</div>`;
    }

    let html = '';
    if (lineResults.length > 0) {
        html += `<div class="section-label">Γραμμές</div>`;
        lineResults.forEach(({ mun, lineKey, line }) => {
            const rgb = hexToRgb(line.color);
            html += `
              <div class="line-card" style="--lc:${line.color}" onclick="saveRecentSearch(document.getElementById('searchInput').value); navigate('stops','${mun.id}','${lineKey}'); document.getElementById('searchInput').value=''; hideSearch(false);">
                <div class="line-badge" style="background:rgba(${rgb},0.15);color:${line.color}">${line.code || lineKey}</div>
                <div class="line-info">
                  <div class="line-name">${line.name}</div>
                  <div class="line-tag">${mun.name}</div>
                </div>
                <div class="chevron">›</div>
              </div>`;
        });
    }
    if (stopResults.length > 0) {
        html += `<div class="section-label">Στάσεις</div>`;
        stopResults.forEach(({ mun, lineKey, line, stop }) => {
            html += `
              <div class="line-card" style="--lc:${line.color}" onclick="saveRecentSearch(document.getElementById('searchInput').value); navigate('arrival','${mun.id}','${lineKey}','${stop.id}'); document.getElementById('searchInput').value=''; hideSearch(false);">
                <div class="line-badge" style="background:rgba(${hexToRgb(line.color)},0.15);color:${line.color}">🚏</div>
                <div class="line-info">
                  <div class="line-name">${stop.name}</div>
                  <div class="line-tag">${line.name} · ${mun.name}</div>
                </div>
                <div class="chevron">›</div>
              </div>`;
        });
    }
    return html;
}

function setNavTab(tab) {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    const el = document.getElementById(
        tab === 'arrivals' ? 'navArrivals' : tab === 'search' ? 'navSearch' : tab === 'favorites' ? 'navFavorites' : tab === 'map' ? 'navMap' : null
    );
    if (el) el.classList.add('active');
}

function navTo(tab) {
    const tabId = tab === 'arrivals' ? 'navArrivals' : tab === 'search' ? 'navSearch' : tab === 'favorites' ? 'navFavorites' : tab === 'map' ? 'navMap' : null;
    const isAlreadyActive = document.getElementById(tabId)?.classList.contains('active');

    // Tap on already-active tab
    if (isAlreadyActive) {
        if (tab === 'favorites') {
            state.history = [];
            navigate('favorites', null, null, null, true);
            return;
        }
        state.history = [];
        hideSearch(true);
        if (mapVisible) toggleMap(); // hide map, let sheet fill screen
        navigate('municipalities', null, null, null, true);
        setNavTab('arrivals');
        return;
    }

    // Normal tab switch
    state.history = []; // Clear history stack when switching bottom tabs
    if (tab === 'arrivals') {
        hideSearch(true);
        setNavTab('arrivals');
        navigate('municipalities', null, null, null, true);
    } else if (tab === 'favorites') {
        hideSearch(true);
        setNavTab('favorites');
        navigate('favorites', null, null, null, true);
    } else if (tab === 'search') {
        showSearch();
        setNavTab('search');
    } else if (tab === 'map') {
        hideSearch(true);
        if (!mapVisible) toggleMap();
        setNavTab('map');
    }
}

function showSearch() {
    document.getElementById('searchOverlay').classList.add('visible');
    document.getElementById('searchInput').focus();
    setNavTab('search');
    document.getElementById('searchResults').innerHTML = buildSearchResults(document.getElementById('searchInput').value);
}

function hideSearch(resetNav = true) {
    const searchTab = document.getElementById('navSearch');
    const wasActive = searchTab && searchTab.classList.contains('active');
    document.getElementById('searchOverlay').classList.remove('visible');
    document.getElementById('searchInput').value = '';
    document.getElementById('searchResults').innerHTML = '';
    if (resetNav && wasActive) {
        // Reset navigation to home screen (same as tapping active tab)
        navigate('municipalities');
        setNavTab('arrivals');
    }
}

document.getElementById('searchCloseBtn').addEventListener('click', () => hideSearch(true));
document.getElementById('searchInput').addEventListener('click', function () {
    if (!this.value) {
        document.getElementById('searchResults').innerHTML = buildSearchResults('');
    }
});
document.getElementById('searchInput').addEventListener('input', function () {
    document.getElementById('searchResults').innerHTML = buildSearchResults(this.value);
});
document.getElementById('searchInput').addEventListener('keydown', function (e) {
    if (e.key === 'Escape') hideSearch(true);
});

// ═══════════════════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════════════════
async function init() {
    console.log("init() Started.");
    try {
        await checkAuthState(); // ← AUTH: check if user is already logged in
        checkResetToken();       // ← AUTH: open reset panel if URL has token
        loadSettings();          // ← SETTINGS: apply saved user preferences
        await fetchMunicipalities();
        console.log("fetchMunicipalities completed.");
        prefetchAllData(); // background fetch for global search
        navigate('municipalities');

        requestUserLocation().then(loc => {
            console.log("User location request resolved:", loc);
            if (loc) {
                userLocation = loc;
                // Only update screen if we are STILL on municipalities screen
                // AND not currently viewing something else that got loaded in the meantime.
                if (state.screen === 'municipalities') {
                    console.log("Updating UI and map with location data...");
                    render(); // Call full render to update both list and markers
                }
            }
        });
    } catch (e) {
        console.error('Σφάλμα φόρτωσης δεδομένων:', e);
        document.getElementById('sheetBody').innerHTML =
            `<p style="color:red;padding:20px;">Σφάλμα σύνδεσης με το API. Παρακαλώ δοκιμάστε αργότερα.</p>`;
    }
}

init();
