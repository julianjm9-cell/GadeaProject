# Construye la frase: renovación visual (16 de octubre de 2026)

Se mueve a Ejercicios avanzados. Piezas de colores, huecos numerados, progreso, reinicio, comprobación y solución en un diálogo independiente. Un componente común sirve al reproductor personal, al participante por código y al seguimiento del profesor.

Las piezas admiten arrastre con eventos de puntero, colocación tocándolas y recolocación con flechas de teclado. Cada aparición de una palabra es una pieza independiente, aunque tenga el mismo texto. El formato guardado sigue siendo el mismo; los materiales anteriores se pueden abrir. Al editar una frase compartida se elimina la valoración anterior, también en el servidor, para no mostrar un acierto desactualizado al recargar.

## Recurso gráfico

Modo: herramienta integrada `image_gen` a partir de la referencia del usuario.
Archivo: `apps/profesor/assets/games/sentence-stage.png` (1672 × 941).

Prompt final:

> Use the attached sentence building game as the visual reference. Produce only its beautiful clean empty background, wide 16:9 raster illustration. Preserve its elegant pale ice blue academic world, soft dimensional open book cropped at far left, subtle gear lower left, translucent lightbulb upper right, globe outline and classical columns along the right edges, flowing pale blue ribbons with delicate dotted paths and soft highlights. Remove ALL text, UI headings, labels, playing word tiles, central question rectangle, answer slots, panels, arrows, progress bars and buttons. Reconstruct the calm background behind the entire interface. Central 75 percent should remain very pale blue open negative space for live HTML components. Coherent premium soft 3D learning app aesthetic, legible and refined for teens and adults, gentle contrast at edges only. No text, letters, numbers, cards, UI or watermarks.

## Validación

- 16 pruebas de onboarding, recursos públicos y sesiones superadas, incluidas nuevas pruebas de palabras repetidas, guardado parcial y retirada de una valoración obsoleta.
- Sintaxis verificada con Node en los tres módulos JavaScript.
- Navegador con datos ficticios: colocación, arrastre real de una palabra, recolocación con teclado, comprobación correcta, reinicio y solución en diálogo.
- Sesión anónima: recuperación de una frase a medio construir tras recargar, comprobación correcta y seguimiento en el escritorio del profesor.
- Frase con dos piezas I y dos like completada correctamente en la sesión compartida.
- Vistas de escritorio y móvil de 390 × 844 verificadas, sin desbordamiento horizontal y con navegación separada.
- Prueba existente de frases antiguas adaptada a las piezas; el resto de su cobertura se conserva.
- Nuevo módulo, CSS y fondo incluidos en las rutas públicas, imagen Docker y comprobaciones del despliegue.
