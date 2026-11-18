import { projectProfiles } from './project-context.mjs';
const key = 'terrace-app-catalog-v2';
const paths = { profesor: '/profesor-particular', eso: '/eso-adultos', ingles: '/cambridge', diplomator: '/app',
  universidad: '/universidad-adultos', facturas: '/facturas', hazlotu: '/hazlo-tu', gadeos: '/gadeos' };
const products = { profesor: 'PROFESOR_PARTICULAR', eso: 'ESO_ADULTOS', ingles: 'CAMBRIDGE', diplomator: 'DIPLOMATOR',
  universidad: 'UNIVERSIDAD_ADULTOS', facturas: 'OCR_FACTURAS', hazlotu: 'HAZLOTU', gadeos: 'GADEOS' };
export function createAppCatalog(store) {
  return {
    read() {
      const saved = store.operation(key);
      if (saved) return saved;
      return { revision: 0, verified: false, apps: Object.entries(projectProfiles).filter(([id]) => !['ecosistema', 'control'].includes(id))
        .map(([id, profile]) => ({ id, name: profile.name, path: paths[id], product: products[id], existing: true, personal: id === 'gadeos', state: null })) };
    },
    remember(data) {
      if (!data || !Array.isArray(data.apps) || !Number.isInteger(data.revision)) return;
      const catalog = { ...data, verified: true, apps: data.apps.map(app => ({ ...app, existing: Object.hasOwn(projectProfiles, app.id) })) };
      store.writeOperation(key, catalog);
      return catalog;
    },
  };
}
