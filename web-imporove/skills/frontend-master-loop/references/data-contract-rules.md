# Data Contract Rules

1. Once frozen in R3, the data contract may NOT change.
2. Any PR altering a table, column, or API shape without re-freezing is blocked.
3. Exceptions require explicit user approval and a new freeze.
4. The frozen contract lives at artifacts/redesign/data-contract/.
5. Guard no-schema-change.sh enforces this at every phase.
