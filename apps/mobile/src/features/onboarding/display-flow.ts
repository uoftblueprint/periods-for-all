export const displayPositions = ['introduction', 'font', 'motion', 'theme'] as const;

export type DisplayPosition = (typeof displayPositions)[number];
export type DisplayAction = 'continue' | 'back' | 'skip';
export type DisplayTransition =
  | { type: 'position'; position: DisplayPosition }
  | { type: 'finish' }
  | { type: 'exit' };

export type DisplayFlowState<T> = {
  position: DisplayPosition;
  settings: T;
};

export type DisplayFlowResult<T> = {
  navigation: DisplayTransition;
  settings: T;
};

const positionIndex = new Map<DisplayPosition, number>(
  displayPositions.map((position, index) => [position, index]),
);

/**
 * Resolves navigation while carrying the exact settings reference through unchanged.
 * Introduction Back exits, introduction Skip finishes, and Continue or Skip on the
 * final step finishes.
 */
export function transitionDisplayFlow<T>(
  state: DisplayFlowState<T>,
  action: DisplayAction,
): DisplayFlowResult<T> {
  const index = positionIndex.get(state.position);
  if (index === undefined) throw new Error(`Unknown display position: ${state.position}`);

  let navigation: DisplayTransition;

  if (action === 'back') {
    navigation = index === 0
      ? { type: 'exit' }
      : { type: 'position', position: displayPositions[index - 1] };
  } else if (action === 'skip' && index === 0) {
    navigation = { type: 'finish' };
  } else if (index === displayPositions.length - 1) {
    navigation = { type: 'finish' };
  } else {
    navigation = { type: 'position', position: displayPositions[index + 1] };
  }

  return { navigation, settings: state.settings };
}

export function resolveDisplaySettingsChange<T>(current: T, next: T, finishInFlight: boolean): T {
  return finishInFlight ? current : next;
}
