# Acceso con Google: ESO Adultos y Profesor Particular

La aplicación ya incluye el botón **Continuar con Google** en `/e25/login`, `/e25/register`, `/profesor/login` y `/profesor/register`. El botón aparece automáticamente cuando el servidor tiene configurados `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`. Hasta entonces siguen funcionando el registro y el acceso por email y contraseña.

## Configuración en Google Cloud

1. Configura la pantalla de consentimiento de OAuth para usuarios externos y añade `educame.tech` como dominio autorizado. Si la aplicación sigue en modo de prueba, añade las cuentas de prueba que vayan a entrar.
2. Crea un cliente OAuth de tipo **Aplicación web**. Usa `https://educame.tech` como origen JavaScript autorizado y `https://educame.tech/auth/google/callback` como URI de redirección autorizado. La URI debe coincidir exactamente.
3. Para iniciar sesión se solicitan únicamente `openid`, `email` y `profile`. La conexión opcional de Google Drive de otras pantallas solicita un permiso adicional en un paso separado.
4. En `/opt/educa-suite/.env` del servidor establece:

   ```dotenv
   GOOGLE_CLIENT_ID=el-id-del-cliente
   GOOGLE_CLIENT_SECRET=el-secreto-del-cliente
   GOOGLE_REDIRECT_URI=https://educame.tech/auth/google/callback
   COOKIE_SECURE=true
   SITE_ADDRESS=educame.tech
   CORS_ORIGINS=https://educame.tech
   ```

   Conserva los demás valores que ya uses en ese archivo. No subas el secreto al repositorio ni lo escribas en el dashboard. Reinicia el backend tras cambiar `.env`: `docker compose --profile proxy up -d --build`.

## Comprobación

- `https://educame.tech/auth/google/status` debe devolver `"enabled":true`.
- En las páginas de acceso de ESO Adultos y Profesor Particular debe aparecer **Continuar con Google**. Comprueba el registro con una cuenta nueva y el acceso con una cuenta ya existente.
- La misma dirección de correo verificada por Google se vincula a la cuenta existente, conservando sus datos. Un acceso nuevo recibe únicamente la licencia gratuita de la app elegida si su registro está abierto. No se reponen créditos ni se renuevan licencias al volver a iniciar sesión.
- Diplomator conserva su acceso por licencia asignada; este cambio no abre su registro público.

Si el dominio público usa `www`, configura en Google y en `.env` la misma dirección final que ve el navegador, incluido ese subdominio.
