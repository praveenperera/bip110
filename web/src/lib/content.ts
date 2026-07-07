export const bipMeta = {
  number: 110,
  title: "Reduced Data Temporary Softfork",
  alias: "Also referred to as RDTS (BIP-444)",
  author: "Dathon Ohm",
  status: "Final",
  type: "Standards Track",
  layer: "Consensus (soft fork)",
  created: "2025-12-03",
  license: "BSD-3-Clause",
  pgpFingerprint: "2B97 F032 9374 4D70 F6BB A82F 2E3A 66FF 67F9 8B4F",
  pgpKeyUrl: "/.well-known/dathonohm.asc",
  npub: "npub1azrgrnlmutgxvvjnrtvsn6npm6a08vqz0n0k3k4kf226sv2n93ls4ajl96",
};

export const abstract =
  "Temporarily limit the size of data fields at the consensus level, in order to correct distorted incentives caused by standardizing support for arbitrary data, and to refocus priorities on improving Bitcoin as money.";

export const keyPoints = [
  {
    title: "Temporary Protection",
    description:
      "A one-year deployment that can be refined or extended based on community feedback.",
    icon: "clock",
  },
  {
    title: "Limits Data Storage",
    description:
      "Restricts arbitrary data embedding that burdens node operators and diverts resources.",
    icon: "shield",
  },
  {
    title: "Preserves Monetary Use",
    description:
      "All known monetary use cases remain fully functional and unaffected.",
    icon: "check",
  },
  {
    title: "Refocuses Bitcoin",
    description:
      "Signals that Bitcoin's priority is being the world's best money, not data storage.",
    icon: "target",
  },
];

export const motivation = {
  headline: "Protecting Bitcoin's Purpose",
  paragraphs: [
    "Starting with the 'inscription' hack in 2022, a trend emerged around embedding arbitrary data into Bitcoin transactions. This creates unnecessary burdens on node operators and diverts development focus from Bitcoin's fundamental purpose: being sound, permissionless, borderless money.",
    "Data storage competes unfairly with payments, making Bitcoin transactions unnecessarily costly. This encourages reliance on third-party payment processors, making Bitcoin payments easier to censor.",
    "By limiting data storage, this proposal liberates developers from endless scope creep, enabling them to focus on what's really important: Bitcoin's success as money.",
  ],
};

export const specifications = [
  {
    title: "Output Size Limits",
    simple:
      "New outputs are limited to 34 bytes, except OP_RETURN which allows up to 83 bytes.",
    technical:
      "scriptPubKeys exceeding 34 bytes are invalid unless the first opcode is OP_RETURN (up to 83 bytes valid).",
  },
  {
    title: "Data Push Limits",
    simple:
      "Data pushes and witness elements are limited to 256 bytes maximum.",
    technical:
      "OP_PUSHDATA* payloads and witness stack elements exceeding 256 bytes are invalid (except BIP16 redeemScript).",
  },
  {
    title: "Witness Version Restrictions",
    simple:
      "Only well-defined witness versions (v0 and Taproot) can be spent during the deployment.",
    technical:
      "Spending undefined witness or Tapleaf versions is invalid. Creating outputs with undefined versions is still valid.",
  },
  {
    title: "Taproot Restrictions",
    simple:
      "Taproot annexes, large control blocks, and certain opcodes are temporarily restricted.",
    technical:
      "Witness stacks with annex are invalid. Control blocks limited to 257 bytes. OP_SUCCESS* and OP_IF/OP_NOTIF in Tapscripts are invalid.",
  },
];

