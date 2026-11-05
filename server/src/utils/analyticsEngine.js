import mongoose from 'mongoose';
import {
  RepairRecord,
  InfrastructureAsset,
  InfrastructureIncident,
  SharedIssue,
  Department,
  ReportImage
} from '../models/index.js';

// Feature 5: Repair Effectiveness Analysis
export async function computeRepairEffectiveness(providedRepairs = null) {
  let repairs = [];
  if (providedRepairs) {
    repairs = providedRepairs;
  } else if (mongoose.connection && mongoose.connection.readyState === 1) {
    repairs = await RepairRecord.find()
      .populate('infrastructure_id', 'name asset_code')
      .populate('department_id', 'name');
  }

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
    const isRecurred = Boolean(r.recurrence_observed);
    if (r.repair_type === 'temporary') {
      tempCount++;
      if (isRecurred) tempRecurred++;
    } else if (r.repair_type === 'permanent') {
      permCount++;
      if (isRecurred) permRecurred++;
    }

    if (isRecurred) {
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
    repairs: repairs.map((rep) => ({
      ...(typeof rep.toJSON === 'function' ? rep.toJSON() : rep),
      id: (rep._id || rep.id || '').toString(),
      asset_name: rep.infrastructure_id ? rep.infrastructure_id.name : null,
      asset_code: rep.infrastructure_id ? rep.infrastructure_id.asset_code : null,
      department_name: rep.department_id ? rep.department_id.name : null
    }))
  };
}

