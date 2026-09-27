---
name: sml-skill-create
description: Create, adapt, or audit skills whose instructions will be executed by small language models (roughly 0.5B-14B, local/quantized). Use when writing a new skill for a small-model setup, when shrinking an existing frontier-model skill down to a smaller local model, or when auditing why a small model misbehaves on a skill.
---

## When to Use

Use this skill when you need a procedure (a "skill") that will be *executed by a small language model* — roughly 0.5B–14B parameters, typically run locally, often quantized (GGUF/Q4), with context windows from 4k to 128k.

You are the author; a frontier model drafts the skill. The skill is consumed at runtime by a much smaller model. Write for the runtime model, never for yourself.

- Writing a brand-new skill for a small-model workflow.
- Adapting an existing skill that "worked in Claude/ChatGPT but fails on my local 7B" — nearly always a format, length, or self-correction problem.
- Patching one section of an existing small-model skill.
- Auditing why a small model consistently breaks a given skill.

Do not use for: skills executed only by frontier models, or fine-tuning/training guidance — a skill manages procedure; it cannot inject knowledge the model doesn't already have.

## Reference Points

Empirical constraints (from the small-model prompting literature, 2022–2026) that every decision in this skill should respect. Confidence is high for each; treat them as design constraints, not folklore.

1. **Format commitment is the #1 SLM failure mode.** Small models fail not from missing knowledge but from not committing to the required output shape (omitting replies, refusing, hedging, malformed output). The validated fix is **in-context examples demonstrating the exact format** — exemplars repaired format-following for models like Mistral 7B (81.8→90.9 on a routing task) and lifted a tiny 2B from ~37% to ~95% in-domain accuracy. Prose descriptions of a format are weak; a worked example is strong.
2. **Chain-of-thought is emergent at ~100B parameters.** "Think step by step" does not help small models and can hurt: they produce fluent but broken chains. Capable small models get zero reasoning gain from CoT exemplars (they only align output format); genuinely weak models (<3B, older 7Bs) may borrow the *steps* from examples — so supply steps as examples, not as an instruction to reason.
3. **Long reasoning traces are poison.** SLMs fine-tuned on long-CoT data lose up to 75% of baseline accuracy (error accumulation); in prompting, self-reflective statements help at most once and degrade monotonically beyond that. Keep the skill's demanded reasoning shallow and the model's output short.
4. **Context length alone degrades accuracy** 14–85% even with perfect retrieval, and quality falls off a cliff around 40–50% of the declared window for open models (e.g. Qwen2.5-7B at ~43%). **Every token in your skill is paid for on every run.** Short, dense, zero padding.
5. **Self-correction without external feedback fails.** Models cannot reliably fix their own reasoning (they also suffer "contextual drag" — error-bearing context biases later generations, and iterative refinement can *deteriorate* quality). Verification steps in a skill must be **external**: run the command, grep the exact literal, check the exit code, validate the schema. Never instruct the model to "review your answer and fix it." When a check fails, instruct a **fresh attempt from clean context**, not a revision of the error.
6. **Verbalized confidence is uninformative.** Asking "are you sure?" measures nothing (stated confidence ≈ chance at error detection; internal probabilities, which small-run setups often can't expose, are better). Replace confidence questions with evidence asks: "cite the path and line" or "paste the command output".
7. **Explicit decision rules beat abstract admonitions.** "Be careful", "be thorough", "appropriately" carry no executable content. Model behavior changes with concrete triggers: "If `grep` returns nothing, write `none found`." Under-commitment is fixed by requiring explicit fill-ins ("never omit a section").
8. **There is a practical size floor.** Models below ~1B collapse even on exemplified formats; procedure-following skills realistically want ≥2B (Qwen 2.5/3, Gemma, Llama 3.2 family era). For the very small, shrink the task, don't stretch the skill.

## Skill Anatomy for Small Models

Fixed skeleton. Section order matters (earliest context performs best; avoid burying the critical step mid-skill).

```
---
name: <slug>
description: <one line for a retriever: concrete nouns, function, trigger context>
---

## When to Use
- explicit trigger conditions; 2-4 bullets, retrieval-friendly phrasing

## Procedure
1. <one imperative action per step, numbered>
2. <simple "if Z then W" allowed; no multi-branch trees>
...

## Example
<one worked example of the exact deliverable shape, adjacent to what it shows>

## Verification
- <external check; what to run and expected result, e.g. exit code 0>

## Pitfalls
- <≤5 items; prefer "X; instead Y" phrasing>
```

Length budget (guidance, not gospel): **≤ ~1,000 tokens**; hard ceiling ~1,500. Penalty is continuous with length — see Reference Point 4. If it doesn't fit, split into two narrower skills; narrow single-task skills beat generalist mega-skills for small models.

## Procedure

Follow in order. Each step is load-bearing.

1. **Name the runtime model(s).** Family, size, quantization, context window, instruction template (chat format), available tools. If the fleet is mixed (e.g. both 3B and 14B), write for the *weakest* member.
2. **State the task in one sentence with one deliverable.** A skill with two deliverables usually needs two skills.
3. **Fix the deliverable's exact output shape first.** Decide the verbatim heading names, the one-label answer set, or the JSON schema before writing any instructions. The output shape is the contract.
4. **Write a linear procedure.** Numbered, imperative, one action per step. Allow simple "if X then Y"; avoid nested branches and multi-agent flows the runtime model cannot reliably traverse.
5. **Provide one worked example** of the exact deliverable, placed immediately after the step/section it demonstrates (proximity boosts its effect; don't hide it in an appendix). Max two examples. Make the example *exactly* match the instruction — the example becomes the format target; a prettified "cleaned-up" example trains the wrong format.
6. **Convert behavioral negatives to positives.** "Don't write preambles" → "Write one sentence, then the list." Reserve negative phrasing only for hard output limits: "Reply with exactly one of: A, B, C." (Exploit the fact that negative output-schema constraints are well followed; negative *behavior* constraints are poorly followed.)
7. **Write a Verification section of external checks only.** Commands to run, exact literals to grep, exit codes, schema validation. Never "re-read your output and check for errors".
8. **Add explicit fallbacks for every failure that matters.** "If the search returns nothing, write `none found`" — silent omission is the default SLM behavior without it.
9. **Cut.** Delete every sentence that does not change the runtime model's behavior on this task. Then cut ~30% more. Re-check the token budget against Reference Point 4.
10. **Write the description for a router, not a person.** The description is what a frontier dispatcher matches against a task; it must contain the concrete nouns of the task ("code review of a git diff", "plant care polling"), not marketing.
11. **Note the weakest-model assumption** in your reasoning; if it's below ~2B, flag that the task itself may need shrinking (Reference Point 8).
12. **Test when possible.** Run the skill on 3–5 representative inputs with the real small model. Score: (a) output-format compliance (all headings/invariants present, in order), (b) task success against known-answer inputs. Iterate by patching one section at a time — never a silent full rewrite while examples drift.

## Pitfalls

- **Writing for the author, not the runtime model.** Too clever, too long, too abstract — the skill reads well to a frontier model and fails at runtime. Realize you are the compiler's author, not the executor.
- **Prose-format spec instead of a worked example.** "Return a markdown table with columns..." is weak; showing the table is strong (Reference Point 1).
- **Demanding reasoning.** "Think step by step", long analyses, "justify your reasoning" — small models compound errors over long traces (Reference Points 2–3). Ask for the answer and, if needed, a one-line reason.
- **Self-review and confidence loops.** "Review your answer", "are you sure?", "rate your confidence 1-10" — all measured useless-to-harmful (Reference Points 5–6).
- **Context stuffing.** Bundling whole example files, full git histories, or large doc dumps into a skill. Every token is paid per run (Reference Point 4). Reference *by path*; don't inline the content.
- **Tutorial content injection.** Steps like "understand how the build system works" ask the skill to teach — it can't. Skills invoke; they can't train.
- **Admonitions without triggers.** "Be thorough", "Always be careful" → replace with decision rules (Reference Point 7). "Always" without a condition is the same as "be careful".
- **Silent-omission tolerance.** Any "optional" or "if relevant" section is a license for a small model to drop it. Make required things required explicitly.
- **Example drift on patch.** When patching one section, keep the Example in sync — a stale example silently overrides the new instruction.
- **Assuming the skill's audience.** The executing model never sees the frontier model's reasoning; nothing is "understood" implicitly.

## Verification

Check the finished skill against all of the following before shipping:

- [ ] Frontmatter valid; description contains concrete trigger nouns (retrievable).
- [ ] Exactly one deliverable; its output shape is defined verbatim and demonstrated by an example that *matches* the instruction.
- [ ] Procedure is linear and imperative; no multi-branch trees; no "think step by step".
- [ ] Every Verification step is external and executable (command/exit code/grep/schema) — none are reflective self-checks.
- [ ] Every "if X" has its "then W"; every failure that matters has an explicit fallback (`none found` / return code path).
- [ ] No confidence asks; no "be careful/thorough/appropriately"; behavioral negatives converted to positives.
- [ ] Token count ≤ ~1,000 (hard cap: it fits in ~1,500); no inlined large documents.
- [ ] Written for the weakest model in the fleet; if that is <~2B, the task was shrunk, not the skill stretched.
- [ ] When the skill could be tested: format-compliance and task-success measured on the real model (objective A/B vs. the previous version where one existed).

## Audit Checklist (rewriting existing skills for small models)

1. Read the existing skill and flag: abstract adjectives ("high-quality", "careful", "appropriate"), prose-described formats, self-review steps, unactionable conditions, length.
2. Keep the original's *intent*, not its wording.
3. Rebuild it with this skill's Procedure; if the original depends on CoT or self-critical loops, replace those with direct answers + external checks — this is the most common cause of frontier-skill failure on small models.
4. Preserve or regenerate the Example so it matches the rebuilt procedure exactly.
5. Patches only: one section at a time via the section headers in the skeleton.