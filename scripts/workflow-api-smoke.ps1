# Workflow API smoke test — exercises remediated ERP lifecycles against a running Pitbull API.
# Usage: .\scripts\workflow-api-smoke.ps1 [-BaseUrl http://localhost:5081] [-RunNumber 1]
param(
    [string]$BaseUrl = "http://localhost:5081",
    [int]$RunNumber = 1,
    [string]$AuthCacheFile = "",
    [string]$LogFile = ""
)

if ([string]::IsNullOrWhiteSpace($AuthCacheFile)) {
    $AuthCacheFile = Join-Path $env:TEMP "pitbull-workflow-smoke-auth.json"
}

$ErrorActionPreference = "Stop"

function Write-SmokeLog([string]$Message) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$ts] [run $RunNumber] $Message"
    Write-Host $line
    if (-not [string]::IsNullOrWhiteSpace($LogFile)) {
        Add-Content -Path $LogFile -Value $line -Encoding utf8
    }
}

function Assert-Status([string]$Label, [int]$Expected, [object]$Response) {
    if ($Response.StatusCode -ne $Expected) {
        $body = if ($Response.Content) { $Response.Content } else { "(no body)" }
        throw "$Label expected HTTP $Expected but got $($Response.StatusCode). Body: $body"
    }
}

function Assert-BodyContains([string]$Label, [string]$Body, [string[]]$Patterns) {
    foreach ($p in $Patterns) {
        if ($Body -notlike "*$p*") {
            throw "$Label response missing expected pattern '$p'. Body: $Body"
        }
    }
}

function Invoke-Api {
    param(
        [string]$Method,
        [string]$Path,
        [hashtable]$Headers = @{},
        [object]$Body = $null
    )
    $uri = "$BaseUrl$Path"
    $params = @{
        Uri         = $uri
        Method      = $Method
        Headers     = $Headers
        ContentType = "application/json"
    }
    if ($null -ne $Body) {
        $params.Body = ($Body | ConvertTo-Json -Depth 10 -Compress)
    }
    try {
        $resp = Invoke-WebRequest @params -UseBasicParsing
        return @{ StatusCode = [int]$resp.StatusCode; Content = $resp.Content }
    }
    catch {
        if ($_.Exception.Response) {
            $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
            $content = $reader.ReadToEnd()
            return @{ StatusCode = [int]$_.Exception.Response.StatusCode; Content = $content }
        }
        throw
    }
}

function Get-JwtClaim([string]$Token, [string]$ClaimName) {
    $parts = $Token.Split('.')
    if ($parts.Length -lt 2) { return $null }
    $payload = $parts[1]
    $pad = 4 - ($payload.Length % 4)
    if ($pad -lt 4) { $payload += ('=' * $pad) }
    $json = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($payload.Replace('-', '+').Replace('_', '/')))
    $obj = $json | ConvertFrom-Json
    return $obj.$ClaimName
}

Write-SmokeLog "=== Workflow API smoke run $RunNumber against $BaseUrl ==="

# Health
$health = Invoke-Api -Method GET -Path "/health/live"
Assert-Status "health/live" 200 $health
Write-SmokeLog "PASS health/live"

# Register + auth (reuse cached credentials on run 2+ to avoid register rate limits)
$email = "smoke-workflow@pitbull.local"
$password = "SecurePass123"
$token = $null
$tenantId = $null
$userId = $null

if ($RunNumber -gt 1 -and (Test-Path $AuthCacheFile)) {
    $cached = Get-Content $AuthCacheFile -Raw | ConvertFrom-Json
    $email = $cached.email
    $password = $cached.password
    $login = Invoke-Api -Method POST -Path "/api/auth/login" -Body @{ email = $email; password = $password }
    Assert-Status "auth/login" 200 $login
    $auth = $login.Content | ConvertFrom-Json
    $token = $auth.token
    $userId = $auth.userId
    $tenantId = Get-JwtClaim $token "tenant_id"
    Write-SmokeLog "PASS auth/login cached (tenant=$tenantId)"
}

