const assert = require("assert");
const {
  normalizeKeywordForDataForSeo,
  sanitizeKeywordList
} = require("../utils/keywordSanitizer");

const raw =
  "Grant management software Corp investors, grant providers,";
const normalized = normalizeKeywordForDataForSeo(raw);

assert.strictEqual(
  normalized,
  "Grant management software Corp investors grant providers"
);

assert.deepStrictEqual(sanitizeKeywordList([raw, " ", normalized]), [normalized]);

const longKeyword = "a".repeat(200);
assert.ok(normalizeKeywordForDataForSeo(longKeyword).length <= 80);

const tooManyWords =
  "one two three four five six seven eight nine ten eleven";
assert.ok(
  normalizeKeywordForDataForSeo(tooManyWords).split(" ").length <= 10
);

console.log("keyword sanitizer tests passed");
