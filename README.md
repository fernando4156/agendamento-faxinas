# 🧹 Agendamento de Faxinas — Fricção Zero

Sistema de agendamento de faxinas pensado para **quem executa o serviço ter o mínimo de atrito possível**.
Minha mãe **não faz login, não usa senha e não aprende software novo**: ela recebe tudo passivamente
no **WhatsApp** e gerencia a agenda pelo **Google Calendar**.

---

## 🏗️ Arquitetura

```
  Cliente (celular)
        │  preenche o formulário / clica em "cancelar"
        ▼
  ┌───────────────────┐   POST (JSON)   ┌────────────────────┐
  │  Frontend (HTML)  │ ──────────────► │   Webhook no n8n   │
  └───────────────────┘                 └─────────┬──────────┘
                                                  │
                        ┌─────────────────────────┼─────────────────────────┐
                        ▼                         ▼                         ▼
              ┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
              │ Google Calendar  │      │  Monta payload   │      │  Evolution API   │
              │ cria/exclui/ler │      │  da mensagem     │      │  (HTTP POST)     │
              └──────────────────┘      └──────────────────┘      └────────┬─────────┘
                                                                          ▼
                                                                  📱 WhatsApp da minha mãe
```

| Camada            | Tecnologia                                                  |
| ----------------- | ----------------------------------------------------------- |
| Interface cliente | HTML/CSS/JS ou formulário online → Webhook                  |
| Motor de automação| **n8n**                                                     |
| Banco de dados    | **Google Calendar** (disponibilidade + registro)            |
| Mensageria        | **Evolution API** (container Docker) → WhatsApp             |
| Infra             | Docker Compose: Postgres + Redis + Evolution + n8n          |

---

## 🔐 Regra de ouro de segurança

Este repositório é **público**. Portanto:

- ❌ **Nunca** existe chave, token ou senha fixa (hardcoded) no código.
- ✅ Tudo é lido de **variáveis de ambiente** (`.env`).
- ✅ O repositório traz apenas o **`.env.example`** com valores fictícios.
- ✅ O `.env` real, as **sessões do WhatsApp** e os **dados do n8n** são ignorados pelo `.gitignore`.

> ⚠️ Antes de qualquer `git add`, confira com `git status` que nenhum `.env`,
> `instances/` ou `node_modules/` está entrando no commit.

---

## 🚀 Como subir o ambiente

### Pré-requisitos
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado e rodando.

### Passo a passo

```bash
# 1) Clone o repositório
git clone https://github.com/fernando4156/agendamento-faxinas.git
cd agendamento-faxinas

# 2) Crie o .env a partir do modelo e preencha os valores reais
cp .env.example .env
#   (no Windows PowerShell: Copy-Item .env.example .env)

# 3) Suba a stack
docker compose up -d

# 4) Acompanhe os logs (opcional)
docker compose logs -f
```

Depois de subir, os serviços ficam em:

| Serviço             | URL                     | Para quê                                  |
| ------------------- | ----------------------- | ----------------------------------------- |
| **Site da cliente** | **http://localhost:8088** | Página que as clientes usam (via Caddy) |
| n8n                 | http://localhost:5678   | Editar os fluxos de automação (local)     |
| Evolution API       | http://localhost:8080   | Enviar mensagens (usada pelo n8n)         |
| Evolution Manager   | http://localhost:3000   | Opcional (`--profile manager`)            |

> 🌐 O **site** é servido pelo **Caddy** (serviço `proxy`), que também encaminha
> apenas `/webhook/*` para o n8n. O editor do n8n **não** fica exposto — é o
> serviço `proxy` que vai para a internet quando usamos um túnel.

### Expor na internet (para as clientes acessarem do celular)

```powershell
# com o stack no ar, abra o tunel publico:
.\scripts\abrir-tunel.ps1
```

O `cloudflared` vai imprimir uma URL pública (ex.: `https://algo.trycloudflare.com`).
Compartilhe essa URL com as clientes — já está com HTTPS.

> ⚠️ A URL do túnel "rápido" **muda** a cada reinício. Para uma URL **fixa**, é
> preciso um domínio próprio no Cloudflare (túnel nomeado) ou usar ngrok com
> domínio estático.

### Conectar o WhatsApp

> ⚠️ O **Evolution Manager** oficial (`evoapicloud/evolution-manager:latest`) está com um bug de nginx e entra em loop. Por isso ele agora é **opcional** (atrás de um *profile*) e usamos um gerador de QR próprio.

1. Com o stack no ar, rode:
   ```powershell
   .\scripts\abrir-qrcode.ps1
   ```
2. Abra **http://localhost:5500** no navegador.
3. Escaneie o QR com o WhatsApp (Aparelhos conectados → Conectar um aparelho). A página renova o QR sozinha.
4. Quando aparecer "Conectado com sucesso!", pronto.

