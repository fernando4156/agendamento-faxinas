# Fluxos do n8n — explicação nó a nó

Os dois arquivos JSON desta pasta são workflows prontos para **importar** no n8n
(`...` → *Import from File*). Abaixo está o que cada nó faz e o que você precisa configurar.

> ℹ️ Os parâmetros foram escritos para o n8n atual. Se a versão do node do Google Calendar
> mudar os nomes dos campos, ajuste na interface — a lógica permanece a mesma.

---

## 1) `01-agendamento-faxina.json` — Agendamento + Notificação

**Fluxo:** `Webhook → Preparar Dados → Google Calendar (criar) → Evolution API (WhatsApp) → Responder`

| # | Nó | Tipo | O que faz |
|---|----|------|-----------|
| 1 | **Webhook - Novo Agendamento** | `webhook` | Recebe `POST` em `/webhook/agendamento-faxina` com o corpo do formulário. Responde usando o nó "Responder". |
| 2 | **Preparar Dados** | `code` | Normaliza os campos recebidos (`nome`, `data`, `endereco`, `contato`), monta os horários ISO do bloco (08:00–12:00, fuso `-03:00`), formata a data em pt-BR e **monta o texto da mensagem** do WhatsApp. |
| 3 | **Google Calendar - Criar Evento** | `googleCalendar` | Cria o evento (`summary`, `location`, `description`, `start`, `end`). |
| 4 | **Evolution API - Enviar WhatsApp** | `httpRequest` | `POST` para `http://evolution-api:8080/message/sendText/{instancia}` com `{ "number": "...", "text": "..." }`. |
| 5 | **Responder a Cliente** | `respondToWebhook` | Devolve `{ "status": "ok" }` para o formulário. |

### Corpo esperado pelo webhook

```json
{
  "nome": "Maria Silva",
  "data": "2026-11-20",
  "endereco": "Rua das Flores, 123 - Centro",
  "contato": "5541999998888"
}
```

### Campos que você deve editar após importar

1. **Webhook** — copie a *Production URL* e use no frontend (ex.: `.../webhook/agendamento-faxina`).
2. **Preparar Dados** — se quiser mudar o bloco de horário, altere as linhas `inicioISO` / `fimISO`.
3. **Google Calendar - Criar Evento** — troque `SEU_CALENDAR_ID@group.calendar.google.com` pelo ID real e vincule a credencial OAuth2.
4. **Evolution API - Enviar WhatsApp**
   - URL: mantenha `http://evolution-api:8080` (nome do serviço na rede do Docker) e troque `faxinas` pelo nome da instância.
   - Número: troque `5511999999999` pelo WhatsApp da sua mãe (só dígitos, com `55`).
   - **Autenticação:** crie uma credencial do tipo **Header Auth** com `Name = apikey` e `Value = AUTHENTICATION_API_KEY`. Assim a chave fica no cofre do n8n, **não** no JSON.

### Diagrama da mensagem gerada

```
📅 Novo Agendamento de Faxina!
👤 Cliente: Maria Silva
📆 Data: sexta-feira, 20 de novembro de 2026
📍 Endereço: Rua das Flores, 123 - Centro
```

---

## 2) `02-cancelamento-faxina.json` — Cancellation

**Fluxo:** `Webhook → Preparar Busca → Google Calendar (buscar dia) → Filtrar Evento → Google Calendar (excluir) → Montar Mensagem → Evolution (WhatsApp) → Responder`

| # | Nó | Tipo | O que faz |
|---|----|------|-----------|
| 1 | **Webhook - Cancelamento** | `webhook` | `POST` em `/webhook/cancelamento-faxina` com `{ "nome", "data" }`. |
| 2 | **Preparar Busca** | `code` | Valida a data e monta o intervalo do dia inteiro (`00:00`–`23:59`). |
| 3 | **Google Calendar - Buscar Eventos do Dia** | `googleCalendar` | Lista todos os eventos do dia. |
| 4 | **Filtrar Evento da Cliente** | `code` | Mantém o evento cujo título contém o nome da cliente (case-insensitive). Erra se não achar. |
| 5 | **Google Calendar - Excluir Evento** | `googleCalendar` | Exclui o evento pelo `id` → **libera a data**. |
| 6 | **Montar Mensagem de Cancelamento** | `code` | Monta o texto de cancelamento. |
| 7 | **Evolution API - Avisar Cancelamento** | `httpRequest` | Envia o aviso no WhatsApp da sua mãe. |
| 8 | **Responder a Cliente** | `respondToWebhook` | Devolve `{ "status": "ok" }`. |

### Corpo esperado pelo webhook

```json
{ "nome": "Maria Silva", "data": "2026-11-20" }
```

### Mensagem gerada

```
❌ Agendamento Cancelado
👤 Cliente: Maria Silva
📆 Data: 2026-11-20

✅ Esse dia ficou LIVRE na sua agenda!
```

---

## 3) `03-slots-livres.json` — Get Free Slots (disponibilidade)

**Fluxo:** `Webhook → Calcular Mes → Google Calendar (buscar mês) → Formatar Dias Ocupados → Responder`

É o fluxo que o **frontend** chama para saber quais datas estão reservadas e **desativá-las** no calendário.

| # | Nó | Tipo | O que faz |
|---|----|------|-----------|
| 1 | **Webhook - Slots Livres** | `webhook` | Responde `GET /webhook/slots-livres?mes=YYYY-MM`. |
| 2 | **Calcular Mes** | `code` | Lê `?mes`, valida (default = mês atual) e monta o intervalo `timeMin`/`timeMax` (fuso `-03:00`) + a lista de todos os dias do mês. |
| 3 | **Google Calendar - Buscar Eventos do Mes** | `googleCalendar` | Lista eventos do mês (`returnAll`, `singleEvents`, `orderBy=startTime`). Tem `alwaysOutputData` para funcionar mesmo sem eventos. |
| 4 | **Formatar Dias Ocupados** | `code` | Extrai a data de início de cada evento (`date` ou `dateTime`) e devolve `diasOcupados` e `diasLivres`. |
| 5 | **Responder Slots** | `respondToWebhook` | Devolve JSON + cabeçalhos **CORS**. |

### Resposta

```json
{
  "mes": "2026-11",
  "diasOcupados": ["2026-11-05", "2026-11-20"],
  "diasLivres": ["2026-11-01", "2026-11-02", "..."]
}
```

O frontend usa `diasOcupados` para pintar de vermelho e desativar o clique.

---

## 🔗 CORS e o corpo "text/plain"

O frontend roda em outra origem (ex.: `http://localhost:5500`), então dois cuidados foram tomados:

1. **`GET` dos slots:** os nós de resposta enviam `Access-Control-Allow-Origin: *` (via *response headers*).
2. **`POST` de agendamento/cancelamento:** o frontend envia o corpo como `Content-Type: text/plain` (um tipo "simples", que **não** dispara *preflight* `OPTIONS`). Por isso os nós `code` fazem `JSON.parse` quando o corpo chega como texto.

> Se você publicar o frontend atrás de um domínio próprio, pode trocar `*` pelo domínio exato na lista de origens permitidas.

---

## 🔌 Rede interna do Docker

Dentro da rede `faxina-net`, os serviços se enxergam pelo **nome do serviço**:

- n8n → Evolution API: `http://evolution-api:8080`
- Evolution API e n8n → Postgres: `postgres:5432`
- Evolution API → Redis: `redis:6379`

Por isso a URL usada nos nós HTTP **não** é `localhost` (dentro do container `localhost` é o próprio container).
