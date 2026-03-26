# Project Full Validation Checklist

Checklist completo para validação funcional e técnica do backend.

Data base: 2026-03-26

## 1) Build, qualidade e execução

- [ ] `npm run lint` sem erros
- [ ] `npx tsc -p tsconfig.build.json` sem erros
- [ ] `npm test -- --runInBand` sem falhas
- [ ] `npm run test:e2e -- --runInBand` sem falhas
- [ ] `npm run build` sem falhas (incluindo `prisma generate`)
- [ ] `npm run start:dev` sobe sem erro
- [ ] `GET /docs` abre swagger corretamente

## 2) Banco e Prisma

- [ ] `prisma/schema.prisma` alinhado com migrations existentes
- [ ] `npx prisma migrate status` sem drift
- [ ] `npx prisma generate` sem erro de engine
- [ ] `npm run prisma:seed` executa sem falhar
- [ ] Índices críticos presentes (`status`, `trainingStatus`, datas e relacionamentos)
- [ ] Integridade de relações em cenários de delete/update (`onDelete`, `onUpdate`) validada

## 3) Segurança e autenticação

- [ ] Endpoints públicos somente os esperados (`/auth/login`, `/auth/refresh`, `/auth/forgot-password`, `/auth/reset-password`)
- [ ] JWT inválido retorna 401
- [ ] Usuário `INACTIVE` não autentica
- [ ] Fluxo refresh invalida token antigo
- [ ] Fluxo reset de senha invalida sessões anteriores
- [ ] Regras de role/scope aplicadas (SUPER_ADMIN, ADMIN, PASTOR, COORDENADOR, LIDER, SERVO)
- [ ] Usuário SERVO sem `servantId` bloqueado onde aplicável

## 4) Contrato de status de servo

- [ ] `trainingStatus` consistente entre listagem, detalhe e endpoints de perfil
- [ ] `statusRaw` presente em `/servants*` (status de domínio)
- [ ] `statusView` presente para consumo de UI simplificado
- [ ] `PATCH /servants/:id/training/complete` sincroniza regra de domínio (quando aplicável)
- [ ] `PATCH /servants/:id` com `trainingStatus=COMPLETED` sem status explícito mantém consistência
- [ ] Frontend usa regra canônica descrita em `SERVANT_STATUS_CONTRACT.md`

## 5) Módulo Auth (`/auth`)

- [ ] `POST /auth/login`
- [ ] `POST /auth/refresh`
- [ ] `POST /auth/logout`
- [ ] `POST /auth/forgot-password`
- [ ] `POST /auth/reset-password`
- [ ] `GET /auth/me`
- [ ] `POST /auth/change-password`

## 6) Módulo Me (`/me`)

- [ ] `GET /me`
- [ ] `PATCH /me`
- [ ] `PATCH /me/password`
- [ ] `GET /me/servant`
- [ ] `PATCH /me/servant`
- [ ] `GET /me/schedules`
- [ ] `GET /me/attendance`
- [ ] `GET /me/notifications`
- [ ] `PATCH /me/notifications/:id/read`
- [ ] `GET /me/availability`
- [ ] `PUT /me/availability`
- [ ] `PATCH /me/schedule-assignments/:id/respond`

## 7) Módulo Users (`/users`)

- [ ] `GET /users`
- [ ] `GET /users/eligible`
- [ ] `GET /users/:id`
- [ ] `POST /users`
- [ ] `PATCH /users/:id`
- [ ] `PATCH /users/:id/status`
- [ ] `PATCH /users/:id/reset-password`
- [ ] `POST /users/:id/reset-password`
- [ ] `PATCH /users/:id/role`
- [ ] `PATCH /users/:id/scope`
- [ ] `PATCH /users/:id/servant-link`
- [ ] `PATCH /users/:id/link-servant`
- [ ] `PATCH /users/:id/unlink-servant`
- [ ] `DELETE /users/:id`

## 8) Módulo Servants (`/servants`)

- [ ] `GET /servants`
- [ ] `GET /servants/eligible`
- [ ] `GET /servants/:id`
- [ ] `POST /servants`
- [ ] `POST /servants/with-user`
- [ ] `PATCH /servants/:id`
- [ ] `PATCH /servants/:id/status`
- [ ] `PATCH /servants/:id/link-user`
- [ ] `POST /servants/:id/create-user-access`
- [ ] `GET /servants/:id/history`
- [ ] `PATCH /servants/:id/training/complete`

## 9) Módulo Teams (`/teams`)

- [ ] `GET /teams`
- [ ] `GET /teams/:id`
- [ ] `POST /teams`
- [ ] `PATCH /teams/:id`
- [ ] `DELETE /teams/:id`
- [ ] `GET /teams/:id/members`
- [ ] `POST /teams/:id/members/:servantId`
- [ ] `DELETE /teams/:id/members/:servantId`
- [ ] `PATCH /teams/:id/leader`

