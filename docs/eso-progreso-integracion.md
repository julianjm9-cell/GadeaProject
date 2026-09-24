# ESO Adultos: integración limitada a Progreso

La mejora visual se limita a la sección **Progreso** de la aplicación existente. La navegación, Inicio, Biblioteca, lecciones, tests, Exámenes, simulacros, Profesor IA y Perfil siguen usando sus pantallas y funciones actuales.

Progreso incorpora cuatro vistas:

- **Mi escritorio:** nivel y XP, monedas, escena personalizable, tienda e inventario.
- **Logros:** hitos obtenidos y pendientes.
- **Estadísticas:** datos de temas, actividad y tests ya guardados.
- **Tu estudio:** panel mensual anterior completo, incluidos hitos, semana, materias y siguiente paso.

El progreso académico y la gamificación conservan sus fuentes de datos separadas. La interfaz nueva usa las rutas de gamificación existentes. La sección mensual reutiliza el mismo renderizador anterior, sin migrar ni rehacer el estado académico.

La rama `codex/eso-progress-only` contiene esta integración para revisión local. La rama `main` sigue siendo la versión que recibe Hostinger y no debe publicar este cambio hasta completar la revisión funcional y visual.
