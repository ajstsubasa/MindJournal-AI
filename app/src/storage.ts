import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export type JournalEntry = {
  content: string;
  createdAt: string;
  date: string;
  energy: number | null;
  id: string;
  imageUri?: string | null;
  mood: number | null;
  sleepHours: number | null;
  updatedAt: string;
};

type LegacyQuickEntry = { createdAt: string; id: string; text: string };
type LegacyEntry = Omit<JournalEntry, 'createdAt' | 'id'> & { quickEntries?: LegacyQuickEntry[] };

const INDEX_KEY = 'mindjournal.entry-dates.v1';
const entryKey = (date: string) => `mindjournal.entry.v1.${date}`;

function browserStorage() {
  if (Platform.OS !== 'web') return null;
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export async function getLocalValue(key: string): Promise<string | null> {
  const storage = browserStorage();
  if (storage) return storage.getItem(key);
  if (Platform.OS === 'web') throw new Error('Browser storage is unavailable.');
  return SecureStore.getItemAsync(key);
}

export async function setLocalValue(key: string, value: string): Promise<void> {
  const storage = browserStorage();
  if (storage) {
    storage.setItem(key, value);
    return;
  }
  if (Platform.OS === 'web') throw new Error('Browser storage is unavailable.');
  await SecureStore.setItemAsync(key, value);
}

export async function removeLocalValue(key: string): Promise<void> {
  const storage = browserStorage();
  if (storage) {
    storage.removeItem(key);
    return;
  }
  if (Platform.OS === 'web') throw new Error('Browser storage is unavailable.');
  await SecureStore.deleteItemAsync(key);
}

async function getDates(): Promise<string[]> {
  const stored = await getLocalValue(INDEX_KEY);
  if (!stored) return [];
  try {
    const dates = JSON.parse(stored);
    return Array.isArray(dates) ? dates.filter((date): date is string => typeof date === 'string') : [];
  } catch {
    return [];
  }
}

function normalizeEntries(date: string, raw: unknown): JournalEntry[] {
  if (Array.isArray(raw)) {
    return raw.filter((item): item is JournalEntry => Boolean(item && typeof item === 'object' && (item as JournalEntry).id && (item as JournalEntry).date === date));
  }
  if (!raw || typeof raw !== 'object') return [];

  const legacy = raw as LegacyEntry;
  if (legacy.date !== date) return [];
  const createdAt = legacy.updatedAt || new Date().toISOString();
  const reflection: JournalEntry = {
    content: legacy.content ?? '',
    createdAt,
    date,
    energy: legacy.energy ?? null,
    id: `legacy-${createdAt}`,
    mood: legacy.mood ?? null,
    sleepHours: legacy.sleepHours ?? null,
    updatedAt: createdAt,
  };
  const quickEntries = (legacy.quickEntries ?? []).map((quick) => ({
    content: quick.text,
    createdAt: quick.createdAt,
    date,
    energy: null,
    id: `legacy-quick-${quick.id}`,
    mood: null,
    sleepHours: null,
    updatedAt: quick.createdAt,
  }));
  return [reflection, ...quickEntries].filter((entry) => entry.content || entry.mood !== null || entry.energy !== null || entry.sleepHours !== null);
}

export async function loadEntries(): Promise<Record<string, JournalEntry[]>> {
  const dates = await getDates();
  const loaded = await Promise.all(dates.map(async (date) => {
    const raw = await getLocalValue(entryKey(date));
    if (!raw) return [date, []] as const;
    try { return [date, normalizeEntries(date, JSON.parse(raw))] as const; } catch { return [date, []] as const; }
  }));
  return Object.fromEntries(loaded.filter(([, entries]) => entries.length));
}

export async function saveEntry(entry: JournalEntry): Promise<void> {
  const dates = await getDates();
  const raw = await getLocalValue(entryKey(entry.date));
  let entries: JournalEntry[] = [];
  if (raw) {
    try { entries = normalizeEntries(entry.date, JSON.parse(raw)); } catch { entries = []; }
  }
  const index = entries.findIndex((item) => item.id === entry.id);
  const updated = index >= 0 ? entries.map((item) => item.id === entry.id ? entry : item) : [...entries, entry];
  await setLocalValue(entryKey(entry.date), JSON.stringify(updated));
  if (!dates.includes(entry.date)) await setLocalValue(INDEX_KEY, JSON.stringify([...dates, entry.date].sort()));
}

export async function removeEntry(date: string, id: string): Promise<void> {
  const dates = await getDates();
  const raw = await getLocalValue(entryKey(date));
  if (!raw) return;
  let entries: JournalEntry[] = [];
  try { entries = normalizeEntries(date, JSON.parse(raw)); } catch { return; }
  const remaining = entries.filter((entry) => entry.id !== id);
  if (remaining.length) {
    await setLocalValue(entryKey(date), JSON.stringify(remaining));
  } else {
    await removeLocalValue(entryKey(date));
    await setLocalValue(INDEX_KEY, JSON.stringify(dates.filter((savedDate) => savedDate !== date)));
  }
}

export async function removeAllEntries(): Promise<void> {
  const dates = await getDates();
  await Promise.all(dates.map((date) => removeLocalValue(entryKey(date))));
  await removeLocalValue(INDEX_KEY);
}
