// Iterative docs stance improvement — exactly two agent roles per round.
// Auditor (read-only) finds drift vs VERSION/CHANGELOG; Writer (read-write)
// applies a small bounded patch set. Loop until dry rounds or budget floor.
// Docs only: no product feature work, no Dependabot merges, no version stamps
// unless args.allow_version_bump is true (default false).
let meta = #{
    name: "docs-stance-improve",
    description: "Two-agent loop: audit docs drift against VERSION/CHANGELOG, then apply bounded stance fixes until dry",
    phases: [
        #{ title: "Baseline", detail: "Read VERSION, CHANGELOG head, epic/index status claims" },
        #{ title: "Loop", detail: "Auditor then Writer; dry-streak exit" },
        #{ title: "Synthesize", detail: "Write durable stance report under docs/" },
    ],
    when_to_use: "When epic/index docs lag shipped stamps; keep agent-facing docs honest without a full rewrite",
};

let audit_schema = #{
    "type": "object",
    "required": ["drifts", "truth_summary", "priority_fixes"],
    "properties": #{
        "truth_summary": #{ "type": "string" },
        "product_version": #{ "type": "string" },
        "next_free_stamp_hint": #{ "type": "string" },
        "drifts": #{
            "type": "array",
            "maxItems": 12,
            "items": #{
                "type": "object",
                "required": ["file", "claim", "truth", "severity", "fix_hint"],
                "properties": #{
                    "file": #{ "type": "string" },
                    "claim": #{ "type": "string" },
                    "truth": #{ "type": "string" },
                    "severity": #{ "type": "string" },
                    "fix_hint": #{ "type": "string" },
                },
            },
        },
        "priority_fixes": #{
            "type": "array",
            "maxItems": 6,
            "items": #{
                "type": "object",
                "required": ["file", "action"],
                "properties": #{
                    "file": #{ "type": "string" },
                    "action": #{ "type": "string" },
                },
            },
        },
        "do_not_touch": #{
            "type": "array",
            "maxItems": 12,
            "items": #{ "type": "string" },
        },
    },
};

let write_schema = #{
    "type": "object",
    "required": ["changed_files", "summary", "drifts_closed"],
    "properties": #{
        "changed_files": #{ "type": "array", "items": #{ "type": "string" }, "maxItems": 20 },
        "summary": #{ "type": "string" },
        "drifts_closed": #{ "type": "array", "items": #{ "type": "string" }, "maxItems": 12 },
        "blocked": #{ "type": "boolean" },
        "blocked_reason": #{ "type": "string" },
        "residual_drifts": #{ "type": "array", "items": #{ "type": "string" }, "maxItems": 12 },
    },
};

let max_rounds = 3;
if args != () && args.max_rounds != () {
    // args may pass a number; Rhai JSON numbers come through as numbers
    max_rounds = args.max_rounds;
}
if max_rounds < 1 { max_rounds = 1; }
if max_rounds > 5 { max_rounds = 5; }

let allow_version_bump = false;
if args != () && args.allow_version_bump == true {
    allow_version_bump = true;
}

let focus = "PM next-gen arc epic + product-bands index + band 3.8 version remapping";
if args != () && args.focus != () {
    focus = args.focus;
}

fn drift_key(d) {
    let file = "";
    let claim = "";
    if d.file != () { file = d.file; }
    if d.claim != () { claim = d.claim; }
    file + "|" + claim
}

fn build_audit_prompt(focus, prior_closed, round_n) {
    let p = "";
    p += "You are the DOCS AUDITOR for Pitbull Construction Solutions (repo root). ";
    p += "Round " + round_n.to_string() + ". Focus: " + focus + ". ";
    p += "Capability: READ-ONLY. Use read_file, grep, list_dir only. NEVER edit files. ";
    p += "TRUTH HIERARCHY (highest first): ";
    p += "(1) root VERSION file; ";
    p += "(2) CHANGELOG.md published headers (## [x.y.z]); ";
    p += "(3) src/ and tests; ";
    p += "(4) individual band specs under docs/specs/product-bands/; ";
    p += "(5) epic docs/roadmap/pm-nextgen-3.4-to-4.0.md and docs/specs/product-bands/README.md — often STALE. ";
    p += "MUST open VERSION, first ~80 lines of CHANGELOG.md, the epic, product-bands README, ";
    p += "and band-3.5 through band-3.8 headers before reporting. ";
    p += "Find status/version DRIFT only — not prose polish. Examples of real drift: ";
    p += "epic says 'no implementation PRs' or next row 3.4.6 while VERSION is 3.7.x; ";
    p += "README marks band 3.5 Pending while band file says Shipped; ";
    p += "band 3.8 remaining rows use stamps already spent on dep-audit/WIP (3.7.6/3.7.7). ";
    p += "Do NOT invent product features. Do NOT recommend reopening docs/260712 as live work. ";
    p += "Prefer high-leverage hub docs over rewriting every historical note. ";
    p += "severity: high = agent-facing wrong next-step; medium = status table lag; low = cosmetic. ";
    p += "priority_fixes: at most 6 concrete edit actions the Writer can do this round. ";
    p += "do_not_touch: historical 260712, frozen design notes, CHANGELOG past entries. ";
    if prior_closed != "" {
        p += "Already closed this run (do not re-report unless still wrong): " + prior_closed + ". ";
    }
    p += "Empty drifts is valid ONLY after you verified hub docs match VERSION/CHANGELOG. ";
    p
}

