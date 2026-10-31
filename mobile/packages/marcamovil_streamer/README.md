# marcamovil_streamer

Plugin interno de MarcaMóvil. Abre una pantalla nativa a pantalla completa que:

1. Muestra la cámara.
2. Carga el overlay HTML (`/overlay/:matchId`) en un WebView transparente del tamaño del vídeo.
3. Captura el WebView varias veces por segundo y lo compone sobre cada fotograma (OpenGL en Android,
   `Screen` de HaishinKit en iOS).
4. Emite por RTMP con reconexión automática y bitrate adaptativo.

| Plataforma | Librería |
|---|---|
| Android | [RootEncoder](https://github.com/pedroSG94/RootEncoder) 2.8.1 (JitPack) |
| iOS | [HaishinKit](https://github.com/HaishinKit/HaishinKit.swift) 2.2.5 (Swift Package Manager) |

En iOS solo se usa Swift Package Manager: `flutter config --enable-swift-package-manager`.
