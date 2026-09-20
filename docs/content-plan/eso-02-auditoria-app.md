# ESO Adultos - Paquete 02: auditoria de la app

Revision: 20 de septiembre de 2026.

## Alcance

Esta auditoria compara el contenido y los flujos actuales de `apps/e25/index.html` con la referencia andaluza fijada en el paquete 01. No certifica el temario ni modifica todavia el indice curricular. Su objetivo es localizar que sirve, que es solo una aproximacion y que debe corregirse primero.

## Resumen ejecutivo

La app ya tiene una navegacion clara, seis materias utiles para estudiar y una base tecnica funcional. Sin embargo, todavia no debe presentarse como preparacion completa ni como simulador fiel de la prueba andaluza de 2026.

Los cuatro problemas principales son:

1. Las 260 lecciones son un desglose visual, no 260 contenidos desarrollados. Comparten plantillas y solo 21 de 65 temas tienen una teoria base revisada.
2. Los tests no evaluan cada tema. Hay un unico test mixto por materia construido con 12 preguntas generales.
3. Los modelos de examen son esqueletos genericos y no reproducen secciones, puntuacion, extension ni duracion oficial.
4. El progreso mide clics y marcas de completado, no dominio demostrado por actividades o criterios.

## Inventario medido

| Materia visible | Temas | Lecciones visibles | Temas con teoria revisada | Preguntas usadas |
|---|---:|---:|---:|---:|
| Lengua Castellana | 11 | 44 | 4 | 12 |
| Ingles | 9 | 36 | 3 | 12 |
| Geografia | 10 | 40 | 3 | 12 |
| Historia y Ciudadania | 11 | 44 | 3 | 12 |
| Matematicas | 12 | 48 | 4 | 12 |
| Ciencias y Tecnologia | 12 | 48 | 4 | 12 |
| **Total** | **65** | **260** | **21** | **72** |

La cobertura teorica revisada es 21/65, aproximadamente un 32 %. Existen otras 36 preguntas genericas heredadas por ambito, pero los tests normales usan los 72 elementos de los seis bancos por materia.

## Lo que esta bien

- La separacion en materias resulta comprensible para estudiar, aunque el examen deba agruparse por ambitos.
- Los 65 temas ofrecen un primer mapa amplio de Lengua, Ingles, Sociales, Matematicas, Ciencias y Tecnologia.
- Cada tema tiene cuatro pasos visibles, guardado de apuntes y continuidad de progreso.
- Los tests muestran acierto en verde, fallo en rojo y conservan errores para repaso.
- La sesion diaria reduce la carga de decision a 15, 30 o 45 minutos.
- La app distingue que los tests de repaso no sustituyen el examen oficial.
- Los enlaces oficiales incluyen advertencias sobre Andalucia y sobre modelos de curriculos anteriores.

## Hallazgos criticos

### P0. Simulacros sin fidelidad suficiente

- El modo completo recomienda 75 minutos, pero en 2026 cada prueba de ambito dura dos horas.
- El modelo denominado `Estructura real` solo enumera los tres ambitos y no construye sus secciones ni puntuaciones.
- La correccion por IA pide nota sobre 10 por ambito y una nota global. La prueba oficial puntua cada ambito sobre 100, exige al menos 50 en cada uno y conserva los ambitos aprobados.
- No se aplican las ponderaciones oficiales: Comunicacion 60/40; Social 25/30/30/15; Cientifico-tecnologico 15/20/30/15/20.
- No se entrenan de forma controlada las extensiones oficiales: 200 palabras en castellano, 50-70 en ingles y 150 en Social y Cientifico-tecnologico.

Consecuencia: el alumno puede creer que ha practicado un examen real cuando solo ha recibido una plantilla orientativa.

### P0. Profundidad aparente

- `LESSON_TITLES` crea cuatro lecciones por tema, pero `subtopicsFor`, `lessonTheory` y `defaultLessonNotes` reutilizan texto generico.
- La teoria especifica de un tema se repite en sus cuatro lecciones; cambia principalmente el titulo y una frase de plantilla.
- 44 temas dependen de una nota breve de una sola frase como base principal.
- No hay ejemplos resueltos completos, actividades graduadas, criterios vinculados ni comprobacion de comprension propia de cada leccion.

Consecuencia: la interfaz transmite mucha mas profundidad de la que el contenido ofrece realmente.

### P0. Evaluacion no vinculada al tema

- `testCards` devuelve solo un test mixto por materia.
- `buildQuestionsForTest` toma diez preguntas aleatorias del banco general de la materia, aunque la arquitectura admita un identificador de tema.
- Con 72 preguntas para 65 temas no puede existir practica suficiente, repetible y especifica.
- Un test se registra como hecho con cualquier nota; el mensaje solo considera listo al alumno con 100 %, criterio demasiado extremo e incoherente con el guardado.

Consecuencia: el porcentaje de avance no permite saber que sabe realmente el alumno.

### P0. Falta el formato competencial de la prueba

El banco actual es casi exclusivamente tipo test. La prueba oficial exige tambien:

- Comprension y analisis de documentos escritos.
- Mapas, graficas, imagenes, diagramas y esquemas.
- Respuestas abiertas y relaciones entre conceptos.
- Redacciones en los tres ambitos.
- Problemas con calculo o razonamiento en Cientifico-tecnologico.
- Comentario de texto literario y produccion escrita funcional.

