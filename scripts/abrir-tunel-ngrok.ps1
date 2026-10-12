<#
.SYNOPSIS
  Abre um tunel publico com URL FIXA usando o ngrok (plano gratuito).

.DESCRIPTION
  O ngrok gratuito permite reservar 1 dominio estatico do tipo
  "algo.ngrok-free.app", que NAO muda a cada reinicio.

  Pre-requisitos (uma vez so):
    1. Criar conta gratis em https://dashboard.ngrok.com/signup
    2. Copiar o authtoken em https://dashboard.ngrok.com/get-started/your-authtoken
       e rodar uma vez:
          ngrok config add-authtoken <SEU_TOKEN>
    3. Reservar o dominio em https://dashboard.ngrok.com/domains
       e colocar em NGROK_DOMAIN no arquivo .env
          NGROK_DOMAIN=algo.ngrok-free.app

  O tunel aponta para o proxy Caddy (padrao: http://localhost:8088).

.EXAMPLE
  .\scripts\abrir-tunel-ngrok.ps1
  .\scripts\abrir-tunel-ngrok.ps1 -Domain minha-faxina.ngrok-free.app
#>
[CmdletBinding()]
param(
  [string]$Domain,
  [int]$Porta = 8088
)

$root = Split-Path -Parent $PSScriptRoot

# Descobre o executavel do ngrok (versao atual baixada, senao PATH)
$ngrok = $null
$local = "C:\Users\$env:USERNAME\tools\ngrok\ngrok.exe"
if (Test-Path $local) { $ngrok = $local }
else {
  $cmd = Get-Command ngrok -ErrorAction SilentlyContinue
  if ($cmd) { $ngrok = $cmd.Source }
}
if (-not $ngrok) {
  Write-Host "ngrok nao encontrado." -ForegroundColor Red
  Write-Host "Baixe em https://ngrok.com/download ou rode:" -ForegroundColor Yellow
  Write-Host '  Invoke-WebRequest "https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-windows-amd64.zip" -OutFile $env:TEMP\ngrok.zip' -ForegroundColor Yellow
  Write-Host '  Expand-Archive $env:TEMP\ngrok.zip -DestinationPath "C:\Users\$env:USERNAME\tools\ngrok" -Force' -ForegroundColor Yellow
  exit 1
}

# Descobre o dominio: parametro > .env
if (-not $Domain) {
  $envFile = Join-Path $root ".env"
  if (Test-Path $envFile) {
    $linha = (Get-Content $envFile -Raw) -split "`n" | Where-Object { $_ -match "^NGROK_DOMAIN=" } | Select-Object -First 1
    if ($linha) { $Domain = ($linha -replace "^NGROK_DOMAIN=", "").Trim() }
  }
}

if (-not $Domain) {
  Write-Host "Defina o dominio em NGROK_DOMAIN no .env ou passe -Domain." -ForegroundColor Red
  Write-Host "Ex.: -Domain minha-faxina.ngrok-free.app" -ForegroundColor Yellow
  exit 1
}

Write-Host "Abrindo tunel ngrok para http://localhost:$Porta" -ForegroundColor Green
Write-Host "URL publica fixa: https://$Domain" -ForegroundColor Cyan
Write-Host "Pressione Ctrl+C para encerrar." -ForegroundColor DarkGray
Write-Host ""

& $ngrok http "--url=https://$Domain" $Porta