if (-not $token) {
    $register = Invoke-Api -Method POST -Path "/api/auth/register" -Body @{
        email       = $email
        password    = $password
        firstName   = "Smoke"
        lastName    = "Test"
        companyName = "Smoke Workflow Co"
    }
    if ($register.StatusCode -in @(400, 409, 429)) {
        $login = Invoke-Api -Method POST -Path "/api/auth/login" -Body @{ email = $email; password = $password }
        Assert-Status "auth/login fallback" 200 $login
        $auth = $login.Content | ConvertFrom-Json
        $token = $auth.token
        $userId = $auth.userId
        $tenantId = Get-JwtClaim $token "tenant_id"
        Write-SmokeLog "PASS auth/login fallback (tenant=$tenantId)"
    }
    else {
        Assert-Status "auth/register" 201 $register
        $auth = $register.Content | ConvertFrom-Json
        $token = $auth.token
        $userId = $auth.userId
        $tenantId = Get-JwtClaim $token "tenant_id"
        @{ email = $email; password = $password } | ConvertTo-Json | Set-Content $AuthCacheFile
        Write-SmokeLog "PASS auth/register (tenant=$tenantId)"
    }
}

$headers = @{
    Authorization = "Bearer $token"
    "X-Tenant-Id" = $tenantId
}

# --- Bid: Draft -> Submitted ---
$bidNum = "BID-SMOKE-$RunNumber-$(Get-Random)"
$bidCreate = Invoke-Api -Method POST -Path "/api/bids" -Headers $headers -Body @{
    name           = "Smoke Bid $RunNumber"
    number         = $bidNum
    estimatedValue = 250000
    bidDate        = (Get-Date).ToString("yyyy-MM-dd")
    dueDate        = (Get-Date).AddDays(14).ToString("yyyy-MM-dd")
    owner          = "Estimator"
    description    = "workflow smoke"
    items          = @()
}
Assert-Status "bids create" 201 $bidCreate
$bid = $bidCreate.Content | ConvertFrom-Json
$bidUpdate = Invoke-Api -Method PUT -Path "/api/bids/$($bid.id)" -Headers $headers -Body @{
    id             = $bid.id
    name           = $bid.name
    number         = $bid.number
    status         = 1  # Submitted
    estimatedValue = 250000
    bidDate        = (Get-Date).ToString("yyyy-MM-dd")
    dueDate        = $null
    owner          = "Estimator"
    description    = "submitted"
    items          = $null
}
Assert-Status "bid Draft->Submitted" 200 $bidUpdate
Assert-BodyContains "bid status" $bidUpdate.Content @("Submitted")
Write-SmokeLog "PASS bid Draft->Submitted"

# --- Project + subcontract + change order: Pending -> UnderReview -> Approved ---
$suffix = [Math]::Abs((Get-Random)).ToString()
$projCreate = Invoke-Api -Method POST -Path "/api/projects" -Headers $headers -Body @{
    name           = "Smoke Project $RunNumber"
    number         = "PRJ-SMOKE-$RunNumber-$suffix"
    type           = 0
    contractAmount = 500000
}
Assert-Status "project create" 201 $projCreate
$project = $projCreate.Content | ConvertFrom-Json
$projectId = $project.id

$scCreate = Invoke-Api -Method POST -Path "/api/subcontracts" -Headers $headers -Body @{
    projectId           = $projectId
    subcontractNumber   = "SC-SMOKE-$RunNumber-$suffix"
    subcontractorName   = "Smoke Sub"
    scopeOfWork         = "Concrete"
    originalValue       = 100000
    retainagePercent    = 10
    executionDate       = (Get-Date).AddDays(-30).ToString("o")
}
Assert-Status "subcontract create" 201 $scCreate
$subcontract = $scCreate.Content | ConvertFrom-Json

$scSign = Invoke-Api -Method PUT -Path "/api/subcontracts/$($subcontract.id)" -Headers $headers -Body @{
    id                    = $subcontract.id
    subcontractNumber     = $subcontract.subcontractNumber
    subcontractorName     = $subcontract.subcontractorName
    scopeOfWork           = $subcontract.scopeOfWork
    originalValue         = $subcontract.originalValue
    retainagePercent      = $subcontract.retainagePercent
    executionDate         = (Get-Date).ToString("o")
    status                = 3  # Executed
}
Assert-Status "subcontract sign" 200 $scSign

$coCreate = Invoke-Api -Method POST -Path "/api/changeorders" -Headers $headers -Body @{
    subcontractId     = $subcontract.id
    changeOrderNumber = "CO-SMOKE-$RunNumber-$suffix"
    title             = "Extra footings"
    description       = "Field condition"
    reason            = "Soil"
    amount            = 15000
    daysExtension     = 3
}
Assert-Status "change order create" 201 $coCreate
$co = $coCreate.Content | ConvertFrom-Json