fn build_write_prompt(audit_blob, focus, allow_bump) {
    let p = "";
    p += "You are the DOCS WRITER for Pitbull Construction Solutions. ";
    p += "Focus: " + focus + ". ";
    p += "Apply ONLY the priority_fixes from this auditor JSON (bounded, high-leverage): ";
    p += audit_blob;
    p += " Rules: ";
    p += "(1) Edit markdown under docs/ (and AGENTS.md only if product-version pointer is wrong). ";
    p += "(2) Never invent KPIs or claim bands shipped without CHANGELOG evidence. ";
    p += "(3) Prefer small status/next-stamp patches over long narrative rewrites. ";
    p += "(4) When remapping band 3.8 remaining work, use NEXT FREE stamps after current VERSION — never reuse spent numbers. ";
    p += "(5) Do not commit. Do not force-push. Do not merge PRs. ";
    p += "(6) Do not change application source (src/, tests/) unless a docs-only path is impossible — default is docs only. ";
    if allow_bump {
        p += "(7) Version stamp bumps are allowed only if auditor explicitly required them for honesty; keep stamp set in sync. ";
    } else {
        p += "(7) Do NOT bump VERSION, package.json version, or csproj Version props. Docs stance only. ";
    }
    p += "(8) After edits, re-read the files you changed and list residual_drifts honestly. ";
    p += "Return changed_files, summary, drifts_closed (file|claim keys), residual_drifts. ";
    p
}

fn build_report_prompt(all_drifts_blob, write_summaries_blob, product_version) {
    let p = "";
    p += "Write a durable markdown report for Pitbull docs stance improvement. ";
    p += "Product version baseline: " + product_version + ". ";
    p += "Auditor drift inventory (may include closed): " + all_drifts_blob + ". ";
    p += "Writer round summaries: " + write_summaries_blob + ". ";
    p += "Use read_file to confirm current text of VERSION and any files listed as changed. ";
    p += "Capability: you may write ONE file at docs/ci/docs-stance-improve-report.md ";
    p += "(create or overwrite). Structure: ";
    p += "## Baseline (VERSION + next free stamp hint); ";
    p += "## Closed this run; ";
    p += "## Residual drift (still wrong); ";
    p += "## Standing rules (truth hierarchy for agents); ";
    p += "## Suggested next human/agent actions (docs only, no feature invent). ";
    p += "Keep under ~150 lines. Truth over polish. ";
    p += "Return changed_files including the report path, summary of the report, drifts_closed empty, residual_drifts from residual section. ";
    p
}

// ── Baseline ───────────────────────────────────────────────────────────────
phase("Baseline");
log("docs-stance-improve: focus=" + focus + " max_rounds=" + max_rounds.to_string());

let baseline = agent(
    "READ-ONLY baseline for Pitbull docs stance. Open and quote: (1) root VERSION; "
        + "(2) CHANGELOG.md first 40 lines and the newest ## [x.y.z] header; "
        + "(3) docs/roadmap/pm-nextgen-3.4-to-4.0.md status + 'Next unshipped' lines; "
        + "(4) docs/specs/product-bands/README.md status table + next unshipped line; "
        + "(5) Status headers of band-3.5, 3.6, 3.7, 3.8 under docs/specs/product-bands/. "
        + "Return product_version from VERSION, truth_summary in 3-6 sentences, "
        + "next_free_stamp_hint (semver after VERSION), drifts and priority_fixes for hub docs only. "
        + "Use tools; do not invent.",
    #{
        label: "baseline-audit",
        capability_mode: "read-only",
        output_schema: audit_schema,
    }
);

let product_version = "unknown";
let next_stamp = "";
let all_drifts = [];
let prior_closed = "";
let write_summaries = [];
let dry_streak = 0;
let last_fp = "";

if baseline != () && baseline.success && baseline.output != () {
    if baseline.output.product_version != () {
        product_version = baseline.output.product_version;
    }
    if baseline.output.next_free_stamp_hint != () {
        next_stamp = baseline.output.next_free_stamp_hint;
    }
    if baseline.output.drifts != () {
        for d in baseline.output.drifts {
            all_drifts.push(d);
        }
    }
    log("baseline product_version=" + product_version + " drifts=" + all_drifts.len().to_string());
} else {
    log("baseline audit failed or empty; continuing with empty inventory");
}

