# Sesiones de juegos: conservación y comprobaciones

Las sesiones con código no piden identidad al participante. El código y la sesión vencen a las 24 horas. `ocr-worker` ejecuta la limpieza de sesiones vencidas al arrancar y cada cinco minutos; consultar la lista de sesiones de un profesor también ejecuta la limpieza de las suyas. La eliminación borra la copia del material, el código, las respuestas y las calificaciones de la base de datos activa. El profesor puede anticiparla con «Borrar sesión y respuestas».

El código no garantiza anonimato legal: el profesor puede saber a quién se lo entregó fuera de la aplicación, y un campo de respuesta libre puede contener información personal. Evitar datos de menores en el material y en respuestas libres. La política pública explica esta limitación.

## Después de desplegar la migración 0018

El despliegue crea y verifica una copia de PostgreSQL **antes** de migrar. Esa copia puede contener las fichas y credenciales antiguas que la migración elimina de la base activa. Debe mantenerse restringida para una eventual recuperación y no reutilizarse en una restauración pública sin volver a aplicar la limpieza.

Comprobar en el servidor que no quedan cuentas ni sesiones identificadas y que el proceso de limpieza sigue activo:

```bash
cd /opt/educa-suite
docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT COUNT(*) FROM profesor_student_accesses; SELECT COUNT(*) FROM profesor_material_sessions WHERE access_id IS NOT NULL; SELECT COUNT(*) FROM profesor_material_sessions WHERE expires_at <= NOW();"'
docker compose ps ocr-worker
```

Revisar las carpetas de `backups/` y las instantáneas externas de Hostinger. Registrar qué copias anteriores a la migración contienen datos antiguos, quién puede acceder a ellas y hasta cuándo son necesarias para recuperar el servicio. Al acabar ese plazo, retirar solo las copias verificadas como prescindibles, salvo una obligación o reclamación concreta documentada. Las copias del proveedor requieren gestión en su panel o con su soporte; el código no las elimina. No habilitar limpieza indiscriminada de copias sin verificar el plan de restauración.

Ante una restauración, aislar la base, ejecutar de nuevo migraciones y limpieza, y comprobar los recuentos antes de exponer el servicio. Las solicitudes de supresión recibidas después de la fecha de la copia deben reaplicarse.

Fuentes: [AEPD, protección de datos por defecto](https://www.aepd.es/derechos-y-deberes/cumple-tus-deberes/medidas-de-cumplimiento/proteccion-de-datos-por-defecto) y [RGPD, artículos 5 y 17](https://eur-lex.europa.eu/eli/reg/2016/679/2016-05-04/spa).
