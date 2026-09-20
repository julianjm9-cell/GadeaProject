# Revision de contenidos

Fecha de revision: 2026-09-19.

## Alcance entregado

- ESO: 72 preguntas originales, organizadas en seis asignaturas.
- Universidad +25: 96 preguntas originales, organizadas en ocho bloques.
- Opciones aleatorias conservando la respuesta correcta; sin modificar el banco original.
- Retirados los tests repetidos de consejos de estudio que se presentaban como tests especificos de cada tema.
- Apuntes base ampliados en 21 temas de ESO y 24 de universidad. Los demas conservan su contenido anterior.
- Cambridge: seleccion de nivel, filtrado de temas especificos, formato del examen en instrucciones de IA, criterios de Writing y limitaciones de la correccion oral a partir de transcripcion.
- Recursos de servidor y respaldo local sincronizados.

## Fuentes de referencia

- ESO Andalucia: https://www.juntadeandalucia.es/educacion/portales/es/web/educacion-permanente/servicios/pruebas/obtencion-titulo-eso
- Modelos ESO: https://www.juntadeandalucia.es/educacion/portales/web/educacion-permanente/servicios/pruebas/obtencion-titulo-eso/sobre-las-pruebas/modelos-de-convocatorias-anteriores
- Curriculo del ambito de gestion del Ministerio, no de todas las comunidades: https://www.boe.es/buscar/act.php?id=BOE-A-2023-16814
- UNED, programas: https://www.uned.es/universidad/inicio/estudios/acceso/acceso25/prueba-25/asignaturas-prueba-25.html
- Cambridge B2: https://www.cambridgeenglish.org/exams-and-tests/qualifications/first/preparation/
- Cambridge C1: https://www.cambridgeenglish.org/exams-and-tests/qualifications/advanced/preparation/
- Cambridge C2: https://www.cambridgeenglish.org/exams-and-tests/qualifications/proficiency/preparation/

Las preguntas son ejercicios propios, no reproducciones de examenes oficiales. Las fuentes oficiales se enlazan para consulta y practica. Disponibilidad publica no implica permiso para redistribuir sus materiales.

## Comprobaciones

Ejecutar `node tests/check-study-content.cjs` para validar sintaxis, bancos, respuestas, aleatorizacion, referencias de temas y paridad de enlaces.

Se han probado en navegador la correccion visual de acierto/fallo, el cambio de nivel y la ausencia de desbordamiento horizontal a 390 px. Estas pruebas usan respuestas locales simuladas para las API: no certifican el servicio de IA ni el guardado del servidor de produccion.

## Cobertura pendiente

Esta revision no certifica un temario completo. Falta desarrollar y revisar pedagogicamente todos los subtemas y sus ejercicios, adaptar itinerarios a cada comunidad/universidad, ampliar bancos y evaluar respuestas reales de IA con una muestra supervisada. Los bancos de universidad incluyen preguntas de fundamentos y no equivalen en dificultad a una prueba completa de acceso.
