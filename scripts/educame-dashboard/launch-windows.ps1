param([switch]$NoBrowser)

$ErrorActionPreference = 'Stop'
$workspace = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$address = 'http://127.0.0.1:4317/'
$mutex = [Threading.Mutex]::new($false, 'Local\EducameDashboardLauncher')
$held = $false

function Test-Dashboard {
    try {
        $panel = Invoke-RestMethod -Uri ($address + 'api/panel') -TimeoutSec 2
        return $null -ne $panel.projectProfiles -and $null -ne $panel.board
    } catch {
        return $false
    }
}

try {
    try { $held = $mutex.WaitOne(20000) } catch [Threading.AbandonedMutexException] { $held = $true }
    if (-not $held) { throw 'LA TERRAZA sigue arrancando. Vuelve a abrir el acceso directo.' }
    if (-not (Test-Dashboard)) {
        $node = Get-Command node.exe -ErrorAction SilentlyContinue
        if (-not $node) { throw 'Instala Node.js antes de abrir LA TERRAZA.' }
        if (-not $env:EDUCAME_CODEX_EXECUTABLE -and -not (Get-Command codex.exe -ErrorAction SilentlyContinue)) {
            $package = Get-AppxPackage -Name OpenAI.Codex | Select-Object -First 1
            if ($package) {
                $bundled = Join-Path $package.InstallLocation 'app\resources\codex.exe'
                if (Test-Path -LiteralPath $bundled) { $env:EDUCAME_CODEX_EXECUTABLE = $bundled }
            }
        }
        if (-not (Get-Command git.exe -ErrorAction SilentlyContinue)) {
            $runtime = Get-AppxPackage -Name 'OpenAI.CodexPrimaryRuntime*' | Sort-Object Version -Descending | Select-Object -First 1
            if ($runtime) {
                $gitDirectory = Join-Path $runtime.InstallLocation 'dependencies\native\git\cmd'
                if (Test-Path -LiteralPath (Join-Path $gitDirectory 'git.exe')) { $env:PATH = $gitDirectory + ';' + $env:PATH }
            }
        }
        $logs = Join-Path $workspace '.educame-agents'
        New-Item -Path $logs -ItemType Directory -Force | Out-Null
        $env:EDUCAME_DASHBOARD_PORT = '4317'
        $process = Start-Process -FilePath $node.Source -ArgumentList 'scripts/educame-dashboard.mjs' -WorkingDirectory $workspace -WindowStyle Hidden -PassThru `
            -RedirectStandardOutput (Join-Path $logs 'dashboard-stdout.log') -RedirectStandardError (Join-Path $logs 'dashboard-stderr.log')
        $ready = $false
        for ($attempt = 0; $attempt -lt 25 -and -not $process.HasExited; $attempt++) {
            if (Test-Dashboard) { $ready = $true; break }
            Start-Sleep -Milliseconds 300
        }
        if (-not $ready) { throw "No se pudo abrir LA TERRAZA. Revisa el registro en $logs." }
    }
    if (-not $NoBrowser) { Start-Process ($address + '#inicio') }
} catch {
    if (-not $NoBrowser) {
        $shell = New-Object -ComObject WScript.Shell
        $shell.Popup($_.Exception.Message, 0, 'LA TERRAZA', 16) | Out-Null
    }
    throw
} finally {
    if ($held) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
