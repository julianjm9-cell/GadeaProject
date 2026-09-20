# ESO Adultos - Paquete 09: Profesor IA

Revision: 20 de septiembre de 2026.

## Objetivo

Hacer que el profesor responda sobre lo que el alumno esta viendo y ha hecho, en lugar de comportarse como un chat generico.

## Contexto incorporado

- Pantalla, materia, tema y leccion activos.
- Objetivo, teoria, ejemplo y criterio de superacion de una unidad desarrollada.
- Evidencia escrita del alumno y estado de entrega.
- Ambito, enunciado y matriz de puntos del simulacro actual.
- Progreso mensual y plan de la sesion diaria cuando corresponda.

## Comportamiento

- Ofrece pistas antes de soluciones completas.
- Al revisar una evidencia indica un acierto, una mejora concreta y el siguiente intento.
- No inventa normativa, notas ni datos del usuario.
- Declara orientativa cualquier correccion de examen.
- Las sugerencias cambian segun falte evidencia, exista una entrega o se este preparando un simulacro.
- Se elimina el envio duplicado de la pregunta actual en el historial del prompt.

## Presentacion

Las respuestas admiten titulos, negritas, listas y tablas seguras. Cada respuesta puede abrirse en una ventana amplia y legible sin perder el chat compacto.

## Criterio de salida

El contexto debe contener la rubrica o evidencia activa, el formato enriquecido no debe aceptar HTML sin escapar y la ventana ampliada debe funcionar en escritorio y movil.
