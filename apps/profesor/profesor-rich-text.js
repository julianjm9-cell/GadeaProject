/* One safe presentation layer for curriculum, activity previews and practice. */
(() => {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function formula(source, display = false) {
    source = String(source).replace(/\\\\(?=[()[\]]|(?:sqrt|frac|dfrac|begin|end|text|left|right)\b)/g, '\\');
    if(/^\d+\s*\/\s*\d+$/.test(source))source=source.replace(/(\d+)\s*\/\s*(\d+)/,'\\frac{$1}{$2}');
    try { return katex.renderToString(source, {displayMode:display, throwOnError:true, trust:false, strict:'ignore', maxExpand:200, maxSize:15, output:'htmlAndMathml'}); }
    catch (_) { return '<span class="formula-fallback">'+escape(source)+'</span>'; }
  }
  function inline(value) {
    const saved = [];
    let source = String(value ?? '').replace(/\\\\(?=[()[\]]|(?:sqrt|frac|dfrac|begin|end|text|left|right)\b)/g,'\\');
    source = source.replace(/\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\$([^$\n]+)\$|\\\(([\s\S]+?)\\\)|\\begin\{(cases|aligned|align\*?|[pbv]?matrix)\}([\s\S]*?)\\end\{\5\}/g,(whole,a,b,c,d,env,body)=>{
      saved.push(formula(env?'\\begin{'+env+'}'+body+'\\end{'+env+'}':a||b||c||d,!!(a||b||env)));return '\uE000'+(saved.length-1)+'\uE001';
    });
    source=source.replace(/\\(?:sqrt(?:\[[^\]]+\])?\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}|(?:d?frac)\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}|(?:pi|alpha|beta|theta|times|div|pm|leq|geq|neq|infty)\b)|√(?:\([^()]+\)|\d+)|\b\d+\s*\/\s*\d+\b|\b[a-zA-Z\d]+(?:\^[−-]?\d+|[²³⁴⁵⁶⁷⁸⁹⁰¹₀₁₂₃]+)/g,match=>{const digits={'²':2,'³':3,'⁴':4,'⁵':5,'⁶':6,'⁷':7,'⁸':8,'⁹':9,'⁰':0,'¹':1,'₀':0,'₁':1,'₂':2,'₃':3};saved.push(formula(match.replace(/√\(([^)]+)\)/g,'\\sqrt{$1}').replace(/√(\d+)/g,'\\sqrt{$1}').replace(/([²³⁴⁵⁶⁷⁸⁹⁰¹]+|[₀₁₂₃]+)/g,v=>(v[0] in {'₀':0,'₁':1,'₂':2,'₃':3}?'_':'^')+'{'+[...v].map(c=>digits[c]).join('')+'}')));return '\uE000'+(saved.length-1)+'\uE001';});
    const palette={blue:'#0868dc',green:'#008e6c',purple:'#7951be',orange:'#a6660d'};
    let marked = escape(source).replace(/\*\*([^*]+)\*\*|__([^_]+)__/g,(_,a,b)=>'<strong>'+(a||b)+'</strong>').replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g,'<em>$1</em>').replace(/~~([^~]+)~~/g,'<u>$1</u>').replace(/\[([^\]<>]+)\]\{(blue|green|purple|orange)\}/g,(_,text,color)=>'<span style="color:'+palette[color]+'">'+text+'</span>').replace(/`([^`]+)`/g,'<code>$1</code>');
    let bold=0;
    marked=marked.split(/(<[^>]+>)/).map(part=>{
      if(part.startsWith('<')){if(part==='<strong>')bold++;else if(part==='</strong>')bold=Math.max(0,bold-1);return part;}
      return bold?part:part.replace(/\b(teorema de Pitágoras|numerador|denominador|hipotenusa|incógnita|idea principal|presente simple|sujeto|predicado|hipótesis)\b/gi,'<strong>$1</strong>');
    }).join('');
    return marked.replace(/\uE000(\d+)\uE001/g,(_,n)=>saved[+n]);
  }
  function rich(value) {
    const lines=String(value??'').replace(/\r\n/g,'\n').split('\n'),blocks=[],prose=[];
    function textBlock(source){
      if(/\\begin\{|\$\$|\\\[/.test(source))return inline(source).replace(/\n/g,'<br>');
      const steps=source.split(/\s+→\s+/);
      if(steps.length>1&&steps.every(step=>step.includes('=')))return '<span class="rich-steps">'+steps.map(step=>{
        const equations=step.split(/;\s*|\s+y\s+(?=[xy](?:\s*[+−-]\s*[xy])?\s*=)/);
        return '<span>'+equations.map(inline).join('<br>')+'</span>';
      }).join('')+'</span>';
      return source.split('\n').map(line=>{
        const heading=line.match(/^#{1,4}\s+(.+)/),bullet=line.match(/^\s*([-•]|\d+[.)])\s+(.+)/);
        return heading?'<strong class="rich-heading">'+inline(heading[1])+'</strong>':bullet?'<span class="rich-bullet">'+escape(bullet[1])+' '+inline(bullet[2])+'</span>':inline(line);
      }).join('<br>');
    }
    const flush=()=>{if(prose.length){blocks.push(textBlock(prose.join('\n')));prose.length=0;}};
    for(let n=0;n<lines.length;){
      if(lines[n].includes('|')&&/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[n+1]||'')){
        flush();const rows=[lines[n]];n+=2;
        while(n<lines.length&&lines[n].trim()&&lines[n].includes('|'))rows.push(lines[n++]);
        const cells=line=>line.trim().replace(/^\||\|$/g,'').split('|');
        blocks.push('<span class="rich-table"><table>'+rows.map((line,i)=>'<tr>'+cells(line).map(cell=>'<'+(i?'td':'th')+'>'+inline(cell.trim())+'</'+(i?'td':'th')+'>').join('')+'</tr>').join('')+'</table></span>');
      }else prose.push(lines[n++]);
    }
    flush();return blocks.join('<br>');
  }
  function paint(root) {
    if(!root)return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(node){return node.parentElement.closest('textarea,input,select,option,script,style,math,.katex,.formula-fallback,.rosco-center,.play-progress,.play-number,.play-kind,.game-timer,.play-choice-letter,[data-rich-painted]')?NodeFilter.FILTER_REJECT:/\\[([]|\\[a-zA-Z]+|\$[^$]+\$|\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\]\{(?:blue|green|purple|orange)\}|√|[²³⁴⁵⁶⁷⁸⁹⁰¹₀₁₂₃]|[a-zA-Z\d]\^[-−]?\d+|\b\d+\/\d+\b|\|\s*-{3,}| = .* →/.test(node.textContent)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;}});
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(node=>{const span=document.createElement('span');span.dataset.richPainted='';span.innerHTML=rich(node.textContent);node.replaceWith(span)});
  }
  window.profesorText={inline,rich,formula,paint};
})();
