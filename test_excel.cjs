const xlsx = require('xlsx');
const path = require('path');
const filePath = String.raw`C:\Users\yacouba.mohamed\Documents\Fichiers_Test\Fichier_de_suivi_de_la_main_d'oeuvre 24 AU 30 JUILLET 2026 BINGERVILLE.xlsx`;
const wb = xlsx.readFile(filePath);

const results = [];

wb.SheetNames.forEach(sheetName => {
  const data = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], {header: 1});
  const headerRowIndex = data.findIndex(row => row && row.some(cell => cell && cell.toString().toUpperCase().includes('NOM ET PRENOMS')));
  
  if (headerRowIndex !== -1) {
    for (let i = headerRowIndex + 2; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length === 0) continue;
        const name = row[1];
        if (name && typeof name !== 'number') {
            results.push(name);
        }
    }
  }
});

console.log('--- NOMS EXTRAITS DU FICHIER ---');
console.log(results.slice(0, 50).join('\n'));
