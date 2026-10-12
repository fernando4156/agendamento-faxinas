<#
.SYNOPSIS
  Abre um tunel publico (Cloudflare Tunnel) para o site, permitindo que
  qualquer celular acesse a pagina da cliente pela internet.

.DESCRIPTION
  O tunel aponta para o proxy Caddy (padrao: http://localhost:8088), que:
    - serve o site da cliente
    - encaminha SOMENTE /webhook/* para o n8n (o editor do n8n fica bloqueado)

  Ao iniciar, o cloudflared imprime uma URL publica parecida com:
      https://algo-aleatorio.trycloudflare.com
  Basta compartilhar ESSA URL com as clientes.

  IMPORTANTE: essa URL "rapida" muda a cada vez que voce reinicia o tunel.
  Para uma URL fixa, e preciso um dominio proprio no Cloudflare (ou ngrok).

.EXAMPLE
  .\scripts\abrir-tunel.ps1
  .\scripts\abrir-tunel.ps1 -Porta 8088
#>
[CmdletBinding()]
param(
  [int]$Porta = 8088
)

$cf = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cf) {
  Write-Host "cloudflared nao encontrado." -ForegroundColor Red
  Write-Host "Instale com: winget install --id Cloudflare.cloudflared -e" -ForegroundColor Yellow
  exit 1
}

Write-Host "Abrindo tunel publico para http://localhost:$Porta" -ForegroundColor Green
Write-Host "Copie a URL https://....trycloudflare.com que aparecer abaixo e compartilhe com as clientes." -ForegroundColor Cyan
Write-Host "Pressione Ctrl+C para encerrar o tunel." -ForegroundColor DarkGray
Write-Host ""

& cloudflared tunnel --url "http://localhost:$Porta"
