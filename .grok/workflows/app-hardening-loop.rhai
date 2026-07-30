// Continuous security / data / application hardening loop.
// No pause gates. Ends on dry rounds, budget floor, or max rounds.
// Fix agents write into the shared workspace (no worktree isolation).
let meta = #{
    name: "app-hardening-loop",
    description: "CI-first then discover→fix→verify over security, deps, data integrity, and code quality until dry or budget floor",
    phases: [
        #{ title: "Inventory", detail: "Read-only scan of CI failures, security, data, quality surfaces" },
        #{ title: "Loop", detail: "Prioritize CI reds then highest-value issues each round" },
        #{ title: "Verify", detail: "Restore/build/tests and adversarial confirmation" },
        #{ title: "Synthesize", detail: "Write durable hardening report" },
    ],
    when_to_use: "Hourly hardening and when main CI is red or CodeQL/deps/quality need continuous improvement",
};

let findings_schema = #{
    "type": "object", "required": ["findings"],
    "properties": #{
        "findings": #{
            "type": "array", "maxItems": 8,
            "items": #{
                "type": "object",
                "required": ["file", "issue", "severity", "domain", "fix_hint"],
                "properties": #{
                    "file": #{ "type": "string" },
                    "issue": #{ "type": "string" },
                    "severity": #{ "type": "string" },
                    "domain": #{ "type": "string" },
                    "fix_hint": #{ "type": "string" },
                    "evidence": #{ "type": "string" },
                },
            },
        },
    },
};

let fix_schema = #{
    "type": "object",
    "required": ["changed_files", "summary", "tests_run"],
    "properties": #{
        "changed_files": #{ "type": "array", "items": #{ "type": "string" }, "maxItems": 30 },
        "summary": #{ "type": "string" },
        "tests_run": #{ "type": "string" },
        "blocked": #{ "type": "boolean" },
        "blocked_reason": #{ "type": "string" },
    },
};

let verdict_schema = #{
    "type": "object",
    "required": ["ok", "reason"],
    "properties": #{
        "ok": #{ "type": "boolean" },
        "reason": #{ "type": "string" },
        "residual_risks": #{ "type": "array", "items": #{ "type": "string" }, "maxItems": 8 },
    },
};

let focus = "security, data integrity, application quality";
if args != () && args.focus != () {
    focus = args.focus;
}

