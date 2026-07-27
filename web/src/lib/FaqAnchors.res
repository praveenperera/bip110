@genType
type faqItem = {
  question: string,
  answer: string,
}

@genType
type anchoredFaqItem = {
  question: string,
  answer: string,
  canonicalId: string,
  legacyId: string,
}

let slugify = question =>
  question
  ->String.toLowerCase
  ->String.replaceAllRegExp(/['"]/g, "")
  ->String.replaceAllRegExp(/[^a-z0-9]+/g, "-")
  ->String.replaceAllRegExp(/^-+|-+$/g, "")

@genType
let make = (items: array<faqItem>): array<anchoredFaqItem> => {
  let slugCounts = Dict.make()

  items->Array.mapWithIndex((item, index) => {
    let candidate = slugify(item.question)
    let itemNumber = index + 1
    let baseSlug = candidate === "" ? `question-${itemNumber->Int.toString}` : candidate
    let slugCount = slugCounts->Dict.get(baseSlug)->Option.getOr(0) + 1
    slugCounts->Dict.set(baseSlug, slugCount)

    {
      question: item.question,
      answer: item.answer,
      canonicalId: slugCount === 1 ? baseSlug : `${baseSlug}-${slugCount->Int.toString}`,
      legacyId: `q${itemNumber->Int.toString}`,
    }
  })
}

@genType
let decodeHash = hash => Browser.decodeLocationHash(hash)

@genType
let resolveHash = (items, hash) => {
  let questionId = decodeHash(hash)

  if questionId === "" {
    Nullable.null
  } else {
    items
    ->Array.find(item => item.canonicalId === questionId || item.legacyId === questionId)
    ->Nullable.fromOption
  }
}
