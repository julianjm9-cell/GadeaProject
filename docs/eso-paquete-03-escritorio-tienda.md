# ESO Adultos — Paquete 03: Inicio, escritorio, tienda y personalización

Fecha: 24/09/2026. Estado: implementado en modo de integración `?ui=next`.

## Qué está disponible

La aplicación real incorpora una nueva Inicio y una nueva sección Progreso que consumen el estado académico y el perfil de gamificación reales. Durante la validación se activan añadiendo `?ui=next` a la URL de ESO Adultos. La interfaz anterior continúa siendo la predeterminada.

Inicio muestra:

- siguiente contenido y duración elegida;
- porcentaje real de temas marcados como completados;
- nivel del escritorio y ritmo de los últimos siete días;
- escena construida con los objetos equipados;
- acceso a Progreso y a la sesión de estudio existente.

Progreso incluye:

- Mi escritorio, Logros y Estadísticas;
- XP, nivel, monedas, temario y ritmo separados;
- tienda con objetos disponibles y bloqueados;
- inventario y personalización;
- previsualización y actualización del escritorio tras equipar.

## Catálogo inicial

El catálogo tiene 14 objetos en ocho categorías: mesa, silla, lámpara, planta, estantería, póster, taza y trofeo. Cuatro objetos básicos se entregan y equipan automáticamente. Los demás combinan precio, nivel mínimo y, en el trofeo, condición de logro.

Los elementos visuales actuales se dibujan con CSS y funcionan como assets provisionales. Cada registro contiene un identificador `visual`; sustituirlo posteriormente por WebP o PNG no requiere cambiar compra, inventario o equipamiento.

## Persistencia y transacciones

- `gamification_owned_items` mantiene una propiedad única por perfil y objeto.
- `gamification_equipped_items` mantiene un único objeto equipado por categoría.
- La compra bloquea el perfil durante la operación, vuelve a comprobar nivel y saldo, descuenta monedas y crea la propiedad en una transacción.
- El equipamiento comprueba la propiedad en el servidor.
- Las restricciones únicas protegen frente a compras duplicadas y equipos incompatibles.

## Navegación en modo nuevo

La navegación global queda en Inicio, Asignaturas y Progreso; Perfil continúa en el botón de cuenta. Simulacros y recursos siguen disponibles dentro de Asignaturas y de los flujos actuales. En móvil, los tres destinos aparecen en una barra inferior fija.

## Activación para revisión

Tras aplicar las migraciones 0004 y 0005, abrir:

```text
/eso-adultos?ui=next
```

La URL normal `/eso-adultos` sigue mostrando la versión estable. Cuando el nuevo recorrido se valide con datos reales, `next` podrá convertirse en el modo predeterminado sin eliminar inmediatamente el respaldo.

## Verificación realizada

- Compra con descuento exacto del saldo.
- Paso del objeto al inventario.
- Equipamiento únicamente después de adquirirlo.
- Actualización de la escena de Inicio.
- Persistencia visual después de recargar.
- Objeto bloqueado por nivel y controles de saldo/duplicado en el backend.
- Inicio responsive sin desbordamiento a 390 px.
- Navegación móvil inferior.
- Regresión de la interfaz actual y de los contenidos.

Las pruebas Python de servicio y API están preparadas para el entorno backend. El runtime local no contiene las dependencias de backend y Docker no está iniciado; las comprobaciones de navegador se han ejecutado correctamente.
