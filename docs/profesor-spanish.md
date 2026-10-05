# Español como lengua extranjera

Español es una asignatura distinta de Lengua escolar. Está disponible en alumnos, clases, progreso, biblioteca, generador manual/IA y Profesor de apoyo. El selector del temario y del generador muestra Nivel cuando se elige Español: A1, A2, B1, B2, C1 y C2.

Cada alumno conserva su curso escolar y un `spanishLevel` independiente. Los adultos pueden elegir Adultos / Sin curso escolar. Añadir o editar Español permite seleccionar el nivel; las cuentas existentes no pierden datos. Si un alumno ya tenía Español sin nivel, se utiliza A1 hasta que el profesor lo ajuste. Al cambiar de Español a una asignatura escolar, el generador recupera el curso escolar.

## Contenido

`apps/profesor/profesor-spanish.js` contiene 72 unidades originales, 12 por nivel. Se toma como referencia la organización y los inventarios del [Plan Curricular del Instituto Cervantes](https://cvc.cervantes.es/ensenanza/biblioteca_ele/plan_curricular/indice.htm). Es una selección didáctica propia para clases particulares, no un programa oficial acreditado ni una preparación exhaustiva para DELE.

Cada unidad incluye explicación, modelo contextual, contraste comentado, objetivo, conceptos, pasos, tres prácticas con soluciones y transferencia. La vista detallada y los PDF muestran tablas de contraste entre formas o interpretaciones. Hay 72 materiales preparados de seis actividades cada uno (432 actividades): huecos, elección o memory, corrección, comprensión con pregunta específica, flashcard y producción breve. Las respuestas abiertas se revisan con el profesor; los juegos de parejas usan asociaciones explícitas. Se conservan tildes y ñ; las variantes legítimas se explican según el contexto.

El catálogo del servidor se exporta con `node scripts/export-profesor-temario.cjs`; `--check` verifica que coincide con el catálogo de pantalla. El total es 351 temas. Los 279 anteriores se conservan sin cambios de contenido.

## Generación y acceso

La IA recibe guías MCER específicas y no interpreta A1–C2 como edades o cursos escolares. El servidor exige un nivel válido para Español tanto en el generador como en Profesor de apoyo. Se mantienen los permisos existentes: esquema gratuito, recursos completos y Profesor de apoyo Premium, imágenes según licencia. Añadir Español no modifica planes ni créditos.

## Verificación

- `tests/profesor-spanish-browser.cjs`: seis niveles, 12 temas por nivel, alumno con curso y nivel independientes, edición, cambio de asignatura en generador, actividad preparada y móvil.
- `tests/profesor-temario-browser.cjs`: renderizado y contratos de materiales de las 351 unidades.
- `backend/tests/test_teacher_spanish.py`: contratos de las 72 unidades y materiales, guías de IA, rechazo de niveles incorrectos, persistencia y permisos PDF.
- `backend/tests/test_teacher_temario.py`: todos los recursos PDF y entrega de los archivos en Docker.

No requiere migraciones de base de datos ni claves nuevas. Las pruebas de IA utilizan respuestas simuladas y no consumen créditos del proveedor.
