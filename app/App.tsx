import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Alert,
  Image,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { GirlWaving } from './src/GirlWaving';
import { getLocalValue, JournalEntry, loadEntries, removeAllEntries, removeEntry, saveEntry, setLocalValue } from './src/storage';

type Mood = { color: string; label: string; textColor: string; value: number };
type Screen = 'home' | 'calendar' | 'entry' | 'trends' | 'moods' | 'streak' | 'summary';
type TrendRange = 'seven' | 'thirty' | 'sixMonths';
type AppThemeName = 'ocean' | 'forest' | 'rose' | 'midnight';
type AppTheme = { accent: string; background: string; dark: boolean; name: string; nav: string; primary: string; text: string };
type WeeklyAISummary = { affirmation: string; gentle_next_steps: string[]; overview: string; patterns: string[]; support_note: string | null };
type EntryAIAction = 'concepts' | 'summarize';
type EntryAISummary = { key_points: string[]; summary: string };
type JournalConcept = { definition: string; name: string };
type EntryAIConcepts = { concepts: JournalConcept[] };

let speechRecognition: typeof import('expo-speech-recognition') | null = null;
try {
  speechRecognition = require('expo-speech-recognition') as typeof import('expo-speech-recognition');
} catch {
  // Expo Go does not include this native module. Typed Quick Entries remain available.
}

let imagePicker: typeof import('expo-image-picker') | null = null;
try {
  imagePicker = require('expo-image-picker') as typeof import('expo-image-picker');
} catch {
  // A mismatched native package should not prevent the rest of the journal from opening.
}

const defaultMoods: Mood[] = [
  { color: '#181818', label: 'Very Low', textColor: '#FFFFFF', value: 1 },
  { color: '#9B9B9B', label: 'Low', textColor: '#1E1E1E', value: 2 },
  { color: '#F3CD4D', label: 'Okay', textColor: '#392F00', value: 3 },
  { color: '#50A66D', label: 'Good', textColor: '#FFFFFF', value: 4 },
  { color: '#4E85DF', label: 'Really Good', textColor: '#FFFFFF', value: 5 },
  { color: '#D94E4E', label: 'Anxious', textColor: '#FFFFFF', value: 6 },
];
const moodColors = ['#181818', '#6B7280', '#C88B18', '#4E85DF', '#50A66D', '#D94E4E', '#8B5CC7', '#DB5A9A', '#137B7F', '#A66236'];
const moodPrompts: Record<number, string[]> = {
  1: [
    'What is the kindest, smallest thing you can ask of yourself right now?',
    'What would make the next ten minutes feel a little more manageable?',
    'Name one need your body or mind may be asking you to notice.',
    'What is one task you can set down, postpone, or make smaller today?',
    'Where have you felt even a brief moment of comfort recently?',
    'What would a gentle note to yourself say today?',
    'What has helped you get through hard days before, even in a small way?',
    'What is one place, person, or activity that feels a little safer or softer?',
    'What is one thing you completed today, no matter how small it seems?',
    'If rest counted as progress today, what might it look like?',
  ],
  2: [
    'What feels heavy today, and where do you notice that feeling in your body?',
    'What part of today would you most like to be understood about?',
    'What is within your control for the next small step?',
    'What support, comfort, or space would feel helpful right now?',
    'What thought has been following you today, and what evidence supports or softens it?',
    'What would you say to a friend who was carrying this same feeling?',
    'What is one expectation you can make more realistic today?',
    'What helped you cope the last time you felt this way?',
    'What deserves acknowledgement, even if it did not go perfectly?',
    'What could make tonight feel a little more restorative?',
  ],
  3: [
    'What has felt steady or ordinary in a good way today?',
    'What moment from today would you like to remember?',
    'What is taking up the most space in your thoughts right now?',
    'What has given you energy today, and what has taken some away?',
    'What value do you want to bring into the rest of your day?',
    'What is one small choice that would support tomorrow-you?',
    'What are you noticing about your mood, without needing to change it?',
    'What connection or routine helped you feel grounded today?',
    'What are you looking forward to, even in a small way?',
    'What would make today feel complete enough?',
  ],
  4: [
    'What is working for you lately that you would like to keep doing?',
    'What helped you feel balanced today?',
    'What strength did you use recently that you are proud of?',
    'What moment of connection felt meaningful today?',
    'What are you grateful for without needing it to be perfect?',
    'How can you protect a little of this steadiness tomorrow?',
    'What did you do today that aligned with your values?',
    'What is one kind thing you did for yourself or someone else?',
    'What are you learning about what helps you feel well?',
    'What would you like to savor from today before it passes?',
  ],
  5: [
    'What made today feel especially good?',
    'What choices, people, or moments contributed to this feeling?',
    'How are you showing up as the version of yourself you value today?',
    'What accomplishment or joyful moment deserves to be celebrated?',
    'Who might you share some of this good energy with?',
    'What do you want to remember when you need encouragement later?',
    'What feels possible for you right now?',
    'How can you enjoy this moment while keeping a gentle pace?',
    'What are you proud of in the way you handled today?',
    'What is one hopeful intention you want to carry into tomorrow?',
  ],
  6: [
    'What thoughts are showing up right now? Write them down without judging them.',
    'What sensations do you notice in your body, and what might help it feel safer?',
    'What is one worry you can place in a circle of concern, and one action in your circle of control?',
    'Look around: what are five things you can see, four you can feel, and three you can hear?',
    'What is the most realistic outcome you can imagine, alongside the feared one?',
    'What would make the next small step feel clearer?',
    'When have you felt anxious before and still made it through?',
    'What reassurance would feel believable and kind right now?',
    'What is one calming activity that has helped you in the past?',
    'If your anxiety had a message, what might it be asking you to notice or protect?',
  ],
};
const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_ENTRY_LENGTH = 1500;
const THEME_KEY = 'mindjournal.app-theme.v1';
const MOODS_KEY = 'mindjournal.moods.v1';
const APP_AI_BASE_URL = 'https://mindjournal.languidlabs.com';
const WEEKLY_SUMMARY_FALLBACK_ENDPOINT = `${APP_AI_BASE_URL}/weekly-summary`;
const sleepOptions = [
  { label: 'Good', value: '8' },
  { label: 'Medium', value: '6' },
  { label: 'Bad', value: '4' },
  { label: 'Very bad', value: '2' },
];
const appThemes: Record<AppThemeName, AppTheme> = {
  ocean: { accent: '#91F2F3', background: '#EFF4FF', dark: false, name: 'Ocean Sky', nav: '#24467C', primary: '#3568B7', text: '#294A82' },
  forest: { accent: '#BDEBCB', background: '#EEF7F0', dark: false, name: 'Forest Canopy', nav: '#244D3A', primary: '#3F7C5B', text: '#28523E' },
  rose: { accent: '#FFD1E2', background: '#FFF1F6', dark: false, name: 'Rose Dawn', nav: '#7A3658', primary: '#B6507A', text: '#733550' },
  midnight: { accent: '#9BCFC2', background: '#182D31', dark: true, name: 'Midnight Grove', nav: '#0D2023', primary: '#5A9990', text: '#E3F0EC' },
};

// A fictional, non-clinical sample journal. It is bundled locally so judges can load it
// instantly without an account, network request, or access to a real person's data.
const demoJournalTemplate = [
  { content: 'I stayed in bed longer than I meant to. Even getting dressed felt like work, so I kept the day very small.', energy: 2, mood: 'Very Low', sleepHours: 4 },
  { content: 'Work messages piled up and I could not find a place to start. I answered one email, then took a quiet break.', energy: 3, mood: 'Low', sleepHours: 4 },
  { content: 'Sleep was broken and I woke up with a heavy feeling. I cancelled a nonessential plan and let that be enough.', energy: 2, mood: 'Low', sleepHours: 2 },
  { content: 'I skipped a few things I usually enjoy. I did make tea and sit by the window for a few minutes.', energy: 1, mood: 'Very Low', sleepHours: 4 },
  { content: 'A shower and clean clothes did not change everything, but they made the afternoon feel slightly more manageable.', energy: 3, mood: 'Low', sleepHours: 6 },
  { content: 'I ate breakfast and went outside for a short walk. The low feeling was still there, but the fresh air helped.', energy: 4, mood: 'Okay', sleepHours: 6 },
  { content: 'The weekend felt very quiet. I wanted company but did not have the energy to reach out, so I watched a familiar show.', energy: 2, mood: 'Low', sleepHours: 4 },
  { content: 'Getting through work took more effort than usual. I wrote a short list and finished two small tasks.', energy: 3, mood: 'Low', sleepHours: 6 },
  { content: 'I felt disconnected from everyone today. I texted my sister a simple hello, which was a small but real step.', energy: 2, mood: 'Very Low', sleepHours: 4 },
  { content: 'My thoughts kept telling me I was behind. I reminded myself that a slower day is still a day I made it through.', energy: 3, mood: 'Low', sleepHours: 6 },
  { content: 'Music made the commute easier. I noticed one calm moment at lunch and tried not to rush past it.', energy: 4, mood: 'Okay', sleepHours: 6 },
  { content: 'I had very little motivation after work, so dinner was simple and I rested without adding more pressure.', energy: 3, mood: 'Low', sleepHours: 4 },
  { content: 'I woke up tired and avoided messages for most of the day. Later, I replied to one friend and felt less alone.', energy: 2, mood: 'Very Low', sleepHours: 2 },
  { content: 'The day felt gray, but I kept a counseling appointment and was glad I showed up.', energy: 3, mood: 'Low', sleepHours: 4 },
  { content: 'I cleaned one corner of my room and made a proper meal. Those small routines gave the day a little shape.', energy: 4, mood: 'Okay', sleepHours: 6 },
  { content: 'I slept longer and had more patience with myself today. A friend invited me for coffee, and I said yes.', energy: 5, mood: 'Good', sleepHours: 8 },
  { content: 'I felt low again after comparing myself to others online. Taking a break from my phone helped me settle.', energy: 3, mood: 'Low', sleepHours: 6 },
  { content: 'Everything felt unusually effortful this morning. I kept my expectations low and focused on the next hour only.', energy: 2, mood: 'Very Low', sleepHours: 4 },
  { content: 'I finished a work task I had been avoiding. It did not erase the sadness, but I felt a little more capable.', energy: 3, mood: 'Low', sleepHours: 6 },
  { content: 'A slow walk after dinner helped loosen some tension. I noticed I was breathing more deeply by the time I came home.', energy: 4, mood: 'Okay', sleepHours: 6 },
  { content: 'I laughed at something a friend said today. It was brief, but it reminded me that lighter moments can still happen.', energy: 5, mood: 'Good', sleepHours: 8 },
  { content: 'I felt drained by midday and took a nap. I am trying to see rest as support instead of a failure.', energy: 3, mood: 'Low', sleepHours: 6 },
  { content: 'I wrote down three things that were bothering me and one thing I could control. That made the evening feel clearer.', energy: 4, mood: 'Okay', sleepHours: 6 },
  { content: 'The morning was hard, but I took a shower, answered a call, and made it through the day without pushing too far.', energy: 3, mood: 'Low', sleepHours: 4 },
  { content: 'I made plans for the weekend and felt a little more like myself. I want to protect this steadier pace.', energy: 5, mood: 'Good', sleepHours: 8 },
  { content: 'I still felt a low hum of sadness, but it was not as consuming. Cooking with music on helped.', energy: 4, mood: 'Okay', sleepHours: 6 },
  { content: 'I was tired and quiet today. Instead of forcing productivity, I completed one task and let myself stop there.', energy: 3, mood: 'Low', sleepHours: 4 },
  { content: 'I reached out first and had a good conversation. Connection felt easier than it did a few weeks ago.', energy: 4, mood: 'Okay', sleepHours: 6 },
  { content: 'I woke up with more energy and went outside before work. The day was not perfect, but it felt more hopeful.', energy: 6, mood: 'Good', sleepHours: 8 },
  { content: 'I am noticing progress in small things: replying sooner, eating regularly, and making room for rest.', energy: 5, mood: 'Good', sleepHours: 8 },
] as const;

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function previousDateKey(key: string) {
  const date = new Date(`${key}T12:00:00`);
  date.setDate(date.getDate() - 1);
  return dateKey(date);
}

function readableDate(key: string) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    .format(new Date(`${key}T12:00:00`));
}

function readableTime(iso: string) {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
}

function textColorForBackground(color: string) {
  const hex = color.replace('#', '');
  if (hex.length !== 6) return '#FFFFFF';
  const [red, green, blue] = [0, 2, 4].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));
  return red * 0.299 + green * 0.587 + blue * 0.114 > 160 ? '#1E293B' : '#FFFFFF';
}

function validMoodList(raw: unknown): raw is Mood[] {
  return Array.isArray(raw) && raw.length > 0 && raw.every((mood) => (
    mood && typeof mood === 'object'
    && typeof (mood as Mood).value === 'number'
    && typeof (mood as Mood).label === 'string'
    && typeof (mood as Mood).color === 'string'
    && typeof (mood as Mood).textColor === 'string'
  ));
}

function sleepSummary(hours: number | null) {
  if (hours === null) return null;
  const option = sleepOptions.find((item) => Number(item.value) === hours);
  return option ? option.label : `${hours} hours`;
}

function calendarCells(month: Date) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1).getDay();
  const count = new Date(year, monthIndex + 1, 0).getDate();
  return Array.from({ length: firstDay + count }, (_, index) => {
    if (index < firstDay) return null;
    return new Date(year, monthIndex, index - firstDay + 1);
  });
}

type VoiceTranscriptionEventsProps = {
  onEnd: () => void;
  onError: (error: string) => void;
  onResult: (transcript: string) => void;
  onStart: () => void;
};

function VoiceTranscriptionEvents({ onEnd, onError, onResult, onStart }: VoiceTranscriptionEventsProps) {
  if (!speechRecognition) return null;

  const { useSpeechRecognitionEvent } = speechRecognition;
  useSpeechRecognitionEvent('start', onStart);
  useSpeechRecognitionEvent('end', onEnd);
  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript?.trim();
    if (transcript) onResult(transcript);
  });
  useSpeechRecognitionEvent('error', (event) => onError(event.error));
  return null;
}

