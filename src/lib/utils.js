import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount) {
  const num = Math.round(Number(amount) || 0);
  return num.toLocaleString('fr-FR', { useGrouping: true }).replace(/\s/g, ' ').replace(/\u202F/g, ' ') + ' F CFA';
}

export function formatCurrencySigned(amount) {
  const num = Math.round(Number(amount) || 0);
  if (num === 0) return '-';
  const formatted = Math.abs(num).toLocaleString('fr-FR', { useGrouping: true }).replace(/\s/g, ' ').replace(/\u202F/g, ' ') + ' F CFA';
  return num > 0 ? `+ ${formatted}` : `- ${formatted}`;
}

export function formatDate(date) {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) {
    return String(date);
  }
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

export function formatShortDate(dateVal) {
  if (!dateVal) return '';
  if (typeof dateVal === 'string' && dateVal.includes('/')) {
    const parts = dateVal.split('/');
    if (parts.length >= 3) {
      const yy = parts[2].length === 4 ? parts[2].slice(-2) : parts[2];
      return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${yy}`;
    } else if (parts.length === 2) {
      return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}`;
    }
  }
  const d = dateVal instanceof Date ? dateVal : new Date(String(dateVal).split('T')[0]);
  if (!isNaN(d.getTime())) {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    return `${day}/${month}/${yy}`;
  }
  return String(dateVal);
}

export function formatWeekLabel(weekStr, records = []) {
  if (!weekStr) return '-';
  const yearPart = weekStr.includes('-S') ? weekStr.split('-S')[0] : '';
  const wNum = weekStr.includes('-S') ? weekStr.split('-S')[1] : weekStr;
  
  const yearPrefix = yearPart ? `${yearPart} - ` : '';

  const recWithInterval = records.find(r => r.semaine === weekStr && r.date_debut && r.date_fin);
  if (recWithInterval) {
    return `${yearPrefix}Sem ${wNum} (${formatShortDate(recWithInterval.date_debut)} au ${formatShortDate(recWithInterval.date_fin)})`;
  }

  const recWithDate = records.find(r => r.semaine === weekStr && (r.date_pointage || r.date));
  if (recWithDate) {
    const d = new Date(recWithDate.date_pointage || recWithDate.date);
    if (!isNaN(d.getTime())) {
      const day = d.getDay();
      const diffToFriday = day >= 5 ? (5 - day) : (-2 - day);
      const friday = new Date(new Date(d).setDate(d.getDate() + diffToFriday));
      const thursday = new Date(new Date(friday).setDate(friday.getDate() + 6));
      return `${yearPrefix}Sem ${wNum} (${formatShortDate(friday)} au ${formatShortDate(thursday)})`;
    }
  }

  if (weekStr.includes('-S')) {
    try {
      const [yearStr, wStr] = weekStr.split('-S');
      const year = parseInt(yearStr, 10);
      const week = parseInt(wStr, 10);
      if (!isNaN(year) && !isNaN(week)) {
        const simple = new Date(year, 0, 1 + (week - 1) * 7);
        const dayOfWeek = simple.getDay();
        const isoWeekStart = new Date(simple);
        if (dayOfWeek <= 4) {
          isoWeekStart.setDate(simple.getDate() - simple.getDay() + 1);
        } else {
          isoWeekStart.setDate(simple.getDate() + 8 - simple.getDay());
        }
        const friday = new Date(new Date(isoWeekStart).setDate(isoWeekStart.getDate() - 3));
        const thursday = new Date(new Date(friday).setDate(friday.getDate() + 6));
        return `${yearPrefix}Sem ${wNum} (${formatShortDate(friday)} au ${formatShortDate(thursday)})`;
      }
    } catch (e) {}
  }

  return `${yearPrefix}Sem ${wNum}`;
}

export function getWeekDateRange(weekStr, records = []) {
  if (!weekStr) return { start: '', end: '' };
  
  const recWithInterval = records.find(r => r.semaine === weekStr && r.date_debut && r.date_fin);
  if (recWithInterval) {
    return {
      start: String(recWithInterval.date_debut).split('T')[0],
      end: String(recWithInterval.date_fin).split('T')[0]
    };
  }

  const recWithDate = records.find(r => r.semaine === weekStr && (r.date_pointage || r.date));
  if (recWithDate) {
    const d = new Date(recWithDate.date_pointage || recWithDate.date);
    if (!isNaN(d.getTime())) {
      const day = d.getDay();
      const diffToFriday = day >= 5 ? (5 - day) : (-2 - day);
      const friday = new Date(new Date(d).setDate(d.getDate() + diffToFriday));
      const thursday = new Date(new Date(friday).setDate(friday.getDate() + 6));
      return {
        start: friday.toISOString().split('T')[0],
        end: thursday.toISOString().split('T')[0]
      };
    }
  }

  if (weekStr.includes('-S')) {
    try {
      const [yearStr, wStr] = weekStr.split('-S');
      const year = parseInt(yearStr, 10);
      const week = parseInt(wStr, 10);
      if (!isNaN(year) && !isNaN(week)) {
        const simple = new Date(year, 0, 1 + (week - 1) * 7);
        const dayOfWeek = simple.getDay();
        const isoWeekStart = new Date(simple);
        if (dayOfWeek <= 4) {
          isoWeekStart.setDate(simple.getDate() - simple.getDay() + 1);
        } else {
          isoWeekStart.setDate(simple.getDate() + 8 - simple.getDay());
        }
        const friday = new Date(new Date(isoWeekStart).setDate(isoWeekStart.getDate() - 3));
        const thursday = new Date(new Date(friday).setDate(friday.getDate() + 6));
        return {
          start: friday.toISOString().split('T')[0],
          end: thursday.toISOString().split('T')[0]
        };
      }
    } catch (e) {}
  }

  return { start: '', end: '' };
}

