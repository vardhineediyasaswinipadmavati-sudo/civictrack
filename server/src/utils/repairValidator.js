import { RepairRecord, ReportImage } from '../models/index.js';

/**
 * Checks whether a text string is empty, too short, or meaningless placeholder text.
 */
export function isPlaceholderText(text, minLen = 5) {
  if (!text || typeof text !== 'string') return true;
  const trimmed = text.trim();
  if (trimmed.length < minLen) return true;
  const lower = trimmed.toLowerCase();
  const banned = [
    'done',
    'fixed',
    'test',
    'testing',
    'n/a',
    'na',
    'none',
    'nil',
    'asdf',
    'qwerty',
    'repaired',
    'repaired issue',
    'work done',
    'ok',
    'okay',
    'completed',
    'placeholder',
    'nothing',
    'no issue',
    'sample',
    'repaired it',
    'repaired defect',
    'repaired road',
    'repair done',
    'null'
  ];
  if (banned.includes(lower)) return true;
  if (/^[\s\d\W]+$/.test(trimmed)) return true;
  if (/^(.)\1+$/.test(lower)) return true;
  return false;
}

/**
 * Validates repair submission payload before creating a RepairRecord.
 * Ensures:
 * 1. Work classification is 'temporary' or 'permanent'.
 * 2. Complete non-placeholder work description (at least 10 chars).
 * 3. Materials information is provided (at least 3 chars, not placeholder).
 * 4. Explicit non-negative repair cost is provided.
 * 5. Before-repair photograph is uploaded.
 * 6. After-repair photograph is uploaded, is distinct from before photo, and does not reuse citizen complaint photo.
 */
export function validateRepairSubmission(data, citizenEvidenceImages = []) {
  const {
    repair_type,
    work_summary,
    materials_used,
    cost_amount,
    before_image_url,
    after_image_url
  } = data || {};

  // 1. Work classification
  const normalizedType = String(repair_type || '').toLowerCase().trim();
  if (!normalizedType || !['temporary', 'permanent'].includes(normalizedType)) {
    return {
      isValid: false,
      error: 'Work classification is mandatory. Please select Temporary Repair or Permanent Repair.'
    };
  }

  // 2. Work description
  if (!work_summary || typeof work_summary !== 'string' || work_summary.trim().length === 0) {
    return {
      isValid: false,
      error: 'Work description explaining what was done is mandatory.'
    };
  }
  if (isPlaceholderText(work_summary, 10)) {
    return {
      isValid: false,
      error: 'Please provide a complete and meaningful work description (at least 10 characters; placeholder text is not accepted).'
    };
  }

  // 3. Materials used
  if (!materials_used || typeof materials_used !== 'string' || materials_used.trim().length === 0) {
    return {
      isValid: false,
      error: 'Materials used information is mandatory.'
    };
  }
  if (isPlaceholderText(materials_used, 3)) {
    return {
      isValid: false,
      error: 'Please specify valid materials used (placeholder text is not accepted).'
    };
  }

  // 4. Explicit Repair Cost
  if (
    cost_amount === undefined ||
    cost_amount === null ||
    cost_amount === '' ||
    typeof cost_amount === 'boolean'
  ) {
    return {
      isValid: false,
      error: 'Repair cost must be explicitly entered as a valid numeric amount instead of defaulting to zero.'
    };
  }
  const numericCost = Number(cost_amount);
  if (isNaN(numericCost) || numericCost < 0) {
    return {
      isValid: false,
      error: 'Repair cost must be a valid non-negative number.'
    };
  }

  // 5. Before-repair photo
  if (!before_image_url || typeof before_image_url !== 'string' || !before_image_url.trim()) {
    return {
      isValid: false,
      error: 'Before-repair photograph is mandatory and must be uploaded successfully.'
    };
  }

  // 6. After-repair photo
  if (!after_image_url || typeof after_image_url !== 'string' || !after_image_url.trim()) {
    return {
      isValid: false,
      error: 'After-repair photograph is mandatory and must be uploaded successfully.'
    };
  }

  const trimmedBefore = before_image_url.trim();
  const trimmedAfter = after_image_url.trim();

  if (trimmedBefore === trimmedAfter) {
    return {
      isValid: false,
      error: 'After-repair photograph must be distinct from the before-repair photograph.'
    };
  }

  // Check against citizen evidence images
  if (Array.isArray(citizenEvidenceImages) && citizenEvidenceImages.length > 0) {
    const isReused = citizenEvidenceImages.some((img) => img && img.trim() === trimmedAfter);
    if (isReused) {
      return {
        isValid: false,
        error: 'The after-repair photograph cannot reuse the original citizen complaint evidence photograph. Genuine post-repair evidence is required.'
      };
    }
  }

  return {
    isValid: true,
    normalizedData: {
      repair_type: normalizedType,
      work_summary: work_summary.trim(),
      materials_used: materials_used.trim(),
      cost_amount: numericCost,
      before_image_url: trimmedBefore,
      after_image_url: trimmedAfter
    }
  };
}

