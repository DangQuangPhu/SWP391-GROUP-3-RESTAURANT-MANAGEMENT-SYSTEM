import fs from 'fs';
import path from 'path';

// Use relative path to avoid sandbox blocks on absolute paths
const sqlPath = './database/System_Restaurant.sql';
let content = fs.readFileSync(sqlPath, 'utf8');

const lines = content.split('\n');
let currentTable = null;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();

  const insertMatch = line.match(/INSERT\s+INTO\s+dbo\.(\w+)/i);
  if (insertMatch) {
    currentTable = insertMatch[1];
    continue;
  }

  if (line.startsWith('GO') || line.toUpperCase().startsWith('SET IDENTITY_INSERT')) {
    if (!line.toUpperCase().includes(' ON')) {
      currentTable = null;
    }
  }

  if (currentTable && line.startsWith('(')) {
    const commentIdx = line.indexOf('--');
    let mainPart = commentIdx !== -1 ? line.substring(0, commentIdx) : line;
    const commentPart = commentIdx !== -1 ? line.substring(commentIdx) : '';

    let hasComma = mainPart.endsWith(',');
    let hasSemicolon = mainPart.endsWith(';');
    let cleanValuesStr = mainPart.trim();
    if (hasComma) cleanValuesStr = cleanValuesStr.slice(0, -1);
    if (hasSemicolon) cleanValuesStr = cleanValuesStr.slice(0, -1);
    
    if (cleanValuesStr.startsWith('(') && cleanValuesStr.endsWith(')')) {
      cleanValuesStr = cleanValuesStr.slice(1, -1);
    }

    const values = [];
    let currentVal = '';
    let inQuotes = false;
    for (let charIdx = 0; charIdx < cleanValuesStr.length; charIdx++) {
      const char = cleanValuesStr[charIdx];
      if (char === "'") {
        inQuotes = !inQuotes;
        currentVal += char;
      } else if (char === ',' && !inQuotes) {
        values.push(currentVal.trim());
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
    values.push(currentVal.trim());

    if (currentTable === 'Reservations') {
      const id = parseInt(values[0], 10);
      if (!isNaN(id) && id < 100000) {
        values[0] = String(id + 100000);
      }
    } else if (currentTable === 'ReservationTables') {
      const id = parseInt(values[0], 10);
      if (!isNaN(id) && id < 100000) {
        values[0] = String(id + 100000);
      }
    } else if (currentTable === 'PreorderItems') {
      const id = parseInt(values[1], 10);
      if (!isNaN(id) && id < 100000) {
        values[1] = String(id + 100000);
      }
    } else if (currentTable === 'QROrderSessions') {
      if (values[2] !== 'NULL') {
        const id = parseInt(values[2], 10);
        if (!isNaN(id) && id < 100000) {
          values[2] = String(id + 100000);
        }
      }
    } else if (currentTable === 'Orders') {
      const oid = parseInt(values[0], 10);
      if (!isNaN(oid) && oid < 100000) {
        values[0] = String(oid + 100000);
      }
      if (values[1] !== 'NULL') {
        const rid = parseInt(values[1], 10);
        if (!isNaN(rid) && rid < 100000) {
          values[1] = String(rid + 100000);
        }
      }
    } else if (currentTable === 'OrderItems') {
      const oid = parseInt(values[1], 10);
      if (!isNaN(oid) && oid < 100000) {
        values[1] = String(oid + 100000);
      }
    } else if (currentTable === 'Payments') {
      const pid = parseInt(values[0], 10);
      if (!isNaN(pid) && pid < 100000) {
        values[0] = String(pid + 100000);
      }
      const oid = parseInt(values[1], 10);
      if (!isNaN(oid) && oid < 100000) {
        values[1] = String(oid + 100000);
      }
    } else if (currentTable === 'CustomerReviews') {
      const oid = parseInt(values[2], 10);
      if (!isNaN(oid) && oid < 100000) {
        values[2] = String(oid + 100000);
      }
    }

    let reconstructed = '(' + values.join(', ') + ')';
    if (hasComma) reconstructed += ',';
    if (hasSemicolon) reconstructed += ';';
    if (commentPart) reconstructed += ' ' + commentPart;

    const indent = lines[i].match(/^\s*/)[0];
    lines[i] = indent + reconstructed;
  }
}

fs.writeFileSync(sqlPath, lines.join('\n'), 'utf8');
console.log('Successfully shifted seed IDs in System_Restaurant.sql!');