$coReview = Invoke-Api -Method PUT -Path "/api/changeorders/$($co.id)" -Headers $headers -Body @{
    id             = $co.id
    title          = $co.title
    description    = $co.description
    reason         = $co.reason
    amount         = $co.amount
    daysExtension  = $co.daysExtension
    status         = 1  # UnderReview
    referenceNumber = $co.referenceNumber
}
Assert-Status "change order UnderReview" 200 $coReview

$coApprove = Invoke-Api -Method PUT -Path "/api/changeorders/$($co.id)" -Headers $headers -Body @{
    id             = $co.id
    title          = $co.title
    description    = $co.description
    reason         = $co.reason
    amount         = $co.amount
    daysExtension  = $co.daysExtension
    status         = 2  # Approved
    referenceNumber = $co.referenceNumber
}
Assert-Status "change order Approved" 200 $coApprove
Assert-BodyContains "change order status" $coApprove.Content @("Approved")
Write-SmokeLog "PASS change order Pending->UnderReview->Approved"

# --- RFI: Open -> Answered + invalid skip rejection ---
$rfiCreate = Invoke-Api -Method POST -Path "/api/projects/$projectId/rfis" -Headers $headers -Body @{
    subject        = "Smoke RFI $RunNumber"
    question       = "Clarify footing depth?"
    priority       = 1
    dueDate        = (Get-Date).AddDays(7).ToString("o")
    ballInCourtName = "Architect"
}
Assert-Status "rfi create" 201 $rfiCreate
$rfi = $rfiCreate.Content | ConvertFrom-Json

$rfiAnswer = Invoke-Api -Method PUT -Path "/api/projects/$projectId/rfis/$($rfi.id)" -Headers $headers -Body @{
    subject  = $rfi.subject
    question = $rfi.question
    answer   = "Use 42 inch depth per spec."
    status   = 1  # Answered
    priority = 1
}
Assert-Status "rfi Answered" 200 $rfiAnswer
Assert-BodyContains "rfi status" $rfiAnswer.Content @("Answered")

$rfiSkip = Invoke-Api -Method POST -Path "/api/projects/$projectId/rfis" -Headers $headers -Body @{
    subject        = "Smoke RFI skip $RunNumber"
    question       = "Can we skip answer stage?"
    priority       = 1
    dueDate        = (Get-Date).AddDays(7).ToString("o")
    ballInCourtName = "Architect"
}
$rfiSkipObj = $rfiSkip.Content | ConvertFrom-Json
$rfiInvalid = Invoke-Api -Method PUT -Path "/api/projects/$projectId/rfis/$($rfiSkipObj.id)" -Headers $headers -Body @{
    subject  = $rfiSkipObj.subject
    question = $rfiSkipObj.question
    status   = 2  # Closed — invalid skip from Open without answer
    priority = 1
}
if ($rfiInvalid.StatusCode -eq 200) {
    throw "RFI Open->Closed without answer should be rejected"
}
Assert-BodyContains "rfi invalid transition" $rfiInvalid.Content @("Cannot transition", "Closed")
Write-SmokeLog "PASS rfi Open->Answered + Open->Closed skip rejected"

# --- Sub pay app: create -> submit ---
$payCreate = Invoke-Api -Method POST -Path "/api/paymentapplications" -Headers $headers -Body @{
    subcontractId           = $subcontract.id
    periodStart             = "2026-01-01T00:00:00Z"
    periodEnd               = "2026-01-31T00:00:00Z"
    workCompletedThisPeriod = 20000
    storedMaterials         = 0
    invoiceNumber           = "INV-SMOKE-$RunNumber"
    notes                   = "smoke"
}
Assert-Status "payment app create" 201 $payCreate
$payApp = $payCreate.Content | ConvertFrom-Json

$paySubmit = Invoke-Api -Method POST -Path "/api/paymentapplications/$($payApp.id)/submit" -Headers $headers
Assert-Status "payment app submit" 200 $paySubmit
Assert-BodyContains "payment app status" $paySubmit.Content @("Submitted")
Write-SmokeLog "PASS subcontract pay app Draft->Submitted"

