param(
    [string]$Manifest = (Join-Path $PSScriptRoot '..\apps\cambridge\assets\listening\b2-short-extracts.json')
)

Add-Type -AssemblyName System.Speech
$content = Get-Content -LiteralPath $Manifest -Raw -Encoding UTF8 | ConvertFrom-Json
$destination = Split-Path -Parent (Resolve-Path -LiteralPath $Manifest)
$speaker = [System.Speech.Synthesis.SpeechSynthesizer]::new()
try {
    $speaker.SelectVoice('Microsoft Zira Desktop')
    $speaker.Rate = 0
    foreach ($item in $content.items) {
        $path = Join-Path $destination $item.audio
        $speaker.SetOutputToWaveFile($path)
        $speaker.Speak([string]$item.transcript)
        $speaker.SetOutputToNull()
        Write-Output $path
    }
    $longForm = Get-Content -LiteralPath (Join-Path $destination 'b2-sentence-completion.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $longPath = Join-Path $destination $longForm.audio
    $speaker.SetOutputToWaveFile($longPath)
    $speaker.Speak([string]$longForm.transcript)
    $speaker.SetOutputToNull()
    Write-Output $longPath
    $matching = Get-Content -LiteralPath (Join-Path $destination 'b2-multiple-matching.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $rates = @(0, -1, -1, 1, -1)
    for ($index = 0; $index -lt $matching.speakers.Count; $index++) {
        $speaker.Rate = $rates[$index]
        $item = $matching.speakers[$index]
        $path = Join-Path $destination $item.audio
        $speaker.SetOutputToWaveFile($path)
        $speaker.Speak([string]$item.transcript)
        $speaker.SetOutputToNull()
        Write-Output $path
    }
    $interview = Get-Content -LiteralPath (Join-Path $destination 'b2-interview.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $interviewPath = Join-Path $destination $interview.audio
    $speaker.SetOutputToWaveFile($interviewPath)
    foreach ($turn in $interview.turns) {
        $speaker.Rate = if ($turn.speaker -eq 'Interviewer') { -2 } else { 1 }
        $speaker.Speak("$($turn.speaker). $($turn.text)")
    }
    $speaker.SetOutputToNull()
    Write-Output $interviewPath
} finally {
    $speaker.Dispose()
}
