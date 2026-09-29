# Profesor Particular: plan del generador de materiales

Estado: propuesta para trabajar por paquetes. No implementado. Fecha: 2026-09-28.

## Objetivo
Crear, revisar, personalizar, guardar y utilizar materiales para un alumno o para la biblioteca común. Trabajo independiente de ESO Adultos. No crear ahora un motor compartido entre apps.

## Punto de partida comprobado
- apps/profesor/index.html: alumnos, asignaturas, seguimiento, sesiones, biblioteca, tareas, contexto previo y adjuntos.
- Los materiales actuales contienen principalmente título, cuerpo, tipo, respuesta y adjunto. Mantener su lectura y descarga.
- backend/app/api/app_routes.py: subida y descarga autenticada de materiales; revisar aislamiento de propietario en las nuevas operaciones.
- Reutilizar la configuración de modelos y créditos de Profesor Particular, verificando su contrato antes de conectarla.
- Subir un archivo no equivale a extraer su contenido. La extracción será un paquete explícito.

## Alcance y supuestos propuestos
Primera versión usable: huecos, relacionar y quiz; creación por tema o texto pegado; contexto editable del alumno; generación real; edición; guardado; PDF del alumno y soluciones separadas. Versión interactiva en una segunda entrega. Asignar inicialmente significa vincular material al alumno o a una clase, no enviarle una notificación ni crearle una cuenta.
Pilotos propuestos, pendientes de elección: inglés de ESO (vocabulario), lengua (comprensión y gramática), matemáticas (fracciones). La infraestructura admitirá otras asignaturas, pero no se anunciará calidad validada en todas.
No incluir de inicio: cuentas de alumnos, enlaces públicos, OCR, generación de ilustraciones, corrección IA de respuestas abiertas, juegos complejos ni generación de unidades enteras.

## Experiencia de uso
Entradas desde Biblioteca > Crear material, ficha de alumno y Preparar clase. Un único editor con contexto precargado según la entrada.
Escritorio: configuración a la izquierda y vista previa a la derecha. Pasos Contexto, Actividad y Ajustes, con opciones avanzadas plegadas. Barra de acciones estable: generar, guardar, imprimir/PDF y abrir actividad cuando exista. En móvil: pestañas Configurar / Vista previa.
Mantener el marco y las acciones visibles en ordenador; paginar la ficha y usar desplazamiento dentro del editor para materiales largos. No encoger la letra ni ocultar contenido para imponer cero desplazamiento.
Contexto: alumno opcional, curso, asignatura, tema, objetivo, dificultad, idioma, duración aproximada y número de ejercicios. Prioridad: cambios expresos del profesor, objetivo actual y después datos disponibles del alumno. Mostrar qué contexto se utiliza; no inferir diagnósticos ni dificultades que no estén registradas.
Opciones posteriores: errores registrados, intereses, vocabulario de apoyo, pistas, tamaño de letra, banco de palabras, soluciones e impresión con ahorro de tinta.

## P0. Definición y diseño revisable
Entregables: flujo, boceto funcional del editor, tres ejemplos completos de actividades, estados vacío/cargando/error/guardado, matriz de alcance y decisiones pendientes.
Aceptación: generar un material se entiende sin explicación externa; los tipos fuera de alcance no aparentan estar disponibles; ejemplos y botones no se presentan como generación IA real.
Dependencias: ninguna. No requiere consumir IA ni desplegar.

## P1. Estructura de material y persistencia
Definir contrato versionado: id, propietario, alumno opcional, asignatura, nivel, objetivo, idioma, tipo, instrucciones, bloques/preguntas con ids estables, respuestas, pistas, explicación, fuentes y fechas. Registrar versión de plantilla/modelo sin guardar datos innecesarios.
Separar definición del material, soluciones y futuros intentos. Guardar estados borrador/revisado; mostrar que la generación pendiente de revisión no equivale a contenido validado.
Preferencia: endpoints y persistencia específicos para materiales generados, evitando ampliar indefinidamente el JSON global de la app. Elegir modelo y migración tras revisar el almacenamiento actual. Biblioteca unificada con adaptador para materiales antiguos.
Aceptación: crear/editar/recargar conserva datos; otro profesor no puede acceder; los materiales existentes siguen funcionando; detectar guardados de versiones antiguas sin sobrescribir silenciosamente.
Dependencia: P0.

