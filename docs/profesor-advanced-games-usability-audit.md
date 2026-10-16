# Revisión de los siete juegos avanzados

Fecha: 16 de octubre de 2026.

## Resultado

Se revisaron Pasapalabra, Ahorcado, Sopa de letras, Memory, Flashcards,
Construye la frase y Línea temporal. La revisión incluye el reproductor personal
y el acceso de un participante mediante código. Las pruebas se realizaron con
cuentas ficticias y una base de datos aislada; no se modificaron cuentas reales.

No equivale a demostrar que sean «lo más divertidos posible»: eso requiere observar
a usuarios jugando. Sí permite corregir obstáculos verificables de interacción,
legibilidad y coherencia entre los dos reproductores.

## Cambios aplicados

| Juego | Revisión y mejoras |
| --- | --- |
| Pasapalabra | El acceso por código conserva las 27 posiciones, con huecos grises para letras sin actividad. Distingue «Con la» y «Contiene la» sin enviar las respuestas. Anterior y siguiente guardan el borrador; el foco vuelve al cuadro de texto. Las pistas personales no se reducen por debajo de 14 px. En móvil se separa la tarjeta del rosco y se permite desplazamiento vertical para evitar solapamientos. |
| Ahorcado | El jugador compartido usa el fondo y un tablero organizado con pista, vidas, palabra y teclado. N y Ñ son letras distintas también en el servidor. Los signos y números se muestran desde el principio. Se puede utilizar el teclado físico sin interceptar atajos con Ctrl/Alt/Meta. El botón personal «Comprobar», que solo informaba del estado, se llama «¿Cómo voy?». |
| Sopa de letras | El participante puede encontrar cualquier palabra sin tener que seleccionarla primero en la lista. Acepta primera/última letra y arrastre, incluidos diagonales y sentido inverso. Hay pista de inicio, borrado de selección y mensajes de resultado. El servidor acepta cualquier aparición válida de la palabra, aunque coincida con otra aparición accidental del relleno. El reproductor personal también valida por el texto de la selección y resalta el recorrido realmente elegido. Se navega por las casillas con flechas y se marca con Enter. |
| Memory | El foco de teclado se conserva al destapar y resolver parejas, en ambos reproductores. Se mantiene la pausa breve que permite ver una pareja fallida. Contador personal con singular/plural correcto. |
| Flashcards | La valoración se presenta como autoevaluación guardada, evitando decir que una decisión de «Repasar» es una respuesta objetivamente incorrecta. Textos largos con peso y alineación más legibles. Se conserva el revelado de respuesta bajo petición. |
| Construye la frase | Verificados añadir piezas, orden correcto, comprobación y fondo en ambos reproductores. Se mantienen los controles existentes de retirada, flechas y reinicio. |
| Línea temporal | Verificados colocación, comprobación y aparición de fechas. Fondo y navegación correctos en ambos reproductores. Se mantiene el tablero accesible compartido con Construye la frase. |

Los siete juegos mantienen sus imágenes rasterizadas. Se añadieron estilos
compartidos para los tres primeros al entrar por código, que todavía utilizaban
una presentación anterior. Los contenedores estrechos reorganizan el contenido
en lugar de forzar una tarjeta central demasiado pequeña. El cambio de ejercicio
compartido lleva al inicio del tablero.

## Verificación realizada

- Navegador: recorrido de los siete juegos en escritorio (1280 × 720), tanto
  personal como por código; respuestas correctas en Pasapalabra y Ahorcado,
  selección y arrastre diagonal en Sopa de letras, destapado con teclado en
  Memory, revelado y autoevaluación en Flashcards, y orden/comprobación en los
  dos juegos de secuencias.
- Móvil simulado (390 × 844): revisión de los siete tableros en los dos
  reproductores, fondos presentes y sin desbordamiento horizontal. En el modal
  personal la navegación exterior queda dentro de la pantalla. Se corrigió el
  solapamiento entre tarjeta, resultados y controles de Pasapalabra detectado
  durante esta revisión.
- Tamaño intermedio: comprobación de tarjeta y texto compartidos a 980 y 900 px.
- Recarga de la sesión compartida: se conserva el progreso de Pasapalabra.
- Consola: sin errores en las tres pestañas principales de prueba.
- Servidor: 22 pruebas de onboarding y sesiones, incluidas nuevas regresiones
  para Ñ, pistas sin respuestas filtradas y rutas válidas/incorrectas de palabras.
- JavaScript: comprobación sintáctica de los dos reproductores con Node.
- Despliegue: nueva hoja de estilos servida por la misma ruta de recursos y
  añadida al comprobador de despliegue. Versionadas las URLs para renovar caché.

Captura de prueba local: `tmp/advanced-games-audit-wordsearch.png` (no contiene
información real y no se incluye en el repositorio).

## Límites y siguiente validación útil

Se comprobaron ejemplos representativos, no todas las combinaciones posibles de
materiales ni todos los dispositivos. La vista móvil del navegador no sustituye
una prueba táctil en un teléfono físico. No se ha realizado una auditoría completa
WCAG ni una prueba de usabilidad con participantes reales.

La prueba más útil ahora es observar, sin explicar los controles, si un profesor
puede abrir y compartir cada juego y si un participante descubre cómo responder,
pedir pista, corregirse y terminar. Anotar dónde duda y si quiere repetir permite
valorar intuición y diversión sin añadir elementos que distraigan del aprendizaje.

No se ha desplegado en Hostinger desde este entorno. Para actualizar el VPS:

```bash
cd /opt/educa-suite && git pull --ff-only && bash infra/deploy-hostinger.sh
```
