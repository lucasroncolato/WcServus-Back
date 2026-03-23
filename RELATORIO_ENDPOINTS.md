# Relatorio de Endpoints

Data de geracao: 2026-03-23

## Observacoes Gerais
- Framework: NestJS
- Prefixo global de rota: nenhum (`app.setGlobalPrefix` nao foi configurado)
- Endpoint de documentacao Swagger: `GET /docs`
- Total de endpoints de API mapeados: **60**

## Auth (`/auth`)
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `GET /auth/me`
- `POST /auth/change-password`

## Users (`/users`)
- `GET /users`
- `GET /users/:id`
- `POST /users`
- `PATCH /users/:id`
- `PATCH /users/:id/status`
- `PATCH /users/:id/role`
- `PATCH /users/:id/servant-link`
- `DELETE /users/:id`

## Servants (`/servants`)
- `GET /servants`
- `GET /servants/:id`
- `POST /servants`
- `POST /servants/with-user`
- `PATCH /servants/:id`
- `PATCH /servants/:id/status`
- `PATCH /servants/:id/link-user`
- `GET /servants/:id/history`
- `PATCH /servants/:id/training/complete`

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
- `POST /schedules`
- `POST /schedules/generate-month`
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

## Reports (`/reports`)
- `GET /reports/attendance`
- `GET /reports/absences`
- `GET /reports/pastoral-visits`
- `GET /reports/talents`

## Talents (`/talents`)
- `GET /talents`
- `POST /talents`
- `PATCH /talents/:id/stage`
- `PATCH /talents/:id/approve`

## Dashboard (`/dashboard`)
- `GET /dashboard/summary`
- `GET /dashboard/alerts`

## Audit (`/audit`)
- `GET /audit`

## Endpoints Publicos
Como a autenticacao JWT e aplicada globalmente via `APP_GUARD`, os endpoints publicos sao apenas os anotados com `@Public()`:
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
