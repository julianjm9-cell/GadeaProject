# Profesor de apoyo

Desde Temario, una cuenta Premium puede abrir el panel lateral y crear un tema nuevo, mejorar el seleccionado o añadir ejercicios. Curso, asignatura y tema quedan fijados para esa propuesta; cambiar los filtros no altera un borrador en curso.

La petición genera contenido estructurado, no HTML del modelo. El editor muestra el original de solo lectura a la izquierda y la propuesta editable a la derecha. El formato se aplica mediante una barra flotante al seleccionar texto (negrita, cursiva, subrayado, cuatro colores y quitar formato). Cada concepto, paso o ejemplo se edita directamente y dispone de controles para añadir o eliminar elementos. También permite insertar fórmulas y modificar ejercicios y soluciones. En móvil las columnas se apilan.

Actualizar mi versión conserva el catálogo común. Guardar como tema nuevo crea otra entrada personal. Los temas propios aparecen en los filtros habituales, permiten usar los ejercicios preparados, crear otro material y exportar esquema, ejemplos o ejercicios a PDF. Restaurar original elimina la personalización de un tema base.

## Persistencia y permisos

`personalTopics` y `supportWorkspace` viven en el estado privado de cada cuenta. El borrador se guarda automáticamente con debounce. El catálogo estático no se modifica. La API de PDF busca primero en los temas del usuario autenticado y después en el catálogo.

`POST /api/profesor/support?app=profesor_particular` exige una licencia de Profesor Particular Premium. Utiliza el proveedor/modelo ya configurado en Administración → IA. Se descuenta un crédito únicamente después de validar el resultado. Un `request_id` identifica los reintentos y evita el segundo cargo; reutilizarlo con otro contexto devuelve 409. Las peticiones fallidas y los borradores incompletos no descuentan créditos. La edición y el guardado no llaman a la IA.

El servidor también impide modificar `personalTopics` mediante `/api/state` en cuentas normales. El PDF conserva los permisos de esquema gratuito y recursos completos Premium.

## Validación

`backend/tests/test_teacher_support.py`: permisos, validación de entrada/salida, cobro único, temas personales, PDF, formato y entrega del script. Las respuestas del proveedor se simulan en pruebas, sin consumir créditos reales.

`tests/profesor-support-browser.cjs`: creación y actualización, recuperación del borrador, comparación, editor, fórmulas, recursos, número de tema, tamaño móvil y botones de guardado visibles.

El contenedor incluye el nuevo script; no requiere migraciones ni nuevas variables de entorno.

## Presupuesto de generación

Se solicita un tema completo y conciso (700-900 palabras), con un máximo de 3.000 tokens. Groq GPT-OSS usa razonamiento bajo. Se excluyen campos derivados duplicados; no se recortan las ediciones. Si el contexto supera 12.000 caracteres, se pide reducir el borrador. La reparación regenera desde el contexto original sin reenviar la respuesta defectuosa.

Ante un 429 se respeta Retry-After con un solo reintento de hasta 30 segundos. Esperas mayores o errores persistentes devuelven un mensaje específico sin cargo. Estos ajustes no aumentan la cuota compartida del proveedor.
