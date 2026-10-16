# Memory: renovación visual (16 de octubre de 2026)

Memory pasa a Ejercicios avanzados. El formato de los materiales guardados no cambia. El fondo es una imagen raster; las tarjetas, el progreso y los controles son HTML accesible. Los aciertos permanecen descubiertos; los fallos se muestran durante 950 ms y bloquean nuevas selecciones. La solución del modo personal se abre en un diálogo independiente.

## Recurso gráfico

Modo: herramienta integrada `image_gen`, edición de la referencia de Memory aportada por el usuario.
Resultado: `apps/profesor/assets/games/memory-stage.png` (1672 × 941).

Prompt final:

> Edit target: the provided Memory game screenshot. Create a CLEAN EMPTY BACKGROUND for the interactive Memory game, preserving the existing polished blue academic 3D stage exactly in spirit and composition: concentric soft blue arches, subtle white outline academic icons at the extreme left and right edges (book, atom, Greek column, globe), luminous blue railings at bottom, pale blue reflective stage floor. Remove ALL the UI from the input: every playing card, card panel, memory icon on cards, letters, heading, subtitle, counters, buttons, borders and translucent central rectangle. Seamlessly reconstruct the unobstructed blue stage behind them. Entire central 75% must be calm, very pale blue, open negative space for HTML cards, never a new image of cards. Wide landscape 16:9, premium coherent soft dimensional illustration, crisp clean edges, elegant suited to teens and adults, low visual noise and good contrast for dark overlaid UI. No text, no labels, no logo, no watermark, no interface elements anywhere. Use the attached screenshot only as background style and palette reference.

## Validación

- 13 pruebas de onboarding, recursos públicos y sesiones de material superadas.
- Sintaxis de ambos reproductores JavaScript verificada con Node.
- Navegador con datos ficticios en una base aislada: tableros personales de 6 y 8 parejas, selección y bloqueo de fallos, solución en diálogo.
- Sesión anónima de 2 parejas: acceso con código, fallo, aciertos y persistencia tras recarga; vistas de escritorio y móvil.
- Móvil personal de 8 parejas: dos columnas y navegación inferior accesible; desplazamiento del tablero para conservar la legibilidad.
- Comprobación de despliegue ampliada para detectar un fondo o CSS ausente.
