# YORU — Android APK conectado a Vercel

## Arquitectura
La app Android es una **Trusted Web Activity** (TWA) cuyo origen fijo es `https://mi-presupuesto-ebon.vercel.app`.
No incorpora ni modifica componentes React, rutas financieras, estilos, claves de almacenamiento ni el service worker. Las publicaciones web en **Vercel Production** siguen apareciendo en el APK sin reconstruirlo. Cambios nativos (icono Android, versión, identificador de paquete, permisos) sí requieren nuevo APK.

## Estado de ramas
- `main` publica Production.
- `established/yoru-final-qa` tenía 11 commits adicionales al preparar esta integración. Revisar y desplegar su versión aprobada antes de distribuir el APK.
- No uses una URL temporal `*-<hash>-*.vercel.app` como host Android.

## Firmado
- Identificador Android: `com.josh.yoru`
- Alias del certificado: `yoru`
- SHA-256 del certificado: `45:70:E8:80:E6:6E:31:9E:9A:FB:61:DA:80:5D:15:12:CE:98:DF:B4:91:2A:4B:28:07:5E:A7:EB:7E:A2:02:19`
- El archivo privado `yoru-android-signing.jks` no está versionado ni debe enviarse al repositorio.
- Se entregó un kit privado de firma aparte. Respaldarlo: sin la misma clave no se puede instalar una actualización encima de la APK anterior.

## Compilación en GitHub Actions
El workflow `.github/workflows/yoru-android.yml` se ejecuta manualmente (`workflow_dispatch`) cuando esté integrado a la rama por defecto. Antes del primer uso configurar en **Repository settings → Secrets and variables → Actions**:

1. `YORU_ANDROID_KEYSTORE_BASE64`: base64 sin saltos de línea del archivo JKS suministrado.
2. `YORU_ANDROID_KEYSTORE_PASSWORD`: contraseña del kit privado.
3. `YORU_ANDROID_KEY_PASSWORD`: misma contraseña del kit privado.

El workflow genera el proyecto Android desde `android/twa-manifest.json`, compila la versión firmada y entrega `app-release-signed.apk` como artefacto descargable de GitHub Actions. Es configuración inicial **no ejecutada aún**; verificar el build y la instalación real antes de considerarlo listo para distribuir.

## Asociación dominio ↔ APK
El archivo `public/.well-known/assetlinks.json` declara la asociación de la firma Android con el dominio de producción. Para abrir sin barra de navegador debe responder públicamente en:
`https://mi-presupuesto-ebon.vercel.app/.well-known/assetlinks.json`
y concordar con el certificado firmado y paquete.

## Datos de usuario
- TWA renderiza el sitio por medio del navegador compatible; comparte origen de sitio y almacenamiento navegador (incluidos cookies y localStorage) cuando se usa el mismo origen. Aun así, realizar respaldo de YORU antes de instalar y validar los datos en el teléfono.
- **No usar Capacitor WebView** ni URL de preview en este modo: almacenarían datos en contextos distintos o cambiarían el origen.
- El acceso sin internet depende del service worker y de los recursos previamente almacenados; no todas las funciones de red pueden funcionar offline.
- TWA requiere navegador Android compatible; para probar usa Chrome actualizado.

## Lista de aceptación
- [ ] Revisar que los 11 commits de QA están listos para Production.
- [ ] Confirmar que el dominio de producción abre sin autenticación de Vercel.
- [ ] Comprobar que `assetlinks.json` se sirve como JSON público y coincide con el certificado.
- [ ] Configurar los tres secretos sin publicar el keystore.
- [ ] Ejecutar el workflow y descargar APK firmado.
- [ ] Instalar en Samsung y comprobar pantalla completa, navegación, almacenamiento local, backups, cierre mensual, PDF, offline y actualizaciones tras un deploy de producción.
