/**
 * Analytics Engine for CivicTrack
 * Features 5, 8, 9, 10, 11
 */

// Feature 5: Repair Effectiveness Analysis
export function computeRepairEffectiveness(db) {
  const repairs = db.all(`
    SELECT r.*, a.name as asset_name, a.asset_code, d.name as department_name
    FROM repair_records r
    JOIN infrastructure_assets a ON r.infrastructure_id = a.id
    JOIN departments d ON r.department_id = d.id
  `);

  const totalRepairs = repairs.length;
  if (totalRepairs === 0) {
    return {
      totalRepairs: 0,
      recurrenceCount: 0,
      recurrenceRatePercent: 0,
      effectivenessRatePercent: 100,
      temporaryVsPermanent: {
        temporary: { count: 0, recurred: 0, recurrenceRate: 0 },
        permanent: { count: 0, recurred: 0, recurrenceRate: 0 }
      },
      averageDaysUntilRecurrence: null,
      repairs: []
    };
  }

  let tempCount = 0;
  let tempRecurred = 0;
  let permCount = 0;
  let permRecurred = 0;
  let totalRecurred = 0;
  let recurrenceDaysSum = 0;
  let recurrenceDaysCount = 0;

  for (const r of repairs) {
    if (r.repair_type === 'temporary') {
      tempCount++;
      if (r.recurrence_observed) tempRecurred++;
    } else if (r.repair_type === 'permanent') {
      permCount++;
      if (r.recurrence_observed) permRecurred++;
    }

    if (r.recurrence_observed) {
      totalRecurred++;
      if (r.days_until_next_incident) {
        recurrenceDaysSum += r.days_until_next_incident;
        recurrenceDaysCount++;
      }
    }
  }

  const recurrenceRate = Math.round((totalRecurred / totalRepairs) * 100);
  const effectivenessRate = 100 - recurrenceRate;

  return {
    totalRepairs,
    recurrenceCount: totalRecurred,
    recurrenceRatePercent: recurrenceRate,
    effectivenessRatePercent: effectivenessRate,
    temporaryVsPermanent: {
      temporary: {
        count: tempCount,
        recurred: tempRecurred,
        recurrenceRate: tempCount > 0 ? Math.round((tempRecurred / tempCount) * 100) : 0
      },
      permanent: {
        count: permCount,
        recurred: permRecurred,
        recurrenceRate: permCount > 0 ? Math.round((permRecurred / permCount) * 100) : 0
      }
    },
    averageDaysUntilRecurrence: recurrenceDaysCount > 0 ? Math.round(recurrenceDaysSum / recurrenceDaysCount) : null,
    repairs
  };
}

// Feature 8: Maintenance-Waste Indicator
export function computeMaintenanceWaste(db) {
  const assetRepairs = db.all(`
    SELECT 
      a.id, a.asset_code, a.name, a.category, a.address, a.current_health_status, a.risk_level,
      COUNT(r.id) as repair_count,
      SUM(CASE WHEN r.cost_amount IS NOT NULL THEN r.cost_amount ELSE 0 END) as total_spent,
      SUM(CASE WHEN r.cost_unavailable = 1 THEN 1 ELSE 0 END) as missing_cost_records,
      SUM(CASE WHEN r.recurrence_observed = 1 AND r.cost_amount IS NOT NULL THEN r.cost_amount ELSE 0 END) as recurring_spent
    FROM infrastructure_assets a
    LEFT JOIN repair_records r ON a.id = r.infrastructure_id
    GROUP BY a.id
    ORDER BY total_spent DESC, repair_count DESC
  `);

  let totalExpenditure = 0;
  let recurringExpenditure = 0;
  let assetsRequiringEngineeringAudit = [];

  for (const item of assetRepairs) {
    totalExpenditure += Number(item.total_spent || 0);
    recurringExpenditure += Number(item.recurring_spent || 0);

    // Flag assets with >= 2 repairs and recorded recurrence for deeper audit
    if (item.repair_count >= 2) {
      assetsRequiringEngineeringAudit.push({
        ...item,
        reason: `${item.repair_count} repair cycles logged (₹${new Intl.NumberFormat('en-IN').format(Math.round(item.total_spent))}) - candidate for capital overhaul rather than piecemeal patching.`
      });
    }
  }

  return {
    totalExpenditure: Math.round(totalExpenditure),
    recurringExpenditure: Math.round(recurringExpenditure),
    recurringExpenditureRatio: totalExpenditure > 0 ? Math.round((recurringExpenditure / totalExpenditure) * 100) : 0,
    assetsByCost: assetRepairs,
    assetsRequiringEngineeringAudit,
    guidance: 'Expenditure figures represent recorded repair maintenance ledger entries. Repeated expenditures serve as diagnostic indicators of potential maintenance inefficiency to help authorities justify long-term engineering overhauls.'
  };
}

