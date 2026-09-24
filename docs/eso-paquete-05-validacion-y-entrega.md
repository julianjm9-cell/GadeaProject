# ESO Adultos — Paquete 05: assets, validación y entrega

Fecha: 24/09/2026. Estado: implementado en modo de revisión `?ui=next`. La interfaz completa anterior vuelve a ser la predeterminada hasta que la renovación alcance paridad funcional.

## Resultado

La renovación queda integrada en la aplicación real como modo de revisión. Reutiliza los contenidos, el estado académico, la cuenta, el Profesor IA y los simulacros existentes, pero la URL normal conserva la interfaz completa anterior. `?ui=next` permite seguir revisando la renovación sin afectar al servicio publicado.

## Assets del escritorio

La escena y los objetos provisionales creados con bloques CSS se han sustituido por SVG ligeros:

- `apps/e25/assets/desk/room.svg`: habitación base con pared, ventana, iluminación y suelo.
- `apps/e25/assets/desk/items.svg`: catálogo vectorial común con mesas, sillas, lámparas, plantas, estantería, pósteres, taza y trofeo.

Todos los objetos comparten perspectiva, sombra, iluminación y área de dibujo. El frontend sigue usando el campo `visual` del catálogo, por lo que comprar y equipar conserva el mismo contrato de datos.

### Añadir o modificar un objeto

1. Añadir un `<symbol>` con `viewBox="0 0 200 160"` a `items.svg`.
2. Añadir su definición a `DESK_CATALOG` en `backend/app/services/gamification.py` con un `id` inmutable, categoría, precio, nivel mínimo y el nombre del símbolo en `visual`.
3. Si se introduce una categoría nueva, añadir su posición en las reglas `.desk-object[data-category="..."]` de `apps/e25/index.html` y su etiqueta en `renderNextProgress()`.
4. Comprobar los estados bloqueado, disponible, adquirido y equipado en escritorio y móvil.

Los precios y niveles los valida siempre el servidor. Cambiar solo el HTML no altera el saldo ni permite adquirir objetos bloqueados.

## Accesibilidad y resistencia

- Controles táctiles de al menos 44 px y foco de teclado visible.
- Navegación con `aria-current`; pestañas y filtros comunican selección.
- La duración de sesión usa `aria-pressed`.
- La escena tiene una descripción con los objetos equipados.
- Compatibilidad con `prefers-reduced-motion` y colores forzados.
- Estado de error comprensible y acción de reintento si no carga el escritorio.
- Prevención de doble compra mientras hay una petición en curso.
- Sincronización del inventario entre pestañas mediante `BroadcastChannel`; el servidor sigue siendo la fuente de verdad.
- El fallo de gamificación no elimina ni modifica el progreso académico.

## Validación registrada

`tests/check-eso-package-05.cjs` verifica:

- fallo inicial del servicio y recuperación mediante reintento;
- carga del fondo y de los objetos SVG equipados;
- estados accesibles de navegación y duración;
- una única petición ante una doble acción;
- actualización del inventario en una segunda pestaña;
- ancho móvil de 390 px sin desbordamiento del documento;
- ausencia de errores JavaScript.

También se repite la regresión de sesión diaria, asignaturas, biblioteca, Profesor IA, simulacros, compra, equipamiento y persistencia.

## Preparación del despliegue

Antes de activar la renovación en un entorno compartido:

1. Crear una copia de seguridad de PostgreSQL.
2. Aplicar las migraciones con `docker compose exec backend alembic upgrade head`.
3. Ejecutar las pruebas Python dentro del contenedor backend y las pruebas Playwright.
4. Revisar con una cuenta nueva y otra que ya tenga progreso.
5. Validar manualmente Inicio, una lección, un test, un simulacro, una compra y una recarga.
6. Mantener `?ui=classic` como escape durante la primera publicación y retirarlo solo después de validar el entorno real.

## Reversión

Si aparece un problema visual, volver a la interfaz anterior no exige tocar datos: se mantiene desactivado el modo nuevo o se retira su activación predeterminada. Las tablas de gamificación son independientes de `/api/state`, por lo que pueden permanecer sin afectar al estudio. Solo se debe bajar una migración después de hacer copia de seguridad y comprobar que no hay perfiles de gamificación que deban conservarse.

## Límites conocidos

- Las migraciones no se han aplicado a una base de datos de producción desde este entorno.
- Las pruebas Python requieren el contenedor backend o un entorno con `pytest` y SQLAlchemy; no están instalados en el runtime local disponible.
- La validación con personas adultas reales debe realizarse antes de activar el diseño por defecto.
- Calendario completo y notificaciones programadas siguen siendo ampliaciones funcionales posteriores.
