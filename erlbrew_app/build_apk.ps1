# Releases the customer APK wired to the backend URL in config/.env.
# Copy config/env.example -> config/.env and adjust POS_API_URL first.
#
# Examples:
#   .\build_apk.ps1                    # release APK (universal)
#   .\build_apk.ps1 -Mode debug        # debug build
#   .\build_apk.ps1 -ExtraArgs "--split-per-abi"

param(
    [ValidateSet("debug", "profile", "release")]
    [string]$Mode = "release",
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$ExtraArgs
)

$envFile = Join-Path $PSScriptRoot "config\.env"
if (-not (Test-Path $envFile)) {
    Write-Error "config/.env not found. Copy config/env.example to config/.env and set POS_API_URL."
    exit 1
}

Write-Host "Building $Mode APK with backend URL from config/.env:"
Get-Content $envFile | Where-Object { $_ -notmatch '^\s*(#|$)' }

flutter build apk --$Mode --dart-define-from-file=config/.env @ExtraArgs
