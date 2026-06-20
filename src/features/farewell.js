// Demo feature: farewell — dark merge, gated by a flag that defaults OFF (AGENTS.md rule 3).
// Deliberately does NOT edit the shared src/flags.js, so this PR stays conflict-free
// and can batch through the merge queue beside the other demo PRs (AGENTS.md rule 1).
const { isEnabled } = require("../flags");

module.exports = function farewell() {
  if (!isEnabled("farewell")) return undefined; // no-op while the flag is OFF
  return "farewell";
};
