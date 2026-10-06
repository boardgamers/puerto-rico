# Interaction audit

The fixed release enables `autoForcedActions`. After a submitted move, the
engine resolves only actions with no meaningful alternative. Old hosted games
keep their existing options; the local preview enables the policy on saved games
without resetting their position or history.

| Step | Behavior |
| --- | --- |
| Recruitment / surplus-person discard | Automatic when only one person type remains; ask when workers and citizens are both available. |
| Mandatory public cargo shipment | Automatic only when exactly one legal move remains, including optional-point variants and Bohío alternatives. |
| Pass with no available action | Automatic, using the normal phase transition. |
| Production with zero output | Automatic only when no optional point or Bohío choice remains. |
| Assignment with no people | Automatic. |
| Assignment to a single plantation or identical plantations | Automatic only with no buildings and no worker/citizen choice. |
| Storage with no goods | Automatic. |
| Worker placement, production quantities, storage quantities | Manual: a single suggested move still accepts custom choices. |
| Planting, building, trading, private ships, bonus workers/goods | Manual whenever declining or choosing an alternative is legal. |
| Achievement selection / draft, roles, forest conversion, building powers | Preserve choices; only a forced pass is skipped. |

Automatic actions use the same validation, effects, achievements, journal and
history as manual actions. Replay and log slices apply recorded moves one at a
time without re-running automation, preserving intermediate frames. Puertoma
continues using its own decision policy.
