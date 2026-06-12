/**
 * Calculates equal splits of an amount among a list of user IDs.
 * Remainder cents are distributed to the first user.
 * 
 * @param {number} totalAmount - Total amount in cents
 * @param {string[]|number[]} userIds - Array of user IDs
 * @returns {Record<string|number, number>} Map of userId to owed amount in cents
 */
export const calculateEqualSplit = (totalAmount, userIds) => {
  if (!userIds || userIds.length === 0) {
    throw new Error('Participants list cannot be empty');
  }

  const count = userIds.length;
  const baseShare = Math.floor(totalAmount / count);
  const remainder = totalAmount - (baseShare * count);

  const splits = {};
  userIds.forEach((userId, index) => {
    // First user receives the remainder cents
    splits[userId] = baseShare + (index === 0 ? remainder : 0);
  });

  return splits;
};

/**
 * Validates and returns unequal splits.
 * 
 * @param {number} totalAmount - Total amount in cents
 * @param {Record<string|number, number>} splitsInput - Map of userId to exact owed amount in cents
 * @returns {Record<string|number, number>}
 */
export const calculateUnequalSplit = (totalAmount, splitsInput) => {
  let sum = 0;
  const splits = {};

  for (const [userId, amount] of Object.entries(splitsInput)) {
    const centAmount = Math.round(amount);
    splits[userId] = centAmount;
    sum += centAmount;
  }

  if (sum !== totalAmount) {
    throw new Error(`Total of splits (${sum}) does not match the expense amount (${totalAmount})`);
  }

  return splits;
};

/**
 * Calculates percentage-based splits.
 * Remainder cents are assigned to the first user.
 * 
 * @param {number} totalAmount - Total amount in cents
 * @param {Record<string|number, number>} percentages - Map of userId to percentage (0 - 100)
 * @returns {Record<string|number, number>}
 */
export const calculatePercentageSplit = (totalAmount, percentages) => {
  let totalPercent = 0;
  const entries = Object.entries(percentages);
  
  if (entries.length === 0) {
    throw new Error('Participants list cannot be empty');
  }

  const splits = {};
  let distributedSum = 0;

  entries.forEach(([userId, percent], index) => {
    totalPercent += percent;
    
    // Calculate share
    const calculatedShare = Math.floor((totalAmount * percent) / 100);
    splits[userId] = calculatedShare;
    distributedSum += calculatedShare;
  });

  // Verify total percentages equals 100% (allowing small floating point error buffer, e.g. 99.99 to 100.01)
  if (Math.abs(totalPercent - 100) > 0.01) {
    throw new Error(`Total percentage (${totalPercent}%) must equal 100%`);
  }

  // Assign remainder cent to the first user
  const remainder = totalAmount - distributedSum;
  if (remainder !== 0) {
    const firstUserId = entries[0][0];
    splits[firstUserId] += remainder;
  }

  return splits;
};

/**
 * Calculates share-based splits (e.g. User A has 2 shares, User B has 1 share).
 * Remainder cents are assigned to the first user.
 * 
 * @param {number} totalAmount - Total amount in cents
 * @param {Record<string|number, number>} shares - Map of userId to share count
 * @returns {Record<string|number, number>}
 */
export const calculateShareSplit = (totalAmount, shares) => {
  const entries = Object.entries(shares);
  if (entries.length === 0) {
    throw new Error('Participants list cannot be empty');
  }

  let totalShares = 0;
  entries.forEach(([_, share]) => {
    totalShares += share;
  });

  if (totalShares <= 0) {
    throw new Error('Total shares must be greater than zero');
  }

  const splits = {};
  let distributedSum = 0;

  entries.forEach(([userId, shareCount], index) => {
    const calculatedShare = Math.floor((totalAmount * shareCount) / totalShares);
    splits[userId] = calculatedShare;
    distributedSum += calculatedShare;
  });

  // Assign remainder cent to the first user
  const remainder = totalAmount - distributedSum;
  if (remainder !== 0) {
    const firstUserId = entries[0][0];
    splits[firstUserId] += remainder;
  }

  return splits;
};