## 10) Módulo Sectors (`/sectors`)

- [ ] `GET /sectors`
- [ ] `GET /sectors/:id`
- [ ] `POST /sectors`
- [ ] `PATCH /sectors/:id`
- [ ] `GET /sectors/:id/servants`

## 11) Módulo Worship Services (`/worship-services`)

- [ ] `GET /worship-services`
- [ ] `GET /worship-services/:id`
- [ ] `POST /worship-services`
- [ ] `PATCH /worship-services/:id`

## 12) Módulo Schedules (`/schedules`)

- [ ] `GET /schedules`
- [ ] `GET /schedules/:id/history`
- [ ] `POST /schedules`
- [ ] `POST /schedules/generate-month`
- [ ] `POST /schedules/generate-period`
- [ ] `POST /schedules/generate-service`
- [ ] `POST /schedules/generate-services`
- [ ] `POST /schedules/generate-year`
- [ ] `POST /schedules/swap`
- [ ] `PATCH /schedules/:id`
- [ ] `POST /schedules/:id/duplicate`
- [ ] `GET /schedules/swap-history`

## 13) Módulo Attendances (`/attendances`)

- [ ] `GET /attendances`
- [ ] `POST /attendances/check-in`
- [ ] `POST /attendances/batch`
- [ ] `PATCH /attendances/:id`

## 14) Módulo Pastoral Visits (`/pastoral-visits`)

- [ ] `GET /pastoral-visits`
- [ ] `POST /pastoral-visits`
- [ ] `PATCH /pastoral-visits/:id/resolve`
- [ ] `GET /pastoral-visits/servant/:servantId/history`

## 15) Módulo Talents (`/talents`)

- [ ] `GET /talents`
- [ ] `POST /talents`
- [ ] `PATCH /talents/:id/stage`
- [ ] `PATCH /talents/:id/approve`

## 16) Módulo Reports (`/reports`)

- [ ] `GET /reports/attendance`
- [ ] `GET /reports/absences`
- [ ] `GET /reports/pastoral-visits`
- [ ] `GET /reports/talents`

## 17) Módulo Dashboard (`/dashboard`)

- [ ] `GET /dashboard/summary`
- [ ] `GET /dashboard/alerts`

## 18) Módulo Audit (`/audit`)

- [ ] `GET /audit`
- [ ] Eventos de auditoria criados nos fluxos críticos

## 19) Módulo Notifications

### Notifications base (`/notifications`)

- [ ] `GET /notifications`
- [ ] `PATCH /notifications/:id/read`
- [ ] `PATCH /notifications/read-all`

### Templates (`/notifications/templates`)

- [ ] `GET /notifications/templates`
- [ ] `GET /notifications/templates/:id`
- [ ] `POST /notifications/templates`
- [ ] `PATCH /notifications/templates/:id`
- [ ] `PATCH /notifications/templates/:id/activate`
- [ ] `PATCH /notifications/templates/:id/deactivate`
- [ ] `DELETE /notifications/templates/:id`

### WhatsApp (`/notifications/whatsapp`)

- [ ] `POST /notifications/whatsapp/test-send`
- [ ] `POST /notifications/whatsapp/queue/process`
- [ ] `GET /notifications/whatsapp/logs`

### Notification settings (`/notifications/settings`)

- [ ] `GET /notifications/settings/whatsapp-global`
- [ ] `PATCH /notifications/settings/whatsapp-global`
- [ ] `GET /notifications/settings/operational`
- [ ] `PATCH /notifications/settings/operational`

## 20) Módulo Settings (`/settings`)

- [ ] `GET /settings/global`
- [ ] `PATCH /settings/global`
- [ ] `GET /settings/operational`
- [ ] `PATCH /settings/operational`

## 21) Smoke de regressão de permissões (alto impacto)

- [ ] SUPER_ADMIN acessa todos os módulos
- [ ] ADMIN respeita bloqueios de SUPER_ADMIN quando aplicável
- [ ] COORDENADOR limitado por setor
- [ ] LIDER limitado por equipe
- [ ] SERVO limitado ao próprio contexto (`SELF`)
- [ ] Endpoints de leitura não vazam dados fora de escopo

## 22) Observabilidade e operação

- [ ] Erros retornam payload padronizado pelo filtro global
- [ ] Logs de erro capturam contexto suficiente
- [ ] Notificações críticas geram audit trail
- [ ] Sem warnings críticos de depreciação bloqueando produção

## 23) Pronto para release

- [ ] Checklist completo validado em ambiente de homologação
- [ ] Evidências salvas (requests/responses, prints do Swagger, logs)
- [ ] Riscos residuais documentados com owner e prazo
- [ ] Go/No-Go formal registrado

