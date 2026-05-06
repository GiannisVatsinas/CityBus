# CityBus 🚌

Μια **Progressive Web App (PWA)** για real-time πληροφορίες αστικής συγκοινωνίας. Δείχνει γραμμές, στάσεις και ζωντανές θέσεις λεωφορείων σε διαδραστικό χάρτη — σχεδιασμένη για κινητές συσκευές και offline χρήση.

---

## Χαρακτηριστικά

### Πλοήγηση & Πληροφορίες
- Περιήγηση ανά δήμο → γραμμή → στάση → δρομολόγια
- Αναζήτηση γραμμών και στάσεων
- Ώρες άφιξης με δυναμική παρεμβολή βάσει συχνότητας δρομολογίων
- Υπολογισμός απόστασης από την τρέχουσα τοποθεσία

### Διαδραστικός Χάρτης
- Live θέσεις λεωφορείων (ανανέωση κάθε 30 δευτερόλεπτα)
- Ρεαλιστική γεωμετρία διαδρομής μέσω OSRM API
- Αλγοριθμικά διακριτά χρώματα ανά γραμμή
- Υποστήριξη dark/light θεμάτων χάρτη

### Προσωποποίηση
- Αγαπημένοι δήμοι, γραμμές και στάσεις
- Ρυθμίσεις εμφάνισης: μέγεθος γραμματοσειράς, compact mode
- Ειδοποιήσεις για αφίξεις και καθυστερήσεις
- Δίγλωσση εφαρμογή (Ελληνικά / Αγγλικά)

### Χρήστης & Ασφάλεια
- Εγγραφή & σύνδεση με email/κωδικό
- Επαναφορά κωδικού μέσω email (single-use tokens, 1 ώρα ισχύ)
- Sessions με httpOnly cookies και JWT
- Constant-time password comparison για αποφυγή timing attacks

### PWA & Offline
- Εγκατάσταση στην αρχική οθόνη (iOS & Android)
- Service Worker με cache-first για το app shell
- Stale-while-revalidate για fonts και βιβλιοθήκες
- Network-first με fallback cache για τους χάρτες

---

## Τεχνολογίες

