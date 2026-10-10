# Generación recuperable de materiales

## Causas corregidas

La incidencia `020cd77b` mezclaba un rechazo del esquema de Groq (HTTP 400) y dos
respuestas HTTP 200 descartadas durante la lectura y validación. Los registros anteriores
ocultaban el campo que fallaba. Repetir el mismo contrato complejo no solucionaba el problema.

El generador usa ahora un contrato mínimo específico para cada uno de los 21 tipos:
contenido, respuesta y explicación; objetos con campos separados para parejas, pistas y
palabras. Las letras del Pasapalabra se asignan en el servidor mediante emparejamiento:
cada respuesta contiene su letra y ninguna letra se repite. Se generan hasta seis pistas
por llamada, sin forzar un alfabeto que no encaja con el tema.

La validación conserva los cálculos, soluciones, cantidades, duplicados, categorías,
lecturas compartidas y comprobaciones pedagógicas existentes. Puede normalizar JSON con
texto introductorio, alias conocidos y una igualdad aritmética verificada. No inventa
respuestas para completar campos ausentes ni entrega un tablero incompleto. Los campos
auxiliares opcionales no provocan el descarte de una actividad válida; una afirmación
incorrecta en ellos se omite, mientras la explicación principal se sigue comprobando.

Las fechas completas permiten varios hechos del mismo año. Se ordenan por año, mes y
día, se rechazan fechas imposibles o ambiguas y se ocultan completas antes de comprobar.
Los procesos y actividades de idioma siguen evitando años y premios ficticios. Estos
controles no sustituyen una verificación documental de todos los hechos generados.

## Progreso, reintentos y cobro

- `POST /api/profesor/generation/start` inicia o recupera un trabajo persistido.
- `GET /api/profesor/generation/{request_id}` devuelve progreso y resultado al propietario.
- La respuesta HTTP inicial es breve; la IA trabaja en segundo plano sin depender de que
  el navegador mantenga una petición abierta durante toda la generación.
- Los ejercicios o pistas ya validados se guardan. Se pide únicamente lo pendiente;
  las categorías y el pasaje aceptados se conservan también dentro de un lote parcial.
- Una lectura, relato o secuencia inválidos se vuelven a pedir como unidad coherente.
  Un crucigrama que no puede colocarse requiere rehacer el conjunto de palabras.
- Se permiten tres intentos consecutivos sin progreso por proveedor, con un máximo total
  acotado por lote. Las respuestas truncadas amplían el presupuesto; los rechazos del
  esquema permiten reintentar JSON simple. Los errores transitorios respetan Retry-After.
- Se usa el proveedor de reserva de Administración → IA si está configurado y disponible.
  No se cambian claves ni modelos configurados automáticamente.
- Solo hay un trabajo activo por cuenta. Un trabajo sin actividad durante diez minutos
  puede retomarse; ese plazo no elimina datos ni materiales.
- El formulario conserva en la sesión del navegador los campos y el identificador de
  reintento, vinculados a la cuenta. Al recargar y volver a Crear material se recuperan.
- Se cobra un crédito únicamente después de validar el material completo. El bloqueo
  breve de la cuenta y la comprobación final impiden un segundo cargo por el mismo intento.
  Un fallo o interrupción conserva el progreso y no cobra. La regeneración individual
  mantiene este mismo comportamiento y entrega exactamente una sustitución.

La tabla nueva `profesor_generation_jobs` se añade mediante la migración 0014 sin modificar
materiales existentes. Los trabajos interrumpidos se retoman al reintentar con el mismo
identificador; no se relanzan solos tras un reinicio del servidor.

## Diagnóstico y pruebas

Los registros incluyen identificador, proveedor/modelo, tipo, lote, intento, HTTP del
proveedor y motivo concreto de validación. No registran claves ni respuestas completas.

La prueba real del 10/10/2026 con Groq `openai/gpt-oss-120b` completó los 21 tipos. El caso
3.º ESO / Lengua / Sintaxis / Pasapalabra de 18 letras también completó tres ejecuciones
consecutivas independientes. Línea temporal y respuesta numérica completaron dos
ejecuciones adicionales cada una después de corregir sus contratos. Son comprobaciones
reales del flujo de producción, no una garantía de disponibilidad del proveedor.

Pruebas automatizadas principales:

```bash
cd backend
python -m pytest tests/test_teacher_generation_recovery.py tests/test_teacher_generator_quality.py tests/test_teacher_generator.py tests/test_teacher_question_quality.py -q
```

Incluyen recuperación parcial, clasificación estable, pistas verbales inválidas, fechas
del mismo año, cálculos incorrectos, cargos duplicados, privacidad entre cuentas,
regeneración, reinicios, exclusión de trabajos simultáneos y migración sin pérdida de datos.
Las pruebas de navegador cubren progreso, reconexión, recarga con el mismo identificador,
edición, guardado y reproducción de resultados reales de los 21 formatos.

Resultado de la comprobación final: 123 pruebas de generación, calidad, PDF y Español
correctas; cinco pruebas de navegador correctas. La comprobación ampliada de acceso dio
208 correctas y tres fallos ya reproducibles en la revisión anterior `1daa5cd`: una
expectativa antigua sobre la imagen de la landing y dos pruebas de puntos de Diplomator.
No se han alterado esos comportamientos ajenos a esta reparación.

Comprobación real opcional en Hostinger:

```bash
docker compose exec -T backend python -m app.teacher_generator_check --configured --cases syntax --runs 1
docker compose exec -T backend python -m app.teacher_generator_check --configured --cases all --runs 1 --pause 5
```

El comprobador utiliza una base SQLite temporal con datos ficticios. No cambia datos ni
créditos de clientes; las llamadas sí consumen tokens del proveedor configurado. Admite
`--types timeline,numeric` para repetir solo formatos concretos y `--report` para guardar
un informe sin credenciales.

## Despliegue

```bash
cd /opt/educa-suite
git pull --ff-only origin main
bash infra/deploy-hostinger.sh
```

El script realiza copia de seguridad, aplica la migración, reconstruye el backend y
comprueba la tabla nueva y el JavaScript del generador. La caché de los scripts del
profesor y del alumno se actualiza con esta versión.
