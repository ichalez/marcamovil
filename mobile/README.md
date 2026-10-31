# App móvil (fase 2): pendiente

Plan técnico:

- **Flutter** para la interfaz: inicio de sesión con Firebase, lista de partidos, ajustes de calidad y botón de emitir.
- **Plugin nativo propio** (platform channel) para el vídeo:
  - **Android:** [RootEncoder](https://github.com/pedroSG94/RootEncoder) (Camera2 → OpenGL → H.264/AAC → RTMP).
    El overlay es un `WebView` transparente fuera de pantalla que se dibuja en una textura como filtro
    de imagen sobre cada fotograma.
  - **iOS:** [HaishinKit](https://github.com/shogo4405/HaishinKit.swift) (AVCapture → VideoToolbox → RTMP).
    Un `WKWebView` transparente se captura con `takeSnapshot` y se combina como `VideoEffect`
    con Core Image.
- El overlay solo cambia cuando cambia el estado (y el reloj una vez por segundo), así que basta con
  re-capturar el WebView a unos 2-5 fps. Los fotogramas de cámara siguen a 30 fps.
- Calidades: 480p, 720p y 1080p a 30 fps, con bitrate adaptativo y reconexión automática al RTMP.
- La app lee `clubs/{clubId}/matches/{id}.stream` (clave RTMP) y carga `https://<tu-web>/overlay/{id}`.
