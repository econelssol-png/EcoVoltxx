$ErrorActionPreference = "Continue"
Remove-Item -Path "tunnel.log" -ErrorAction SilentlyContinue

$proc = Start-Process -FilePath ".\cloudflared.exe" -ArgumentList "tunnel", "--url", "http://localhost:3000", "--logfile", "tunnel.log" -PassThru -NoNewWindow
Write-Host "Started cloudflared with PID: $($proc.Id)"

# Loop up to 30 seconds to find the URL in tunnel.log
$found = $false
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Path "tunnel.log") {
        $content = Get-Content "tunnel.log" -Raw
        if ($content -match "https://[a-zA-Z0-9-]+\.trycloudflare\.com") {
            $tunnelUrl = $matches[0]
            Write-Host "TUNNEL_URL: $tunnelUrl"
            $found = $true
            break
        }
    }
}

if (-not $found) {
    Write-Host "Warning: Could not detect tunnel URL within 30 seconds. Check tunnel.log."
}

# Wait for 4 hours (14400 seconds) minus elapsed seconds
$durationSeconds = 14400 - $i
Write-Host "Keeping tunnel open for $durationSeconds seconds (4 hours total)..."
Start-Sleep -Seconds $durationSeconds

Write-Host "4 hours elapsed. Stopping cloudflared process $($proc.Id)..."
Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
Write-Host "Public tunnel closed."