export function getWeekNumber(dateVal) {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '';
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNumber = 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  return `${d.getFullYear()}-S${String(weekNumber).padStart(2, '0')}`;
}

export const extractSiteFromFilename = (filename) => {
  if (!filename || typeof filename !== 'string') return '';
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '').trim();
  
  const knownSites = ['SONGON', 'BINGERVILLE', 'CHATEAU', 'ABIDJAN', 'YAMOUSSOUKRO', 'BOUAKE', 'SAN PEDRO', 'KORHOGO', 'DALOA', 'GAGNOA', 'ASSINIE', 'BASSAM'];
  for (const s of knownSites) {
    if (new RegExp(`\\b${s}\\b$`, 'i').test(nameWithoutExt)) return s;
  }
  for (const s of knownSites) {
    if (new RegExp(`\\b${s}\\b`, 'i').test(nameWithoutExt)) return s;
  }

  const parts = nameWithoutExt.split(/[\s-_/]+/).filter(Boolean);
  if (parts.length > 0) {
    const lastWord = parts[parts.length - 1].toUpperCase();
    const forbidden = [
      'PAIE', 'POINTAGE', 'MAIN', 'OEUVRE', 'HEBDOMADAIRE', 'NORMAL', 'SHIFT', 'ATTENDANCE', 'SUMMARY', 'RECORD',
      'XLSX', 'XLS', 'CSV', 'FICHIER', 'SUIVI', 'AU', 'DU', 'DE', 'LE', 'LA', 'ET', 'EN',
      'JANVIER', 'FEVRIER', 'MARS', 'AVRIL', 'MAI', 'JUIN', 'JUILLET', 'AOUT', 'SEPTEMBRE', 'OCTOBRE', 'NOVEMBRE', 'DECEMBRE',
      '2024', '2025', '2026', '2027', '2028', '2029', '2030'
    ];
    if (!/^\d+$/.test(lastWord) && isNaN(Number(lastWord)) && !forbidden.includes(lastWord) && lastWord.length >= 3) {
      return lastWord;
    }
  }
  return '';
};

