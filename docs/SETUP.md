# Guía de puesta en marcha

## 1. Herramientas en tu ordenador

- **Node.js 20 o superior**: https://nodejs.org (versión LTS)
- **Firebase CLI**:
  ```bash
  npm install -g firebase-tools
  ```
- **Git** (opcional, para clonar el repositorio)

## 2. Crear el proyecto de Firebase

1. Entra en https://console.firebase.google.com y pulsa **Crear un proyecto** (por ejemplo, `marcamovil`).
   Google Analytics no hace falta.
2. **Authentication** → *Comenzar* → en *Método de acceso* activa:
   - **Correo electrónico/contraseña**
   - **Google** (elige un email de asistencia)
3. **Firestore Database** → *Crear base de datos* → modo **producción** → región `eur3 (europe-west)`.
4. **Storage** → *Comenzar* (misma región).
   > Desde 2024, Storage requiere el plan **Blaze** (pago por uso). Tiene una capa gratuita amplia: para escudos y
   > logos lo normal es pagar 0 €. Pon una alerta de presupuesto de 1 € en Google Cloud si quieres ir sobre seguro.
5. ⚙️ **Configuración del proyecto** → *Tus apps* → icono **Web `</>`** → registra la app (por ejemplo, "web").
   Copia los valores de `firebaseConfig`.

## 3. Configurar la web

```bash
cd web
cp .env.example .env.local
```

Rellena `.env.local` con los valores del paso anterior:

```
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=marcamovil.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=marcamovil
VITE_FIREBASE_STORAGE_BUCKET=marcamovil.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Instala las dependencias y arranca la web en local:

```bash
npm install
```

```bash
npm run dev
```

## 4. Desplegar reglas y web

En la raíz del repositorio:

```bash
firebase login
```

```bash
cp .firebaserc.example .firebaserc
```

Edita `.firebaserc` y pon el ID de tu proyecto. Después:

```bash
cd web && npm run build && cd ..
```

```bash
firebase deploy
```

- Durante el primer despliegue, la CLI pregunta si las reglas de Storage pueden leer Firestore (para comprobar
  que eres miembro del club). Responde **sí**.
- La web queda en `https://<tu-proyecto>.web.app`.
- En **Authentication → Configuración → Dominios autorizados** ya aparecen `localhost` y `<tu-proyecto>.web.app`.
  Si usas un dominio propio, añádelo ahí.

## 5. Primer uso

1. Entra en la web, crea tu cuenta y **crea tu club**.
2. En **Equipos**, crea tu equipo y los rivales: escudo, colores, abreviatura de 3 letras y plantilla.
   La plantilla se puede pegar como `9 Pablo` (un jugador por línea).
3. En **Patrocinadores**, sube los logos. Mejor en PNG con fondo transparente.
4. En **Partidos → Nuevo partido**, elige los equipos y pega la **clave de emisión** de YouTube:
   - YouTube Studio → **Emitir en directo** → pestaña **Emisión** → *Clave de emisión*.
   - La primera vez, YouTube puede tardar **24 h** en activar las emisiones en directo del canal.
     Hazlo con tiempo.
   - Para emitir desde el móvil con la app propia, el canal necesita las emisiones en directo activadas.
     El requisito de 50 suscriptores solo afecta a la app oficial de YouTube; por RTMP no se aplica.
5. En **Miembros**, invita por email a quien vaya a llevar el marcador. Al entrar con ese email verá la invitación.

## 6. Probar el overlay con OBS (antes de tener la app)

1. En OBS: Fuente → **Navegador** → URL `https://<tu-proyecto>.web.app/overlay/<id-partido>`, 1920×1080.
2. Pon debajo una fuente de cámara.
3. En **Ajustes → Emisión**, elige YouTube y pega la clave.
4. Abre el **panel de control** en el móvil (`/control/<id-partido>`) y comprueba que todo responde al momento.

## 7. Entorno para la app móvil (fase 2)

### Android (Windows, macOS o Linux)

1. Instala **Android Studio**: https://developer.android.com/studio
2. Instala **Flutter**: https://docs.flutter.dev/get-started/install. Elige tu sistema operativo y la opción *Android*.
3. Comprueba que todo está bien:
   ```bash
   flutter doctor
   ```
   Corrige lo que salga en rojo (normalmente aceptar las licencias de Android con `flutter doctor --android-licenses`).
4. En el móvil Android: Ajustes → Información del teléfono → pulsa 7 veces en *Número de compilación*.
   Después, en Opciones de desarrollador, activa la **Depuración USB**.

