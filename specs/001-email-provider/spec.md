# Spec 001 — Proveedor de correo conmutables (file / SMTP)

## Contexto y objetivo

Hoy todos los correos de la plataforma (verificación de registro, invitaciones,
reenvíos) se escriben a un archivo JSON local (`FileEmailSender`); no hay forma
de enviarlos de verdad sin tocar código. Hay un `SmtpEmailSender` borrador
comentado que no compila. Esta funcionalidad permite conmutar entre el emisor de
archivo (desarrollo/demo) y un emisor SMTP real (producción) cambiando una
variable de entorno, con validación temprana de la configuración.

## Clarifications

### Session 2026-11-23

- Q: ¿Qué profundidad quieres para la redacción de la constitución y la spec 001? → A: Migrar todo a la forma de Spec Kit (contenido y estructura según los templates oficiales de Spec Kit).
- Q: ¿Cómo debe expresarse en la constitución la relación entre la spec y el código existente (E1–E25 sin spec)? → A: Spec-first estricto para el legado: escribir la spec de todo el código existente antes de avanzar a código nuevo, redactada en conjunto, y numerada antes que cualquier otra spec (es lo primero que debió hacerse); luego se hace el plan; y en lugar de implementar, se revisa que el código cumple la spec.
- Q: ¿Qué alcance tiene la spec de la plataforma existente? → A: Una sola spec 001 de toda la plataforma en la que el email provider se integra (ambas pasan a ser la 001). Además, debe quedar claro en su lugar correspondiente que queremos que se definan sprints y vertical slices: eso es parte de cómo se conforman la spec, el plan y las tareas.
- Q: ¿Se añaden, quitan o modifican principios al migrar la constitución? → A: Mantener los 8 principios actuales. Se añade que el frontend es un cliente delgado y toda la lógica de negocio vive en el backend. Se añade que debe ser fácil importar EPCIS 2.0 de una empresa de terceros para meterlo y crear el historial (interoperabilidad EPCIS 2.0).
- Q: ¿Cómo tratar en la spec los requisitos nuevos no implementados (importación EPCIS 2.0 de terceros)? → A: Incluirlos en la spec 001 en una sección 'Requisitos nuevos / a implementar', claramente separada de los as-built; la revisión de cumplimiento los reporta como gaps conocidos que guían los próximos sprints.

## Usuarios / actores

- **Operador / DevOps** de la plataforma: configura el proveedor vía variables de
  entorno al desplegar.
- **Usuario final** (owner que registra su organización, miembros invitados):
  recibe los correos; no percibe el proveedor.

## Historias de usuario

- H1: Como DevOps quiero activar el envío real de correos con `EMAIL_PROVIDER=smtp`
  y mis credenciales SMTP, para que los usuarios reciban los emails de verdad.
- H2: Como desarrollador quiero que por defecto el sistema siga escribiendo el
  outbox local, para no depender de un servidor SMTP en desarrollo ni en la demo.
- H3: Como operador quiero que una configuración SMTP incompleta o un valor
  inválido de `EMAIL_PROVIDER` impidan arrancar la aplicación con un mensaje
  claro, para detectar el error al desplegar y no al primer email.

## Requisitos funcionales (criterios de aceptación en EARS)

- RF-1: EL SISTEMA envía cada correo usando el proveedor indicado por la
  variable de entorno `EMAIL_PROVIDER`; SI la variable no existe o su valor es
  `file`, EL SISTEMA usa el emisor de archivo y escribe cada correo como entrada
  JSON en el archivo `MAIL_OUTBOX_PATH` (por defecto `./.mail-outbox.json`),
  preservando la serialización de escrituras concurrentes.
- RF-2: CUANDO `EMAIL_PROVIDER=smtp`, EL SISTEMA envía cada correo por SMTP con
  los parámetros `SMTP_HOST`, `SMTP_PORT` (por defecto 587), `SMTP_SECURE`
  (por defecto `false`), `SMTP_USER` y `SMTP_PASS`, usando como remitente
  `SMTP_FROM` (por defecto `NodooTrace <no-reply@nodoo.local>`), mapeando
  `to`, `subject`, `text` e `html` del mensaje tal cual.
- RF-3: SI `EMAIL_PROVIDER=smtp` y falta o está vacía cualquiera de
  `SMTP_HOST`, `SMTP_USER` o `SMTP_PASS`, ENTONCES EL SISTEMA no arranca y
  muestra un error de validación que indica el nombre de cada variable
  faltante.
- RF-4: SI el valor de `EMAIL_PROVIDER` no es `file` ni `smtp`, ENTONCES EL
  SISTEMA no arranca y muestra un error de validación con los valores válidos.
- RF-5: SI el transporte SMTP falla al enviar (error de conexión,
  autenticación, etc.), ENTONCES EL SISTEMA rechaza la promesa de `send()` con
  el error del transporte, sin reintentos, y registra el fallo en el log; los
  flujos existentes (invitación, verificación) mantienen su comportamiento
  actual: la invitación se crea y la respuesta lleva `emailSent: false`.

## Requisitos no funcionales

- El emisor SMTP no persiste el contenido de los correos: solo una línea de
  log con el destinatario (el outbox JSON es exclusivo del proveedor `file`).
- El proveedor se elige una sola vez, al arrancar; cambiar la variable exige
  reiniciar la aplicación.
- Los tests de unidad no requieren servidor SMTP ni base de datos
  (mock de nodemailer).
- La suite e2e (que corre con el proveedor por defecto `file`) no debe
  modificarse por este cambio.

## Casos límite

- `EMAIL_PROVIDER=smtp` con solo `SMTP_HOST` definido → error de arranque
  indicando `SMTP_USER` y `SMTP_PASS`.
- `SMTP_PASS` definida como cadena vacía → se trata como faltante (RF-3).
- `SMTP_PORT` no numérico → error de validación de arranque.
- `EMAIL_PROVIDER` con valor distinto (`File`, `smtps`, vacío) → error de
  arranque (RF-4); el valor debe ser exactamente `file` o `smtp`.
- Fallo SMTP tras crear la invitación → la invitación queda registrada y el
  cliente recibe `emailSent: false` (no se revierte nada).

## Fuera de alcance

- Reintentos automáticos o cola de correos fallidos.
- Seguimiento de entrega / rebotes (webhooks, XSMTP, SES events).
- Cambios en las plantillas de correo o en la lógica de invitaciones /
  verificación.
- Configuración SMTP multi-tenant (un único servidor para toda la app).
- Tests de integración contra un servidor SMTP real (se usa mock en unidad;
  la demo manual usa un servidor local efímero).

## Criterios de finalización

- Todos los RF cubiertos por tests de unidad en verde
  (`pnpm --filter backend test`).
- `pnpm lint` y `pnpm build` en verde.
- Demo manual: (a) con `EMAIL_PROVIDER=file` (default) el outbox JSON se
  escribe; (b) con `EMAIL_PROVIDER=smtp` y un SMTP local de pruebas (p. ej.
  puerto 2525) el email llega; (c) con `EMAIL_PROVIDER=smtp` sin
  `SMTP_USER`/`SMTP_PASS` la app no arranca indicando las variables faltantes;
  (d) con `EMAIL_PROVIDER=carrier-pigeon` la app no arranca indicando los
  valores válidos.
- `pnpm --filter backend test:e2e` sin cambios y en verde.

## Dudas abiertas

- (ninguna: proveedor por defecto `file`, variables obligatorias `SMTP_HOST` /
  `SMTP_USER` / `SMTP_PASS` y conmutación por `EMAIL_PROVIDER` ya decididas)
