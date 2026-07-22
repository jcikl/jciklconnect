param(
  [switch]$SkipSchemaSync,
  [switch]$SkipAudit,
  [switch]$SkipPlan,
  [switch]$ApplyOnly,
  [switch]$WithRelationBackfill
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$scriptDir = Split-Path -Parent $PSCommandPath
$projectRoot = (Resolve-Path (Join-Path $scriptDir "..\..")).Path
$statePath = Join-Path $projectRoot ".lark-jcikl-state.json"
$credentialPath = Join-Path $projectRoot "serviceAccountKey.json"
$migrationScript = Join-Path $projectRoot "scripts\lark\migrate-firestore-to-lark.mjs"
$reportPath = Join-Path $projectRoot "lark-migration-report.json"
$defaultAppId = "cli_aaea739ab3219eef"

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Require-File {
  param([string]$Path, [string]$Description)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "$Description not found: $Path"
  }
}

function Invoke-Checked {
  param(
    [string]$Label,
    [string]$Command,
    [string[]]$Arguments = @()
  )

  Write-Step $Label
  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Label failed with exit code $LASTEXITCODE."
  }
}

function Set-SecretFromPrompt {
  if ($env:LARK_APP_SECRET) {
    Write-Host "Using LARK_APP_SECRET already set in this PowerShell process."
    return
  }

  Write-Host ""
  Write-Host "Enter the freshly reset Lark App Secret. Input is hidden and will not be printed." -ForegroundColor Yellow
  $secure = Read-Host "LARK_APP_SECRET" -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    if ([string]::IsNullOrWhiteSpace($plain)) {
      throw "LARK_APP_SECRET cannot be empty."
    }
    $env:LARK_APP_SECRET = $plain
  }
  finally {
    if ($bstr -ne [IntPtr]::Zero) {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
  }
}

function Assert-MigrationCompatibilityPatch {
  $content = Get-Content -LiteralPath $migrationScript -Raw
  if ($content -notmatch "limit=200") {
    throw "Migration script is missing the Lark list-records limit=200 compatibility patch."
  }
  if ($content -notmatch "single-record writes") {
    throw "Migration script is missing the batch_create single-record fallback patch."
  }
}

function Show-ReportSummary {
  Require-File $reportPath "Migration report"
  $report = Get-Content -LiteralPath $reportPath -Raw | ConvertFrom-Json

  Write-Host ""
  Write-Host "Migration report summary" -ForegroundColor Green
  $report.totals | Format-List

  Write-Host "Table counts"
  $report.tables.PSObject.Properties |
    Sort-Object Name |
    ForEach-Object {
      $table = $_.Value
      [PSCustomObject]@{
        table = $_.Name
        source = $table.source
        existing = if ($null -ne $table.existing) { $table.existing } else { 0 }
        create = $table.create
      }
    } |
    Format-Table -AutoSize

  if ($report.mode -ne "apply") {
    throw "Expected an apply report, but report mode is '$($report.mode)'."
  }
  if ($null -eq $report.completedAt) {
    throw "Apply report does not contain completedAt."
  }
}

Push-Location $projectRoot
try {
  Write-Step "Checking required files"
  Require-File $statePath "Lark state file"
  Require-File $credentialPath "Firebase service account"
  Require-File $migrationScript "Migration script"

  $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
  if ([string]::IsNullOrWhiteSpace($state.baseToken)) {
    throw "Base token missing from .lark-jcikl-state.json."
  }

  $env:LARK_BASE_TOKEN = $state.baseToken
  if (-not $env:LARK_APP_ID) {
    $env:LARK_APP_ID = $defaultAppId
  }
  $env:GOOGLE_APPLICATION_CREDENTIALS = (Resolve-Path $credentialPath).Path
  Remove-Item Env:LARK_FOLDER_TOKEN -ErrorAction SilentlyContinue

  Set-SecretFromPrompt
  Assert-MigrationCompatibilityPatch

  $node = (Get-Command node -ErrorAction Stop).Source
  $npm = (Get-Command npm.cmd -ErrorAction SilentlyContinue)
  if (-not $npm) {
    $npm = Get-Command npm -ErrorAction Stop
  }

  Invoke-Checked "Checking migration JavaScript syntax" $node @("--check", $migrationScript)

  if (-not $ApplyOnly) {
    if (-not $SkipSchemaSync) {
      Invoke-Checked "Syncing Lark Base schema" $npm.Source @("run", "lark:base:create")
    }
    if (-not $SkipAudit) {
      Invoke-Checked "Auditing Firestore inventory" $npm.Source @("run", "lark:migrate:audit")
    }
    if (-not $SkipPlan) {
      Invoke-Checked "Generating dry-run migration plan" $npm.Source @("run", "lark:migrate:plan")
    }
  }

  Invoke-Checked "Applying Firestore records to Lark Base" $npm.Source @("run", "lark:migrate:apply")
  Show-ReportSummary

  if ($WithRelationBackfill) {
    Invoke-Checked "Planning Lark linked-record backfill" $npm.Source @("run", "lark:relations:plan")
    Invoke-Checked "Applying Lark linked-record backfill" $npm.Source @("run", "lark:relations:apply")
  }

  Write-Host ""
  if ($WithRelationBackfill) {
    Write-Host "Base record import and linked-record backfill completed." -ForegroundColor Green
  }
  else {
    Write-Host "Base record import completed. Run npm run lark:relations:plan before applying linked-record backfill." -ForegroundColor Green
  }
  Write-Host "Report: $reportPath"
}
finally {
  Remove-Item Env:LARK_APP_SECRET -ErrorAction SilentlyContinue
  Pop-Location
}
