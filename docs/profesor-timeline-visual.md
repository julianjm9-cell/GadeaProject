# Línea temporal: renovación visual (16 de octubre de 2026)

Línea temporal pasa a Ejercicios avanzados. El tablero usa tarjetas de acontecimientos y posiciones conectadas de más antiguo a más reciente, con el mismo componente de arrastre, toque y teclado de Construye la frase. Se conservan los formatos de materiales y respuestas guardados.

Las fechas se ocultan en las etiquetas y nombres accesibles hasta comprobar. La corrección muestra las fechas y el resultado de cada posición. Modificar o reiniciar el orden retira la valoración anterior. La solución del modo personal se abre en una ventana independiente. La sesión compartida guarda también las colocaciones incompletas y permite al profesor seguirlas.

Con cuatro acontecimientos el tablero de escritorio cabe completo a 1280 × 720. Con ocho acontecimientos extensos, o en pantallas pequeñas, el contenido puede desplazarse para mantener la legibilidad; la navegación del modo personal permanece fuera del área desplazable.

## Fondo

Modo: herramienta integrada `image_gen`, usando la referencia visual aportada por el usuario.
Recurso guardado: `apps/profesor/assets/games/timeline-stage.png`.

Prompt final:

> Create only the CLEAN EMPTY BACKGROUND of the attached timeline educational game reference, landscape 16:9 raster image. Preserve the polished soft blue 3D academic stage: pale blue glowing floor and curved luminous blue rails along the lower left and right, softly dimensional Greek temple at upper far left, parchment scroll and translucent globe along left edge, an open book, hourglass, globe and rocket motif only at the far right. The central seventy five percent must be a calm, very pale ice blue unobstructed area for live HTML event cards. Remove absolutely all text, title, instructions, buttons, question panel, historical event pictures and cards, dashed answer slots, connecting timeline, plus symbols and counters. Reconstruct the background seamlessly behind the removed interface. Premium clean cohesive educational illustration, attractive to teens and adults, soft restrained lighting, no visual noise or overly strong glow. No letters, numbers, words, UI, cards or watermark.

## Validación

- 18 pruebas de onboarding, recursos públicos y sesiones superadas, con cobertura nueva de cronología incompleta, corrección por posición y reinicio sin valoraciones obsoletas.
- Sintaxis de los tres módulos JavaScript verificada con Node.
- Navegador y datos ficticios: tableros de cuatro y ocho acontecimientos, fechas ocultas y reveladas al corregir, resultado correcto y solución en diálogo.
- Arrastre real de un acontecimiento hasta su hueco; componente común previamente comprobado con toque y flechas de teclado.
- Partida por código: recuperación del orden incompleto tras recarga, respuesta correcta y seguimiento en el escritorio del profesor.
- Vista compartida móvil a 390 × 844 sin desbordamiento horizontal.
- Geometría de ocho acontecimientos comprobada para evitar cruces entre tarjetas y paneles.
- Pruebas de navegador existentes adaptadas a las nuevas tarjetas; sintaxis revisada, sin ejecutarlas por CLI en esta tarea.
- Rutas del CSS y fondo incorporadas a las comprobaciones del despliegue.
