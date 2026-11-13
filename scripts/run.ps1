$ErrorActionPreference = "Stop"

function Invoke-CheckedCommand {
  param(
    [string]$Description,
    [string]$Program,
    [string[]]$Arguments
  )

  & $Program @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Description failed with exit code $LASTEXITCODE."
  }
}

try {
  Set-Location (Split-Path -Parent $PSScriptRoot)

  $nodeMajor = [int](& node -p "process.versions.node.split('.')[0]")
  if ($LASTEXITCODE -ne 0 -or $nodeMajor -lt 22) {
    throw "Node.js 22 or newer is required."
  }

  if (-not (Test-Path "node_modules")) {
    Invoke-CheckedCommand "Dependency installation" "npm" @("ci")
  }

  Invoke-CheckedCommand "Project setup" "npm" @("run", "setup")
  Invoke-CheckedCommand "Docker Desktop startup" "docker" @("desktop", "start")
  Invoke-CheckedCommand "Docker Engine startup" "powershell.exe" @(
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    "scripts/wait-docker.ps1"
  )

  Invoke-CheckedCommand "PostgreSQL startup" "docker" @("compose", "up", "-d", "--wait", "db")
  Invoke-CheckedCommand "Database initialization" "npm" @("run", "db:init")

  Write-Host "Starting the website at http://localhost:3000 (press Ctrl+C to stop)."
  Invoke-CheckedCommand "Application startup" "npm" @("start")
}
catch {
  Write-Error $_
  exit 1
}