// ── Loop: Auditor → Writer (exactly two roles; sequential for shared workspace) ─
let round = 0;
while round < max_rounds {
    round += 1;
    let b = budget();
    if b.remaining < 4 {
        log("budget floor remaining=" + b.remaining.to_string() + "; stop");
        break;
    }

    phase("Loop");
    log("docs round " + round.to_string() + " remaining_budget=" + b.remaining.to_string());

    // Agent 1 of 2: Auditor
    let audit = agent(
        build_audit_prompt(focus, prior_closed, round),
        #{
            label: "auditor-r" + round.to_string(),
            capability_mode: "read-only",
            output_schema: audit_schema,
        }
    );

    let priority = [];
    let round_drifts = [];
    if audit != () && audit.success && audit.output != () {
        if audit.output.product_version != () {
            product_version = audit.output.product_version;
        }
        if audit.output.next_free_stamp_hint != () {
            next_stamp = audit.output.next_free_stamp_hint;
        }
        if audit.output.drifts != () {
            for d in audit.output.drifts {
                round_drifts.push(d);
            }
        }
        if audit.output.priority_fixes != () {
            for f in audit.output.priority_fixes {
                priority.push(f);
            }
        }
    }

    // Merge new drifts into inventory
    let existing = #{};
    for d in all_drifts {
        existing[drift_key(d)] = true;
    }
    let new_count = 0;
    for d in round_drifts {
        let k = drift_key(d);
        if existing[k] == () {
            existing[k] = true;
            all_drifts.push(d);
            new_count += 1;
        }
    }

    let joined = "";
    for d in round_drifts {
        if joined != "" { joined += "||"; }
        joined += drift_key(d);
    }
    let fp = fingerprint(joined);
    if round_drifts.len() == 0 || (last_fp != "" && fp == last_fp) {
        dry_streak += 1;
    } else {
        dry_streak = 0;
    }
    last_fp = fp;

    log("round " + round.to_string() + " new_drifts=" + new_count.to_string()
        + " priority_fixes=" + priority.len().to_string()
        + " dry_streak=" + dry_streak.to_string());

    if dry_streak >= 2 {
        log("dry streak 2 — docs stance stable enough");
        break;
    }

    if priority.len() == 0 && round_drifts.len() == 0 {
        log("auditor found nothing to fix; ending loop");
        break;
    }

    // Agent 2 of 2: Writer
    let audit_blob = json_encode(#{
        product_version: product_version,
        next_free_stamp_hint: next_stamp,
        priority_fixes: priority,
        drifts: round_drifts,
    });

    let write = agent(
        build_write_prompt(audit_blob, focus, allow_version_bump),
        #{
            label: "writer-r" + round.to_string(),
            capability_mode: "read-write",
            output_schema: write_schema,
        }
    );

    if write != () && write.success && write.output != () {
        let sum = "";
        if write.output.summary != () { sum = write.output.summary; }
        write_summaries.push("r" + round.to_string() + ": " + sum);
        log("writer r" + round.to_string() + ": " + sum);

        if write.output.drifts_closed != () {
            for c in write.output.drifts_closed {
                if prior_closed != "" { prior_closed += "; "; }
                prior_closed += c;
            }
        }
        if write.output.blocked == true {
            let reason = "";
            if write.output.blocked_reason != () { reason = write.output.blocked_reason; }
            log("writer blocked: " + reason);
        }
    } else {
        log("writer r" + round.to_string() + " failed or empty");
        dry_streak += 1;
    }
}

// ── Synthesize ─────────────────────────────────────────────────────────────
phase("Synthesize");
let drifts_blob = json_encode(all_drifts);
let sums_blob = json_encode(write_summaries);
if sums_blob == () { sums_blob = "[]"; }
if drifts_blob == () { drifts_blob = "[]"; }

let report = agent(
    build_report_prompt(drifts_blob, sums_blob, product_version),
    #{
        label: "report-writer",
        capability_mode: "read-write",
        output_schema: write_schema,
    }
);

let report_path = "docs/ci/docs-stance-improve-report.md";
let report_summary = "see " + report_path;
if report != () && report.success && report.output != () {
    if report.output.summary != () {
        report_summary = report.output.summary;
    }
    if report.output.changed_files != () {
        for f in report.output.changed_files {
            if f != () {
                // prefer explicit report path if present
                if f == report_path || f.sub_string(0, 8) == "docs/ci/" {
                    report_path = f;
                }
            }
        }
    }
}

complete(#{
    product_version: product_version,
    next_free_stamp_hint: next_stamp,
    rounds: round,
    drift_count: all_drifts.len(),
    write_summaries: write_summaries,
    report_path: report_path,
    report_summary: report_summary,
    prior_closed: prior_closed,
});