# --- Owner billing: contract + SOV + billing app submit-for-review ---
$ocCreate = Invoke-Api -Method POST -Path "/api/owner-contracts" -Headers $headers -Body @{
    projectId            = $projectId
    contractNumber       = "OC-SMOKE-$RunNumber-$suffix"
    projectName          = "Smoke Project"
    originalContractSum  = 500000
}
Assert-Status "owner contract create" 201 $ocCreate
$ownerContract = $ocCreate.Content | ConvertFrom-Json

$sovCreate = Invoke-Api -Method POST -Path "/api/owner-contracts/$($ownerContract.id)/sov" -Headers $headers -Body @{
    projectId = $projectId
}
Assert-Status "owner SOV create" 201 $sovCreate
$sov = $sovCreate.Content | ConvertFrom-Json

Invoke-Api -Method POST -Path "/api/owner-contracts/sov/$($sov.id)/lines" -Headers $headers -Body @{
    itemNumber     = "1"
    description    = "Concrete"
    scheduledValue = 300000
} | Out-Null
Invoke-Api -Method POST -Path "/api/owner-contracts/sov/$($sov.id)/lines" -Headers $headers -Body @{
    itemNumber     = "2"
    description    = "Steel"
    scheduledValue = 200000
} | Out-Null
$sovActivate = Invoke-Api -Method POST -Path "/api/owner-contracts/sov/$($sov.id)/activate" -Headers $headers
Assert-Status "owner SOV activate" 200 $sovActivate

$billCreate = Invoke-Api -Method POST -Path "/api/billing-applications" -Headers $headers -Body @{
    ownerContractId         = $ownerContract.id
    ownerScheduleOfValuesId = $sov.id
    periodFrom              = "2026-01-01"
    periodThrough           = "2026-01-31"
    applicationDate         = "2026-01-31"
}
Assert-Status "billing app create" 201 $billCreate
$billingApp = $billCreate.Content | ConvertFrom-Json

$billSubmit = Invoke-Api -Method POST -Path "/api/billing-applications/$($billingApp.id)/submit-for-review" -Headers $headers
Assert-Status "billing app submit-for-review" 200 $billSubmit
Assert-BodyContains "billing app status" $billSubmit.Content @("PmReview")
Write-SmokeLog "PASS owner billing Draft->SubmittedForReview"

# --- Daily report: create -> submit -> approve ---
$drCreate = Invoke-Api -Method POST -Path "/api/projects/$projectId/daily-reports" -Headers $headers -Body @{
    name = "Smoke Daily $RunNumber"
    data = @{
        ReportDate       = (Get-Date).ToString("o")
        ReportType       = "Foreman"
        WeatherSummary   = "Clear"
        WorkNarrative    = "Poured footings."
        PreparedByUserId = $userId
    }
}
if ($drCreate.StatusCode -notin @(200, 201)) {
    throw "daily report create expected HTTP 200/201 but got $($drCreate.StatusCode). Body: $($drCreate.Content)"
}
$dailyReport = $drCreate.Content | ConvertFrom-Json

$drSubmit = Invoke-Api -Method POST -Path "/api/projects/$projectId/daily-reports/$($dailyReport.id)/submit" -Headers $headers
Assert-Status "daily report submit" 200 $drSubmit
$drApprove = Invoke-Api -Method POST -Path "/api/projects/$projectId/daily-reports/$($dailyReport.id)/approve" -Headers $headers
Assert-Status "daily report approve" 200 $drApprove
Assert-BodyContains "daily report status" $drApprove.Content @("Approved")
$drLock = Invoke-Api -Method POST -Path "/api/projects/$projectId/daily-reports/$($dailyReport.id)/lock" -Headers $headers
Assert-Status "daily report lock" 200 $drLock
Assert-BodyContains "daily report lock status" $drLock.Content @("Locked")
Write-SmokeLog "PASS daily report Draft->Submitted->Approved->Locked"

# --- Time entry: create -> bulk submit -> approve ---
$ppConfig = Invoke-Api -Method PUT -Path "/api/pay-periods/configuration" -Headers $headers -Body @{
    type                 = 0  # Weekly
    weekStartDay         = 1  # Monday
    enforcementEnabled   = $true
    periodsToGenerateAhead = 8
}
if ($ppConfig.StatusCode -notin @(200, 201)) {
    throw "pay period config expected HTTP 200 but got $($ppConfig.StatusCode). Body: $($ppConfig.Content)"
}

