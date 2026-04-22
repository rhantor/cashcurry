const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        if (file === 'node_modules' || file.startsWith('.')) return;
        const filepath = path.join(dir, file);
        const stat = fs.statSync(filepath);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(filepath));
        } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
            results.push(filepath);
        }
    });
    return results;
}

const targetDir = path.join(__dirname, 'app');
const files = walk(targetDir);

const regex = /\borange-(\d{2,3})\b/g;
let modifiedCount = 0;

files.forEach(filepath => {
    const content = fs.readFileSync(filepath, 'utf8');
    if (regex.test(content)) {
        const newContent = content.replace(regex, 'mint-$1');
        fs.writeFileSync(filepath, newContent, 'utf8');
        modifiedCount++;
    }
});

console.log(`Successfully replaced 'orange' tailwind classes with 'mint' in ${modifiedCount} files.`);
