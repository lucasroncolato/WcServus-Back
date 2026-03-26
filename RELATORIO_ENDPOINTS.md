# Relatorio de Endpoints (Codigo Real)

Data de geracao: 2026-03-26
Fonte: controllers em `src/modules/**` + `src/health.controller.ts`

## Observacoes gerais
- Prefixo global de rota: nenhum
- Swagger: `GET /docs`
- Health publico: `GET /health`
- Auth publico: `POST /auth/login`, `POST /auth/refresh`, `POST /auth/forgot-password`, `POST /auth/reset-password`

## Auth (`/auth`)
- `POST /auth/login` (public)
- `POST /auth/refresh` (public)
- `POST /auth/logout`
- `POST /auth/forgot-password` (public)
- `POST /auth/reset-password` (public)
- `GET /auth/me`
- `POST /auth/change-password`

## Me (`/me`)
- `GET /me`
- `PATCH /me`
- `PATCH /me/password`
- `GET /me/servant`
- `PATCH /me/servant`
- `GET /me/schedules`
- `GET /me/attendance`
- `GET /me/notifications`
- `PATCH /me/notifications/:id/read`
- `GET /me/availability` (SERVO)
- `PUT /me/availability` (SERVO)
- `PATCH /me/schedule-assignments/:id/respond` (SERVO)

## Users (`/users`)
- `GET /users`
- `GET /users/eligible`
- `GET /users/:id`
- `POST /users`
- `PATCH /users/:id` (somente dados basicos: nome/email/telefone)
- `PATCH /users/:id/status`
- `PATCH /users/:id/reset-password`
- `POST /users/:id/reset-password` (compat)
- `PATCH /users/:id/role`
- `PATCH /users/:id/scope`
- `PATCH /users/:id/servant-link`
- `PATCH /users/:id/link-servant` (compat)
- `PATCH /users/:id/unlink-servant`
- `DELETE /users/:id`

## Servants (`/servants`)
- `GET /servants`
- `GET /servants/eligible`
- `GET /servants/:id`
- `POST /servants`
- `POST /servants/with-user`
- `PATCH /servants/:id`
- `PATCH /servants/:id/status`
- `PATCH /servants/:id/link-user`
- `POST /servants/:id/create-user-access`
- `GET /servants/:id/history`
- `PATCH /servants/:id/training/complete`

## Teams (`/teams`)
- `GET /teams`
- `GET /teams/:id`
- `POST /teams`
- `PATCH /teams/:id`
- `DELETE /teams/:id`
- `GET /teams/:id/members`
- `POST /teams/:id/members/:servantId`
- `DELETE /teams/:id/members/:servantId`
- `PATCH /teams/:id/leader`

## Sectors (`/sectors`)
- `GET /sectors`
- `GET /sectors/:id`
- `POST /sectors`
- `PATCH /sectors/:id`
- `GET /sectors/:id/servants`

## Worship Services (`/worship-services`)
- `GET /worship-services`
- `GET /worship-services/:id`
- `POST /worship-services`
- `PATCH /worship-services/:id`

## Schedules (`/schedules`)
- `GET /schedules`
- `GET /schedules/:id/history`
- `POST /schedules`
- `POST /schedules/generate-month`
- `POST /schedules/generate-period`
- `POST /schedules/generate-service`
- `POST /schedules/generate-services`
- `POST /schedules/generate-year`
- `POST /schedules/swap`
- `PATCH /schedules/:id`
- `POST /schedules/:id/duplicate`
- `GET /schedules/swap-history`

## Attendances (`/attendances`)
- `GET /attendances`
- `POST /attendances/check-in`
- `POST /attendances/batch`
- `PATCH /attendances/:id`

## Pastoral Visits (`/pastoral-visits`)
- `GET /pastoral-visits`
- `POST /pastoral-visits`
- `PATCH /pastoral-visits/:id/resolve`
- `GET /pastoral-visits/servant/:servantId/history`

## Talents (`/talents`)
- `GET /talents`
- `POST /talents`
- `PATCH /talents/:id/stage`
- `PATCH /talents/:id/approve`

## Reports (`/reports`)
- `GET /reports/attendance`
- `GET /reports/absences`
- `GET /reports/pastoral-visits`
- `GET /reports/talents`

## Dashboard (`/dashboard`)
- `GET /dashboard/summary`
- `GET /dashboard/alerts`

## Audit (`/audit`)
- `GET /audit`

## Notifications

### Base (`/notifications`)
- `GET /notifications`
- `PATCH /notifications/:id/read`
- `PATCH /notifications/read-all`

### Templates (`/notifications/templates`)
- `GET /notifications/templates`
- `GET /notifications/templates/:id`
- `POST /notifications/templates`
- `PATCH /notifications/templates/:id`
- `PATCH /notifications/templates/:id/activate`
- `PATCH /notifications/templates/:id/deactivate`
- `DELETE /notifications/templates/:id`

### WhatsApp (`/notifications/whatsapp`)
- `POST /notifications/whatsapp/test-send`
- `POST /notifications/whatsapp/queue/process`
- `GET /notifications/whatsapp/logs`

### Settings canonicos (`/notifications/settings`)
- `GET /notifications/settings/whatsapp-global`
- `PATCH /notifications/settings/whatsapp-global`
- `GET /notifications/settings/operational`
- `PATCH /notifications/settings/operational`

## Settings legacy/compat (`/settings`)
- `GET /settings/global` (compat)
- `PATCH /settings/global` (compat)
- `GET /settings/operational` (compat)
- `PATCH /settings/operational` (compat)

## Contrato canonico e legado
- Canonico de escopo: `scopeType + sectorIds + teamIds`
- Compatibilidade legada ainda aceita: `teamNames` (somente conversao para `teamIds`)
- Campos legados (`teamName`, `teamNames`, `classGroup`, `sectorTeam`) nao definem autorizacao
