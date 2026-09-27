# Profesor Particular

Aplicación de la suite renovada a partir de la referencia visual aportada: menú lateral, barra de búsqueda, paleta azul clara, tarjetas compactas y un inicio organizado en clases de hoy, pendientes, semana y alumnos. En móvil, la navegación pasa a una barra inferior.

## Acceso

Recorrido público: portada `/` → landing `/profesor` → login/registro `/profesor/login` → app `/profesor-particular`. La demo pública está en `/profesor/demo`.

En la suite: `/profesor-particular`, con login y licencia `PROFESOR_PARTICULAR`. Disponible en `/apps`, portada y administración; incluida en la imagen Docker. El estado se almacena mediante `/api/state?app=profesor_particular`, aislado por cuenta, organización y producto como las demás apps.

Para revisar sin backend, abrir `apps/profesor/index.html` o servirlo con `?demo=1`. La demo usa alumnos ficticios y almacenamiento local con una clave independiente; no llama a la IA ni contiene información de cuentas reales.

## Primera versión implementada

- Inicio con clases de hoy, pendientes accionables, calendario semanal, alumnos y accesos a la IA.
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

Es una primera versión operativa para el profesor. La miniapp del alumno es un espacio dentro de su cuenta, no un portal con credenciales propias. Las entregas se registran durante una sesión supervisada. El acceso independiente de alumnos, fotos/archivos/audio, currículo completo por curso, calendario mensual, juegos avanzados, pagos e integraciones externas quedan para siguientes fases del documento. Los currículos iniciales son ejemplos de objetivos editables en estado, no un catálogo oficial completo. La generación de clase con IA devuelve un bloque de texto editable; el profesor puede dividirlo manualmente en bloques adicionales.

La demo no simula respuestas de IA. En una cuenta real hace falta configurar un proveedor y disponer de créditos. No se ha realizado una llamada de pago como parte de la validación.

## Validación

`node tests/profesor-browser.cjs` recorre alta, progreso aislado, preparación, modo clase, cierre, asignación, entrega, revisión y persistencia. También verifica contexto IA con proveedor simulado, aprobación explícita, reintento de guardado, errores de JavaScript y ancho móvil, y genera capturas en `tools/` para revisión visual.

Las pruebas de integración de producto se encuentran en `backend/tests/test_access_control.py` y usan base de datos SQLite en memoria.

Validación de esta entrega: recorrido de navegador correcto en escritorio y móvil; 68 pruebas de acceso y registro; cuatro pruebas existentes de inicio de ESO Adultos correctas. La imagen Docker incluye el archivo nuevo, pero no se ha construido en esta sesión porque el motor Docker no estaba disponible.

## Configuración de registro

`PROFESOR_SIGNUP_ENABLED` (por defecto `true`), `PROFESOR_SIGNUP_DAYS` (365) y `PROFESOR_SIGNUP_CREDITS` (100) controlan el acceso inicial. La landing y el login muestran los valores del servidor. El acceso se otorga una sola vez; no renueva licencias suspendidas/caducadas ni repone créditos. La administración permite modificar el acceso de cada cuenta.

`node tests/profesor-routes-browser.cjs` verifica el recorrido público, registro real en el backend local, perfil, logout/login, búsqueda, rutas internas y navegación móvil. Requiere un backend de pruebas independiente en `http://127.0.0.1:8891`, configurable con `PROFESOR_TEST_URL`; crea cuentas de prueba y genera la captura de la landing a partir de la demo.