export const faqItems = [
  {
    question: "Why is this proposal temporary?",
    answer:
      "The one-year deployment allows the community to evaluate the impact while developers work on a longer-term solution. Some restrictions would severely constrain future upgrades if permanent, but are acceptable for a limited time to address the immediate crisis.",
    category: "general",
  },
  {
    question: "Are there any tradeoffs?",
    answer:
      "Yes. Limiting Taproot control blocks could complicate advanced smart contracts like BitVM. Upgrade hooks are temporarily unavailable for other softforks. Some wallet software using OP_IF in Tapleaves may need updates. However, these are acceptable short-term tradeoffs for the immediate benefits.",
    category: "tradeoffs",
  },
  {
    question: "Is there any risk of funds being frozen or lost?",
    answer:
      "In theory, yes, but this proposal goes to great pains to avoid affecting any known use cases. Funds are completely unaffected if they don't use Taproot, use Taproot in standard ways, or can be spent via keypath or other expected Tapleaves. Additionally, UTXOs created before activation are permanently exempt from the new rules — they can be spent at any time without restriction. A separate two-week grace period between lock-in and activation also provides general preparation time.",
    category: "safety",
  },
  {
    question: "Won't spammers just spread their data over multiple fields?",
    answer:
      "While it's impossible to fully prevent steganography, limiting data sizes ensures abuses are non-contiguous and obfuscated. Requiring users to divide files into chunks of 256 bytes raises the cost in fees and effort, sending a clear message that data storage is unwelcome.",
    category: "technical",
  },
  {
    question: "Why not let the fee market manage data storage?",
    answer:
      "The fee for data storage goes only to the miner, but all node operators must store the data forever without compensation. This creates an unfair burden where miners accept one-time fees while nodes provide perpetual storage for free.",
    category: "technical",
  },
  {
    question: "Why limit scriptPubKeys to 34 bytes?",
    answer:
      "scriptPubKeys must be stored indefinitely in quick-access memory by all nodes. Modern usage is all 34 bytes or smaller, as actual spending conditions are in the witness. Large scriptPubKeys enable data abuse and malicious 'poison blocks' that take a long time to validate.",
    category: "technical",
  },
  {
    question: "Does this break multisig?",
    answer:
      "No. Vanilla multisig (BIP-48, BIP-174, BIP-129) is completely unaffected. Taproot multisig using MuSig/Schnorr signature aggregation is also unaffected. The only area with any potential impact is advanced Taproot Miniscript that uses OP_IF inside tapleaves — and the fix is straightforward: split OP_IF branches into separate tapleaves, which is already best practice for Taproot script design.",
    category: "safety",
  },
  {
    question: "Does the 256-byte limit restrict multisig to 7 keys?",
    answer:
      "No. The 256-byte limit applies to script argument witness items like signatures and data pushes — not to witness scripts, tapleaf scripts, or control blocks. In P2WSH, the witnessScript containing all the public keys is not subject to the 256-byte cap. In P2TR, tapleaf scripts are also excluded from the 256-byte limit, and control blocks are separately capped at 257 bytes. Individual signatures (64–72 bytes) and public keys (33 bytes) are each well under 256 bytes, so standard multisig of any supported size continues to work exactly as before.",
    category: "safety",
  },
  {
    question: "Is this a slippery slope toward banning use cases?",
    answer:
      "No. These rules enshrine long-standing principles of Bitcoin. This softfork doesn't restrict monetary activity—only non-monetary data storage. The temporary nature reinforces this is a targeted intervention, not a new direction.",
    category: "general",
  },
  {
    question: "Does this solve spam completely?",
    answer:
      "No. Spam is best fought with policy/filters, not consensus. This softfork minimizes the impact of malicious miners and closes the worst-case risks, while sending a clear message that data storage is not a supported use case.",
    category: "general",
  },
  {
    question: "Does this affect the UTXO set?",
    answer:
      'No. BIP-110 only limits the size of new outputs going forward — it doesn\'t touch, invalidate, or prune any existing UTXOs. You may be thinking of "The Cat," a separate proposal that would blacklist specific non-monetary UTXOs (like Ordinals and Stamps) and make them permanently unspendable so nodes can prune them. BIP-110 takes a completely different approach: instead of retroactively invalidating existing outputs, it simply limits the size of new ones to discourage future abuse.',
    category: "technical",
  },
  {
    question: "Does this affect the Lightning Network?",
    answer:
      "No. Standard Lightning channels use P2WSH (witness v0), and BIP-110's OP_IF restriction only applies to Tapscripts — so they're completely unaffected. Newer Taproot-based channels split conditional paths into separate tapleaves instead of using OP_IF, so they're also compatible. Both P2WSH and P2TR outputs are exactly 34 bytes, within the limit.",
    category: "safety",
  },
  {
    question: "Why is OP_IF restricted in Tapscripts?",
    answer:
      "Taproot was designed so that each conditional branch lives in its own tapleaf. This is the entire point of MAST (Merklized Alternative Script Trees). Using OP_IF inside a tapleaf is redundant: it reveals unused branches on-chain, defeating Taproot's privacy benefits. In some cases OP_IF can save a few bytes by avoiding merkle path overhead, but at the cost of exposing your other spending conditions to the world. Well-designed Taproot wallets already split conditions into separate tapleaves. This restriction only applies to Tapscripts, so P2WSH scripts (like standard Lightning channels) are completely unaffected.",
    category: "technical",
  },
  {
    question: "How is this different from relay policy filters?",
    answer:
      "Relay policy (mempool filtering) only affects transaction propagation — miners can still include anything they want in blocks. BIP-110 enforces limits at the consensus level, meaning blocks containing oversized data are invalid regardless of who mines them. Policy is a suggestion; consensus is a rule.",
    category: "technical",
  },
  {
    question: "Why does the OP_RETURN limit removal matter?",
    answer:
      "Bitcoin Core v30's default policy changed OP_RETURN from a small metadata field into a much larger relay path for arbitrary data. The deeper issue is not one opcode: defaults shape what most nodes and miners see, standardness rules already make judgments about network health, and node operators absorb storage, bandwidth, and legal costs that miners do not. BIP-110 responds by temporarily making the worst data-storage patterns invalid instead of depending on relay defaults that maintainers can change.",
    category: "technical",
  },
  {
    question: "Is this optional for miners?",
    answer:
      "During the signaling phase, miners choose whether to signal support. If 55% signal in a retarget period, the softfork locks in early. If not, mandatory signaling kicks in before the deadline — blocks that don't signal are rejected, guaranteeing lock-in. Once activated, the new rules are enforced at the consensus level: any block that violates them is rejected by all enforcing nodes, regardless of the miner's preference.",
    category: "general",
  },
  {
    question: "What happens when the deployment expires?",
    answer:
      "After approximately one year (52,416 blocks), all restrictions automatically lift and Bitcoin returns to its pre-activation rules. No action is needed from users or node operators. If the community wants to continue or refine the protections, a new proposal would need to go through the activation process again.",
    category: "general",
  },
];

