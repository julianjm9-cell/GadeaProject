# ESO Adultos — Paquete 02: motor de progreso

Fecha: 24/09/2026. Estado: implementado en la aplicación real; pendiente de aplicar la migración en el entorno desplegado.

## Arquitectura añadida

El progreso del escritorio se guarda fuera de `client_states`. Esto impide que un guardado general de apuntes o navegación pueda sobrescribir XP, monedas o el libro de recompensas.

- `gamification_profiles`: saldo de XP y monedas por organización, usuario y aplicación.
- `gamification_reward_events`: libro inmutable de recompensas, con clave única por perfil y actividad.
- `gamification_achievements`: logros concedidos una sola vez.
- `services/gamification.py`: niveles, recompensas, logros y reglas de cálculo centralizadas.
- `GET /api/gamification`: perfil y configuración pública.
- `POST /api/gamification/rewards`: procesa un evento permitido y devuelve el perfil actualizado.

El nivel se deriva de XP; no se almacena por duplicado. Las monedas del escritorio no comparten tabla ni nombre con los créditos de IA de la suite.

## Eventos conectados

- Lección completada, solo la primera vez.
- Tema completado al terminar sus cuatro lecciones.
- Asignatura completada cuando todos sus temas están completos.
- Test aprobado por primera vez con al menos 70 %.
- Simulacro oficial corregido mediante el flujo existente.
- Ritmo semanal alcanzado al registrar actividad en cuatro días distintos de la semana ISO.

`EXERCISE_SET_COMPLETED` y `DAILY_SESSION_COMPLETED` están configurados, pero no se emiten todavía: la app actual no conserva una serie de ejercicios ni una sesión finalizada con identidad propia. Premiar la apertura o la selección de duración generaría progreso falso. Se conectarán cuando esos flujos tengan finalización verificable.

## Idempotencia y compatibilidad

La clave única combina tipo de evento y origen, por ejemplo `LESSON_COMPLETED:mat-fracciones:lesson:2`. La base de datos impide dos filas iguales incluso ante dos peticiones simultáneas. La interfaz también evita emitir eventos al reabrir lecciones o tests ya aprobados.

Los datos académicos actuales no se migran ni se borran. Los perfiles empiezan en nivel 1 con saldo cero. No se conceden recompensas históricas automáticamente; una actividad que ya estaba completada no se vuelve a premiar al abrirla.

## Despliegue

Antes de activar el motor en un entorno existente debe ejecutarse:

```powershell
docker compose exec backend alembic upgrade head
```

El despliegue de esta migración no se ha realizado desde este trabajo local.

## Verificación

- Compilación sintáctica de modelos, servicio, rutas y migración.
- Revisión final existente de ESO Adultos.
- Prueba existente de catálogo y unidad modelo.
- Prueba de navegador específica: una lección emite una recompensa y reabrirla no emite otra.
- Pruebas de servicio y API añadidas para el entorno backend con dependencias.

El runtime local disponible no incluye `pytest` ni SQLAlchemy, y Docker no está iniciado. Por eso las nuevas pruebas Python quedan preparadas para ejecutarse en el contenedor o entorno backend del proyecto, además de las comprobaciones de navegador que sí se ejecutan localmente.
