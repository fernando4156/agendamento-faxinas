<#
.SYNOPSIS
  Sobe um servidor estatico local para a pagina da cliente (frontend/).

.DESCRIPTION
  Serve os arquivos da pasta frontend/ em http://localhost:<Porta>.
  Nao requer Node/Python - usa o HttpListener nativo do Windows.

.EXAMPLE
  .\scripts\servir-frontend.ps1
  .\scripts\servir-frontend.ps1 -Porta 5500
#>
[CmdletBinding()]
param(
  [int]$Porta = 5500
)

$root = Join-Path (Split-Path -Parent $PSScriptRoot) "frontend"
if (-not (Test-Path $root)) {
  Write-Host "Pasta frontend nao encontrada em $root" -ForegroundColor Red
  exit 1
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Porta/")
$listener.Start()
Write-Host "Frontend no ar em http://localhost:$Porta/ (servindo $root)" -ForegroundColor Green
Write-Host "Pressione Ctrl+C para encerrar." -ForegroundColor DarkGray

$mime = @{
  ".html" = "text/html; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".js"   = "application/javascript; charset=utf-8"
  ".svg"  = "image/svg+xml"
  ".png"  = "image/png"
  ".ico"  = "image/x-icon"
  ".json" = "application/json; charset=utf-8"
}

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $path = $ctx.Request.Url.LocalPath
    if ($path -eq "/") { $path = "/index.html" }
    $rel = $path.TrimStart("/").Replace("/", [System.IO.Path]::DirectorySeparatorChar)
    $file = Join-Path $root $rel
    if (Test-Path $file -PathType Leaf) {
      $bytes = [System.IO.File]::ReadAllBytes($file)
      $ext = [System.IO.Path]::GetExtension($file).ToLower()
      if ($mime.ContainsKey($ext)) { $ctx.Response.ContentType = $mime[$ext] }
      $ctx.Response.ContentLength64 = $bytes.Length
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $ctx.Response.StatusCode = 404
    }
    $ctx.Response.OutputStream.Close()
  } catch { }
}
