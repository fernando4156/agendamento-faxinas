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
| Evolution Manager   | http://localhost:3000   | Criar instância e **escanear o QR Code**  |
| Evolution API       | http://localhost:8080   | Enviar mensagens (usada pelo n8n)         |
| n8n                 | http://localhost:5678   | Editar os fluxos de automação             |

### Conectar o WhatsApp
1. Abra http://localhost:3000 (Manager).
2. Faça login com a `AUTHENTICATION_API_KEY` do seu `.env`.
3. Crie a instância com o nome definido em `EVOLUTION_INSTANCE_NAME` (padrão: `faxinas`).
4. Escaneie o QR Code com o WhatsApp da sua mãe (Aparelhos conectados).

---

## 🔄 Fluxos principais

Os fluxos ficam na pasta [`workflows/`](./workflows) e são **importáveis** no n8n
(*Import from File*).

| Arquivo                              | Fluxo                                  |
| ------------------------------------ | -------------------------------------- |
| `01-agendamento-faxina.json`         | Recebe o agendamento e avisa no WhatsApp |
| `02-cancelamento-faxina.json`        | Cancela e libera a data, avisando no WhatsApp |
| `03-slots-livres.json`               | Get Free Slots: informa as datas ocupadas ao frontend |

Detalhes de cada nó e como configurar: **[`docs/n8n-workflows.md`](./docs/n8n-workflows.md)**.

---

## 📁 Estrutura do repositório

```
agendamento-faxinas/
├── docker-compose.yml            # Postgres + Redis + Evolution API + n8n
├── docker/
│   └── init-db.sql               # cria os bancos "evolution" e "n8n"
├── .env.example                  # modelo de variáveis (valores fictícios)
├── .gitignore                    # blindagem de segredos e dados locais
├── workflows/
│   ├── 01-agendamento-faxina.json
│   ├── 02-cancelamento-faxina.json
│   └── 03-slots-livres.json
├── frontend/
│   ├── index.html                # página da cliente (calendário + formulários)
│   ├── styles.css
│   ├── config.js                 # só URLs públicas (sem segredos)
│   └── app.js
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

### Como rodar localmente

Qualquer servidor estático serve. Exemplos:

```powershell
# com Python
cd frontend
python -m http.server 5500
# abra http://localhost:5500
```

Ou use a extensão **Live Server** do VS Code. Ajuste a URL do n8n em `frontend/config.js`
(`N8N_BASE_URL`) se necessário.

---

## 🗺️ Próximos passos

- [x] Frontend: calendário que **desativa datas ocupadas** (endpoint "Get Free Slots").
- [x] Workflow n8n `GET /slots-livres` lendo o Google Calendar.
- [ ] Google Calendar via **OAuth2** configurado como credencial no n8n.
- [ ] Expor o n8n na internet (túnel/reverse proxy) para o formulário funcionar de qualquer celular.
- [ ] Cron de lembrete (ex.: véspera do serviço) avisando a sua mãe e a cliente.