| Κατηγορία | Τεχνολογία |
|-----------|-----------|
| Frontend | HTML5, CSS3, Vanilla JavaScript (ES6+) |
| Χάρτης | [Leaflet.js](https://leafletjs.com/) v1.9.4 + CartoDB/OpenStreetMap tiles |
| Backend | Node.js + [Express](https://expressjs.com/) v5.2 |
| Βάση Δεδομένων | SQLite via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) |
| Αυθεντικοποίηση | JWT + bcrypt |
| Δεδομένα | XLSX (Excel → JSON μετατροπή) |
| Real-time | [Supabase Functions](https://supabase.com/) |
| Routing | [OSRM](http://project-osrm.org/) (Open Source Routing Machine) |
| PWA | Service Worker + Web App Manifest |

---

## Αρχιτεκτονική

```
┌─────────────────────────────────────────────┐
│              Browser / PWA                  │
│                                             │
│  index.html + app.js + style.css            │
│  └── Leaflet Map                            │
│  └── Service Worker (sw.js)                 │
└───────────────┬─────────────────────────────┘
                │ HTTP
┌───────────────▼─────────────────────────────┐
│           Express Server (server.js)        │
│                                             │
│  /api/register   /api/login                 │
│  /api/me         /api/logout                │
│  /api/forgot-password  /api/reset-password  │
│                                             │
│  SQLite DB (citybus.db)                     │
└───────────────┬─────────────────────────────┘
                │
    ┌───────────┴──────────┐
    │                      │
┌───▼────────┐    ┌────────▼──────┐
│  Supabase  │    │  OSRM API     │
│  Functions │    │  (routing)    │
│ (live data)│    │               │
└────────────┘    └───────────────┘
```

---

## Εγκατάσταση & Εκτέλεση

### Προαπαιτούμενα
- Node.js v18+
- npm

### 1. Εγκατάσταση dependencies

```bash
npm install
```

### 2. Εισαγωγή δεδομένων (προαιρετικό)

Αν έχεις αρχείο Excel με γραμμές/στάσεις (`data.xlsx`):

```bash
node convert-excel.js
```

Το script περιμένει sheets `Lines` και `Stops` και παράγει `data.json`.

### 3. Εκκίνηση server

```bash
node server.js
```

Ο server τρέχει στο `http://127.0.0.1:8082`.

### 4. Άνοιγμα εφαρμογής

Άνοιξε στον browser: [http://127.0.0.1:8082](http://127.0.0.1:8082)

---

## Μεταβλητές Περιβάλλοντος

| Μεταβλητή | Απαιτείται | Περιγραφή |
|-----------|-----------|-----------|
| `JWT_SECRET` | Προτεινόμενο | Κλειδί υπογραφής JWT. Αν δεν οριστεί, παράγεται τυχαίο (οι sessions λήγουν στο restart) |

Δημιούργησε αρχείο `.env` στη ρίζα του project:

```env
JWT_SECRET=your-super-secret-key-here
```

> **Σημείωση:** Ο server χρησιμοποιεί τα εξής external APIs χωρίς API key:
> - Supabase Functions για live δεδομένα λεωφορείων
> - OSRM για γεωμετρία διαδρομών

---

## Δομή Αρχείων

```
.
├── index.html          # Κύρια σελίδα PWA (UI shell)
├── app.js              # Frontend λογική (~1900 γραμμές)
├── style.css           # Πλήρες styling (CSS variables + themes)
├── server.js           # Express backend (auth API + static files)
├── sw.js               # Service Worker (caching στρατηγικές)
├── manifest.json       # PWA manifest
├── convert-excel.js    # Βοηθητικό script: Excel → data.json
├── package.json        # Dependencies
├── data.json           # Δεδομένα δήμων/γραμμών/στάσεων (generated)
├── citybus.db          # SQLite βάση δεδομένων (auto-created)
├── logo.png            # App logo
└── icons/              # PWA icons (192x192, 512x512)
```

---

## API Endpoints

| Method | Endpoint | Περιγραφή |
|--------|----------|-----------|
| `POST` | `/api/register` | Εγγραφή νέου χρήστη |
| `POST` | `/api/login` | Σύνδεση χρήστη |
| `POST` | `/api/logout` | Αποσύνδεση |
| `GET` | `/api/me` | Έλεγχος authentication state |
| `POST` | `/api/forgot-password` | Αίτημα επαναφοράς κωδικού |
| `POST` | `/api/reset-password` | Ολοκλήρωση επαναφοράς κωδικού |

---

## Τεχνικές Λεπτομέρειες

### Caching Στρατηγική (Service Worker)
- **App shell** (HTML/CSS/JS): Cache-first — γρήγορο φόρτωμα, offline-ready
- **Map tiles** (CartoDB/OSM): Network-first με fallback στο cache
- **Google Fonts / Leaflet CDN**: Stale-while-revalidate

### Live Bus Tracking
- Ανανέωση θέσεων κάθε 30 δευτερόλεπτα μέσω Supabase Functions
- Οι markers λεωφορείων βρίσκονται σε ξεχωριστό layer για αποδοτικό toggling
- Χρώματα γραμμών υπολογίζονται αλγοριθμικά για μέγιστη διάκριση

### Δρομολόγια & Ώρες
- Παρεμβολή ωρών άφιξης βάσει συχνότητας και πρώτης/τελευταίας στάσης
- Ρεαλιστικές διαδρομές στο χάρτη μέσω OSRM (πραγματικό οδικό δίκτυο)

### Ασφάλεια
- Bcrypt comparison εκτελείται ακόμα και για ανύπαρκτους χρήστες (timing attack prevention)
- Password reset tokens: single-use, hashed στη βάση, λήξη 1 ώρας
- JWT σε httpOnly cookies (XSS protection)

---

## Εγκατάσταση ως PWA

Η εφαρμογή μπορεί να εγκατασταθεί απευθείας στη συσκευή σου:

- **Android (Chrome)**: Αγγίξτε "Προσθήκη στην αρχική οθόνη" στο menu του Chrome
- **iOS (Safari)**: Share → "Προσθήκη στην αρχική οθόνη"
- **Desktop**: Κλικ στο εικονίδιο εγκατάστασης στη γραμμή διεύθυνσης

---

## Licença

MIT License — Ελεύθερη χρήση, τροποποίηση και διανομή.
