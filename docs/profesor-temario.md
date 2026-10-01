# Temario de Profesor Particular

La sección `#temario` es una biblioteca curricular de consulta para el profesor. Está separada de **Material**, que guarda las fichas y actividades creadas por cada cuenta. La navegación sigue curso → asignatura → tema, como la biblioteca de ESO Adultos, pero el contenido está redactado para Primaria, ESO y Bachillerato.

La base inicial contiene **279 temas** distribuidos entre los doce cursos. Cada ficha tiene cinco partes obligatorias: título, explicación de la idea, ejemplo resuelto, pregunta de práctica y solución orientativa. El catálogo vive en `apps/profesor/profesor-temario.js`; sus identificadores son estables y no se guardan en el estado de la cuenta.

Los estados se calculan a partir de datos reales: **Con material** cuando hay una ficha de la asignatura y curso con un título coincidente, y **Trabajado en clase** cuando existe una clase finalizada del alumno del mismo curso y asignatura. El resto figura como **Por preparar**. Las tres primeras entradas de recursos son el contenido incorporado; después aparecen los materiales propios que coincidan con el tema.

**Crear actividad** abre el editor existente con curso, asignatura y tema rellenados. **Planificar con alumno** crea una tarea del profesor vinculada a un alumno de ese curso y asignatura; no simula un envío a una cuenta de alumno. La explicación se puede leer sin IA ni créditos.

Esta es una base editorial, no una transcripción exhaustiva ni una garantía de alineación con el currículo oficial de una comunidad autónoma. En una futura revisión conviene contrastar la secuencia de cada curso con el currículo elegido, ampliar los temas que hoy agrupan varios conceptos y añadir más ejemplos y prácticas graduadas. El diseño y la estructura permiten hacerlo sin rehacer la navegación.