export const timeline = [
  {
    date: "December 1, 2025",
    event: "Signaling Begins",
    description:
      "Miners signal readiness using bit 4. Early lock-in if 55% of blocks signal in a retarget period (1109/2016).",
  },
  {
    date: "~August 2026",
    event: "Mandatory Lock-in",
    description:
      "If not locked in early, mandatory signaling begins — blocks that don't signal are rejected as invalid, guaranteeing lock-in.",
  },
  {
    date: "2 weeks post lock-in",
    event: "Activation",
    description:
      "New consensus rules take effect. Blocks violating these rules are rejected by all enforcing nodes. Pre-existing UTXOs remain permanently exempt.",
  },
  {
    date: "~1 year after activation",
    event: "Expiry",
    description:
      "52,416 blocks after activation, all restrictions lift automatically.",
  },
];

export const installOptions = [
  {
    platform: "Bitcoin Knots",
    description: "Official Bitcoin Knots release with BIP-110/RDTS support",
    link: "https://bitcoinknots.org/",
    status: "available",
    icon: "download",
  },
  {
    platform: "Start9",
    description: "Official Start9 package with an RDTS activation task",
    link: "/howto#start9",
    status: "available",
    icon: "server",
  },
  {
    platform: "Umbrel",
    description: "One-click install from the Umbrel app store",
    link: "/howto#umbrel",
    status: "available",
    icon: "cloud",
  },
  {
    platform: "myNode",
    description: "One-click install for myNode servers",
    link: "/howto#mynode",
    status: "available",
    icon: "box",
  },
  {
    platform: "Parmanode",
    description: "Simple one-click style install for Parmanode users",
    link: "/howto#parmanode",
    status: "available",
    icon: "server",
  },
  {
    platform: "Docker",
    description: "For advanced users running their own Docker infrastructure",
    link: "/howto#docker",
    status: "available",
    icon: "box",
  },
];

