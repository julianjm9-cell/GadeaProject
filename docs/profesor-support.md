# Profesor de apoyo

Desde Temario, una cuenta Premium puede abrir el panel lateral y crear un tema nuevo, mejorar el seleccionado o añadir ejercicios. Curso, asignatura y tema quedan fijados para esa propuesta; cambiar los filtros no altera un borrador en curso.

La petición genera contenido estructurado, no HTML del modelo. El editor permite revisar el original y la propuesta, editar los apartados, aplicar negrita, cursiva, subrayado, encabezados, listas y cuatro colores, probar fórmulas y modificar ejercicios y soluciones. Los elementos de una lista se separan con una línea en blanco. La vista previa utiliza la presentación matemática del temario.

Actualizar mi versión conserva el catálogo común. Guardar como tema nuevo crea otra entrada personal. Los temas propios aparecen en los filtros habituales, permiten usar los ejercicios preparados, crear otro material y exportar esquema, ejemplos o ejercicios a PDF. Restaurar original elimina la personalización de un tema base.

## Persistencia y permisos

`personalTopics` y `supportWorkspace` viven en el estado privado de cada cuenta. El borrador se guarda automáticamente con debounce. El catálogo estático no se modifica. La API de PDF busca primero en los temas del usuario autenticado y después en el catálogo.

`POST /api/profesor/support?app=profesor_particular` exige una licencia de Profesor Particular Premium. Utiliza el proveedor/modelo ya configurado en Administración → IA. Se descuenta un crédito únicamente después de validar el resultado. Un `request_id` identifica los reintentos y evita el segundo cargo; reutilizarlo con otro contexto devuelve 409. Las peticiones fallidas y los borradores incompletos no descuentan créditos. La edición y el guardado no llaman a la IA.

El servidor también impide modificar `personalTopics` mediante `/api/state` en cuentas normales. El PDF conserva los permisos de esquema gratuito y recursos completos Premium.

## Validación

`backend/tests/test_teacher_support.py`: permisos, validación de entrada/salida, cobro único, temas personales, PDF, formato y entrega del script. Las respuestas del proveedor se simulan en pruebas, sin consumir créditos reales.

`tests/profesor-support-browser.cjs`: creación y actualización, recuperación del borrador, comparación, editor, fórmulas, recursos, número de tema, tamaño móvil y botones de guardado visibles.

El contenedor incluye el nuevo script; no requiere migraciones ni nuevas variables de entorno.
