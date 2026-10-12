/* =============================================================================
   Configuração PÚBLICA do frontend.
   NUNCA coloque aqui chaves, tokens ou senhas: este arquivo vai para o GitHub.
   Apenas URLs (que são públicas) ficam aqui.
   ============================================================================= */
window.FAXINA_CONFIG = {
  // Base dos webhooks.
  // "" (vazio) = mesma origem da página. É o recomendado: o site é servido
  // pelo Caddy, que encaminha /webhook/* para o n8n. Assim funciona tanto em
  // http://localhost:8088 quanto numa URL pública de túnel, sem precisar
  // mudar nada aqui.
  N8N_BASE_URL: "",

  // Caminhos dos webhooks (criados no n8n)
  WEBHOOK_SLOTS: "/webhook/slots-livres",
  WEBHOOK_AGENDAMENTO: "/webhook/agendamento-faxina",
  WEBHOOK_CANCELAMENTO: "/webhook/cancelamento-faxina",

  // Webhooks do painel de administrador (exigem a chave secreta)
  WEBHOOK_ADMIN_BLOQUEAR: "/webhook/admin-bloquear",
  WEBHOOK_ADMIN_LIBERAR: "/webhook/admin-liberar"
};
