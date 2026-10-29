// Haversine formula to calculate distance in meters between two coordinates
export function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Tokenize and calculate Jaccard similarity for descriptions/titles
export function calculateTextSimilarity(textA, textB) {
  if (!textA || !textB) return 0;

  const tokenize = (str) =>
    str
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2);

  const tokensA = new Set(tokenize(textA));
  const tokensB = new Set(tokenize(textB));

  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  const intersection = new Set([...tokensA].filter((x) => tokensB.has(x)));
  const union = new Set([...tokensA, ...tokensB]);

  return Math.round((intersection.size / union.size) * 100);
}

/**
 * Detect possible duplicate issues for a new report
 * Section 5 Feature 1:
 * - Geographic proximity & GPS
 * - Category match
 * - Description similarity
 * - Infrastructure identity
 * - Proximity alone NEVER automatically merges.
 */
export function evaluateDuplicateMatch(newReport, existingIssue) {
  // Category check: if completely different, heavily penalize
  const sameCategory = newReport.category === existingIssue.category;
  const categoryScore = sameCategory ? 100 : 0;

  // Distance in meters
  const distance = calculateDistanceMeters(
    Number(newReport.latitude),
    Number(newReport.longitude),
    Number(existingIssue.latitude),
    Number(existingIssue.longitude)
  );

  // Proximity score: within 25m = 100, decays up to 250m
  let distanceScore = 0;
  if (distance <= 25) {
    distanceScore = 100;
  } else if (distance <= 75) {
    distanceScore = 85;
  } else if (distance <= 150) {
    distanceScore = 65;
  } else if (distance <= 250) {
    distanceScore = 40;
  } else {
    distanceScore = 0;
  }

  // Text similarity across title and description
  const titleSim = calculateTextSimilarity(newReport.title, existingIssue.title);
  const descSim = calculateTextSimilarity(newReport.description, existingIssue.description);
  const textScore = Math.round(titleSim * 0.4 + descSim * 0.6);

  // Status check: open issues are active duplicates; resolved issues within 14 days can be recurring
  let statusScore = 60;
  if (['Pending', 'Assigned', 'In Progress', 'Escalated'].includes(existingIssue.status)) {
    statusScore = 100;
  } else if (existingIssue.status === 'Resolved') {
    statusScore = 40;
  }

  // Compute composite matching score (0 - 100)
  // Distance: 35%, Text: 30%, Category: 25%, Status: 10%
  // CRITICAL RULE: If distance is large (>250m) or category is different, overall score is capped low.
  let overallScore = 0;
  if (sameCategory && distance <= 250) {
    overallScore = Math.round(
      distanceScore * 0.35 +
      textScore * 0.30 +
      categoryScore * 0.25 +
      statusScore * 0.10
    );
  } else if (sameCategory && distance <= 500 && textScore >= 70) {
    // Edge case: slightly farther but strong text match
    overallScore = Math.round(textScore * 0.6 + distanceScore * 0.2 + categoryScore * 0.2);
  }

  return {
    issueId: existingIssue.id,
    issueCode: existingIssue.issue_code,
    title: existingIssue.title,
    category: existingIssue.category,
    status: existingIssue.status,
    distanceMeters: Math.round(distance),
    textScore,
    distanceScore,
    matchingScore: Math.min(100, Math.max(0, overallScore)),
    isLikelyDuplicate: overallScore >= 55,
    requiresUserConfirmation: overallScore >= 45
  };
}

/**
 * Scan all open or recently updated issues for duplicates
 */
export function findNearbyDuplicates(newReport, existingIssues) {
  const matches = [];

  for (const issue of existingIssues) {
    // Don't compare with self if updating
    if (newReport.id && newReport.shared_issue_id === issue.id) continue;
    if (issue.is_merged_into_id) continue; // Skip issues that were merged into others

    const evalResult = evaluateDuplicateMatch(newReport, issue);
    if (evalResult.requiresUserConfirmation || evalResult.matchingScore >= 45) {
      matches.push({
        ...evalResult,
        issue
      });
    }
  }

  // Sort by highest matching score descending
  return matches.sort((a, b) => b.matchingScore - a.matchingScore);
}
