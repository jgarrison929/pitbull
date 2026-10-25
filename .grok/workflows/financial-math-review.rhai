// Continuous financial-math review loop (WIP-first).
// No pause / await_user stop gates. Ends only via dry rounds, budget floor, or complete().
let meta = #{
    name: "financial-math-review",
    description: "Loop subagents over WIP and financial math surfaces until dry or budget floor; adversarial verify; write findings report",
    phases: [
        #{ title: "Discover", detail: "WIP-first domain shards scan calc, seed, and adjacent math" },
        #{ title: "Loop", detail: "Repeat rounds until two consecutive dry rounds or budget low" },
        #{ title: "Verify", detail: "Adversarial skeptics confirm findings against shipped code" },
        #{ title: "Synthesize", detail: "Write durable findings report to workflow scratch" },
    ],
    when_to_use: "When WIP / billing / seed financial numbers look wrong and you need a bounded continuous math audit",
};

let findings_schema = #{
    "type": "object", "required": ["findings"],
    "properties": #{
        "findings": #{
            "type": "array", "maxItems": 8,
            "items": #{
                "type": "object",
                "required": ["file", "issue", "severity", "domain"],
                "properties": #{
                    "file": #{ "type": "string" },
                    "issue": #{ "type": "string" },
                    "severity": #{ "type": "string" },
                    "domain": #{ "type": "string" },
                    "evidence": #{ "type": "string" },
                },
            },
        },
    },
};

let verdict_schema = #{
    "type": "object",
    "required": ["real", "reason", "evidence"],
    "properties": #{
        "real": #{ "type": "boolean" },
        "reason": #{ "type": "string" },
        "evidence": #{ "type": "string" },
    },
};

// Optional focus path; default whole financial surface.
let focus = "WIP and financial math";
if args != () && args.focus != () {
    focus = args.focus;
}

let max_rounds = 3;
if args != () && args.max_rounds != () {
    // Rhai args are untyped; coerce carefully via string compare later if needed.
    max_rounds = 3;
}

// Fixed WIP-first domain shards — deterministic work list (no discovery agent scope leak).
let domains = [
    "WIP formulas (cost-to-cost % complete, earned revenue, over/under billing, revised contract)",
    "WIP cost-to-date sourcing (TimeEntry labor/equipment only vs materials, sub pay, PO/AP job costs)",
    "WIP billings-to-date (BillingApplication TotalEarnedLessRetainage vs gross billings / G702)",
    "WIP approved change orders (subcontract COs vs owner/main-contract COs)",
    "Seed WIP CreateWipReports relationship integrity (fabricated vs live TimeEntry/Billing/CO)",
    "Seed percent-complete scale (0-100 vs 0-1) and UI formatPercent double-scale risk",
    "Seed billing retainage and AIA G702 field consistency (ret on contract vs work completed)",
    "Adjacent AR/AP/GL math linked to WIP (retention holds, GL post, surety export margins)",
];

fn finding_key(f) {
    let file = "";
    let issue = "";
    if f.file != () { file = f.file; }
    if f.issue != () { issue = f.issue; }
    file + "|" + issue
}

fn collect_findings(results) {
    let out = [];
    for r in results {
        if r != () && r.success && r.output != () && r.output.findings != () {
            for f in r.output.findings {
                out.push(f);
            }
        }
    }
    out
}

fn dedupe_findings(list) {
    let seen = #{};
    let out = [];
    for f in list {
        let k = finding_key(f);
        if seen[k] == () {
            seen[k] = true;
            out.push(f);
        }
    }
    out
}

fn fingerprint_keys(list) {
    let keys = [];
    for f in list {
        keys.push(finding_key(f));
    }
    // Sort-free stable-ish fingerprint: join as found after dedupe order.
    let joined = "";
    for k in keys {
        if joined != "" { joined += "||"; }
        joined += k;
    }
    fingerprint(joined)
}

