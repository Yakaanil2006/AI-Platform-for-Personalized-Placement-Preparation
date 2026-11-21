param([Parameter(Mandatory=$true)][string]$BackendUrl)
$ErrorActionPreference = 'Stop'
$backend = [uri]$BackendUrl
if ($backend.Scheme -ne 'https' -or $backend.AbsolutePath -ne '/' -or $backend.Query -or $backend.UserInfo) {
    throw 'Enter the HTTPS Render service origin, such as https://ai-placement-api.onrender.com'
}
$config = @{
    framework = 'vite'
    buildCommand = 'npm run build'
    outputDirectory = 'dist'
    rewrites = @(
        @{source='/api/:path*'; destination=$backend.GetLeftPart([System.UriPartial]::Authority) + '/api/:path*'}
    )
}
$config | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'frontend/vercel.json') -Encoding utf8
Write-Output 'Vercel configuration saved. Commit frontend/vercel.json before deploying the frontend.'