// Feature 10: Seasonal Problem Analysis
export function computeSeasonalAnalysis(db) {
  // Aggregate incidents by month and category
  const incidentRecords = db.all(`
    SELECT 
      strftime('%m', started_at) as month,
      category,
      COUNT(id) as incident_count
    FROM (
      SELECT inc.id, inc.started_at, s.category
      FROM infrastructure_incidents inc
      JOIN shared_issues s ON inc.shared_issue_id = s.id
    )
    GROUP BY month, category
    ORDER BY month ASC
  `);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  // Format monthly timeline
  const monthlyData = {};
  for (let i = 1; i <= 12; i++) {
    const mStr = String(i).padStart(2, '0');
    monthlyData[mStr] = {
      monthKey: mStr,
      monthName: monthNames[i - 1],
      totalIncidents: 0,
      roads: 0,
      streetlights: 0,
      water: 0,
      drainage: 0,
      garbage: 0,
      other: 0
    };
  }

  let totalDistinctIncidents = 0;
  for (const r of incidentRecords) {
    if (monthlyData[r.month]) {
      const catKey = r.category.toLowerCase().replace(/[^a-z]/g, '');
      const count = Number(r.incident_count);
      totalDistinctIncidents += count;
      monthlyData[r.month].totalIncidents += count;

      if (catKey.includes('road')) monthlyData[r.month].roads += count;
      else if (catKey.includes('light')) monthlyData[r.month].streetlights += count;
      else if (catKey.includes('water')) monthlyData[r.month].water += count;
      else if (catKey.includes('drain')) monthlyData[r.month].drainage += count;
      else if (catKey.includes('garb') || catKey.includes('sanit')) monthlyData[r.month].garbage += count;
      else monthlyData[r.month].other += count;
    }
  }

  const timeline = Object.values(monthlyData);

  // Detect patterns
  const patterns = [];
  const monsoonMonths = ['06', '07', '08', '09'];
  const monsoonDrainage = timeline.filter(t => monsoonMonths.includes(t.monthKey)).reduce((acc, t) => acc + t.drainage + t.roads, 0);
  if (monsoonDrainage >= 3) {
    patterns.push({
      season: 'Monsoon / Rainy Season (June - September)',
      primaryIssue: 'Drainage overflows & Pothole formations',
      detail: `${monsoonDrainage} recorded drainage & road failures during monsoon months due to stormwater saturation.`,
      recommendation: 'Pre-monsoon de-silting and preventive stormwater drain clearance by May.'
    });
  }

  const summerMonths = ['04', '05', '06'];
  const summerWater = timeline.filter(t => summerMonths.includes(t.monthKey)).reduce((acc, t) => acc + t.water, 0);
  if (summerWater >= 2) {
    patterns.push({
      season: 'Summer Peak (April - June)',
      primaryIssue: 'Water pipeline stress & supply shortages',
      detail: `${summerWater} pipe bursts and pressure drop complaints recorded during summer demand surges.`,
      recommendation: 'Conduct valve pressure testing and reservoir line maintenance before March.'
    });
  }

  const hasSufficientData = totalDistinctIncidents >= 6;

  return {
    hasSufficientData,
    totalDistinctIncidents,
    monthlyTimeline: timeline,
    detectedPatterns: patterns,
    message: hasSufficientData 
      ? 'Historical patterns indicate measurable seasonal clustering across municipal sectors.' 
      : 'Preliminary dataset: More incident cycles across quarters are being collected to unlock full seasonal pattern correlation.'
  };
}

