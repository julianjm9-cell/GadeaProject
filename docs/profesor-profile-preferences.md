# Perfil, apariencia y asignaturas del profesor

El botón del perfil abre una ventana adaptable a escritorio y móvil, con cuatro apartados:

- **Mi cuenta:** nombre visible, correo de la cuenta, tipo de cuenta y acceso a las condiciones y contactos de Premium.
- **Mis asignaturas:** selección múltiple, selección de todas, incorporación de una asignatura propia y contador. Hay que elegir al menos una y pulsar «Guardar preferencias».
- **Apariencia:** Fondo 1, Fondo 2 y estilo original sin fondo. Se puede probar el estilo antes de guardarlo; cerrar sin guardar restaura el anterior.
- **Seguridad y datos:** cambio de contraseña, historial, recuperación de borradores, privacidad y cierre de sesiones, con explicación de cada herramienta. Se utilizan las funciones y controles de seguridad existentes.

Las preferencias se guardan en `teacherProfile.subjects` y `teacherProfile.backgroundMode`, usando el guardado versionado existente. No se necesita una migración. Un conflicto con otra pestaña no sobrescribe una versión más reciente. Un fallo de conexión conserva la selección en la ventana para reintentar. Los límites y el tipo de cuenta siguen determinados por el servidor.

Una selección de asignaturas vacía o ausente en cuentas antiguas significa «mostrar todas», hasta que el profesor haga su primera selección. Después se filtran las tres bibliotecas (Privados, Públicos y De temario), sus búsquedas y filtros, las asignaturas del creador y de los materiales adjuntos, el temario escolar y de español, las sesiones de juegos y su selector de tarjetas, y las opciones de asignatura del alumno. Se aceptan asignaturas propias y diferencias de mayúsculas o acentos. Los archivos sin asignatura siguen accesibles.

Es un filtro de presentación, no una eliminación: se conservan los catálogos, materiales, asignaturas originales de los alumnos y datos guardados. Los pagos y las citas de la agenda no se eliminan ni recalculan al cambiar estas preferencias. Si un alumno no tiene asignaturas de la selección, su espacio muestra una explicación y el acceso a preferencias. Una biblioteca con materiales ocultos indica cuántos siguen guardados y cómo volver a mostrarlos. Los borradores de apoyo de otra asignatura se conservan, y se explica cómo volver a seleccionarla para retomarlos.

Las miniaturas de apariencia reutilizan los **fondos reales existentes**, optimizados en dos WebP de 480 × 360 (aproximadamente 55 KiB en conjunto), y una representación con HTML/CSS del estilo original. No se han inventado nuevos fondos que difieran de lo que activa cada opción. Los controles y textos son HTML accesible; el teclado permite cambiar entre apartados y elegir estilos y asignaturas.

Validación con cuentas ficticias locales: prueba y cancelación de los tres estilos; asignatura única, asignaturas propias y selección vacía; persistencia al recargar; filtro del temario y juegos públicos; conservación del material oculto; simulación de fallo de conexión y reintento; apertura del historial desde el nuevo perfil. También se comprueban la presentación móvil, los recursos distribuidos y las pruebas de regresión.

No se han desplegado cambios en Hostinger ni utilizado cuentas reales durante las pruebas.
