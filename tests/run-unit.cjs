const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
function scan(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(row=>row.isDirectory()?scan(path.join(dir,row.name)):[path.join(dir,row.name)]);}
const files=['apps/profesor/tests','apps/e25/tests','tests','admin'].flatMap(scan).filter(file=>file.endsWith('.test.cjs')&&!file.includes('browser'));
const result=spawnSync(process.execPath,['--test','--test-concurrency=2',...files],{stdio:'inherit'});process.exit(result.status??1);
