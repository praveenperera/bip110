import {
  abstractText,
  articleSections as rescriptArticleSections,
  articles as rescriptArticles,
  bipMeta as rescriptBipMeta,
  blockslopResponse,
  faqItems,
  installOptions,
  keyPoints,
  motivation,
  opPlentyResponse,
  responses,
  responsesIntro,
  specifications,
  timeline,
  tradeoffs,
  type article,
  type responseClaim,
  type responseEntry,
  type responseSource,
} from "./Content.gen.ts";

/** Article metadata used by article listings */
export type Article = Omit<article, "image"> & {
  readonly image: string | null;
};

/** Named group of related articles */
export interface ArticleSection {
  readonly title: string;
  readonly description: string;
  readonly articles: readonly Article[];
}

/** Published source for a response */
export type ResponseSource = responseSource;

/** Criticism addressed by a response */
export type ResponseClaim = responseClaim;

/** Metadata shared by response listings and article pages */
export type ResponseEntry = responseEntry;

const { type_: type, ...metadata } = rescriptBipMeta;

/** Canonical BIP metadata with the historical `type` field name */
export const bipMeta = { ...metadata, type };

/** Proposal abstract */
export const abstract = abstractText;

/** Article sections in display order */
export const articleSections =
  rescriptArticleSections as readonly ArticleSection[];

/** All articles flattened in display order */
export const articles = rescriptArticles as readonly Article[];

export {
  blockslopResponse,
  faqItems,
  installOptions,
  keyPoints,
  motivation,
  opPlentyResponse,
  responses,
  responsesIntro,
  specifications,
  timeline,
  tradeoffs,
};
