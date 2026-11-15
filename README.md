# 📷 FotoPC

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
