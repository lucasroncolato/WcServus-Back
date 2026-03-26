# Contrato de Integracao - Notificacoes (Front x Back)

Base URL: `/`
Autenticacao: `Bearer <token>`

## 1) Configuracoes (FE-015)

### 1.1 Ler status global do WhatsApp
- `GET /notifications/settings/whatsapp-global`
- Perfis: `SUPER_ADMIN`

Resposta:
```json
{
  "key": "WHATSAPP_GLOBAL_ENABLED",
  "enabled": true,
  "updatedAt": "2026-03-24T15:00:00.000Z"
}
```

### 1.2 Atualizar status global do WhatsApp
- `PATCH /notifications/settings/whatsapp-global`
- Perfis: `SUPER_ADMIN`

Body:
```json
{
  "enabled": false
}
```

Resposta:
```json
{
  "key": "WHATSAPP_GLOBAL_ENABLED",
  "enabled": false,
  "updatedAt": "2026-03-24T15:02:00.000Z"
}
```

## 2) Templates (FE-016)

### 2.1 Listar templates
- `GET /notifications/templates?channel=WHATSAPP&eventKey=SCHEDULE_ASSIGNED&activeOnly=true`

Resposta:
```json
[
  {
    "id": "cm9...",
    "eventKey": "SCHEDULE_ASSIGNED",
    "channel": "WHATSAPP",
    "provider": "MOCK",
    "name": "Nova Escala",
    "content": "Ola {{userName}}, voce recebeu uma nova escala: {{message}}",
    "variables": null,
    "status": "ACTIVE",
    "createdAt": "2026-03-24T14:00:00.000Z",
    "updatedAt": "2026-03-24T14:00:00.000Z"
  }
]
```

### 2.2 Criar template
- `POST /notifications/templates`

Body:
```json
{
  "eventKey": "SCHEDULE_ASSIGNED",
  "channel": "WHATSAPP",
  "provider": "MOCK",
  "name": "Nova Escala",
  "content": "Ola {{userName}}, voce recebeu uma nova escala: {{message}}",
  "variables": {
    "userName": "string",
    "message": "string"
  },
  "status": "ACTIVE"
}
```

### 2.3 Editar template
- `PATCH /notifications/templates/:id`

### 2.4 Ativar/Inativar template
- `PATCH /notifications/templates/:id/activate`
- `PATCH /notifications/templates/:id/deactivate`

### 2.5 Excluir template
- `DELETE /notifications/templates/:id`

## 3) Logs de envio (FE-017)

### 3.1 Listar logs com filtros
- `GET /notifications/whatsapp/logs?page=1&limit=20&status=FAILED&eventKey=SCHEDULE_ASSIGNED&channel=WHATSAPP&dateFrom=2026-03-01T00:00:00.000Z&dateTo=2026-03-31T23:59:59.999Z`

Resposta:
```json
{
  "data": [
    {
      "id": "cm9...",
      "queueId": "cm9...",
      "eventKey": "SCHEDULE_ASSIGNED",
      "channel": "WHATSAPP",
      "provider": "MOCK",
      "status": "FAILED",
      "userId": "cm9...",
      "servantId": "cm9...",
      "recipientPhone": "5511999999999",
      "templateId": "cm9...",
      "payload": {
        "title": "Nova escala atribuida",
        "message": "Voce foi escalado para Culto Domingo.",
        "metadata": {
          "scheduleId": "cm9..."
        }
      },
      "providerMessageId": null,
      "error": "Meta Cloud provider is not configured",
      "attempt": 1,
      "sentAt": null,
      "createdAt": "2026-03-24T15:10:00.000Z"
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 1,
  "totalPages": 1
}
```

## 4) Envio manual de teste (FE-018)

### 4.1 Disparo de teste
- `POST /notifications/whatsapp/test-send`

Body:
```json
{
  "phone": "5511999999999",
  "message": "Mensagem de teste do modulo de WhatsApp.",
  "userId": "cm9...",
  "servantId": "cm9..."
}
```

Resposta:
```json
{
  "success": true,
  "provider": "MOCK",
  "providerMessageId": "mock-1711299999999",
  "error": null,
  "logId": "cm9..."
}
```

## 5) Fila (suporte operacional)

### 5.1 Processar fila manualmente
- `POST /notifications/whatsapp/queue/process`

Body:
```json
{
  "limit": 50
}
```

Resposta:
```json
{
  "processed": 10,
  "success": 8,
  "failed": 2
}
```

## 6) Canais e enums usados

- `NotificationChannel`: `IN_APP`, `WHATSAPP`
- `NotificationTemplateStatus`: `ACTIVE`, `INACTIVE`
- `NotificationDeliveryStatus`: `SUCCESS`, `FAILED`
- `NotificationQueueStatus`: `PENDING`, `PROCESSING`, `RETRYING`, `SENT`, `FAILED`
- `NotificationProvider`: `MOCK`, `META_CLOUD`

## 7) Mapeamento rapido para o front

- Configuracoes admin:
  - Ler: `GET /notifications/settings/whatsapp-global`
  - Salvar: `PATCH /notifications/settings/whatsapp-global`
  - Operacional (admin): `GET/PATCH /notifications/settings/operational`
  - Compat legado: `GET/PATCH /settings/global` e `GET/PATCH /settings/operational`
- Templates:
  - Fonte unica: `/notifications/templates`
- Logs:
  - Fonte: `/notifications/whatsapp/logs`
- Test send:
  - Fonte: `/notifications/whatsapp/test-send`
