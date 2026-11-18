const checked = '18/11/2026';
const guru = path => 'https://es.restaurantguru.com/' + path;
// Coordinates refer to published POIs, not to the decorative travel illustration.
export const places = [
  {id:'repesca',name:'La Repesca',group:'cena',address:'Plaza Mayor, 27',position:[40.140176,-3.422106],rating:4.3,price:'20–30 €',description:'Tapas y vinos en la plaza.',source:'https://gastrorank.es/es/restaurante/ver/mediterrania/chinchon-restaurante-la-repesca',locationSource:'https://gastrorank.es/es/restaurante/ver/mediterrania/chinchon-restaurante-la-repesca'},
  {id:'senora',name:'La Señora Winebar',group:'cena',address:'Cuesta de Quiñones, 2',position:[40.1405294,-3.4203115],rating:4.5,price:'20–35 €',description:'Vinos y cocina en una casa con patio y cueva.',source:guru('La-Senora-Winebar-Chinchon'),locationSource:'https://mymenuweb.com/es/restaurants/439509/'},
  {id:'pregonero',name:'La Casa del Pregonero',group:'cena',address:'Plaza Mayor, 4',position:[40.1400722,-3.4229376],rating:4.4,price:'35–60 €',description:'Cocina de autor y patio castellano.',source:guru('amp/La-Casa-del-Pregonero-Chinchon'),locationSource:'https://www.openstreetmap.org/node/13249570476'},
  {id:'tomeguin',name:'Tomeguín & Colibrí',group:'desayuno',address:'Calle de los Huertos, 12',position:[40.1397222,-3.4232529],rating:4.7,price:'6–12 €',description:'Café de especialidad y repostería.',source:guru('Tomeguin-and-Colibri-Specialty-Coffee-Shop-Chinchon'),locationSource:'https://www.openstreetmap.org/node/13249570470'},
  {id:'tahona',name:'La Tahona del Iberia',group:'desayuno',address:'Plaza Mayor, 16',position:[40.1404588,-3.4225534],rating:4.6,price:'5–10 €',description:'Desayuno en plena Plaza Mayor.',source:guru('La-Tahona-del-Iberia-Chinchon'),locationSource:'https://www.openstreetmap.org/node/13249570482'},
  {id:'lima',name:'Lima Limón',group:'desayuno',address:'Calle Grande, 3',position:[40.1403828,-3.4218076],rating:4.7,price:'5–10 €',description:'Una parada para café y tostadas.',source:'https://restaurantguru.com/Lima-limon-Chinchon',locationSource:'https://www.openstreetmap.org/node/13249570456'},
  {id:'balconada',name:'La Balconada',group:'comida',address:'Plaza Mayor / Calle de Morata, 1',position:[40.140396,-3.4227621],rating:4.3,price:'35–60 €',description:'Cocina tradicional con vistas a la plaza.',source:guru('La-Balconada-Chinchon'),locationSource:'https://www.openstreetmap.org/node/4756740888'},
  {id:'parador',name:'Restaurante El Convento · Parador',group:'comida',address:'Calle de los Huertos, 1',position:[40.1395246,-3.4234014],rating:4.5,price:'35–50 €',description:'El restaurante del antiguo convento de San Agustín.',source:guru('pastry-Chinchon-m32'),locationSource:'https://www.openstreetmap.org/node/5452316666'},
  {id:'iberia',name:'Café de la Iberia',group:'comida',address:'Plaza Mayor, 17',position:[40.1404698,-3.4224624],rating:4.3,price:'30–45 €',description:'Un comedor histórico en la Plaza Mayor.',source:guru('Cafe-de-la-Iberia-Chinchon'),locationSource:'https://www.openstreetmap.org/node/4756739521'},
  {id:'vino',name:'Mesón Cuevas del Vino',group:'cuevas',address:'Calle Benito Hortelano, 13',position:[40.1406473,-3.4173394],rating:4.1,price:'35–50 €',description:'Asados, tinajas y cuevas en una antigua casa de labor.',source:guru('Meson-El-Duende-Chinchon-2'),locationSource:'https://www.cuevasdelvino.com/informacion/'},
  {id:'quinones',name:'Mesón Quiñones · Cuevas del Murciélago',group:'cuevas',address:'Calle de Quiñones, 20',position:[40.1412594,-3.42072],rating:4.3,price:'30–45 €',description:'Cocina castellana y bodega subterránea.',source:'https://pos.do/es/chinchon/restaurante/meson-de-quinones',locationSource:'https://www.openstreetmap.org/node/4756756529'},
  {id:'bayona',name:'Bodega Viña Bayona',group:'cuevas',address:'Calle Grande, 28 · Titulcia',rating:4.6,price:'Consultar',description:'Está en Titulcia, fuera de Chinchón. Requiere desplazamiento.',outside:true,source:'https://espaciovinosweb.com/bodegas/madrid/titulcia/bodega-vina-bayona/',locationSource:'https://vinabayona.com/'}
];
const groups = [['todas','Todos'],['cena','Cena del viernes'],['desayuno','Desayuno del sábado'],['comida','Comida del sábado'],['cuevas','Cuevas y vino']];
const glyph = place => place.group === 'desayuno' ? '☕' : place.group === 'cuevas' ? '🍷' : '🍽';
const node = (tag, cls, text) => { const element=document.createElement(tag); if(cls)element.className=cls; if(text!==undefined)element.textContent=text; return element; };
const link = (text,url,cls='') => { const element=node('a',cls,text); element.href=url; element.target='_blank'; element.rel='noopener noreferrer'; return element; };
export const mapsLink = place => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(place.name + ', ' + place.address + (place.outside ? '' : ', Chinchón, Madrid'));
export const refuge = {name:'Nuestro refugio',address:'Plaza Mayor, 36 · Chinchón',position:[40.1398503,-3.4224314],maps:'https://www.google.com/maps/place//data=!4m2!3m1!1s0xd4213cc52af36cd:0x47efcf9bc8a0045b'};
const project = ([lat,lon]) => [(lat-40.1375)/(40.1427-40.1375)*900,(lon+3.4255)/(-3.4163+3.4255)*1200];
let activeMap;
export function clearRestaurantMap(){ if(activeMap){activeMap.remove();activeMap=null;} }

