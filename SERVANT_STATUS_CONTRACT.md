# Servant Status Contract (Backend -> Frontend)

Este documento padroniza como consumir status de servo nos endpoints principais.

## Campos canônicos

- `trainingStatus`: estado do treinamento (`PENDING` | `COMPLETED`).
- `statusRaw`: status real de domínio do servo no banco (`RECRUTAMENTO`, `RECICLAGEM`, `ATIVO`, `INATIVO`, `AFASTADO`).
- `statusView`: status simplificado para UI (`ACTIVE` | `INACTIVE`).

Regra prática para frontend:

1. Sempre usar `trainingStatus` para o estado de treinamento.
2. Usar `statusRaw` para regras de negócio detalhadas.
3. Usar `statusView` para badges simples de ativo/inativo.

## Endpoint: `GET /servants`

Retorna **array direto** de servos.

Exemplo (item):

```json
{
  "id": "srv_1",
  "name": "Servo 1",
  "statusRaw": "ATIVO",
  "status": "ACTIVE",
  "statusView": "ACTIVE",
  "trainingStatus": "COMPLETED"
}
```

## Endpoint: `GET /servants/:id`

Retorna **objeto direto** do servo.

Exemplo:

```json
{
  "id": "srv_1",
  "name": "Servo 1",
  "statusRaw": "RECICLAGEM",
  "status": "INACTIVE",
  "statusView": "INACTIVE",
  "trainingStatus": "PENDING"
}
```

## Endpoint: `GET /auth/me`

Retorna conta autenticada. O bloco `servant` contém status do servo.

Exemplo (recorte):

```json
{
  "id": "usr_1",
  "role": "SERVO",
  "servant": {
    "id": "srv_1",
    "name": "Servo 1",
    "status": "ATIVO",
    "statusView": "ACTIVE",
    "trainingStatus": "COMPLETED"
  }
}
```

## Endpoint: `GET /me`

Retorna perfil do usuário logado. O bloco `servant` contém status do servo.

Exemplo (recorte):

```json
{
  "id": "usr_1",
  "displayName": "Servo 1",
  "servant": {
    "id": "srv_1",
    "name": "Servo 1",
    "status": "ATIVO",
    "statusView": "ACTIVE",
    "trainingStatus": "COMPLETED"
  }
}
```

## Endpoint: `GET /users` e `GET /users/:id`

- `GET /users`: resposta paginada em `data`.
- `GET /users/:id`: objeto em `data`.
- Em ambos, quando houver servo vinculado, `data[].servant` (ou `data.servant`) inclui:

```json
{
  "id": "srv_1",
  "name": "Servo 1",
  "status": "ATIVO",
  "statusView": "ACTIVE",
  "trainingStatus": "COMPLETED"
}
```

## Recomendação de label "Em treinamento"

No frontend, para exibir "Em treinamento", usar:

```text
trainingStatus !== "COMPLETED"
```

Opcionalmente, se quiser reforçar elegibilidade:

```text
trainingStatus !== "COMPLETED" || statusRaw !== "ATIVO"
```

Isso evita divergência entre listagens, detalhe e perfil autenticado.
