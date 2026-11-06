const normalize = value => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

const terms = value => new Set(normalize(value).split(' ').filter(token => token.length > 3));

export function retrieve(question, language, { articles, topics }, fits) {
  const query = ' ' + normalize(question) + ' ';
  const words = terms(question);
  const titles = articles.map(article => terms(article.title));
  const frequency = new Map();
  for (const title of titles) {
    for (const term of title) frequency.set(term, (frequency.get(term) ?? 0) + 1);
  }
  const scored = articles.map((article, index) => {
    const aliases = topics[article.id]?.[language] ?? [];
    const matches = aliases.map(normalize).filter(alias => alias && query.includes(' ' + alias + ' '));
    const aliasScore = Math.max(0, ...matches.map(alias => alias.split(' ').length));
    const uncommon = [...titles[index]].filter(term => words.has(term) && frequency.get(term) <= 3);
    return { article, aliasScore, lexical: uncommon.length };
  });
  const bestAlias = Math.max(0, ...scored.map(item => item.aliasScore));
  // Prefer the strongest reviewed topic. Full-body vocabulary overlap is too
  // broad to establish relevance and can crowd out the article that answers.
  const ranked = scored.filter(item => bestAlias ? item.aliasScore === bestAlias : item.lexical >= 3)
    .sort((a, b) => b.lexical - a.lexical || a.article.id.localeCompare(b.article.id, 'en'));
  const packs = [];
  for (const { article } of ranked) {
    if (packs.length === 3) break;
    if (fits([...packs, article])) packs.push(article);
  }
  return packs;
}
