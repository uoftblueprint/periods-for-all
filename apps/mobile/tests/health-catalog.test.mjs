import assert from 'node:assert/strict';
import test from 'node:test';

import {
  EMOTIONAL_SYMPTOM_OPTIONS,
  FLOW_OPTIONS,
  MOOD_OPTIONS,
  PHYSICAL_SYMPTOM_OPTIONS,
} from '../src/features/health/catalog.ts';

test('mood options use the agreed IDs and labels', () => {
  assert.deepEqual(MOOD_OPTIONS, [
    { id: 'verySad', label: 'Very Sad' },
    { id: 'sad', label: 'Sad' },
    { id: 'neutral', label: 'Neutral' },
    { id: 'happy', label: 'Happy' },
    { id: 'veryHappy', label: 'Very Happy' },
  ]);
});

test('flow options use the agreed IDs and labels', () => {
  assert.deepEqual(FLOW_OPTIONS, [
    { id: 'none', label: 'No Flow' },
    { id: 'veryLight', label: 'Very Light' },
    { id: 'light', label: 'Light' },
    { id: 'normal', label: 'Normal' },
    { id: 'heavy', label: 'Heavy' },
    { id: 'veryHeavy', label: 'Very Heavy' },
  ]);
});

test('physical symptom options use the agreed IDs and labels', () => {
  assert.deepEqual(PHYSICAL_SYMPTOM_OPTIONS, [
    { id: 'headache', label: 'Headache' },
    { id: 'menstrualCramps', label: 'Menstrual Cramps' },
    { id: 'backPain', label: 'Back Pain' },
    { id: 'migraines', label: 'Migraines' },
    { id: 'stomachPain', label: 'Stomach Pain' },
  ]);
});

test('emotional symptom options use the agreed IDs and labels', () => {
  assert.deepEqual(EMOTIONAL_SYMPTOM_OPTIONS, [
    { id: 'moodSwings', label: 'Mood Swings' },
    { id: 'difficultyConcentrating', label: 'Difficulty Concentrating' },
    { id: 'anxiety', label: 'Anxiety' },
    { id: 'fatigue', label: 'Fatigue' },
    { id: 'lowMotivation', label: 'Low Motivation' },
  ]);
});

test('each catalog has unique IDs', () => {
  const catalogs = [
    MOOD_OPTIONS,
    FLOW_OPTIONS,
    PHYSICAL_SYMPTOM_OPTIONS,
    EMOTIONAL_SYMPTOM_OPTIONS,
  ];

  for (const options of catalogs) {
    const ids = options.map(({ id }) => id);
    assert.equal(new Set(ids).size, ids.length);
  }
});
