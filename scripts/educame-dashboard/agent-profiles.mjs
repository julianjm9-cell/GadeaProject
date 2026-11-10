import { randomUUID } from 'node:crypto';
import { researchInstructions, researchRole } from './research.mjs';

export const defaultAgents = {
  mantenimiento: {
    name: 'Mantenimiento', description: 'Corrige fallos y comprueba que se resuelven.',
    draft: 'Diagnostica el fallo a partir del contexto. Propón una corrección pequeña y pasos reproducibles de prueba. Identifica hipótesis y evidencia que falta.',
    implementation: 'Reproduce el fallo y corrige su causa con el cambio más pequeño.',
    team: 'Identifica el problema, la intervención técnica y las comprobaciones que corresponden a tu rol.',
  },
  juegos: {
    name: 'Juegos', description: 'Crea y mejora packs de juegos jugables.',
    draft: 'Entrega un borrador de juego con objetivo, edad o nivel, reglas, preguntas, soluciones y explicación de cada respuesta. Incluye casos para validar las soluciones.',
    implementation: 'Crea o mejora todos los juegos solicitados. Identifica cada uno y comprueba su mecánica, soluciones, aciertos, errores y final. Reutiliza el motor y las referencias visuales del producto.',
    team: 'Si el encargo tiene componente educativo, diseña la mecánica jugable y su corrección. Si es indirecto, concreta qué implicaciones tiene para los juegos.',
  },
  marketing: {
    name: 'Marketing', description: 'Mejora landings, demos y contenido.',
    draft: 'Entrega un borrador editorial con gancho, guion breve, texto y llamada a la acción. Usa solo capacidades confirmadas y señala afirmaciones que requieran verificación.',
    implementation: 'Implementa los cambios de landing, textos, demostraciones o piezas del repositorio que solicita el encargo. Verifica las funciones que menciones.',
    team: 'Prepara el ángulo de comunicación y una pieza en borrador basada en la información confirmada.',
  },
  adaptacion: {
    name: 'Adaptación', description: 'Implementa demos y variantes para otros públicos.',
    draft: 'Entrega una ficha de producto con público, recorrido de una demo, componentes que conviene reutilizar y pruebas necesarias. Separa las decisiones pendientes de los hechos.',
    implementation: 'Implementa la variante o demo solicitada, reutilizando el motor y separando el progreso y la identidad del producto.',
    team: 'Estudia qué parte es reutilizable en otras apps y qué debe adaptarse al contexto de esta.',
  },
  revision: {
    name: 'Revisión', description: 'Comprueba entregas y corrige fallos.',
    draft: 'Evalúa la entrega y el encargo original de forma independiente. Empieza con un dictamen: apto para revisión humana o requiere cambios. Identifica errores y comprobaciones concretas.',
    implementation: 'Comprueba la entrega con independencia. Corrige los defectos que puedas reproducir y explica los que siguen pendientes.',
    team: 'Evalúa la propuesta o el objetivo desde la perspectiva de calidad y lista comprobaciones concretas.',
  },
  [researchRole]: {
    name: 'Copiador', description: 'Analiza webs y redes de referencia y propone ideas para Educame.',
    draft: '', implementation: '',
  },
  codex: {
    name: 'Codex directo', description: 'Responde a un encargo general sobre tus apps o implementa el cambio solicitado.',
    draft: 'Responde directamente al encargo. Cuando se pida un diagnóstico, comprueba el código pertinente y separa los hechos comprobados de las hipótesis. Cuando se pida un plan, ordénalo por resultado y explica cómo verificarlo.',
    implementation: 'Implementa el cambio pedido en la app elegida. Conserva el comportamiento existente que corresponda, comprueba el flujo afectado y explica el resultado y sus pruebas.',
    team: 'Resuelve la parte general del encargo y ten en cuenta el trabajo de los agentes especializados.',
  },
};

export const customAgentLimit = 24;
const customDraft = 'Analiza el encargo, usa el contexto de la app y entrega una propuesta concreta con pasos de comprobación.';
const customImplementation = 'Implementa el encargo en la app elegida y comprueba el flujo completo. Registra las pruebas ejecutadas y los resultados pendientes.';

export function agentDirectory(edits = {}) {
  return { ...defaultAgents, ...edits };
}

export function agentInstructions(id, profile = defaultAgents[id], implement = false) {
  if (id === researchRole) return [researchInstructions, profile?.draft].filter(Boolean).join('\n\n');
  return implement ? profile?.implementation : profile?.draft;
}

export function agentEditor(edits = {}) {
  return { profiles: Object.entries(agentDirectory(edits)).map(([id, profile]) => ({
    id, ...profile, builtIn: Object.hasOwn(defaultAgents, id), modified: Object.hasOwn(defaultAgents, id) && Object.hasOwn(edits, id),
  })), template: { draft: customDraft, implementation: customImplementation }, researchInstructions, customAgentLimit };
}

export function updateAgent(edits = {}, { action, id, profile }) {
  const current = agentDirectory(edits);
  if (action === 'restore' && typeof id === 'string' && Object.hasOwn(defaultAgents, id)) {
    const next = { ...edits };
    delete next[id];
    return next;
  }
  if (action === 'create') {
    if (id || Object.keys(current).length - Object.keys(defaultAgents).length >= customAgentLimit) {
      throw new Error('Puedes crear hasta 24 agentes personalizados.');
    }
    id = 'agente-' + randomUUID();
  } else if (action !== 'edit' || typeof id !== 'string' || !Object.hasOwn(current, id)) {
    throw new Error('Selecciona un agente válido.');
  }
  const read = (key, label, limit, required = true) => {
    const value = profile?.[key] ?? (required ? undefined : '');
    if (typeof value !== 'string' || value.length > limit || (required && !value.trim())) {
      throw new Error(label + ' admite hasta ' + limit + ' caracteres' + (required ? ' y es obligatorio.' : '.'));
    }
    return value.trim();
  };
  const name = read('name', 'El nombre', 48);
  const folded = text => text.normalize('NFKC').toLocaleLowerCase('es').replace(/\s+/g, ' ');
  if ([...Object.entries(current), ...Object.entries(defaultAgents)].some(([key, agent]) => key !== id && folded(agent.name) === folded(name))) {
    throw new Error('Ya hay un agente con ese nombre.');
  }
  const updated = { name, description: read('description', 'La descripción', 160),
    draft: read('draft', 'Las instrucciones del borrador', 3000, id !== researchRole),
    implementation: id === researchRole ? '' : read('implementation', 'Las instrucciones de implementación', 3000),
    team: id === researchRole ? '' : read('team', 'Las instrucciones para el equipo', 320, false) };
  return { ...edits, [id]: updated };
}
