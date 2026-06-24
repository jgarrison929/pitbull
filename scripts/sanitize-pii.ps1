<#
.SYNOPSIS
Structural PII sanitizer. -Fix applies generic transforms to SeedDataService and DemoBootstrapper.
#>

param(
    [switch]$Fix,
    [string]$Scratch = "C:\Users\jgarr\AppData\Local\Temp\grok-goal-98739f72e674\implementer"
)

if ($Fix) {
    Write-Host "Structural PII fix (employees + contacts + emails)..."
    $seed = "src/Pitbull.Api/Features/SeedData/SeedDataService.cs"
    if (Test-Path $seed) {
        $c = Get-Content $seed -Raw

        # 1. Fix phones to (555) 000-*
        $c = [regex]::Replace($c, '\([0-9]{3}\) 555-(\d{4})', '(555) 000-$1')

        # 2. Repair broken CreateEmployees / CreateAdditionalEmployees: remove dupe FirstName lines, ensure LastName + generic demo email
        # Remove any "FirstName = "Demo",\r\n                FirstName = "Demo"," patterns
        $c = [regex]::Replace($c, 'FirstName = "Demo",\r?\n\s+FirstName = "Demo",', 'FirstName = "Demo",')
        # Ensure LastName follows FirstName = "Demo", (insert if missing LastName right after)
        $c = [regex]::Replace($c, '(FirstName = "Demo",\r?\n)(\s+)(?!LastName)', { param($m) $m.Groups[1].Value + $m.Groups[2].Value + 'LastName = "Employee",' + "`r`n" + $m.Groups[2].Value })

        # Normalize demo employee emails in Create* blocks to demo.employeeNN@demo.example (best effort on existing numbers)
        $c = [regex]::Replace($c, 'Email = "[^"]+@demo\.example"', { param($m) $m.Value }) # keep for now, later pass
        # Force generic employee emails for known patterns in Create blocks
        $c = [regex]::Replace($c, 'Email = "[^"]+@demo\.example"(?=\s*,\s*\r?\n\s*(Phone|Title))', { param($m) 
            # leave, handled by explicit below
            $m.Value 
        })

        # 3. Clean contacts in vendor/customer/trade lists: replace "Real Name" contacts and legacy@*.example with Demo Contact N + contactN@example.com
        $contactNum = 100
        $c = [regex]::Replace($c, 'ContactName = "[^"]+"', { param($m) 'ContactName = "Demo Contact ' + ($script:contactNum++ % 900 + 100) + '"' })
        $c = [regex]::Replace($c, 'ContactEmail = "[^"]+@[^"]+"', { param($m) 'ContactEmail = "contact' + ($script:contactNum % 900 + 100) + '@example.com"' })

        # 4. SubcontractorContact real names -> Demo
        $c = [regex]::Replace($c, 'SubcontractorContact = "[A-Z][a-zA-Z'' ]+"', 'SubcontractorContact = "Demo Contact"')

        # 5. ApprovedBy real names -> Demo Contact (keep some generic)
        $c = [regex]::Replace($c, 'ApprovedBy = "[A-Z][a-zA-Z ]+"', 'ApprovedBy = "Demo Contact"')

        # 6. In the (Name, Code, Trade, Contact, Email) tuples for vendors in CreateAdditionalVendors and PWI/VHD/CVE
        $c = [regex]::Replace($c, ',\s*"([A-Z][a-z]+ [A-Z][a-zA-Z'' -]+)",\s*"[^"]+@', { param($m) ', "Demo Contact", "contact' + ($script:contactNum++ % 800 + 200) + '@example.com"' })

        # 7. For GetPwi*/GetVhd*/GetCve* project/vendor/customer defs with 4-5 arg new( org, code, name, email, ...
        $c = [regex]::Replace($c, 'new\("([^"]+)",\s*"[^"]+",\s*"[^"]+",\s*"[^"]+@[^"]+"\s*,\s*"\([0-9 ]+"\)', { param($m) 
            'new("' + $m.Groups[1].Value + '", "DEMO", "Demo Contact", "contact' + ($script:contactNum++ % 900 + 100) + '@example.com", "(555) 000-0000")' 
        })

        # 8. Fix the broken Demo, EmployeeN in PWI/VHD employee new() which have syntax issues (trailing ) misplaced)
        # Normalize known PWI etc employee lines that start with new("XX- , "Demo", "EmployeeN", ...
        $c = [regex]::Replace($c, 'new\("([A-Z]{2,3}-\d+)",\s*"Demo",\s*"Employee\d+",\s*"[^"]+",\s*"\(555\) 000-0000"\),\s*"[^"]+",\s*EmployeeClassification\.[^,]+,\s*[\d.]+m\)', { param($m) 
            'new("' + $m.Groups[1].Value + '", "Demo", "Employee", "demo.employee@demo.example", "(555) 000-0000"), "Project Role", EmployeeClassification.Salaried, 50.00m)' 
        })

        # 9. Clean remaining legacy org-ish emails in seed (adventist, scwa, sasd, etc)
        $c = [regex]::Replace($c, '@(adventisthealth|scwa|sasd|regionalsan|srwa|graniteasphalt|highwaysteel|pacguardrail|sunpower|dignityhealth|pge|cyrusone|sierrachem|summitvendor|valley|tricounty|goldeneagle|capitolpainting|sierraflooring|premierdoor|allphase|westernplumbing|apextesting|metroelectric|sactownplumbing|pioneerearth|valleyhvac|a1concrete|centralelec|solararraysolutions)[^"]*\.example', '@example.com')

        # 10. In CreateAdditionalEmployees generator: ensure clean Demo names + email + phone set
        $c = [regex]::Replace($c, 'FirstName = "DemoF\d+"', 'FirstName = "Demo"')
        $c = [regex]::Replace($c, 'LastName = "DemoL\d+"', 'LastName = "Employee"')
        $c = [regex]::Replace($c, 'Email = "\w+@demo\.example"', 'Email = "demo.employee@demo.example"')
        $c = [regex]::Replace($c, 'Email = "demo\.employee\d+@demo\.example"', 'Email = "demo.employee@demo.example"')

        # remove leftover duplicate Email lines
        $c = [regex]::Replace($c, 'Email = "[^"]+",\r?\n\s+Email = "[^"]+",', 'Email = "demo.employee@demo.example",')

        Set-Content $seed $c -NoNewline
    }

    $boot = "src/Pitbull.Api/Demo/DemoBootstrapper.cs"
    if (Test-Path $boot) {
        $c = Get-Content $boot -Raw
        $c = [regex]::Replace($c, '\([0-9]{3}\) 555-(\d{4})', '(555) 000-$1')
        # Sanitize DemoUsers first/last names to Demo / UserNN
        $i = 1
        $c = [regex]::Replace($c, 'new\("([^"]+@demo\.local)",\s*"[^"]+",\s*"[^"]+",', { param($m) 
            'new("' + $m.Groups[1].Value + '", "Demo", "User' + ($script:i++).ToString("D2") + '",' 
        })
        Set-Content $boot $c -NoNewline
    }

    Write-Host "Fix applied"
    exit 0
}

Write-Host "Use -Fix"
exit 1