/**
 * Validates whether a civic issue has a complete, valid repair record with all required evidence before Admin approval.
 */
export async function validateRepairForApproval(issue) {
  if (!issue) {
    return {
      isValid: false,
      missingFields: ['Civic issue not found'],
      message: 'Civic issue not found.'
    };
  }

  const issueId = issue._id || issue.id;

  // 1. A valid repair record must exist
  const repair = await RepairRecord.findOne({ shared_issue_id: issueId })
    .sort({ completed_at: -1, created_at: -1 });

  if (!repair) {
    return {
      isValid: false,
      missingFields: ['Valid repair record (no repair record exists for this complaint)'],
      message: 'Cannot approve complaint: No repair record exists for this issue. Field staff must record repair details and photographs first.'
    };
  }

  const missing = [];

  // 2. Work classification
  const validTypes = ['temporary', 'permanent', 'inspection_only', 'no_fault'];
  if (!repair.repair_type || !validTypes.includes(String(repair.repair_type).toLowerCase())) {
    missing.push('Work classification (Temporary Repair or Permanent Repair)');
  }

  // 3. Work description
  if (!repair.work_summary || isPlaceholderText(repair.work_summary, 10)) {
    missing.push('Complete work description explaining what was done (at least 10 characters)');
  }

  // 4. Materials information
  if (!repair.materials_used || isPlaceholderText(repair.materials_used, 3)) {
    missing.push('Materials used information');
  }

  // 5. Explicit repair cost
  if (
    repair.cost_amount === null ||
    repair.cost_amount === undefined ||
    repair.cost_unavailable ||
    typeof repair.cost_amount !== 'number' ||
    isNaN(repair.cost_amount) ||
    repair.cost_amount < 0
  ) {
    missing.push('Explicit repair cost amount');
  }

  // 6. Before-repair photograph
  const beforeImg = await ReportImage.findOne({
    shared_issue_id: issueId,
    image_type: 'before_repair',
    ...(repair._id ? { repair_id: repair._id } : {})
  }) || await ReportImage.findOne({
    shared_issue_id: issueId,
    image_type: 'before_repair'
  });

  const beforeUrl = (beforeImg ? beforeImg.image_url : repair.before_image || '').trim();
  if (!beforeUrl) {
    missing.push('Before-repair photograph evidence');
  }

  // 7. After-repair photograph
  const afterImg = await ReportImage.findOne({
    shared_issue_id: issueId,
    image_type: 'after_repair',
    ...(repair._id ? { repair_id: repair._id } : {})
  }) || await ReportImage.findOne({
    shared_issue_id: issueId,
    image_type: 'after_repair'
  });

  const afterUrl = (afterImg ? afterImg.image_url : repair.after_image || '').trim();
  if (!afterUrl) {
    missing.push('After-repair photograph evidence');
  }

  // 8. Photo distinctness & no reuse of citizen evidence
  if (beforeUrl && afterUrl && beforeUrl === afterUrl) {
    missing.push('After-repair photograph must be distinct from before-repair photograph');
  }

  if (afterUrl) {
    const citizenImages = await ReportImage.find({
      shared_issue_id: issueId,
      image_type: 'evidence'
    }).distinct('image_url');

    if (citizenImages.some((img) => img && img.trim() === afterUrl)) {
      missing.push('After-repair photograph cannot reuse original citizen complaint evidence photograph');
    }
  }

  if (missing.length > 0) {
    return {
      isValid: false,
      repair,
      missingFields: missing,
      message: `Cannot approve complaint resolution: incomplete repair documentation. Missing: ${missing.join('; ')}`
    };
  }

  return {
    isValid: true,
    repair,
    missingFields: []
  };
}
