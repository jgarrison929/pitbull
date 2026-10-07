[CmdletBinding()]
param(
    [string]$Ts = (Get-Date -Format 'yyyyMMdd-HHmmss'),
    [string]$Prefix = 'verify',
    [string]$ApiUrl = 'http://localhost:5081',
    [string]$EvidenceDir = (Join-Path $PSScriptRoot 'evidence'),
    [ValidateSet('all','login-explore-as-role','projects-workspace','time-tracking','contracts-aia-billing','daily-reports-field','payroll-runs-union-certified')]
    [string]$Feature = 'all',
    # Also probe demo-role-login for pm and the PR #583-only 'payroll' key. Each call spends a permit of the
    # 'demo-register' limiter (10 per hour per client IP, shared with /demo-register and the /login role buttons).
    [switch]$ProbeDemoKeys
)
# Read-only live API smoke for verify-pitbull. GET-only except: auth logins, and POSTs to
# /api/payroll/* as a *demo* principal, which DemoRestrictionMiddleware rejects with 403 DEMO_READ_ONLY
# before routing (generate uses an all-zero payPeriodId so even a non-demo principal could not create a run).
# Never starts/stops anything. Writes <Prefix>-<Ts>-<feature>-*.json under $EvidenceDir.
$ErrorActionPreference = 'Continue'
$ev = $EvidenceDir
$api = $ApiUrl.TrimEnd('/')
$pw = 'PitbullDemo2026!'
function Want([string]$f) { return ($Feature -eq 'all' -or $Feature -eq $f) }
$S = [ordered]@{}
function Call($method, $path, $token, $body, $name) {
  $r = $null; $h = @{}; if ($token) { $h.Authorization = "Bearer $token" }
  $args2 = @{ Uri = "$api$path"; Method = $method; Headers = $h; UseBasicParsing = $true; TimeoutSec = 30; ContentType = 'application/json' }
  if ($body -ne $null) { $args2.Body = ($body | ConvertTo-Json -Compress -Depth 6) }
  try { $r = Invoke-WebRequest @args2; $code = [int]$r.StatusCode; $content = $r.Content; $ct = $r.Headers['Content-Type'] }
  catch { $resp = $_.Exception.Response; if ($resp) { $code = [int]$resp.StatusCode; try { $sr = New-Object IO.StreamReader($resp.GetResponseStream()); $content = $sr.ReadToEnd() } catch { $content = '' } } else { $code = -1; $content = $_.Exception.Message }; $ct = '' }
  if ($name) { if ($ct -like 'application/pdf*') { "$code pdf len=$($r.RawContentLength)" | Set-Content "$ev\$Prefix-$Ts-$name.txt" } else { $content | Set-Content "$ev\$Prefix-$Ts-$name.json" -Encoding utf8 } }
  return [pscustomobject]@{ Code = $code; Body = $content; Ct = $ct; Len = $(if($r){$r.RawContentLength}else{0}) }
}
# login-explore-as-role
$r = Call GET '/api/auth/demo-roles' $null $null 'login-explore-as-role-demo-roles'; $S.demoRoles = $r.Code
try { $S.demoRoleKeys = (($r.Body | ConvertFrom-Json) | % { "$($_.key)=$($_.email)" }) -join ',' } catch { $S.demoRoleKeys = 'parse-fail' }
$r = Call POST '/api/auth/demo-role-login' $null @{ role = 'ceo' } 'login-explore-as-role-demo-ceo'; $S.demoLoginCeo = $r.Code; $ceo = $null; try { $ceo = ($r.Body | ConvertFrom-Json).token } catch {}
if ($S.demoLoginCeo -eq 429 -or -not $ceo) { $S.demoLoginCeoFallback = 'password login (demo-register limiter exhausted or demo login failed)'; $r = Call POST '/api/auth/login' $null @{ email = 'ceo@demo.local'; password = $pw } 'login-explore-as-role-pw-ceo'; $S.pwLoginCeo = $r.Code; $ceo = ($r.Body | ConvertFrom-Json).token }
if ($ProbeDemoKeys) {
  $r = Call POST '/api/auth/demo-role-login' $null @{ role = 'pm' } 'login-explore-as-role-demo-pm'; $S.demoLoginPm = $r.Code
  $r = Call POST '/api/auth/demo-role-login' $null @{ role = 'payroll' } 'login-explore-as-role-demo-payroll'; $S.demoLoginPayroll = "$($r.Code) $($r.Body)"
}
$r = Call POST '/api/auth/login' $null @{ email = 'pm@demo.local'; password = $pw } 'login-explore-as-role-pw-pm'; $S.pwLoginPm = $r.Code; $pm = ($r.Body | ConvertFrom-Json).token
$r = Call POST '/api/auth/login' $null @{ email = 'mgr-payroll@demo.local'; password = $pw } 'login-explore-as-role-pw-payroll'; $S.pwLoginPayroll = $r.Code; $pay = ($r.Body | ConvertFrom-Json).token
$r = Call POST '/api/auth/login' $null @{ email = 'payroll@demo.local'; password = $pw } $null; $S.pwLoginPayrollAtDemo = $r.Code
$r = Call GET '/api/auth/me' $ceo $null 'login-explore-as-role-me-ceo'; $S.meCeo = $r.Code; try { $m = $r.Body | ConvertFrom-Json; $S.meCeoRoles = ($m.roles -join ','); $S.meCeoEmail = $m.email } catch {}
$r = Call GET '/api/auth/me' $pm $null $null; $S.mePm = $r.Code
# projects-workspace (always runs: the project list also feeds daily-reports-field)
$r = Call GET '/api/projects?page=1&pageSize=50' $pm $null 'projects-workspace-list-pm'; $S.projectsPm = $r.Code
$projects = @(); try { $projects = ($r.Body | ConvertFrom-Json).items } catch {}
$S.projectCountPm = $projects.Count
if ($projects.Count -gt 0) { $pid0 = $projects[0].id; $r = Call GET "/api/projects/$pid0" $pm $null 'projects-workspace-detail-pm'; $S.projectDetail = "$($r.Code) $($projects[0].name)"; $r = Call GET "/api/projects/$pid0/stats" $pm $null 'projects-workspace-stats-pm'; $S.projectStats = $r.Code }
$r = Call GET '/api/projects?page=1&pageSize=50' $ceo $null $null; try { $S.projectCountCeo = ($r.Body | ConvertFrom-Json).totalCount } catch {}
if (Want 'time-tracking') {
$r = Call GET '/api/time-entries?page=1&pageSize=25' $pm $null 'time-tracking-entries-pm'; $S.timeEntriesPm = $r.Code; try { $t = $r.Body | ConvertFrom-Json; $S.timeEntriesTotal = $t.totalCount; $S.timeStatuses = (($t.items | Group-Object status | % { "$($_.Name)=$($_.Count)" }) -join ',') } catch {}
$r = Call GET '/api/time-entries/review-queue' $pm $null 'time-tracking-review-queue-pm'; $S.timeReviewQueue = $r.Code
}
if (Want 'contracts-aia-billing') {
$r = Call GET '/api/owner-contracts?page=1&pageSize=25' $ceo $null 'contracts-aia-billing-owner-contracts'; $S.ownerContracts = $r.Code; $oc = @(); try { $oc = ($r.Body | ConvertFrom-Json).items; $S.ownerContractCount = ($r.Body | ConvertFrom-Json).totalCount } catch {}
if ($oc.Count -gt 0) { $r = Call GET "/api/owner-contracts/$($oc[0].id)/sov" $ceo $null 'contracts-aia-billing-sov'; $S.ownerContractSov = $r.Code }
$r = Call GET '/api/billing-applications?page=1&pageSize=25' $ceo $null 'contracts-aia-billing-applications'; $S.billingApps = $r.Code; $ba = @(); try { $ba = ($r.Body | ConvertFrom-Json).items; $S.billingAppCount = ($r.Body | ConvertFrom-Json).totalCount; $S.billingStatuses = (($ba | Group-Object status | % { "$($_.Name)=$($_.Count)" }) -join ',') } catch {}
if ($ba.Count -gt 0) { $r = Call GET "/api/billing-applications/$($ba[0].id)" $ceo $null 'contracts-aia-billing-application-detail'; $S.billingAppDetail = $r.Code }
$r = Call GET '/api/subcontracts?page=1&pageSize=10' $ceo $null 'contracts-aia-billing-subcontracts'; $S.subcontracts = $r.Code
}
if (Want 'daily-reports-field') {
$S.dailyByProject = [ordered]@{}; $seen = 0; $dr = $null
foreach ($p in $projects) { $r = Call GET "/api/projects/$($p.id)/daily-reports?page=1&pageSize=10" $pm $null $null; $cnt = $null; try { $cnt = ($r.Body | ConvertFrom-Json).totalCount } catch {}; $seen++; $S.dailyByProject["$($p.name) [$($p.id)]"] = "$($r.Code) total=$cnt"; if (-not $dr -and $cnt -gt 0) { $dr = @{ p = $p.id; body = $r.Body } } }
if ($dr) { $dr.body | Set-Content "$ev\$Prefix-$Ts-daily-reports-field-list.json" -Encoding utf8; $first = (($dr.body | ConvertFrom-Json).items)[0]; $r = Call GET "/api/projects/$($dr.p)/daily-reports/$($first.id)" $pm $null 'daily-reports-field-detail'; $S.dailyDetail = $r.Code }
$r = Call GET '/api/daily-reports' $pm $null $null; $S.dailyTopLevelApi = $r.Code
}
if (Want 'payroll-runs-union-certified') {
$r = Call GET '/api/pay-periods?page=1&pageSize=25' $pay $null 'payroll-runs-union-certified-pay-periods'; $S.payPeriods = $r.Code; try { $S.payPeriodStatuses = (((($r.Body | ConvertFrom-Json).items) | Group-Object status | % { "$($_.Name)=$($_.Count)" }) -join ',') } catch {}
$r = Call GET '/api/payroll/runs?page=1&pageSize=10' $pay $null 'payroll-runs-union-certified-runs'; $S.payrollRuns = $r.Code; $runs = @(); try { $runs = ($r.Body | ConvertFrom-Json).items; $S.payrollRunCount = ($r.Body | ConvertFrom-Json).totalCount; $S.runStatuses = (($runs | Group-Object status | % { "$($_.Name)=$($_.Count)" }) -join ',') } catch {}
$S.runsNetIsProxyField = ($r.Body -match '"netIsProxy"')
if ($runs.Count -gt 0) { $rid = $runs[0].id; $S.runId = $rid; $r = Call GET "/api/payroll/runs/$rid" $pay $null 'payroll-runs-union-certified-run-detail'; $S.runDetail = $r.Code; $r = Call GET "/api/payroll/certified/$rid/wh347-pdf" $pay $null 'payroll-runs-union-certified-wh347'; $S.wh347 = "$($r.Code) $($r.Ct) len=$($r.Len)"; $r = Call GET "/api/payroll/certified/$rid" $pay $null $null; $S.certifiedById = $r.Code }
$r = Call GET '/api/payroll/certified' $pay $null 'payroll-runs-union-certified-certified-list'; $S.certifiedList = $r.Code
# PR #583-only union catalog; 404 is expected on a main-based build (see payroll feature doc).
foreach ($x in 'agreements','packages','classifications','components') { $r = Call GET "/api/payroll/$x" $pay $null $null; $S["payroll-$x"] = $r.Code }
$r = Call GET '/api/payroll/wage-determinations' $pay $null $null; $S.wageDeterminations = $r.Code
$r = Call GET '/api/payroll/reviews' $pay $null $null; $S.payrollReviews = $r.Code
$r = Call GET '/api/payroll/exports' $pay $null $null; $S.payrollExports = $r.Code
# Demo read-only proof: expect 403 DEMO_READ_ONLY (all-zero payPeriodId, so no run can be created).
$r = Call POST '/api/payroll/runs/generate' $pay @{ payPeriodId = '00000000-0000-0000-0000-000000000000' } 'payroll-runs-union-certified-generate-demo-attempt'; $S.generateDemo = "$($r.Code) $($r.Body)"
}
$S.feature = $Feature; $S.apiUrl = $api; $S.ts = $Ts
$S | ConvertTo-Json -Depth 5 | Set-Content "$ev\$Prefix-$Ts-api-summary.json" -Encoding utf8
$S | ConvertTo-Json -Depth 5