export function restaurants(host){
  host.append(node('h1','food-title','Restaurantes'));
  const filters=node('div','food-filters'); filters.setAttribute('role','group'); filters.setAttribute('aria-label','Elegir comida'); host.append(filters);
  const layout=node('div','food-layout'), mapColumn=node('section','food-map-column'), mapElement=node('div','food-map');
  mapElement.id='restaurant-map';mapElement.setAttribute('role','region');mapElement.setAttribute('aria-label','Mapa de restaurantes del centro de Chinchón');
  const mapHeading=node('div','section-line');mapHeading.append(node('h2','','En el mapa'));
  const reset=node('button','quiet','Ver todos');reset.type='button';mapHeading.append(reset);mapColumn.append(mapHeading,mapElement);
  const refugeBar=node('div','refuge-bar');const refugeSymbol=node('span','refuge-symbol','⌂');refugeSymbol.setAttribute('aria-hidden','true');
  const refugeCopy=node('div','refuge-copy');refugeCopy.append(node('strong','',refuge.name),node('small','',refuge.address));
  const refugeLocate=node('button','refuge-locate','Ver en mapa');refugeLocate.type='button';
  refugeBar.append(refugeSymbol,refugeCopy,refugeLocate,link('Google Maps ↗',refuge.maps,'refuge-google'));mapColumn.insertBefore(refugeBar,mapElement);
  const status=node('p','food-map-status','Toca un icono para ver el local. Amplía los grupos con un número.');status.setAttribute('role','status');mapColumn.append(status);
  layout.append(mapColumn);const cards=node('div','food-cards');layout.append(cards);host.append(layout);
  host.append(node('p','food-notes','Puntuaciones de Google recogidas en las fuentes enlazadas · consulta '+checked+'. No se actualizan en directo. Precios orientativos de vuestra guía, por persona.'));
  if(!globalThis.L){mapElement.append(node('p','muted','El mapa no ha podido cargarse. Puedes abrir cada local en Google Maps.'));}
  const L=globalThis.L, map=L ? L.map(mapElement,{crs:L.CRS.Simple,center:[450,600],zoom:-1,minZoom:-2,maxZoom:5,scrollWheelZoom:false,attributionControl:true,fadeAnimation:false,zoomAnimation:false,zoomControl:false}):null;
  activeMap=map;
  if(map){L.control.zoom({zoomInTitle:'Ampliar mapa',zoomOutTitle:'Alejar mapa'}).addTo(map);L.imageOverlay('/aventura-hambre-assets/town-map.svg',[[0,0],[900,1200]],{alt:'Plano de calles de Chinchón',interactive:false}).addTo(map);map.attributionControl.setPrefix(false);map.attributionControl.addAttribution('<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors · ODbL</a>');}
  const layer=map?L.layerGroup().addTo(map):null;
  let refugeMarker;
  if(map){
    const badge=node('div','refuge-marker-body');badge.append(node('span','','⌂'));badge.setAttribute('aria-hidden','true');
    refugeMarker=L.marker(project(refuge.position),{icon:L.divIcon({html:badge,className:'refuge-marker',iconSize:[50,50],iconAnchor:[25,44]}),title:refuge.name+', '+refuge.address,keyboard:true,zIndexOffset:1000}).addTo(map);
    const popup=node('div','food-popup refuge-popup');popup.append(node('strong','',refuge.name),node('p','',refuge.address),link('Abrir Google Maps ↗',refuge.maps,'food-google'));refugeMarker.bindPopup(popup,{maxWidth:270});
    refugeMarker.getElement().setAttribute('aria-label',refugeMarker.options.title);
  } else refugeLocate.disabled=true;
  refugeLocate.addEventListener('click',()=>{if(!map)return;map.setView(project(refuge.position),Math.max(3,map.getZoom()),{animate:false});refugeMarker.openPopup();mapElement.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});});
  let selected='todas', focused=null;
  function visible(){return places.filter(place=>selected==='todas'||place.group===selected);}
  function popup(place){const element=node('div','food-popup');element.append(node('strong','',place.name),node('p','',place.address),node('span','food-rating','★ '+place.rating.toFixed(1).replace('.',',')+' / 5'),link('Abrir Google Maps ↗',mapsLink(place),'food-google'));return element;}
  function drawMarkers(){
    if(!map)return;layer.clearLayers();
    const pending=visible().filter(place=>place.position), clusters=[];
    for(const place of pending){const pixel=map.latLngToLayerPoint(project(place.position));const cluster=clusters.find(group=>group.some(other=>map.latLngToLayerPoint(project(other.position)).distanceTo(pixel)<52));if(cluster)cluster.push(place);else clusters.push([place]);}
    for(const group of clusters){
      const place=group[0];let pos=group.length===1?project(place.position):[group.reduce((sum,p)=>sum+project(p.position)[0],0)/group.length,group.reduce((sum,p)=>sum+project(p.position)[1],0)/group.length];
      if(group.length>1){const point=map.latLngToLayerPoint(pos),home=map.latLngToLayerPoint(project(refuge.position));const distance=point.distanceTo(home);if(distance<64){const dx=point.x-home.x||-1,dy=point.y-home.y,scale=64/Math.max(distance,1);pos=map.layerPointToLatLng(L.point(home.x+dx*scale,home.y+dy*scale));}}
      const badge=node('div','food-marker-body'+(group.length>1?' clustered':''));
      badge.append(node('span','',group.length>1?String(group.length):glyph(place)));
      if(group.length===1)badge.append(node('small','',place.rating.toFixed(1).replace('.',',')));
      const marker=L.marker(pos,{icon:L.divIcon({html:badge,className:'food-marker',iconSize:[46,46],iconAnchor:[23,40]}),title:group.length>1?group.length+' locales cercanos. Ampliar.':place.name+', '+place.rating+' sobre 5',keyboard:true,zIndexOffset:group.length>1?1200:0}).addTo(layer);
      marker.getElement().setAttribute('aria-label',marker.options.title);
      if(group.length>1)marker.on('click',()=>map.setView(pos,Math.min(5,map.getZoom()+1)));
      else {marker.bindPopup(popup(place),{maxWidth:270});if(focused===place.id)marker.openPopup();}
    }
  }
  function fit(){if(map){focused=null;const points=[project(refuge.position),...visible().filter(p=>p.position).map(p=>project(p.position))];map.fitBounds(points,{padding:[48,48],maxZoom:1});}}
  function focusPlace(place){if(!map)return;focused=place.id;map.setView(project(place.position),Math.max(3,map.getZoom()),{animate:false});drawMarkers();mapElement.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}
  function drawCards(){
    cards.replaceChildren();
    for(const place of visible()){
      const article=node('article','food-card');article.dataset.restaurant=place.id;
      const head=node('div','food-card-head'), emblem=node('span','food-kind',glyph(place));emblem.setAttribute('aria-hidden','true');
      const title=node('h2','',place.name),score=link('★ '+place.rating.toFixed(1).replace('.',','),place.source,'food-rating');score.setAttribute('aria-label',place.rating+' sobre 5, Google según la fuente. Consultado '+checked);head.append(emblem,title,score);article.append(head,node('p','food-address',place.address),node('p','food-description',place.description));
      const footer=node('div','food-card-footer');footer.append(node('span','food-price',place.price+(place.price==='Consultar'?'':' / persona')));
      if(place.position&&map){const locate=node('button','food-locate','Ver en mapa');locate.type='button';locate.addEventListener('click',()=>focusPlace(place));footer.append(locate);}
      article.append(footer,link('Google Maps ↗',mapsLink(place),'food-google'));cards.append(article);
    }
    for(const control of filters.children)control.setAttribute('aria-pressed',String(control.dataset.group===selected));
  }
  for(const [id,title] of groups){const control=node('button','',title);control.type='button';control.dataset.group=id;control.addEventListener('click',()=>{selected=id;drawCards();fit();drawMarkers();});filters.append(control);}
  reset.addEventListener('click',()=>{selected='todas';drawCards();fit();drawMarkers();});
  if(map)map.on('zoomend',drawMarkers);
  drawCards();fit();drawMarkers();
}
