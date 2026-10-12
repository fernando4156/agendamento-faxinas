/* =============================================================================
   Painel do Administrador - bloquear / liberar datas
   A chave fica guardada apenas no seu navegador (localStorage).
   ============================================================================= */
(function () {
  "use strict";

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
    month: hoje.getMonth(),
    ocupados: new Set(),
    bloqueios: new Set(),
    fechados: new Set(),
    chave: localStorage.getItem("faxinaAdminKey") || ""
  };

  function hojeStr() {
    const t = new Date();
    return ymd(t.getFullYear(), t.getMonth(), t.getDate());
  }

  function atualizarStatusChave() {
    if (state.chave) {
      el("statusChave").className = "msg ok";
      el("statusChave").innerHTML = 'Chave carregada. <span class="badge on">conectado</span>';
      el("modo").style.display = "block";
      el("btnSair").style.display = "inline-block";
    } else {
      el("statusChave").className = "msg";
      el("statusChave").innerHTML = 'Digite sua chave para liberar o painel. <span class="badge off">bloqueado</span>';
      el("modo").style.display = "none";
      el("btnSair").style.display = "none";
    }
  }

  async function carregar() {
    el("status").textContent = "Carregando...";
    try {
      const resp = await fetch(`${base}${cfg.WEBHOOK_SLOTS}?mes=${state.year}-${pad(state.month + 1)}`);
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const data = await resp.json();
      state.ocupados = new Set((data.diasOcupados || []).map((s) => String(s).substring(0, 10)));
      state.bloqueios = new Set((data.diasBloqueadosAdmin || []).map((s) => String(s).substring(0, 10)));
      state.fechados = new Set((data.diasBloqueados || []).map((s) => String(s).substring(0, 10)));
      el("status").textContent = "";
    } catch (e) {
      console.error(e);
      el("status").textContent = "Não consegui carregar a agenda.";
    }
    renderCalendario();
  }

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

    const offset = new Date(state.year, state.month, 1).getDay();
    const total = new Date(state.year, state.month + 1, 0).getDate();
    const hj = hojeStr();

    for (let i = 0; i < offset; i++) {
      const v = document.createElement("div");
      v.className = "day empty";
      grid.appendChild(v);
    }

    for (let d = 1; d <= total; d++) {
      const iso = ymd(state.year, state.month, d);
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "day";
      cell.textContent = d;

      if (iso < hj) {
        cell.classList.add("disabled");
        cell.disabled = true;
        cell.title = "Data passada";
      } else if (state.bloqueios.has(iso)) {
        cell.classList.add("bloqueio");
        cell.title = "Bloqueado por você - clique para liberar";
        cell.addEventListener("click", () => agir("liberar", iso));
      } else if (state.ocupados.has(iso)) {
        cell.classList.add("busy");
        cell.disabled = true;
        cell.title = "Reservado por uma cliente";
      } else if (state.fechados.has(iso)) {
        cell.classList.add("closed");
        cell.disabled = true;
        cell.title = "Fechado (fim de semana)";
      } else {
        cell.classList.add("free");
        cell.title = "Livre - clique para bloquear";
        cell.addEventListener("click", () => agir("bloquear", iso));
      }
      grid.appendChild(cell);
    }
  }

  async function agir(acao, iso) {
    if (!state.chave) {
      el("status").textContent = "Digite sua chave de administrador primeiro.";
      return;
    }
    const [y, m, d] = iso.split("-");
    const bonita = `${d}/${m}/${y}`;
    const pergunta = acao === "bloquear"
      ? `Bloquear o dia ${bonita}? (ninguém poderá agendar)`
      : `Liberar o dia ${bonita}?`;
    if (!window.confirm(pergunta)) return;

    el("status").textContent = acao === "bloquear" ? "Bloqueando..." : "Liberando...";
    const url = base + (acao === "bloquear" ? cfg.WEBHOOK_ADMIN_BLOQUEAR : cfg.WEBHOOK_ADMIN_LIBERAR);
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify({ chave: state.chave, data: iso })
      });
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      el("status").textContent = acao === "bloquear" ? `Dia ${bonita} bloqueado ✅` : `Dia ${bonita} liberado ✅`;
      await carregar();
    } catch (e) {
      console.error(e);
      el("status").textContent = "Falhou. Confira sua chave de administrador.";
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    el("chave").value = state.chave;
    atualizarStatusChave();

    el("btnSalvarChave").addEventListener("click", () => {
      state.chave = el("chave").value.trim();
      localStorage.setItem("faxinaAdminKey", state.chave);
      atualizarStatusChave();
      carregar();
    });

    el("btnSair").addEventListener("click", () => {
      state.chave = "";
      el("chave").value = "";
      localStorage.removeItem("faxinaAdminKey");
      atualizarStatusChave();
    });

    el("btnPrev").addEventListener("click", () => {
      const t = new Date();
      if (state.year === t.getFullYear() && state.month === t.getMonth()) return;
      state.month -= 1;
      if (state.month < 0) { state.month = 11; state.year -= 1; }
      carregar();
    });

    el("btnNext").addEventListener("click", () => {
      state.month += 1;
      if (state.month > 11) { state.month = 0; state.year += 1; }
      carregar();
    });

    carregar();
  });
})();
