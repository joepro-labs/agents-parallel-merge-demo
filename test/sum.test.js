const { test } = require("node:test");
const assert = require("node:assert");
const { sum } = require("../src/sum");
const { isEnabled } = require("../src/flags");

test("sum adds two numbers", () => {
  assert.strictEqual(sum(2, 3), 5);
});

test("flags default OFF (dark merges are safe)", () => {
  assert.strictEqual(isEnabled("newPricingPage"), false);
});
