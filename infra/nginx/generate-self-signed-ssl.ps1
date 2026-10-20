# PowerShell script to generate self-signed TLS certificates for development/testing
$certsDir = Join-Path $PSScriptRoot "certs"
if (-not (Test-Path $certsDir)) {
    New-Item -ItemType Directory -Force -Path $certsDir | Out-Null
}

$fullchain = Join-Path $certsDir "fullchain.pem"
$privkey = Join-Path $certsDir "privkey.pem"

if (-not (Test-Path $fullchain) -or -not (Test-Path $privkey)) {
    Write-Host "⚡ Generating self-signed SSL certificate for ComputeGrid..." -ForegroundColor Cyan
    
    # Try finding openssl from Git if not in PATH
    $opensslCmd = "openssl"
    if (-not (Get-Command "openssl" -ErrorAction SilentlyContinue)) {
        $gitOpenssl = "C:\Program Files\Git\usr\bin\openssl.exe"
        if (Test-Path $gitOpenssl) {
            $opensslCmd = $gitOpenssl
        } else {
            Write-Error "OpenSSL is not found in PATH or Git installation directory. Please install OpenSSL or Git for Windows."
            exit 1
        }
    }

    & $opensslCmd req -x509 -nodes -days 365 -newkey rsa:2048 `
        -keyout $privkey `
        -out $fullchain `
        -subj "//C=US\ST=State\L=City\O=ComputeGrid\OU=Infra\CN=localhost" `
        -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

    Write-Host "✅ Self-signed SSL certificate created in $certsDir" -ForegroundColor Green
} else {
    Write-Host "ℹ️ Existing SSL certificate found in $certsDir. Skipping generation." -ForegroundColor Yellow
}
