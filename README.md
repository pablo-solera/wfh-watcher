# wfh-watcher

Bot de Telegram que avisa cuando una persona (por defecto Ignacio Vera) cambia su teletrabajo en
**work-from-home**, y envía un calendario del mes con:

- 🟧 **naranja**: el día original (el que deja de ser teletrabajo).
- 🟩 **verde**: el día nuevo.

Si el cambio cruza de mes, se envían dos calendarios en un álbum.

## Cómo funciona

work-from-home no usa websockets: Postgres emite `pg_notify('wfh_request_changed', ...)` al crear o
decidir una solicitud, y la web lo reparte por SSE. El bot hace lo mismo que el servidor de la web:
`LISTEN wfh_request_changed`, y cuando el aviso es de la persona vigilada consulta sus solicitudes
**aceptadas** (`wfh_change_requests` + `wfh_change_request_dates`):

| Tipo | Naranja | Verde |
|---|---|---|
| Sustitución | `replaced_date` | `requested_date` |
| Anulación | `requested_date` | — |
| Adicional (al aprobarse) | — | `requested_date` |

Cada 5 minutos (y al reconectar) repasa por si se perdió algún aviso. Los avisos ya enviados se
guardan en `data/state.json` para no repetirlos.

> No cubre las ediciones directas de un admin/coordinador en el calendario: esas no emiten ningún
> `NOTIFY` en work-from-home.

## Configuración

Copia `.env.example` a `.env` y rellénalo. Si aún no sabes tu chat ID, arranca sin `TELEGRAM_CHAT_ID`
y escribe `/start` al bot.

Se recomienda un usuario de Postgres de solo lectura sobre `users`, `wfh_change_requests` y
`wfh_change_request_dates`.

## Uso

```bash
npm install
npm run bot          # desarrollo
npm run calendar -- 2026-11-23 2026-11-25   # genera tmp/calendario-N.png sin Telegram
npm run build && npm start
```

Comandos del bot: `/start` (muestra el chat ID) y `/estado`.

## Docker y publicación

Imagen basada en Node 26 (LTS). En producción va como un servicio más dentro del
`docker-compose.yml` de work-from-home, con la imagen `<usuario>/wfh-watcher` de DockerHub.

El `docker-compose.yml` de este repo es solo para desarrollo (`docker compose up -d --build`) y se une
a la red externa `work-from-home_default` (cámbiala con `WFH_NETWORK`).

### Publicar una versión

La imagen se construye y se sube a DockerHub al **subir un tag** `vX.Y.Z`
(`.github/workflows/docker-image.yml`). El tag debe coincidir con la `version` de `package.json`, o el
workflow falla. Se publican `vX.Y.Z` y `latest`; las pre-releases (`-rc.1`...) no tocan `latest`.

Requiere en GitHub la variable `DOCKERHUB_USERNAME` y el secreto `DOCKERHUB_TOKEN`.