type SwipeableEntryCardProps = {
  entry: JournalEntry;
  mood?: Mood;
  onDelete: () => void;
  onEdit: () => void;
};

function SwipeableEntryCard({ entry, mood, onDelete, onEdit }: SwipeableEntryCardProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderMove: (_, gesture) => translateX.setValue(Math.min(0, Math.max(-96, gesture.dx))),
    onPanResponderRelease: (_, gesture) => Animated.spring(translateX, { toValue: gesture.dx < -52 ? -88 : 0, useNativeDriver: true }).start(),
  }), [translateX]);

  return <View style={styles.swipeContainer}>
    <Pressable accessibilityLabel="Delete entry" onPress={onDelete} style={styles.swipeDelete}><Text style={styles.swipeDeleteText}>Delete</Text></Pressable>
    <Animated.View {...panResponder.panHandlers} style={{ transform: [{ translateX }] }}>
      <Pressable accessibilityHint="Opens this entry for editing" onPress={onEdit} style={styles.recentEntryCard}>
        <View style={[styles.recentMoodBar, { backgroundColor: mood?.color ?? '#B8B2D7' }]} />
        <View style={styles.recentEntryBody}>
          <View style={styles.recentEntryTop}><Text style={styles.recentEntryDate}>{readableDate(entry.date)}</Text>{mood && <Text style={[styles.recentMoodPill, { backgroundColor: mood.color, color: mood.textColor }]}>{mood.label}</Text>}</View>
          <Text numberOfLines={1} style={styles.recentEntryPreview}>{entry.content || 'A private check-in'}</Text>
          <Text style={styles.recentEntryMeta}>Updated {readableTime(entry.updatedAt)}</Text>
        </View>
        {entry.imageUri && <Image accessibilityLabel="Photo attached to this entry" source={{ uri: entry.imageUri }} style={styles.recentEntryImage} />}
        <Text style={styles.recentEntryArrow}>›</Text>
      </Pressable>
    </Animated.View>
  </View>;
}

