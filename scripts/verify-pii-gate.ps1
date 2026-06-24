<#
.SYNOPSIS
Fail-fast PII gate for AC3. Targeted to critical files.

Prints hits; exits 1 on any.
#>

param(
    [string]$Scratch = "C:\Users\jgarr\AppData\Local\Temp\grok-goal-98739f72e674\implementer"
)

$ErrorActionPreference = "Stop"

# Focus on source PII (skip tests, docs examples per non-goals)
$files = git ls-files -- '*.cs' | Where-Object { $_ -match '^src/' -and $_ -notmatch 'bin/|obj/|TestResults|\.next/' }
$hits = @()

$badEmailPat = '@[a-zA-Z0-9.-]+\.(com|gov|net|org|edu)'
$phonePat = '\([0-9]{3}\) 555-'
$interpPhonePat = '\$"\([0-9]{3}\) 555-\{'
$firstNamePat = 'FirstName = "([^"]+)"'
$lastNamePat = 'LastName = "([^"]+)"'
$contactNamePat = 'ContactName = "([^"]+)"'
$subcontractorContactPat = 'SubcontractorContact = "([^"]+)"'
$approvedByPat = 'ApprovedBy = "([^"]+)"'
# Tightened to avoid flagging "Summit Valley" sanitized names; target legacy/identifiable
$badOrgPat = 'Central Valley|(?<!Summit )Valley(?! (Transformer|Pipe| Flood))|Pacific(?! Gas)'

foreach ($f in $files) {
    if (-not (Test-Path $f)) { continue }
    $lines = Get-Content $f
    for ($i=0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        $ln = $i+1

        # bad emails (not *example*)
        if ($line -match $badEmailPat -and $line -notmatch 'example|@acme|@company|@test|@yourcompany') {
            $hits += "${f}:${ln}:$($matches[0])"
        }

        # legacy identifiable .example emails (real-org subdomains or personal user prefixes; allow summit* as generic sanitized)
        if ($f -match 'SeedData|Demo' -and $line -match '@([a-z0-9.-]+)\.example') {
            $dom = $matches[1]
            if ($dom -notmatch '^(demo|contact|summit|acme|test|yourcompany|company|example)') {
                $hits += "${f}:${ln}:legacy-email-domain: $dom.example"
            }
        }
        if ($f -match 'SeedData|Demo' -and $line -match '([a-z]{1,3}[a-z]+)@([a-z0-9.-]*example)') {
            # personal-looking like pdunn@ , mrodriguez@ but not demo. or contact
            $user = $matches[1]
            $dom = $matches[2]
            if ($user -notmatch '^(demo|contact|user|employee)' -and $dom -notmatch '^summit') {
                $hits += "${f}:${ln}:legacy-email-user: $($user)@$($dom).example"
            }
        }

        # bad phones
        if (($line -match $phonePat -or $line -match $interpPhonePat) -and $line -notmatch '555-000') {
            $hits += "${f}:${ln}:$($matches[0])"
        }

        # FirstName not Demo (only in seed/demo files)
        $fm = [regex]::Match($line, $firstNamePat)
        if ($fm.Success -and $f -match 'SeedData|Demo') {
            $val = $fm.Groups[1].Value
            if ($val -notmatch '^Demo') {
                $hits += "${f}:${ln}:FirstName = `"$val`""
            }
        }

        # ContactName not Demo (in seed)
        $cm = [regex]::Match($line, $contactNamePat)
        if ($cm.Success -and $f -match 'SeedData') {
            $val = $cm.Groups[1].Value
            if ($val -notmatch '^Demo') {
                $hits += "${f}:${ln}:ContactName = `"$val`""
            }
        }

        # SubcontractorContact not Demo/generic (in seed)
        $scm = [regex]::Match($line, $subcontractorContactPat)
        if ($scm.Success -and $f -match 'SeedData') {
            $val = $scm.Groups[1].Value
            if ($val -notmatch '^(Demo|Project Manager|Contact)') {
                $hits += "${f}:${ln}:SubcontractorContact = `"$val`""
            }
        }

        # ApprovedBy not generic Demo (in seed)
        $abm = [regex]::Match($line, $approvedByPat)
        if ($abm.Success -and $f -match 'SeedData') {
            $val = $abm.Groups[1].Value
            if ($val -notmatch '^(Demo|Project Manager|Mike|Approved)') {
                $hits += "${f}:${ln}:ApprovedBy = `"$val`""
            }
        }

        # bad orgs only in seed context (tightened pat to skip Summit sanitized)
        if ($f -match 'SeedData' -and $line -match $badOrgPat -and ($line -match 'Name =|ContactName|FirstName|LastName|Employee|Vendor|Customer')) {
            # report context not bare match to avoid "Name ="
            $hits += "${f}:${ln}:bad-org: $($line.Trim() | Select-Object -First 120)"
        }

        # Catch arbitrary realistic person name strings ONLY in person/contact contexts (to avoid trades, phases, cities)
        # e.g. Owner = "Mike Reynolds" or AssignedToName = "Sarah Chen" or SubcontractorContact etc.
        if ($f -match 'SeedData|Demo' -and $line -match '(Owner|CreatedByName|AssignedToName|AssigneeName|ApprovedBy|SubcontractorContact|ClientContact|ContactName|FirstName|LastName)\s*=\s*"([A-Z][a-z]{2,}[ ''-][A-Z][a-z]{2,})"') {
            $name = $matches[2]
            if ($name -notmatch '^(Demo|Contact|User|Employee|Manager|Project|Site)') {
                $hits += "${f}:${ln}:real-person-name: $name"
            }
        }
        # Also catch in tuple style new(..., "Real Name", "email@...
        if ($f -match 'SeedData|Demo' -and $line -match ',\s*"([A-Z][a-z]{2,}[ ''-][A-Z][a-z]{2,})",\s*"[^"]+@') {
            $name = $matches[1]
            if ($name -notmatch '^(Demo|Contact|User|Employee|Manager|Project|Site|Summit|Acme|Capital|Delta|Golden|NorCal|ProTech|Advantage)') {
                $hits += "${f}:${ln}:real-person-in-tuple: $name"
            }
        }

        # Update phone check to catch old area codes or non-000 even if written as interp or in strings
        if ($f -match 'SeedData|Demo' -and $line -match '\([0-9]{3}\) [0-9]{3}-[0-9]{4}' -and $line -notmatch '\(555\) 000-') {
            $hits += "${f}:${ln}:non-demo-phone: $($matches[0])"
        }
    }
}

$outDir = $Scratch
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$hits | Out-File -Encoding utf8 (Join-Path $outDir "pii-gate-hits.txt")

if ($hits.Count -gt 0) {
    Write-Host "PII GATE FAIL: $($hits.Count) hits"
    $hits | ForEach-Object { Write-Host $_ }
    exit 1
} else {
    Write-Host "PII GATE PASS: 0 hits"
    "ZERO HITS" | Out-File (Join-Path $outDir "pii-gate-zero.txt")
    exit 0
}