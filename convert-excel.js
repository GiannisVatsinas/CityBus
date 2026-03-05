const xlsx = require('xlsx');
const fs = require('fs');

function convertExcelToJson() {
    const workbook = xlsx.readFile('municipalities_data.xlsx');
    const linesSheet = xlsx.utils.sheet_to_json(workbook.Sheets['Lines']);
    const stopsSheet = xlsx.utils.sheet_to_json(workbook.Sheets['Stops']);

    const municipalitiesData = {};

    // 1. Build municipality + line structure from Lines sheet
    linesSheet.forEach(row => {
        const munId = row.MunicipalityID;

        if (!municipalitiesData[munId]) {
            municipalitiesData[munId] = {
                id: munId,
                name: row.MunicipalityName,
                center: [row.MunicipalityLat, row.MunicipalityLng],
                lines: {}
            };
        }

        municipalitiesData[munId].lines[row.LineID] = {
            name: row.Name,
            color: row.Color,
            freq: row.Frequency,
            hours: { start: row.StartTime, end: row.EndTime },
            stops: []
        };
    });

    // 2. Group stops by LineID
    const stopsByLine = {};
    stopsSheet.forEach(stop => {
        if (!stopsByLine[stop.LineID]) stopsByLine[stop.LineID] = [];
        stopsByLine[stop.LineID].push({
            id: stop.StopID,
            name: stop.StopName,
            coords: [stop.Lat, stop.Lng],
            order: stop.Order
        });
    });

    // 3. Attach sorted stops to each line
    Object.keys(municipalitiesData).forEach(munId => {
        Object.keys(municipalitiesData[munId].lines).forEach(lineId => {
            const stops = (stopsByLine[lineId] || [])
                .sort((a, b) => a.order - b.order)
                .map(({ order, ...rest }) => rest); // remove 'order' from output
            municipalitiesData[munId].lines[lineId].stops = stops;
        });
    });

    fs.writeFileSync('data.json', JSON.stringify(municipalitiesData, null, 2), 'utf-8');
    console.log('data.json δημιουργήθηκε επιτυχώς με', Object.keys(municipalitiesData).length, 'δήμους.');
}

convertExcelToJson();