fn build_scan_prompt(domain, focus, prior_summary) {
    let p = "";
    p += "You are auditing Pitbull Construction Solutions (repo root) for FINANCIAL MATH errors. ";
    p += "Focus area: " + focus + ". Domain shard: " + domain + ". ";
    p += "Use read-only tools only: read_file, grep, list_dir. Do NOT invent findings from memory. ";
    p += "You MUST open real source files before reporting. Priority paths: ";
    p += "src/Modules/Pitbull.Billing/Services/WipCalculationService.cs, ";
    p += "src/Modules/Pitbull.Billing/Services/WipReportService.cs, ";
    p += "src/Modules/Pitbull.Billing/Features/Wip/WipContracts.cs, ";
    p += "src/Pitbull.Api/Features/SeedData/SeedDataService.cs (CreateWipReports, CreateBillingApplications), ";
    p += "tests/Pitbull.Tests.Unit/Services/WipCalculationServiceTests.cs, ";
    p += "src/Pitbull.Web/pitbull-web/src/app/(dashboard)/accounting/wip/[id]/page.tsx. ";
    p += "Look for wrong formulas, wrong data sources, unit/scale mismatches, seed values that do not ";
    p += "derive from related entities (projects, owner contracts, COs, billing apps, time costs), ";
    p += "and double-counting or missing costs. ";
    p += "Report at most 8 concrete findings as {file, issue, severity, domain, evidence}. ";
    p += "severity is critical|high|medium|low. domain is a short tag (wip-formula, cost-source, billing, seed, ui-scale, gl). ";
    p += "evidence must quote path + brief code fact (function/line idea). ";
    p += "Empty findings is valid ONLY after you actually read the relevant files for this shard. ";
    if prior_summary != "" {
        p += "Prior round confirmed themes (avoid pure duplicates; deepen if you find new related bugs): ";
        p += prior_summary;
    }
    p
}

// ── Discover / first review panel ──────────────────────────────────────────
phase("Discover");
log("financial-math-review: WIP-first domain scan (" + domains.len().to_string() + " shards)");

let all_findings = [];
let prior_summary = "";
let dry_streak = 0;
let round = 0;
let last_fp = "";

// Continuous loop: no user gates. Stop on two dry rounds or budget floor.
while round < max_rounds {
    round += 1;
    let b = budget();
    if b.remaining < 12 {
        log("budget floor reached remaining=" + b.remaining.to_string() + "; stopping loop");
        break;
    }

    phase("Loop");
    log("review round " + round.to_string() + " remaining_budget=" + b.remaining.to_string());

    let jobs = [];
    for d in domains {
        let prompt = build_scan_prompt(d, focus, prior_summary);
        jobs.push(#{
            prompt: prompt,
            label: "scan-r" + round.to_string() + ":" + d.sub_string(0, 28),
            capability_mode: "read-only",
            output_schema: findings_schema,
        });
    }

    let results = parallel(jobs);
    let round_findings = collect_findings(results);
    round_findings = dedupe_findings(round_findings);

    // Keep only new keys vs accumulated set.
    let existing = #{};
    for f in all_findings {
        existing[finding_key(f)] = true;
    }
    let new_only = [];
    for f in round_findings {
        let k = finding_key(f);
        if existing[k] == () {
            new_only.push(f);
            all_findings.push(f);
        }
    }

    let fp = fingerprint_keys(new_only);
    log("round " + round.to_string() + " new_findings=" + new_only.len().to_string()
        + " total=" + all_findings.len().to_string());

    if new_only.len() == 0 || (last_fp != "" && fp == last_fp) {
        dry_streak += 1;
    } else {
        dry_streak = 0;
    }
    last_fp = fp;

    // Build short prior summary for next round prompts (cap length).
    prior_summary = "";
    let i = 0;
    for f in all_findings {
        if i >= 12 { break; }
        if prior_summary != "" { prior_summary += "; "; }
        let iss = "";
        if f.issue != () { iss = f.issue; }
        prior_summary += iss.sub_string(0, 80);
        i += 1;
    }

    if dry_streak >= 2 {
        log("two consecutive dry rounds; ending loop");
        break;
    }
}

all_findings = dedupe_findings(all_findings);

if all_findings.len() == 0 {
    let empty_path = write_scratch_file("math-findings.md",
        "# Financial math review\n\nNo findings after " + round.to_string()
        + " round(s). Domains scanned: WIP formulas, cost source, billings, COs, seed integrity, UI scale, adjacent GL.\n");
    complete(#{
        summary: "No findings after continuous loop",
        rounds: round,
        confirmed: [],
        report_path: empty_path,
    });
}

// Cap verify panel size for budget safety.
let to_verify = [];
let vi = 0;
for f in all_findings {
    if vi >= 16 { break; }
    to_verify.push(f);
    vi += 1;
}
if all_findings.len() > 16 {
    log("truncated verification to 16 of " + all_findings.len().to_string() + " findings");
}

