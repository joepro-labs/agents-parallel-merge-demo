// Feature flags — defaulted OFF. Risky/user-visible code merges "dark" behind a
// flag so PRs are always safe to land in any order. A "release" is flipping a
// flag (instant, deploy-free), NOT merging. See AGENTS.md rule 3.
const FLAGS = {
  // example: new pricing page, merged but not yet launched.
  newPricingPage: false,
};

function isEnabled(name) {
  return Boolean(FLAGS[name]);
}

module.exports = { FLAGS, isEnabled };
