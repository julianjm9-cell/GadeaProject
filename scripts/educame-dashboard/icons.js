const svgNamespace = 'http://www.w3.org/2000/svg';
const networkIcons = new Set(['instagram', 'facebook', 'tiktok', 'youtube', 'linkedin', 'twitter']);

export function icon(name) {
  const svg = document.createElementNS(svgNamespace, 'svg');
  svg.setAttribute('class', 'panel-icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const use = document.createElementNS(svgNamespace, 'use');
  use.setAttribute('href', '/icons.svg#' + name);
  svg.append(use);
  return svg;
}

export function networkIcon(service) {
  const badge = document.createElement('span');
  const name = networkIcons.has(service) ? service : 'network';
  badge.className = 'network-icon network-' + name;
  badge.setAttribute('aria-hidden', 'true');
  badge.append(icon(name));
  return badge;
}

export function mountIcons() {
  for (const node of document.querySelectorAll('[data-icon]')) {
    node.prepend(icon(node.dataset.icon));
  }
  for (const node of document.querySelectorAll('[data-network-icon]')) {
    node.prepend(networkIcon(node.dataset.networkIcon));
  }
}
