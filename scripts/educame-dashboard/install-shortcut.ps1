$ErrorActionPreference = 'Stop'
$desktop = [Environment]::GetFolderPath('DesktopDirectory')
$path = Join-Path $desktop 'Centro de mando Educame.lnk'
$launcher = Join-Path $PSScriptRoot 'launch-windows.ps1'
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($path)
if ((Test-Path -LiteralPath $path) -and -not $shortcut.Arguments.Contains($launcher)) {
    throw "Ya hay otro acceso directo con ese nombre en $desktop."
}
$shortcut.TargetPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$shortcut.Arguments = '-NoProfile -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File "' + $launcher + '"'
$shortcut.WorkingDirectory = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$shortcut.Description = 'Abre el Centro de mando local de Educame'
$shortcut.IconLocation = (Join-Path $env:SystemRoot 'System32\shell32.dll') + ',14'
$shortcut.Save()
Write-Output $path
