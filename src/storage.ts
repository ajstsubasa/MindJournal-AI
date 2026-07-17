import * as SecureStore from 'expo-secure-store';

export type QuickEntry = {
  createdAt: string;
  id: string;
  text: string;
};

export type JournalEntry = {
  content: string;
  date: string;
  energy: number | null;
  mood: number | null;
  quickEntries?: QuickEntry[];
  sleepHours: number | null;
  updatedAt: string;
};

const INDEX_KEY = 'mindjournal.entry-dates.v1';
const entryKey = (date: string) => `mindjournal.entry.v1.${date}`;

async function getDates(): Promise<string[]> {
  const stored = await SecureStore.getItemAsync(INDEX_KEY);
  if (!stored) return [];

  try {
    const dates = JSON.parse(stored);
    return Array.isArray(dates) ? dates.filter((date): date is string => typeof date === 'string') : [];
  } catch {
    return [];
  }
}

export async function loadEntries(): Promise<Record<string, JournalEntry>> {
  const dates = await getDates();
  const loaded = await Promise.all(
    dates.map(async (date) => {
      const raw = await SecureStore.getItemAsync(entryKey(date));
      if (!raw) return null;
      try {
        const item = JSON.parse(raw) as JournalEntry;
        return item.date === date ? item : null;
      } catch {
        return null;
      }
    }),
  );

  return Object.fromEntries(
    loaded.filter((item): item is JournalEntry => item !== null).map((item) => [item.date, item]),
  );
}

export async function saveEntry(entry: JournalEntry): Promise<void> {
  const dates = await getDates();
  await SecureStore.setItemAsync(entryKey(entry.date), JSON.stringify(entry));
  if (!dates.includes(entry.date)) {
    await SecureStore.setItemAsync(INDEX_KEY, JSON.stringify([...dates, entry.date].sort()));
  }
}

export async function removeEntry(date: string): Promise<void> {
  const dates = await getDates();
  await SecureStore.deleteItemAsync(entryKey(date));
  await SecureStore.setItemAsync(INDEX_KEY, JSON.stringify(dates.filter((savedDate) => savedDate !== date)));
}

export async function removeAllEntries(): Promise<void> {
  const dates = await getDates();
  await Promise.all(dates.map((date) => SecureStore.deleteItemAsync(entryKey(date))));
  await SecureStore.deleteItemAsync(INDEX_KEY);
}