## P2. Generación IA real de tres formatos
Huecos con respuestas y banco opcional; parejas inequívocas; quiz con respuesta y explicación. Entrada por tema o texto pegado. Plantillas por formato, salida estructurada y validación antes de mostrarla.
Comprobar números de preguntas, ids, soluciones, opciones duplicadas, referencias de huecos, consistencia de parejas y ambigüedades detectables. Validación estructural no garantiza exactitud pedagógica: mantener revisión humana.
Usar proveedor/modelo configurado para esta app. Mostrar coste en créditos cuando la política lo permita; definir consumo en fallos, reintentos e interrupciones. Identificador de solicitud para evitar cobros duplicados. Limitar número y longitud de ejercicios.
No mostrar claves en navegador. Texto y documentos son fuentes, no instrucciones para el sistema. Renderizar contenido como datos seguros, no HTML arbitrario de la IA.
Aceptación: generación autenticada, adaptación observable al contexto, fallos y saldo insuficiente comprensibles; doble clic no duplica petición/cobro; recuperación no duplica material.
Dependencia: P1.

## P3. Editor y revisión
Editar título, instrucciones, preguntas, opciones, respuestas, explicaciones y pistas. Añadir/eliminar/reordenar preguntas. Regenerar solo una pregunta conservando el resto. Deshacer cambios locales o recuperar versión guardada.
Invalidar revisión de preguntas alteradas cuando cambie su solución. Advertir de cambios pendientes al salir. No sobrescribir el material visible si una generación tardía pertenece a otro alumno/contexto.
Aceptación: preparar los tres ejemplos sin modificar código; cambios del profesor sobreviven a guardar/reabrir; regeneración parcial conserva preguntas ajenas y no deja soluciones antiguas.
Dependencia: P2. La maqueta del editor puede avanzar tras P1 con muestras claramente identificadas.

## P4. Biblioteca, clase y PDF — primera entrega usable
Integrar búsqueda por alumno, asignatura, formato y tema. Duplicar para otro alumno sin alterar el original. Vincular a clase/alumno con texto que no prometa entrega externa.
Exportar documento real descargable y versión de soluciones separada. Diseño A4, saltos de página cuidados, imágenes limitadas, tipografía legible y opción de ahorro de tinta. Elegir herramienta PDF tras comprobar soporte de tipografía y fórmulas; no llamar descarga PDF a un simple diálogo de impresión.
Aceptación: exportación de ejemplos cortos y largos, acentos/fórmulas probadas, preguntas sin cortes arbitrarios, soluciones coherentes, nombres de archivo útiles y biblioteca antigua intacta.
Dependencias: P3. Cierra la primera versión completa.

## P5. Modo interactivo para usar durante la clase
Resolver los tres formatos con selección y arrastre opcional, compatible con teclado y móvil. Pistas, reintento y explicación. Estados claros: pendiente, correcto e incorrecto. No penalizar automáticamente el uso de pistas sin definir criterio.
Guardar intentos separados del material, indicando alumno, versión, fecha, respuestas y ayudas usadas. Distinguir sesión de práctica y evaluación. No reutilizar una respuesta anterior tras cambiar de alumno.
Aceptación: resolver y reabrir conserva intento; cambiar material no altera históricos; soluciones no aparecen antes de comprobar. Uso bajo la sesión del profesor, sin afirmar que sea evaluación segura sin supervisión.
Dependencia: P4.

