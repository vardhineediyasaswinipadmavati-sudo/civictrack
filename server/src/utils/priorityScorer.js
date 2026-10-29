/**
 * Priority Scoring and Escalation Engine
 * Section 6:
 * - Severity
 * - Public safety implications
 * - Estimated impact
 * - Recurrence frequency
 * - Time unresolved
 */
export function calculatePriorityScore({
  severity = 'Medium',
  isSafetyCritical = false,
  reportCount = 1,
  recurrenceCount = 0,
  hoursUnresolved = 0,
  slaHours = 72
}) {
  let score = 0;
  const breakdown = [];

  // 1. Base Severity (up to 35 points)
  const severityPoints = {
    'Critical': 35,
    'High': 25,
    'Medium': 15,
    'Low': 5
  };
  const sPts = severityPoints[severity] || 15;
  score += sPts;
  breakdown.push({ factor: 'Severity Level', points: sPts, detail: severity });

  // 2. Public Safety Implications (30 points)
  if (isSafetyCritical) {
    score += 30;
    breakdown.push({ factor: 'Public Safety Hazard', points: 30, detail: 'Urgent human review required' });
  }

  // 3. Citizen Report Volume / Community Concern (up to 15 points)
  // Multiple independent reports indicate broader public concern
  const reportPoints = Math.min(15, Math.max(0, (reportCount - 1) * 3));
  if (reportPoints > 0) {
    score += reportPoints;
    breakdown.push({ factor: 'Community Concern', points: reportPoints, detail: `${reportCount} linked citizen reports` });
  }

  // 4. Infrastructure Recurrence Frequency (up to 10 points)
  if (recurrenceCount > 0) {
    const recPoints = Math.min(10, recurrenceCount * 5);
    score += recPoints;
    breakdown.push({ factor: 'Recurring Incident', points: recPoints, detail: `${recurrenceCount} prior failure(s) at this asset` });
  }

  // 5. Time Unresolved / SLA Overdue (up to 10 points)
  if (hoursUnresolved > slaHours) {
    const overdueRatio = Math.min(2, (hoursUnresolved - slaHours) / slaHours);
    const timePts = Math.round(5 + overdueRatio * 5);
    score += timePts;
    breakdown.push({ factor: 'SLA Overdue', points: timePts, detail: `${Math.round(hoursUnresolved)}h elapsed (SLA: ${slaHours}h)` });
  }

  const finalScore = Math.min(100, Math.max(1, score));

  let priorityLevel = 'Low';
  if (finalScore >= 80 || isSafetyCritical) {
    priorityLevel = 'Critical';
  } else if (finalScore >= 60) {
    priorityLevel = 'High';
  } else if (finalScore >= 35) {
    priorityLevel = 'Medium';
  }

  const isOverdue = hoursUnresolved > slaHours;

  return {
    score: finalScore,
    priorityLevel,
    isSafetyCritical: Boolean(isSafetyCritical),
    isOverdue,
    breakdown
  };
}
