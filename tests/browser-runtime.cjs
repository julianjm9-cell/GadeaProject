const fs=require('node:fs');
let runtime;
try { runtime=require('playwright'); }
catch(error) {
  const local=process.env.PLAYWRIGHT_MODULE_PATH || 'C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright';
  if(!fs.existsSync(local))throw Error('Instala las dependencias de prueba con npm ci y los navegadores con npx playwright install chromium webkit.');
  runtime=require(local);
}
module.exports={...runtime,chromium:new Proxy(runtime.chromium,{get(target,name){
  if(name==='launch')return options=>{const settings={...options};if(process.platform!=='win32')delete settings.channel;return target.launch(settings);};
  const value=Reflect.get(target,name);return typeof value==='function'?value.bind(target):value;
}})};