let max_rounds = 4;
// Fixed deterministic domain shards (no discovery-agent scope leak).
// CI / package alignment is first so fix rounds prefer red main over polish.
let domains = [
    "CI and failed GitHub Actions: NU1605 package downgrades across csproj (Api vs Tests.Unit/Integration), Hangfire/PostHog/IdentityModel version skew, ESLint brace-expansion/minimatch overrides, broken integration tests from security merges; inspect package.json overrides and all PackageReference pins",
    "CodeQL log-forging and sensitive log data: LogSafe usage, raw emails/tokens in ILogger calls under src/Pitbull.Api and src/Modules",
    "AuthN/Z and demo safety: AuthController, DemoRestrictionMiddleware, IsDemoUser, JWT claims, RBAC permissions",
    "Multi-tenant data isolation: TenantMiddleware, RLS session config, ICompanyScoped, IgnoreQueryFilters misuse",
    "Input validation and injection: SQL raw queries, AiInputSanitizer, open redirects, mass assignment",
    "Dependency and supply chain: package.json, csproj PackageReference versions, obsolete packages, NU warnings — never leave sibling projects on older package versions",
    "Data integrity: SaveChanges UTC, soft-delete filters, money decimal precision, WIP/billing consistency",
    "API error handling quality: ExceptionMiddleware, Result failures, nullability, empty catch blocks",
    "Frontend quality: raw fetch without api.ts, localStorage secrets, XSS sinks, dead routes, TypeScript any abuse, npm run lint must not crash",
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

fn build_scan_prompt(domain, focus, prior_summary) {
    let p = "";
    p += "You are hardening Pitbull Construction Solutions (repo root). ";
    p += "Focus: " + focus + ". Domain shard: " + domain + ". ";
    p += "Use read-only tools only: read_file, grep, list_dir. Do NOT invent findings from memory. ";
    p += "MUST open real source files before reporting. ";
    p += "Prefer concrete, fixable issues with file paths. Skip pure style nits. ";
    p += "Respect settled architecture: no MediatR in controllers, no gstack, modular monolith. ";
    p += "Prefer truth over polish; do not invent KPIs. ";
    p += "Report at most 8 findings as {file, issue, severity, domain, fix_hint, evidence}. ";
    p += "severity is critical|high|medium|low. domain is short tag (log-safe, auth, rls, validation, deps, data, api, frontend). ";
    p += "Empty findings is valid ONLY after you actually inspected relevant code for this shard. ";
    if prior_summary != "" {
        p += "Already known themes (prefer NEW issues, deepen only if distinct): ";
        p += prior_summary;
    }
    p
}

fn build_fix_prompt(findings_blob, focus) {
    let p = "";
    p += "You are implementing security/data/quality fixes in Pitbull Construction Solutions. ";
    p += "Focus: " + focus + ". ";
    p += "Use tools freely (read_file, grep, search_replace, write, run_terminal_command). ";
    p += "Apply the HIGHEST severity findings first from this list (JSON): ";
    p += findings_blob;
    p += " Rules: (1) Prefer LogSafe.Text / LogSafe.Email for untrusted log args — never log raw emails. ";
    p += "(2) Do not add MediatR to controllers or reintroduce gstack. ";
    p += "(3) Keep changes small and correct; add/adjust unit tests when behavior changes. ";
    p += "(4) Do not commit secrets. Do not force-push. Do not amend published commits. ";
    p += "(5) After ANY package or csproj change run: dotnet restore Pitbull.sln and ensure zero NU1605. ";
    p += "(6) Run targeted tests: dotnet test tests/Pitbull.Tests.Unit --filter LogSafe when touching LogSafe; npm run lint for web. ";
    p += "(7) If blocked (needs secrets, external systems), set blocked=true and explain. ";
    p += "Return changed_files, summary, tests_run. ";
    p
}

// ── Inventory ──────────────────────────────────────────────────────────────
phase("Inventory");
log("app-hardening-loop: inventory scan (" + domains.len().to_string() + " shards)");

let all_findings = [];
let prior_summary = "";
let dry_streak = 0;
let round = 0;
let last_fp = "";
let fix_summaries = [];

while round < max_rounds {
    round += 1;
    let b = budget();
    if b.remaining < 16 {
        log("budget floor remaining=" + b.remaining.to_string() + "; stopping loop");
        break;
    }

    phase("Loop");
    log("hardening round " + round.to_string() + " remaining_budget=" + b.remaining.to_string());

    let jobs = [];
    for d in domains {
        jobs.push(#{
            prompt: build_scan_prompt(d, focus, prior_summary),
            label: "scan-r" + round.to_string() + ":" + d.sub_string(0, 24),
            capability_mode: "read-only",
            output_schema: findings_schema,
        });
    }
    let results = parallel(jobs);
    let round_findings = dedupe_findings(collect_findings(results));

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

    log("round " + round.to_string() + " new_findings=" + new_only.len().to_string()
        + " total=" + all_findings.len().to_string());

    // Fingerprint new set
    let joined = "";
    for f in new_only {
        if joined != "" { joined += "||"; }
        joined += finding_key(f);
    }
    let fp = fingerprint(joined);
    if new_only.len() == 0 || (last_fp != "" && fp == last_fp) {
        dry_streak += 1;
    } else {
        dry_streak = 0;
    }
    last_fp = fp;

    // Fix top findings this round (use new_only if any, else high-sev backlog slice)
    let to_fix = new_only;
    if to_fix.len() == 0 {
        // still try a fix pass on residual backlog once
        let i = 0;
        for f in all_findings {
            if i >= 6 { break; }
            to_fix.push(f);
            i += 1;
        }
    }

    if to_fix.len() > 0 && budget().remaining >= 8 {
        // Cap fix batch to 6 findings for a focused PR-sized change
        let batch = [];
        let bi = 0;
        for f in to_fix {
            if bi >= 6 { break; }
            batch.push(f);
            bi += 1;
        }
        let blob = json_encode(batch);
        let fix_prompt = build_fix_prompt(blob, focus);
        let fix_r = agent(fix_prompt, #{
            label: "fix-r" + round.to_string(),
            capability_mode: "all",
            output_schema: fix_schema,
        });
        if fix_r != () && fix_r.success && fix_r.output != () {
            let s = "";
            if fix_r.output.summary != () { s = fix_r.output.summary; }
            fix_summaries.push("r" + round.to_string() + ": " + s);
            log("fix round " + round.to_string() + " summary=" + s.sub_string(0, 200));
        } else {
            log("fix round " + round.to_string() + " failed or empty");
        }

        phase("Verify");
        let verify_prompt = "";
        verify_prompt += "Adversarially verify the latest hardening edits in the Pitbull repo. ";
        verify_prompt += "Use read_file/grep/run_terminal_command. MUST: ";
        verify_prompt += "dotnet restore Pitbull.sln (fail if NU1605 or restore errors); ";
        verify_prompt += "dotnet build src/Pitbull.Api/Pitbull.Api.csproj; ";
        verify_prompt += "and targeted unit tests for touched surfaces (LogSafe/Auth/DemoRestriction as relevant). ";
        verify_prompt += "If package.json or eslint changed, run npm run lint in src/Pitbull.Web/pitbull-web. ";
        verify_prompt += "Set ok=true only if restore+build(+lint) are healthy. List residual_risks briefly.";
        let v = agent(verify_prompt, #{
            label: "verify-r" + round.to_string(),
            capability_mode: "execute",
            output_schema: verdict_schema,
        });
        if v != () && v.success && v.output != () && v.output.ok == true {
            log("verify ok round " + round.to_string());
        } else {
            let reason = "unknown";
            if v != () && v.success && v.output != () && v.output.reason != () {
                reason = v.output.reason;
            }
            log("verify not-ok round " + round.to_string() + ": " + reason.sub_string(0, 160));
        }
    }

    // Prior summary for next scan
    prior_summary = "";
    let pi = 0;
    for f in all_findings {
        if pi >= 14 { break; }
        if prior_summary != "" { prior_summary += "; "; }
        let iss = "";
        if f.issue != () { iss = f.issue; }
        prior_summary += iss.sub_string(0, 80);
        pi += 1;
    }

    if dry_streak >= 2 {
        log("two consecutive dry discovery rounds; ending loop");
        break;
    }
}

