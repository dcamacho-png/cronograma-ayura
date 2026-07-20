# Respaldo diario del Excel maestro a Google Drive

Cada noche (23:59 hora Colombia) la app genera **un archivo Excel por área** en tu carpeta de Drive.
Cada archivo (`cumplimiento-<Área>.xlsx`) tiene una hoja **General** (toda la info del área) y una
**hoja por mes**. Se sobrescriben cada noche.

## 1. Crear la carpeta en Drive

1. En Google Drive, creá una carpeta (p. ej. "Respaldos cronograma").
2. Abrí la carpeta y mirá la URL: `https://drive.google.com/drive/folders/XXXXXXXX`.
   El `XXXXXXXX` es el **FOLDER_ID**. Anotalo.

## 2. Crear el Apps Script

1. Andá a https://script.google.com → **Nuevo proyecto**.
2. Borrá todo y pegá esto (reemplazá los dos valores de arriba):

```javascript
function doPost(e) {
  var TOKEN = 'PON_AQUI_UN_SECRETO_LARGO';       // inventá una cadena larga
  var FOLDER_ID = 'PON_AQUI_EL_FOLDER_ID';        // de la URL de la carpeta
  var NAME = (e.parameter.name || 'cumplimiento-maestro.xlsx');
  if (!e || !e.parameter || e.parameter.token !== TOKEN) {
    return ContentService.createTextOutput('unauthorized');
  }
  var bytes = Utilities.base64Decode(e.parameter.file);
  var blob = Utilities.newBlob(
    bytes,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    NAME
  );
  var folder = DriveApp.getFolderById(FOLDER_ID);
  var it = folder.getFilesByName(NAME);
  while (it.hasNext()) it.next().setTrashed(true); // sobrescribe (Drive guarda versiones)
  folder.createFile(blob);
  return ContentService.createTextOutput('ok');
}
```

3. **Implementar → Nueva implementación** → tipo **Aplicación web**:
   - "Ejecutar como": **Yo**.
   - "Quién tiene acceso": **Cualquier persona**.
   - Implementar → autorizá los permisos que pide (es tu propia cuenta).
4. Copiá la **URL de la app web** (termina en `/exec`). Ese es el `DRIVE_WEBHOOK_URL`.
   El `TOKEN` que pusiste arriba es el `DRIVE_WEBHOOK_TOKEN`.

> **Al ACTUALIZAR el código del Apps Script** (p. ej. esta versión que acepta `name`): pegá el
> código nuevo, guardá (💾) y **volvé a implementar** para que la URL `/exec` use la versión nueva:
> **Implementar → Administrar implementaciones → ✏️ (editar) → Versión: Nueva versión → Implementar**.
> La URL `/exec` NO cambia, así que no hay que tocar las variables en Vercel.

## 3. Variables de entorno en Vercel

En el proyecto `cronograma-ayura` → Settings → Environment Variables (Production, marcar
**Sensitive**):

- `DRIVE_WEBHOOK_URL` = la URL `/exec` de la Web App.
- `DRIVE_WEBHOOK_TOKEN` = el mismo TOKEN del script.
- `CRON_SECRET` = una cadena larga inventada (Vercel la usa para autorizar el cron).

O por CLI:

```bash
npx vercel@latest env add DRIVE_WEBHOOK_URL production
npx vercel@latest env add DRIVE_WEBHOOK_TOKEN production
npx vercel@latest env add CRON_SECRET production
```

## 4. Desplegar

```bash
npx vercel@latest deploy --prod
```

El cron (definido en `vercel.json`) solo se activa en despliegues de producción.

## 5. Verificar (manual, una vez)

Disparar la ruta con el secreto y confirmar que aparece el archivo en la carpeta:

```bash
curl -i -H "Authorization: Bearer <CRON_SECRET>" \
  https://cronograma-ayura.vercel.app/api/backup-drive
```

Esperado: `200` con `{"archivos":N,"areas":[...]}` y, en la carpeta de Drive, **un archivo por área**
(`cumplimiento-<Área>.xlsx`), cada uno con hoja `General` + hojas por mes en orden ascendente. (El
viejo `cumplimiento-maestro.xlsx` queda sin usar; se puede borrar a mano.)