Consecuencia: aprobar tests de conceptos no prepara por si solo para obtener 50 puntos en un ambito.

## Hallazgos altos

### P1. Indice sin trazabilidad curricular

Los temas cubren areas razonables, pero no indican competencia especifica, criterio de evaluacion, saber basico, nivel o modulo de la Orden de 30 de abril de 2025. No se puede demostrar que el indice sea completo ni detectar con seguridad que sobra.

En Social aparecen Valores y Musica, pero Formacion y Orientacion Personal y Profesional solo se roza en trabajo y economia familiar. En Comunicacion, `Ingles funcional` aparece bajo una idea cercana a listening aunque la estructura escrita de la prueba de 2026 se centra en comprension, composicion guiada y uso de la lengua.

### P1. Progreso inflado

- Un tema puede marcarse manualmente como hecho desde la lista.
- Una leccion se completa con un clic, sin mini actividad obligatoria.
- El progreso por materia no distingue teoria vista, practica, escritura, test y simulacro.
- No existe preparacion por ambito ni indicador de disposicion para superar el minimo de 50/100.

### P1. Sesion diaria poco equilibrada

La recomendacion recorre materias en orden y elige la primera pendiente. Una sesion de 30 minutos anade el mismo test general de esa materia; una de 45 anade un examen rapido. No hay rotacion equilibrada entre los tres ambitos, recuperacion espaciada ni prioridad basada en errores.

### P1. Correccion IA sin contrato oficial suficiente

Los prompts piden claridad, pero no incluyen siempre la estructura de 2026, sus puntos, las extensiones o la penalizacion ortografica. La salida se presenta como texto plano, por lo que tablas o jerarquia compleja pueden perder legibilidad. Tampoco separa con claridad puntuacion objetiva, estimacion de IA y limitaciones del OCR.

### P1. Recursos poco especificos

Hay cinco enlaces base. Faltan en la app el curriculo andaluz de 2025, la resolucion de convocatoria y estructura de 2026 y la pagina oficial de estructura. La seleccion por tema se hace mediante etiquetas generales, por lo que muchos temas muestran los mismos enlaces y no un recurso concreto para esa leccion.

## Hallazgos medios

- La portada solo ofrece accesos rapidos a cuatro materias; Geografia e Historia quedan ocultas tras la biblioteca.
- La app usa `Tres partes` donde conviene decir `Tres pruebas de ambito`.
- Los modelos antiguos se enlazan con advertencia correcta, pero falta distinguir visualmente material vigente y material historico.
- Las preguntas guardadas como fallos conservan la respuesta correcta, pero no el error elegido, una explicacion ni el criterio que debe repasarse.
- No existe diagnostico inicial para adaptar la ruta a un adulto que ya tenga competencias o ambitos superados.
- No se contempla Frances; es una decision valida de alcance, pero debe declararse de forma visible.

## Matriz por ambito

| Ambito oficial | Cobertura nominal actual | Brecha principal |
|---|---|---|
| Comunicacion | Lengua e Ingles, 20 temas | Falta practica completa 60/40, textos fuente, literatura evaluable, 200 palabras, writing de 50-70 y bloque de diez preguntas de ingles |
| Social | Geografia e Historia/Ciudadania, 21 temas | Falta mapa curricular de FOPP y Musica; documentos, fuentes graficas y redaccion de actualidad de 150 palabras con rubrica |
| Cientifico-tecnologico | Matematicas y Ciencias/Tecnologia, 24 temas | Falta combinar documento, fuente visual, redaccion de 150 palabras y problema puntuado; ejercicios resueltos insuficientes |

## Prioridad de trabajo resultante

1. Construir en el paquete 03 un indice trazable: ambito, competencia, criterio, saber, tema y leccion.
2. Mantener las seis materias como puertas de estudio, agrupadas bajo los tres ambitos oficiales.
3. Reducir o rehacer las lecciones de plantilla: ninguna leccion debe existir sin contenido propio, actividad y evidencia de aprendizaje.
4. Crear tipos de actividad reutilizables antes de ampliar preguntas: concepto, documento, fuente grafica, redaccion, problema y uso de lengua.
5. Definir reglas objetivas de progreso por evidencia, no por clic.
6. Construir un simulacro maestro exacto por cada ambito antes de producir variantes.
7. Asociar cada fuente y recurso a temas concretos, con fecha de revision y estado vigente/historico.

## Criterio de salida del paquete 02

El paquete queda completado con inventario, brechas, prioridades y una medicion reproducible mediante:

```bash
node tests/audit-eso-content.cjs
```

No se ha alterado el contenido de la app. El siguiente paquete debe decidir el indice definitivo; no debe empezar a redactar unidades hasta aprobar esa estructura.

## Fuentes oficiales comprobadas

- Curriculo ESPA de Andalucia, Orden de 30 de abril de 2025: https://www.juntadeandalucia.es/boja/2025/86/1
- Regulacion de las pruebas, Orden de 21 de enero de 2026: https://www.juntadeandalucia.es/boja/2026/14/c01/2
- Convocatoria, estructura y puntuacion 2026: https://www.juntadeandalucia.es/boja/2026/19/38
- Estructura oficial resumida: https://www.juntadeandalucia.es/educacion/portales/web/educacion-permanente/servicios/pruebas/obtencion-titulo-eso/sobre-las-pruebas/estructura-de-pruebas
