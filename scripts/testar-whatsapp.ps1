<#
.SYNOPSIS
  Dispara um teste do caminho do WhatsApp no n8n (fluxo 99 - Teste WhatsApp).

.DESCRIPTION
  Envia um POST para o webhook do fluxo de teste e mostra o resultado.
  Use com o stack no ar (docker compose up -d) e o workflow 99 ativado.

.EXAMPLE
  .\scripts\testar-whatsapp.ps1
  .\scripts\testar-whatsapp.ps1 -Texto "Ola, teste!"

.NOTES
  Modo teste: o destino padrao e o numero configurado no fluxo (5521970762629).
#>
[CmdletBinding()]
param(
  [string]$Texto = "Teste do sistema de agendamento de faxinas",
  [string]$Url = "http://localhost:5678/webhook/teste-whatsapp"
)

Write-Host "Enviando teste para $Url ..." -ForegroundColor Cyan

try {
  $corpo = @{ texto = $Texto } | ConvertTo-Json
  $resp = Invoke-RestMethod -Uri $Url -Method Post -ContentType "application/json; charset=utf-8" -Body $corpo
  Write-Host ""
  Write-Host "OK! Mensagem disparada." -ForegroundColor Green
  Write-Host ("Status .......: " + $resp.status)
  Write-Host ("Enviado para .: " + $resp.enviadoPara)
  Write-Host ("Detalhe ......: " + $resp.mensagem)
}
catch {
  Write-Host ""
  Write-Host "FALHOU." -ForegroundColor Red
  Write-Host ("Erro: " + $_.Exception.Message)
  if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
    Write-Host ("Resposta: " + $_.ErrorDetails.Message)
  }
  Write-Host ""
  Write-Host "Checklist rapido:" -ForegroundColor Yellow
  Write-Host "  1. O stack esta no ar?       docker compose ps"
  Write-Host "  2. O workflow 99 esta ATIVO no n8n?"
  Write-Host "  3. A instancia 'faxinas' esta CONECTADA no Evolution Manager?"
  Write-Host "  4. A credencial 'Evolution API - apikey' esta vinculada no no HTTP?"
  exit 1
}
