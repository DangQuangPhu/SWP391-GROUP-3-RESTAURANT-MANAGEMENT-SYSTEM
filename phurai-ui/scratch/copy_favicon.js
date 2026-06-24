import fs from 'node:fs';

try {
    fs.copyFileSync('public/logo.png', 'public/favicon.ico');
    console.log('Successfully copied logo.png to favicon.ico');
} catch (e) {
    console.error('Failed to copy favicon:', e.message);
}