## P6. Materiales propios y adaptación con evidencias
Importar TXT, DOCX y PDF con texto usando adjuntos existentes y controles de tamaño. Vista previa de lo extraído para seleccionar páginas/fragmentos. Detectar PDF escaneado y explicar la limitación; OCR posterior.
Guardar referencias a fuentes usadas. Permitir generar solo desde fuente o complementar con conocimiento general, señalando la elección. Usar errores solo si existen intentos o anotaciones explícitas vinculadas al alumno; dejar desactivada la opción si faltan.
Aceptación: no inventar acceso a documentos no procesados; confirmar fuente antes de generar; probar documentos vacíos, grandes, malformados y escaneados; aislamiento entre profesores.
Dependencias: P4; para errores automáticos, P5. Puede adelantarse a P5 si documentos es prioritario.

## P7. Ampliación de catálogo
Ordenar pasos, clasificar, tarjetas de repaso, comprensión lectora y encuentra el error. Después: sopas de letras, crucigramas, etiquetar imágenes y fichas mixtas.
Sopas y crucigramas requieren construcción y validación deterministas de cuadrículas; la IA propone vocabulario/pistas, no se confía en una cuadrícula de texto generada libremente. Cada nuevo tipo debe incluir editor, solución, PDF y, cuando proceda, interacción.
Imágenes: empezar con diagramas y recursos adecuados al ejercicio; ilustración IA opcional posterior con coste, revisión y tiempo de generación visibles.
Aceptación: cada formato publicado completa todo el ciclo; no habilitar tarjetas que solo producen texto genérico.
Dependencias: P4 y P5 para variantes interactivas.

## P8. Trabajo autónomo — decisión posterior
Elegir enlaces privados revocables o cuentas de alumno. Definir caducidad, identificación, permisos, entrega, intentos y visibilidad de resultados/soluciones. Material público no debe exponer perfil ni otros datos del alumno.
Aceptación: un alumno solo accede a lo asignado, la revocación funciona y el profesor recibe resultados del intento correcto. No enviar mensajes a terceros automáticamente.
Dependencias: P5 y aprobación del modelo de acceso.

## Verificación transversal y publicación
Por paquete: entrega local revisable, resumen de comportamiento, pruebas relevantes, limitaciones y estado del plan. No desplegar paquetes incompletos como funciones operativas.
Pruebas esenciales: permisos, compatibilidad con biblioteca antigua, validación de respuestas, cobro idempotente, persistencia, edición parcial, PDF, teclado/móvil y fallos de red. En IA, evaluar manualmente una colección fija de casos por materia/nivel; no exigir texto idéntico entre generaciones.
Publicación de la primera versión tras P4 y prueba del recorrido completo. Reutilizar despliegue Hostinger, backup y migraciones; comprobar la distribución de nuevos archivos estáticos en Docker. Preservar los datos actuales y documentar reversión de cambios incompatibles.

## Orden y decisiones
Orden recomendado: P0 → P1 → P2 → P3 → P4 → P5 → P6 → P7. P8 opcional. No compromiso de fechas hasta cerrar P0.
Decisiones a confirmar en P0: asignaturas/niveles piloto; tres formatos iniciales; importancia de PDF frente a interacción; entrada por documentos; política de créditos y alcance de adaptación. Propuesta por defecto: huecos/parejas/quiz, PDF primero, tema/texto primero, interacción en clase después.

## Revisión acordada con el usuario — sustituye el alcance anterior
La propuesta adaptativa y el orden P0–P8 anteriores quedan como histórico. No implementar aprendizaje de fallos, pistas adaptativas ni recorridos autónomos.
Nuevo orden: (1) perfil y prototipo de pantallas; (2) generador/editor/biblioteca con actividades realizables por el profesor; (3) usuario y contraseña opcionales para alumnos; (4) clase individual sincronizada controlada por el profesor; (5) PDF y formatos adicionales.
Una ficha no es una cuenta. El profesor puede probar sin registrar resultados, o usar material con el alumno compartiendo pantalla sin cuenta de alumno. Las cuentas requieren permisos reales de backend; nunca simular autenticación con almacenamiento del navegador.
Personalización expresamente elegida: curso, contenido e intereses/ambientación. Una clase tiene un alumno.

