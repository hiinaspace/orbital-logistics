# Astra review — continuous moving-Selene service

Native gpt-6-astra, architecture consultation followed by read-only implementation
review and independent experiments. No implementation was delegated.

Initial findings:
- The actual ballistic depot stays safely above Selene through epoch 64; independent
  DOP853 and successive canonical chunks agree within roughly 2.1e-9 position and
  4.5e-8 velocity. Safety does not require stationkeeping in this exhibit.
- Pad/depot plane alignment changes considerably. A copied or uniformly rotated
  launch is insufficient; each occurrence must solve against the current target.
- Exact global-grid restarts reproduce the parent target provider bitwise through
  9,125 grid/off-grid queries, including half-unit chunk boundaries.
- The exact phase-root seed can fail while a nearby departure succeeds. The phase
  window is a search seed, not a guarantee.

Implementation findings and disposition:
1. Fixed planning boundaries, frozen during yielded work, replaced retrospective
   admission. Budget 1 versus 128 and small versus large target advances agree.
2. Delivery accounting moved before eviction. A separate ground checkpoint retains
   fuel and cumulative consumption after old trips leave history.
3. Recoverable targeting/supply/candidate-budget refusals retry. Canonical identity,
   unsupported domain and shared-stock corruption stop.
4. Field phases, hardware and resource-flow directions are pinned at admission.
5. Depot pre-allocation, aggregate ownership, preparation overlap and held drawing
   history have explicit limits. Failed trial work and rejected candidate ownership
   enter measured counters.
6. Calendar exhaustion closes new admission while allowing the last admitted return
   and its paid landing to finish.
7. View normalization derives the real moving-body pad provider. An independent held
   cursor at .46 retained identical pose and stocks while worker oldest advanced
   from .45 to .65.

Final reviewer verdict: architecture sound for the bounded continuous slice, with
no remaining physics, scheduler or view blocker. The final accounting correction
records/checks candidate ownership before a per-candidate refusal. Requested final
gates are the full-calendar conservation rollout, independent later-phase replay,
parent-step convergence on the actual second sortie, and production browser checks.

The evidence records those gates; owner viewing remains the aesthetic acceptance.
