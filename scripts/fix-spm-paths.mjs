import fs from 'fs';

const pkg = 'ios/App/CapApp-SPM/Package.swift';
let s = fs.readFileSync(pkg, 'utf8');
s = s.replace(/path: "([^"]+)"/g, (_, path) => `path: "${path.replace(/\\/g, '/')}"`);
fs.writeFileSync(pkg, s);
console.log('normalized Package.swift paths');

// Local plugins are not discovered by `cap sync` — keep NowPlaying in the class list.
const capJsonPath = 'ios/App/App/capacitor.config.json';
const capJson = JSON.parse(fs.readFileSync(capJsonPath, 'utf8'));
const list = Array.isArray(capJson.packageClassList) ? capJson.packageClassList : [];
if (!list.includes('NowPlayingPlugin')) {
  list.push('NowPlayingPlugin');
  capJson.packageClassList = list;
  fs.writeFileSync(capJsonPath, `${JSON.stringify(capJson, null, '\t')}\n`);
  console.log('added NowPlayingPlugin to packageClassList');
}
