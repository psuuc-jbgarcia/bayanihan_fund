[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Treasurer,

    [Parameter(Mandatory = $true)]
    [string]$President,

    [Parameter(Mandatory = $true)]
    [string]$Secretary,

    [string]$Source = "deployer",
    [string]$TokenContract = "",
    [string]$TokenSymbol = "XLM",
    [switch]$SkipTests
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Assert-Command([string]$Name, [string]$InstallHint) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Missing '$Name'. $InstallHint"
    }
}

function Assert-AccountAddress([string]$Name, [string]$Value) {
    if ($Value -notmatch '^G[A-Z2-7]{55}$') {
        throw "$Name must be a valid Stellar G... account address."
    }
}

Assert-Command "cargo" "Install Rust from https://rustup.rs and reopen PowerShell."
Assert-Command "stellar" "Run: cargo install --locked stellar-cli"

Assert-AccountAddress "Treasurer" $Treasurer
Assert-AccountAddress "President" $President
Assert-AccountAddress "Secretary" $Secretary
if (($Treasurer -eq $President) -or ($Treasurer -eq $Secretary) -or ($President -eq $Secretary)) {
    throw "Treasurer, president, and secretary must use three different addresses."
}

$root = Split-Path -Parent $PSScriptRoot
$wasm = Join-Path $root "target\wasm32v1-none\release\bayanihan_fund.wasm"
$frontendEnv = Join-Path $root "frontend\.env"

Push-Location $root
try {
    Write-Host "Checking deployer identity '$Source'..." -ForegroundColor Cyan
    & stellar keys address $Source | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Identity '$Source' was not found. Run: stellar keys generate $Source --network testnet --fund"
    }

    if (-not $SkipTests) {
        Write-Host "Running contract tests..." -ForegroundColor Cyan
        & cargo test --workspace
        if ($LASTEXITCODE -ne 0) { throw "Contract tests failed." }
    }

    Write-Host "Building optimized contract WASM..." -ForegroundColor Cyan
    & stellar contract build
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $wasm)) {
        throw "Contract build failed or WASM was not created at $wasm"
    }

    if (-not $TokenContract) {
        Write-Host "Resolving the native Testnet XLM token contract..." -ForegroundColor Cyan
        $tokenOutput = (& stellar contract id asset --asset native --network testnet 2>&1) -join "`n"
        $tokenMatch = [regex]::Match($tokenOutput, 'C[A-Z2-7]{55}')
        if (-not $tokenMatch.Success) {
            throw "Could not resolve the native XLM token contract. Output: $tokenOutput"
        }
        $TokenContract = $tokenMatch.Value
    }
    if ($TokenContract -notmatch '^C[A-Z2-7]{55}$') {
        throw "TokenContract must be a valid Stellar C... contract address."
    }

    Write-Host "Deploying Bayanihan Fund to Testnet..." -ForegroundColor Cyan
    $deployOutput = (& stellar contract deploy `
        --network testnet `
        --source $Source `
        --wasm $wasm `
        -- `
        --treasurer $Treasurer `
        --president $President `
        --secretary $Secretary `
        --token $TokenContract 2>&1) -join "`n"
    if ($LASTEXITCODE -ne 0) { throw "Deployment failed. Output: $deployOutput" }

    $contractMatches = [regex]::Matches($deployOutput, 'C[A-Z2-7]{55}')
    if ($contractMatches.Count -eq 0) {
        throw "Deployment completed without a recognizable contract ID. Output: $deployOutput"
    }
    $contractId = $contractMatches[$contractMatches.Count - 1].Value

    @(
        "VITE_CONTRACT_ID=$contractId"
        "VITE_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org"
        "VITE_TOKEN_SYMBOL=$TokenSymbol"
    ) | Set-Content -LiteralPath $frontendEnv -Encoding ascii

    Write-Host ""
    Write-Host "Deployment complete" -ForegroundColor Green
    Write-Host "Contract ID: $contractId"
    Write-Host "Token contract: $TokenContract"
    Write-Host "Frontend configuration: $frontendEnv"
    Write-Host "Explorer: https://stellar.expert/explorer/testnet/contract/$contractId"
    Write-Host "Restart the frontend with: cd frontend; npm run dev"
}
finally {
    Pop-Location
}
