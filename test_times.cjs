const xlsx = require('xlsx-js-style');

const timeToMinutes = (timeStr) => {
  if (!timeStr || timeStr === '--:--' || typeof timeStr !== 'string') return null;
  const [h, m] = timeStr.split(':');
  if (h === undefined || m === undefined) return null;
  return parseInt(h) * 60 + parseInt(m);
};

const calculateHikCentralDays = (row, headers) => {
  const times = [];
  ['Entrée 1', 'Sortie 1', 'Entrée 2', 'Sortie 2', 'Entrée 3', 'Sortie 3'].forEach(col => {
    const idx = headers.indexOf(col);
    if (idx !== -1) {
      const min = timeToMinutes(row[idx]);
      if (min !== null) times.push(min);
    }
  });

  if (times.length === 0) return 0;
  
  const earliest = Math.min(...times);
  const latest = Math.max(...times);
  
  let days = 0;
  // Morning shift: from ~08:00 to ~12:30
  // Arrives before 10:00 and leaves after 12:00
  if (earliest <= 10 * 60 && latest >= 12 * 60) {
    days += 0.5;
  }
  
  // Afternoon shift: from ~13:00 to ~17:30
  // Arrives before 14:30 and leaves after 16:00
  if (earliest <= 14.5 * 60 && latest >= 16 * 60) {
    days += 0.5;
  }
  
  return days;
};

try {
  const workbook = xlsx.readFile("C:\\Users\\yacouba.mohamed\\Documents\\Fichier_Paie\\Songon_Rapport HikCentral 17-23 Juillet 2026.xlsx");
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1 }); 
  
  const headers = data[0];
  console.log(headers);
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row.length === 0 || !row[0]) continue;
    
    const days = calculateHikCentralDays(row, headers);
    if (days > 0 || (row[headers.indexOf('Statut')] && row[headers.indexOf('Statut')].includes('Présent'))) {
      console.log(`Row ${i} (${row[1]}): Status: ${row[headers.indexOf('Statut')]}, Earliest/Latest... Days calculated: ${days}`);
    }
  }
} catch (err) {
  console.error("Error:", err.message);
}
