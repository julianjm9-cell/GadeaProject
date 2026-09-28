# Profesor Particular

Aplicación de la suite con estética azul clara inspirada en ESO Adultos. El inicio da protagonismo a los alumnos, con tarjetas visuales y búsqueda; debajo aparecen próximas clases, tareas personales y calendario. En móvil, la navegación pasa a una barra inferior.

## Acceso

Recorrido público: portada `/` → landing `/profesor` → login `/profesor/login` o registro `/profesor/register` → app `/profesor-particular`. La demo pública está en `/profesor/demo`.

En la suite: `/profesor-particular`, con login y licencia `PROFESOR_PARTICULAR`. Disponible en `/apps`, portada y administración; incluida en la imagen Docker. El estado se almacena mediante `/api/state?app=profesor_particular`, aislado por cuenta, organización y producto como las demás apps.

Para revisar sin backend, abrir `apps/profesor/index.html` o servirlo con `?demo=1`. La demo usa alumnos ficticios y almacenamiento local con una clave independiente; no llama a la IA ni contiene información de cuentas reales.

## Primera versión implementada

- Inicio con alumnos destacados, próximas clases preparables, calendario semanal y accesos a la IA, biblioteca y cobros.
- Tareas personales: crear, editar, ordenar, completar y reabrir; alumno, fecha y prioridad opcionales.
- Resumen por alumno y asignatura: último trabajo, aspectos a reforzar y próximo paso. Preparación contextual con notas de la última clase y actividades pendientes.
- Archivos PDF, DOCX, imágenes y TXT de hasta 8 MB, privados por alumno o reutilizables desde la biblioteca. Descarga autenticada y almacenamiento persistente en Docker; en demo, IndexedDB local.
- Cobros manuales: tarifas por alumno, importe por clase, registro y reversión de cobros, bonos pagados y consumo de sesiones. Sin pasarela de pago.
- Buscador global con destinos reales para alumnos, clases y recursos; historial de navegación y enlaces internos.
- Vista global de clases con filtros, búsqueda de biblioteca, cuenta del profesor y cierre de sesión.
- Registro con email/contraseña y Google cuando está configurado; cuentas existentes conservadas.
- Dashboard de administración con profesores, accesos, límites y créditos por producto.
- Alta y búsqueda de alumnos, varias asignaturas, notas privadas y navegación fija: Inicio, Progreso, Clases, Actividades y Biblioteca.
- Checklists manuales independientes por alumno y asignatura: pendiente, en progreso, dominado y reforzar.
- Biblioteca inicial de Matemáticas, Lengua e Inglés, creación de materiales y asignaciones por referencia sin duplicar el contenido.
- Agenda semanal, sesiones puntuales o repetición durante cuatro u ocho semanas, reprogramación y cancelación.
- Preparación por bloques editables y reordenables, modo clase, notas, cierre y próximo foco.
- Actividades de respuesta escrita y tres plantillas sencillas (quiz, completar, encontrar el error), con respuesta exacta opcional y revisión posterior por el profesor.
- IA conectada al proveedor de la suite: utiliza curso, objetivos, progreso, notas, resúmenes y resultados. Muestra propuestas editables; solo se guardan tras validación. No modifica el progreso.
- Guardado remoto secuencial y aviso con reintento cuando falla. La demo conserva los cambios en ese navegador.

## Límites de esta entrega

La miniapp del alumno es un espacio dentro de la cuenta del profesor, no un portal con credenciales propias. Las entregas se registran durante una sesión supervisada. El acceso independiente de alumnos, audio, currículo completo por curso, calendario mensual, juegos avanzados, cobro online e integraciones externas quedan para siguientes fases. Los currículos iniciales son ejemplos de objetivos editables en estado, no un catálogo oficial completo. La generación de clase con IA devuelve un bloque de texto editable; el profesor puede dividirlo manualmente en bloques adicionales.

La demo no simula respuestas de IA. En una cuenta real hace falta configurar un proveedor y disponer de créditos. No se ha realizado una llamada de pago como parte de la validación.

## Validación

`node tests/profesor-browser.cjs` recorre alta, progreso aislado, preparación, modo clase, cierre, asignación, entrega, revisión y persistencia. También verifica contexto IA con proveedor simulado, aprobación explícita, reintento de guardado, errores de JavaScript y ancho móvil, y genera capturas en `tools/` para revisión visual.

Las pruebas de integración de producto se encuentran en `backend/tests/test_access_control.py` y usan base de datos SQLite en memoria.

`node tests/profesor-workspace-browser.cjs` verifica tareas, resúmenes, preparación contextual, archivos, tarifas, cobros, bonos, persistencia y adaptación móvil. Las 71 pruebas de acceso y registro incluyen aislamiento de archivos entre profesores y validación de subidas. Docker y el despliegue en Hostinger requieren validación en el servidor; no se han ejecutado en esta revisión.

## Configuración de registro

`PROFESOR_SIGNUP_ENABLED` (por defecto `true`), `PROFESOR_SIGNUP_DAYS` (365) y `PROFESOR_SIGNUP_CREDITS` (100) controlan el acceso inicial. La landing y el login muestran los valores del servidor. El acceso se otorga una sola vez; no renueva licencias suspendidas/caducadas ni repone créditos. La administración permite modificar el acceso de cada cuenta.

`node tests/profesor-routes-browser.cjs` verifica el recorrido público, registro real en el backend local, perfil, logout/login, búsqueda, rutas internas y navegación móvil. Requiere un backend de pruebas independiente en `http://127.0.0.1:8891`, configurable con `PROFESOR_TEST_URL`; crea cuentas de prueba y genera la captura de la landing a partir de la demo.

## Landings y acceso visual

ESO Adultos y Profesor Particular comparten una composición de landing con mockups de ordenador y móvil. Los accesos separados son `/e25/login`, `/e25/register`, `/profesor/login` y `/profesor/register`. Los enlaces antiguos con `?mode=register` y los redirects `/login?next=...` siguen funcionando. Las condiciones gratuitas se consultan en la pregunta «¿Es gratis?» y en el desplegable del registro.

`node tests/product-access-browser.cjs` comprueba el orden de la portada, las apps en desarrollo, registro y login reales de ambas apps, errores, compatibilidad de rutas y cierre del registro. Usa `PRODUCT_TEST_URL` para seleccionar un backend de pruebas; crea cuentas de prueba.
