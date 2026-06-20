// Stand-in for a real build. Fast + deterministic.
const { sum } = require("../src/sum");
if (sum(1, 1) !== 2) {
  console.error("build: sanity check failed");
  process.exit(1);
}
console.log("build: ok");
