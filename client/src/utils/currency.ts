/**
 * Indian Rupee (₹) and Number Formatting Utilities
 */
export function formatINR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '₹0';
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatIndianNumber(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) {
    return '0';
  }
  return new Intl.NumberFormat('en-IN').format(val);
}
