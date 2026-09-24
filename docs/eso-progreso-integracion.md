# ESO Adultos: integración limitada a Progreso

La mejora visual se limita a la sección **Progreso** de la aplicación existente. La navegación, Inicio, Biblioteca, lecciones, tests, Exámenes, simulacros, Profesor IA y Perfil siguen usando sus pantallas y funciones actuales.

Progreso incorpora cuatro vistas:

- **Mi escritorio:** nivel y XP, monedas, escena personalizable, tienda e inventario.
- **Logros:** hitos obtenidos y pendientes.
- **Estadísticas:** datos de temas, actividad y tests ya guardados.
- **Tu estudio:** panel mensual anterior completo, incluidos hitos, semana, materias y siguiente paso.

El progreso académico y la gamificación conservan sus fuentes de datos separadas. La interfaz nueva usa las rutas de gamificación existentes. La sección mensual reutiliza el mismo renderizador anterior, sin migrar ni rehacer el estado académico.

La escena del escritorio usa ahora 15 imágenes PNG propias en `apps/e25/assets/desk/`: un fondo de habitación y un recorte transparente para cada objeto del catálogo. Las imágenes se generaron con la herramienta integrada `image_gen` y se guardaron dentro del proyecto para que Docker las incluya al publicar. Los SVG anteriores permanecen disponibles como referencia.

**Prompt visual aplicado:** habitación de estudio adulta, cálida y luminosa, madera clara, ventana lateral y centro despejado para componer el escritorio; objetos individuales de mobiliario, plantas y decoración con acabado fotorrealista, luz natural coherente, encuadre completo y fondo realmente transparente; sin texto ni logotipos. Para las dos láminas se pidieron ilustraciones abstractas distintas (sol sobre colinas y camino hacia la montaña) dentro de un marco de roble claro. Se generó cada objeto por separado para que comprarlo o equiparlo cambie la escena real.

La vista previa revisada está en `tools/eso-progress-only-desktop.png` y `tools/eso-progress-only-mobile.png`. Las capturas usan un perfil de prueba; los porcentajes y monedas reales vendrán de los datos de cada alumno.

La rama `codex/eso-progress-only` contiene esta integración para revisión local. La rama `main` sigue siendo la versión que recibe Hostinger y no debe publicar este cambio hasta completar la revisión funcional y visual.
