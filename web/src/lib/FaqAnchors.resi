/** FAQ content needed to generate a stable anchor */
@genType
type faqItem = {
  question: string,
  answer: string,
}

/** FAQ content paired with canonical and legacy anchors */
@genType
type anchoredFaqItem = {
  question: string,
  answer: string,
  canonicalId: string,
  legacyId: string,
}

/** Adds stable canonical and legacy anchors to FAQ content */
@genType
let make: array<faqItem> => array<anchoredFaqItem>

/** Decodes a URL hash while preserving malformed URI sequences */
@genType
let decodeHash: string => string

/** Resolves canonical and legacy URL hashes to FAQ content */
@genType
let resolveHash: (array<anchoredFaqItem>, string) => Nullable.t<anchoredFaqItem>
