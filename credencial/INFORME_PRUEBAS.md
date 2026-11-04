# Credencial digital CPIC — Informe de pruebas de calidad

**Fecha:** 04/11/2026 · **Versión probada:** paquete `credencial-digital-cpic.zip` de esta fecha
**Datos de prueba:** *Base matriculado.xlsx* (versión del 04/11/2026 11:03, 30.803 registros) y *Estados CPIC.xlsx*

## Resultado

| Área | Pruebas | Resultado inicial | Resultado final |
|---|---|---|---|
| Datos de la Base | 9 controles | 6 observaciones | Quedan avisadas en la pestaña *Revisar* |
| Script (lógica y casos límite) | 19 | 6 defectos | **19/19 OK** |
| Páginas (navegador) | 42 | 4 fallas | **42/42 OK** |

## Defectos encontrados y corregidos

| # | Severidad | Defecto | Corrección |
|---|---|---|---|
| 1 | Alta | Durante la sincronización diaria, la hoja se vaciaba unos segundos. Quien abría su credencial en ese momento perdía el acceso guardado y debía volver a ingresar. | La hoja se sobrescribe en el lugar, sin vaciarla. Además, la página reintenta una vez antes de pedir el ingreso. |
| 2 | Alta | Google Sheets podía convertir el DNI "28.456.789" en número (perdiendo los puntos) y los códigos o fechas en otros formatos. | Todas las celdas se escriben como texto. |
| 3 | Media | Riesgo de que las fechas se corrieran un día por diferencia de zona horaria entre el Excel convertido y el script. | Las fechas se convierten con la zona horaria del archivo de origen. |
| 4 | Media | Un error momentáneo del servidor borraba la credencial guardada en el celular. | Se trata como "sin conexión" y se muestra la última credencial guardada. |
| 5 | Media | Con muchos accesos simultáneos (por ejemplo, el día del lanzamiento), cada consulta leía la hoja completa. | Se guardan en caché las respuestas por 10 minutos y las fotos por 6 horas. La caché se renueva al sincronizar o al anular una credencial. |
| 6 | Media | Si el DNI venía cargado como CUIT o CUIL (11 dígitos), no se mostraba bien y la persona no podía ingresar. | Se extrae el DNI del CUIT/CUIL automáticamente. |
| 7 | Baja | Apellidos de 31 caracteres se salían 2 pt de su espacio. | Reducción de letra más amplia (hasta 40 %). |
| 8 | Baja | El QR no se leía a baja resolución (pantallas 1x). | El QR pasó de 92 a 120 px. Se verificó que decodifica con la URL real de GitHub Pages. |
| 9 | Baja | La imagen del QR no tenía texto alternativo (accesibilidad). | Se agregó el texto alternativo. |
| 10 | Baja | El estado ("MATRÍCULA ACTIVA") se cortaba en dos renglones en celulares angostos. | Ajuste de tamaño; queda siempre en un renglón. |
| 11 | Baja | Apellidos o nombres con espacios dobles. | Se normalizan los espacios. |

## Pruebas superadas (resumen)

**Script, con la Base real**
- Genera las 30.803 credenciales.
- Los 61.606 códigos son únicos.
- Una segunda sincronización no cambia ningún código.
- El ingreso requiere matrícula + registro + DNI. Se aceptan puntos y ceros a la izquierda.
- Si se elige el registro equivocado, se rechaza.
- Cuando la misma matrícula existe en el registro universitario y en el técnico, cada persona accede sólo a la suya.
- Se bloquea a los 5 intentos fallidos, incluso si el sexto trae el DNI correcto.
- Los fallecidos no pueden ingresar.
- La verificación pública no expone DNI ni foto.
- Códigos con formatos inválidos o intentos de inyección se rechazan.

**Páginas**
- Sin desbordes en 320, 360, 390, 768 y 1280 px.
- Textos con el largo máximo real de la Base (apellido 31, nombre 41, título 73 y emisor 78 caracteres) quedan dentro de su espacio.
- El QR se decodifica y apunta a la verificación correcta.
- Funcionamiento sin conexión.
- Datos con código HTML se muestran como texto, sin ejecutarse.
- El ingreso se puede completar sólo con teclado.
- Accesibilidad WCAG 2 AA sin errores, en modo claro y oscuro.
- Sin errores de JavaScript.
- Peso de la credencial: 171 KB.

## Observaciones de datos (para corregir en SAP)

Aparecen en la pestaña *Revisar* después de cada sincronización.

| Observación | Cantidad | Efecto |
|---|---|---|
| Activos con DNI vacío o de menos de 6 dígitos | 11 | **No pueden ingresar** a su credencial hasta corregir el DNI |
| Activos con DNI de 9 dígitos | 6 | Deben ingresar ese número tal cual; conviene verificarlo |
| Registros sin número de matrícula | 16 (3 activos: SN 302841, 90831, 90942) | La credencial sale sin matrícula |
| Activos sin título predeterminado | 3 | La credencial sale sin título |
| Activos sin Apellido/Nombre separados | 3 | Se muestra el *Nombre SN* completo |
| Misma matrícula y registro en dos personas activas distintas | 37 casos (80 personas) | Cada uno ve su propia credencial, pero con el mismo número |
| Título con fecha posterior a la matriculación | 166 | Se muestran tal cual |
| Nombres sin tildes en SAP (ej. "Maria") | general | Se muestran como están en SAP |

## Pendiente de probar en Google (no se puede simular)

1. Primera sincronización real: tiempo total y permisos sobre la unidad compartida y la carpeta de fotos.
2. Conversión de los Excel con el servicio Drive API.
3. Lectura de fotos reales.
4. Funcionamiento desde GitHub Pages hacia la aplicación web publicada.
5. Instalación en la pantalla de inicio en Android y iPhone.

**Límite a tener en cuenta:** Google admite hasta ~30 consultas simultáneas por script. La caché reduce mucho la carga, pero conviene escalonar la difusión del link (por ejemplo, por newsletter y redes en días distintos).

## Riesgos aceptados

- Quien conozca la matrícula y el DNI de un profesional puede ver su credencial. Se puede reforzar pidiendo la fecha de nacimiento.
- Alguien podría bloquear el ingreso de una matrícula durante 30 minutos haciendo intentos fallidos a propósito.
- En el celular quedan guardados los datos de la última credencial vista, para que funcione sin conexión. El botón "No soy yo" los borra.
