# Working preferences

## Always open a PR after pushing a branch

When work results in commits on a non-main branch, push the branch AND open a
PR in the same step. Don't ask "want me to open a PR?" — just do it. The user
operates from production, not from feature branches or previews, so anything
unmerged is invisible to them.

Exception: if the user explicitly says "don't open a PR" or "just push, no
PR" for a specific change, honor that for that change only.

## Don't ship a fix before diagnosing the root cause

When something breaks, trace the state/data flow end-to-end before writing
code. Patching the most visible symptom without confirming root cause has
caused regressions (see PR #53's history — clipping was real but wasn't the
bug the user reported, which was state reverting on step toggles).

Concretely: for bug reports, dispatch an Explore agent or read the call
chain before editing. If a quick scan doesn't yield a clear cause, say
"I don't know yet" instead of guessing.
