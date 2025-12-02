/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,     // deletion
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j - 1] + 1   // substitution
        );
      }
    }
  }

  return matrix[len1][len2];
}

/**
 * Calculate similarity ratio between two strings (0-1, where 1 is identical)
 */
function similarityRatio(str1: string, str2: string): number {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(str1, str2);
  return 1 - distance / maxLen;
}

/**
 * Check if a string fuzzy matches a query
 * @param text - The text to search in
 * @param query - The search query
 * @param threshold - Minimum similarity ratio (0-1), default 0.6
 * @returns true if fuzzy match found
 */
export function fuzzyMatch(
  text: string,
  query: string,
  threshold: number = 0.6
): boolean {
  const normalizedText = text.toLowerCase().trim();
  const normalizedQuery = query.toLowerCase().trim();

  // Exact match
  if (normalizedText === normalizedQuery) {
    return true;
  }

  // Substring match (exact)
  if (normalizedText.includes(normalizedQuery)) {
    return true;
  }

  // Word-level fuzzy matching
  const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 0);
  const textWords = normalizedText.split(/\s+/).filter(w => w.length > 0);

  // If query is a single word, check against each word in text
  if (queryWords.length === 1) {
    const queryWord = queryWords[0];
    for (const textWord of textWords) {
      // Check substring match first (faster)
      if (textWord.includes(queryWord) || queryWord.includes(textWord)) {
        return true;
      }
      // Check fuzzy similarity
      if (similarityRatio(textWord, queryWord) >= threshold) {
        return true;
      }
    }
    return false;
  }

  // Multi-word query: check if all query words have matches
  return queryWords.every(queryWord => {
    // First try exact substring match
    if (normalizedText.includes(queryWord)) {
      return true;
    }
    // Then try fuzzy match against individual words
    for (const textWord of textWords) {
      if (textWord.includes(queryWord) || queryWord.includes(textWord)) {
        return true;
      }
      if (similarityRatio(textWord, queryWord) >= threshold) {
        return true;
      }
    }
    return false;
  });
}


