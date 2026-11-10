# Verification

10 November 2026: npm test passed with 96 assertions across all 30 CLI commands. The suite covers original CSV retention, explicit mappings, unchanged and changed imports, transaction rollback, invalid dates and ratings, ambiguous matches, source revisions, superseded reply approvals, separate reviewer checks, manual posting evidence, complete exports and escaped HTML.

The [manual verification run](https://github.com/Enterprise-DNA-OS/review-desk-for-claude-code/actions/runs/42918970645) passed all five jobs on authored commit d65b902: Linux and Windows with Node 20 and 22, and PostgreSQL 17 with Node 22. Each embedded database job also passed npm run demo. The test suite renders and checks the HTML documents and views on both database engines.

There are 33 slash command recipes. npm run view and npm run docs completed locally. The response desk and response evidence report were inspected in a headless browser. Three genuine demo command outputs are stored in docs/demo and used on the comparison page. All demo businesses, people, reviews, URLs and evidence are synthetic. The CSV uses an explicit mapping, not a claimed vendor header contract.

The comparison page passed the page gate with sourced prices. A preview using the current website route and components rendered on desktop and mobile with no browser errors, no horizontal page overflow at 390 pixels, all three offer paths and six tracked booking links. Robots was noindex,nofollow. Source changes and a new reply draft each make older approvals unusable.

The README, operating instructions, command recipes and documentation passed the Command Centre brand lint with no errors or warnings. Automatic CI remains disabled as in the shared template; verification runs on manual dispatch. Later commits that only record this evidence do not change the tested implementation.
