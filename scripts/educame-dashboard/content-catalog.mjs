import { readFile, writeFile, realpath, lstat } from 'node:fs/promises';
import { join, relative, isAbsolute } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { parse as javascript } from 'acorn';
import { parse as html } from 'parse5';
import { products } from './changes.mjs';
import { OperationError } from './operations.mjs';

const exec = promisify(execFile);
const hash = value => createHash('sha256').update(value).digest('hex');
const sourceHash = value => hash(value.replaceAll('\r\n','\n'));
const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const rootPaths = { profesor:'apps/profesor/', eso:'apps/e25/', ingles:'apps/cambridge/', diplomator:'apps/diplomator/', universidad:'apps/u25/', facturas:'apps/ocr/', gadeos:'apps/gadeos/' };
const technical = /^(?:ids?|\w+_id|\w+Id|slug|type|kind|key|className|class|style|icon|image|artwork|src|url|href|path|route|selector|product|version|storageKey|code|password|token|apiKey|modules|moduleIds|topicIds|lessonIds|gameIds)$/i;
const educational = /^(?:title|name|text|body|content|prompt|question|answer|solution|correct|correctIndex|explanation|why|feedback|hint|clue|brief|story|description|objective|summary|example|idea|label|subtitle|instructions|concepts|examples|options|answers|choices|steps|items|pairs|rows|terms|definitions|accepted|alternatives|commonErrors|tips|rules|notes|meaning|word|sentence|translation|value|left|right|a|b|q|es|en)$/i;
const calls = /^(?:step|round|question|quiz|race|match|bingo|select|memory|card|item|mission|task|makeQuestion|choice|pair)$/i;
const labels = {title:'Título',name:'Nombre',text:'Texto',body:'Contenido',content:'Contenido',prompt:'Enunciado',question:'Pregunta',answer:'Respuesta',solution:'Solución',correct:'Respuesta correcta (posición desde 0)',correctIndex:'Respuesta correcta (posición desde 0)',explanation:'Explicación',why:'Por qué es correcta',hint:'Pista',clue:'Pista',brief:'Objetivo',story:'Historia',description:'Descripción',objective:'Objetivo didáctico',example:'Ejemplo',options:'Opciones',steps:'Pasos',commonErrors:'Errores frecuentes'};
const htmlEscape = value => value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const encodeJs = value => JSON.stringify(value).replaceAll('<','\\u003c').replaceAll('>','\\u003e').replaceAll('&','\\u0026');

