# Credencial digital CPIC — Instructivo de instalación

## Cómo funciona

```
Base matriculado.xlsx ─┐
Estados CPIC.xlsx ─────┼─► Sincronizar (diario) ─► Hoja "Credenciales" ─► Apps Script ─► páginas en GitHub
Carpeta de fotos ──────┘                           (códigos de cada uno)      (doGet)       credencial / verificar
```

- **Fuentes (sólo lectura):** `Base matriculado.xlsx` (hojas *Base* y *Titulos*), `Estados CPIC.xlsx` y la carpeta de fotos (`{Código SN}_foto.jpg`). No se modifican.
- **Hoja de control "Credenciales CPIC":** una Hoja de Google nueva donde vive el script. Cada sincronización la reconstruye desde la Base, pero **conserva los códigos** de cada persona, así que el link y el QR no cambian.
- **Qué se muestra:**

| En la credencial | Sale de |
|---|---|
| Matrícula | Base → Matricula |
| Apellido / Nombre | Base → Apellido / Nombre (el nombre se pasa a mayúsculas y minúsculas) |
| DNI | Base → ID fiscal federal unificado |
| Título / Otorgado por / Expedido | Titulos → Titulo / Emisor / Fecha (el que tiene Predeterminado = SI) |
| Matriculación | Base → Fecha de Alta |
| Estado | Base → Estado CPIC, traducido con Estados CPIC.xlsx → **Activo**, **Vitalicio**, **Adherente**, **Fallecido** o **No Activo** |
| Foto | Carpeta de fotos, por Código SN |

- Se genera una credencial para **cada registro de la Base**. La credencial muestra el estado: Activo, Adherente, No Activo ("MATRÍCULA NO ACTIVA") o Fallecido. Si alguien cambia de estado, su credencial y su QR lo reflejan desde la siguiente sincronización.
- El profesional accede con matrícula + registro + DNI desde un único link publicado en la web del CPIC. No se envían correos.

---

## Paso 1 — Subir las páginas a GitHub

1. En el repositorio `cpic-apps/apps`: *Add file → Upload files*.
2. Arrastrá las carpetas **`credencial`** y **`verificar`** completas y hacé *Commit changes*.
3. Probá el modo demostración:
   - `https://cpic-apps.github.io/apps/credencial/?c=DEMO` (activo)
   - `…/credencial/?c=DEMO-ADH` (adherente)
   - `…/credencial/?c=DEMO-BAJA` (no activo)

## Paso 2 — Crear la hoja de control

Hacelo con la **cuenta institucional** que tiene acceso a la unidad compartida donde están la Base, los Estados y las fotos.

1. En Drive: *Nuevo → Hojas de cálculo de Google → Hoja en blanco*. Llamala **Credenciales CPIC**.
   Guardala en una carpeta con acceso restringido (contiene DNI).
2. *Extensiones → Apps Script*. Borrá lo que aparece y pegá todo `apps-script/Codigo.gs`.
3. A la izquierda, en **Servicios**, tocá **+**, elegí **Drive API** y *Agregar*. Lo necesita para leer los archivos Excel.
4. Revisá el bloque `CONFIG` del principio. Los ID de la Base, los Estados y la carpeta de fotos ya están cargados.
5. Guardá (ícono de disquete).

## Paso 3 — Primera sincronización

1. En el editor, elegí la función **sincronizar** y tocá *Ejecutar*.
2. Google pide permisos la primera vez: *Revisar permisos → elegir la cuenta → Avanzado → Ir a (proyecto) → Permitir*. Es normal: necesita leer Drive y escribir la hoja.
3. Volvé a la hoja: aparecen las pestañas **Credenciales** y **Revisar**, y el menú **Credenciales**.
4. Mirá la pestaña **Revisar**. Ahí figuran los casos que necesitan atención, por ejemplo estados SAP que no están en *Estados CPIC.xlsx*.
5. Menú *Credenciales → Programar sincronización diaria* (todos los días a las 6 h).

