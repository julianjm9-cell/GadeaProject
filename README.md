# GadeaProject

Aplicacion local para preparar temas orales, generar puntos de estudio, practicar recitacion, transcribir audio y pedir correcciones.

## Como se ejecuta

La forma sencilla es usar el paquete portable generado en `dist/GadeaProject_Portable.zip`.

1. Descomprime el ZIP.
2. Abre `GadeaProject_Portable.exe`.
3. La aplicacion abre el navegador en `localhost`.

## API key de Groq

La clave `gsk_...` no se guarda en GitHub.

Cada ordenador debe configurar su propia clave en la pantalla de Configuracion de la app. La app la guarda localmente en:

```text
GadeaProject_Data/apikey.txt
```

Esa carpeta esta ignorada por Git porque contiene datos privados: historial, configuracion, logs, backups y API key.

## Que guarda GitHub

GitHub guarda el codigo fuente y el historial de cambios.

No guarda automaticamente:

- La API key.
- El historial local de estudio.
- Los ejecutables generados.
- Los ZIP de entrega.
- La carpeta `GadeaProject_Data`.

## Uso en otro ordenador

Para usarlo en otro ordenador hay dos opciones:

1. Descargar el codigo desde GitHub y reconstruir el ejecutable.
2. Compartir el ZIP portable generado aparte.

GitHub por si solo no aloja la app completa como servidor. Esta app se ejecuta localmente en el ordenador del usuario.
