const xlsx = require('xlsx-js-style');
const fs = require('fs');

const fileBuf = fs.readFileSync('C:/Users/yacouba.mohamed/Documents/Fichier_Paie/Songon_Rapport HikCentral 17-23 Juillet 2026.xlsx');
const wb = xlsx.read(fileBuf, {type: 'buffer'});
const sheet = wb.Sheets[wb.SheetNames[0]];
const sumJson = xlsx.utils.sheet_to_json(sheet, {header: 1});

const parsedDays = ['Vendredi', 'Samedi', 'Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi'];
const headers = sumJson[0];
const nameIdx = headers.indexOf('Nom et prénoms');
const deptIdx = headers.indexOf('Département');
const idIdx = headers.indexOf('ID');
const jourIdx = headers.indexOf('Jour');
const statusIdx = headers.indexOf('Statut');

const workerMap = new Map();

for (let i = 1; i < sumJson.length; i++) {
  const row = sumJson[i];
  if (!row || !row[nameIdx]) continue;
  
  const rawName = row[nameIdx];
  const name = rawName.toString().trim().toUpperCase();
  if (!name) continue;
  
  let worker = workerMap.get(name);
  if (!worker) {
    let rawDept = (row[deptIdx] || 'Aide Chantier').trim();
    let deptUpper = rawDept.toUpperCase();
    let dept = rawDept;
    if (deptUpper.includes('MACON') || deptUpper.includes('MAÇON')) dept = 'MACONS';
    else if (deptUpper.includes('FERRAIL') || deptUpper.includes('FERAIL')) dept = 'FERRAILLEURS';
    else if (deptUpper.includes('COFFR')) dept = 'COFFREURS';
    else if (deptUpper.includes('PLOMB')) dept = 'PLOMBIERS';
    else if (deptUpper.includes('ENGIN')) dept = "CONDUCTEUR D'ENGINS";
    else if (deptUpper.includes('BETON') || deptUpper.includes('PAVE') || deptUpper.includes('PAVÉ')) dept = 'OPERATEUR BETONNIERE';
    else if (deptUpper.includes('AIDE')) dept = 'AIDE CHANTIER';
    else if (deptUpper.includes('GEBAT')) dept = 'GEBAT';
    else dept = deptUpper;
    
    workerMap.set(name, { id: row[idIdx], name, dept, daily: {}, totalWorkDays: 0 });
    worker = workerMap.get(name);
  }
  
  let earliest = Infinity;
  let latest = -Infinity;
  const timeToMinutes = (t) => {
    if (!t || t === '--:--' || typeof t !== 'string') return null;
    const [h, m] = t.split(':');
    return parseInt(h) * 60 + parseInt(m);
  };
  ['Entrée 1', 'Sortie 1', 'Entrée 2', 'Sortie 2', 'Entrée 3', 'Sortie 3'].forEach(col => {
    const idx = headers.indexOf(col);
    if (idx !== -1) {
      const min = timeToMinutes(row[idx]);
      if (min !== null) {
        if (min < earliest) earliest = min;
        if (min > latest) latest = min;
      }
    }
  });

  let days = 0;
  if (earliest !== Infinity) {
    if (earliest <= 8.5 * 60 && latest >= 17 * 60) {
      days = 1;
    } else {
      if (earliest <= 10 * 60 && latest >= 12 * 60) days += 0.5;
      if (earliest <= 14.5 * 60 && latest >= 16 * 60) days += 0.5;
      if (days > 1) days = 1;
    }
  }

  if (days === 0 && statusIdx !== -1) {
     const status = row[statusIdx];
     if (status && typeof status === 'string' && (status.includes("Présent") || status.includes("Normal"))) {
         days = 1;
     }
  }

  const dayName = (row[jourIdx] || '').toString().trim();
  if (days > 0 && dayName) {
    const matchedDayIdx = parsedDays.findIndex(d => d.toLowerCase() === dayName.toLowerCase());
    if (matchedDayIdx !== -1) {
      worker.daily[matchedDayIdx] = days;
    }
  }
}

const processedWorkers = [];
for (const worker of workerMap.values()) {
  const baseRate = 7500;
  let totalWorkDays = 0;
  for (let d = 0; d < 7; d++) {
    totalWorkDays += worker.daily[d] || 0;
  }
  worker.totalWorkDays = totalWorkDays;
  worker.netPay = totalWorkDays * baseRate;
  processedWorkers.push(worker);
}

const maconsOut = processedWorkers.filter(w => w.dept === 'MACONS' && w.netPay > 0);
console.log('Total MACONS with netPay > 0:', maconsOut.length);
console.log(maconsOut.map(w => w.name));
