# Correo semanal del resumen — cambio en Apps Script

Cada lunes a las 12 m (hora de Colombia; en el plan Hobby de Vercel puede llegar entre las
12:00 y las 12:59) la app llama a `/api/resumen-correo`. Esa ruta arma el PDF del resumen de
todas las áreas y se lo manda a la **misma Web App de Apps Script** que hace la copia a Drive
(`DRIVE_WEBHOOK_URL`), con un campo extra `accion=correo`. La Web App es la que envía el
correo, desde la cuenta de Google dueña del script.

Campos que llegan (form-urlencoded): `token`, `accion=correo`, `para` (correos separados por
coma), `asunto`, `cuerpo`, `name` (nombre del PDF) y `file` (el PDF en base64).
La Web App debe responder exactamente `ok` si envió el correo.

## Pasos (una sola vez)

1. Abrir el proyecto de Apps Script de la copia a Drive (script.google.com, con la cuenta
   de Google dueña del script).
2. Pegar esta función al final del archivo:

   ```js
   // Correo semanal del resumen (lo llama /api/resumen-correo de Cronograma Ayurá).
   function enviarResumenPorCorreo(e) {
     var p = e.parameter;
     if (!p.para || !p.file || !p.name) return ContentService.createTextOutput('faltan datos');
     var pdf = Utilities.newBlob(Utilities.base64Decode(p.file), 'application/pdf', p.name);
     MailApp.sendEmail({
       to: p.para,
       subject: p.asunto || p.name,
       body: p.cuerpo || '',
       attachments: [pdf],
       name: 'Cronograma Ayurá',
     });
     return ContentService.createTextOutput('ok');
   }
   ```

3. Dentro de `function doPost(e)`, **justo después** de la línea que revisa el token
   (la que compara `e.parameter.token`), agregar:

   ```js
   if (e.parameter.accion === 'correo') return enviarResumenPorCorreo(e);
   ```

   Importante que vaya después de la revisión del token: así nadie sin el token puede
   usar el script para mandar correos.

4. Guardar y volver a publicar **la misma** implementación (para que la URL no cambie):
   Implementar → Gestionar implementaciones → ✏️ (editar) → Versión: **Nueva versión** →
   Implementar.
5. Google pedirá permiso para "Enviar correo electrónico en tu nombre": aceptar.

## En Vercel

- `RESUMEN_CORREO_PARA`: a quién llega (separado por comas). Hoy: `dcamacho@ayura.co`.
- Usa también `CRON_SECRET`, `DRIVE_WEBHOOK_URL` y `DRIVE_WEBHOOK_TOKEN`, que ya existen.

## Probar a mano

Con el valor de `CRON_SECRET`:

- Ver el PDF sin enviar nada:
  `GET /api/resumen-correo?anio=2026&semana=42&formato=pdf` con
  `Authorization: Bearer <CRON_SECRET>`.
- Enviar el correo de una semana concreta: la misma URL sin `formato=pdf`.

Si falla, el motivo queda en los logs de Vercel con el prefijo `[resumen-correo]`.
