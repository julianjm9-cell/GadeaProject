# Trabajar en Educame

Lee la sección pertinente de la [guía de desarrollo](docs/guia-desarrollo-educame.md) antes de decidir cómo cambiar un producto. La guía recoge preferencias del propietario y ejemplos de aceptación. La petición actual define el alcance y el código vigente confirma el comportamiento.

## Dónde trabajar

| Área | Ubicación |
| --- | --- |
| Profesor Particular, ESO Adultos, Inglés | `apps/profesor/`, `apps/e25/`, `apps/cambridge/` |
| Diplomator, Universidad +25, Facturas OCR | `apps/diplomator/`, `apps/u25/`, `apps/ocr/` |
| Landings y dashboard online | `marketing/app_landings_demo/`, `admin/` |
| Cuentas, licencias, persistencia y API | `backend/app/` |
| Centro de mando local y agentes | `scripts/educame-dashboard.mjs`, `scripts/educame-dashboard/`, `scripts/educame-agents.mjs` |
| Pruebas y despliegue | `tests/`, `backend/tests/`, `.github/workflows/quality.yml`, `infra/deploy-hostinger.sh` |

## Cómo trabajar

- Comprueba el estado de Git y conserva cambios ajenos al encargo. Parte de las rutas, componentes y datos que usan las personas. Si colaboran varios agentes, delimita los archivos de cada tarea y reúne las propuestas antes de integrar.
- Simplifica alrededor de la acción principal. Conserva controles útiles y compatibilidad con el contenido guardado. Separa una mejora visual de los cambios en reglas, permisos, progreso y licencias.
- Comprueba el flujo completo afectado. En interfaz, usa escritorio y móvil, con Chromium y WebKit cuando el cambio afecte al navegador. En juegos, comprueba entradas, aciertos, errores, final y recuperación con datos ficticios. Para persistencia, prueba recarga y el fallo que podría pisar un cambio más reciente.
- Usa `npm.cmd test` en Windows para las pruebas unitarias y ejecuta las pruebas de navegador o backend relacionadas. Al entregar, indica qué verificaste y si se probó con datos ficticios, una API real o el entorno publicado.
- Para cambios que requieran despliegue, consulta el [procedimiento de Hostinger](infra/HOSTINGER_UPDATE.md). La preparación de un cambio y su publicación son pasos distintos. Conserva las cuentas, los volúmenes y las copias durante el proceso.
- Registra en la guía una decisión que vaya a repetirse cuando el propietario la confirme. Incluye el motivo, el alcance y una forma de comprobarla. Si corrige una preferencia anterior, actualiza la regla existente.

La [guía de agentes](docs/agentes-educame.md) explica la cola, la recuperación de lotes y la subida de entregas a GitHub. El dashboard online administra los productos. El Centro de mando local prepara encargos, implementa en copias Git aisladas y registra revisiones.
