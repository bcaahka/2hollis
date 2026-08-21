import fs from 'fs';

const p = 'ios/App/CapApp-SPM/Package.swift';
let s = fs.readFileSync(p, 'utf8');
s = s.replace(/path: "([^"]+)"/g, (_, path) => `path: "${path.replace(/\\/g, '/')}"`);
fs.writeFileSync(p, s);
console.log('normalized Package.swift paths');