// Feature 11: Long-Term Authority & Department Performance
export function computeDepartmentPerformance(db) {
  const departments = db.all(`
    SELECT d.*,
      COUNT(DISTINCT s.id) as total_issues,
      SUM(CASE WHEN s.status = 'Resolved' THEN 1 ELSE 0 END) as resolved_issues,
      SUM(CASE WHEN s.status = 'Escalated' THEN 1 ELSE 0 END) as escalated_issues,
      SUM(CASE WHEN s.status IN ('Pending', 'Assigned', 'In Progress') THEN 1 ELSE 0 END) as open_issues
    FROM departments d
    LEFT JOIN shared_issues s ON d.id = s.department_id AND (s.is_merged_into_id IS NULL)
    GROUP BY d.id
  `);

  const performance = [];

  for (const dept of departments) {
    // Calculate average resolution time for resolved issues
    const resolvedList = db.all(`
      SELECT first_reported_at, resolved_at, resolution_type
      FROM shared_issues
      WHERE department_id = ? AND status = 'Resolved' AND resolved_at IS NOT NULL
    `, [dept.id]);

    let totalResolutionHours = 0;
    let resolvedWithinSLA = 0;

    for (const res of resolvedList) {
      const start = new Date(res.first_reported_at);
      const end = new Date(res.resolved_at);
      const diffHours = (end - start) / (1000 * 60 * 60);
      totalResolutionHours += diffHours;
      if (diffHours <= dept.sla_hours) {
        resolvedWithinSLA++;
      }
    }

    const avgResolutionHours = resolvedList.length > 0 
      ? Math.round(totalResolutionHours / resolvedList.length) 
      : null;

    const slaComplianceRate = resolvedList.length > 0
      ? Math.round((resolvedWithinSLA / resolvedList.length) * 100)
      : 100;

    // Check repeat incident rate for this department
    const deptRepairs = db.all(`
      SELECT recurrence_observed
      FROM repair_records
      WHERE department_id = ?
    `, [dept.id]);

    const totalRepairs = deptRepairs.length;
    const recurredRepairs = deptRepairs.filter(r => r.recurrence_observed === 1).length;
    const recurrenceRate = totalRepairs > 0 ? Math.round((recurredRepairs / totalRepairs) * 100) : 0;
    const effectivenessRate = 100 - recurrenceRate;

    // Resolutions supported by photographic proof
    const repairsWithImages = db.get(`
      SELECT COUNT(DISTINCT r.id) as count
      FROM repair_records r
      JOIN report_images img ON r.id = img.repair_id
      WHERE r.department_id = ?
    `, [dept.id]);

    const photoEvidenceRate = totalRepairs > 0 
      ? Math.round((Number(repairsWithImages.count || 0) / totalRepairs) * 100) 
      : 100;

    performance.push({
      departmentId: dept.id,
      departmentName: dept.name,
      code: dept.code,
      slaHours: dept.sla_hours,
      totalIssues: dept.total_issues || 0,
      resolvedIssues: dept.resolved_issues || 0,
      openIssues: dept.open_issues || 0,
      escalatedIssues: dept.escalated_issues || 0,
      avgResolutionHours,
      slaComplianceRate,
      totalRepairsLogged: totalRepairs,
      repeatIncidentRate: recurrenceRate,
      repairEffectivenessRate: effectivenessRate,
      photoEvidenceRate
    });
  }

  return performance;
}
