import type {Flow, Mood} from './contracts.ts'

export type CatalogOption <T extends string> = Readonly <{
    id: T;
    label: string;
}>

export const MOOD_OPTIONS = [
  { id: 'verySad', label: 'Very Sad' },
  { id: 'sad', label: 'Sad' },
  { id: 'neutral', label: 'Neutral' },
  { id: 'happy', label: 'Happy' },
  { id: 'veryHappy', label: 'Very Happy' },
] as const satisfies readonly CatalogOption<Mood>[];

export const FLOW_OPTIONS = [
  { id: 'none', label: 'No Flow' },
  { id: 'veryLight', label: 'Very Light' },
  { id: 'light', label: 'Light' },
  { id: 'normal', label: 'Normal' },
  { id: 'heavy', label: 'Heavy' },
  { id: 'veryHeavy', label: 'Very Heavy' },
] as const satisfies readonly CatalogOption<Flow>[];

export const PHYSICAL_SYMPTOM_OPTIONS = [
  { id: 'headache', label: 'Headache' },
  { id: 'menstrualCramps', label: 'Menstrual Cramps' },
  { id: 'backPain', label: 'Back Pain' },
  { id: 'migraines', label: 'Migraines' },
  { id: 'stomachPain', label: 'Stomach Pain' },
] as const satisfies readonly CatalogOption<string>[];

export const EMOTIONAL_SYMPTOM_OPTIONS = [
  { id: 'moodSwings', label: 'Mood Swings' },
  {
    id: 'difficultyConcentrating',
    label: 'Difficulty Concentrating',
  },
  { id: 'anxiety', label: 'Anxiety' },
  { id: 'fatigue', label: 'Fatigue' },
  { id: 'lowMotivation', label: 'Low Motivation' },
] as const satisfies readonly CatalogOption<string>[];

export type PhysicalSymptomId =
  (typeof PHYSICAL_SYMPTOM_OPTIONS)[number]['id'];

export type EmotionalSymptomId =
  (typeof EMOTIONAL_SYMPTOM_OPTIONS)[number]['id'];