export default function App() {
  const todayKey = useMemo(() => dateKey(new Date()), []);
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [displayMonth, setDisplayMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [entries, setEntries] = useState<Record<string, JournalEntry[]>>({});
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [entryDateDraft, setEntryDateDraft] = useState(todayKey);
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [sleepHours, setSleepHours] = useState('');
  const [content, setContent] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [promptIndex, setPromptIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [screen, setScreen] = useState<Screen>('home');
  const [trendRange, setTrendRange] = useState<TrendRange>('seven');
  const [menuOpen, setMenuOpen] = useState(false);
  const [appThemeName, setAppThemeName] = useState<AppThemeName>('ocean');
  const [themesOpen, setThemesOpen] = useState(false);
  const [moods, setMoods] = useState<Mood[]>(defaultMoods);
  const [newMoodLabel, setNewMoodLabel] = useState('');
  const [newMoodColor, setNewMoodColor] = useState(moodColors[6]);
  const [weeklySummary, setWeeklySummary] = useState<WeeklyAISummary | null>(null);
  const [weeklySummaryError, setWeeklySummaryError] = useState<string | null>(null);
  const [weeklySummaryLoading, setWeeklySummaryLoading] = useState(false);
  const [entryAISummary, setEntryAISummary] = useState<EntryAISummary | null>(null);
  const [entryAIConcepts, setEntryAIConcepts] = useState<EntryAIConcepts | null>(null);
  const [entryAIError, setEntryAIError] = useState<string | null>(null);
  const [entryAILoading, setEntryAILoading] = useState<EntryAIAction | null>(null);
  const [quickTranscript, setQuickTranscript] = useState('');
  const [quickError, setQuickError] = useState<string | null>(null);
  const [quickListening, setQuickListening] = useState(false);
  const [voiceToolsOpen, setVoiceToolsOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [isWriting, setIsWriting] = useState(false);
  const [cursorIndex, setCursorIndex] = useState(0);
  const [notebookWidth, setNotebookWidth] = useState(0);
  const penLift = useRef(new Animated.Value(0)).current;

  const dayEntries = entries[selectedDate] ?? [];
  const appTheme = appThemes[appThemeName];
  const usesBrowserStorage = Platform.OS === 'web';
  const moodByValue = useMemo(() => Object.fromEntries(moods.map((mood) => [mood.value, mood])) as Record<number, Mood>, [moods]);
  const moodIndexByValue = useMemo(() => Object.fromEntries(moods.map((mood, index) => [mood.value, index])) as Record<number, number>, [moods]);
  const existingEntry = dayEntries.find((entry) => entry.id === editingEntryId);
  const activePrompts = selectedMood ? (moodPrompts[selectedMood] ?? [
    `What is this ${moodByValue[selectedMood]?.label.toLowerCase() ?? 'feeling'} trying to tell you?`,
    'What would help you feel supported in this moment?',
    'What is one gentle next step you can take for yourself?',
  ]) : [];
  const activePrompt = activePrompts.length ? activePrompts[promptIndex % activePrompts.length] : 'Choose a feeling to receive a reflection prompt tailored to this moment.';
  const sortedMoodEntries = useMemo(
    () => Object.values(entries).flat().filter((entry) => entry.mood !== null && Boolean(moodByValue[entry.mood])).sort((a, b) => a.date.localeCompare(b.date)),
    [entries, moodByValue],
  );
  const recentEntries = useMemo(
    () => Object.values(entries).flat().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [entries],
  );
  const summaryEntries = useMemo(() => {
    const firstDate = new Date(`${todayKey}T12:00:00`);
    firstDate.setDate(firstDate.getDate() - 6);
    const firstKey = dateKey(firstDate);
    return Object.values(entries).flat()
      .filter((entry) => entry.date >= firstKey && entry.date <= todayKey)
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
      .slice(-30)
      .map((entry) => ({
        content: entry.content,
        date: entry.date,
        energy: entry.energy,
        mood: entry.mood ? moodByValue[entry.mood]?.label ?? null : null,
        sleep: sleepSummary(entry.sleepHours),
      }));
  }, [entries, moodByValue, todayKey]);
  const streakStats = useMemo(() => {
    const checkInDates = new Set(Object.entries(entries).filter(([, dayEntries]) => dayEntries.length > 0).map(([date]) => date));
    let current = 0;
    let cursor = todayKey;
    while (checkInDates.has(cursor)) {
      current += 1;
      cursor = previousDateKey(cursor);
    }
    const orderedDates = [...checkInDates].sort();
    let longest = 0;
    let run = 0;
    let previous: string | null = null;
    orderedDates.forEach((date) => {
      run = previous && previousDateKey(date) === previous ? run + 1 : 1;
      longest = Math.max(longest, run);
      previous = date;
    });
    const recentDays = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      const key = dateKey(date);
      return { checkedIn: checkInDates.has(key), key, label: new Intl.DateTimeFormat('en-US', { weekday: 'narrow' }).format(date) };
    });
    return { current, longest, recentDays, total: checkInDates.size };
  }, [entries, todayKey]);
  const trendEntries = useMemo(() => {
    if (trendRange === 'seven') return sortedMoodEntries.slice(-7);
    if (trendRange === 'thirty') return sortedMoodEntries.slice(-30);
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 6);
    return sortedMoodEntries.filter((entry) => entry.date >= dateKey(cutoff));
  }, [sortedMoodEntries, trendRange]);
  const moodBreakdown = useMemo(
    () => moods.map((mood) => ({ mood, count: trendEntries.filter((entry) => entry.mood === mood.value).length })),
    [trendEntries],
  );
  const isNight = useMemo(() => {
    const hour = new Date().getHours();
    return hour < 6 || hour >= 18;
  }, []);

  const dateCells = useMemo(() => calendarCells(displayMonth), [displayMonth]);
  const entryDateOptions = useMemo(() => Array.from(new Set([entryDateDraft, ...Array.from({ length: 60 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - index);
    return dateKey(date);
  })])), [entryDateDraft]);
  const monthLabel = useMemo(
    () => new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(displayMonth),
    [displayMonth],
  );
  const penPosition = useMemo(() => {
    const characterWidth = 9;
    const usableWidth = Math.max(90, notebookWidth - 58);
    const charactersPerLine = Math.max(10, Math.floor(usableWidth / characterWidth));
    const typed = content.slice(0, cursorIndex);
    const lines = typed.split('\n');
    const visualLines = lines.reduce((total, line, index) => total + Math.floor(line.length / charactersPerLine) + (index < lines.length - 1 ? 1 : 0), 0);
    const lastLineLength = lines[lines.length - 1]?.length ?? 0;
    const column = lastLineLength % charactersPerLine;
    return { left: 16 + column * characterWidth, top: 12 + visualLines * 24 };
  }, [content, cursorIndex, notebookWidth]);

  useEffect(() => {
    if (!isWriting) {
      penLift.stopAnimation();
      penLift.setValue(0);
      return;
    }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(penLift, { duration: 360, toValue: -5, useNativeDriver: true }),
      Animated.timing(penLift, { duration: 360, toValue: 0, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [isWriting, penLift]);

  useEffect(() => {
    loadEntries()
      .then((loaded) => {
        setEntries(loaded);
      })
      .catch(() => Alert.alert('Could not load entries', 'Your saved entries could not be opened on this device.'))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    getLocalValue(THEME_KEY).then((savedTheme) => {
      if (savedTheme && savedTheme in appThemes) setAppThemeName(savedTheme as AppThemeName);
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    getLocalValue(MOODS_KEY).then((storedMoods) => {
      if (!storedMoods) return;
      try {
        const parsed = JSON.parse(storedMoods);
        if (validMoodList(parsed)) setMoods(parsed);
      } catch {
        // Keep the safe default feelings if a saved preference cannot be read.
      }
    }).catch(() => undefined);
  }, []);

  function chooseAppTheme(theme: AppThemeName) {
    setAppThemeName(theme);
    setThemesOpen(false);
    setLocalValue(THEME_KEY, theme).catch(() => undefined);
  }

  function saveMoodPreferences(nextMoods: Mood[]) {
    setMoods(nextMoods);
    setLocalValue(MOODS_KEY, JSON.stringify(nextMoods)).catch(() => undefined);
  }

  function updateMood(value: number, changes: Partial<Pick<Mood, 'color' | 'label'>>) {
    const nextMoods = moods.map((mood) => mood.value === value
      ? { ...mood, ...changes, textColor: changes.color ? textColorForBackground(changes.color) : mood.textColor }
      : mood);
    saveMoodPreferences(nextMoods);
  }

  function addMood() {
    const label = newMoodLabel.trim();
    if (!label) {
      Alert.alert('Name this feeling', 'Add a short emotion name before saving it.');
      return;
    }
    if (moods.some((mood) => mood.label.toLowerCase() === label.toLowerCase())) {
      Alert.alert('Already added', 'Choose a different name for this feeling.');
      return;
    }
    const value = Math.max(0, ...moods.map((mood) => mood.value)) + 1;
    saveMoodPreferences([...moods, { color: newMoodColor, label: label.slice(0, 24), textColor: textColorForBackground(newMoodColor), value }]);
    setNewMoodLabel('');
    setNewMoodColor(moodColors[(moods.length + 1) % moodColors.length]);
  }

  function removeMood(mood: Mood) {
    if (moods.length === 1) {
      Alert.alert('Keep one feeling', 'Add another feeling before removing this one.');
      return;
    }
    const isUsed = Object.values(entries).flat().some((entry) => entry.mood === mood.value);
    if (isUsed) {
      Alert.alert('This feeling is in your journal', `Keep “${mood.label}” so existing entries and calendar colors stay accurate. You can rename it or change its color instead.`);
      return;
    }
    Alert.alert(`Remove “${mood.label}”?`, 'This only removes it from the mood picker.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => {
        saveMoodPreferences(moods.filter((item) => item.value !== mood.value));
        if (selectedMood === mood.value) setSelectedMood(null);
      } },
    ]);
  }

  function chooseDate(key: string) {
    setSelectedDate(key);
    setEntryDateDraft(key);
    setEditingEntryId(null);
    setScreen('calendar');
  }

  function createTodayEntry() {
    openNewEntry(todayKey);
  }

  function openNewEntry(key: string) {
    setSelectedDate(key);
    setEntryDateDraft(key);
    setEditingEntryId(null);
    setSelectedMood(null);
    setEnergy(null);
    setSleepHours('');
    setContent('');
    setCursorIndex(0);
    setImageUri(null);
    setQuickTranscript('');
    setQuickError(null);
    setVoiceToolsOpen(false);
    setDatePickerOpen(false);
    setEntryAISummary(null);
    setEntryAIConcepts(null);
    setEntryAIError(null);
    setScreen('entry');
  }

  function editEntry(entry: JournalEntry) {
    setSelectedDate(entry.date);
    setEntryDateDraft(entry.date);
    setEditingEntryId(entry.id);
    setSelectedMood(entry.mood);
    setEnergy(entry.energy);
    setSleepHours(entry.sleepHours?.toString() ?? '');
    setContent(entry.content);
    setCursorIndex(entry.content.length);
    setImageUri(entry.imageUri ?? null);
    setQuickTranscript('');
    setQuickError(null);
    setVoiceToolsOpen(false);
    setDatePickerOpen(false);
    setEntryAISummary(null);
    setEntryAIConcepts(null);
    setEntryAIError(null);
    setScreen('entry');
  }

  function validDateKey(value: string) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && dateKey(new Date(`${value}T12:00:00`)) === value;
  }

  function isManagedPhoto(uri: string | null | undefined) {
    return Boolean(uri && uri.includes('/mindjournal-images/'));
  }

  async function removeManagedPhoto(uri: string | null | undefined) {
    if (!isManagedPhoto(uri)) return;
    try {
      await FileSystem.deleteAsync(uri!, { idempotent: true });
    } catch {
      // The entry can still be safely removed if its image was already unavailable.
    }
  }

  async function savePhotoLocally(sourceUri: string | null, entryId: string, previousUri: string | null | undefined) {
    if (!sourceUri) return null;
    if (sourceUri === previousUri) return sourceUri;
    if (!FileSystem.documentDirectory) throw new Error('Private photo storage is unavailable.');

    const directory = `${FileSystem.documentDirectory}mindjournal-images/`;
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    const destination = `${directory}${entryId}-${Date.now()}.jpg`;
    await FileSystem.copyAsync({ from: sourceUri, to: destination });
    return destination;
  }

  async function chooseJournalPhoto() {
    try {
      if (!imagePicker) {
        Alert.alert('Photo feature needs an update', 'Run npx expo install expo-image-picker, then restart the app.');
        return;
      }
      const permission = await imagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Photo permission needed', 'Allow photo access to attach a picture to this private journal entry.');
        return;
      }
      const result = await imagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [4, 3], mediaTypes: ['images'], quality: 0.7 });
      if (!result.canceled) setImageUri(result.assets[0]?.uri ?? null);
    } catch {
      Alert.alert('Could not open photos', 'Please try again.');
    }
  }

  async function saveSelectedEntry() {
    const trimmed = content.trim();
    if (!selectedMood && !trimmed) {
      Alert.alert('A gentle start', 'Choose a mood or write a few words before saving.');
      return;
    }
    if (trimmed.length > MAX_ENTRY_LENGTH) {
      Alert.alert('Entry is a little long', `For local journal storage, keep each entry under ${MAX_ENTRY_LENGTH} characters.`);
      return;
    }
    const parsedSleep = sleepHours.trim() ? Number(sleepHours) : null;
    if (parsedSleep !== null && (!Number.isFinite(parsedSleep) || parsedSleep < 0 || parsedSleep > 24)) {
      Alert.alert('Check sleep hours', 'Enter a number from 0 to 24, such as 7.5.');
      return;
    }

    const finalDate = entryDateDraft.trim();
    if (!validDateKey(finalDate)) {
      Alert.alert('Check the date', 'Use a real date in YYYY-MM-DD format, such as 2026-07-18.');
      return;
    }
    if (finalDate > todayKey) {
      Alert.alert('Choose today or earlier', 'Journal entries cannot be dated in the future.');
      return;
    }
    const now = new Date().toISOString();
    const id = existingEntry?.id ?? `${now}-${Math.random().toString(36).slice(2, 8)}`;
    let savedImageUri: string | null = null;
    try {
      setIsSaving(true);
      savedImageUri = await savePhotoLocally(imageUri, id, existingEntry?.imageUri);
      const item: JournalEntry = { content: trimmed, createdAt: existingEntry?.createdAt ?? now, date: finalDate, energy, id, imageUri: savedImageUri, mood: selectedMood, sleepHours: parsedSleep, updatedAt: now };
      await saveEntry(item);
      if (existingEntry && existingEntry.date !== finalDate) {
        try { await removeEntry(existingEntry.date, existingEntry.id); } catch { /* The updated copy remains safely saved. */ }
      }
      if (existingEntry?.imageUri !== savedImageUri) await removeManagedPhoto(existingEntry?.imageUri);
      setEntries((current) => {
        const next = { ...current };
        if (existingEntry && existingEntry.date !== finalDate) {
          const previous = (next[existingEntry.date] ?? []).filter((entry) => entry.id !== existingEntry.id);
          if (previous.length) next[existingEntry.date] = previous; else delete next[existingEntry.date];
        }
        const currentDay = next[finalDate] ?? [];
        next[finalDate] = currentDay.some((entry) => entry.id === item.id) ? currentDay.map((entry) => entry.id === item.id ? item : entry) : [...currentDay, item];
        return next;
      });
      setSelectedDate(finalDate);
      setEntryDateDraft(finalDate);
      setEditingEntryId(item.id);
      setImageUri(savedImageUri);
      Alert.alert('Entry saved', usesBrowserStorage ? `Your reflection for ${readableDate(finalDate)} is saved in this browser.` : `Your reflection for ${readableDate(finalDate)} is encrypted on this device.`);
    } catch {
      if (savedImageUri && savedImageUri !== existingEntry?.imageUri) await removeManagedPhoto(savedImageUri);
      Alert.alert('Entry was not saved', 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  async function startVoiceTranscription() {
    setQuickError(null);
    if (!speechRecognition) {
      setQuickError('Voice transcription needs a development build. You can still type in your journal here.');
      return;
    }
    const { ExpoSpeechRecognitionModule } = speechRecognition;
    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
      setQuickError('Speech recognition is not available on this device. You can still type in your journal.');
      return;
    }
    if (!ExpoSpeechRecognitionModule.supportsOnDeviceRecognition()) {
      setQuickError('On-device speech recognition is not available on this device. You can still type in your journal.');
      return;
    }
    const permission = await ExpoSpeechRecognitionModule.requestMicrophonePermissionsAsync();
    if (!permission.granted) {
      setQuickError('Microphone permission is needed to create a voice entry. You can still type one below.');
      return;
    }
    ExpoSpeechRecognitionModule.start({
      addsPunctuation: true,
      contextualStrings: ['anxious', 'feeling low', 'feeling good', 'mood', 'Reflect AI'],
      continuous: false,
      interimResults: true,
      iosTaskHint: 'dictation',
      lang: 'en-US',
      requiresOnDeviceRecognition: true,
    });
  }

  function stopVoiceTranscription() {
    speechRecognition?.ExpoSpeechRecognitionModule.stop();
  }

  function addTranscriptToReflection() {
    const transcript = quickTranscript.trim();
    if (!transcript) {
      setQuickError('Speak a few words or type a transcript first.');
      return;
    }
    setContent((current) => current.trim() ? `${current.trim()}\n\n${transcript}` : transcript);
    setQuickTranscript('');
    setQuickError(null);
  }

  function deleteEntry(entry: JournalEntry) {
    Alert.alert('Delete this entry?', 'This will permanently remove the selected entry from this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await removeEntry(entry.date, entry.id);
            await removeManagedPhoto(entry.imageUri);
            setEntries((current) => {
              const updated = { ...current };
              const remaining = (updated[entry.date] ?? []).filter((item) => item.id !== entry.id);
              if (remaining.length) updated[entry.date] = remaining; else delete updated[entry.date];
              return updated;
            });
            if (editingEntryId === entry.id) openNewEntry(entry.date);
          } catch {
            Alert.alert('Could not delete entry', 'Please try again.');
          }
        },
      },
    ]);
  }

  function deleteSelectedEntry() { if (existingEntry) deleteEntry(existingEntry); }

  async function exportEntries() {
    const allEntries = Object.values(entries).flat().sort((a, b) => a.date.localeCompare(b.date));
    if (!allEntries.length) {
      Alert.alert('Nothing to export', 'Save at least one reflection first.');
      return;
    }
    try {
      const path = `${FileSystem.cacheDirectory}ReflectAI-export-${dateKey(new Date())}.json`;
      const exportEntries = allEntries.map(({ imageUri: _imageUri, ...entry }) => ({ ...entry, hasPhoto: Boolean(_imageUri) }));
      const exportText = JSON.stringify({ exportedAt: new Date().toISOString(), entries: exportEntries }, null, 2);
      await FileSystem.writeAsStringAsync(path, exportText, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: 'Export Reflect AI entries' });
      } else {
        Alert.alert('Export created', 'Your device does not support the share sheet, so the private export remains in the app cache.');
      }
    } catch {
      Alert.alert('Could not export entries', 'Please try again.');
    }
  }

  async function generateWeeklySummary() {
    if (!summaryEntries.length) {
      setWeeklySummaryError('Save at least one reflection from the past seven days before generating a summary.');
      return;
    }
    try {
      setWeeklySummaryLoading(true);
      setWeeklySummaryError(null);
      const primaryResponse = await fetch(`${APP_AI_BASE_URL}/summarize`, {
        body: JSON.stringify({
          data: summaryEntries,
          instructions: 'Create a concise, warm seven-day journal reflection. Base it only on the supplied entries. In the summary, describe the overall week without diagnosing. In key points, include the most noticeable patterns and up to three gentle, practical next steps. Do not give medical advice.',
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
      if (primaryResponse.ok) {
        const summary = await primaryResponse.json() as EntryAISummary;
        setWeeklySummary({ affirmation: '', gentle_next_steps: [], overview: summary.summary, patterns: summary.key_points, support_note: null });
        return;
      }
      const fallbackResponse = await fetch(WEEKLY_SUMMARY_FALLBACK_ENDPOINT, {
        body: JSON.stringify({ entries: summaryEntries, week_ending: todayKey }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
      if (!fallbackResponse.ok) {
        const fallbackDetail = await fallbackResponse.json().catch(() => null) as { detail?: string } | null;
        const primaryDetail = await primaryResponse.json().catch(() => null) as { detail?: string } | null;
        throw new Error(fallbackDetail?.detail ?? primaryDetail?.detail ?? `The summary service returned ${fallbackResponse.status}.`);
      }
      setWeeklySummary(await fallbackResponse.json() as WeeklyAISummary);
    } catch (error) {
      setWeeklySummaryError(error instanceof Error ? error.message : 'The weekly summary could not be generated. Please try again.');
    } finally {
      setWeeklySummaryLoading(false);
    }
  }

  async function runEntryAI(action: EntryAIAction) {
    const reflection = content.trim();
    if (!reflection) {
      setEntryAIError('Write a few words in your reflection before using an AI tool.');
      return;
    }
    try {
      setEntryAILoading(action);
      setEntryAIError(null);
      const response = await fetch(`${APP_AI_BASE_URL}/${action}`, {
        body: JSON.stringify(action === 'summarize'
          ? { data: reflection, instructions: 'Give a concise, warm reflection. Do not diagnose or give medical advice.' }
          : { data: reflection }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => null) as { detail?: string } | null;
        throw new Error(detail?.detail ?? `The AI service returned ${response.status}.`);
      }
      if (action === 'summarize') {
        setEntryAISummary(await response.json() as EntryAISummary);
        setEntryAIConcepts(null);
      } else {
        setEntryAIConcepts(await response.json() as EntryAIConcepts);
        setEntryAISummary(null);
      }
    } catch (error) {
      setEntryAIError(error instanceof Error ? error.message : 'The AI tool could not be reached. Please try again.');
    } finally {
      setEntryAILoading(null);
    }
  }

  function confirmEntryAI(action: EntryAIAction) {
    if (!content.trim()) {
      setEntryAIError('Write a few words in your reflection before using an AI tool.');
      return;
    }
    const isSummary = action === 'summarize';
    Alert.alert(
      isSummary ? 'Summarize this reflection?' : 'Find relevant concepts?',
      'Your current reflection text will be sent to the Reflect AI server for analysis. This app is not clinical care or a replacement for professional support.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: isSummary ? 'Summarize' : 'Find concepts', onPress: () => runEntryAI(action) },
      ],
    );
  }

  function confirmWeeklySummary() {
    if (!summaryEntries.length) {
      setWeeklySummaryError('Save at least one reflection from the past seven days before generating a summary.');
      return;
    }
    Alert.alert(
      'Generate weekly AI summary?',
      `${summaryEntries.length} entr${summaryEntries.length === 1 ? 'y' : 'ies'} from the past seven days will be sent to the summary service. The service does not retain them.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Generate', onPress: generateWeeklySummary },
      ],
    );
  }

  function buildDemoEntries() {
    const now = new Date();
    const seed = Date.now();
    return demoJournalTemplate.map((sample, index): JournalEntry => {
      const date = new Date(now);
      date.setDate(date.getDate() - (29 - index));
      const mood = moods.find((item) => item.label.toLowerCase() === sample.mood.toLowerCase()) ?? moods[index % moods.length];
      const createdAt = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 8 + ((index * 5) % 12), (index * 13) % 60).toISOString();
      return {
        content: `Demo check-in: ${sample.content}`,
        createdAt,
        date: dateKey(date),
        energy: sample.energy,
        id: `demo-${seed}-${index}`,
        imageUri: null,
        mood: mood?.value ?? null,
        sleepHours: sample.sleepHours,
        updatedAt: createdAt,
      };
    });
  }

  function loadDemoJournal() {
    Alert.alert('Load 30-day sample journal?', 'This fictional, clearly labelled journal shows changing low mood, sleep, energy, and gentle recovery. Any older test data will be replaced; your entries will not be changed.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Load demo entries', onPress: async () => {
        try {
          const demoEntries = buildDemoEntries();
          const previousDemoEntries = Object.values(entries).flat().filter((entry) => entry.id.startsWith('demo-'));
          await Promise.all(demoEntries.map((entry) => saveEntry(entry)));
          await Promise.all(previousDemoEntries.map((entry) => removeEntry(entry.date, entry.id)));
          setEntries((current) => {
            const next = Object.fromEntries(Object.entries(current).map(([date, saved]) => [date, saved.filter((entry) => !entry.id.startsWith('demo-'))]).filter(([, saved]) => saved.length));
            demoEntries.forEach((entry) => { next[entry.date] = [...(next[entry.date] ?? []), entry]; });
            return next;
          });
          setWeeklySummary(null);
          Alert.alert('Sample journal loaded', 'Thirty fictional entries are ready to explore in Home, Calendar, Trends, and the 7-day AI reflection.');
        } catch {
          Alert.alert('Could not load demo entries', 'Please try again.');
        }
      } },
    ]);
  }

  function deleteAll() {
    if (!Object.keys(entries).length) return;
    Alert.alert('Delete all entries?', 'This permanently removes every Reflect AI entry from this device. Consider exporting first.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete all', style: 'destructive', onPress: async () => {
          try {
            await removeAllEntries();
            await Promise.all(Object.values(entries).flat().map((entry) => removeManagedPhoto(entry.imageUri)));
            setEntries({});
            setContent('');
            setImageUri(null);
            setEditingEntryId(null);
            setSelectedMood(null);
            setEnergy(null);
            setSleepHours('');
          } catch {
            Alert.alert('Could not delete entries', 'Please try again.');
          }
        },
      },
    ]);
  }

  if (isLoading) {
    return <SafeAreaView style={[styles.safeArea, styles.loading]}><ActivityIndicator color="#3568B7" size="large" /></SafeAreaView>;
  }

  if (screen === 'summary') {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: appTheme.background }]}>
        <StatusBar barStyle={appTheme.dark ? 'light-content' : 'dark-content'} />
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <View><Text style={[styles.brand, { color: appTheme.text }]}>AI <Text style={[styles.brandAccent, { color: appTheme.primary }]}>reflection</Text></Text><Text style={[styles.date, { color: appTheme.dark ? '#B9D2CB' : appTheme.text }]}>Notice gentle patterns in your recent check-ins.</Text></View>
            <Pressable accessibilityLabel="Back to home" onPress={() => setScreen('home')} style={[styles.backButton, { backgroundColor: appTheme.accent }]}><Text style={[styles.backButtonText, { color: appTheme.nav }]}>Back</Text></Pressable>
          </View>
          <View style={styles.weeklyAiCard}>
            <Text style={styles.weeklyAiTitle}>Weekly AI reflection</Text>
            <Text style={styles.weeklyAiText}>Generate a warm reflection from up to {summaryEntries.length} entries from the past seven days. You will see a privacy confirmation before anything is sent. This is not clinical advice.</Text>
            <Pressable accessibilityRole="button" disabled={weeklySummaryLoading} onPress={confirmWeeklySummary} style={[styles.weeklyAiButton, { backgroundColor: appTheme.primary }, weeklySummaryLoading && styles.disabledButton]}><Text style={styles.weeklyAiButtonText}>{weeklySummaryLoading ? 'Creating your reflection…' : 'Generate weekly AI summary'}</Text></Pressable>
            {weeklySummaryError && <Text style={styles.weeklyAiError}>{weeklySummaryError}</Text>}
            {weeklySummary && <View style={styles.weeklyAiResult}><Text style={styles.weeklyAiResultTitle}>Your reflection</Text><Text style={styles.weeklyAiOverview}>{weeklySummary.overview}</Text>{weeklySummary.patterns.length > 0 && <><Text style={styles.weeklyAiSectionTitle}>Patterns noticed</Text>{weeklySummary.patterns.map((pattern, index) => <Text key={`${pattern}-${index}`} style={styles.weeklyAiBullet}>• {pattern}</Text>)}</>}{weeklySummary.gentle_next_steps.length > 0 && <><Text style={styles.weeklyAiSectionTitle}>Gentle next steps</Text>{weeklySummary.gentle_next_steps.map((step, index) => <Text key={`${step}-${index}`} style={styles.weeklyAiBullet}>• {step}</Text>)}</>}{Boolean(weeklySummary.affirmation) && <Text style={styles.weeklyAiAffirmation}>{weeklySummary.affirmation}</Text>}{weeklySummary.support_note && <Text style={styles.weeklyAiSupport}>{weeklySummary.support_note}</Text>}</View>}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (screen === 'streak') {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: appTheme.background }]}>
        <StatusBar barStyle={appTheme.dark ? 'light-content' : 'dark-content'} />
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <View><Text style={[styles.brand, { color: appTheme.text }]}>Your <Text style={[styles.brandAccent, { color: appTheme.primary }]}>streak</Text></Text><Text style={[styles.date, { color: appTheme.dark ? '#B9D2CB' : appTheme.text }]}>Small moments of reflection add up.</Text></View>
            <Pressable accessibilityLabel="Back to home" onPress={() => setScreen('home')} style={[styles.backButton, { backgroundColor: appTheme.accent }]}><Text style={[styles.backButtonText, { color: appTheme.nav }]}>Back</Text></Pressable>
          </View>
          <View style={[styles.streakHero, { backgroundColor: appTheme.primary }]}>
            <Text style={styles.streakEmoji}>{streakStats.current >= 7 ? '🔥' : streakStats.current > 0 ? '✦' : '☀'}</Text>
            <Text style={styles.streakNumber}>{streakStats.current}</Text>
            <Text style={styles.streakLabel}>day{streakStats.current === 1 ? '' : 's'} in a row</Text>
            <Text style={styles.streakMessage}>{streakStats.current ? 'You checked in today. Keep showing up gently.' : 'Save a reflection today to begin a new streak.'}</Text>
          </View>
          <View style={styles.streakStatsRow}>
            <View style={styles.streakStatCard}><Text style={[styles.streakStatValue, { color: appTheme.primary }]}>{streakStats.longest}</Text><Text style={styles.streakStatLabel}>Longest streak</Text></View>
            <View style={styles.streakStatCard}><Text style={[styles.streakStatValue, { color: appTheme.primary }]}>{streakStats.total}</Text><Text style={styles.streakStatLabel}>Days reflected</Text></View>
          </View>
          <View style={styles.streakWeekCard}>
            <Text style={styles.streakWeekTitle}>Your last 7 days</Text>
            <View style={styles.streakWeekRow}>{streakStats.recentDays.map((day) => <View key={day.key} style={styles.streakDay}><View style={[styles.streakDayDot, { backgroundColor: day.checkedIn ? appTheme.primary : '#DDE8F5' }]}><Text style={[styles.streakDayMark, { color: day.checkedIn ? '#FFFFFF' : '#91A1B6' }]}>{day.checkedIn ? '✓' : '·'}</Text></View><Text style={styles.streakDayLabel}>{day.label}</Text></View>)}</View>
            <Text style={styles.streakWeekHint}>A day counts once you save at least one journal entry.</Text>
          </View>
          <View style={styles.streakGentleCard}><Text style={styles.streakGentleTitle}>A gentle reminder</Text><Text style={styles.streakGentleText}>Streaks are here to celebrate—not pressure you. Missing a day never takes away the reflections you have made.</Text></View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (screen === 'trends') {
    return (
      <SafeAreaView style={[styles.safeArea, styles.trendsTheme, { backgroundColor: appTheme.background }]}>
        <StatusBar barStyle={appTheme.dark ? "light-content" : "dark-content"} />
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <View><Text style={styles.brand}>Mood <Text style={styles.brandAccent}>trends</Text></Text><Text style={styles.date}>Patterns from your saved check-ins</Text></View>
            <Pressable accessibilityLabel="Back to calendar" onPress={() => setScreen('home')} style={styles.backButton}><Text style={styles.backButtonText}>Back</Text></Pressable>
          </View>
          <View style={styles.rangeRow}>
            <Pressable onPress={() => setTrendRange('seven')} style={[styles.rangeButton, trendRange === 'seven' && { backgroundColor: appTheme.primary }]}><Text style={[styles.rangeButtonText, trendRange === 'seven' && styles.rangeButtonTextSelected]}>7 entries</Text></Pressable>
            <Pressable onPress={() => setTrendRange('thirty')} style={[styles.rangeButton, trendRange === 'thirty' && { backgroundColor: appTheme.primary }]}><Text style={[styles.rangeButtonText, trendRange === 'thirty' && styles.rangeButtonTextSelected]}>30 entries</Text></Pressable>
            <Pressable onPress={() => setTrendRange('sixMonths')} style={[styles.rangeButton, trendRange === 'sixMonths' && { backgroundColor: appTheme.primary }]}><Text style={[styles.rangeButtonText, trendRange === 'sixMonths' && styles.rangeButtonTextSelected]}>6 months</Text></Pressable>
          </View>
          {trendEntries.length ? <>
            <Text style={styles.trendSummary}>Based on {trendEntries.length} mood-tracked day{trendEntries.length === 1 ? '' : 's'}.</Text>
            <View accessibilityLabel="Mood trend graph showing feeling categories by date" style={styles.trendChart}>
              <View style={styles.trendLabels}>{[...moods].reverse().map((mood) => <Text key={mood.value} style={styles.trendLabel}>{mood.label}</Text>)}</View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trendPlotScroll}>
                <View style={[styles.trendPlot, { height: Math.max(191, moods.length * 28 + 23), width: Math.max(180, trendEntries.length * 44) }]}>
                  {[...moods].reverse().map((mood) => <View key={mood.value} style={styles.trendGuide} />)}
                  {trendEntries.slice(1).map((entry, index) => {
                    const previous = trendEntries[index];
                    const x1 = index * 44 + 22;
                    const y1 = (moods.length - 1 - (moodIndexByValue[previous.mood!] ?? 0)) * 28 + 14;
                    const x2 = (index + 1) * 44 + 22;
                    const y2 = (moods.length - 1 - (moodIndexByValue[entry.mood!] ?? 0)) * 28 + 14;
                    const length = Math.hypot(x2 - x1, y2 - y1);
                    const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
                    return <View key={`line-${entry.id}`} style={[styles.trendLine, { left: (x1 + x2 - length) / 2, top: (y1 + y2) / 2 - 1, transform: [{ rotate: `${angle}deg` }], width: length }]} />;
                  })}
                  {trendEntries.map((entry, index) => <View key={entry.id} style={[styles.trendPoint, { backgroundColor: moodByValue[entry.mood!]?.color ?? appTheme.primary, left: index * 44 + 15, top: (moods.length - 1 - (moodIndexByValue[entry.mood!] ?? 0)) * 28 + 7 }]} />)}
                  <View style={styles.trendDateRow}>{trendEntries.map((entry) => <Text key={`date-${entry.id}`} style={styles.trendDate}>{entry.date.slice(5).replace('-', '/')}</Text>)}</View>
                </View>
              </ScrollView>
            </View>
            <Text style={styles.breakdownTitle}>How you felt in this period</Text>
            {moodBreakdown.map(({ mood, count }) => {
              const percentage = Math.round((count / trendEntries.length) * 100);
              return <View key={mood.value} style={styles.breakdownRow}><View style={[styles.breakdownSwatch, { backgroundColor: mood.color }]} /><Text style={styles.breakdownLabel}>{mood.label}</Text><View style={styles.breakdownTrack}><View style={[styles.breakdownFill, { backgroundColor: mood.color, width: `${percentage}%` }]} /></View><Text style={styles.breakdownValue}>{percentage}%</Text></View>;
            })}
          </> : <View style={styles.emptyState}><Text style={styles.emptyStateTitle}>No check-ins in this period</Text><Text style={styles.emptyStateText}>Save a feeling on the calendar to begin seeing your trends.</Text></View>}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (screen === 'moods') {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: appTheme.background }]}>
        <StatusBar barStyle={appTheme.dark ? 'light-content' : 'dark-content'} />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View><Text style={[styles.brand, { color: appTheme.text }]}>Your <Text style={[styles.brandAccent, { color: appTheme.primary }]}>feelings</Text></Text><Text style={[styles.date, { color: appTheme.dark ? '#B9D2CB' : appTheme.text }]}>Choose names and colors that feel right to you.</Text></View>
            <Pressable accessibilityLabel="Back to home" onPress={() => setScreen('home')} style={[styles.backButton, { backgroundColor: appTheme.accent }]}><Text style={[styles.backButtonText, { color: appTheme.nav }]}>Back</Text></Pressable>
          </View>
          <View style={styles.moodSettingsNotice}><Text style={styles.moodSettingsNoticeTitle}>Personalize your mood map</Text><Text style={styles.moodSettingsNoticeText}>These names and colors stay on this device. Updating one also updates the color shown for its past calendar entries.</Text></View>
          <Text style={styles.moodSettingsTitle}>Your feelings</Text>
          {moods.map((mood) => <View key={mood.value} style={styles.moodSettingsCard}>
            <View style={styles.moodSettingsTop}><View style={[styles.moodSettingsPreview, { backgroundColor: mood.color }]}><Text style={{ color: mood.textColor }}>●</Text></View><TextInput accessibilityLabel={`Name for ${mood.label}`} maxLength={24} onChangeText={(label) => updateMood(mood.value, { label })} placeholder="Feeling name" style={styles.moodNameInput} value={mood.label} /><Pressable accessibilityLabel={`Remove ${mood.label}`} onPress={() => removeMood(mood)} style={styles.moodRemoveButton}><Text style={styles.moodRemoveText}>Remove</Text></Pressable></View>
            <View style={styles.colorChoiceRow}>{moodColors.map((color) => <Pressable accessibilityLabel={`Use ${color} for ${mood.label}`} key={color} onPress={() => updateMood(mood.value, { color })} style={[styles.colorChoice, { backgroundColor: color }, mood.color === color && styles.colorChoiceSelected]} />)}</View>
          </View>)}
          <View style={styles.addMoodCard}>
            <Text style={styles.moodSettingsTitle}>Add an emotion</Text>
            <Text style={styles.addMoodHint}>For example: Calm, Stressed, Hopeful, or Numb.</Text>
            <TextInput accessibilityLabel="New emotion name" maxLength={24} onChangeText={setNewMoodLabel} placeholder="Emotion name" placeholderTextColor="#7186A7" style={styles.newMoodInput} value={newMoodLabel} />
            <View style={styles.colorChoiceRow}>{moodColors.map((color) => <Pressable accessibilityLabel={`Choose ${color} for new emotion`} key={color} onPress={() => setNewMoodColor(color)} style={[styles.colorChoice, { backgroundColor: color }, newMoodColor === color && styles.colorChoiceSelected]} />)}</View>
            <Pressable accessibilityRole="button" onPress={addMood} style={[styles.addMoodButton, { backgroundColor: appTheme.primary }]}><Text style={styles.addMoodButtonText}>Add emotion</Text></Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (screen === 'home') {
    return (
      <SafeAreaView style={[styles.safeArea, styles.homeSafeArea, { backgroundColor: appTheme.background }]}>
        <StatusBar barStyle={appTheme.dark ? "light-content" : "dark-content"} />
        <View style={[styles.homeShell, { backgroundColor: appTheme.background }]}>
          <ScrollView contentContainerStyle={styles.homeContent} showsVerticalScrollIndicator={false}>
            <View style={styles.homeHeader}>
              <Pressable accessibilityLabel="Open menu" onPress={() => setMenuOpen((open) => !open)} style={styles.iconButton}>
                <Text style={styles.menuIcon}>☰</Text>
              </Pressable>
              <View style={styles.homeBrandWrap}>
                <Text style={[styles.homeBrand, { color: appTheme.text }]}>Reflect AI</Text>
                <Text style={[styles.homeBrandSub, { color: appTheme.dark ? '#B9D2CB' : appTheme.text }]}>A private space for you</Text>
              </View>
              <View style={styles.homeLock}><Text style={styles.homeLockText}>⌁</Text></View>
            </View>

            {menuOpen && <View style={styles.menuPanel}>
              <Pressable onPress={() => { setMenuOpen(false); setScreen('trends'); }} style={styles.menuItem}><Text style={styles.menuItemText}>Mood trends</Text><Text style={styles.menuItemArrow}>›</Text></Pressable>
              <Pressable onPress={() => { setMenuOpen(false); setScreen('summary'); }} style={styles.menuItem}><Text style={styles.menuItemText}>Generate AI summary</Text><Text style={styles.menuItemArrow}>›</Text></Pressable>
              <Pressable onPress={() => { setMenuOpen(false); loadDemoJournal(); }} style={styles.menuItem}><Text style={styles.menuItemText}>Load 30-day test data</Text><Text style={styles.menuItemArrow}>›</Text></Pressable>
              <Pressable onPress={() => { setMenuOpen(false); setScreen('streak'); }} style={styles.menuItem}><Text style={styles.menuItemText}>Your streak</Text><Text style={styles.menuItemArrow}>›</Text></Pressable>
              <Pressable onPress={() => { setMenuOpen(false); setScreen('moods'); }} style={styles.menuItem}><Text style={styles.menuItemText}>Feelings & colors</Text><Text style={styles.menuItemArrow}>›</Text></Pressable>
              <Pressable onPress={() => { setThemesOpen((open) => !open); }} style={styles.menuItem}><Text style={styles.menuItemText}>Appearance</Text><Text style={styles.menuItemArrow}>{themesOpen ? '⌃' : '›'}</Text></Pressable>
              {themesOpen && <View style={styles.themeChoices}>{(Object.entries(appThemes) as [AppThemeName, AppTheme][]).map(([key, theme]) => <Pressable key={key} onPress={() => chooseAppTheme(key)} style={[styles.themeChoice, appThemeName === key && { borderColor: theme.primary, borderWidth: 2 }]}><View style={[styles.themeSwatch, { backgroundColor: theme.primary }]} /><Text style={styles.themeChoiceText}>{theme.name}</Text></Pressable>)}</View>}
              <Pressable onPress={() => { setMenuOpen(false); exportEntries(); }} style={styles.menuItem}><Text style={styles.menuItemText}>Export my entries</Text><Text style={styles.menuItemArrow}>›</Text></Pressable>
              <Text style={styles.menuHint}>More menu options can be added here anytime.</Text>
            </View>}

            <View style={[styles.homeWelcomeCard, { backgroundColor: appTheme.primary }]}>
              <Text style={styles.homeWelcomeTitle}>How are you feeling today?</Text>
              <Text style={styles.homeWelcomeText}>{usesBrowserStorage ? 'Your entries stay in this browser unless you choose to export them.' : 'Your entries stay encrypted on this device unless you choose to export them.'}</Text>
              <Pressable onPress={createTodayEntry} style={[styles.homeWelcomeButton, { backgroundColor: appTheme.accent }]}><Text style={[styles.homeWelcomeButtonText, { color: appTheme.nav }]}>Write for today</Text></Pressable>
            </View>

            <View style={styles.recentHeader}>
              <Text style={styles.recentTitle}>Recent entries</Text>
              <Text style={styles.recentCount}>{recentEntries.length ? `${recentEntries.length} saved` : 'Start gently'}</Text>
            </View>

            {recentEntries.length ? recentEntries.map((entry) => {
              return <SwipeableEntryCard entry={entry} key={entry.id} mood={entry.mood ? moodByValue[entry.mood] : undefined} onDelete={() => deleteEntry(entry)} onEdit={() => editEntry(entry)} />;
            }) : <View style={styles.recentEmpty}><Text style={styles.recentEmptyTitle}>Nothing here yet</Text><Text style={styles.recentEmptyText}>Tap the + button below whenever you want a quiet space to check in.</Text></View>}
          </ScrollView>

          <View style={[styles.bottomNav, { backgroundColor: appTheme.nav }]}>
            <Pressable accessibilityLabel="Open calendar" onPress={() => setScreen('calendar')} style={styles.navButton}><Text style={styles.navIcon}>▣</Text><Text style={styles.navLabel}>Calendar</Text></Pressable>
            <Pressable accessibilityLabel="Add a journal entry" onPress={createTodayEntry} style={[styles.addButton, { backgroundColor: appTheme.accent }]}><Text style={[styles.addButtonText, { color: appTheme.nav }]}>+</Text></Pressable>
            <Pressable accessibilityLabel="View mood trends" onPress={() => setScreen('trends')} style={styles.navButton}><Text style={styles.navIcon}>⌁</Text><Text style={styles.navLabel}>Trends</Text></Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, screen === 'calendar' && styles.calendarTheme, screen === 'entry' && (isNight ? styles.entryNight : styles.entryDay), { backgroundColor: appTheme.background }]}>
      <StatusBar barStyle={appTheme.dark ? "light-content" : "dark-content"} />
      <VoiceTranscriptionEvents
        onEnd={() => setQuickListening(false)}
        onError={(error) => {
          setQuickListening(false);
          if (error !== 'aborted') setQuickError(error === 'no-speech' ? 'No words were heard. Try again when you are ready.' : 'Voice recognition could not start. You can type a quick entry instead.');
        }}
        onResult={setQuickTranscript}
        onStart={() => { setQuickError(null); setQuickListening(true); }}
      />
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View><Text style={[styles.brand, { color: appTheme.text }]}>Reflect <Text style={[styles.brandAccent, { color: appTheme.primary }]}>AI</Text></Text>{screen !== 'entry' && <Text style={[styles.date, { color: appTheme.dark ? '#B9D2CB' : appTheme.text }]}>Choose a day to write or revisit an entry</Text>}</View>
            <View style={styles.headerActions}>{screen === 'entry' && <Pressable accessibilityLabel="Choose entry date" onPress={() => setDatePickerOpen((open) => !open)} style={[styles.headerDateButton, { backgroundColor: appTheme.accent }]}><Text style={[styles.headerDateText, { color: appTheme.nav }]}>{new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(`${entryDateDraft}T12:00:00`))}</Text><Text style={[styles.headerDateChevron, { color: appTheme.nav }]}>⌄</Text></Pressable>}<Pressable accessibilityLabel="Back to home" onPress={() => setScreen('home')} style={[styles.backButton, { backgroundColor: appTheme.accent }]}><Text style={[styles.backButtonText, { color: appTheme.nav }]}>Back</Text></Pressable></View>
          </View>
          {screen === 'entry' && datePickerOpen && <View style={styles.headerDateDropdown}><Text style={styles.dateDropdownTitle}>Choose a date</Text><ScrollView nestedScrollEnabled style={styles.dateDropdownScroll}>{entryDateOptions.map((date) => <Pressable key={date} onPress={() => { setEntryDateDraft(date); setDatePickerOpen(false); }} style={[styles.dateOption, date === entryDateDraft && styles.dateOptionSelected]}><Text style={[styles.dateOptionText, date === entryDateDraft && styles.dateOptionTextSelected]}>{readableDate(date)}</Text></Pressable>)}</ScrollView></View>}

          {screen === 'calendar' && <>
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>Private by default</Text>
            <Text style={styles.noticeText}>{usesBrowserStorage ? 'Entries are stored only in this browser. Browser storage is not encrypted; use the mobile app for encrypted device storage.' : 'Entries are encrypted using this device’s secure storage. Exporting is always your choice.'}</Text>
          </View>

          <View style={styles.calendarHeader}>
            <Text style={styles.title}>Your calendar</Text>
            <View style={styles.monthControls}>
              <Pressable accessibilityLabel="Previous month" onPress={() => setDisplayMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))} style={styles.monthButton}><Text style={styles.monthButtonText}>‹</Text></Pressable>
              <Text style={styles.monthLabel}>{monthLabel}</Text>
              <Pressable accessibilityLabel="Next month" onPress={() => setDisplayMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))} style={styles.monthButton}><Text style={styles.monthButtonText}>›</Text></Pressable>
            </View>
          </View>
          <View style={styles.weekRow}>{weekDays.map((day) => <Text key={day} style={styles.weekday}>{day}</Text>)}</View>
          <View style={styles.calendarGrid}>
            {dateCells.map((date, index) => {
              if (!date) return <View key={`blank-${index}`} style={styles.dayCell} />;
              const key = dateKey(date);
              const isSelected = key === selectedDate;
              const isFuture = key > todayKey;
              const savedEntries = entries[key] ?? [];
              const moodEntry = [...savedEntries].reverse().find((entry) => entry.mood !== null);
              const entryMood = moodEntry?.mood ? moodByValue[moodEntry.mood] : null;
              return <Pressable key={key} disabled={isFuture} onPress={() => chooseDate(key)} style={[styles.dayCell, entryMood && { backgroundColor: entryMood.color }, isSelected && !entryMood && styles.daySelected, isSelected && styles.daySelectedOutline, isFuture && styles.dayFuture]}><Text style={[styles.dayNumber, entryMood && { color: entryMood.textColor }, isSelected && !entryMood && styles.dayNumberSelected]}>{date.getDate()}</Text>{savedEntries.length > 0 && !entryMood && <View style={styles.entryDot} />}</Pressable>;
            })}
          </View>
          <Text style={styles.selectedDate}>{readableDate(selectedDate)} · {dayEntries.length} entr{dayEntries.length === 1 ? 'y' : 'ies'}</Text>
          <View style={styles.calendarEntriesCard}>
            <View style={styles.calendarEntriesHeader}><Text style={styles.calendarEntriesTitle}>Entries for this day</Text><Pressable onPress={() => openNewEntry(selectedDate)} style={styles.calendarAddButton}><Text style={styles.calendarAddButtonText}>+ Add entry</Text></Pressable></View>
            {dayEntries.length ? [...dayEntries].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((entry) => <Pressable key={entry.id} onPress={() => editEntry(entry)} style={styles.calendarEntryRow}><View style={[styles.calendarEntryMood, { backgroundColor: entry.mood ? moodByValue[entry.mood].color : '#B8B2D7' }]} /><View style={styles.calendarEntryCopy}><Text style={styles.calendarEntryTime}>{readableTime(entry.createdAt)}</Text><Text numberOfLines={1} style={styles.calendarEntryText}>{entry.content || 'Mood check-in'}</Text>{(entry.energy !== null || entry.sleepHours !== null) && <Text style={styles.calendarEntryDetails}>{entry.energy !== null ? `Energy ${entry.energy}/10` : ''}{entry.energy !== null && entry.sleepHours !== null ? '  ·  ' : ''}{entry.sleepHours !== null ? `Sleep: ${sleepSummary(entry.sleepHours)}` : ''}</Text>}</View><Text style={styles.calendarEntryArrow}>›</Text></Pressable>) : <Text style={styles.calendarEmptyText}>No entries saved for this day yet.</Text>}
          </View>
          </>}

          {false && <>
          <View style={styles.quickEntryHero}>
            <Text style={styles.quickEntryHeroTitle}>Voice-to-text</Text>
            <Text style={styles.quickEntryHeroText}>Dictate a thought, then add the transcript to this journal entry. Audio is never stored.</Text>
            <Pressable accessibilityLabel={quickListening ? 'Stop listening' : 'Start listening'} onPress={quickListening ? stopVoiceTranscription : startVoiceTranscription} style={[styles.microphoneButton, quickListening && styles.microphoneButtonActive]}>
              <Text style={styles.microphoneIcon}>{quickListening ? '■' : '●'}</Text>
            </Pressable>
            <Text style={styles.listeningText}>{quickListening ? 'Listening… say a few words' : 'Tap the microphone to speak'}</Text>
          </View>
          <Text style={styles.quickTranscriptLabel}>Voice transcript</Text>
          <TextInput accessibilityLabel="Voice transcript" maxLength={280} multiline onChangeText={setQuickTranscript} placeholder="Your spoken words will appear here..." placeholderTextColor="#8E8A9B" style={styles.quickTranscriptInput} textAlignVertical="top" value={quickTranscript} />
          <Text style={styles.quickPrivacyText}>{usesBrowserStorage ? 'Only the text you save is added to this browser. No audio is retained.' : 'Only the text you save is added to your encrypted journal. No audio is retained.'}</Text>
          {quickError && <Text style={styles.quickError}>{quickError}</Text>}
          <Pressable accessibilityRole="button" onPress={addTranscriptToReflection} style={styles.transcriptButton}><Text style={styles.transcriptButtonText}>Add transcript to reflection</Text></Pressable>
          </>}

          {screen === 'entry' && <>
          <View style={[styles.natureScene, isNight && styles.natureSceneNight]}>
            <GirlWaving />
            <Text style={[styles.natureCaption, isNight && styles.natureCaptionNight]}>Your feelings are welcome here.</Text>
          </View>
          {false && <View style={styles.photoCard}>
            <View style={styles.photoHeader}><View><Text style={styles.photoTitle}>Photo</Text><Text style={styles.photoHint}>Optional — stored privately on this device.</Text></View>{imageUri && <Pressable accessibilityLabel="Remove attached photo" onPress={() => setImageUri(null)}><Text style={styles.removePhotoText}>Remove</Text></Pressable>}</View>
            {imageUri ? <Image accessibilityLabel="Selected journal photo" source={{ uri: imageUri ?? '' }} style={styles.photoPreview} /> : <Pressable accessibilityLabel="Choose a photo" onPress={chooseJournalPhoto} style={styles.addPhotoButton}><Text style={styles.addPhotoIcon}>▧</Text><Text style={styles.addPhotoText}>Add a photo</Text></Pressable>}
            {imageUri && <Pressable accessibilityLabel="Choose a different photo" onPress={chooseJournalPhoto} style={styles.changePhotoButton}><Text style={styles.changePhotoText}>Choose a different photo</Text></Pressable>}
          </View>}
          <Text style={styles.title}>How are you feeling?</Text>
          <Text style={styles.subtitle}>There is no right answer.</Text>
          <View style={styles.moodRow}>
            {moods.map((mood) => <Pressable accessibilityLabel={`${mood.label} mood`} accessibilityRole="button" key={mood.value} onPress={() => { setSelectedMood(mood.value); setPromptIndex(0); }} style={[styles.moodButton, selectedMood === mood.value && { borderColor: mood.color, borderWidth: 2 }]}><View style={[styles.moodColor, { backgroundColor: mood.color }]} /><Text style={styles.moodLabel}>{mood.label}</Text></Pressable>)}
          </View>

          <View style={styles.reflectionCard}>
            <View style={styles.entryHeader}><Text style={styles.title}>A space to reflect</Text>{activePrompts.length > 0 && <Pressable onPress={() => setPromptIndex((current) => (current + 1) % activePrompts.length)}><Text style={styles.newPrompt}>New prompt</Text></Pressable>}</View>
            <Text style={styles.prompt}>{activePrompt}</Text>
            <View onLayout={(event) => setNotebookWidth(event.nativeEvent.layout.width)} style={styles.notebookPage}><View pointerEvents="none" style={styles.notebookRules}>{Array.from({ length: 12 }, (_, index) => <View key={index} style={styles.notebookRule} />)}</View><Animated.Text pointerEvents="none" style={[styles.writingPen, { left: penPosition.left, opacity: isWriting ? 1 : 0.45, top: penPosition.top, transform: [{ translateY: penLift }, { rotate: '-24deg' }] }]}>✎</Animated.Text><TextInput accessibilityLabel="Journal entry" maxLength={MAX_ENTRY_LENGTH} multiline onBlur={() => setIsWriting(false)} onChangeText={setContent} onFocus={() => setIsWriting(true)} onSelectionChange={(event) => setCursorIndex(event.nativeEvent.selection.start)} placeholder="Write anything that is on your mind..." placeholderTextColor="#8E8A9B" style={styles.entryInput} textAlignVertical="top" value={content} /></View>
            <View style={styles.reflectionTools}>
              <Pressable accessibilityLabel="Choose a photo" onPress={chooseJournalPhoto} style={styles.reflectionTool}><Text style={styles.reflectionToolIcon}>▧</Text><Text style={styles.reflectionToolText}>Photo</Text></Pressable>
              <Pressable accessibilityLabel="Open voice transcription" onPress={() => setVoiceToolsOpen((open) => !open)} style={[styles.reflectionTool, voiceToolsOpen && styles.reflectionToolActive]}><Text style={styles.reflectionToolIcon}>●</Text><Text style={styles.reflectionToolText}>Voice</Text></Pressable>
            </View>
            {imageUri && <View style={styles.inlinePhoto}><Image accessibilityLabel="Selected journal photo" source={{ uri: imageUri }} style={styles.inlinePhotoPreview} /><View style={styles.inlinePhotoActions}><Text style={styles.inlinePhotoText}>Photo attached</Text><Pressable onPress={() => setImageUri(null)}><Text style={styles.removePhotoText}>Remove</Text></Pressable></View></View>}
            {voiceToolsOpen && <View style={styles.voicePanel}><View style={styles.voicePanelHeader}><View><Text style={styles.voicePanelTitle}>Voice-to-text</Text><Text style={styles.voicePanelHint}>Your audio is not saved.</Text></View><Pressable accessibilityLabel={quickListening ? 'Stop listening' : 'Start listening'} onPress={quickListening ? stopVoiceTranscription : startVoiceTranscription} style={[styles.smallMicrophoneButton, quickListening && styles.microphoneButtonActive]}><Text style={styles.smallMicrophoneIcon}>{quickListening ? '■' : '●'}</Text></Pressable></View><TextInput accessibilityLabel="Voice transcript" maxLength={280} multiline onChangeText={setQuickTranscript} placeholder="Speak or type your words..." placeholderTextColor="#8E8A9B" style={styles.voiceTranscriptInput} textAlignVertical="top" value={quickTranscript} />{quickError && <Text style={styles.quickError}>{quickError}</Text>}<Pressable accessibilityRole="button" onPress={addTranscriptToReflection} style={styles.transcriptButton}><Text style={styles.transcriptButtonText}>Add to reflection</Text></Pressable></View>}
            <Text style={styles.counter}>{content.length}/{MAX_ENTRY_LENGTH}</Text>
          </View>
          <View style={styles.energyHeader}><Text style={styles.title}>Energy level</Text><Text style={styles.energyValue}>{energy ? `${energy}/10` : 'Choose 1–10'}</Text></View>
          <Text style={styles.subtitle}>How much energy do you have today?</Text>
          <View style={styles.energyRow}>
            {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => <Pressable accessibilityLabel={`Energy level ${value}`} accessibilityRole="button" key={value} onPress={() => setEnergy(value)} style={[styles.energyButton, energy === value && { backgroundColor: appTheme.primary, borderColor: appTheme.primary }]}><Text style={[styles.energyButtonText, energy === value && styles.energyButtonTextSelected]}>{value}</Text></Pressable>)}
          </View>
          <View style={styles.sleepHeader}><Text style={styles.title}>Sleep</Text><Text style={styles.sleepUnit}>How did you sleep?</Text></View>
          <View style={styles.sleepOptions}>{sleepOptions.map((option) => <Pressable accessibilityLabel={`${option.label} sleep`} key={option.value} onPress={() => setSleepHours(option.value)} style={[styles.sleepOption, sleepHours === option.value && { backgroundColor: appTheme.primary, borderColor: appTheme.primary }]}><Text style={[styles.sleepOptionText, sleepHours === option.value && styles.sleepOptionTextSelected]}>{option.label}</Text></Pressable>)}</View>
          <Pressable accessibilityRole="button" disabled={isSaving} onPress={saveSelectedEntry} style={[styles.saveButton, { backgroundColor: appTheme.primary }, isSaving && styles.disabledButton]}><Text style={styles.saveButtonText}>{isSaving ? 'Saving…' : existingEntry ? 'Update reflection' : 'Save reflection'}</Text></Pressable>

          <View style={styles.privateAiTestCard}>
            <Text style={styles.privateAiTestTitle}>AI reflection tools</Text>
            <Text style={styles.privateAiTestText}>Explore a concise reflection or three relevant wellbeing concepts from what you wrote. Results stay only on this screen until you leave it.</Text>
            <View style={styles.privateAiTestActions}>
              <Pressable accessibilityRole="button" disabled={entryAILoading !== null} onPress={() => confirmEntryAI('summarize')} style={[styles.privateAiTestButton, { backgroundColor: appTheme.primary }, entryAILoading !== null && styles.disabledButton]}><Text style={styles.privateAiTestButtonText}>{entryAILoading === 'summarize' ? 'Summarizing…' : 'Summarize reflection'}</Text></Pressable>
              <Pressable accessibilityRole="button" disabled={entryAILoading !== null} onPress={() => confirmEntryAI('concepts')} style={[styles.privateAiTestSecondaryButton, entryAILoading !== null && styles.disabledButton]}><Text style={styles.privateAiTestSecondaryText}>{entryAILoading === 'concepts' ? 'Finding…' : 'Find 3 concepts'}</Text></Pressable>
            </View>
            {entryAIError && <Text style={styles.privateAiTestError}>{entryAIError}</Text>}
            {entryAISummary && <View style={styles.privateAiTestResult}><Text style={styles.privateAiTestResultTitle}>Summary</Text><Text style={styles.privateAiTestResultText}>{entryAISummary.summary}</Text>{entryAISummary.key_points.map((point, index) => <Text key={`${point}-${index}`} style={styles.privateAiTestBullet}>• {point}</Text>)}</View>}
            {entryAIConcepts && <View style={styles.privateAiTestResult}><Text style={styles.privateAiTestResultTitle}>Relevant concepts</Text>{entryAIConcepts.concepts.map((concept, index) => <View key={`${concept.name}-${index}`} style={styles.privateAiConcept}><Text style={styles.privateAiConceptName}>{concept.name}</Text><Text style={styles.privateAiTestResultText}>{concept.definition}</Text></View>)}</View>}
          </View>

          <View style={styles.controlsCard}>
            <Text style={styles.controlsTitle}>Your data</Text>
            <Text style={styles.controlsText}>Exports are readable files—only share them somewhere you trust.</Text>
            <View style={styles.controlButtons}>
              <Pressable onPress={exportEntries} style={[styles.secondaryButton, { backgroundColor: appTheme.accent }]}><Text style={[styles.secondaryButtonText, { color: appTheme.nav }]}>Export all</Text></Pressable>
              {existingEntry && <Pressable onPress={deleteSelectedEntry} style={styles.deleteButton}><Text style={styles.deleteButtonText}>Delete entry</Text></Pressable>}
            </View>
            {Object.keys(entries).length > 0 && <Pressable onPress={deleteAll}><Text style={styles.deleteAllText}>Delete all entries from this device</Text></Pressable>}
          </View>

          <View style={styles.supportCard}><Text style={styles.supportTitle}>Need support right now?</Text><Text style={styles.supportText}>This app is a journaling companion, not emergency or clinical care. If you may be in immediate danger, contact local emergency services or a crisis line in your area.</Text></View>
          </>}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F6F4FF' }, loading: { alignItems: 'center', justifyContent: 'center' }, screen: { flex: 1 }, content: { padding: 22, paddingBottom: 42 }, entryDay: { backgroundColor: '#F1F7F2' }, entryNight: { backgroundColor: '#EEF3F9' }, entryTextLight: { color: '#2C3D54' }, entryDateLight: { color: '#506277' },
  calendarTheme: { backgroundColor: '#EFF4FF' }, calendarEntriesCard: { backgroundColor: '#FFFFFF', borderColor: '#D4E1F4', borderRadius: 18, borderWidth: 1, marginBottom: 18, padding: 15 }, calendarEntriesHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 9 }, calendarEntriesTitle: { color: '#294D86', fontSize: 16, fontWeight: '800' }, calendarAddButton: { backgroundColor: '#D9F4F4', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 }, calendarAddButtonText: { color: '#1F638D', fontSize: 12, fontWeight: '800' }, calendarEntryRow: { alignItems: 'center', borderTopColor: '#E8EFF8', borderTopWidth: 1, flexDirection: 'row', paddingVertical: 11 }, calendarEntryMood: { borderRadius: 5, height: 26, marginRight: 10, width: 5 }, calendarEntryCopy: { flex: 1 }, calendarEntryTime: { color: '#4271AE', fontSize: 11, fontWeight: '800', marginBottom: 3 }, calendarEntryText: { color: '#40516A', fontSize: 14 }, calendarEntryArrow: { color: '#6C8BBB', fontSize: 25, marginLeft: 8 }, calendarEmptyText: { color: '#71829B', fontSize: 13, lineHeight: 19, paddingVertical: 8 }, transcriptButton: { alignItems: 'center', backgroundColor: '#D9F4F4', borderRadius: 13, marginTop: 12, paddingVertical: 13 }, transcriptButtonText: { color: '#1C628C', fontSize: 14, fontWeight: '800' }, entryDateCard: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#D8E3EF', borderRadius: 15, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15, padding: 13 }, entryDateTitle: { color: '#315982', fontSize: 14, fontWeight: '800' }, entryDateHint: { color: '#70829A', fontSize: 11, marginTop: 3 }, entryDateInput: { backgroundColor: '#EFF4FF', borderRadius: 9, color: '#315982', fontSize: 13, fontWeight: '700', marginLeft: 8, paddingHorizontal: 9, paddingVertical: 8, width: 108 }, photoCard: { backgroundColor: '#FFFFFF', borderColor: '#D8E3EF', borderRadius: 15, borderWidth: 1, marginBottom: 24, padding: 13 }, photoHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }, photoTitle: { color: '#315982', fontSize: 14, fontWeight: '800' }, photoHint: { color: '#70829A', fontSize: 11, marginTop: 3 }, addPhotoButton: { alignItems: 'center', backgroundColor: '#EFF4FF', borderColor: '#D6E5F9', borderRadius: 12, borderStyle: 'dashed', borderWidth: 1, flexDirection: 'row', justifyContent: 'center', paddingVertical: 19 }, addPhotoIcon: { color: '#3568B7', fontSize: 22, marginRight: 8 }, addPhotoText: { color: '#315982', fontSize: 14, fontWeight: '800' }, photoPreview: { borderRadius: 11, height: 190, width: '100%' }, removePhotoText: { color: '#B94646', fontSize: 12, fontWeight: '800' }, changePhotoButton: { alignItems: 'center', paddingTop: 12 }, changePhotoText: { color: '#3568B7', fontSize: 13, fontWeight: '800' },
  homeSafeArea: { backgroundColor: '#EFF4FF' }, homeShell: { flex: 1, backgroundColor: '#EFF4FF' }, homeContent: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 130 }, homeHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 22 }, iconButton: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 18, elevation: 2, height: 44, justifyContent: 'center', shadowColor: '#233C73', shadowOffset: { height: 2, width: 0 }, shadowOpacity: 0.1, shadowRadius: 5, width: 44 }, menuIcon: { color: '#31599C', fontSize: 25, lineHeight: 27 }, homeBrandWrap: { alignItems: 'center', flex: 1 }, homeBrand: { color: '#264A85', fontSize: 21, fontWeight: '800', letterSpacing: -0.5 }, homeBrandSub: { color: '#7084A9', fontSize: 11, marginTop: 2 }, homeLock: { alignItems: 'center', backgroundColor: '#D7E8FF', borderRadius: 18, height: 44, justifyContent: 'center', width: 44 }, homeLockText: { color: '#3567AF', fontSize: 23, fontWeight: '800' }, menuPanel: { backgroundColor: '#FFFFFF', borderColor: '#D7E1F2', borderRadius: 18, borderWidth: 1, marginBottom: 18, overflow: 'hidden', paddingVertical: 4 }, menuItem: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 }, menuItemText: { color: '#294D86', fontSize: 14, fontWeight: '700' }, menuItemArrow: { color: '#6081B7', fontSize: 23 }, menuHint: { color: '#7A8CA9', fontSize: 11, lineHeight: 16, paddingHorizontal: 16, paddingBottom: 12 }, homeWelcomeCard: { backgroundColor: '#3568B7', borderRadius: 24, marginBottom: 28, overflow: 'hidden', padding: 22 }, homeWelcomeTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', letterSpacing: -0.4 }, homeWelcomeText: { color: '#E9F2FF', fontSize: 13, lineHeight: 19, marginTop: 7, maxWidth: '88%' }, homeWelcomeButton: { alignSelf: 'flex-start', backgroundColor: '#99F1F1', borderRadius: 17, marginTop: 17, paddingHorizontal: 15, paddingVertical: 10 }, homeWelcomeButtonText: { color: '#174C78', fontSize: 13, fontWeight: '800' }, recentHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 13 }, recentTitle: { color: '#294A82', fontSize: 19, fontWeight: '800' }, recentCount: { color: '#6F86AB', fontSize: 12, fontWeight: '700' }, swipeContainer: { marginBottom: 12, overflow: 'hidden', position: 'relative' }, swipeDelete: { alignItems: 'flex-end', backgroundColor: '#D95A5A', borderRadius: 18, bottom: 0, justifyContent: 'center', paddingRight: 19, position: 'absolute', right: 0, top: 0, width: 108 }, swipeDeleteText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' }, recentEntryCard: { alignItems: 'stretch', backgroundColor: '#FFFFFF', borderRadius: 18, elevation: 1, flexDirection: 'row', minHeight: 102, overflow: 'hidden', shadowColor: '#214477', shadowOffset: { height: 2, width: 0 }, shadowOpacity: 0.08, shadowRadius: 5 }, recentMoodBar: { width: 7 }, recentEntryBody: { flex: 1, justifyContent: 'center', paddingHorizontal: 15, paddingVertical: 14 }, recentEntryTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 }, recentEntryDate: { color: '#31599A', fontSize: 12, fontWeight: '800', flex: 1 }, recentMoodPill: { borderRadius: 9, fontSize: 10, fontWeight: '800', marginLeft: 10, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 4 }, recentEntryPreview: { color: '#35455F', fontSize: 15, fontWeight: '700' }, recentEntryMeta: { color: '#8391A8', fontSize: 11, marginTop: 6 }, recentEntryImage: { alignSelf: 'center', borderRadius: 10, height: 68, marginRight: 10, width: 68 }, recentEntryArrow: { alignSelf: 'center', color: '#6D8CC0', fontSize: 29, marginRight: 13 }, recentEmpty: { alignItems: 'center', backgroundColor: '#E0EDFF', borderRadius: 18, padding: 25 }, recentEmptyTitle: { color: '#315A98', fontSize: 16, fontWeight: '800' }, recentEmptyText: { color: '#617FA9', fontSize: 13, lineHeight: 19, marginTop: 5, textAlign: 'center' }, bottomNav: { alignItems: 'center', backgroundColor: '#24467C', bottom: 0, flexDirection: 'row', justifyContent: 'space-between', left: 0, paddingBottom: 14, paddingHorizontal: 32, paddingTop: 13, position: 'absolute', right: 0 }, navButton: { alignItems: 'center', minWidth: 64 }, navIcon: { color: '#E7F0FF', fontSize: 24, lineHeight: 27 }, navLabel: { color: '#DDEBFF', fontSize: 10, fontWeight: '700', marginTop: 3 }, addButton: { alignItems: 'center', backgroundColor: '#91F2F3', borderColor: '#D5FFFF', borderRadius: 35, borderWidth: 3, height: 70, justifyContent: 'center', marginTop: -38, shadowColor: '#0E2A5C', shadowOffset: { height: 4, width: 0 }, shadowOpacity: 0.28, shadowRadius: 8, width: 70 }, addButtonText: { color: '#1E6190', fontSize: 42, fontWeight: '300', lineHeight: 45 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }, headerActions: { alignItems: 'center', flexDirection: 'row', gap: 8 }, brand: { color: '#294A82', fontSize: 24, fontWeight: '700', letterSpacing: -0.6 }, brandAccent: { color: '#3568B7' }, date: { color: '#647B9E', fontSize: 14, marginTop: 3 }, lock: { alignItems: 'center', backgroundColor: '#EAE6FF', borderRadius: 20, height: 40, justifyContent: 'center', width: 40 }, lockText: { color: '#5949B7', fontSize: 9, fontWeight: '800' }, trendsButton: { backgroundColor: '#6554C5', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }, trendsButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' }, headerDateButton: { alignItems: 'center', backgroundColor: '#D9E9FF', borderRadius: 10, flexDirection: 'row', paddingHorizontal: 9, paddingVertical: 9 }, headerDateText: { color: '#31599C', fontSize: 12, fontWeight: '800' }, headerDateChevron: { color: '#31599C', fontSize: 15, marginLeft: 4 }, headerDateDropdown: { backgroundColor: '#FFFFFF', borderColor: '#D8E3EF', borderRadius: 15, borderWidth: 1, marginBottom: 16, marginTop: -8, padding: 12 }, backButton: { backgroundColor: '#D9E9FF', borderRadius: 10, paddingHorizontal: 13, paddingVertical: 10 }, backButtonText: { color: '#31599C', fontSize: 12, fontWeight: '800' },
  notice: { backgroundColor: '#DDEBFF', borderRadius: 16, marginBottom: 28, padding: 16 }, noticeTitle: { color: '#294D86', fontSize: 15, fontWeight: '700', marginBottom: 5 }, noticeText: { color: '#537196', fontSize: 13, lineHeight: 19 },
  title: { color: '#294A82', fontSize: 20, fontWeight: '700', letterSpacing: -0.3 }, subtitle: { color: '#647B9E', fontSize: 14, marginTop: 5 }, calendarHeader: { marginBottom: 13 }, monthControls: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }, monthButton: { alignItems: 'center', backgroundColor: '#D9E9FF', borderRadius: 15, height: 30, justifyContent: 'center', width: 30 }, monthButtonText: { color: '#31599C', fontSize: 25, lineHeight: 28 }, monthLabel: { color: '#315982', fontSize: 14, fontWeight: '700' }, weekRow: { flexDirection: 'row', marginBottom: 6 }, weekday: { color: '#7186A7', fontSize: 11, fontWeight: '700', textAlign: 'center', width: '14.285%' }, calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 11 }, dayCell: { alignItems: 'center', borderRadius: 13, height: 42, justifyContent: 'center', marginVertical: 1, width: '14.285%' }, daySelected: { backgroundColor: '#3568B7' }, daySelectedOutline: { borderColor: '#24467C', borderWidth: 2 }, dayFuture: { opacity: 0.3 }, dayNumber: { color: '#405A80', fontSize: 14, fontWeight: '600' }, dayNumberSelected: { color: '#FFFFFF' }, entryDot: { backgroundColor: '#3568B7', borderRadius: 3, bottom: 5, height: 5, position: 'absolute', width: 5 }, selectedDate: { color: '#31599C', fontSize: 13, fontWeight: '700', marginBottom: 25, textAlign: 'center' },
  moodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 27, marginTop: 15 }, moodButton: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#D8E3EF', borderRadius: 13, borderWidth: 1, flexDirection: 'row', minHeight: 44, paddingHorizontal: 10, width: '31%' }, moodColor: { borderRadius: 6, height: 12, marginRight: 7, width: 12 }, moodLabel: { color: '#405A80', fontSize: 11, fontWeight: '700', flexShrink: 1 }, energyHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, energyValue: { color: '#3568B7', fontSize: 13, fontWeight: '700' }, energyRow: { flexDirection: 'row', gap: 4, marginBottom: 30, marginTop: 15 }, energyButton: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#D8E3EF', borderRadius: 8, borderWidth: 1, flex: 1, paddingVertical: 10 }, energyButtonSelected: { backgroundColor: '#3568B7', borderColor: '#3568B7' }, energyButtonText: { color: '#405A80', fontSize: 12, fontWeight: '700' }, energyButtonTextSelected: { color: '#FFFFFF' },
  sleepHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, sleepUnit: { color: '#706C7D', fontSize: 13 }, sleepOptions: { flexDirection: 'row', gap: 7, marginBottom: 28, marginTop: 11 }, sleepOption: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#D8E3EF', borderRadius: 10, borderWidth: 1, flex: 1, paddingHorizontal: 4, paddingVertical: 11 }, sleepOptionSelected: { backgroundColor: '#3568B7', borderColor: '#3568B7' }, sleepOptionText: { color: '#52667F', fontSize: 11, fontWeight: '800' }, sleepOptionTextSelected: { color: '#FFFFFF' }, trendChart: { flexDirection: 'row', marginBottom: 28 }, trendLabels: { justifyContent: 'space-between', paddingBottom: 23, width: 76 }, trendLabel: { color: '#706C7D', fontSize: 10, height: 28, textAlign: 'right' }, trendPlotScroll: { paddingRight: 3 }, trendPlot: { height: 191, position: 'relative' }, trendGuide: { borderBottomColor: '#DDE8F5', borderBottomWidth: 1, height: 28 }, trendLine: { backgroundColor: '#7AA8D9', height: 2, position: 'absolute' }, trendPoint: { borderColor: '#FFFFFF', borderRadius: 8, borderWidth: 2, height: 16, position: 'absolute', width: 16 }, trendDateRow: { bottom: 0, flexDirection: 'row', left: 0, position: 'absolute', right: 0 }, trendDate: { color: '#706C7D', fontSize: 9, textAlign: 'center', width: 44 }, emptyTrend: { color: '#706C7D', fontSize: 13, fontStyle: 'italic', marginBottom: 28 },
  privateAiTestCard: { backgroundColor: '#F4F8FF', borderColor: '#BBD1F0', borderRadius: 16, borderStyle: 'dashed', borderWidth: 1, marginTop: 16, padding: 15 }, privateAiTestTitle: { color: '#294A82', fontSize: 16, fontWeight: '800' }, privateAiTestText: { color: '#526B91', fontSize: 12, lineHeight: 18, marginTop: 5 }, privateAiTestActions: { gap: 9, marginTop: 13 }, privateAiTestButton: { alignItems: 'center', borderRadius: 10, paddingVertical: 12 }, privateAiTestButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' }, privateAiTestSecondaryButton: { alignItems: 'center', backgroundColor: '#E0ECFC', borderRadius: 10, paddingVertical: 12 }, privateAiTestSecondaryText: { color: '#31599C', fontSize: 13, fontWeight: '800' }, privateAiTestError: { color: '#A43E36', fontSize: 12, lineHeight: 17, marginTop: 10 }, privateAiTestResult: { backgroundColor: '#FFFFFF', borderRadius: 11, marginTop: 13, padding: 12 }, privateAiTestResultTitle: { color: '#294A82', fontSize: 14, fontWeight: '800' }, privateAiTestResultText: { color: '#405A80', fontSize: 13, lineHeight: 19, marginTop: 5 }, privateAiTestBullet: { color: '#405A80', fontSize: 13, lineHeight: 19, marginTop: 4 }, privateAiConcept: { borderTopColor: '#E1EAF7', borderTopWidth: 1, marginTop: 10, paddingTop: 10 }, privateAiConceptName: { color: '#31599C', fontSize: 13, fontWeight: '800' },
  trendsTheme: { backgroundColor: '#EFF4FF' }, rangeRow: { flexDirection: 'row', gap: 7, marginBottom: 24 }, rangeButton: { alignItems: 'center', backgroundColor: '#D9E9FF', borderRadius: 11, flex: 1, paddingVertical: 11 }, rangeButtonSelected: { backgroundColor: '#3568B7' }, rangeButtonText: { color: '#31599C', fontSize: 12, fontWeight: '700' }, rangeButtonTextSelected: { color: '#FFFFFF' }, trendSummary: { color: '#647B9E', fontSize: 13, marginBottom: 14 }, breakdownTitle: { color: '#294A82', fontSize: 18, fontWeight: '700', marginBottom: 13 }, breakdownRow: { alignItems: 'center', flexDirection: 'row', marginBottom: 12 }, breakdownSwatch: { borderRadius: 5, height: 10, marginRight: 7, width: 10 }, breakdownLabel: { color: '#405A80', fontSize: 12, width: 72 }, breakdownTrack: { backgroundColor: '#DDE8F5', borderRadius: 5, flex: 1, height: 10, overflow: 'hidden' }, breakdownFill: { borderRadius: 5, height: '100%' }, breakdownValue: { color: '#405A80', fontSize: 12, fontWeight: '700', textAlign: 'right', width: 38 }, emptyState: { backgroundColor: '#DDEBFF', borderRadius: 16, padding: 18 }, emptyStateTitle: { color: '#294D86', fontSize: 16, fontWeight: '700', marginBottom: 5 }, emptyStateText: { color: '#537196', fontSize: 13, lineHeight: 19 }, weeklyAiCard: { backgroundColor: '#FFFFFF', borderColor: '#D8E3EF', borderRadius: 18, borderWidth: 1, padding: 17 }, weeklyAiTitle: { color: '#294A82', fontSize: 18, fontWeight: '800' }, weeklyAiText: { color: '#647B9E', fontSize: 13, lineHeight: 19, marginTop: 6 }, weeklyAiButton: { alignItems: 'center', borderRadius: 11, marginTop: 14, paddingVertical: 13 }, weeklyAiButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' }, weeklyAiError: { color: '#A43E36', fontSize: 12, lineHeight: 17, marginTop: 10 }, weeklyAiResult: { backgroundColor: '#F7FBFF', borderRadius: 12, marginTop: 16, padding: 14 }, weeklyAiResultTitle: { color: '#294A82', fontSize: 16, fontWeight: '800' }, weeklyAiOverview: { color: '#405A80', fontSize: 14, lineHeight: 20, marginTop: 7 }, weeklyAiSectionTitle: { color: '#31599C', fontSize: 13, fontWeight: '800', marginTop: 13 }, weeklyAiBullet: { color: '#405A80', fontSize: 13, lineHeight: 19, marginTop: 4 }, weeklyAiAffirmation: { color: '#294A82', fontSize: 13, fontStyle: 'italic', lineHeight: 19, marginTop: 14 }, weeklyAiSupport: { color: '#A43E36', fontSize: 13, fontWeight: '700', lineHeight: 19, marginTop: 12 }, demoJournalCard: { backgroundColor: '#FFF8E6', borderRadius: 17, marginTop: 16, padding: 17 }, demoJournalTitle: { color: '#705A22', fontSize: 16, fontWeight: '800' }, demoJournalText: { color: '#756947', fontSize: 13, lineHeight: 19, marginTop: 5 }, demoJournalActions: { alignItems: 'center', flexDirection: 'row', gap: 11, marginTop: 14 }, demoJournalButton: { alignItems: 'center', borderRadius: 10, flex: 1, paddingVertical: 11 }, demoJournalButtonText: { fontSize: 13, fontWeight: '800' }, demoRemoveButton: { alignItems: 'center', backgroundColor: '#FFF0EE', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11 }, demoRemoveText: { color: '#A43E36', fontSize: 12, fontWeight: '800' },
  natureScene: { alignItems: 'center', backgroundColor: '#DCEFE1', borderRadius: 18, height: 230, justifyContent: 'center', marginBottom: 26, overflow: 'hidden', padding: 12 }, natureSceneNight: { backgroundColor: '#DCE7F3' }, natureCaption: { color: '#315C48', fontSize: 15, fontWeight: '700', marginTop: 2, textAlign: 'center' }, natureCaptionNight: { color: '#3D5872' },
  quickEntryButton: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#DCD6F2', borderRadius: 18, borderWidth: 1, flexDirection: 'row', marginBottom: 16, padding: 15 }, quickEntryIcon: { alignItems: 'center', backgroundColor: '#EEE9FF', borderRadius: 22, height: 44, justifyContent: 'center', marginRight: 12, width: 44 }, quickEntryIconText: { color: '#5C4ABB', fontSize: 25 }, quickEntryCopy: { flex: 1 }, quickEntryTitle: { color: '#39334D', fontSize: 16, fontWeight: '700' }, quickEntryText: { color: '#706C7D', fontSize: 12, lineHeight: 17, marginTop: 3 }, quickEntryArrow: { color: '#6554C5', fontSize: 28, marginLeft: 8 },
  quickEntryHero: { alignItems: 'center', backgroundColor: '#ECE9FA', borderRadius: 20, marginBottom: 24, padding: 24 }, quickEntryHeroTitle: { color: '#39334D', fontSize: 20, fontWeight: '700', textAlign: 'center' }, quickEntryHeroText: { color: '#625D71', fontSize: 13, lineHeight: 19, marginTop: 7, textAlign: 'center' }, microphoneButton: { alignItems: 'center', backgroundColor: '#6554C5', borderRadius: 42, height: 84, justifyContent: 'center', marginTop: 22, width: 84 }, microphoneButtonActive: { backgroundColor: '#D94E4E' }, microphoneIcon: { color: '#FFFFFF', fontSize: 31 }, listeningText: { color: '#514593', fontSize: 13, fontWeight: '700', marginTop: 13 }, quickTranscriptLabel: { color: '#29243B', fontSize: 18, fontWeight: '700', marginBottom: 9 }, quickTranscriptInput: { backgroundColor: '#FFFFFF', borderColor: '#E2DFF0', borderRadius: 16, borderWidth: 1, color: '#29243B', fontSize: 16, lineHeight: 23, minHeight: 150, padding: 16 }, quickPrivacyText: { color: '#706C7D', fontSize: 12, lineHeight: 18, marginTop: 8 }, quickError: { color: '#A43E36', fontSize: 13, lineHeight: 19, marginTop: 12 },
  quickEntriesCard: { backgroundColor: '#FFFFFF', borderColor: '#E2DFF0', borderRadius: 16, borderWidth: 1, marginBottom: 28, padding: 16 }, quickEntriesTitle: { color: '#39334D', fontSize: 16, fontWeight: '700', marginBottom: 10 }, quickEntryRow: { borderTopColor: '#EEEAF5', borderTopWidth: 1, paddingVertical: 10 }, quickEntryTime: { color: '#6554C5', fontSize: 12, fontWeight: '700', marginBottom: 3 }, quickEntrySavedText: { color: '#514A63', fontSize: 14, lineHeight: 20 },
  entryHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, newPrompt: { color: '#3568B7', fontSize: 13, fontWeight: '700' }, prompt: { color: '#526C90', fontSize: 14, lineHeight: 20, marginBottom: 12, marginTop: 8 }, notebookPage: { backgroundColor: '#FFFEF8', borderColor: '#D5E1EF', borderRadius: 12, borderWidth: 1, minHeight: 260, overflow: 'hidden', position: 'relative' }, notebookRules: { bottom: 9, justifyContent: 'space-around', left: 0, position: 'absolute', right: 0, top: 9 }, notebookRule: { borderBottomColor: '#DDEAF6', borderBottomWidth: 1, marginLeft: 28 }, entryInput: { backgroundColor: 'transparent', color: '#2F4563', fontFamily: Platform.select({ android: 'cursive', ios: 'Noteworthy', default: 'cursive' }), fontSize: 18, lineHeight: 25, minHeight: 260, padding: 16, paddingRight: 42 }, writingPen: { color: '#567FAE', fontSize: 26, position: 'absolute', zIndex: 2 }, counter: { color: '#7186A7', fontSize: 11, marginTop: 5, textAlign: 'right' }, saveButton: { alignItems: 'center', backgroundColor: '#3568B7', borderRadius: 14, marginTop: 13, paddingVertical: 16 }, disabledButton: { opacity: 0.55 }, saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  entryDatePicker: { alignItems: 'center', backgroundColor: '#EFF4FF', borderRadius: 9, flexDirection: 'row', marginLeft: 8, paddingHorizontal: 9, paddingVertical: 8 }, entryDatePickerText: { color: '#315982', fontSize: 13, fontWeight: '700' }, entryDateChevron: { color: '#315982', fontSize: 17, marginLeft: 6 }, dateDropdown: { backgroundColor: '#FFFFFF', borderColor: '#D8E3EF', borderRadius: 15, borderWidth: 1, marginBottom: 20, padding: 12 }, dateDropdownTitle: { color: '#315982', fontSize: 13, fontWeight: '800', marginBottom: 7 }, dateDropdownScroll: { maxHeight: 220 }, dateOption: { borderRadius: 9, paddingHorizontal: 10, paddingVertical: 10 }, dateOptionSelected: { backgroundColor: '#E0EDFF' }, dateOptionText: { color: '#516784', fontSize: 13 }, dateOptionTextSelected: { color: '#294D86', fontWeight: '800' }, reflectionCard: { backgroundColor: '#FFFFFF', borderColor: '#D8E3EF', borderRadius: 17, borderWidth: 1, marginBottom: 0, padding: 14 }, reflectionTools: { flexDirection: 'row', gap: 9, marginTop: 11 }, reflectionTool: { alignItems: 'center', backgroundColor: '#EFF4FF', borderRadius: 10, flexDirection: 'row', justifyContent: 'center', paddingVertical: 10, width: 104 }, reflectionToolActive: { backgroundColor: '#D9F4F4' }, reflectionToolIcon: { color: '#3568B7', fontSize: 17, marginRight: 6 }, reflectionToolText: { color: '#315982', fontSize: 12, fontWeight: '800' }, inlinePhoto: { marginTop: 12 }, inlinePhotoPreview: { borderRadius: 11, height: 180, width: '100%' }, inlinePhotoActions: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8 }, inlinePhotoText: { color: '#70829A', fontSize: 12 }, voicePanel: { backgroundColor: '#F7FBFF', borderColor: '#D8E7F5', borderRadius: 12, borderWidth: 1, marginTop: 12, padding: 12 }, voicePanelHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, voicePanelTitle: { color: '#315982', fontSize: 14, fontWeight: '800' }, voicePanelHint: { color: '#70829A', fontSize: 11, marginTop: 2 }, smallMicrophoneButton: { alignItems: 'center', backgroundColor: '#3568B7', borderRadius: 19, height: 38, justifyContent: 'center', width: 38 }, smallMicrophoneIcon: { color: '#FFFFFF', fontSize: 17 }, voiceTranscriptInput: { backgroundColor: '#FFFFFF', borderColor: '#D8E3EF', borderRadius: 10, borderWidth: 1, color: '#35455F', fontSize: 14, lineHeight: 20, marginTop: 11, minHeight: 90, padding: 10 },
  controlsCard: { backgroundColor: '#FFFFFF', borderColor: '#D8E3EF', borderRadius: 16, borderWidth: 1, marginTop: 27, padding: 17 }, controlsTitle: { color: '#294A82', fontSize: 16, fontWeight: '700' }, controlsText: { color: '#647B9E', fontSize: 13, lineHeight: 19, marginTop: 5 }, controlButtons: { flexDirection: 'row', gap: 10, marginTop: 15 }, secondaryButton: { alignItems: 'center', backgroundColor: '#D9E9FF', borderRadius: 10, flex: 1, paddingVertical: 11 }, secondaryButtonText: { color: '#31599C', fontSize: 13, fontWeight: '700' }, deleteButton: { alignItems: 'center', backgroundColor: '#FFF0EE', borderRadius: 10, flex: 1, paddingVertical: 11 }, deleteButtonText: { color: '#A43E36', fontSize: 13, fontWeight: '700' }, deleteAllText: { color: '#A43E36', fontSize: 13, fontWeight: '700', marginTop: 17, textAlign: 'center' },
  calendarEntryDetails: { color: '#7186A7', fontSize: 11, fontWeight: '700', marginTop: 4 },
  themeChoices: { borderTopColor: '#E5ECF5', borderTopWidth: 1, paddingHorizontal: 12, paddingVertical: 8 }, themeChoice: { alignItems: 'center', borderColor: 'transparent', borderRadius: 10, borderWidth: 1, flexDirection: 'row', marginVertical: 3, paddingHorizontal: 9, paddingVertical: 8 }, themeSwatch: { borderRadius: 8, height: 16, marginRight: 9, width: 16 }, themeChoiceText: { color: '#405A80', fontSize: 13, fontWeight: '700' },
  streakHero: { alignItems: 'center', borderRadius: 24, marginBottom: 16, paddingHorizontal: 24, paddingVertical: 27 }, streakEmoji: { fontSize: 33, marginBottom: 3 }, streakNumber: { color: '#FFFFFF', fontSize: 54, fontWeight: '800', letterSpacing: -2 }, streakLabel: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' }, streakMessage: { color: '#E9F2FF', fontSize: 13, lineHeight: 19, marginTop: 10, textAlign: 'center' }, streakStatsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 }, streakStatCard: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#D8E3EF', borderRadius: 16, borderWidth: 1, flex: 1, paddingVertical: 18 }, streakStatValue: { fontSize: 27, fontWeight: '800' }, streakStatLabel: { color: '#647B9E', fontSize: 12, fontWeight: '700', marginTop: 4 }, streakWeekCard: { backgroundColor: '#FFFFFF', borderColor: '#D8E3EF', borderRadius: 17, borderWidth: 1, padding: 17 }, streakWeekTitle: { color: '#294A82', fontSize: 16, fontWeight: '800' }, streakWeekRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }, streakDay: { alignItems: 'center' }, streakDayDot: { alignItems: 'center', borderRadius: 18, height: 36, justifyContent: 'center', width: 36 }, streakDayMark: { fontSize: 16, fontWeight: '800' }, streakDayLabel: { color: '#7186A7', fontSize: 11, fontWeight: '700', marginTop: 7 }, streakWeekHint: { color: '#7186A7', fontSize: 11, lineHeight: 16, marginTop: 16, textAlign: 'center' }, streakGentleCard: { backgroundColor: '#FFF4EE', borderRadius: 16, marginTop: 18, padding: 17 }, streakGentleTitle: { color: '#613D2D', fontSize: 15, fontWeight: '800', marginBottom: 6 }, streakGentleText: { color: '#765D51', fontSize: 13, lineHeight: 19 },
  moodSettingsNotice: { backgroundColor: '#DDEBFF', borderRadius: 16, marginBottom: 22, padding: 16 }, moodSettingsNoticeTitle: { color: '#294D86', fontSize: 15, fontWeight: '800', marginBottom: 5 }, moodSettingsNoticeText: { color: '#537196', fontSize: 13, lineHeight: 19 }, moodSettingsTitle: { color: '#294A82', fontSize: 18, fontWeight: '800', marginBottom: 10 }, moodSettingsCard: { backgroundColor: '#FFFFFF', borderColor: '#D8E3EF', borderRadius: 15, borderWidth: 1, marginBottom: 12, padding: 13 }, moodSettingsTop: { alignItems: 'center', flexDirection: 'row' }, moodSettingsPreview: { alignItems: 'center', borderRadius: 14, height: 28, justifyContent: 'center', marginRight: 9, width: 28 }, moodNameInput: { borderBottomColor: '#D8E3EF', borderBottomWidth: 1, color: '#294A82', flex: 1, fontSize: 15, fontWeight: '700', paddingBottom: 6, paddingTop: 5 }, moodRemoveButton: { marginLeft: 10, paddingVertical: 8 }, moodRemoveText: { color: '#B94646', fontSize: 11, fontWeight: '800' }, colorChoiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 }, colorChoice: { borderColor: '#FFFFFF', borderRadius: 13, borderWidth: 2, height: 26, width: 26 }, colorChoiceSelected: { borderColor: '#294A82', borderWidth: 3, transform: [{ scale: 1.12 }] }, addMoodCard: { backgroundColor: '#FFFFFF', borderColor: '#D8E3EF', borderRadius: 16, borderWidth: 1, marginTop: 10, padding: 16 }, addMoodHint: { color: '#647B9E', fontSize: 13, lineHeight: 19, marginBottom: 12 }, newMoodInput: { backgroundColor: '#F7FBFF', borderColor: '#D8E3EF', borderRadius: 10, borderWidth: 1, color: '#294A82', fontSize: 15, paddingHorizontal: 12, paddingVertical: 11 }, addMoodButton: { alignItems: 'center', borderRadius: 12, marginTop: 18, paddingVertical: 13 }, addMoodButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  supportCard: { backgroundColor: '#FFF4EE', borderRadius: 16, marginTop: 28, padding: 17 }, supportTitle: { color: '#613D2D', fontSize: 15, fontWeight: '700', marginBottom: 6 }, supportText: { color: '#765D51', fontSize: 13, lineHeight: 19 },
});
