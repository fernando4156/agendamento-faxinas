/* =============================================================================
   Configuração PÚBLICA do frontend.
   NUNCA coloque aqui chaves, tokens ou senhas: este arquivo vai para o GitHub.
   Apenas URLs (que são públicas) ficam aqui.
   ============================================================================= */
window.FAXINA_CONFIG = {
  // Base do n8n. Em produção troque por https://seu-dominio.com
  N8N_BASE_URL: "http://localhost:5678",

  // Caminhos dos webhooks (criados no n8n)
  WEBHOOK_SLOTS: "/webhook/slots-livres",
  WEBHOOK_AGENDAMENTO: "/webhook/agendamento-faxina",
  WEBHOOK_CANCELAMENTO: "/webhook/cancelamento-faxina"
};
