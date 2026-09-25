# ESO Adultos: lavado visual de la app actual

La renovación se aplica a la base funcional existente. Inicio, Asignaturas, Exámenes, Progreso, las lecciones, el Profesor IA y el perfil conservan sus rutas, identificadores y acciones. `REDESIGN_MODE` sigue desactivado para que Exámenes permanezca en la navegación principal.

En ordenador, Inicio presenta una escena del escritorio, la duración de la sesión como decisión principal y cuatro accesos breves. La navegación usa el mismo azul y blanco que las propuestas, con tarjetas más claras, menos texto visible y controles de tamaño cómodo. Asignaturas y las pantallas de estudio reciben el mismo tratamiento visual; los temas y resultados siguen leyendo el estado académico anterior. En móvil, las mismas acciones se ordenan en una columna sin perder accesos.

Las capturas de revisión son `tools/eso-refresh-home-desktop.png`, `tools/eso-refresh-library-desktop.png`, `tools/eso-refresh-subject-desktop.png`, `tools/eso-refresh-exams-desktop.png` y `tools/eso-refresh-home-mobile.png`. Usan datos de prueba; el contenido y el progreso de cada persona se cargan de su cuenta.

El cambio se preparó en `codex/eso-desktop-refresh` y se incorporó a `main` junto con la mejora de Progreso. No hay que sustituir la aplicación por el prototipo HTML de `docs/prototypes`.
