# Sesiones de juegos: conservación y comprobaciones

Las sesiones con código no piden identidad al participante. El código y la sesión vencen a las 24 horas. `ocr-worker` ejecuta la limpieza de sesiones vencidas al arrancar y cada cinco minutos; consultar la lista de sesiones de un profesor también ejecuta la limpieza de las suyas. La eliminación borra la copia del material, el código, las respuestas y las calificaciones de la base de datos activa. El profesor puede anticiparla con «Borrar sesión y respuestas».

El código no garantiza anonimato legal: el profesor puede saber a quién se lo entregó fuera de la aplicación, y un campo de respuesta libre puede contener información personal. Evitar datos de menores en el material y en respuestas libres. La política pública explica esta limitación.

## Después de desplegar las migraciones 0018 y 0019

El despliegue crea y verifica una copia de PostgreSQL **antes** de migrar. Esa copia debe mantenerse restringida para una eventual recuperación. Las fichas privadas del profesor forman parte del producto actual y deben conservarse; las credenciales retiradas de alumnos no deben reactivarse al restaurar.

La migración 0019 pendiente conserva las fichas, agenda, notas y tareas del profesor; elimina la tabla de credenciales de alumnos y retira la columna que vinculaba los juegos a esas cuentas. Algunas versiones anteriores de esa migración sí borraban fichas; no repetir ese borrado. La migración 0020 incorpora el historial recuperable del escritorio. Comprobar que ya no existen y que el proceso de limpieza sigue activo:

```bash
cd /opt/educa-suite
docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT to_regclass('\''public.profesor_student_accesses'\'') AS retired_table; SELECT COUNT(*) FROM profesor_material_sessions WHERE expires_at <= NOW();"'
docker compose ps ocr-worker
```

Revisar las carpetas de `backups/` y las instantáneas externas de Hostinger. Registrar qué copias anteriores a la migración contienen datos antiguos, quién puede acceder a ellas y hasta cuándo son necesarias para recuperar el servicio. Al acabar ese plazo, retirar solo las copias verificadas como prescindibles, salvo una obligación o reclamación concreta documentada. Las copias del proveedor requieren gestión en su panel o con su soporte; el código no las elimina. No habilitar limpieza indiscriminada de copias sin verificar el plan de restauración.

Ante una restauración, aislar la base, verificar las migraciones pendientes, retirar solo credenciales antiguas y juegos temporales caducados, y comprobar los recuentos antes de exponer el servicio. Las solicitudes de supresión recibidas después de la fecha de la copia deben reaplicarse.

Fuentes: [AEPD, protección de datos por defecto](https://www.aepd.es/derechos-y-deberes/cumple-tus-deberes/medidas-de-cumplimiento/proteccion-de-datos-por-defecto) y [RGPD, artículos 5 y 17](https://eur-lex.europa.eu/eli/reg/2016/679/2016-05-04/spa).
