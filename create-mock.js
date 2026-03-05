const xlsx = require('xlsx');

// ── Mock data for "Lines" sheet ──────────────────────────────────────────────
const linesData = [
    // Παλαιό Φάληρο
    { MunicipalityID: 'PF', MunicipalityName: 'Παλαιό Φάληρο', MunicipalityLat: 37.9285, MunicipalityLng: 23.7000, LineID: 'ΠΦ1', Name: 'Γραμμή ΠΦ1', Color: '#4f8ef7', Frequency: 12, StartTime: '06:00', EndTime: '22:30' },
    { MunicipalityID: 'PF', MunicipalityName: 'Παλαιό Φάληρο', MunicipalityLat: 37.9285, MunicipalityLng: 23.7000, LineID: 'ΠΦ2', Name: 'Γραμμή ΠΦ2', Color: '#a855f7', Frequency: 20, StartTime: '07:00', EndTime: '21:00' },

    // Άλιμος
    { MunicipalityID: 'AL', MunicipalityName: 'Άλιμος', MunicipalityLat: 37.9130, MunicipalityLng: 23.7230, LineID: 'ΑΛ1', Name: 'Γραμμή ΑΛ1', Color: '#22c55e', Frequency: 15, StartTime: '06:30', EndTime: '22:00' },

    // Νέα Σμύρνη
    { MunicipalityID: 'NS', MunicipalityName: 'Νέα Σμύρνη', MunicipalityLat: 37.9440, MunicipalityLng: 23.7145, LineID: 'ΝΣ1', Name: 'Γραμμή ΝΣ1', Color: '#ef4444', Frequency: 18, StartTime: '05:30', EndTime: '23:00' },
    { MunicipalityID: 'NS', MunicipalityName: 'Νέα Σμύρνη', MunicipalityLat: 37.9440, MunicipalityLng: 23.7145, LineID: 'ΝΣ2', Name: 'Γραμμή ΝΣ2', Color: '#f59e0b', Frequency: 25, StartTime: '07:00', EndTime: '20:30' },
];

// ── Mock data for "Stops" sheet ──────────────────────────────────────────────
const stopsData = [
    // ΠΦ1
    { LineID: 'ΠΦ1', StopID: 'pf1_1', StopName: 'Δημαρχείο Παλαιού Φαλήρου', Lat: 37.9302, Lng: 23.7010, Order: 1 },
    { LineID: 'ΠΦ1', StopID: 'pf1_2', StopName: 'Εδέμ', Lat: 37.9268, Lng: 23.6985, Order: 2 },
    { LineID: 'ΠΦ1', StopID: 'pf1_3', StopName: 'Αγία Τριάδα', Lat: 37.9240, Lng: 23.6960, Order: 3 },
    { LineID: 'ΠΦ1', StopID: 'pf1_4', StopName: 'Παραλία Φαλήρου', Lat: 37.9215, Lng: 23.7030, Order: 4 },

    // ΠΦ2
    { LineID: 'ΠΦ2', StopID: 'pf2_1', StopName: 'Καβουράκια', Lat: 37.9350, Lng: 23.7050, Order: 1 },
    { LineID: 'ΠΦ2', StopID: 'pf2_2', StopName: 'Νέο Φάληρο', Lat: 37.9330, Lng: 23.6940, Order: 2 },
    { LineID: 'ΠΦ2', StopID: 'pf2_3', StopName: 'Τράμ Φαλήρου', Lat: 37.9298, Lng: 23.6920, Order: 3 },

    // ΑΛ1
    { LineID: 'ΑΛ1', StopID: 'al1_1', StopName: 'Δημαρχείο Αλίμου', Lat: 37.9155, Lng: 23.7240, Order: 1 },
    { LineID: 'ΑΛ1', StopID: 'al1_2', StopName: 'Καλαμάκι', Lat: 37.9120, Lng: 23.7285, Order: 2 },
    { LineID: 'ΑΛ1', StopID: 'al1_3', StopName: 'Παραλία Αλίμου', Lat: 37.9080, Lng: 23.7310, Order: 3 },
    { LineID: 'ΑΛ1', StopID: 'al1_4', StopName: 'Πλατεία Αλίμου', Lat: 37.9175, Lng: 23.7200, Order: 4 },

    // ΝΣ1
    { LineID: 'ΝΣ1', StopID: 'ns1_1', StopName: 'Πλατεία Νέας Σμύρνης', Lat: 37.9460, Lng: 23.7150, Order: 1 },
    { LineID: 'ΝΣ1', StopID: 'ns1_2', StopName: 'Άγιος Σώστης', Lat: 37.9430, Lng: 23.7130, Order: 2 },
    { LineID: 'ΝΣ1', StopID: 'ns1_3', StopName: 'Άλσος Νέας Σμύρνης', Lat: 37.9412, Lng: 23.7105, Order: 3 },

    // ΝΣ2
    { LineID: 'ΝΣ2', StopID: 'ns2_1', StopName: 'Ανούσης', Lat: 37.9475, Lng: 23.7175, Order: 1 },
    { LineID: 'ΝΣ2', StopID: 'ns2_2', StopName: 'Κεντρική Αγορά', Lat: 37.9450, Lng: 23.7190, Order: 2 },
    { LineID: 'ΝΣ2', StopID: 'ns2_3', StopName: 'Σχολεία', Lat: 37.9425, Lng: 23.7160, Order: 3 },
    { LineID: 'ΝΣ2', StopID: 'ns2_4', StopName: 'Λαϊκή Αγορά', Lat: 37.9400, Lng: 23.7140, Order: 4 },
];

// ── Build workbook ───────────────────────────────────────────────────────────
const wb = xlsx.utils.book_new();
xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(linesData), 'Lines');
xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(stopsData), 'Stops');

xlsx.writeFile(wb, 'municipalities_data.xlsx');
console.log('Mock Excel αρχείο δημιουργήθηκε: municipalities_data.xlsx');
