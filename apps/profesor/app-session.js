/* One refresh per tab; cookies and application state remain owned by the server. */
(() => {
  'use strict';
  if (window.appSession) return;
  const nativeFetch = window.fetch.bind(window);
  const pending = new Map();
  const uuid=()=>crypto.randomUUID?.()||'10000000-1000-4000-8000-100000000000'.replace(/[018]/g,c=>(Number(c)^(crypto.getRandomValues(new Uint8Array(1))[0]&(15>>Number(c)/4))).toString(16));
  let refreshing;
  function refresh() {
    if (!refreshing) {
      const run = () => nativeFetch('/auth/refresh', {method:'POST', credentials:'same-origin'}).then(response => response.ok).catch(() => false);
      refreshing = (navigator.locks ? navigator.locks.request('educa-session-refresh', run) : run()).finally(() => { refreshing = null; });
    }
    return refreshing;
  }
  async function sessionFetch(input, options = {}) {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, location.href);
    const eligible = url.origin === location.origin && url.pathname.startsWith('/api/') && options.credentials !== 'omit' && !(input instanceof Request && input.credentials === 'omit');
    let retryKey;
    if(eligible && options.method?.toUpperCase()==='POST' && ['/api/chat','/api/ocr','/api/transcribe'].includes(url.pathname) && typeof options.body==='string') {
      const headers=new Headers(options.headers||{});
      if(!headers.has('Idempotency-Key')) {
        const signature=url.pathname+':'+(headers.get('X-Client-App')||url.searchParams.get('app')||'')+':'+options.body;
        retryKey=crypto.subtle ? 'ai.retry.'+[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(signature)))].map(n=>n.toString(16).padStart(2,'0')).join('') : signature;
        let entry=pending.get(retryKey);
        try {if(!entry&&crypto.subtle)entry=JSON.parse(sessionStorage.getItem(retryKey));}catch{}
        if(!entry||entry.at<Date.now()-86400000)entry={id:uuid(),at:Date.now()};
        pending.set(retryKey,entry);
        try{if(crypto.subtle)sessionStorage.setItem(retryKey,JSON.stringify(entry));}catch{}
        headers.set('Idempotency-Key',entry.id);options={...options,headers};
      }
    }
    const replay = eligible && input instanceof Request ? input.clone() : input;
    let response = await nativeFetch(input, options);
    if (eligible && response.status === 401 && !options.signal?.aborted && await refresh()) response=await nativeFetch(replay, options);
    if(retryKey && response.ok){try{await response.clone().json();pending.delete(retryKey);sessionStorage.removeItem(retryKey);}catch{}}
    return response;
  }
  window.appSession = {fetch:sessionFetch, refresh};
  window.fetch = sessionFetch;
})();