### Entrega local del paquete 1
- Perfil editable: nombre, curso, intereses, objetivo y notas privadas. Reutiliza el guardado existente.
- Pestaña de acceso con estado explícito de función futura; no crea cuentas.
- Taller desde biblioteca general o biblioteca/perfil de alumno: contexto, cantidades y guardado de configuración.
- Tres ejemplos fijos resolubles, etiquetados como prototipo; no representan generación adaptada ni consumen IA.
- Pendiente de paquete 2: generación real, editor de preguntas, materiales estructurados y modo de uso con guardado de respuestas.
- Comprobación automatizada en tests/profesor-workshop-browser.cjs: perfil persistente, contexto, borrador, corrección de ejemplos, estado de acceso y móvil.

### Paquete 2 — entrega local
- El taller ya permite creación manual sin IA y generación mediante /api/chat de Profesor Particular para cuentas autenticadas.
- Tema, curso, asignatura, ambientación y cantidades explícitas; no se envían notas privadas ni historial del alumno al generador nuevo.
- Contrato de preguntas versionado y validación de tipos, límites, respuestas y opciones. Respuestas de parejas únicas y un hueco por ejercicio.
- Editor por pregunta, guardado en biblioteca existente y reapertura. Esta primera implementación conserva el almacenamiento de estado actual; no añade aún endpoints específicos.
- Probar no crea intentos. Usar en clase registra respuestas y copia de la versión del material, con alumno y fecha, bajo la sesión del profesor.
- No hay cuentas de alumno ni sincronización en directo todavía. No hay PDF ni imágenes.
- Pruebas: perfil/contexto; creación manual y persistencia; modo prueba versus clase; contrato IA con respuesta simulada; regresión del escritorio.
- Limitación de verificación: no se ha realizado una llamada a un proveedor IA con créditos reales. La prueba simulada no certifica exactitud pedagógica del modelo.

### Cambio de prioridad: generador visual primero
El usuario aplaza perfil de alumno, cuentas y directo. Se retiran las pestañas nuevas Perfil y Acceso; se conservan los datos existentes. Prioridad: generador según referencia visual, con pasos Contexto → Tipo de ejercicio → Revisar y guardar, tarjetas seleccionables, cantidades en opciones avanzadas y vista previa lateral. Solo se ofrecen formatos implementados (relacionar, completar, elegir respuesta). La vista de selección indica que muestra estructura; el editor muestra el contenido escrito/generado. Juegos y formatos extra pendientes, sin botones que simulen estar operativos.

### Paquete 1 de conexión IA — 2026-09-29
- Endpoint autenticado /api/profesor/generate, restringido a licencia de Profesor Particular.
- Contexto limitado a asignatura, curso, tema, ambientación, duración y cantidades. Prompt controlado en servidor; sin nombres, notas privadas ni historial.
- Configuración de proveedor/modelo por app reutilizada. Validación de contenido estructurado antes de descontar un crédito.
- Solicitudes identificadas por UUID; una repetición recupera el resultado ya confirmado sin otra llamada/cobro. Bloqueo por usuario compartido con contabilidad de créditos en PostgreSQL.
- Errores claros de configuración, red, tiempo de espera y respuesta inválida; no se cobran resultados inválidos. El coste externo del proveedor puede existir aunque el crédito de la app no se descuente.
- 7 pruebas backend, pruebas de navegador manual y contrato simulado. Prueba real con Groq/openai-gpt-oss-120b completada; verificado navegador autenticado → proveedor → edición → biblioteca → recarga, sobre cuenta local de prueba.
- Vista previa local con cuenta ficticia en /preview-profesor, solo en el script ignorado tools/generator-live-preview.py; no forma parte del despliegue.
- No publicado aún. La calidad de cada ejercicio sigue requiriendo revisión del profesor; validar estructura no garantiza exactitud pedagógica.

## Paquete 2 completado — 2026-09-29

