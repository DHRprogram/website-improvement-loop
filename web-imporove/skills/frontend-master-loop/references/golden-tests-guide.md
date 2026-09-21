# Golden Tests Guide

Golden tests are recorded once against the existing site (R4) and used as
reference throughout the redesign. Each test captures:
- Full-page screenshot (viewport + full)
- DOM structure hash
- Network request list
- Console messages
- Performance metrics
- axe-core accessibility results

When a route is rebuilt (R7), the golden test is re-run and compared. If
visual or behavioral diff exceeds threshold, the rebuild is rejected.
