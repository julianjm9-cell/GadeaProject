# ESO Adultos - Paquete 06: integracion de la unidad

Revision: 20 de septiembre de 2026.

## Objetivo

Convertir la unidad modelo en un flujo de aprendizaje y no solo en contenido para leer.

## Integracion realizada

- Cada leccion desarrollada incorpora un campo de respuesta propio.
- El alumno confirma una lista breve de revision: responder todo, usar datos y revisar la presentacion.
- La evidencia se guarda en `state.learningEvidence` por tema y leccion.
- El registro conserva respuesta, comprobaciones, estado y fecha de entrega.
- Una leccion desarrollada no puede marcarse como completada sin al menos 40 caracteres y dos comprobaciones.
- Los apuntes, el progreso antiguo y los identificadores existentes se conservan.

## Significado del estado

- **Pendiente:** no existe evidencia suficiente.
- **Evidencia guardada:** la entrega cumple las condiciones formales y permite completar la leccion.
- **Completada:** existe evidencia y el alumno ha cerrado la leccion.

La app no llama `dominado` a una autoevaluacion. La correccion objetiva o por rubrica se incorporara en simulacros y evaluaciones posteriores.

## Criterio de salida

La respuesta debe sobrevivir al renderizado, quedar incluida en el estado del usuario y bloquear el completado si falta. La vista debe funcionar en escritorio y movil sin desbordamiento horizontal.
