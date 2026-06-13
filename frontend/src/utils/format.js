// src/utils/format.js

/**
 * Formats a value in cents to standard USD format (e.g. 1540 -> $15.40, -500 -> -$5.00)
 * @param {number} cents 
 * @param {boolean} includeSign 
 */
export const formatCents = (cents, includeSign = true) => {
  if (cents === undefined || cents === null || isNaN(cents)) return '$0.00';
  const isNegative = cents < 0;
  const absCents = Math.abs(cents);
  const formatted = (absCents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `${isNegative && includeSign ? '-' : ''}$${formatted}`;
};

/**
 * Gets a descriptive CSS class for balance text color
 * @param {number} cents 
 */
export const getBalanceClass = (cents) => {
  if (cents > 0) return 'balance-owed';
  if (cents < 0) return 'balance-owe';
  return 'balance-settled';
};

/**
 * Capitalizes first letter of a category name
 * @param {string} cat 
 */
export const formatCategory = (cat) => {
  if (!cat) return 'Other';
  return cat.charAt(0).toUpperCase() + cat.slice(1);
};
