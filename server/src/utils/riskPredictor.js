/**
 * Infrastructure Risk Scoring Module
 * Section 5 Feature 6:
 * Transparent rule-based risk score with Low, Medium, High, and Critical levels.
 * Distinguishes unique incidents from duplicate citizen reports.
 */
export function calculateInfrastructureRisk({
  asset,
  distinctIncidents = [], // array of incident records
  repairRecords = [],     // array of repair records
  unresolvedIssuesCount = 0
}) {
  let score = 10; // Baseline low risk
  const reasons = [];

  const incidentCount = distinctIncidents.length;
  const now = new Date();

  // 1. Historical Distinct Incidents (up to 30 points)
  // Duplicate reports do NOT inflate this, only verified physical incidents
  if (incidentCount >= 4) {
    score += 30;
    reasons.push(`${incidentCount} distinct historical failure incidents recorded on this asset`);
  } else if (incidentCount >= 2) {
    score += 20;
    reasons.push(`${incidentCount} distinct failure incidents recorded on this asset`);
  } else if (incidentCount === 1) {
    score += 10;
    reasons.push('1 historical failure incident recorded on this asset');
  }

  // 2. Frequency of Recent Incidents (within past 90 days) (up to 25 points)
  const recentIncidents = distinctIncidents.filter((inc) => {
    const started = new Date(inc.started_at);
    const diffDays = (now - started) / (1000 * 60 * 60 * 24);
    return diffDays <= 90;
  });

  if (recentIncidents.length >= 2) {
    score += 25;
    reasons.push(`High incident frequency: ${recentIncidents.length} failures occurred in the last 90 days`);
  } else if (recentIncidents.length === 1) {
    score += 12;
    reasons.push('Recent failure occurred within the last 90 days');
  }

  // 3. Previous Temporary Repairs without permanent remediation (up to 25 points)
  const temporaryRepairs = repairRecords.filter((r) => r.repair_type === 'temporary');
  const permanentRepairs = repairRecords.filter((r) => r.repair_type === 'permanent');

  if (temporaryRepairs.length > 0 && permanentRepairs.length === 0) {
    score += 25;
    reasons.push(`${temporaryRepairs.length} temporary quick-fix repair(s) without permanent engineering overhaul`);
  } else if (temporaryRepairs.length > permanentRepairs.length) {
    score += 15;
    reasons.push('Asset has predominantly received temporary patching rather than permanent fixes');
  }

  // 4. Mean Time Between Failures (MTBF) check (up to 15 points)
  if (distinctIncidents.length >= 2) {
    const sorted = [...distinctIncidents].sort((a, b) => new Date(a.started_at) - new Date(b.started_at));
    let totalIntervalDays = 0;
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1].started_at);
      const curr = new Date(sorted[i].started_at);
      totalIntervalDays += (curr - prev) / (1000 * 60 * 60 * 24);
    }
    const avgMTBF = totalIntervalDays / (sorted.length - 1);
    if (avgMTBF < 45) {
      score += 15;
      reasons.push(`Short failure cycle: Average time between failures is only ${Math.round(avgMTBF)} days`);
    } else if (avgMTBF < 90) {
      score += 8;
      reasons.push(`Moderate recurrence cycle: Average time between failures is ${Math.round(avgMTBF)} days`);
    }
  }

  // 5. Active Unresolved Issues (up to 15 points)
  if (unresolvedIssuesCount > 0) {
    score += Math.min(15, unresolvedIssuesCount * 8);
    reasons.push(`${unresolvedIssuesCount} active civic complaint(s) currently open on this asset`);
  }

  const finalScore = Math.min(100, Math.max(5, score));

  let riskLevel = 'Low';
  let healthStatus = 'good';

  if (finalScore >= 75) {
    riskLevel = 'Critical';
    healthStatus = 'critical';
  } else if (finalScore >= 55) {
    riskLevel = 'High';
    healthStatus = 'warning';
  } else if (finalScore >= 35) {
    riskLevel = 'Medium';
    healthStatus = 'monitoring';
  } else {
    riskLevel = 'Low';
    healthStatus = 'good';
  }

  if (reasons.length === 0) {
    reasons.push('No significant recurrence or structural risk factors detected');
  }

  return {
    riskScore: finalScore,
    riskLevel,
    healthStatus,
    reasons,
    disclaimer: 'Risk indicators are derived from stored incident history and repair logs for preventive decision support, not guaranteed predictions.'
  };
}