## Paso 4 — Publicar el script como aplicación web

1. En Apps Script: *Implementar → Nueva implementación → Aplicación web*.
   - Ejecutar como: **Yo**. Así las fotos y la Base siguen privadas; el script las lee con tu acceso.
   - Quién tiene acceso: **Cualquier persona**.
2. Copiá la **URL de la aplicación web** (termina en `/exec`).
3. En GitHub, editá `credencial/config.js`, pegá la URL en `API_URL` y hacé *Commit changes*.

Si más adelante cambiás el código: *Implementar → Gestionar implementaciones → lápiz → Versión: nueva versión*. Así la URL no cambia.

## Paso 5 — Probar y publicar el acceso

No se envía nada por correo. Cada profesional entra solo, desde un único link.

1. Abrí `https://cpic-apps.github.io/apps/credencial/` en el celular.
2. Cargá **número de matrícula**, **registro** (Universitario / Técnico) y **DNI**. Si coinciden con la Base, aparece la credencial.
3. El dispositivo la recuerda: la próxima vez abre directo. Se puede *Agregar a la pantalla de inicio*.
4. Escaneá el QR con otro teléfono para ver la verificación.
5. Cuando esté validado, publicá ese link en la web del CPIC, por ejemplo con un botón **"Mi credencial digital"**.

**Seguridad del ingreso**
- Tienen que coincidir los tres datos. La misma matrícula en el registro universitario y en el técnico corresponde a personas distintas, y cada una accede sólo a la suya.
- Tras **5 intentos fallidos** sobre una misma matrícula, el ingreso se bloquea **30 minutos** (`INTENTOS_MAX` y `MINUTOS_BLOQUEO` en `CONFIG`).
- A los registros en estado **Fallecido** no se los deja ingresar.
- Para atención presencial, *Credenciales → Ver link personal* muestra el link directo de la fila seleccionada.

## Uso diario

- **Altas, bajas, suspensiones:** se cargan en SAP como siempre. Al día siguiente, cuando se actualiza la Base, la credencial lo refleja sola.
- **Nueva foto:** se sube a la carpeta con el nombre `{Código SN}_foto.jpg`. Si hay dos fotos para el mismo SN, se usa la más reciente.
- **Celular perdido o credencial compartida:** seleccioná la fila y usá *Anular y regenerar credenciales*. El profesional vuelve a ingresar con sus datos.
- **Importante al actualizar la Base:** reemplazá el archivo con *Administrar versiones → Subir nueva versión* (o sobrescribiéndolo con el mismo nombre desde Drive para escritorio). Si se sube como archivo nuevo, cambia su ID y hay que actualizarlo en `CONFIG.ID_BASE`.

## Antes del lanzamiento

- Validar con el área legal los datos expuestos. El DNI y la foto se ven sólo en la credencial personal; la verificación pública muestra nombre, matrícula, título y estado.
- Opcional: dominio propio (ej. `credencial.cpic.org.ar`) en GitHub *Settings → Pages → Custom domain*, con un registro CNAME en el dominio del CPIC. Después se actualiza `URL_CREDENCIAL` en el script.

## Estados de la credencial

El script toma la columna *Estado Credencial* de *Estados CPIC.xlsx*. Para un estado SAP nuevo (por ejemplo BR) alcanza con agregar su fila en ese Excel: se aplica en la siguiente sincronización, sin tocar el código.

| Estado Credencial | Cómo se ve |
|---|---|
| Activo | Válida — "MATRÍCULA ACTIVA" (verde) |
| Vitalicio | Válida — "MATRÍCULA VITALICIA" (verde) |
| Adherente | Válida — "ADHERENTE" (azul) |
| Fallecido | Sin validez — banda "FALLECIDO"; no puede ingresar |
| No Activo | Sin validez — banda "MATRÍCULA NO ACTIVA" |

Un valor distinto de estos se muestra como No Activo y aparece en la pestaña *Revisar*. Para sumar otro estado válido, agregarlo en `CONFIG.ESTADOS_VIGENTES`.
