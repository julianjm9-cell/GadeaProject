# Administración de aplicaciones e IA

El inicio reúne las aplicaciones con accesos a sus usuarios y a sus modelos. En cada aplicación se mantienen la creación de cuentas, las licencias, fechas, créditos y edición de usuarios.

## Elegir modelos

1. Abre **Modelos de IA** y selecciona la aplicación.
2. En la función que quieras cambiar, elige **Personalizar para esta app**.
3. Selecciona proveedor y modelo. **Otro modelo…** permite indicar el identificador exacto del proveedor.
4. Pulsa **Guardar esta aplicación**. El cambio solo afecta a esa app.

Las funciones son texto/asistente, lectura de imágenes y audio a texto. Diplomator añade apuntes y guiones. Los modelos del desplegable proceden de los valores integrados de la suite; su disponibilidad se comprueba con el proveedor, no se consulta automáticamente un catálogo comercial.

**Usar ajustes generales** mantiene la configuración compartida anterior. Volver a esa opción elimina la personalización de esa función al guardar. Los borradores se mantienen al cambiar de app dentro del panel, pero no al recargar la página.

## Claves y pruebas

**Claves y conexiones** guarda las credenciales de Groq, OpenAI o Gemini para toda la suite. Un campo vacío conserva su clave. Guardar claves no cambia modelos. El panel no recibe las claves completas.

Las tarjetas distinguen disponibilidad de clave y resultado de prueba. **Probar modelo guardado** envía una petición breve al proveedor y puede generar consumo en su cuenta. No se prueba automáticamente al guardar. La validación de audio comprueba la configuración; no transcribe una grabación.

## Persistencia y compatibilidad

Las personalizaciones se guardan en AppSetting con claves `ai.PRODUCTO.funcion`; no requieren migración de esquema. Sin personalizaciones se conservan los ajustes actuales. Los endpoints de chat, OCR y transcripción resuelven el modelo desde la licencia de la aplicación. Los modelos enviados por el cliente no sustituyen la selección del administrador.

Los endpoints de configuración requieren superadministrador. `POST /admin/ai-settings/apps/{product}` modifica solo las funciones indicadas; un valor nulo restaura la herencia. `POST /admin/ai-settings/keys` cambia solo claves. El endpoint general anterior se mantiene para compatibilidad.

Pruebas: `node --test admin/dashboard.test.cjs`, `node tests/admin-ai-browser.cjs` y las pruebas `app_ai` de `backend/tests/test_access_control.py`. Las llamadas a proveedores están simuladas en las pruebas.