function category(file, trail='') {
  if (file.startsWith('marketing/')) return 'landing';
  if (/game|mission|juego|challenge|\bstep\b|\brace\b|\bbingo\b|\bquiz\b/i.test(file+' '+trail)) return 'juegos';
  if (/temario|topic|lesson|curric|didactic|reading|listening|speaking|writing|vocab|MODULES|MODEL_UNITS|CURATED_UNITS|\/tasks\//i.test(file+' '+trail)) return 'temario';
  return 'interfaz';
}

export function extractContent(file, source) {
  const groups = new Map(), diagnostics = [];
  const put = (key, title, field) => {
    const id = hash(file+'\0'+key).slice(0,32);
    if (!groups.has(id)) groups.set(id,{id,file,key,title:String(title||file.split('/').at(-1)).slice(0,180),category:category(file,key),fields:[]});
    groups.get(id).fields.push({...field,id:hash(key+'\0'+field.key).slice(0,24)});
  };
  function script(code, offset=0, prefix='js', json=false) {
    let ast;
    try { ast=javascript(json?'('+code+'\n)':code,{ecmaVersion:'latest',sourceType:'module',allowReturnOutsideFunction:true}); }
    catch(error){try{ast=javascript(json?'('+code+'\n)':code,{ecmaVersion:'latest',sourceType:'script',allowReturnOutsideFunction:true});}catch{diagnostics.push('No se pudo desglosar un bloque de código: '+error.message);return;}}
    const shift=offset-(json?1:0);
    const value = node => node?.type==='Literal' ? node.value : node?.type==='TemplateLiteral'&&!node.expressions.length ? node.quasis[0].value.cooked : undefined;
    const prop = node => node?.type==='Property' ? node.key.name??node.key.value : undefined;
    const objectTitle = node => {
      const properties=node?.type==='ObjectExpression'?node.properties:[];
      const text=properties.find(item=>/^(title|name|prompt|question|objective)$/i.test(prop(item))&&typeof value(item.value)==='string');
      return text?value(text.value):undefined;
    };
    const plain = node => {
      if (!node||typeof node!=='object') return false;
      if (node.type==='Literal') return typeof node.value!=='object';
      if(node.type==='TemplateLiteral')return !node.expressions.length;
      if(node.type==='UnaryExpression'&&node.operator==='-')return node.argument.type==='Literal'&&typeof node.argument.value==='number';
      if(node.type==='ArrayExpression')return node.elements.every(plain);
      if(node.type==='ObjectExpression')return node.properties.every(p=>p.type==='Property'&&!p.computed&&plain(p.value));
      return false;
    };
    function walk(node, trail, context, fieldName, allowed=false) {
      if(!node||typeof node!=='object')return;
      if(node.type==='VariableDeclarator'){walk(node.init,trail+'/'+(node.id.name||'datos'),context,fieldName,plain(node.init));return;}
      if(node.type==='ObjectExpression'){
        const title=objectTitle(node);
        if(title)context={key:trail,title};
        for(const p of node.properties)if(p.type==='Property'&&!p.computed){const key=String(prop(p));if(technical.test(key))continue;walk(p.value,trail+'/'+key,context,key,allowed||educational.test(key));}
        return;
      }
      if(node.type==='ArrayExpression'){
        const title=context?.title||trail.split('/').slice(-2).join(' · ');
        context ||= {key:trail,title};
        node.elements.forEach((child,index)=>walk(child,trail+'/'+index,context,fieldName,allowed));return;
      }
      if(node.type==='CallExpression'&&calls.test(node.callee.name||'')){
        const strings=node.arguments.map(value).filter(v=>typeof v==='string');
        const callContext={key:trail,title:strings.find(s=>s.length>6)||strings[0]||node.callee.name};
        const callee=node.callee.name;
        node.arguments.forEach((child,index)=>{if(index===0&&/^(race|match|bingo|select|memory)$/.test(callee))return;walk(child,trail+'/argumento-'+(index+1),callContext,callee==='step'?['title','text','question','options','correct','explanation'][index]||'argumento '+(index+1):'argumento '+(index+1),true);});return;
      }
      let decoded=value(node);
      if(node.type==='UnaryExpression'&&node.operator==='-'&&typeof value(node.argument)==='number')decoded=-value(node.argument);
      if(context&&allowed&&(['string','number','boolean'].includes(typeof decoded))){
        if(typeof decoded==='string'&&(!decoded.trim()||decoded.length>30000||/^https?:\/\/|^\/(?:assets|api)\//.test(decoded)))return;
        if(typeof decoded!=='string'&&!/correct|answer|solution|argumento|value/i.test(fieldName))return;
        put(context.key,context.title,{key:trail,label:(labels[fieldName]||fieldName||'Texto')+' · '+trail.split('/').slice(-2).join(' / '),value:decoded,start:node.start+shift,end:node.end+shift,format:'js'});
        return;
      }
      if(node.type==='Literal'||node.type==='TemplateLiteral')return;
      for(const [key,child]of Object.entries(node))if(key!=='start'&&key!=='end'){
        if(Array.isArray(child))child.forEach((entry,index)=>{if(entry?.type)walk(entry,trail+'/'+key+'/'+index,context,fieldName,allowed);});
        else if(child?.type)walk(child,trail+'/'+key,context,fieldName,allowed);
      }
    }
    walk(ast,prefix,null,'',json);
  }
  if(file.endsWith('.json'))script(source,0,'datos',true);
  else if(/\.[cm]?js$/.test(file))script(source);
  else if(file.endsWith('.html')){
    const document=html(source,{sourceCodeLocationInfo:true});
    let block=0;
    function visit(node,trail,heading='Pantalla'){
      const tag=node.tagName;
      if(tag==='script'){
        const type=node.attrs?.find(a=>a.name==='type')?.value;
        const text=node.childNodes?.[0];
        if(text?.sourceCodeLocation&&(!type||['module','text/javascript','application/ld+json','application/json'].includes(type)))script(text.value,text.sourceCodeLocation.startOffset,'bloque-'+block++,/json/.test(type||''));
        return;
      }
      if(['style','noscript'].includes(tag))return;
      const location=node.sourceCodeLocation;
      if(node.nodeName==='#text'&&node.value.trim()&&location){
        put('html'+trail,heading,{key:trail,label:'Texto visible',value:node.value.trim(),start:location.startOffset,end:location.endOffset,format:'html',leading:source.slice(location.startOffset,location.endOffset).match(/^\s*/)[0],trailing:source.slice(location.startOffset,location.endOffset).match(/\s*$/)[0]});
      }
      for(const attr of node.attrs||[])if(['title','alt','placeholder','aria-label'].includes(attr.name)&&attr.value.trim()&&location?.attrs?.[attr.name]){
        const range=location.attrs[attr.name];
        put('html'+trail,heading,{key:trail+'/'+attr.name,label:({'alt':'Descripción de imagen','placeholder':'Ayuda del campo','aria-label':'Nombre accesible',title:'Ayuda'})[attr.name],value:attr.value,start:range.startOffset,end:range.endOffset,format:'attribute',attribute:attr.name});
      }
      const nextHeading=/^h[1-6]$/.test(tag)?node.childNodes?.map(n=>n.value||'').join('').trim()||heading:heading;
      (node.childNodes||[]).forEach((child,index)=>visit(child,trail+'/'+(tag||node.nodeName)+'/'+index,nextHeading));
    }
    visit(document,'');
  }
  return {groups:[...groups.values()].filter(group=>group.fields.length),diagnostics};
}

export function createContentCatalog({root,store,start}) {
  let cache, inflight;
  const parsedCache=new Map();
  const git=async args=>(await exec('git',args,{cwd:root,windowsHide:true,maxBuffer:20*1024*1024,encoding:'utf8'})).stdout;
  function owner(file){
    if(file==='backend/app/data/profesor-temario.json')return 'profesor';
    if(/^backend\/app\/services\/teacher_(?:temario|mini_games|challenge_games)\.py$/.test(file))return 'profesor';
    if(file==='backend/app/static/assets/lighthouse/game.js')return 'ingles';
    if(file==='backend/app/content/official_resources.json')return 'ecosistema';
    for(const [id,path]of Object.entries(rootPaths))if(file.startsWith(path))return id;
    if(file.startsWith('apps/custom/'))return file.split('/')[2];
    if(file.startsWith('marketing/app_landings_demo/'))return Object.entries(products).find(([,p])=>p.paths.some(path=>path.startsWith('marketing/')&&file.startsWith(path)))?.[0];
  }
  async function safeRead(file,cwd=root){
    const path=join(cwd,file),real=await realpath(path),rel=relative(cwd,real);
    if(isAbsolute(rel)||rel.startsWith('..')||!(await lstat(path)).isFile()||relative(path,real))throw new OperationError(400,'Este archivo no se puede editar desde Contenido.');
    return readFile(path,'utf8');
  }
  async function index(fresh=false){
    if(!fresh&&cache&&Date.now()-cache.at<15000)return cache;
    if(inflight)return inflight;
    inflight=(async()=>{
      const files=(await git(['ls-files','-z'])).split('\0').filter(file=>owner(file)&&/\.(?:html|json|py|[cm]?js)$/.test(file)&&!/(?:^|\/)(?:tests?|fixtures|node_modules)\/|(?:package(?:-lock)?|manifest)\.json$/.test(file));
      const entries=[],issues=[];
      for(const file of files){
        const source=await safeRead(file);if(Buffer.byteLength(source)>4_000_000){issues.push({file,message:'Archivo grande. Utiliza un encargo sobre este archivo.'});continue;}
        const version=sourceHash(source),prior=parsedCache.get(file);
        const parsed=prior?.source===source?prior.parsed:await parseFile(file,source).catch(error=>({groups:[],diagnostics:[error.message]}));
        parsedCache.set(file,{source,parsed});
        for(const group of parsed.groups)entries.push({...group,app:owner(file),version});
        for(const message of parsed.diagnostics)issues.push({file,message});
      }
      cache={at:Date.now(),entries,issues};return cache;
    })().finally(()=>{inflight=null;});return inflight;
  }
  async function parseFile(file,source){
    if(!file.endsWith('.py'))return extractContent(file,source);
    const parsed=await new Promise((resolve,reject)=>{
      const child=execFile(process.env.PYTHON||'python',[fileURLToPath(new URL('./content-python.py',import.meta.url))],{windowsHide:true,maxBuffer:8*1024*1024,timeout:10000},(error,stdout)=>{if(error)reject(new OperationError(503,'No se pudo leer la plantilla Python. Comprueba Python en este equipo.'));else{try{resolve(JSON.parse(stdout));}catch(error){reject(error);}}});
      child.stdin.end(JSON.stringify({source}));
    });
    const grouped=new Map();for(const field of parsed.fields){const id=hash(file+'\0'+field.group).slice(0,32);if(!grouped.has(id))grouped.set(id,{id,file,key:field.group,title:field.title.slice(0,180),category:category(file,field.group),fields:[]});grouped.get(id).fields.push({...field,id:hash(field.group+'\0'+field.key).slice(0,24)});}
    return {groups:[...grouped.values()],diagnostics:parsed.diagnostics};
  }
  async function item(id,fresh=true){const data=await index(fresh),entry=data.entries.find(e=>e.id===id);if(!entry)throw new OperationError(404,'No se encuentra este contenido. Actualiza el catálogo.');return entry;}
  function choices(entry,field){
    if(typeof field.value!=='number'||!field.label.startsWith('Respuesta correcta'))return undefined;
    const parent=field.key.slice(0,field.key.lastIndexOf('/'));
    const options=entry.fields.filter(f=>f.key.startsWith(parent+'/')&&/\/(?:options|choices|argumento-4)\/\d+$/.test(f.key)&&typeof f.value==='string');
    return options.length?options.map((f,index)=>({value:index,label:f.value,fieldId:f.id})):undefined;
  }
  function publicItem(entry){
    const fields=entry.fields.map(field=>{const name=field.label.split(' · ')[0];return {id:field.id,label:choices(entry,field)?'Respuesta correcta':labels[name]||name,value:field.value,...(choices(entry,field)?{choices:choices(entry,field)}:{})};});
    const counts=new Map();for(const field of fields)counts.set(field.label,(counts.get(field.label)||0)+1);
    const positions=new Map();for(const field of fields)if(counts.get(field.label)>1){const name=field.label,index=(positions.get(name)||0)+1;positions.set(name,index);field.label=name+' '+index;}
    return {id:entry.id,app:entry.app,appName:products[entry.app]?.name||entry.app,file:entry.file,title:entry.title,category:entry.category,version:entry.version,fields};
  }
  async function search(query){
    const data=await index(query.get('refresh')==='1'),app=query.get('app')||'',kind=query.get('kind')||'',q=normalize(query.get('q')||'');
    const candidates=data.entries.filter(e=>(!app||e.app===app)&&(!kind||e.category===kind));
    const found=candidates.filter(e=>!q||normalize(e.title+' '+e.file+' '+e.fields.map(f=>f.value).join(' ')).includes(q));
    return {total:found.length,items:found.slice(0,80).map(e=>({id:e.id,app:e.app,title:e.title,category:e.category,fields:e.fields.length,preview:String(e.fields.find(f=>f.value!==e.title)?.value||'').slice(0,170)})),apps:[...new Set(data.entries.map(e=>e.app))].map(id=>({id,name:products[id]?.name||id,count:data.entries.filter(e=>e.app===id).length})),issues:data.issues.filter(e=>!app||owner(e.file)===app)};
  }
  async function detail(id){
    const entry=await item(id),siblings=cache.entries.filter(other=>other.file===entry.file&&other.id!==id);
    const descendants=siblings.filter(other=>other.key.startsWith(entry.key+'/'));
    const children=descendants.filter(child=>!descendants.some(other=>child.id!==other.id&&child.key.startsWith(other.key+'/'))).map(child=>({id:child.id,title:child.title,fields:child.fields.length}));
    const parent=siblings.filter(other=>entry.key.startsWith(other.key+'/')).sort((a,b)=>b.key.length-a.key.length)[0];
    return {...publicItem(entry),children,parent:parent?{id:parent.id,title:parent.title}:null,draft:store.operation('content:draft:'+id)||{revision:0,values:{},note:''}};
  }
  async function draft(body){
    const entry=await item(body.id),key='content:draft:'+body.id,current=store.operation(key)||{revision:0};
    if(body.version!==entry.version)throw new OperationError(409,'El contenido cambió. Tu borrador se conserva; vuelve a abrir la ficha y revisa los cambios.');
    if(body.revision!==current.revision)throw new OperationError(409,'Hay otro borrador más reciente. Conservamos tus cambios en este navegador.');
    const values=validate(entry,body.values);if(typeof body.note!=='string'||body.note.length>2000)throw new OperationError(400,'Describe el cambio con un máximo de 2.000 caracteres.');
    const saved={revision:current.revision+1,version:entry.version,values,note:body.note,at:new Date().toISOString()};store.writeOperation(key,saved);return saved;
  }
  function validate(entry,values){
    if(!values||typeof values!=='object'||Array.isArray(values)||Object.keys(values).length>100)throw new OperationError(400,'Revisa los campos editados.');
    for(const [id,value]of Object.entries(values)){
      const field=entry.fields.find(f=>f.id===id);
      if(!field||typeof value!==typeof field.value||(typeof value==='string'&&value.length>30000)||(typeof value==='number'&&!Number.isFinite(value)))throw new OperationError(400,'Uno de los campos no es válido.');
      const available=choices(entry,field);if(available&&!available.some(option=>option.value===value))throw new OperationError(400,'Selecciona una de las respuestas disponibles.');
    }
    return values;
  }
  function editedSource(source,fields,values){
    const changes=fields.filter(f=>Object.hasOwn(values,f.id)&&values[f.id]!==f.value).sort((a,b)=>b.start-a.start);
    for(const field of changes){const value=values[field.id];const replacement=field.format==='html'?(field.leading||'')+htmlEscape(value)+(field.trailing||''):field.format==='attribute'?field.attribute+'="'+htmlEscape(value)+'"':field.format==='python'&&typeof value==='boolean'?(value?'True':'False'):encodeJs(value);source=source.slice(0,field.start)+replacement+source.slice(field.end);}
    return source;
  }
  async function submit(body){
    if(!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(body.requestId||''))throw new OperationError(400,'Falta el identificador del encargo.');
    const receiptKey='content:request:'+body.requestId,previous=store.operation(receiptKey),fingerprint=hash(JSON.stringify({id:body.id,version:body.version,values:body.values,note:body.note,engine:body.engine,model:body.model}));
    if(previous){if(previous.fingerprint!==fingerprint)throw new OperationError(409,'Ese envío ya corresponde a otros cambios.');return queue(previous);}
    const entry=await item(body.id);if(body.version!==entry.version)throw new OperationError(409,'La ficha ha cambiado. Reábrela antes de enviar para conservar las correcciones recientes.');
    const values=validate(entry,body.values),note=body.note||'';
    if(typeof note!=='string'||note.length>2000)throw new OperationError(400,'El encargo admite hasta 2.000 caracteres.');
    const changed=entry.fields.filter(f=>Object.hasOwn(values,f.id)&&f.value!==values[f.id]);
    if(!changed.length&&!note.trim())throw new OperationError(400,'Corrige un campo o escribe qué quieres mejorar.');
    if(!['codex','openai','claude'].includes(body.engine||'codex')||(body.model!==undefined&&(typeof body.model!=='string'||body.model.length>100)))throw new OperationError(400,'Selecciona un motor y modelo válidos.');
    const source=await safeRead(entry.file);if(sourceHash(source)!==entry.version)throw new OperationError(409,'El archivo acaba de cambiar. Reabre la ficha antes de enviar.');
    const expected=editedSource(source,entry.fields,values);
    // Reparse before accepting a correction. Editing a string never executes it.
    if(changed.length&&(await parseFile(entry.file,expected)).diagnostics.length)throw new OperationError(400,'La corrección no conserva el formato del contenido.');
    const context='Contenido de origen: '+entry.file+'\nFicha: '+entry.title+'\n'+(changed.length?'Las correcciones manuales se aplican exactamente antes de tu revisión. Conserva esos valores.':'Revisa esta ficha sin perder funcionalidades ni alterar identificadores o progreso.')+'\n'+(note?'Petición del propietario: '+note:'Corrige únicamente los campos indicados y comprueba el flujo afectado.');
    const request={fingerprint,requestId:body.requestId,entry:publicItem(entry),file:entry.file,version:entry.version,fields:changed,values,expectedHash:sourceHash(expected),engine:body.engine||'codex',model:body.model||undefined,manual:changed.length>0&&!note.trim(),
      task:{id:'contenido-'+body.requestId,app:products[entry.app]?entry.app:'ecosistema',agente:entry.category==='juegos'?'juegos':'mantenimiento',encargo:(changed.length?'Corregir contenido: ':'Mejorar contenido: ')+entry.title.slice(0,160),contexto:context}};
    // A mixed text edit + open request is still an exact correction; further work gets its own task.
    request.manual=changed.length>0;
    const accepted=store.transaction(()=>{
      const existing=store.operation(receiptKey);if(existing){if(existing.fingerprint!==fingerprint)throw new OperationError(409,'Ese envío ya corresponde a otros cambios.');return existing;}
      store.writeOperation(receiptKey,request);store.writeOperation('content:job:'+request.task.id,{requestId:body.requestId});return request;
    });
    return queue(accepted);
  }
  async function queue(request){
    const batch=await start({mode:'implementacion',engine:request.engine,providerModel:request.model,qualityRequired:true,tasks:[request.task],enqueue:true});
    const result={requestId:request.requestId,batchId:batch.id,taskId:request.task.id,state:batch.state};
    store.writeOperation('content:result:'+request.requestId,result);return result;
  }
  function job(id){const ref=store.operation('content:job:'+id);return ref?store.operation('content:request:'+ref.requestId):null;}
  async function apply(id,cwd){
    const request=job(id);if(!request?.manual)throw new OperationError(404,'No se encuentra la corrección.');
    const source=await safeRead(request.file,cwd);if(sourceHash(source)!==request.version)throw new OperationError(409,'El archivo cambió mientras esperaba. Reabre la ficha y vuelve a enviar la corrección.');
    const parsed=await parseFile(request.file,source),entry=parsed.groups.find(group=>group.id===request.entry.id);
    if(!entry)throw new OperationError(409,'No se encuentra la ficha de origen de esta corrección.');
    const result=editedSource(source,entry.fields,request.values);if(sourceHash(result)!==request.expectedHash)throw new OperationError(409,'La corrección no coincide con la guardada.');
    await writeFile(join(cwd,request.file),result,'utf8');
    return {draft:{resumen:request.task.encargo,entrega:'Aplicados exactamente '+request.fields.length+' campos en '+request.file+'.',comprobaciones:['Contenido desglosado sin ejecutar código.','Revisión de origen y formato verificadas.'],pendientes:[]}};
  }
  async function verify(id,cwd,files){const request=job(id);if(request?.manual&&(sourceHash(await safeRead(request.file,cwd))!==request.expectedHash||files?.some(file=>file!==request.file)))throw new OperationError(409,'La revisión modificó otros valores además de tu corrección. La copia se conserva para ajustar el encargo.');}
  return {search,detail,draft,submit,job,apply,verify,extractContent};
}
