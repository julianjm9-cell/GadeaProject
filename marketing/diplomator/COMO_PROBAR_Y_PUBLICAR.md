# Como probar y publicar DIPLOMATOR

## 1. Probar la landing en tu ordenador

Abre este archivo:

```text
C:\Users\julia\Desktop\BUILD\marketing\diplomator\index.html
```

Comprueba:

- Que la pagina se ve bien.
- Que "Hablame por WhatsApp" abre una conversacion con `663 533 412`.
- Que no hay enlace de pago activo.
- Que no hay descarga publica.

## 2. Publicar la landing gratis

Sube esta carpeta limpia a Netlify:

```text
C:\Users\julia\Desktop\BUILD\marketing\diplomator_public
```

Esa carpeta contiene solo la landing y el icono.

No subas:

- `marketing/diplomator/downloads/`
- `Diplomator_Portable.zip`
- ninguna carpeta `dist/`

## 3. Flujo comercial actual

1. La persona ve la landing.
2. Pulsa "Hablame por WhatsApp" o "Contactar".
3. Te escribe por WhatsApp.
4. Le mandas un link de prueba.
5. Quedas con ella en directo si hace falta.
6. Si le gusta, se lo instalas o le das acceso.
7. Despues paga la mensualidad.

## 4. Entrega de la app

El ZIP privado esta aqui:

```text
C:\Users\julia\Desktop\BUILD\dist\Diplomator_Portable.zip
```

Puedes subir ese ZIP a Google Drive privado y compartirlo solo con personas que hayan pagado, o instalarlo tu durante la llamada.

## 5. Pago

Ahora no hay enlace de pago activo en la landing.

Cuando quieras reactivar el pago:

1. Crea un Payment Link en Stripe.
2. Sustituye los enlaces `mailto:` por el enlace de Stripe si quieres cobro directo.
3. Mantén la demo/instalacion manual si quieres controlar la venta.

## 6. API de IA

Para empezar, cada usuaria usa su propia API key.

Mas adelante puedes crear un plan superior con IA incluida.