Nueve formatos básicos disponibles en creación manual y con IA: relacionar, completar,
elegir respuesta, respuesta breve, ordenar, clasificar, verdadero/falso, comprensión
lectora y problemas. El editor permite ajustar enunciados, opciones, textos y soluciones.
Ordenar usa flechas accesibles. Las respuestas abiertas quedan pendientes de valoración
del profesor (correcta, parcial o necesita revisión), con solución orientativa.
Las sesiones conservan respuestas y una copia del material; se pueden reabrir y revisar.

Validación: 8 pruebas de servidor, pruebas de navegador de los seis formatos nuevos,
regresión de creación básica, contrato IA simulado y diseño responsive. Prueba real del
proveedor con los nueve tipos aceptada; otra respuesta inválida se rechazó sin crédito.
No se han publicado estos cambios en Hostinger. Los juegos del paquete 3 siguen pendientes.

## Paquete 3 — primer bloque interactivo, 2026-09-29

Disponibles Flashcards, Memory, Construye la frase, Línea temporal y Encuentra el error.
Se combinan con los nueve básicos, admiten creación manual/IA, edición y guardado.
Memory valida parejas inequívocas y funciona con clic o teclado; las tarjetas se giran;
frases y líneas temporales se ordenan con botones accesibles. Errores y tarjetas se
valoran por el profesor. Resolver no requiere llamadas IA. Se conservan las sesiones.

Verificado: 9 pruebas de servidor, recorrido completo en navegador de los cinco tipos,
regresiones de básicos/contrato IA/catálogo, móvil y captura del catálogo. Generación
real aceptada con los cinco tipos en la cuenta local de prueba. Vista previa limitada
para mantener visible Continuar al seleccionar muchas actividades.

Pendientes del paquete 3: sopa de letras, crucigrama y arrastrar/soltar. Pendientes del
paquete 4: señalar imagen, quiz visual, recursos gráficos y PDF. No publicado aún.

## Versión preparada para publicación — 2026-09-29

El usuario autoriza publicar ahora los 14 formatos operativos y continuar las mejoras
después. Comprobación final: nueve pruebas backend y recorridos de navegador de básicos,
seis formatos adicionales y cinco juegos. Docker incorpora la página y el servicio nuevo.
Despliegue mediante infra/deploy-hostinger.sh (backup, migraciones y comprobaciones).
La ejecución en Hostinger queda a cargo del usuario con el comando facilitado.

## Paquete 11 — nuevo inicio, 2026-09-29

Inicio renovado con cabecera horizontal y acceso directo a Inicio, Preparar clase y
Mis alumnos. Los alumnos ocupan el área principal en tarjetas amplias con curso,
asignaturas y próxima clase; se muestran hasta seis por página. La columna lateral
reúne las cinco próximas clases y cuatro tareas editables, con accesos al calendario,
alta de clase y gestión completa de tareas.

En escritorio de 1440 × 900 el contenido cabe en una pantalla sin desplazamiento ni
desbordamiento horizontal. En anchuras menores la distribución se apila y la navegación
pasa a la parte inferior. Se mantienen las rutas y acciones existentes del resto de la
aplicación. El cambio queda en vista previa local; su publicación se hará junto al
próximo despliegue autorizado.

## Tres áreas principales — primer bloque, 2026-09-29

- Cabecera común con Inicio, Material y Alumnos en toda la app, incluidos los espacios de alumno. Calendario, clases, cobros e IA siguen disponibles como acciones de contexto, sin ocupar navegación principal.
- Inicio conserva alumnos, agenda y tareas. Material reúne el creador, el alta de archivos, los recursos del profesor y la preparación de guiones con IA. Alumnos muestra una lista clara con búsqueda y acceso al espacio de cada uno.
- Material y Alumnos muestran hasta seis tarjetas por página. El material se puede buscar y filtrar por asignatura sin perder su relación con un alumno.
- Verificados los recorridos de alta, clase, actividad, entrega, revisión, cobro, persistencia, generador, navegación y móvil. Inicio y Material caben sin scroll a 1440 × 900 y 1366 × 768. Cambio local, pendiente de publicar.
