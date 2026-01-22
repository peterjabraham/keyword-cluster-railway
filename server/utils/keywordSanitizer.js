const normalizeKeywordForDataForSeo = (value) => {
  if (!value) {
    return "";
  }
  const cleaned = value
    .toString()
    .replace(/[^a-z0-9\s-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) {
    return "";
  }
  const limitedWords = cleaned.split(" ").slice(0, 10);
  return limitedWords.join(" ").slice(0, 80).trim();
};

const sanitizeKeywordList = (keywords = []) =>
  Array.from(
    new Set(
      keywords
        .map((item) => normalizeKeywordForDataForSeo(item))
        .filter(Boolean)
    )
  );

module.exports = {
  normalizeKeywordForDataForSeo,
  sanitizeKeywordList
};