Se preferir tentar o Manager oficial mesmo assim:
```powershell
docker compose --profile manager up -d
docker compose logs -f evolution-manager   # note que ele pode reiniciar em loop
```

---

## 🔄 Fluxos principais

Os fluxos ficam na pasta [`workflows/`](./workflows) e são **importáveis** no n8n
(*Import from File*).

| Arquivo                              | Fluxo                                  |
| ------------------------------------ | -------------------------------------- |
| `01-agendamento-faxina.json`         | Recebe o agendamento e avisa no WhatsApp |
| `02-cancelamento-faxina.json`        | Cancela e libera a data, avisando no WhatsApp |
| `03-slots-livres.json`               | Get Free Slots: informa as datas ocupadas ao frontend |
| `99-teste-whatsapp.json`             | **Teste isolado** do caminho do WhatsApp (sem Google Calendar) |

Detalhes de cada nó e como configurar: **[`docs/n8n-workflows.md`](./docs/n8n-workflows.md)**.

---

## 📁 Estrutura do repositório

```
agendamento-faxinas/
├── docker-compose.yml            # Postgres + Redis + Evolution API + n8n + Caddy
├── docker/
│   ├── init-db.sql               # cria os bancos "evolution" e "n8n"
│   └── Caddyfile                 # site publico + proxy so dos /webhook/*
├── .env.example                  # modelo de variáveis (valores fictícios)
├── .gitignore                    # blindagem de segredos e dados locais
├── workflows/
│   ├── 01-agendamento-faxina.json
│   ├── 02-cancelamento-faxina.json
│   ├── 03-slots-livres.json
│   └── 99-teste-whatsapp.json
├── frontend/
│   ├── index.html                # página da cliente (calendário + formulários)
│   ├── styles.css
│   ├── config.js                 # só URLs públicas (sem segredos)
│   └── app.js
├── scripts/
│   ├── testar-whatsapp.ps1       # dispara um teste do WhatsApp
│   ├── abrir-qrcode.ps1          # gera a página do QR Code (conectar WhatsApp)
│   ├── servir-frontend.ps1       # servidor estático (dev, sem proxy)
│   └── abrir-tunel.ps1           # abre o túnel público (Cloudflare)
├── docs/
│   └── n8n-workflows.md          # explicação nó a nó
└── README.md
```

---

## 💻 Frontend (página da cliente)

Página estática em HTML/CSS/JS, sem build e sem dependências. Ela:

- carrega o mês atual e **desativa** os dias já reservados (`GET /slots-livres`);
- abre um formulário ao clicar num dia livre e envia para o webhook de agendamento;
- tem uma seção de **cancelamento** (nome + data).

### Como rodar

O jeito recomendado é pelo **proxy Caddy** (já incluso no `docker-compose.yml`):

1. `docker compose up -d`
2. Abra **http://localhost:8088**

O Caddy serve os arquivos de `frontend/` e encaminha `/webhook/*` para o n8n.
Assim o site usa caminhos **relativos** (veja `frontend/config.js`) e funciona
tanto em `localhost:8088` quanto numa URL pública de túnel, sem alterar nada.

> Alternativa (dev sem proxy): `.\scripts\servir-frontend.ps1` sobe um servidor
> estático em http://localhost:5500. Nesse caso o site **não** alcança o n8n por
> caminho relativo, então use o proxy (8088) para testar de verdade.

---

## 🧪 Teste rápido do WhatsApp (modo teste)

O destino das notificações está em **modo teste**, apontando para `5521970762629` (número do Fernando).
Para validar **apenas o caminho do WhatsApp** (sem depender do Google Calendar), use o fluxo isolado `99`:

1. Importe `workflows/99-teste-whatsapp.json` no n8n.
2. Crie a credencial **Header Auth** (`apikey` = `AUTHENTICATION_API_KEY`) e vincule no nó HTTP.
3. Ative o fluxo e dispare:

```powershell
# script pronto (recomendado)
.\scripts\testar-whatsapp.ps1

# ou direto com curl
curl.exe -X POST http://localhost:5678/webhook/teste-whatsapp `
  -H "Content-Type: application/json" `
  -d '{"texto":"Teste do sistema de faxinas"}'
```

A mensagem deve chegar no número `5521970762629`.

> 🔁 Para voltar à produção, troque o número nos fluxos `01`, `02` e `99` pelo WhatsApp da sua mãe.

---

## 🗺️ Próximos passos

- [x] Frontend: calendário que **desativa datas ocupadas** (endpoint "Get Free Slots").
- [x] Workflow n8n `GET /slots-livres` lendo o Google Calendar.
- [ ] Google Calendar via **OAuth2** configurado como credencial no n8n.
- [ ] Expor o n8n na internet (túnel/reverse proxy) para o formulário funcionar de qualquer celular.
- [ ] Cron de lembrete (ex.: véspera do serviço) avisando a sua mãe e a cliente.
