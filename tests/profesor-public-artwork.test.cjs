const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

test('all featured public games have their illustrated card artwork',()=>{
 const source=fs.readFileSync('apps/profesor/index.html','utf8');
 const names=[...source.matchAll(/artwork:'([^']+)'/g)].map(match=>match[1]);
 assert.ok(names.length>=29,'featured game artwork references are present');
 for(const name of names){
  const file=path.join('apps/profesor/assets/games',name);
  assert.ok(fs.existsSync(file),`missing card artwork: ${name}`);
  assert.ok(fs.statSync(file).size>1000,`empty card artwork: ${name}`);
 }
});
