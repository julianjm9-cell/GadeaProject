/* Documentos propios del profesor, agrupados como temas del temario. */
(() => {
  let activeFileId = '';
  let previewUrl = '';
  let previewRequest = 0;
  const supported = '.pdf,.docx,.txt,.md,.csv,.xlsx,.odt,.rtf,.pptx,.png,.jpg,.jpeg,.webp';
  const formatSize = bytes => bytes >= 1048576 ? (bytes / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(bytes / 1024)) + ' KB';
  const currentTopic = () => temarioTopic(temarioSelected);
  const fileRow = (file, topic) => `<button type="button" class="uploaded-topic-file ${file.id === activeFileId ? 'active' : ''}" data-upload-topic-file="${esc(file.id)}" data-upload-topic-id="${esc(topic.id)}" aria-pressed="${file.id === activeFileId}">${icon('file')}<span><strong>${esc(file.filename)}</strong><small>${formatSize(file.size)}</small></span><span aria-hidden="true">→</span></button>`;

  window.uploadedTopicDetail = topic => {
    if (!topic.documents.some(file => file.id === activeFileId)) activeFileId = topic.documents[0]?.id || '';
    const current = topic.documents.find(file => file.id === activeFileId);
    queueMicrotask(() => {
      const host = document.querySelector(`#uploadedTopicPreview[data-topic-id="${CSS.escape(topic.id)}"]`);
      if (host) showPreview(current, host);
    });
    return `<div class="temario-detail-heading"><span class="temario-topic-index">${String(temarioTopics().findIndex(item => item.id === topic.id) + 1).padStart(2, '0')}</span><div><small class="uploaded-topic-label">Mi tema · ${esc(topic.course)} · ${esc(topic.subject)}</small><h2>${esc(topic.title)}</h2></div></div>
      <section class="uploaded-topic-section"><div class="uploaded-topic-heading"><h3>${icon('file')} Mis documentos</h3><button type="button" data-upload-topic="add" data-upload-topic-id="${esc(topic.id)}">+ Añadir archivos</button></div><div class="uploaded-topic-files">${topic.documents.map(file => fileRow(file, topic)).join('')}</div></section>
      <section class="uploaded-topic-section"><div class="uploaded-topic-heading"><h3>Vista previa</h3>${current ? `<button type="button" data-upload-topic="download" data-upload-topic-file="${esc(current.id)}">Descargar original</button>` : ''}</div><div id="uploadedTopicPreview" class="attachment-preview" data-topic-id="${esc(topic.id)}" aria-label="Vista previa de ${esc(current?.filename || 'documento')}" aria-live="polite"><p>Cargando vista previa…</p></div></section>`;
  };

  async function blobFor(file, preview = false) {
    if (file.local) {
      const blob = await readLocalFile(file.id);
      if (!blob) throw Error('Este archivo de demostración no está disponible en este navegador.');
      return blob;
    }
    const path = '/api/profesor/materials/' + encodeURIComponent(file.id) + (preview ? '/preview' : '') + '?app=profesor_particular';
    const response = await authenticatedFetch(path);
    if (!response.ok) {
      let detail = 'No se pudo abrir el documento.';
      try { detail = (await response.json()).detail || detail; } catch {}
      throw Error(detail);
    }
    return response;
  }

  async function showPreview(file, host) {
    const request = ++previewRequest;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = '';
    host.classList.remove('attachment-document');
    host.replaceChildren();
    if (!file) return;
    const loading = document.createElement('p');
    loading.textContent = 'Cargando vista previa…';
    host.append(loading);
    try {
      const ext = file.filename.split('.').pop().toLowerCase();
      const result = await blobFor(file, true);
      let data;
      if (ext === 'docx' || ['xlsx', 'pptx', 'odt', 'rtf'].includes(ext)) {
        data = file.local ? null : await result.json();
      }
      const blob = data ? null : file.local ? result : await result.blob();
      if (request !== previewRequest || !host.isConnected) return;
      host.replaceChildren();
      if (data?.blocks) {
        host.classList.add('attachment-document');
        documentPreviewNodes(data.blocks, host);
      } else if (['txt', 'md', 'csv'].includes(ext)) {
        const pre = document.createElement('pre');
        pre.textContent = await blob.text();
        if (request === previewRequest && host.isConnected) host.append(pre);
      } else if (['pdf', 'png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
        const mime = {pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp'}[ext];
        previewUrl = URL.createObjectURL(new Blob([blob], {type:mime}));
        const viewer = document.createElement(ext === 'pdf' ? 'iframe' : 'img');
        viewer.className = ext === 'pdf' ? 'attachment-pdf' : 'attachment-image';
        viewer.src = previewUrl + (ext === 'pdf' ? '#view=FitH' : '');
        if (ext === 'pdf') viewer.title = 'Vista previa de ' + file.filename;
        else viewer.alt = file.filename;
        host.append(viewer);
      } else {
        const p = document.createElement('p');
        p.textContent = 'Este tipo de archivo no admite vista previa. Puedes descargar el original.';
        host.append(p);
      }
    } catch (error) {
      if (request === previewRequest && host.isConnected) {
        host.replaceChildren();
        const p = document.createElement('p');
        p.textContent = error.message;
        host.append(p);
      }
    }
  }

  async function download(file) {
    const result = await blobFor(file);
    const blob = file.local ? result : await result.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  function uploadDialog(topic = null) {
    const course = topic?.course || temarioCourse;
    const subject = topic?.subject || temarioSubject;
    modal(topic ? 'Añadir archivos · ' + topic.title : 'Subir mi tema', `<p>Se guardará en <strong>${esc(course)} · ${esc(subject)}</strong>. Podrás abrirlo desde este temario cuando lo necesites.</p>
      ${topic ? '' : '<label for="uploadedTopicTitle">Nombre del tema</label><input id="uploadedTopicTitle" name="title" required maxlength="180" placeholder="Por ejemplo: Ecuaciones de segundo grado">'}
      <label for="uploadedTopicFiles">Documentos</label><input id="uploadedTopicFiles" type="file" name="files" accept="${supported}" multiple required>
      <p class="modal-note">Puedes seleccionar varios archivos. PDF, Word, Excel, PowerPoint, OpenDocument, RTF, texto e imágenes · máximo 8 MB por archivo. Se muestran aquí sus vistas previas cuando el formato lo permite.</p><p id="uploadedTopicSelection" class="muted" aria-live="polite"></p>${submit(topic ? 'Añadir documentos' : 'Guardar tema')}`, async form => {
      const files = [...document.querySelector('#uploadedTopicFiles').files];
      if (!files.length) throw Error('Selecciona al menos un documento.');
      if (files.length > 20) throw Error('Selecciona hasta 20 documentos por vez.');
      const title = topic ? topic.title : String(form.get('title') || '').trim();
      if (!title) throw Error('Escribe un nombre para el tema.');
      for (const file of files) {
        if (!file.size || file.size > 8 * 1024 * 1024) throw Error('Cada documento debe contener datos y ocupar como máximo 8 MB.');
        if (!supported.split(',').some(ext => file.name.toLowerCase().endsWith(ext))) throw Error('Formato no admitido: ' + file.name);
      }
      const status = document.querySelector('#uploadedTopicSelection');
      const documents = [];
      for (const [index, file] of files.entries()) {
        status.textContent = `Subiendo ${index + 1} de ${files.length}: ${file.name}`;
        documents.push(await attachment(file));
      }
      if (topic) topic.documents.push(...documents);
      else {
        state.uploadedTopics ??= [];
        topic = {id:uid(),title,course,subject,explanation:'Documentos subidos por el profesor',uploadedDocuments:true,documents,updatedAt:new Date().toISOString()};
        state.uploadedTopics.push(topic);
      }
      save();
      await saveQueue;
      if (saveFailed) { render(); throw Error('Los archivos se han subido, pero no se pudo guardar el tema. Cierra esta ventana y pulsa Reintentar.'); }
      temarioCourse = course;
      temarioSubject = subject;
      temarioSelected = topic.id;
      temarioQuery = '';
      activeFileId = documents[0].id;
      render();
      notify(files.length === 1 ? 'Tema guardado con su documento.' : `Tema guardado con ${files.length} documentos.`);
    });
    const input = document.querySelector('#uploadedTopicFiles');
    input.addEventListener('change', () => {
      const files = [...input.files];
      document.querySelector('#uploadedTopicSelection').textContent = files.length ? files.map(file => `${file.name} (${formatSize(file.size)})`).join(' · ') : '';
      const title = document.querySelector('#uploadedTopicTitle');
      if (title && !title.value.trim() && files.length === 1) title.value = files[0].name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
    });
  }

  document.addEventListener('click', async event => {
    const fileButton = event.target.closest('[data-upload-topic-file]');
    if (fileButton) { activeFileId = fileButton.dataset.uploadTopicFile; render(); return; }
    const button = event.target.closest('[data-upload-topic]');
    if (!button) return;
    const topic = (state.uploadedTopics || []).find(item => item.id === button.dataset.uploadTopicId);
    if (button.dataset.uploadTopic === 'new') uploadDialog();
    if (button.dataset.uploadTopic === 'add' && topic) uploadDialog(topic);
    if (button.dataset.uploadTopic === 'download' && topic) {
      const file = topic.documents.find(item => item.id === button.dataset.uploadTopicFile);
      if (!file) return;
      button.disabled = true;
      try { await download(file); } catch (error) { notify(error.message); } finally { button.disabled = false; }
    }
  });
  window.addEventListener('pagehide', () => { if (previewUrl) URL.revokeObjectURL(previewUrl); });
})();
