import { SpoonStoreError, type SpoonTaskKind } from '@/features/spoons/contracts';

export const MAX_SPOONS = 5;

export function validateSpoonAmount(amount: number): void {
  if (!Number.isInteger(amount) || amount < 0 || amount > MAX_SPOONS) {
    throw new SpoonStoreError('validation', `Choose a whole number between 0 and ${MAX_SPOONS}.`);
  }
}

export function boundSpoonBalance(balance: number): number {
  return Math.min(MAX_SPOONS, Math.max(0, balance));
}

/** The signed change that fits at the current balance, including zero. */
export function getAppliedChange(balance: number, requestedChange: number): number {
  return boundSpoonBalance(balance + requestedChange) - balance;
}

export function getCompletionChange(balance: number, kind: SpoonTaskKind, amount: number): number {
  return getAppliedChange(balance, kind === 'spend' ? -amount : amount);
}