### iPhone (requiere un Mac)

1. Instala **Xcode** desde la App Store y ábrelo una vez para aceptar la licencia.
2. Instala CocoaPods:
   ```bash
   sudo gem install cocoapods
   ```
3. Para instalar la app en tu propio iPhone basta con un Apple ID gratuito, pero caduca a los 7 días.
   Para distribuirla con TestFlight o en la App Store hace falta el **Apple Developer Program** (99 $/año).
4. En el iPhone: Ajustes → Privacidad y seguridad → **Modo desarrollador** → activar.

### Firebase en la app

Cuando empiece la fase 2, lo conectaremos con:

```bash
dart pub global activate flutterfire_cli
```

```bash
flutterfire configure
```

## 8. Configurar la app móvil

La app usa el mismo proyecto de Firebase que la web, pero cada plataforma necesita su propio
**App ID**:

1. Consola de Firebase → ⚙️ *Configuración del proyecto* → *Tus apps* → **Añadir app**:
   - **Android**: nombre del paquete `com.marcamovil.marcamovil`. Copia el *ID de la app*
     (`1:1234…:android:abcd…`). No hace falta descargar `google-services.json`.
   - **iOS**: ID del paquete `com.marcamovil.marcamovil`. Copia el *ID de la app*
     (`1:1234…:ios:abcd…`).
2. Copia `mobile/config.example.json` a `mobile/config.json` y rellénalo:

   ```json
   {
     "FIREBASE_API_KEY": "AIza... (la misma que en la web)",
     "FIREBASE_PROJECT_ID": "marcamovil",
     "FIREBASE_MESSAGING_SENDER_ID": "1234...",
     "FIREBASE_STORAGE_BUCKET": "marcamovil.firebasestorage.app",
     "FIREBASE_ANDROID_APP_ID": "1:1234...:android:abcd...",
     "FIREBASE_IOS_APP_ID": "1:1234...:ios:abcd...",
     "FIREBASE_IOS_BUNDLE_ID": "com.marcamovil.marcamovil",
     "WEB_URL": "https://marcamovil.web.app"
   }
   ```

   Estos valores **no son secretos**: la protección real son las reglas de seguridad. Puedes
   subir `config.json` al repositorio. Si prefieres no hacerlo, guarda el contenido en GitHub →
   *Settings → Secrets and variables → Actions* como secreto `MOBILE_CONFIG_JSON`.
3. Haz push. GitHub Actions compila el APK con esa configuración.

### Instalar el APK en Android

1. En GitHub → pestaña **Actions** → la última ejecución verde de **CI** → *Artifacts* →
   descarga `marcamovil-android-apk` (es un .zip con el `.apk` dentro).
2. Pásalo al móvil y ábrelo. Android pedirá permiso para “instalar apps desconocidas”: concédelo
   al navegador o al gestor de archivos.
3. La primera vez que abras la cámara, acepta los permisos de cámara y micrófono.

### Primera prueba recomendada

1. Abre en el ordenador el panel demo: `https://<tu-web>/control/demo`.
2. En el móvil: **Emisión manual** → overlay `https://<tu-web>/overlay/demo` → *Abrir cámara*.
   Deberías ver el marcador demo encima de la cámara. (El demo no se sincroniza entre
   dispositivos; para eso usa un partido real.)
3. Para probar la emisión sin hacerla pública, crea en YouTube un directo **oculto** o
   **privado** y usa su clave.

## Problemas frecuentes

| Problema | Solución |
|---|---|
| "Falta configurar Firebase" | Falta `web/.env.local`, o hay que reiniciar `npm run dev` después de crearlo |
| "No tienes permiso" al subir un escudo | Las reglas de Storage no están desplegadas, o no aceptaste el acceso a Firestore. Repite `firebase deploy --only storage` |
| No puedo aceptar la invitación | Hay que verificar el email. Revisa el correo y pulsa "Ya lo he verificado" |
| Google login: "unauthorized-domain" | Añade el dominio en Authentication → Configuración → Dominios autorizados |
| La app solo muestra “Emisión manual” | El APK se compiló sin `config.json`/`MOBILE_CONFIG_JSON`, o falta el App ID de la plataforma |
| En la app no puedo entrar con mi cuenta de Google | La app solo usa email y contraseña. Pulsa “¿No tienes contraseña?” y crea una con el email que te llega |
| El overlay sale en blanco en OBS | Comprueba que la URL es la del partido (no la del panel) y que el partido existe |
