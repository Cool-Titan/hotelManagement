// Keyword classifier. It is the fallback when the AI is unavailable and a
// second opinion when the AI answers: if they disagree, the enquiry is
// treated as uncertain. It is deliberately conservative.

export type Category = "ROOM" | "WEDDING" | "OFFSITE" | "COMPLAINT" | "OTHER";

const RULES: Record<Exclude<Category, "OTHER">, RegExp[]> = {
  COMPLAINT: [
    /\bcomplain(t|ts|ing)?\b/, /\bdisappoint(ed|ing)\b/, /\bterrible\b/, /\bworst\b/, /\brefund\b/, /\brude\b/,
    /\bdirty\b/, /\bunacceptable\b/, /\bnot (happy|satisfied)\b/, /\bpoor (service|food|experience)\b/,
    /\bbad experience\b/, /\bover ?charged\b/, /\bcockroach|insects?|bed ?bugs?\b/, /\bnever again\b/,
    /\bhorrible|awful|pathetic\b/, /\bno one (responded|answered|replied)\b/, /\bcharged twice\b/,
  ],
  WEDDING: [
    /\bwedding\b/, /\bmarriage\b/, /\bsangeet\b/, /\bmehendi|mehndi\b/, /\b(wedding|marriage) reception\b|\breception (party|dinner|for \d+)/, /\bbride|groom\b/,
    /\bhaldi\b/, /\bengagement\b/, /\bshaadi\b/, /\bmuhurtham?\b/,
  ],
  OFFSITE: [
    /\boff-?site\b/, /\bcorporate\b/, /\bconference\b/, /\bteam\b/, /\bcompany\b/, /\bcolleagues\b/,
    /\bemployees\b/, /\bworkshop\b/, /\bmeeting\b/, /\bdelegates\b/, /\bteam[- ]building\b/, /\bmice\b/, /\bseminar\b/,
  ],
  ROOM: [
    /\brooms?\b/, /\bvillas?\b/, /\bsuites?\b/, /\bstay\b/, /\bnights?\b/, /\bavailab(le|ility)\b/, /\bfree\b/,
    /\badults?\b/, /\bcheck[- ]?in\b/, /\bbook(ing)?\b/, /\bcottage\b/, /\bhoneymoon\b/, /\bweekend\b/,
  ],
};

export type KeywordResult = {
  category: Category;
  confidence: number; // never above 0.65 — keyword matches always get a human check
  scores: Record<Category, number>;
  complaintSignal: boolean;
};

export function keywordClassify(text: string): KeywordResult {
  const t = text.toLowerCase();
  const scores: Record<Category, number> = { ROOM: 0, WEDDING: 0, OFFSITE: 0, COMPLAINT: 0, OTHER: 0 };
  for (const [cat, patterns] of Object.entries(RULES) as [Exclude<Category, "OTHER">, RegExp[]][]) {
    scores[cat] = patterns.filter((p) => p.test(t)).length;
  }
  // Events also mention rooms and nights; give their specific words more weight.
  const weighted: Record<Category, number> = {
    ...scores,
    WEDDING: scores.WEDDING * 3,
    OFFSITE: scores.OFFSITE * 2,
    COMPLAINT: scores.COMPLAINT * 3,
  };
  const ranked = (Object.entries(weighted) as [Category, number][]).sort((a, b) => b[1] - a[1]);
  const [best, second] = ranked;
  if (best[1] === 0) return { category: "OTHER", confidence: 0.2, scores, complaintSignal: false };
  const margin = best[1] - second[1];
  return {
    category: best[0],
    confidence: Math.min(0.65, 0.35 + 0.1 * margin),
    scores,
    complaintSignal: scores.COMPLAINT > 0,
  };
}
