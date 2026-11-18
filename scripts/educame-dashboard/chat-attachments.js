const valid = item => item && /^[a-f0-9]{64}$/.test(item.id) && item.url === '/api/chat/imagenes/' + item.id;
export function setupChatAttachments({ api, form, changed, busy, error, canAdd }) {
  const picker = document.getElementById('chat-images-input');
  const list = document.getElementById('chat-attachments');
  const status = document.getElementById('chat-attachment-status');
  let items = [], uploading = 0, uploads = Promise.resolve();
  function paint() {
    list.hidden = !items.length;
    list.replaceChildren(...items.map(item => {
      const card = document.createElement('div'); card.className = 'chat-attachment';
      const link = document.createElement('a'); link.href = item.url; link.target = '_blank'; link.rel = 'noopener';
      link.setAttribute('aria-label', 'Ampliar ' + item.name);
      const image = document.createElement('img'); image.src = item.url; image.alt = item.name;
      link.append(image);
      const name = document.createElement('span'); name.textContent = item.name; name.title = item.name;
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '×'; remove.disabled = Boolean(uploading);
      remove.setAttribute('aria-label', 'Quitar ' + item.name);
      remove.addEventListener('click', () => { if (!canAdd()) return; items = items.filter(row => row.id !== item.id); paint(); changed(); });
      card.append(link, name, remove); return card;
    }));
    status.textContent = uploading ? 'Guardando imágenes…' : items.length ? items.length + '/4 imágenes · Puedes pegarlas o arrastrarlas aquí.' : 'Pega o arrastra imágenes · PNG, JPG o WebP · hasta 4 de 5 MB';
  }
  function pending(delta) { uploading += delta; paint(); busy(Boolean(uploading)); }
  async function upload(file) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || !file.size || file.size > 5_000_000) throw Error('Usa imágenes PNG, JPG o WebP de hasta 5 MB.');
    if (items.length >= 4) throw Error('Puedes adjuntar hasta cuatro imágenes. Quita una para añadir otra.');
    const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(Error('No se pudo leer la imagen.')); reader.readAsDataURL(file); });
    await new Promise((resolve, reject) => { const image = new Image(); image.onload = resolve; image.onerror = () => reject(Error('No se puede abrir esta imagen. Prueba con otra captura.')); image.src = data; });
    const item = await api('/api/chat/imagenes', 'POST', { name: file.name || 'Referencia.png', type: file.type, data: data.slice(data.indexOf(',') + 1) });
    if (!valid(item)) throw Error('No se confirmó la imagen. Vuelve a adjuntarla.');
    if (!items.some(row => row.id === item.id)) items.push(item);
    paint(); changed();
  }
  function add(files) {
    if (!canAdd()) return error('Espera a que se guarde el mensaje antes de adjuntar otra imagen.');
    const selected = Array.from(files || []); if (!selected.length) return;
    pending(1);
    uploads = uploads.then(async () => {
      for (const file of selected) { try { await upload(file); } catch (cause) { error(cause.message); } }
    }).finally(() => pending(-1));
  }
  document.getElementById('chat-attach-image').addEventListener('click', () => picker.click());
  picker.addEventListener('change', () => { add(picker.files); picker.value = ''; });
  form.addEventListener('paste', event => {
    const files = [...(event.clipboardData?.items || [])].filter(item => item.kind === 'file').map(item => item.getAsFile()).filter(Boolean);
    if (files.length) { event.preventDefault(); add(files); }
  });
  form.addEventListener('dragover', event => { if (event.dataTransfer?.types.includes('Files')) { event.preventDefault(); form.classList.add('is-dragover'); } });
  form.addEventListener('dragleave', event => { if (!form.contains(event.relatedTarget)) form.classList.remove('is-dragover'); });
  form.addEventListener('drop', event => { if (event.dataTransfer?.files.length) { event.preventDefault(); form.classList.remove('is-dragover'); add(event.dataTransfer.files); } });
  paint();
  return { items: () => [...items], ids: () => items.map(item => item.id),
    restore(value = []) { items = Array.isArray(value) ? value.filter(valid).slice(0, 4) : []; paint(); },
    async restoreIds(ids = []) {
      items = []; paint(); if (!ids.length) return;
      pending(1);
      try { items = await api('/api/chat/imagenes?ids=' + ids.join(',')); paint(); changed(); }
      catch (cause) { error(cause.message); }
      finally { pending(-1); }
    },
  };
}
