# ESO Adultos — Paquete 04: experiencia de estudio

Fecha: 24/09/2026. Estado: implementado en el modo de integración `?ui=next`.

## Alcance realizado

El nuevo sistema visual se extiende a las pantallas existentes de Asignaturas, catálogo de temas, lecciones, tests, simulacros y Perfil. No se han copiado contenidos ni creado rutas alternativas: las pantallas renovadas usan los 65 temas, 260 lecciones, preguntas, evidencias, apuntes, profesor IA, recursos e historial existentes.

Los cambios se aplican mediante reglas acotadas a `.next-ui`; abrir la app sin `?ui=next` conserva la presentación anterior.

## Asignaturas y lecciones

- Tarjetas y ámbitos con la jerarquía visual azul del escritorio.
- Acción de continuar y progreso de lecciones existentes.
- Lección con anchura de lectura, bloques, evidencias y controles más legibles.
- Apuntes, generación con IA y recursos conservados.
- Tests por tema y mixtos con estados de foco, acierto, error y explicación.

## Simulacros y Perfil

Simulacros deja de ocupar una pestaña global en el modo nuevo y aparece dentro de Asignaturas, junto con Recursos y Apuntes guardados. El generador, los tres ámbitos oficiales, corrección mediante IA e historial continúan utilizando sus funciones actuales.

Perfil conserva nombre, licencia, consumo, Drive y cierre de sesión, con la misma lógica y una superficie visual coherente con el nuevo sistema.

## Sesión diaria medible

Cada sesión guarda:

- identificador;
- fecha y duración elegida;
- pasos concretos creados al comenzar;
- pasos completados;
- fecha de finalización.

Una sesión de 15 minutos exige finalizar la lección propuesta. Una sesión de 30 minutos añade el test. Una de 45 minutos añade también el paso de examen. Abrir un contenido no completa el paso.

Cuando todos los pasos están completos se emite `DAILY_SESSION_COMPLETED`. La clave de recompensa utiliza la fecha, por lo que repetir otra sesión el mismo día no concede de nuevo XP o monedas. Una sesión incompleta del mismo día y duración se reanuda.

## Verificación

- Sesión de 15 minutos con un paso real.
- Finalización solo después de guardar la evidencia y completar la lección.
- Una única emisión de recompensa diaria.
- Acceso a Simulacros desde Asignaturas.
- Catálogo real de materias y Perfil disponibles.
- Sin desbordamiento horizontal a 390 px.
- Regresiones de biblioteca, tests, profesor IA y simulacros existentes.

El siguiente paquete debe sustituir las formas CSS provisionales por assets definitivos, realizar la revisión visual completa y decidir cuándo `next` se convierte en la interfaz predeterminada.