// ── Synthesize ─────────────────────────────────────────────────────────────
phase("Synthesize");
all_findings = dedupe_findings(all_findings);

let report = "# App hardening loop report\n\n";
report += "Focus: " + focus + "\n";
report += "Rounds: " + round.to_string() + "\n";
report += "Findings discovered (unique): " + all_findings.len().to_string() + "\n\n";
report += "## Fix summaries\n\n";
if fix_summaries.len() == 0 {
    report += "_No fix agent summaries._\n";
} else {
    for s in fix_summaries {
        report += "- " + s + "\n";
    }
}
report += "\n## Findings backlog\n\n";
if all_findings.len() == 0 {
    report += "_No findings._\n";
} else {
    let fi = 0;
    for f in all_findings {
        if fi >= 40 { break; }
        let sev = "";
        let file = "";
        let issue = "";
        let domain = "";
        let hint = "";
        if f.severity != () { sev = f.severity; }
        if f.file != () { file = f.file; }
        if f.issue != () { issue = f.issue; }
        if f.domain != () { domain = f.domain; }
        if f.fix_hint != () { hint = f.fix_hint; }
        report += "- **" + sev + "** [" + domain + "] `" + file + "`: " + issue;
        if hint != "" { report += " — _fix:_ " + hint; }
        report += "\n";
        fi += 1;
    }
}
report += "\n## Notes\n\n";
report += "- Open GitHub issues and Dependabot alerts were empty at planning time; prioritize CodeQL C# residuals and code quality.\n";
report += "- C# CodeQL default setup is weekly; force a scan after merges that touch C#.\n";
report += "- Never reintroduce gstack.\n";

let path = write_scratch_file("hardening-report.md", report);
complete(#{
    summary: "Hardening loop finished rounds=" + round.to_string()
        + " findings=" + all_findings.len().to_string()
        + " fix_passes=" + fix_summaries.len().to_string(),
    path: path,
    findings_count: all_findings.len(),
    rounds: round,
});
