const xlsx = require('xlsx-js-style');

try {
  const workbook = xlsx.readFile("C:\\Users\\yacouba.mohamed\\Documents\\Fichier_Paie\\Songon_Rapport HikCentral 17-23 Juillet 2026.xlsx");
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1 }); // read as array of arrays
  
  console.log("Sheet Name:", sheetName);
  console.log("Total rows:", data.length);
  for (let i = 0; i < Math.min(20, data.length); i++) {
    console.log(`Row ${i}:`, data[i]);
  }
} catch (err) {
  console.error("Error:", err.message);
}
