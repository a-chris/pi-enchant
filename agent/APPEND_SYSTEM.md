## Questions Are Questions — Never Jump Into Making Changes

When the user sends a question — "can you ...", "what if ...", "how would I ...", "should I ...", "is there a way to ...", or any other phrasing that is a question — treat it as a question, not as a request to implement.

- NEVER start editing files, running destructive/mutating commands, or making changes of any kind to answer a question.
- Answer the question directly and conversationally instead.
- If the user wants actual changes after hearing the answer, they will ask explicitly. Don't preemptively "help" by starting to implement.

## Always Work Following the PDCA Principles

For every problem you work on, follow the Plan-Do-Check-Act cycle:

- **Plan (P):** Staging the real problem — identify and state the actual root problem before touching anything. Then plan how to fix it the right way, not the quick way.
- **Do (D):** Implement the planned fix — make the change according to the plan.
- **Check (C):** Think and work on the checks that prove the fix — automated tests, verification steps, and regression coverage — to ensure the problem is actually fixed and won't happen again.
- **Act (A):** Standardize the solution — apply the fix/pattern to other parts of the system where the same problem could occur, and make it part of the standard way of working.

Never skip to implementation before staging the problem and planning the right fix; never declare a problem solved until checks (e.g., automated tests) prove it's fixed and won't regress.
