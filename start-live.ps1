param([switch]$CreateAdministrator, [string]$Email, [string]$Name = "Administrator")
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

try {
    $health = Invoke-RestMethod -Uri 'http://localhost:8000/api/health' -TimeoutSec 4
    if (-not $CreateAdministrator -and $health.status -eq 'ok' -and $health.mode -eq 'live') {
        $schema = Invoke-RestMethod -Uri 'http://localhost:8000/openapi.json' -TimeoutSec 4
        if ($schema.info.title -eq 'An Intelligent AI Platform for Personalized Placement Preparation') {
            Write-Output 'An Intelligent AI Platform for Personalized Placement Preparation is already running at http://localhost:8000/ in live mode.'
            exit 0
        }
    }
} catch {
    # No healthy live instance responded. Continue with normal startup.
}

$configPath = Join-Path $PSScriptRoot '.env'
if (-not (Test-Path -LiteralPath $configPath)) {
    throw 'Create .env with the live configuration before running this script.'
}

$config = Get-Content -LiteralPath $configPath -Raw
if ($config -notmatch '(?m)^APP_MODE=live\s*$') {
    throw 'Set APP_MODE=live in .env.'
}
$connectionArgs = @('PGCONNECT_TIMEOUT=8')

if ($CreateAdministrator) {
    if (-not $Email) { $Email = Read-Host 'Administrator email' }
    $linuxUserHome = (wsl.exe -d Ubuntu -- printenv HOME).Trim()
    if ($LASTEXITCODE -ne 0 -or -not $linuxUserHome) {
        throw 'Could not locate the WSL Python environment.'
    }
    wsl.exe -d Ubuntu -- env @connectionArgs "$linuxUserHome/.venvs/placement-studio/bin/python" -m backend.cli create-administrator --email $Email --name $Name
    exit $LASTEXITCODE
}
wsl.exe -d Ubuntu -- env @connectionArgs bash -c 'exec ~/.venvs/placement-studio/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000'
exit $LASTEXITCODE