// Feature 8: Maintenance-Waste Indicator
export async function computeMaintenanceWaste(providedAssets = null, providedRepairs = null) {
  let assets = [];
  if (providedAssets) {
    assets = providedAssets;
  } else if (mongoose.connection && mongoose.connection.readyState === 1) {
    assets = await InfrastructureAsset.find();
  }

  let totalExpenditure = 0;
  let recurringExpenditure = 0;
  const assetRepairs = [];
  const assetsRequiringEngineeringAudit = [];

  for (const a of assets) {
    const assetIdStr = (a._id || a.id).toString();
    const repairs = providedRepairs
      ? providedRepairs.filter((r) => String(r.infrastructure_id) === assetIdStr)
      : (mongoose.connection && mongoose.connection.readyState === 1 ? await RepairRecord.find({ infrastructure_id: a._id }) : []);

    let totalSpent = 0;
    let recurringSpent = 0;
    let missingCostRecords = 0;

    for (const r of repairs) {
      if (r.cost_unavailable) {
        missingCostRecords++;
      } else if (r.cost_amount !== null && !isNaN(r.cost_amount)) {
        totalSpent += Number(r.cost_amount);
        if (r.recurrence_observed) {
          recurringSpent += Number(r.cost_amount);
        }
      }
    }

    totalExpenditure += totalSpent;
    recurringExpenditure += recurringSpent;

    const item = {
      id: a._id.toString(),
      asset_code: a.asset_code,
      name: a.name,
      category: a.category,
      address: a.address,
      current_health_status: a.current_health_status,
      risk_level: a.risk_level,
      repair_count: repairs.length,
      total_spent: totalSpent,
      missing_cost_records: missingCostRecords,
      recurring_spent: recurringSpent
    };

    assetRepairs.push(item);

    // Flag assets with >= 2 repairs and recorded recurrence for engineering overhaul
    if (repairs.length >= 2) {
      assetsRequiringEngineeringAudit.push({
        ...item,
        reason: `${repairs.length} repair cycles logged (₹${new Intl.NumberFormat('en-IN').format(Math.round(totalSpent))}) - candidate for capital overhaul rather than piecemeal patching.`
      });
    }
  }

  assetRepairs.sort((a, b) => b.total_spent - a.total_spent || b.repair_count - a.repair_count);

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
export async function computeSeasonalAnalysis() {
  const incidents = await InfrastructureIncident.find().populate('shared_issue_id', 'category');

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
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

  for (const inc of incidents) {
    if (!inc.started_at) continue;
    const date = new Date(inc.started_at);
    const mIndex = date.getUTCMonth() + 1;
    const mStr = String(mIndex).padStart(2, '0');

    if (monthlyData[mStr]) {
      const category = inc.shared_issue_id ? inc.shared_issue_id.category : '';
      const catKey = (category || '').toLowerCase().replace(/[^a-z]/g, '');

      totalDistinctIncidents++;
      monthlyData[mStr].totalIncidents++;

      if (catKey.includes('road')) monthlyData[mStr].roads++;
      else if (catKey.includes('light')) monthlyData[mStr].streetlights++;
      else if (catKey.includes('water')) monthlyData[mStr].water++;
      else if (catKey.includes('drain')) monthlyData[mStr].drainage++;
      else if (catKey.includes('garb') || catKey.includes('sanit')) monthlyData[mStr].garbage++;
      else monthlyData[mStr].other++;
    }
  }

  const timeline = Object.values(monthlyData);

  const patterns = [];
  const monsoonMonths = ['06', '07', '08', '09'];
  const monsoonDrainage = timeline
    .filter((t) => monsoonMonths.includes(t.monthKey))
    .reduce((acc, t) => acc + t.drainage + t.roads, 0);

  if (monsoonDrainage >= 3) {
    patterns.push({
      season: 'Monsoon / Rainy Season (June - September)',
      primaryIssue: 'Drainage overflows & Pothole formations',
      detail: `${monsoonDrainage} recorded drainage & road failures during monsoon months due to stormwater saturation.`,
      recommendation: 'Pre-monsoon de-silting and preventive stormwater drain clearance by May.'
    });
  }

  const summerMonths = ['04', '05', '06'];
  const summerWater = timeline
    .filter((t) => summerMonths.includes(t.monthKey))
    .reduce((acc, t) => acc + t.water, 0);

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
export async function computeDepartmentPerformance() {
  const departments = await Department.find();
  const performance = [];

  for (const dept of departments) {
    const deptId = dept._id;

    const [totalIssues, resolvedIssues, escalatedIssues, openIssues] = await Promise.all([
      SharedIssue.countDocuments({ department_id: deptId, is_merged_into_id: null }),
      SharedIssue.countDocuments({ department_id: deptId, status: { $in: ['Resolved', 'Approved'] }, is_merged_into_id: null }),
      SharedIssue.countDocuments({ department_id: deptId, status: 'Escalated', is_merged_into_id: null }),
      SharedIssue.countDocuments({
        department_id: deptId,
        status: { $in: ['Pending', 'Assigned', 'In Progress', 'Rejected', 'Reopened'] },
        is_merged_into_id: null
      })
    ]);

    // Average resolution time
    const resolvedList = await SharedIssue.find({
      department_id: deptId,
      status: { $in: ['Resolved', 'Approved'] },
      resolved_at: { $ne: null }
    });

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

    // Check repeat incident rate
    const deptRepairs = await RepairRecord.find({ department_id: deptId });
    const totalRepairs = deptRepairs.length;
    const recurredRepairs = deptRepairs.filter((r) => r.recurrence_observed).length;
    const recurrenceRate = totalRepairs > 0 ? Math.round((recurredRepairs / totalRepairs) * 100) : 0;
    const effectivenessRate = 100 - recurrenceRate;

    // Photo evidence rate
    const repairIds = deptRepairs.map((r) => r._id);
    const repairsWithImagesCount = (
      await ReportImage.find({ repair_id: { $in: repairIds } }).distinct('repair_id')
    ).length;

    const photoEvidenceRate = totalRepairs > 0
      ? Math.round((repairsWithImagesCount / totalRepairs) * 100)
      : 100;

    performance.push({
      departmentId: dept._id.toString(),
      departmentName: dept.name,
      code: dept.code,
      slaHours: dept.sla_hours,
      totalIssues,
      resolvedIssues,
      openIssues,
      escalatedIssues,
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