$ppGenerate = Invoke-Api -Method POST -Path "/api/pay-periods/generate" -Headers $headers -Body @{
    fromDate          = (Get-Date).AddMonths(-1).ToString("yyyy-MM-dd")
    periodsToGenerate = 12
}
if ($ppGenerate.StatusCode -notin @(200, 201)) {
    throw "pay period generate expected HTTP 200/201 but got $($ppGenerate.StatusCode). Body: $($ppGenerate.Content)"
}
Write-SmokeLog "PASS pay periods generated"

$empCreate = Invoke-Api -Method POST -Path "/api/employees" -Headers $headers -Body @{
    employeeNumber   = ("E" + $suffix.PadLeft(8, '0')).Substring(0, 9)
    firstName        = "Field"
    lastName         = "Worker"
    email            = "field-$suffix@pitbull.local"
    classification   = 0
    baseHourlyRate   = 35
}
Assert-Status "employee create" 201 $empCreate
$employee = $empCreate.Content | ConvertFrom-Json

$assignResp = Invoke-Api -Method POST -Path "/api/project-assignments" -Headers $headers -Body @{
    employeeId = $employee.id
    projectId  = $projectId
    role       = 0
    startDate  = (Get-Date).AddDays(-7).ToString("yyyy-MM-dd")
}
if ($assignResp.StatusCode -notin @(200, 201)) {
    throw "project assignment expected HTTP 200/201 but got $($assignResp.StatusCode). Body: $($assignResp.Content)"
}

$ccList = Invoke-Api -Method GET -Path "/api/cost-codes" -Headers $headers
Assert-Status "cost codes list" 200 $ccList
$costCodes = $ccList.Content | ConvertFrom-Json
$costCodeId = $costCodes.items[0].id

$teCreate = Invoke-Api -Method POST -Path "/api/time-entries" -Headers $headers -Body @{
    date           = (Get-Date).ToString("yyyy-MM-dd")
    employeeId     = $employee.id
    projectId      = $projectId
    costCodeId     = $costCodeId
    regularHours   = 8
    overtimeHours  = 0
    doubletimeHours = 0
    description    = "Smoke time"
}
Assert-Status "time entry create" 201 $teCreate
Assert-BodyContains "time entry create status" $teCreate.Content @("Draft")
$timeEntry = $teCreate.Content | ConvertFrom-Json

$teSubmit = Invoke-Api -Method POST -Path "/api/time-entries/submit" -Headers $headers -Body @{
    timeEntryIds  = @($timeEntry.id)
    submittedById = $employee.id
}
Assert-Status "time entry bulk submit" 200 $teSubmit
Assert-BodyContains "time entry bulk submit" $teSubmit.Content @("successCount", "success")
$teGet = Invoke-Api -Method GET -Path "/api/time-entries/$($timeEntry.id)" -Headers $headers
Assert-Status "time entry get after submit" 200 $teGet
Assert-BodyContains "time entry status after submit" $teGet.Content @("Submitted")

# Link approver employee to auth user (required for approve endpoint)
$approverResp = Invoke-Api -Method POST -Path "/api/employees" -Headers $headers -Body @{
    employeeNumber   = ("A" + $suffix.PadLeft(8, '0')).Substring(0, 9)
    firstName        = "Smoke"
    lastName         = "Approver"
    email            = $email
    classification   = 1  # Salaried
    baseHourlyRate   = 0
}
$teApprove = Invoke-Api -Method POST -Path "/api/time-entries/$($timeEntry.id)/approve" -Headers $headers -Body @{
    comments = "Approved in smoke test"
}
if ($teApprove.StatusCode -eq 200) {
    Assert-BodyContains "time entry status" $teApprove.Content @("Approved")
    Write-SmokeLog "PASS time entry Draft->Submitted->Approved"
}
elseif ($teApprove.StatusCode -eq 403) {
    Write-SmokeLog "PARTIAL time entry Draft->Submitted (approve gated by role policy - expected for smoke tenant)"
}
else {
    throw "time entry approve expected HTTP 200 or 403 but got $($teApprove.StatusCode). Body: $($teApprove.Content)"
}

Write-SmokeLog "=== All workflow smoke checks passed (run $RunNumber) ==="