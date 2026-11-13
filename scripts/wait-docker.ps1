$ErrorActionPreference = "Stop"

Write-Host "Waiting for Docker Engine..."
for ($attempt = 0; $attempt -lt 60; $attempt++) {
  $serverVersion = & docker info --format "{{.ServerVersion}}" 2>$null
  if ($LASTEXITCODE -eq 0 -and $serverVersion) {
    Write-Host "Docker Engine $serverVersion is ready."
    exit 0
  }
  Start-Sleep -Seconds 2
}

throw "Docker Engine did not become ready. Start Docker Desktop and check 'docker info'."
