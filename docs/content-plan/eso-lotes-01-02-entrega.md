# Lotes de contenido 1 y 2

Fecha: 20/09/2026. Integracion local; sin publicacion.

## Material integrado

- Lote 1: resumen, ortografia y algebra (expresiones, ecuaciones, sistemas y problemas).
- Lote 2: gramatica, redaccion y argumentacion.
- Cada tema contiene cuatro lecciones originales con teoria, ejemplo por pasos, ejercicio, solucion, errores frecuentes y criterio de revision.
- Ocho preguntas originales por tema, cada una con opciones y explicacion. Total nuevo: 24 lecciones y 48 preguntas.
- Acceso directo desde el tema a su test. Se mantiene el repaso mixto previo sin cambiar sus identificadores.
- Las explicaciones aparecen tras corregir, junto con acierto/fallo. La tarjeta y su contador se actualizan sin salir del test.
- Las fuentes concretas aparecen en Recursos de cada tema.
- La entrega escrita se etiqueta como autoevaluacion: guardar una respuesta no certifica su correccion.

## Fuentes de consulta

La redaccion y los ejercicios son propios. Estas fuentes sirven para contrastar conceptos y orientar la cobertura, no como acreditacion del material:

- Curriculo ESPA de Andalucia: https://www.juntadeandalucia.es/boja/2025/86/1
- RAE, tilde: https://www.rae.es/dpd/tilde
- RAE, coma: https://www.rae.es/dpd/coma
- RAE, esquemas gramaticales: https://www.rae.es/gtg/docs/GTG_esquemas_web.pdf
- INTEF, coherencia: https://descargas.intef.es/recursos_educativos/It_didac/Leng_ESO/2/02/El_texto_y_sus_propiedades/caractersticas_de_la_coherencia.html
- INTEF, adecuacion: https://descargas.intef.es/recursos_educativos/It_didac/Leng_ESO/2/09/Los_gneros_discursivos_de_acuerdo_con_el_mbito_de_uso_1/1_la_adecuacin_de_los_textos_a_la_situacin_comunicativa.html
- INTEF, revision de opinion: https://descargas.intef.es/recursos_educativos/It_didac/Leng_ESO/2/02/El_texto_y_sus_propiedades/LISTA_CONTROL_TEXTO_DE_OPINION.pdf
- Proyecto Descartes, 2 ESO: https://proyectodescartes.org/EDAD/mat_2eso_cast-LOMLOE.htm
- Proyecto Descartes, sistemas (recurso anterior, para tecnica algebraica): https://proyectodescartes.org/descartescms/matematicas/edad/item/2385-sistemas-de-ecuaciones

## Verificacion

Prueba especifica: node tests/check-eso-content-batches.cjs.
Comprueba las 24 lecciones, que los seis tests usan su banco real, puntuacion con opciones barajadas, explicaciones y guardado de apuntes/evidencia/resultados tras recarga. La API se simula para no modificar cuentas reales; no es una prueba de persistencia del servidor de produccion ni de respuestas reales de IA.

Se mantienen las comprobaciones generales de contenido y unidad modelo. Capturas de escritorio y movil en tools/eso-lotes-1-2-*.png.

Estado acumulado: 12 de 65 temas desarrollados. Quedan 53 temas y los lotes 3-20. No se considera terminado todo el temario.
