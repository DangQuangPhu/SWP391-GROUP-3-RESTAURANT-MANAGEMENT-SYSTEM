import fs from 'fs';
import path from 'path';

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

// No copy
// Replace all occurrences in src and server
['src', 'server'].forEach(dir => {
    walkDir(dir, (filepath) => {
        if (filepath.endsWith('.js') || filepath.endsWith('.jsx')) {
            const content = fs.readFileSync(filepath, 'utf8');
            if (content.includes('reservationStatus.js')) {
                fs.writeFileSync(filepath, content.replace(/reservationStatus\.js/g, 'resStatus.js'), 'utf8');
                console.log('Updated ' + filepath);
            }
        }
    });
});

console.log('Done');
