# Tres juegos avanzados: misterio, intruso y bingo

Se incorporan al catálogo de ejercicios avanzados, la biblioteca, el editor manual, la generación con IA, el jugador individual, las sesiones con código y la exportación PDF. Se reutilizan los fondos raster ilustrados existentes. No hay cambios de esquema ni migraciones de datos.

| Tipo | Contenido | Interacción |
| --- | --- | --- |
| `mystery` — ¿Quién soy? | Tres pistas distintas, respuesta de hasta 100 caracteres y alternativas opcionales | Empieza con una pista; permite descubrir las siguientes y comprobar la respuesta. Acierto con una, dos o tres pistas: 30, 20 o 10 puntos. |
| `intruder` — Elimina al intruso | Entre tres y cinco tarjetas distintas; solución idéntica a una tarjeta | Elegir y comprobar. Verde o rojo con texto de estado; la explicación se muestra tras acertar. |
| `bingo` — Bingo de conceptos | Nueve pares `concepto | definición`; conceptos hasta 80 caracteres, definiciones hasta 140 | Cartón 3 × 3 y definiciones mezclados por separado. Se comprueba cada elección y se celebran línea y cartón completo. |

El editor presenta campos específicos para cada formato, sin exigir escribir JSON. Las pistas del misterio no pueden incluir la respuesta y las definiciones del bingo no pueden contener su propio concepto. El generador valida estructura, cantidades y duplicados; una respuesta parcial del bingo conserva las entradas válidas al recuperar las restantes.

En sesiones compartidas, el servidor guarda el cartón y comprueba cada respuesta. Las tarjetas y pistas utilizan identificadores aleatorios independientes; el navegador del alumno no recibe la correspondencia de soluciones. Al recargar se conservan respuestas, pistas descubiertas, definición activa y casillas comprobadas. Las explicaciones del misterio y del intruso permanecen disponibles después del acierto. El contenido se prepara antes de jugar y no se llama a la IA durante la partida.

Los tres tipos comparten el cupo existente de un juego avanzado con IA al día para cuentas normales (trece tipos en total); la creación manual sigue libre y las sesiones con código siguen siendo Premium. No se alteran créditos, fichas de alumnos ni materiales existentes.

Interfaz: controles HTML accesibles por teclado, corrección con texto además de color, bloqueo durante el guardado, mensajes de error que conservan la respuesta, navegación fuera del área desplazable y disposición adaptable a móvil. Los textos extensos se ajustan y se permite desplazamiento vertical cuando es necesario.

Validación: 136 pruebas del servidor (generación, recuperación, permisos, cuotas, sesiones y PDF) y tres pruebas JavaScript. Revisión en navegador de creación manual, edición, errores y aciertos, los tres juegos individuales, una partida completa de bingo, sesiones con código y conservación al recargar. Vistas verificadas en escritorio y a 390 × 844. No se realizaron llamadas de pago a proveedores de IA ni cambios en datos de producción.
