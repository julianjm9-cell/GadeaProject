import { access } from 'node:fs/promises';
import { join } from 'node:path';

export async function qualityCommands(cwd, app, files) {
  const candidates = {
    control: ['tests/educame-chat-queue.test.cjs', 'tests/educame-knowledge.test.cjs', 'tests/educame-providers.test.cjs'],
    profesor: ['apps/profesor/tests/all-games-catalog.test.cjs', 'apps/profesor/tests/challenge-games.test.cjs', 'apps/profesor/tests/mini-games.test.cjs'],
    eso: ['tests/eso-games-catalog.test.cjs', 'tests/eso-recovery-browser.test.cjs'],
    ingles: ['tests/cambridge-route-progress-browser.test.cjs', 'tests/cambridge-missions-browser.test.cjs'],
  };
  const selected = [];
  for (const file of candidates[app] || []) if (await access(join(cwd, file)).then(() => true, () => false)) selected.push('node --test ' + file);
  if (app === 'control' && files.some(file => /\.(?:css|html|js)$/.test(file)) &&
      await access(join(cwd, 'tests/educame-dashboard-browser.test.cjs')).then(() => true, () => false)) {
    selected.push('node --test --test-name-pattern="Chat|Memoria|Publicación" tests/educame-dashboard-browser.test.cjs');
  }
  if (app === 'profesor' && files.some(file => /\.(?:css|html|js)$/.test(file)) &&
      await access(join(cwd, 'tests/safari-compatibility-browser.test.cjs')).then(() => true, () => false)) {
    selected.push('node --test tests/safari-compatibility-browser.test.cjs');
  }
  if (!selected.length && await access(join(cwd, 'tests/run-unit.cjs')).then(() => true, () => false)) selected.push('npm.cmd test');
  return selected;
}

export const specialistAcceptance = {
  juegos: 'Comprueba cada juego solicitado: objetivo, respuestas correctas y variantes admitidas, error, reintento, final, guardado y tacto/teclado. Reutiliza las ilustraciones de la ficha y coloca las respuestas dentro del escenario. No aceptes una imagen de fondo como única mejora.',
  marketing: 'Comprueba que cada afirmación describa una función existente. Revisa enlaces, imágenes cargadas, contraste, foco, móvil, títulos y metadatos. No publiques en redes ni afirmes resultados de posicionamiento.',
  mantenimiento: 'Reproduce el fallo original, comprueba su causa y añade o ejecuta una regresión que falle antes del arreglo cuando corresponda. Verifica guardado, recarga y errores tardíos si se toca estado.',
  adaptacion: 'Conserva el núcleo y separa el público, las rutas y los datos de la variante. Comprueba el recorrido de entrada y la compatibilidad del contenido existente.',
  revision: 'Revisa el código y la petición original con independencia. Corrige defectos reproducibles, comprueba las pruebas y registra lo que siga pendiente. No aceptes solo la descripción del implementador.',
  codex: 'Comprueba el flujo completo pedido, conserva los controles y los datos existentes y distingue la copia local, GitHub y el despliegue.',
};
