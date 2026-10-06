export type LegalBookRecord = {
  title: string;
  author: string;
  edition: string;
  year: number;
  publisher: string;
  topic: string;
  bookType: string;
  catalogUrl: string | null;
  licensingNote: string;
  authorityNote: string;
};

export const LEGAL_BOOK_CATALOG = [
  {
    title: "Commentaries on the Laws of England",
    author: "William Blackstone",
    edition: "First edition",
    year: 1765,
    publisher: "Clarendon Press",
    topic: "English common law; historical doctrine",
    bookType: "treatise",
    catalogUrl: null,
    licensingNote: "Public-domain historical work. Use a verified edition or library scan for page-level citation.",
    authorityNote: "SECONDARY / HISTORICAL. Useful for doctrine and history; not current governing law.",
  },
  {
    title: "Commentaries on the Constitution of the United States",
    author: "Joseph Story",
    edition: "First edition",
    year: 1833,
    publisher: "Hilliard, Gray, and Company",
    topic: "United States constitutional law; historical doctrine",
    bookType: "treatise",
    catalogUrl: null,
    licensingNote: "Public-domain historical work. Use a verified edition or library scan for page-level citation.",
    authorityNote: "SECONDARY / HISTORICAL. Useful for doctrine and history; not current governing law.",
  },
  {
    title: "Restatement (Second) of Contracts",
    author: "American Law Institute",
    edition: "Second",
    year: 1981,
    publisher: "American Law Institute Publishers",
    topic: "Contracts",
    bookType: "restatement",
    catalogUrl: "https://www.ali.org/publications/show/contracts/",
    licensingNote: "Copyrighted/licensed publication. Store metadata and lawful excerpts only unless licensed for full-text use.",
    authorityNote: "SECONDARY / PERSUASIVE. It can be influential but does not itself establish governing law.",
  },
] as const satisfies readonly LegalBookRecord[];

export function relevantLegalBooks(question: string): LegalBookRecord[] {
  const q = question.toLowerCase();
  const selected: LegalBookRecord[] = [];

  if (/contract|lease|rent|purchase|seller financ|owner financ/i.test(q)) {
    selected.push(LEGAL_BOOK_CATALOG[2]);
  }
  if (/constitution|civil right|government|due process/i.test(q)) {
    selected.push(LEGAL_BOOK_CATALOG[1]);
  }
  if (/property|land|common law|ownership|rent/i.test(q)) {
    selected.push(LEGAL_BOOK_CATALOG[0]);
  }

  return selected.length ? selected : [LEGAL_BOOK_CATALOG[0]];
}