export const articleSections = [
  {
    title: "Context",
    description:
      "Start with the institutional and technical background: the network, the leverage points, the merge, and the OP_RETURN policy change.",
    articles: [
      {
        title: "CAPTURE: The Network",
        description:
          "Part one documents the people, institutions, and incentives that hodlonaut argues shaped Bitcoin Core's informal power structure before the OP_RETURN controversy.",
        author: "hodlonaut",
        date: "Mar 27, 2026",
        link: "https://www.citadel21.com/the-network",
        image:
          "https://static1.squarespace.com/static/5e2372d18e3cf11ebaf2d20d/t/69c69f53c2f49f1bfc82a196/1777287880656/HeadingFrontPage.jpg?format=1500w",
      },
      {
        title: "CAPTURE: The Lever",
        description:
          "Part two examines how funding, review influence, and institutional weight can sideline inconvenient contributors without a formal governance process.",
        author: "hodlonaut",
        date: "Apr 29, 2026",
        link: "https://www.citadel21.com/the-lever",
        image:
          "https://static1.squarespace.com/static/5e2372d18e3cf11ebaf2d20d/t/69f0f9576afb6c0173521995/1777400151577/wide.jpg?format=1500w",
      },
      {
        title: "CAPTURE: The Merge",
        description:
          "Part three of hodlonaut's CAPTURE series traces how a documentation change, Luke's filter patch, and the OP_RETURN uncap PRs built toward Bitcoin Core's contested 2025 merge.",
        author: "hodlonaut",
        date: "Jun 15, 2026",
        link: "https://www.citadel21.com/the-merge",
        image:
          "https://static1.squarespace.com/static/5e2372d18e3cf11ebaf2d20d/t/6a2f0f26dbedb812c32a3ac3/1781468966816/MergeWide.jpg?format=1500w",
      },
      {
        title:
          "The OP_RETURN Limit Removal: Gaslighting or Technical Necessity?",
        description:
          "Melvin Carvalho's research report weighs the stated technical case for removing Bitcoin's 80-byte OP_RETURN limit against process concerns, conflicts of interest, and BIP-110's response.",
        author: "Melvin Carvalho",
        date: "Feb 2026",
        link: "https://melvin.me/public/articles/opreturn.html",
        image: null,
      },
    ],
  },
  {
    title: "BIP-110",
    description:
      "Then move into the proposal itself: activation mechanics, game theory, legal exposure, and the objections to the soft fork.",
    articles: [
      {
        title: "BIP-110: The Temporary Softfork",
        description:
          "A deep-dive game theory analysis and code audit examining what the mechanism design reveals and what the code actually does.",
        author: "Melvin Carvalho",
        date: "Feb 2026",
        link: "https://melvin.me/public/articles/bip110.html",
        image: "https://melvin.me/public/articles/og-bip110.png",
      },
      {
        title:
          "Bitcoin Has a Squatter Problem. BIP 110 Is the Eviction Notice.",
        description:
          "Why a temporary soft fork is the most important thing happening in Bitcoin right now, and why the FUD about it is dead wrong.",
        author: "Kyle Santiago",
        date: "Feb 17, 2026",
        link: "https://privkey.substack.com/p/bitcoin-has-a-squatter-problem-bip",
        image:
          "https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fe8ab2984-2b66-4bea-a15b-a6ff47912471_1408x768.jpeg",
      },
      {
        title: "BIP 110 Neutralizes Bitcoin's Biggest Legal Attack Vector",
        description:
          "Arbitrary data on the blockchain creates untested legal exposure for every node operator on the network. BIP 110 is the protocol-level fix that shrinks it.",
        author: "Kyle Santiago",
        date: "Feb 24, 2026",
        link: "https://privkey.substack.com/p/bip-110-neutralizes-bitcoins-biggest",
        image:
          "https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F1696de22-fb9f-4e41-bf9d-85a2124d8af8_1408x768.jpeg",
      },
      {
        title: "BIP-110 Objections: Asymmetry of Scale",
        description:
          "Every objection raised against BIP-110, triaged against the data. Millions of spam transactions vs. hypothetical edge cases and rhetorical tactics.",
        author: "Melvin Carvalho",
        date: "Mar 7, 2026",
        link: "https://melvin.me/public/articles/bip110-objections.html",
        image: "https://melvin.me/public/articles/og-bip110-objections.png",
      },
    ],
  },
  {
    title: "Further analysis",
    description:
      "Additional modeling and follow-up work that extends the framework.",
    articles: [
      {
        title: "BIP-110 Code Walkthrough",
        description:
          "A guided version of the Bitcoin Knots code review, organized by rule, source file, activation state, grandfathering, and expiry.",
        author: "BIP110.org",
        date: "Jul 2026",
        link: "/code-walkthrough",
        image: null,
      },
      {
        title: "BIP-110: The Corrected Analysis",
        description:
          "Issue #5's simulation had bugs. The real numbers are bigger and more interesting.",
        author: "Renaud Cuny",
        date: "Jan 29, 2026",
        link: "https://blockspaceweekly.substack.com/p/issue-8-bip-110-the-corrected-analysis",
        image:
          "https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F0f30a913-6cdc-49f2-9c6a-ab71f2c2c400_1420x1134.png",
      },
    ],
  },
] as const;

