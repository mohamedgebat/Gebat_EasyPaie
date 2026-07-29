const mysql = require('mysql2/promise');
const xlsx = require('xlsx');

const normalizeName = (name) => {
  if (!name) return '';
  return String(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
};

const matchWorkerRobust = (workers, nameStr) => {
  if (!nameStr) return null;
  const targetNorm = normalizeName(nameStr);
  return workers.find((w) => {
    const nomNorm = normalizeName(w.nom);
    const prenomNorm = normalizeName(w.prenom);
    const full1Norm = normalizeName((w.nom || '') + ' ' + (w.prenom || ''));
    const full2Norm = normalizeName((w.prenom || '') + ' ' + (w.nom || ''));
    if (nomNorm === targetNorm || full1Norm === targetNorm || full2Norm === targetNorm) return true;
    return false;
  });
};

(async () => {
  const response = await fetch('http://localhost:3000/api/ouvriers');
  const dbWorkers = await response.json();

  const filePath = String.raw`C:\Users\yacouba.mohamed\Documents\Fichiers_Test\Fichier_de_suivi_de_la_main_d'oeuvre 24 AU 30 JUILLET 2026 BINGERVILLE.xlsx`;
  const wb = xlsx.readFile(filePath);

  let totalFailedMatches = 0;
  const failedExamples = [];

  wb.SheetNames.forEach(sheetName => {
    const data = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], {header: 1});
    const headerRowIndex = data.findIndex(row => row && row.some(cell => cell && cell.toString().toUpperCase().includes('NOM ET PRENOMS')));
    
    if (headerRowIndex !== -1) {
      for (let i = headerRowIndex + 2; i < data.length; i++) {
          const row = data[i];
          if (!row || row.length === 0) continue;
          
          const netAPayerRaw = row[row.length - 1];
          const totalRaw = row[row.length - 3];

          // Same zero checking logic as ImportPointage.jsx
          const isZeroAmount = (val) => {
            if (val === null || val === undefined || val === '') return true;
            if (typeof val === 'number') return val === 0;
            const strVal = String(val).trim();
            if (strVal === '0' || strVal === '-' || strVal === '0,00' || strVal === '0.00' || strVal.toLowerCase() === 'zero') return true;
            return false;
          };

          if (isZeroAmount(netAPayerRaw) && isZeroAmount(totalRaw)) continue;
          if (isZeroAmount(netAPayerRaw) && !isZeroAmount(totalRaw)) continue;

          const name = row[1];
          if (name && typeof name !== 'number') {
              const matched = matchWorkerRobust(dbWorkers, name);
              if (!matched) {
                // If it wasn't matched, check if it EXISTS in the database with a partial match (to see if my robust function failed)
                const partialMatch = dbWorkers.find(w => w.nom.toLowerCase().includes(name.toLowerCase().split(' ')[0]));
                if (partialMatch) {
                    failedExamples.push(`Excel: "${name}" | DB: "${partialMatch.nom} ${partialMatch.prenom || ''}"`);
                }
              }
          }
      }
    }
  });

  console.log('--- POTENTIAL MATCH FAILURES ---');
  console.log(failedExamples.join('\n'));
  process.exit(0);
})().catch(console.error);
