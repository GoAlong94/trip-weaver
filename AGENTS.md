# Architecture decisions

- Store trip section visibility as JSON on the trip record so host controls reuse existing trip-level read/update permissions without another table.
- Keep mobile navigation in a separate workspace shell so desktop sidebar behavior remains unchanged.