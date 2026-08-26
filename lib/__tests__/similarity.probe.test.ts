import { expect, it } from "vitest";
import { similarity } from "../gate";
import { NEAR_DUPLICATE_THRESHOLD } from "../gate";
import { BODY, OTHER } from "./fixtures";

/** Pins the threshold against realistic edits, so tuning it is a deliberate act. */
it("separates personalization from a genuinely new message", () => {
  const nameOnly = similarity(BODY, BODY.replace("نورة", "طارق"));
  const rewritten = similarity(BODY, "هلا طارق، شفت إعلانكم عن التوسع" + BODY.slice(45));
  const unrelated = similarity(BODY, OTHER);

  console.log(
    `  name swap ${nameOnly.toFixed(3)} · partial rewrite ${rewritten.toFixed(3)} · unrelated ${unrelated.toFixed(3)} · threshold ${NEAR_DUPLICATE_THRESHOLD}`,
  );

  expect(nameOnly).toBeGreaterThanOrEqual(NEAR_DUPLICATE_THRESHOLD);
  expect(unrelated).toBeLessThan(NEAR_DUPLICATE_THRESHOLD);
});
