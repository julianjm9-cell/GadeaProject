# Temario de Profesor Particular

El catálogo contiene **351 temas**: 279 de Primaria, ESO y Bachillerato y 72 de Español A1–C2. La navegación conserva curso o nivel, asignatura y búsqueda. La lista muestra solo títulos; el panel presenta el resumen y cuatro recursos: esquema, ejercicios, ejemplos y material preparado. Los permisos normal/Premium siguen aplicándose en pantalla y servidor.

## Revisión editorial de octubre de 2026

`apps/profesor/profesor-temario-revision.js` amplía el catálogo después de cargar las bases escolar y de español. Cada tema incorpora un objetivo, conocimientos previos, ejemplos comentados, una confusión concreta con su corrección y práctica con soluciones. Los contenidos se redactan por tema y curso; no se generan al abrir la pantalla. Los identificadores, títulos y organización se conservan.

Los recursos de ejemplos y ejercicios muestran **todos** los casos y actividades, tanto en pantalla como en PDF. La explicación usa títulos, énfasis y notación matemática mediante el sistema de presentación compartido.

Los 351 materiales preparados contienen seis actividades cada uno: **2.106** en total. Se eligen tipos adecuados al objetivo, sin imponer un juego para llegar a una cuota de variedad: problemas y razonamiento en matemáticas, contraste y uso lingüístico en idiomas, observaciones y relaciones en ciencias, e interpretación de fuentes o procesos en historia. Hay 18 casos numéricos con cálculo verificable, 10 actividades de completar en inglés, seis cronologías históricas y una secuencia de ciclo vital. Español conserva sus huecos, variantes válidas, lecturas y juegos de vocabulario, con nuevos ejemplos de aplicación y producción contextualizada.

La revisión es una selección editorial propia para clases particulares; no equivale a una certificación curricular ni a una revisión experta exhaustiva de cada materia. Referencias didácticas consultadas: [Plan Curricular del Instituto Cervantes](https://cvc.cervantes.es/ensenanza/biblioteca_ele/plan_curricular/indice.htm) y [recursos de ecuaciones equivalentes de INTEF](https://descargas.intef.es/recursos_educativos/geogebra/ESO/E21017/index.html).

## Persistencia y mantenimiento

El catálogo y sus actividades están incluidos en la aplicación. Leer, practicar o guardar una copia del material preparado no llama a IA ni consume créditos. Las copias reciben identificadores propios y conservan `preparedRevision`; editar una copia no modifica el catálogo ni las copias previamente guardadas. Las versiones personales del profesor continúan prevaleciendo sobre el tema base correspondiente.

Para actualizar el catálogo que utiliza el servidor al exportar PDF:

```sh
node scripts/export-profesor-temario.cjs
node scripts/export-profesor-temario.cjs --check
```

La revisión incluye su archivo en Docker y en las rutas estáticas. No requiere migraciones ni claves nuevas. La comprobación del despliegue verifica que ese archivo esté disponible.

## Verificación

`test_teacher_temario.py` valida los 351 materiales con el contrato real del generador y exporta los 1.053 recursos PDF. Comprueba símbolos, integridad y permisos. `test_teacher_question_quality.py` cubre cálculos, también con separadores de millar y signos negativos Unicode. `profesor-temario-browser.cjs` abre las 351 fichas y valida sus materiales; `profesor-temario-presentation-browser.cjs` verifica los 1.053 recursos, ejemplos y prácticas completos, copias independientes y visualización en escritorio y móvil. `profesor-spanish-browser.cjs` cubre niveles y alumnos mixtos.
