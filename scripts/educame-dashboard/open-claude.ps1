param([switch]$CheckOnly)

$ErrorActionPreference = 'Stop'
$command = Get-Command claude.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
$candidates = @(
    $command.Source
    (Join-Path $env:USERPROFILE '.local\bin\claude.exe')
    (Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Links\claude.exe')
    (Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages\Anthropic.ClaudeCode_Microsoft.Winget.Source_8wekyb3d8bbwe\claude.exe')
)
$binary = $candidates | Where-Object { $_ -and (Test-Path -LiteralPath $_ -PathType Leaf) } | Select-Object -First 1
if (-not $binary) { exit 2 }
if (-not (Get-Command git.exe -ErrorAction SilentlyContinue)) { exit 3 }
if ($CheckOnly) { & $binary --version; exit $LASTEXITCODE }

# The official client receives its own interactive console and login.
Start-Process -FilePath $binary -ArgumentList '--worktree' -WorkingDirectory (Get-Location).Path -WindowStyle Normal