// ── Adversarial verify ─────────────────────────────────────────────────────
phase("Verify");
let b2 = budget();
if b2.remaining < to_verify.len() + 2 {
    log("insufficient budget for full verify; synthesizing unconfirmed scan findings");
} else {
    let vjobs = [];
    for f in to_verify {
        let file = "";
        let issue = "";
        if f.file != () { file = f.file; }
        if f.issue != () { issue = f.issue; }
        let vp = "";
        vp += "Adversarially verify this financial-math finding against shipped Pitbull code. ";
        vp += "Issue: " + json_encode(issue) + ". File claim: " + json_encode(file) + ". ";
        vp += "Use read_file/grep on the real file(s). Set real=true ONLY with concrete evidence you independently inspected ";
        vp += "(quote formula, wrong source, scale mismatch, or seed fabrication). Otherwise real=false. ";
        vp += "Reject speculative style nits and anything not about calculation correctness or seed/data relationships that break numbers.";
        vjobs.push(#{
            prompt: vp,
            label: "verify:" + file.sub_string(0, 40),
            capability_mode: "read-only",
            output_schema: verdict_schema,
        });
    }
    let verdicts = parallel(vjobs);

    let confirmed = [];
    let idx = 0;
    for v in verdicts {
        if idx >= to_verify.len() { break; }
        if v != () && v.success && v.output != () && v.output.real == true
            && v.output.evidence != () && v.output.evidence != "" {
            let item = to_verify[idx];
            // Attach verifier evidence if present.
            confirmed.push(#{
                file: item.file,
                issue: item.issue,
                severity: item.severity,
                domain: item.domain,
                evidence: v.output.evidence,
                reason: v.output.reason,
            });
        }
        idx += 1;
    }

    log(confirmed.len().to_string() + "/" + to_verify.len().to_string() + " findings survived verification");

    // ── Synthesize report ──────────────────────────────────────────────────
    phase("Synthesize");
    let md = "";
    md += "# Financial math continuous review\n\n";
    md += "Rounds: " + round.to_string() + "\n";
    md += "Scanned findings: " + all_findings.len().to_string() + "\n";
    md += "Verified confirmed: " + confirmed.len().to_string() + "\n";
    md += "Focus: " + focus + "\n\n";
    md += "## Confirmed findings\n\n";
    if confirmed.len() == 0 {
        md += "_None survived adversarial verification._\n\n";
        md += "## Unverified scan findings (for arc triage)\n\n";
        for f in to_verify {
            let sev = "unknown";
            let dom = "unknown";
            let file = "";
            let issue = "";
            let ev = "";
            if f.severity != () { sev = f.severity; }
            if f.domain != () { dom = f.domain; }
            if f.file != () { file = f.file; }
            if f.issue != () { issue = f.issue; }
            if f.evidence != () { ev = f.evidence; }
            md += "- **" + sev + "** [" + dom + "] `" + file + "`: " + issue + "\n";
            if ev != "" { md += "  - evidence: " + ev + "\n"; }
        }
    } else {
        for f in confirmed {
            let sev = "unknown";
            let dom = "unknown";
            let file = "";
            let issue = "";
            let ev = "";
            if f.severity != () { sev = f.severity; }
            if f.domain != () { dom = f.domain; }
            if f.file != () { file = f.file; }
            if f.issue != () { issue = f.issue; }
            if f.evidence != () { ev = f.evidence; }
            md += "- **" + sev + "** [" + dom + "] `" + file + "`: " + issue + "\n";
            if ev != "" { md += "  - evidence: " + ev + "\n"; }
        }
    }
    md += "\n## Domains scanned\n\n";
    for d in domains {
        md += "- " + d + "\n";
    }

    let report_path = write_scratch_file("math-findings.md", md);
    complete(#{
        summary: confirmed.len().to_string() + " confirmed financial-math findings after "
            + round.to_string() + " rounds",
        rounds: round,
        scanned: all_findings.len(),
        confirmed_count: confirmed.len(),
        confirmed: confirmed,
        report_path: report_path,
    });
}

// Budget-starved path: synthesize without verify panel.
phase("Synthesize");
let md2 = "";
md2 += "# Financial math continuous review (unverified — budget floor)\n\n";
md2 += "Rounds: " + round.to_string() + "\n";
md2 += "Scanned findings: " + all_findings.len().to_string() + "\n\n";
md2 += "## Scan findings\n\n";
for f in all_findings {
    let sev = "unknown";
    let dom = "unknown";
    let file = "";
    let issue = "";
    let ev = "";
    if f.severity != () { sev = f.severity; }
    if f.domain != () { dom = f.domain; }
    if f.file != () { file = f.file; }
    if f.issue != () { issue = f.issue; }
    if f.evidence != () { ev = f.evidence; }
    md2 += "- **" + sev + "** [" + dom + "] `" + file + "`: " + issue + "\n";
    if ev != "" { md2 += "  - evidence: " + ev + "\n"; }
}
let path2 = write_scratch_file("math-findings.md", md2);
complete(#{
    summary: all_findings.len().to_string() + " scan findings (verify skipped — budget)",
    rounds: round,
    scanned: all_findings.len(),
    confirmed_count: 0,
    confirmed: [],
    report_path: path2,
});
