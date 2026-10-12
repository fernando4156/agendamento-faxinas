/* =============================================================================
   Agendamento de Faxinas - lógica do frontend
   ============================================================================= */
(function () {
  "use strict";

  window.__faxinaVersion = "v3-admin";

  const cfg = window.FAXINA_CONFIG || {};
  const base = String(cfg.N8N_BASE_URL || "").replace(/\/+$/, "");

  const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
                 "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  const el = (id) => document.getElementById(id);
  const pad = (n) => String(n).padStart(2, "0");
  const ymd = (y, m0, d) => `${y}-${pad(m0 + 1)}-${pad(d)}`;

  const hoje = new Date();
  const state = {
    year: hoje.getFullYear(),
    month: hoje.getMonth(),   // 0-based
    ocupados: new Set(),
    bloqueados: new Set(),
    adminBloqueios: new Set(),
    carregando: false
  };

  function hojeStr() {
    const t = new Date();
    return ymd(t.getFullYear(), t.getMonth(), t.getDate());
  }

  function mesAtualEhPartida() {
    const t = new Date();
    return state.year === t.getFullYear() && state.month === t.getMonth();
  }

  /* --------------------------- Carregar do n8n ---------------------------- */
  async function carregarSlots() {
    state.carregando = true;
    el("status").textContent = "Carregando disponibilidade...";
    try {
      const url = `${base}${cfg.WEBHOOK_SLOTS}?mes=${state.year}-${pad(state.month + 1)}`;
      const resp = await fetch(url, { method: "GET" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      state.ocupados = new Set(
        (data.diasOcupados || []).map((s) => String(s).substring(0, 10))
      );
      state.bloqueados = new Set(
        (data.diasBloqueados || []).map((s) => String(s).substring(0, 10))
      );
      state.adminBloqueios = new Set(
        (data.diasBloqueadosAdmin || []).map((s) => String(s).substring(0, 10))
      );
      el("status").textContent = "";
    } catch (err) {
      console.error("Falha ao carregar slots:", err);
      state.ocupados = new Set();
      el("status").textContent =
        "Não consegui carregar a agenda agora. Verifique a conexão e tente de novo.";
    } finally {
      state.carregando = false;
      renderCalendario();
    }
  }

  /* ------------------------------ Renderização --------------------------- */
  function renderCalendario() {
    el("tituloMes").textContent = `${MESES[state.month]} ${state.year}`;

    const grid = el("grid");
    grid.innerHTML = "";

    DIAS_SEMANA.forEach((w) => {
      const h = document.createElement("div");
      h.className = "weekday";
      h.textContent = w;
      grid.appendChild(h);
    });

    const primeiroDiaSemana = new Date(state.year, state.month, 1).getDay();
    const totalDias = new Date(state.year, state.month + 1, 0).getDate();
    const hojeIso = hojeStr();

    for (let i = 0; i < primeiroDiaSemana; i++) {
      const vazio = document.createElement("div");
      vazio.className = "day empty";
      grid.appendChild(vazio);
    }

    for (let d = 1; d <= totalDias; d++) {
      const iso = ymd(state.year, state.month, d);
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "day";
      cell.textContent = d;

      if (iso < hojeIso) {
        cell.classList.add("disabled");
        cell.disabled = true;
        cell.title = "Data passada";
      } else if (state.ocupados.has(iso)) {
        cell.classList.add("busy");
        cell.disabled = true;
        cell.title = "Já reservado";
      } else if (state.bloqueados.has(iso) || state.adminBloqueios.has(iso)) {
        cell.classList.add("closed");
        cell.disabled = true;
        cell.title = "Indisponível";
      } else {
        cell.classList.add("free");
        cell.title = "Disponível - clique para agendar";
        cell.addEventListener("click", () => abrirModal(iso));
      }
      grid.appendChild(cell);
    }

    el("btnPrev").disabled = mesAtualEhPartida();
  }

  /* ------------------------------- Modal --------------------------------- */
  function abrirModal(iso) {
    const [y, m, d] = iso.split("-");
    el("dataEscolhida").textContent = `${d}/${m}/${y}`;
    const form = el("formAgendamento");
    form.reset();
    form.dataset.data = iso;
    el("mensagem").textContent = "";
    el("mensagem").className = "msg";
    el("modal").classList.remove("hidden");
    el("nome").focus();
  }

  function fecharModal() {
    el("modal").classList.add("hidden");
  }

  /* --------------------------- Enviar agendamento ------------------------ */
  async function enviarAgendamento(ev) {
    ev.preventDefault();
    const form = ev.target;
    const botao = form.querySelector("button[type=submit]");
    const msg = el("mensagem");

    const payload = {
      nome: el("nome").value.trim(),
      endereco: el("endereco").value.trim(),
      contato: el("contato").value.trim(),
      data: form.dataset.data
    };

    botao.disabled = true;
    botao.textContent = "Enviando...";
    msg.textContent = "";
    msg.className = "msg";

    try {
      const resp = await fetch(`${base}${cfg.WEBHOOK_AGENDAMENTO}`, {
        method: "POST",
        // text/plain evita o preflight de CORS (o n8n lê o corpo e faz JSON.parse)
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      msg.textContent = "Agendamento confirmado! Você será avisada. ✅";
      msg.classList.add("ok");
      setTimeout(() => {
        fecharModal();
        carregarSlots();
      }, 1600);
    } catch (err) {
      console.error("Falha ao agendar:", err);
      msg.textContent = "Não foi possível concluir agora. Tente novamente. ❌";
      msg.classList.add("erro");
    } finally {
      botao.disabled = false;
      botao.textContent = "Confirmar agendamento";
    }
  }

  /* --------------------------- Enviar cancelamento ----------------------- */
  async function enviarCancelamento(ev) {
    ev.preventDefault();
    const botao = ev.target.querySelector("button[type=submit]");
    const msg = el("mensagemCancel");

    const payload = {
      nome: el("nomeCancel").value.trim(),
      data: el("dataCancel").value
    };

    botao.disabled = true;
    botao.textContent = "Enviando...";
    msg.textContent = "";
    msg.className = "msg";

    try {
      const resp = await fetch(`${base}${cfg.WEBHOOK_CANCELAMENTO}`, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      msg.textContent = "Cancelamento registrado e dia liberado. ✅";
      msg.classList.add("ok");
      ev.target.reset();
      carregarSlots();
    } catch (err) {
      console.error("Falha ao cancelar:", err);
      msg.textContent = "Não encontrei esse agendamento. Confira o nome e a data. ❌";
      msg.classList.add("erro");
    } finally {
      botao.disabled = false;
      botao.textContent = "Cancelar agendamento";
    }
  }

  /* ------------------------------- Eventos ------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    el("btnPrev").addEventListener("click", () => {
      if (mesAtualEhPartida()) return;
      state.month -= 1;
      if (state.month < 0) { state.month = 11; state.year -= 1; }
      carregarSlots();
    });

    el("btnNext").addEventListener("click", () => {
      state.month += 1;
      if (state.month > 11) { state.month = 0; state.year += 1; }
      carregarSlots();
    });

    el("btnFecharModal").addEventListener("click", fecharModal);
    el("modal").addEventListener("click", (e) => {
      if (e.target === el("modal")) fecharModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") fecharModal();
    });

    el("formAgendamento").addEventListener("submit", enviarAgendamento);
    el("formCancel").addEventListener("submit", enviarCancelamento);

    carregarSlots();

    // Atualiza a agenda sozinho a cada 60s (sem atrapalhar se o formulario
    // estiver aberto), para refletir mudancas que a mae fizer no Google Calendar
    setInterval(() => {
      if (el("modal").classList.contains("hidden")) carregarSlots();
    }, 60000);
  });
})();
