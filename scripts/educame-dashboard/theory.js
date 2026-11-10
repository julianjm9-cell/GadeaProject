import { icon } from './icons.js';
import { theoryLibrary } from './theory-library.js';
import { developmentRoute } from './theory-development.js';
import { appLogo } from './workspace.js';

const progressKey = 'educame-theory-learned-v1';
const searchable = value => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es');

export function setupTheory({ element }) {
  const $ = id => document.getElementById(id);
  const search = $('theory-search');
  const categories = $('theory-categories');
  const content = $('theory-content');
  const progress = $('theory-progress');
  let track;
  let selected;
  let learned = new Set();
  try {
    const stored = JSON.parse(localStorage.getItem(progressKey));
    if (Array.isArray(stored)) learned = new Set(stored);
  } catch {
    // The library still works if browser storage is unavailable.
  }

  function renderProgress() {
    const lessons = track.flatMap(section => section.lessons);
    const count = lessons.filter(lesson => learned.has(lesson.id)).length;
    progress.max = lessons.length;
    progress.value = count;
    $('theory-progress-text').textContent = `${count} de ${lessons.length} lecciones aprendidas`;
  }

  const rows = [...theoryLibrary, ...developmentRoute].map(section => {
    const block = element('section', 'card theory-block');
    block.dataset.color = section.color;
    const heading = element('h2', 'icon-label', section.title);
    heading.prepend(icon(section.icon));
    block.append(heading, element('p', 'muted', section.description));
    if (section.flow) {
      const diagram = element('figure', 'theory-flow');
      const stops = element('ol');
      for (const [title, caption] of section.flow.stops) {
        const stop = element('li');
        stop.append(element('strong', '', title), element('span', '', caption));
        stops.append(stop);
      }
      diagram.append(element('figcaption', '', section.flow.title), stops);
      block.append(diagram);
    }
    const list = element('div', 'theory-lessons');
    const lessons = section.lessons.map(lesson => {
      const details = element('details', 'theory-lesson');
      const summary = element('summary');
      const mark = element('span', 'theory-lesson-icon');
      const copy = element('span', 'theory-lesson-copy');
      copy.append(element('strong', '', lesson.title), element('span', 'muted', lesson.summary));
      const chevron = icon('chevron');
      chevron.classList.add('theory-chevron');
      summary.append(mark, copy, chevron);

      const body = element('div', 'theory-lesson-body');
      const exercise = element('div', 'theory-practice');
      exercise.append(element('strong', '', 'Pruébalo en Educame'), element('p', '', lesson.practice));
      const actions = element('div', 'actions');
      if (lesson.link) {
        const link = element('a', 'text-link', lesson.link[0]);
        link.href = '#' + lesson.link[1];
        actions.append(link);
      }
      const toggle = element('button', 'button secondary theory-mark');
      toggle.type = 'button';
      function updateMark() {
        const done = learned.has(lesson.id);
        toggle.replaceChildren(icon('check'), done ? 'Aprendida' : 'Marcar como aprendida');
        toggle.setAttribute('aria-pressed', String(done));
        details.classList.toggle('is-learned', done);
        mark.replaceChildren(done ? icon('check') : appLogo(lesson.product) || icon('book'));
      }
      toggle.addEventListener('click', () => {
        if (learned.has(lesson.id)) learned.delete(lesson.id);
        else learned.add(lesson.id);
        try {
          localStorage.setItem(progressKey, JSON.stringify([...learned]));
        } catch {
          $('theory-storage-status').textContent = 'El navegador no permite guardar el progreso entre recargas.';
        }
        updateMark();
        renderProgress();
      });
      updateMark();
      actions.append(toggle);
      body.append(element('p', '', lesson.detail));
      if (lesson.files) {
        const references = element('div', 'theory-files');
        const files = element('ul');
        for (const file of lesson.files) {
          const row = element('li');
          row.append(element('code', '', file));
          files.append(row);
        }
        references.append(element('strong', '', 'Archivos que puedes abrir en el editor'), files);
        body.append(references);
      }
      if (lesson.example) {
        const [caption, code] = lesson.example;
        const example = element('figure', 'theory-code');
        const pre = element('pre');
        pre.append(element('code', '', code));
        example.append(element('figcaption', '', caption), pre);
        body.append(example);
      }
      body.append(exercise, actions);
      details.append(summary, body);
      list.append(details);
      return { details, index: searchable([section.title, lesson.title, lesson.summary, lesson.detail, lesson.practice, ...(lesson.files || [])].join(' ')) };
    });
    block.append(list);
    content.append(block);
    return { section, block, lessons };
  });

  function filter() {
    const terms = searchable(search.value).trim().split(/\s+/).filter(Boolean);
    let visible = 0;
    for (const { section, block, lessons } of rows) {
      let sectionCount = 0;
      for (const { details, index } of lessons) {
        const match = track.includes(section) && (selected === 'all' || section.id === selected) && terms.every(term => index.includes(term));
        details.hidden = !match;
        if (match) sectionCount++;
      }
      block.hidden = !sectionCount;
      visible += sectionCount;
    }
    for (const button of categories.children) button.setAttribute('aria-pressed', String(button.dataset.category === selected));
    $('theory-results').textContent = visible === 1 ? '1 lección' : `${visible} lecciones`;
    $('theory-empty').hidden = Boolean(visible);
  }

  function openTrack(development = false) {
    const next = development ? developmentRoute : theoryLibrary;
    if (track === next) return;
    track = next;
    selected = (development && track.find(section => section.lessons.some(lesson => !learned.has(lesson.id))) || track[0]).id;
    search.value = '';
    search.placeholder = development ? 'Busca Docker, FastAPI, CSS…' : 'Busca Git, copias, IA…';
    $('theory-topics-title').textContent = development ? 'Etapas de la ruta' : 'Explora por tema';
    $('theory-route-description').hidden = !development;
    for (const link of document.querySelectorAll('[data-theory-track]')) {
      if ((link.dataset.theoryTrack === 'development') === development) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    const all = { id: 'all', title: 'Todas', icon: 'book', color: 'blue' };
    const choices = [all, ...track].map((section, index) => {
      const choice = element('button', 'theory-category');
      choice.type = 'button';
      choice.dataset.category = section.id;
      choice.dataset.color = section.color;
      choice.append(icon(section.icon), element('span', '', section.title));
      if (development && index) {
        const number = element('span', 'theory-step', String(index).padStart(2, '0'));
        number.setAttribute('aria-hidden', 'true');
        choice.append(number);
      }
      choice.addEventListener('click', () => {
        selected = section.id;
        search.value = '';
        filter();
      });
      return choice;
    });
    categories.replaceChildren(...choices);
    renderProgress();
    filter();
  }
  search.addEventListener('input', () => {
    selected = 'all';
    filter();
  });
  return { openTrack };
}
