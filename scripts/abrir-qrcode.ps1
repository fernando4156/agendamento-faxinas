<#
.SYNOPSIS
  Abre uma pagina local com o QR Code do WhatsApp para conectar/reconectar a
  instancia da Evolution API.

.DESCRIPTION
  O Evolution Manager oficial (evoapicloud/evolution-manager:latest) esta com um
  bug de nginx e entra em loop de crash. Este script substitui o Manager para a
  tarefa de conectar o WhatsApp, servindo uma pagina que se atualiza sozinha.

  Ele le a AUTHENTICATION_API_KEY e o EVOLUTION_INSTANCE_NAME do arquivo .env,
  consulta a Evolution API local e mostra o QR Code (renovado a cada 15s).

.EXAMPLE
  .\scripts\abrir-qrcode.ps1
  .\scripts\abrir-qrcode.ps1 -Porta 5500
#>
[CmdletBinding()]
param(
  [int]$Porta = 5500
)

$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root ".env"
if (-not (Test-Path $envFile)) {
  Write-Host "Arquivo .env nao encontrado em $root" -ForegroundColor Red
  exit 1
}

$lines = Get-Content $envFile -Raw
$key = (($lines -split "`n" | Where-Object { $_ -match "^AUTHENTICATION_API_KEY=" }) -replace "^AUTHENTICATION_API_KEY=","").Trim()
$inst = (($lines -split "`n" | Where-Object { $_ -match "^EVOLUTION_INSTANCE_NAME=" }) -replace "^EVOLUTION_INSTANCE_NAME=","").Trim()
if (-not $inst) { $inst = "faxinas" }

$apiBase = "http://localhost:8080"

$html = @"
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Conectar WhatsApp ($inst)</title>
<style>
  body { font-family: "Segoe UI", sans-serif; background:#0f172a; color:#e2e8f0; text-align:center; padding:24px; margin:0; }
  h1 { font-size:1.2rem; }
  img { width:320px; height:320px; background:#fff; border-radius:16px; padding:14px; box-shadow:0 10px 40px rgba(0,0,0,.4); }
  #st { margin-top:16px; color:#7dd3fc; font-size:.95rem; }
  .ok { color:#4ade80 !important; font-weight:700; }
  ol { text-align:left; max-width:420px; margin:20px auto; color:#94a3b8; font-size:.85rem; line-height:1.6; }
</style>
</head>
<body>
  <h1>Conectar o WhatsApp da instancia <b>$inst</b></h1>
  <img id="qr" alt="QR Code" src="" />
  <div id="st">carregando QR...</div>
  <ol>
    <li>Abra o WhatsApp no celular</li>
    <li>Toque em <b>Aparelhos conectados</b> &rarr; <b>Conectar um aparelho</b></li>
    <li>Aponte a camera para o QR acima</li>
    <li>Esta pagina atualiza o QR automaticamente</li>
  </ol>
  <script>
    async function atualiza() {
      try {
        const r = await fetch('/qr?_=' + Date.now());
        const j = await r.json();
        const st = document.getElementById('st');
        if (j.state === 'open') {
          st.textContent = 'Conectado com sucesso! Pode fechar esta pagina.';
          st.classList.add('ok');
          document.getElementById('qr').style.opacity = '0.25';
        } else if (j.base64) {
          document.getElementById('qr').src = j.base64;
          st.textContent = 'Estado: ' + j.state + ' - escaneie o QR';
        } else {
          st.textContent = 'Estado: ' + (j.state || '?') + (j.detail ? ' (' + j.detail + ')' : '');
        }
      } catch (e) { document.getElementById('st').textContent = 'erro: ' + e; }
    }
    atualiza();
    setInterval(atualiza, 15000);
  </script>
</body>
</html>
"@

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Porta/")
$listener.Start()
Write-Host "Pagina do QR Code no ar: http://localhost:$Porta/" -ForegroundColor Green
Write-Host "Pressione Ctrl+C para encerrar." -ForegroundColor DarkGray

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $path = $ctx.Request.Url.LocalPath
    if ($path -eq "/") {
      $bytes = [Text.Encoding]::UTF8.GetBytes($html)
      $ctx.Response.ContentType = "text/html; charset=utf-8"
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    }
    elseif ($path -eq "/qr") {
      $json = "{}"
      try {
        $st = Invoke-RestMethod -Uri "$apiBase/instance/connectionState/$inst" -Headers @{ apikey = $key } -TimeoutSec 15
        $state = $st.instance.state
        if ($state -eq "open") {
          $json = @{ state = $state } | ConvertTo-Json -Compress
        } else {
          $c = Invoke-RestMethod -Uri "$apiBase/instance/connect/$inst" -Headers @{ apikey = $key } -TimeoutSec 30
          $json = @{ state = $state; base64 = $c.base64 } | ConvertTo-Json -Compress
        }
      } catch {
        $json = @{ state = "erro"; detail = $_.Exception.Message } | ConvertTo-Json -Compress
      }
      $bytes = [Text.Encoding]::UTF8.GetBytes($json)
      $ctx.Response.ContentType = "application/json"
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    }
    else { $ctx.Response.StatusCode = 404 }
    $ctx.Response.OutputStream.Close()
  } catch { }
}
