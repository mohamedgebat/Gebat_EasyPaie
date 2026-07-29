const xlsx = require('xlsx');
const fs = require('fs');

const normalizeName = (name) => {
    if (!name) return '';
    return String(name)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Enlever les accents
      .toLowerCase();
};
const cleanAlphanum = (name) => name.replace(/[^a-z0-9]/g, '');
const levenshteinDistance = (a, b) => {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
            matrix[i][j] = matrix[i - 1][j - 1];
        } else {
            matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
        }
        }
    }
    return matrix[b.length][a.length];
};
const areWordsSubset = (words1, words2) => {
    const shorter = words1.length <= words2.length ? words1 : words2;
    const longer = words1.length <= words2.length ? words2 : words1;
    const validShorter = shorter.filter(w => w.length > 1 || shorter.length === 1);
    if (validShorter.length === 0) return false;
    let matches = 0;
    for (const w1 of validShorter) {
        if (longer.some(w2 => w2 === w1 || levenshteinDistance(w1, w2) <= 1)) {
        matches++;
        }
    }
    return matches === validShorter.length;
};

const matchWorkerRobust = (workers, nameStr) => {
    if (!nameStr) return null;
    const targetBase = normalizeName(nameStr);
    const targetNorm = cleanAlphanum(targetBase);
    const targetWords = targetBase.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w);
    
    return workers.find((w) => {
        const nomBase = normalizeName(w.nom);
        const prenomBase = normalizeName(w.prenom);
        const full1Base = `${nomBase} ${prenomBase}`.trim();
        const full2Base = `${prenomBase} ${nomBase}`.trim();
        const nomNorm = cleanAlphanum(nomBase);
        const full1Norm = cleanAlphanum(full1Base);
        const full2Norm = cleanAlphanum(full2Base);
        
        if (nomNorm === targetNorm || full1Norm === targetNorm || full2Norm === targetNorm) return true;
        if (targetNorm.length > 5 && full1Norm.length > 5) {
        if (levenshteinDistance(targetNorm, full1Norm) <= 2) return true;
        if (levenshteinDistance(targetNorm, full2Norm) <= 2) return true;
        if (levenshteinDistance(targetNorm, nomNorm) <= 2) return true;
        }
        const dbWords = full1Base.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w);
        if (dbWords.length > 1 && targetWords.length > 1) {
        if (areWordsSubset(targetWords, dbWords)) return true;
        }
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
                        failedExamples.push(`FAILED: ${name}`);
                        totalFailedMatches++;
                    }
                }
            }
        }
    });

    console.log(`--- TOTAL FAILURES: ${totalFailedMatches} ---`);
    console.log(failedExamples.join('\n'));
    process.exit(0);
})().catch(console.error);
