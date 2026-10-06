/* Presentation only: curricular source strings remain unchanged. */
(() => {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const scripts = {'²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','⁰':'0','¹':'1','₀':'0','₁':'1','₂':'2','₃':'3'};
  function math(value) {
    if(window.profesorText)return window.profesorText.formula(value);
    let source = String(value), out = '', i = 0;
    const atom = token => math(token).replace(/^<math[^>]*>|<\/math>$/g,'');
    function tokens(text) {
      return text.replace(/\d+(?:[.,]\d+)?|[a-zA-Zα-ωΑ-Ω]+|[^\s]/g, token => /^\d/.test(token) ? '<mn>'+escape(token)+'</mn>' : /^[a-zA-Zα-ωΑ-Ω]/.test(token) ? '<mi>'+escape(token)+'</mi>' : '<mo>'+escape(token)+'</mo>');
    }
    while (i < source.length) {
      const rest = source.slice(i);
      const fraction = rest.match(/^(\([^()]+\)|[−-]?\d+(?:[.,]\d+)?)\s*\/\s*(\([^()]+\)|\d+(?:[.,]\d+)?)/);
      const power = rest.match(/^([a-zA-Z]|\d+)([²³⁴⁵⁶⁷⁸⁹⁰¹₀₁₂₃]+|\^[−-]?\d+)/);
      const root = rest.match(/^√(?:\(([^()]+)\)|(\d+))/);
      if(root) {out += '<msqrt>'+math(root[1]||root[2]).replace(/^<math[^>]*>|<\/math>$/g,'')+'</msqrt>';i += root[0].length;}
      else if (fraction) {out += '<mfrac>'+atom(fraction[1])+atom(fraction[2])+'</mfrac>';i += fraction[0].length;}
      else if (power) {const sub = /^[₀₁₂₃]/.test(power[2]);out += '<'+(sub?'msub':'msup')+'>'+atom(power[1])+atom(power[2].replace(/^\^/,'').replace(/[²³⁴⁵⁶⁷⁸⁹⁰¹₀₁₂₃]/g,c=>scripts[c]))+'</'+(sub?'msub':'msup')+'>';i += power[0].length;}
      else {out += tokens(source[i]);i++;}
    }
    return '<math class="topic-math" xmlns="http://www.w3.org/1998/Math/MathML" aria-label="'+escape(value)+'"><mrow>'+out+'</mrow></math>';
  }
  function inline(value) {
    if(window.profesorText)return window.profesorText.inline(value);
    const saved = [];
    let text = String(value ?? '');
    // Explicit math delimiters and the notation used by the current catalogue.
    text = text.replace(/\$\$([^$]+)\$\$|\$([^$\n]+)\$|\\\((.+?)\\\)|√(?:\([^()]+\)|\d+)|(?:\([^()]+\)|[−-]?\d+(?:[.,]\d+)?)\s*\/\s*(?:\([^()]+\)|\d+(?:[.,]\d+)?)|[a-zA-Z\d]+[²³⁴⁵⁶⁷⁸⁹⁰¹₀₁₂₃]+|[a-zA-Z\d]+\^[−-]?\d+/g, (match,a,b,c) => {saved.push(math(a||b||c||match));return '\uE000'+(saved.length-1)+'\uE001';});
    text = escape(text).replace(/\b(teorema de Pitágoras|numerador|denominador|hipotenusa|incógnita|idea principal|presente simple|sujeto|predicado|hipótesis)\b/gi,'<strong>$1</strong>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/__([^_]+)__/g,'<strong>$1</strong>').replace(/`([^`]+)`/g,'<code>$1</code>').replace(/«([^»]+)»/g,'«<strong>$1</strong>»').replace(/^([^:<>]{2,55}):\s/,'<strong>$1:</strong> ');
    return text.replace(/\uE000(\d+)\uE001/g,(_,n)=>saved[Number(n)]);
  }
  function rich(value) {
    const text = String(value ?? '');
    const lines = text.split('\n');
    if(lines.length>1 && /^\s*\|?\s*:?-{3,}/.test(lines[1])) {
      const cells=line=>line.trim().replace(/^\||\|$/g,'').split('|');
      return '<span class="topic-table" role="table">'+[lines[0],...lines.slice(2)].filter(line=>line.trim()).map((line,index)=>'<span role="row">'+cells(line).map(cell=>'<span role="'+(index?'cell':'columnheader')+'">'+inline(cell.trim())+'</span>').join('')+'</span>').join('')+'</span>';
    }
    const parts = text.split(/\s*→\s*/);
    // An arrow inside a limit, x→2, belongs to the formula.
    if(parts.length>1 && parts.every(part=>part.includes('='))) {
      return '<span class="topic-equation-stack">'+parts.map(part=>{
        const equations=part.split(/;\s*|\s+y\s+(?=[xy](?:\s*[+−-]\s*[xy])?\s*=)/);
        return '<span>'+(equations.length>1?'<span class="topic-system">'+equations.map(equation=>'<span>'+inline(equation)+'</span>').join('')+'</span>':inline(part))+'</span>';
      }).join('')+'</span>';
    }
    if(parts.length>1 && /\s→\s/.test(text) && !/\blim\b/.test(text)) {
      return '<span class="topic-concept-flow">'+parts.map((part,i)=>'<span>'+(i?'<span aria-hidden="true" class="topic-flow-arrow">→ </span>':'')+inline(part)+'</span>').join('')+'</span>';
    }
    return text.split('\n').map(line => {
      const bullet = line.match(/^\s*(?:[-•]|\d+[.)])\s+(.+)/);
      const heading = line.match(/^#{1,4}\s+(.+)/);
      return heading ? '<strong class="topic-text-heading">'+inline(heading[1])+'</strong>' : bullet ? '<span class="topic-text-bullet">'+inline(bullet[1])+'</span>' : inline(line);
    }).join('<br/>');
  }
  function diagram(topic) {
    const title = topic.title.toLowerCase();
    let drawing = '', label = '';
    if (/geometr|trigonometr/.test(title) && /triángulo rectángulo|catetos/.test(topic.explanation+' '+topic.example)) {
      label = 'Triángulo rectángulo: catetos e hipotenusa';
      drawing = '<path d="M60 140V35L250 140Z"/><path d="M60 124H76V140"/><text x="5" y="90">cateto</text><text x="122" y="165">cateto</text><text x="144" y="70">hipotenusa</text>';
    } else if (/geometr/.test(title) && /base 6 y altura 4/.test(topic.example)) {
      label = 'Triángulo: base y altura';
      drawing = '<path d="M45 140L145 35L265 140Z"/><path d="M145 35V140" stroke-dasharray="5 4"/><text x="115" y="165">base: 6</text><text x="155" y="85">altura: 4</text>';
    } else if (/formas y cuerpos|geometría y volumen/.test(title)) {
      label = 'Figura plana y cuerpo con volumen';
      drawing = '<rect x="25" y="65" width="75" height="75"/><path d="M175 140V65H250V140ZM175 65L210 30H285V105L250 140M250 65L285 30M210 30V105L175 140M210 105H285"/><text x="25" y="165">figura plana</text><text x="185" y="165">cuerpo</text>';
    } else if (/funciones y geometría/.test(title) && /y = 2x/.test(topic.example)) {
      label = 'Representación de y = 2x: puntos (0,0), (1,2) y (2,4)';
      drawing = '<path d="M50 140H280M50 140V20M50 140L170 20"/><circle cx="50" cy="140" r="3"/><circle cx="105" cy="85" r="3"/><circle cx="160" cy="30" r="3"/><text x="25" y="165">(0,0)</text><text x="115" y="95">(1,2)</text><text x="170" y="40">(2,4)</text><text x="275" y="160">x</text><text x="30" y="25">y</text>';
    } else if (/área|perímetro/.test(title)) {
      label = 'Rectángulo: base, altura y contorno';
      drawing = '<rect x="65" y="30" width="180" height="110"/><text x="130" y="165">base</text><text x="12" y="90">altura</text>';
    } else if (/fraccion/.test(title.normalize('NFD').replace(/[\u0300-\u036f]/g,''))) {
      const fraction = topic.example.match(/\b(\d+)\/(\d+)\b/);
      if(fraction && +fraction[1] <= +fraction[2] && +fraction[2] <= 12 && +fraction[2]>0) {
        const n=+fraction[1],d=+fraction[2],w=260/d;
        label = fraction[0]+': '+n+' de '+d+' partes iguales';
        drawing = Array.from({length:d},(_,i)=>'<rect x="'+(30+i*w)+'" y="50" width="'+w+'" height="70" fill="'+(i<n?'#c9e5ff':'#fff')+'"/>').join('')+'<text x="120" y="155">'+escape(fraction[0])+'</text>';
      }
    }
    return drawing ? '<figure class="topic-diagram"><svg viewBox="0 0 320 185" role="img" aria-label="'+escape(label)+'">'+drawing+'</svg><figcaption>Esquema de apoyo · no está a escala</figcaption></figure>' : '';
  }
  window.temarioRichText = rich;
  window.temarioInlineText = inline;
  window.temarioDiagram = diagram;
})();