export function extractWorkbookMetadata(workbook, filename = '', XLSX = null) {
  const textToCheck = [];
  if (filename) textToCheck.push(filename);

  if (workbook && workbook.SheetNames && XLSX) {
    workbook.SheetNames.forEach(sheetName => {
      textToCheck.push(sheetName);
      const sheet = workbook.Sheets[sheetName];
      if (sheet) {
        try {
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          for (let i = 0; i < Math.min(25, rows.length); i++) {
            if (rows[i] && Array.isArray(rows[i])) {
              textToCheck.push(rows[i].filter(Boolean).join(' '));
            }
          }
        } catch (e) {}
      }
    });
  }

  const combined = textToCheck.join(' | ');

  // 1. Détection du Site / Chantier (du titre / en-tête / nom du fichier)
  let site = extractSiteFromFilename(filename);
  const knownSites = ['SONGON', 'BINGERVILLE', 'CHATEAU', 'ABIDJAN', 'YAMOUSSOUKRO', 'BOUAKE', 'SAN PEDRO', 'KORHOGO', 'DALOA', 'GAGNOA', 'ASSINIE', 'BASSAM'];
  const sortedKnown = [...knownSites].sort((a, b) => b.length - a.length);

  // Vérifier d'abord les sites connus exactement dans la chaîne
  if (!site) {
    for (const s of sortedKnown) {
      if (new RegExp(`\\b${s}\\b`, 'i').test(combined)) {
        site = s;
        break;
      }
    }
  }

  // Si non trouvé, vérifier avec le pattern dynamique CHANTIER / SITE (en éliminant AIDE CHANTIER et les nombres purs comme 4500)
  if (!site) {
    const cleanCombined = combined.replace(/AIDE\s+CHANTIER/gi, 'AIDE_OUVRIER');
    const dynamicHeaderMatch = cleanCombined.match(/(?:CHANTIER|SITE|PROJET)(?:\s+DE|\s*[:-])?\s+([A-Z][A-Z0-9_-]{2,20})/i);
    if (dynamicHeaderMatch && dynamicHeaderMatch[1]) {
      const candidate = dynamicHeaderMatch[1].toUpperCase();
      if (!/^\d+$/.test(candidate) && isNaN(Number(candidate)) && !['PAIE', 'POINTAGE', 'MAIN', 'HEBDOMADAIRE', 'NORMAL', 'SHIFT', 'ATTENDANCE', 'SUMMARY', 'RECORD'].includes(candidate)) {
        site = candidate;
      }
    }
  }

  if (!site) {
    if (/BINGERVILLE|BENGERVILLE|BENGUERVILLE|BINGERVIL/i.test(combined)) site = 'BINGERVILLE';
    else if (/SONGON|SONGO|SONGONG/i.test(combined)) site = 'SONGON';
  }
  if (!site) site = 'SONGON';

  // 2. Détection de la Période / Dates (du titre / en-tête / nom du fichier)
  let start = '';
  let end = '';
  let label = '';
  let week = '';

  const monthMap = {
    'janvier': '01', 'février': '02', 'fevrier': '02', 'mars': '03', 'avril': '04', 'mai': '05', 'juin': '06',
    'juillet': '07', 'août': '08', 'aout': '08', 'septembre': '09', 'octobre': '10', 'novembre': '11', 'décembre': '12', 'decembre': '12',
    'january': '01', 'february': '02', 'march': '03', 'april': '04', 'may': '05', 'june': '06',
    'july': '07', 'august': '08', 'september': '09', 'october': '10', 'november': '11', 'december': '12'
  };

  const frRegex = /(?:DU\s+|DE\s+)?(\d{1,2})\s+(?:([a-zûéèäöü]+)\s+)?(?:(\d{4})\s+)?(?:AU|A|au|à|-|_)\s*(\d{1,2})\s+([a-zûéèäöü]+)\s+(\d{4})/i;
  const frMatch = combined.match(frRegex);
  if (frMatch) {
    const dayStart = frMatch[1].padStart(2, '0');
    const monthStartStr = frMatch[2] || frMatch[5];
    const yearStart = frMatch[3] || frMatch[6];
    const dayEnd = frMatch[4].padStart(2, '0');
    const monthEndStr = frMatch[5];
    const yearEnd = frMatch[6];

    const mStart = monthMap[monthStartStr.toLowerCase()] || '07';
    const mEnd = monthMap[monthEndStr.toLowerCase()] || '07';

    start = `${yearStart}-${mStart}-${dayStart}`;
    end = `${yearEnd}-${mEnd}-${dayEnd}`;
    label = `${dayStart} ${monthStartStr.toUpperCase()} AU ${dayEnd} ${monthEndStr.toUpperCase()} ${yearEnd}`;
  } else {
    const frRegex2 = /(\d{1,2})\s*[-_àaAuU]+\s*(\d{1,2})\s+([a-zA-Zûéèäöü]+)\s+(\d{4})/i;
    const frMatch2 = combined.match(frRegex2);
    if (frMatch2) {
      const dayStart = frMatch2[1].padStart(2, '0');
      const dayEnd = frMatch2[2].padStart(2, '0');
      const monthStr = frMatch2[3];
      const year = frMatch2[4];
      
      const m = monthMap[monthStr.toLowerCase()] || '07';
      start = `${year}-${m}-${dayStart}`;
      end = `${year}-${m}-${dayEnd}`;
      label = `${dayStart} AU ${dayEnd} ${monthStr.toUpperCase()} ${year}`;
    }
  }

  if (!start) {
    const numRegex = /(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\s*(?:AU|A|au|à|-|_)\s*(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/i;
    const numMatch = combined.match(numRegex);
    if (numMatch) {
      let y1 = numMatch[3].length === 2 ? `20${numMatch[3]}` : numMatch[3];
      let y2 = numMatch[6].length === 2 ? `20${numMatch[6]}` : numMatch[6];
      start = `${y1}-${numMatch[2].padStart(2, '0')}-${numMatch[1].padStart(2, '0')}`;
      end = `${y2}-${numMatch[5].padStart(2, '0')}-${numMatch[4].padStart(2, '0')}`;
      label = `${numMatch[1].padStart(2, '0')}/${numMatch[2].padStart(2, '0')} AU ${numMatch[4].padStart(2, '0')}/${numMatch[5].padStart(2, '0')} ${y2}`;
    }
  }

  const weekRegex = /(?:SEMAINE|SEM|WEEK)\s*[:#-]?\s*(\d{1,2})/i;
  const wMatch = combined.match(weekRegex);
  if (wMatch && wMatch[1]) {
    const wNum = parseInt(wMatch[1], 10);
    const y = start ? start.split('-')[0] : '2026';
    week = `${y}-S${String(wNum).padStart(2, '0')}`;
  }

  if (start && !week) {
    week = getWeekNumber(start);
  } else if (week && !start) {
    const range = getWeekDateRange(week);
    if (range.start) {
      start = range.start;
      end = range.end;
      label = `SEM ${week.split('-S')[1]} (${formatShortDate(start)} AU ${formatShortDate(end)})`;
    }
  }

  return {
    site,
    period: {
      start: start || '',
      end: end || '',
      week: week || '',
      label: label || (start && end ? `${formatShortDate(start)} AU ${formatShortDate(end)}` : '')
    }
  };
}
