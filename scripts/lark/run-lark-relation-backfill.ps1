param(
  [switch]$PlanOnly
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$scriptDir = Split-Path -Parent $PSCommandPath
$projectRoot = (Resolve-Path (Join-Path $scriptDir "..\..")).Path
$statePath = Join-Path $projectRoot ".lark-jcikl-state.json"
$backfillScript = Join-Path $projectRoot "scripts\lark\backfill-lark-relations.mjs"
$reportPath = Join-Path $projectRoot "lark-relation-backfill-report.json"
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

function Show-BackfillSummary {
  Require-File $reportPath "Relation backfill report"
  $report = Get-Content -LiteralPath $reportPath -Raw | ConvertFrom-Json

  Write-Host ""
  Write-Host "Relation backfill report summary" -ForegroundColor Green
  $report.totals | Format-List

  Write-Host "Relations"
  $report.relations.PSObject.Properties |
    Sort-Object Name |
    ForEach-Object {
      $relation = $_.Value
      [PSCustomObject]@{
        relation = $_.Name
        scanned = $relation.scanned
        updates = $relation.updates
        alreadyLinked = $relation.alreadyLinked
        missingSourceId = $relation.missingSourceId
        missingTarget = $relation.missingTarget
        ambiguousTarget = $relation.ambiguousTarget
      }
    } |
    Format-Table -AutoSize
}

Push-Location $projectRoot
try {
  Write-Step "Checking required files"
  Require-File $statePath "Lark state file"
  Require-File $backfillScript "Relation backfill script"

  $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
  if ([string]::IsNullOrWhiteSpace($state.baseToken)) {
    throw "Base token missing from .lark-jcikl-state.json."
  }

  $env:LARK_BASE_TOKEN = $state.baseToken
  if (-not $env:LARK_APP_ID) {
    $env:LARK_APP_ID = $defaultAppId
  }
  Remove-Item Env:LARK_FOLDER_TOKEN -ErrorAction SilentlyContinue

  Set-SecretFromPrompt

  $node = (Get-Command node -ErrorAction Stop).Source
  $npm = (Get-Command npm.cmd -ErrorAction SilentlyContinue)
  if (-not $npm) {
    $npm = Get-Command npm -ErrorAction Stop
  }

  Invoke-Checked "Checking relation backfill JavaScript syntax" $node @("--check", $backfillScript)
  Invoke-Checked "Planning Lark linked-record backfill" $npm.Source @("run", "lark:relations:plan")

  if (-not $PlanOnly) {
    Invoke-Checked "Applying Lark linked-record backfill" $npm.Source @("run", "lark:relations:apply")
  }

  Show-BackfillSummary

  Write-Host ""
  if ($PlanOnly) {
    Write-Host "Relation backfill plan completed. No Lark records were changed." -ForegroundColor Green
  }
  else {
    Write-Host "Relation backfill completed." -ForegroundColor Green
  }
  Write-Host "Report: $reportPath"
}
finally {
  Remove-Item Env:LARK_APP_SECRET -ErrorAction SilentlyContinue
  Pop-Location
}