export const articles = articleSections.flatMap((section) => section.articles);

export type Article = (typeof articles)[number];

export const tradeoffs = {
  headline: "Important Considerations",
  items: [
    {
      title: "BitVM & Advanced Contracts",
      description:
        "The 257-byte control block limit constrains large Taptrees. Advanced smart contracts like BitVM may need to wait until expiry or use testnet/sidechains.",
      severity: "medium",
    },
    {
      title: "Wallet Compatibility",
      description:
        "Some wallets like Nunchuk allow arbitrary Miniscript and may create Tapleaves with OP_IF. These wallets would need to update before activation to stop creating Tapleaves with OP_IF. UTXOs created before activation are permanently exempt, so existing funds are unaffected regardless of wallet software. Wallet developers have until mandatory lock-in (~August 2026) plus a two-week grace period to update. Even after activation, only newly created UTXOs are subject to the new rules. Updating is straightforward: split OP_IF branches into separate tapleaves, which is already best practice for Taproot.",
      severity: "low",
    },
    {
      title: "Upgrade Hooks",
      description:
        "Upgrade hooks via undefined witness versions and OP_SUCCESS are unavailable during deployment. Since softforks take over a year to coordinate, this shouldn't be a practical issue.",
      severity: "low",
    },
  ],
  safety: {
    headline: "Fund Safety",
    content:
      "Funds are at risk only if ALL of these conditions are met: the UTXO is P2TR, it's in a pre-signed transaction, it must be confirmed AND spent during the one-year deployment, the selected Tapleaf violates the new rules, AND there are no other valid spending paths. In practice, this scenario is extremely unlikely.",
  },
};
