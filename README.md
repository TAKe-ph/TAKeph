# 📷 TAKePH

Haces una foto (o escaneas un documento) en el móvil y llega sola a la carpeta que tú elijas en el PC.

```
 MÓVIL (app instalada)            INTERNET (Supabase, gratis)          PC (Chrome / Edge)
 ┌─────────────────────┐          ┌────────────────────────┐          ┌─────────────────────────┐
 │ Elijo carpeta       │  sube    │ fotos/                 │  baja    │ pc.html                 │
 │ 📷 Foto / 📄 Escaneo │ ───────► │  Obra_Calle_Mayor/...  │ ───────► │ guarda en D:\Trabajo\   │
 │ (sin cobertura =    │          │  (privado, con login)  │          │  Obra_Calle_Mayor\...   │
 │  espera y sube sola)│          └────────────────────────┘          │ y borra de internet     │
 └─────────────────────┘                                              └─────────────────────────┘
```

## Qué hace

**En el móvil (`index.html`)**
- Escribes o eliges la **carpeta**, por ejemplo `Obra Calle Mayor/Cuadro electrico`. Recuerda las últimas que has usado.
- **📷 Hacer foto**: abre la cámara y la foto se sube con el nombre `2026-11-14_17-30-05_ab12.jpg`.
- **📄 Escanear documento**:
  - Haces la foto y ajustas las 4 esquinas; la app la endereza.
  - Eliges el filtro: Color, Documento o Blanco y negro.
  - Puedes añadir más páginas y se sube todo como **un PDF**.
- **Sin cobertura**: las fotos se quedan guardadas en el móvil y se suben solas cuando vuelve internet.
- 🔗 en cada subida: crea un **enlace** para compartir el archivo, válido 7 días.

**En el PC (`pc.html`)**
- Eliges una vez la carpeta base, por ejemplo `D:\Trabajo\Fotos`.
- **⬇️ Descargar todo**: guarda cada archivo en su subcarpeta (la crea si no existe). Después lo borra de internet, aunque esto se puede desactivar.
- **Automático**: con la pestaña abierta, cada 20 segundos baja lo nuevo sin que toques nada.

## Puesta en marcha (unos 20 minutos, una sola vez)

### 1. Crear el «almacén» en Supabase (gratis)
1. Entra en https://supabase.com y crea una cuenta. Después crea un **New project**.
2. Ve a **SQL Editor**, pega el contenido de `supabase.sql` y pulsa **Run**.
3. En **Authentication → Users → Add user**, crea tu usuario (correo + contraseña) y marca *Auto confirm*.
4. En **Authentication → Sign In / Providers**, desactiva **Allow new users to sign up**.
5. En **Project Settings → API**, copia:
   - **Project URL** → `SUPABASE_URL` en `config.js`
   - **anon / publishable key** → `SUPABASE_KEY` en `config.js`

### 2. Publicar la app (GitHub Pages, gratis)
La cámara solo funciona en páginas **https**, así que hay que publicarla:
1. Crea una cuenta en https://github.com y un repositorio nuevo, por ejemplo `fotopc`.
2. Sube todos los archivos de esta carpeta. Puedes hacerlo con **Add file → Upload files** o desde VS Code con Git.
3. En **Settings → Pages**, elige *Branch: main* y la carpeta */ (root)*, y pulsa **Save**.
4. En 1 o 2 minutos tendrás la app en `https://TU-USUARIO.github.io/fotopc/`.

### 3. Instalar en el móvil Android
1. Abre `https://TU-USUARIO.github.io/fotopc/` en **Chrome**.
2. Pulsa el menú ⋮ → **Instalar aplicación** (o «Añadir a pantalla de inicio»).
3. Abre FotoPC desde el icono y entra con tu usuario. La sesión se queda guardada.

> ¿Quieres un **.apk** de verdad? Entra en https://www.pwabuilder.com, pega tu URL y descarga el paquete de Android.

### 4. En el PC
1. Abre `https://TU-USUARIO.github.io/fotopc/pc.html` en **Chrome o Edge** y guárdala en marcadores.
2. Entra con tu usuario, pulsa **📁 Elegir carpeta** y luego **⬇️ Descargar todo**, o activa el modo automático.
3. Cada vez que abras la página, el navegador te pedirá **una vez** permiso para la carpeta. Es una medida de seguridad del navegador.

## Editar en VS Code
- Abre la carpeta con **File → Open Folder**.
- Para probar en el PC, usa la extensión **Live Server**: clic derecho en `pc.html` → *Open with Live Server*.
- Para probar en el móvil hace falta https, así que sube los cambios a GitHub. Cuando cambies archivos, sube también el número de `VERSION` en `sw.js` para que el móvil coja la versión nueva.

| Archivo | Qué es |
|---|---|
| `config.js` | Tus datos de Supabase y la calidad de las fotos |
| `index.html` + `movil.js` | App del móvil |
| `scan.js` | Escáner: esquinas, enderezado, filtros y PDF (sin librerías) |
| `pc.html` + `pc.js` | Página del PC que guarda en tu carpeta |
| `common.js` | Login, subida y descarga, cola sin conexión |
| `style.css`, `manifest.json`, `sw.js`, `icons/` | Diseño e instalación como app |
| `supabase.sql` | Configuración del almacén |

