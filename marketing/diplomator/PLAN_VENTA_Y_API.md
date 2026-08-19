# Plan de venta y API para DIPLOMATOR

## Modelo comercial actual

Modelo manual:

- No hay prueba gratuita descargable.
- No hay descarga publica.
- Primero te habla por WhatsApp.
- Le mandas un link de prueba.
- Si hace falta, lo enseñas en directo.
- Si le gusta, lo instalas.
- Despues paga la mensualidad.

Precio orientativo actual:

- `15 EUR/mes`

## Flujo comercial

1. Landing publica en Netlify.
2. Boton "Hablame por WhatsApp".
3. Le mandas un link de prueba.
4. Demo o instalacion guiada si hace falta.
5. Pago mensual si decide quedarse.
6. Entrega o instalacion del ZIP solo a clientes.

## Entrega de la aplicacion

No publiques `Diplomator_Portable.zip` dentro de la landing.

Archivo privado:

```text
C:\Users\julia\Desktop\BUILD\dist\Diplomator_Portable.zip
```

Opciones:

- Instalarlo tu durante la llamada.
- Subir el ZIP a Google Drive privado y compartirlo solo con clientes.
- Retirar acceso si cancela.

## Pago

De momento, cobro manual o enlace de Stripe enviado despues de la demo.

No pongas un enlace de pago desactivado en la landing.

Cuando quieras automatizar:

- Crear Payment Link activo en Stripe.
- Cambiar los botones de email por el enlace de Stripe.
- Implementar validacion online si quieres bloquear acceso por suscripcion.

## API de IA

Modelo inicial:

- Cada usuaria usa su propia API key.
- Tu vendes la herramienta, instalacion y flujo de trabajo.

Modelo futuro:

- Plan con IA incluida.
- Limite mensual.
- Validacion online de suscripcion.

## Mejora tecnica futura

Implementar licencias:

- Pantalla para email/licencia.
- Validacion online con Stripe.
- Bloqueo si la suscripcion no esta activa.
- Mensaje claro para renovar o contactar soporte.
