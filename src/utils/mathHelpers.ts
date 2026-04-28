/**
 * Round a number to the nearest cent (2 decimal places).
 */
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Calculate the balance due after a deposit is subtracted from the total.
 */
export function calculateBalanceDue(totalPrice: number, depositAmount: number): number {
  return roundMoney(totalPrice - depositAmount);
}
