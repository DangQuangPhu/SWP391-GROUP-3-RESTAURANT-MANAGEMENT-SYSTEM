import fs from 'fs';

const filepath = './server/email.js';
const content = fs.readFileSync(filepath, 'utf8');
const lines = content.split('\n');

const fixedLines = lines.map((line, i) => {
    if (i >= 1170) {
        return line.replace(/\\`/g, '`').replace(/\\\$/g, '$');
    }
    return line;
});

fs.writeFileSync(filepath, fixedLines.join('\n'), 'utf8');
console.log('Fixed email.js');
