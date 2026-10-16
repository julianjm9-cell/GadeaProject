# Flashcards: renovación visual (16 de octubre de 2026)

Flashcards pasa a Ejercicios avanzados. El formato guardado y las tres valoraciones existentes se conservan. La tarjeta mantiene el mismo tamaño al girar y reserva espacio para las valoraciones. Los textos extensos usan una tipografía menor; si un contenido excepcional no cabe, permanece accesible mediante desplazamiento dentro de la tarjeta.

El reproductor compartido permite volver a la pregunta sin consultar de nuevo la API. La primera revelación sigue pasando por el servidor. Se corrige que la respuesta de esa petición se interpretase erróneamente como una calificación.

## Fondo

Modo: herramienta integrada `image_gen`, a partir de la referencia Flashcards del usuario.
Recurso guardado: `apps/profesor/assets/games/flashcard-stage.png` (1672 × 941).

Prompt final:

> Use the attached Flashcards screenshot as the visual reference. Create just the clean empty background, 16:9 landscape raster illustration: luminous very pale ice blue and soft lavender academic world, dimensional Greek columns cropped at far left, a globe cropped at lower right, floating translucent blue book and atom motifs only around outer edges, delicate white orbital lines and a few soft light points. Elegant, polished, gentle 3D educational illustration suited to all ages, coherent with a premium blue learning app. Remove absolutely ALL interface, text, letters, numbers, flashcards, white panels, badges, headings, buttons, progress bars and the central stack of cards. Reconstruct the empty space behind them. Keep middle 70% of image calm, pale and open for a real interactive HTML card to be placed later. Preserve the reference palette, decorative edge composition and beautiful soft lighting; avoid overbright glow, visual clutter or strong contrast at the center. No text, no watermark, no UI, no cards.

## Validación

- 14 pruebas de onboarding, recursos públicos y sesiones, incluida una nueva prueba de revelación, protección de la solución y persistencia de la autoevaluación.
- Sintaxis verificada con Node en ambos reproductores.
- Navegador con base de datos y cuentas ficticias: giro en ambas direcciones, selección de valoración, navegación y teclado Espacio.
- Dimensiones idénticas de la tarjeta antes y después del giro en escritorio; respuesta de varios párrafos completa sin desplazamiento a 1280 × 720.
- Vista móvil a 390 × 844: valoración y navegación visibles, sin desbordamiento horizontal.
- Sesión anónima real por código: revelar, valorar, volver al anverso y recuperar la valoración tras recargar.
- Fondo y CSS incluidos en las comprobaciones del despliegue.
