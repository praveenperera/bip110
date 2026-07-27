/** BIP metadata displayed throughout the site */
@genType
type bipMetadata = {
  number: int,
  title: string,
  alias: string,
  author: string,
  status: string,
  type_: string,
  layer: string,
  created: string,
  license: string,
  pgpFingerprint: string,
  pgpKeyUrl: string,
  npub: string,
}

/** Icon identifier for a key point */
@genType
type keyPointIcon = [#clock | #shield | #check | #target]

/** One headline benefit */
@genType
type keyPoint = {
  title: string,
  description: string,
  icon: keyPointIcon,
}

/** Motivation copy */
@genType
type motivationContent = {
  headline: string,
  paragraphs: array<string>,
}

/** Plain-language and technical rule description */
@genType
type specification = {
  title: string,
  simple: string,
  technical: string,
}

/** FAQ topic */
@genType
type faqCategory = [#general | #tradeoffs | #safety | #technical]

/** One FAQ entry */
@genType
type faqItem = {
  question: string,
  answer: string,
  category: faqCategory,
}

/** One deployment-timeline milestone */
@genType
type timelineEvent = {
  date: string,
  event: string,
  description: string,
}

/** Install-option icon */
@genType
type installIcon = [#download | #server | #cloud | #box]

/** Install-option availability */
@genType
type installStatus = [#available]

/** One supported installation path */
@genType
type installOption = {
  platform: string,
  description: string,
  link: string,
  status: installStatus,
  icon: installIcon,
}

/** Article metadata used by article listings */
@genType
type article = {
  title: string,
  description: string,
  author: string,
  date: string,
  link: string,
  image: Nullable.t<string>,
}

/** Named group of related articles */
@genType
type articleSection = {
  title: string,
  description: string,
  articles: array<article>,
}

/** Published source for a response */
@genType
type responseSource = {
  name: string,
  author: string,
  url: string,
  published: string,
}

/** Criticism addressed by a response */
@genType
type responseClaim = {
  name: string,
  statement: string,
  source: responseSource,
}

/** Responsive card image metadata */
@genType
type responseCardImage = {
  src: string,
  alt: string,
  width: int,
  height: int,
}

/** Stable route slug for a published response */
@genType
type responseSlug = [#blockslop | #"op-plenty"]

/** Metadata shared by response listings and article pages */
@genType
type responseEntry = {
  slug: responseSlug,
  title: string,
  date: string,
  dateIso: string,
  author: string,
  claim: responseClaim,
  summary: string,
  description: string,
  cardImage: responseCardImage,
  ogImage: string,
  ogImageAlt: string,
}

/** Introductory copy for response listings */
@genType
type responsesIntroContent = {
  headline: string,
  subhead: string,
}

/** Relative severity assigned to a tradeoff */
@genType
type tradeoffSeverity = [#low | #medium]

/** One deployment tradeoff */
@genType
type tradeoffItem = {
  title: string,
  description: string,
  severity: tradeoffSeverity,
}

/** Fund-safety summary */
@genType
type tradeoffSafety = {
  headline: string,
  content: string,
}

/** Tradeoff section content */
@genType
type tradeoffsContent = {
  headline: string,
  items: array<tradeoffItem>,
  safety: tradeoffSafety,
}

/** Canonical BIP metadata */
@genType
let bipMeta: bipMetadata

/** Proposal abstract */
@genType
let abstractText: string

/** Headline proposal benefits */
@genType
let keyPoints: array<keyPoint>

/** Motivation section */
@genType
let motivation: motivationContent

/** Consensus-rule summaries */
@genType
let specifications: array<specification>

/** Frequently asked questions */
@genType
let faqItems: array<faqItem>

/** Deployment timeline */
@genType
let timeline: array<timelineEvent>

/** Supported installation paths */
@genType
let installOptions: array<installOption>

/** Article sections in display order */
@genType
let articleSections: array<articleSection>

/** All articles flattened in display order */
@genType
let articles: array<article>

/** Response-list introduction */
@genType
let responsesIntro: responsesIntroContent

/** Response to the BlockSlop late-upgrade claim */
@genType
let blockslopResponse: responseEntry

/** Response to the OP_PLENTY encoding demonstration */
@genType
let opPlentyResponse: responseEntry

/** Published responses in display order */
@genType
let responses: array<responseEntry>

/** Deployment tradeoffs and safety summary */
@genType
let tradeoffs: tradeoffsContent
