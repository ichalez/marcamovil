# MarcaMóvil: app móvil

App Flutter para **Android e iPhone** que retransmite el partido a YouTube con el marcador encima.

## Cómo funciona

1. Entras con tu cuenta de la web (email y contraseña). Si en la web entraste con Google, usa
   “¿No tienes contraseña?” para crear una.
2. Eliges el partido. La app lee la clave de emisión que guardaste en la web.
3. Eliges la calidad (480p, 720p o 1080p) y pulsas **Abrir cámara**.
4. Se abre la cámara en horizontal con el marcador ya encima. Pulsa **● EMITIR**.
5. Desde otro móvil o tablet, el operador lleva el marcador en el panel de control de la web.

También hay un **modo manual**, sin cuenta: pegas el servidor RTMP, la clave y la URL del overlay
(por ejemplo `https://tu-web/overlay/demo`). Sirve para hacer pruebas.

## Pantalla de emisión

- La vista previa es exactamente lo que se emite: cámara más marcador.
- Botones: emitir/parar, cambiar de cámara, silenciar el micrófono, ocultar el marcador y salir.
- Si se corta la conexión, reintenta automáticamente (hasta 30 veces, cada 3 s).
- Con el bitrate adaptativo activado, baja la calidad si la red empeora y la recupera después.
- La pantalla no se apaga mientras está abierta.

## Configuración (Firebase)

La app se compila con un JSON de configuración (`--dart-define-from-file`). Copia
`config.example.json` a `config.json` y rellénalo. Cómo obtener cada valor está explicado en
[docs/SETUP.md](../docs/SETUP.md#8-configurar-la-app-móvil). Sin configuración, la app arranca
solo con el modo manual.

## Compilar

**Opción fácil: GitHub Actions.** Cada push compila el APK de Android. Lo descargas desde la
pestaña *Actions* del repositorio → la última ejecución → *Artifacts* → `marcamovil-android-apk`.

**En tu ordenador** (con Flutter instalado):

```bash
cd mobile
flutter pub get
flutter run --dart-define-from-file=config.json
```

En iPhone hace falta un Mac con Xcode y activar Swift Package Manager (HaishinKit solo se
distribuye así):

```bash
flutter config --enable-swift-package-manager
```

## Estructura

```
lib/                         App Flutter (inicio de sesión, partidos, ajustes, modo manual)
packages/marcamovil_streamer Plugin nativo de emisión
  android/ …BroadcastActivity.kt         Cámara + overlay + RTMP con RootEncoder
  ios/ …BroadcastViewController.swift    Cámara + overlay + RTMP con HaishinKit
```