## Límites y avisos
- **Plan gratuito de Supabase**:
  - 1 GB de espacio. Por eso la página del PC borra lo que descarga.
  - Si el proyecto pasa una semana sin usarse, se pausa; se reactiva desde el panel de Supabase.
- **Seguridad**: el almacén es privado y hace falta tu usuario y contraseña. No compartas `config.js` con la contraseña escrita (la contraseña nunca va en el código).
- **Ordenador de empresa**:
  - Comprueba que tu empresa permite usar este tipo de servicio para fotos del trabajo.
  - Si la página del PC está bloqueada en el portátil, la red de la empresa no deja pasar la conexión y no hay nada que hacer desde la app.

## Versión 2: varias carpetas y varios usuarios
- **➕ Nueva carpeta** (móvil): propone el siguiente nombre (`Muestra 1` → `Muestra 2`…). El botón de foto muestra a qué carpeta va.
- Las fotos se quedan en internet **hasta que el PC las descarga**; no caducan. Puedes hacer varias carpetas seguidas y descargarlo todo al final.
- **Registro con código de invitación**: en la pantalla de entrada, «¿No tienes cuenta? Crear una». El código se guarda en Supabase (`supabase-v2.sql`).
- **Cada usuario solo ve sus fotos**: se guardan en `fotos/<id-usuario>/<carpeta>/…`.
- Instalar v2:
  1. Ejecuta `supabase-v2.sql` en SQL Editor (cambia antes el código).
  2. En Supabase → Authentication → Sign In / Providers: activa **Allow new users to sign up** y desactiva **Confirm email**.
  3. Sube a GitHub los archivos cambiados (no subas `config.js`, que ya está bien).
- Nota: con el código activado, «Add user» del panel de Supabase deja de funcionar; todos se registran desde la app con el código.

## Versión 3: seguridad
- 🔐 **Cifrado de extremo a extremo** (AES-256-GCM): la foto y el nombre de la carpeta se cifran en el móvil y solo se descifran en el PC. Supabase solo ve archivos ilegibles (`e1Xk3…`).
  - La clave de cifrado se pide una vez en cada aparato y nunca sale de él (se guarda como clave no exportable).
  - Hay que poner la **misma clave** en el móvil y en el PC; la app comprueba que coincide.
  - Si se olvida, las fotos pendientes no se pueden recuperar. Al pulsar «Salir», se borra del aparato.
- 🧹 **Borrado a las 24 h**: la app borra lo antiguo cada vez que se abre. Además, `supabase-v3-borrado24h.sql` lo hace en el servidor cada hora, aunque nadie abra la app.
- ❌ Se ha quitado el botón de enlaces compartibles.
- 🛡️ Política de seguridad del navegador (CSP): la página solo puede hablar con tu Supabase.
- Recomendado: verificación en dos pasos en GitHub y Supabase; contraseña mínima de 10 caracteres (Authentication → Providers → Email).

## Versión 4: título en cada foto
- Después de cada foto aparece la vista previa y el campo **«¿Qué es esta foto?»**. Se puede escribir o dictar con 🎤.
- El archivo se guarda con ese nombre: `Un armario/Parte frontal.jpg`. Si se repite, el PC añade `(2)`, `(3)`…
- Los títulos usados recientemente salen como botones: un toque y la foto queda guardada.
- **Sin título**: se usa la fecha y la hora. **Repetir**: vuelve a abrir la cámara.
- También funciona con los PDF del escáner.

## Versión 5: editar
- Móvil → **✏️ Editar** (junto a las carpetas): toca una carpeta para **cambiarle el nombre** (también a sus fotos pendientes), **quitarla de la lista** o **borrar sus fotos pendientes**.
- Móvil → **Últimas subidas**: toca una foto para **cambiarle el nombre**, **moverla a otra carpeta** o **borrarla**.
- Solo se puede mientras la foto no ha llegado al PC. Si ya llegó (💻), se cambia en el Explorador de Windows.

## Versión final
- **Nombre:** TAKePH. Dirección única: https://take-ph.github.io/TAKeph/ (el móvil abre la cámara y el PC abre la página de recibir).
- **📷 Cámara integrada:** la cámara se ve en directo dentro de la app y dispara seguido. Después de cada foto se pone el título (un toque con los títulos recientes).
  - 📁 Arriba: toca la carpeta para pasar a la siguiente muestra sin salir de la cámara.
  - 🔦 Linterna (si el móvil lo permite).
  - 📱 Abre la cámara normal del móvil, que da más calidad y zoom.
- **⚙️ Ajustes** (móvil): volver a poner la clave de cifrado y cerrar sesión.
- Las carpetas admiten tildes y espacios («Armario pequeño»).
- En el PC, la pestaña muestra cuántos archivos hay pendientes: «(3) TAKePH».

## Estado de Supabase (configurado el 15-11-2026)
- ✅ Cada usuario solo ve sus fotos (políticas por `auth.uid()`).
- ✅ Registro solo con código de invitación (trigger `fotopc_invitacion_trg`). El código no está en este repositorio.
- ✅ Borrado en el servidor: Edge Function `takeph-purgar` + pg_cron (`takeph-borrar-24h`, cada hora en el minuto 7).
- Pendiente manual: Authentication → Sign In / Providers → activar «Allow new users to sign up» y desactivar «Confirm email».
