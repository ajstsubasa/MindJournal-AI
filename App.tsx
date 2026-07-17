import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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
import { JournalEntry, QuickEntry, loadEntries, removeAllEntries, removeEntry, saveEntry } from './src/storage';

type Mood = { color: string; label: string; textColor: string; value: number };
type Screen = 'home' | 'entry' | 'quick' | 'trends';
type TrendRange = 'seven' | 'thirty' | 'sixMonths';

let speechRecognition: typeof import('expo-speech-recognition') | null = null;
try {
  speechRecognition = require('expo-speech-recognition') as typeof import('expo-speech-recognition');
} catch {
  // Expo Go does not include this native module. Typed Quick Entries remain available.
}

const moods: Mood[] = [
  { color: '#181818', label: 'Very Low', textColor: '#FFFFFF', value: 1 },
  { color: '#9B9B9B', label: 'Low', textColor: '#1E1E1E', value: 2 },
  { color: '#F3CD4D', label: 'Okay', textColor: '#392F00', value: 3 },
  { color: '#50A66D', label: 'Good', textColor: '#FFFFFF', value: 4 },
  { color: '#4E85DF', label: 'Really Good', textColor: '#FFFFFF', value: 5 },
  { color: '#D94E4E', label: 'Anxious', textColor: '#FFFFFF', value: 6 },
];
const moodByValue = Object.fromEntries(moods.map((mood) => [mood.value, mood])) as Record<number, Mood>;
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

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function readableDate(key: string) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    .format(new Date(`${key}T12:00:00`));
}

function readableTime(iso: string) {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
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

type QuickEntrySpeechEventsProps = {
  onEnd: () => void;
  onError: (error: string) => void;
  onResult: (transcript: string) => void;
  onStart: () => void;
};

function QuickEntrySpeechEvents({ onEnd, onError, onResult, onStart }: QuickEntrySpeechEventsProps) {
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

export default function App() {
  const todayKey = useMemo(() => dateKey(new Date()), []);
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [displayMonth, setDisplayMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [entries, setEntries] = useState<Record<string, JournalEntry>>({});
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [sleepHours, setSleepHours] = useState('');
  const [content, setContent] = useState('');
  const [promptIndex, setPromptIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [screen, setScreen] = useState<Screen>('home');
  const [trendRange, setTrendRange] = useState<TrendRange>('seven');
  const [quickTranscript, setQuickTranscript] = useState('');
  const [quickError, setQuickError] = useState<string | null>(null);
  const [quickListening, setQuickListening] = useState(false);

  const existingEntry = entries[selectedDate];
  const activePrompts = selectedMood ? moodPrompts[selectedMood] : [];
  const activePrompt = activePrompts.length ? activePrompts[promptIndex % activePrompts.length] : 'Choose a feeling to receive a reflection prompt tailored to this moment.';
  const sortedMoodEntries = useMemo(
    () => Object.values(entries).filter((entry) => entry.mood !== null).sort((a, b) => a.date.localeCompare(b.date)),
    [entries],
  );
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
  const monthLabel = useMemo(
    () => new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(displayMonth),
    [displayMonth],
  );

  useEffect(() => {
    loadEntries()
      .then((loaded) => {
        setEntries(loaded);
        const saved = loaded[selectedDate];
        setSelectedMood(saved?.mood ?? null);
        setEnergy(saved?.energy ?? null);
        setSleepHours(saved?.sleepHours?.toString() ?? '');
        setContent(saved?.content ?? '');
      })
      .catch(() => Alert.alert('Could not load entries', 'Your saved entries could not be opened on this device.'))
      .finally(() => setIsLoading(false));
  }, []);

  function chooseDate(key: string) {
    setSelectedDate(key);
    const saved = entries[key];
    setSelectedMood(saved?.mood ?? null);
    setEnergy(saved?.energy ?? null);
    setSleepHours(saved?.sleepHours?.toString() ?? '');
    setContent(saved?.content ?? '');
    setScreen('entry');
  }

  async function saveSelectedEntry() {
    const trimmed = content.trim();
    if (!selectedMood && !trimmed) {
      Alert.alert('A gentle start', 'Choose a mood or write a few words before saving.');
      return;
    }
    if (trimmed.length > MAX_ENTRY_LENGTH) {
      Alert.alert('Entry is a little long', `For secure device storage, keep each entry under ${MAX_ENTRY_LENGTH} characters.`);
      return;
    }
    const parsedSleep = sleepHours.trim() ? Number(sleepHours) : null;
    if (parsedSleep !== null && (!Number.isFinite(parsedSleep) || parsedSleep < 0 || parsedSleep > 24)) {
      Alert.alert('Check sleep hours', 'Enter a number from 0 to 24, such as 7.5.');
      return;
    }

    const item: JournalEntry = { date: selectedDate, mood: selectedMood, energy, sleepHours: parsedSleep, content: trimmed, quickEntries: existingEntry?.quickEntries ?? [], updatedAt: new Date().toISOString() };
    try {
      setIsSaving(true);
      await saveEntry(item);
      setEntries((current) => ({ ...current, [selectedDate]: item }));
      Alert.alert('Entry saved', `Your reflection for ${readableDate(selectedDate)} is encrypted on this device.`);
    } catch {
      Alert.alert('Entry was not saved', 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  function openQuickEntry() {
    setQuickTranscript('');
    setQuickError(null);
    setScreen('quick');
  }

  function closeQuickEntry() {
    if (quickListening) speechRecognition?.ExpoSpeechRecognitionModule.abort();
    setQuickListening(false);
    setScreen('home');
  }

  async function startQuickEntry() {
    setQuickError(null);
    if (!speechRecognition) {
      setQuickError('Voice entry needs a development build. You can still type a quick entry here.');
      return;
    }
    const { ExpoSpeechRecognitionModule } = speechRecognition;
    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
      setQuickError('Speech recognition is not available on this device. You can still type a quick entry.');
      return;
    }
    if (!ExpoSpeechRecognitionModule.supportsOnDeviceRecognition()) {
      setQuickError('On-device speech recognition is not available on this device. You can still type a quick entry.');
      return;
    }
    const permission = await ExpoSpeechRecognitionModule.requestMicrophonePermissionsAsync();
    if (!permission.granted) {
      setQuickError('Microphone permission is needed to create a voice entry. You can still type one below.');
      return;
    }
    ExpoSpeechRecognitionModule.start({
      addsPunctuation: true,
      contextualStrings: ['anxious', 'feeling low', 'feeling good', 'mood', 'MindJournal'],
      continuous: false,
      interimResults: true,
      iosTaskHint: 'dictation',
      lang: 'en-US',
      requiresOnDeviceRecognition: true,
    });
  }

  function stopQuickEntry() {
    speechRecognition?.ExpoSpeechRecognitionModule.stop();
  }

  async function saveQuickEntry() {
    const text = quickTranscript.trim();
    if (!text) {
      setQuickError('Say a few words, or type your quick entry before saving.');
      return;
    }
    const now = new Date().toISOString();
    const current = entries[todayKey];
    const quickEntry: QuickEntry = { createdAt: now, id: now, text };
    const item: JournalEntry = {
      content: current?.content ?? '',
      date: todayKey,
      energy: current?.energy ?? null,
      mood: current?.mood ?? null,
      quickEntries: [...(current?.quickEntries ?? []), quickEntry],
      sleepHours: current?.sleepHours ?? null,
      updatedAt: now,
    };
    try {
      setIsSaving(true);
      await saveEntry(item);
      setEntries((saved) => ({ ...saved, [todayKey]: item }));
      setSelectedDate(todayKey);
      setScreen('home');
      Alert.alert('Quick entry saved', `${readableTime(now)}: ${text}`);
    } catch {
      setQuickError('Your quick entry was not saved. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  function deleteSelectedEntry() {
    if (!existingEntry) return;
    Alert.alert('Delete this entry?', 'This will permanently remove the selected entry from this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await removeEntry(selectedDate);
            setEntries((current) => {
              const updated = { ...current };
              delete updated[selectedDate];
              return updated;
            });
            setContent('');
            setSelectedMood(null);
            setEnergy(null);
            setSleepHours('');
          } catch {
            Alert.alert('Could not delete entry', 'Please try again.');
          }
        },
      },
    ]);
  }

  async function exportEntries() {
    const allEntries = Object.values(entries).sort((a, b) => a.date.localeCompare(b.date));
    if (!allEntries.length) {
      Alert.alert('Nothing to export', 'Save at least one reflection first.');
      return;
    }
    try {
      const path = `${FileSystem.cacheDirectory}MindJournalAI-export-${dateKey(new Date())}.json`;
      const exportText = JSON.stringify({ exportedAt: new Date().toISOString(), entries: allEntries }, null, 2);
      await FileSystem.writeAsStringAsync(path, exportText, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: 'Export MindJournal AI entries' });
      } else {
        Alert.alert('Export created', 'Your device does not support the share sheet, so the private export remains in the app cache.');
      }
    } catch {
      Alert.alert('Could not export entries', 'Please try again.');
    }
  }

  function deleteAll() {
    if (!Object.keys(entries).length) return;
    Alert.alert('Delete all entries?', 'This permanently removes every MindJournal AI entry from this device. Consider exporting first.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete all', style: 'destructive', onPress: async () => {
          try {
            await removeAllEntries();
            setEntries({});
            setContent('');
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
    return <SafeAreaView style={[styles.safeArea, styles.loading]}><ActivityIndicator color="#6554C5" size="large" /></SafeAreaView>;
  }

  if (screen === 'trends') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <View><Text style={styles.brand}>Mood <Text style={styles.brandAccent}>trends</Text></Text><Text style={styles.date}>Patterns from your saved check-ins</Text></View>
            <Pressable accessibilityLabel="Back to calendar" onPress={() => setScreen('home')} style={styles.backButton}><Text style={styles.backButtonText}>Back</Text></Pressable>
          </View>
          <View style={styles.rangeRow}>
            <Pressable onPress={() => setTrendRange('seven')} style={[styles.rangeButton, trendRange === 'seven' && styles.rangeButtonSelected]}><Text style={[styles.rangeButtonText, trendRange === 'seven' && styles.rangeButtonTextSelected]}>7 entries</Text></Pressable>
            <Pressable onPress={() => setTrendRange('thirty')} style={[styles.rangeButton, trendRange === 'thirty' && styles.rangeButtonSelected]}><Text style={[styles.rangeButtonText, trendRange === 'thirty' && styles.rangeButtonTextSelected]}>30 entries</Text></Pressable>
            <Pressable onPress={() => setTrendRange('sixMonths')} style={[styles.rangeButton, trendRange === 'sixMonths' && styles.rangeButtonSelected]}><Text style={[styles.rangeButtonText, trendRange === 'sixMonths' && styles.rangeButtonTextSelected]}>6 months</Text></Pressable>
          </View>
          {trendEntries.length ? <>
            <Text style={styles.trendSummary}>Based on {trendEntries.length} mood-tracked day{trendEntries.length === 1 ? '' : 's'}.</Text>
            <View accessibilityLabel="Mood trend graph showing feeling categories by date" style={styles.trendChart}>
              <View style={styles.trendLabels}>{[...moods].reverse().map((mood) => <Text key={mood.value} style={styles.trendLabel}>{mood.label}</Text>)}</View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trendColumns}>{trendEntries.map((entry) => <View key={entry.date} style={styles.trendColumn}>{[...moods].reverse().map((mood) => <View key={mood.value} style={styles.trendCell}>{entry.mood === mood.value && <View style={[styles.trendDot, { backgroundColor: mood.color }]} />}</View>)}<Text style={styles.trendDate}>{entry.date.slice(5).replace('-', '/')}</Text></View>)}</ScrollView>
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

  return (
    <SafeAreaView style={[styles.safeArea, screen === 'entry' && (isNight ? styles.entryNight : styles.entryDay)]}>
      <StatusBar barStyle="dark-content" />
      <QuickEntrySpeechEvents
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
            <View><Text style={[styles.brand, screen === 'entry' && isNight && styles.entryTextLight]}>MindJournal <Text style={styles.brandAccent}>AI</Text></Text><Text style={[styles.date, screen === 'entry' && isNight && styles.entryDateLight]}>{screen === 'entry' ? readableDate(selectedDate) : screen === 'quick' ? `Quick entry for ${readableDate(todayKey)}` : 'Private reflection, on your terms'}</Text></View>
            {screen === 'home' ? <Pressable accessibilityLabel="View mood trends" onPress={() => setScreen('trends')} style={styles.trendsButton}><Text style={styles.trendsButtonText}>Mood trends</Text></Pressable> : <Pressable accessibilityLabel="Back to calendar" onPress={screen === 'quick' ? closeQuickEntry : () => setScreen('home')} style={styles.backButton}><Text style={styles.backButtonText}>Back</Text></Pressable>}
          </View>

          {screen === 'home' && <>
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>Private by default</Text>
            <Text style={styles.noticeText}>Entries are encrypted using this device’s secure storage. Exporting is always your choice.</Text>
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
              const savedEntry = entries[key];
              const entryMood = savedEntry?.mood ? moodByValue[savedEntry.mood] : null;
              return <Pressable key={key} disabled={isFuture} onPress={() => chooseDate(key)} style={[styles.dayCell, entryMood && { backgroundColor: entryMood.color }, isSelected && !entryMood && styles.daySelected, isSelected && styles.daySelectedOutline, isFuture && styles.dayFuture]}><Text style={[styles.dayNumber, entryMood && { color: entryMood.textColor }, isSelected && !entryMood && styles.dayNumberSelected]}>{date.getDate()}</Text>{savedEntry && !entryMood && <View style={styles.entryDot} />}</Pressable>;
            })}
          </View>
          <Text style={styles.selectedDate}>{readableDate(selectedDate)} {existingEntry ? '— saved entry' : '— new entry'}</Text>
          <Pressable accessibilityHint="Creates a private timestamped voice note for today" accessibilityLabel="Create a quick voice entry" onPress={openQuickEntry} style={styles.quickEntryButton}>
            <View style={styles.quickEntryIcon}><Text style={styles.quickEntryIconText}>●</Text></View>
            <View style={styles.quickEntryCopy}><Text style={styles.quickEntryTitle}>Quick entry</Text><Text style={styles.quickEntryText}>Say what is on your mind. It saves as a separate note.</Text></View>
            <Text style={styles.quickEntryArrow}>›</Text>
          </Pressable>

          </>}

          {screen === 'quick' && <>
          <View style={styles.quickEntryHero}>
            <Text style={styles.quickEntryHeroTitle}>A small moment, captured.</Text>
            <Text style={styles.quickEntryHeroText}>Your audio is not stored. When available, transcription stays on your device.</Text>
            <Pressable accessibilityLabel={quickListening ? 'Stop listening' : 'Start listening'} onPress={quickListening ? stopQuickEntry : startQuickEntry} style={[styles.microphoneButton, quickListening && styles.microphoneButtonActive]}>
              <Text style={styles.microphoneIcon}>{quickListening ? '■' : '●'}</Text>
            </Pressable>
            <Text style={styles.listeningText}>{quickListening ? 'Listening… say a few words' : 'Tap the microphone to speak'}</Text>
          </View>
          <Text style={styles.quickTranscriptLabel}>Your quick entry</Text>
          <TextInput accessibilityLabel="Quick journal entry" maxLength={280} multiline onChangeText={setQuickTranscript} placeholder="How are you feeling?" placeholderTextColor="#8E8A9B" style={styles.quickTranscriptInput} textAlignVertical="top" value={quickTranscript} />
          <Text style={styles.quickPrivacyText}>Only the text you save is added to your encrypted journal. No audio is retained.</Text>
          {quickError && <Text style={styles.quickError}>{quickError}</Text>}
          <Pressable accessibilityRole="button" disabled={isSaving} onPress={saveQuickEntry} style={[styles.saveButton, isSaving && styles.disabledButton]}><Text style={styles.saveButtonText}>{isSaving ? 'Saving…' : 'Save quick entry'}</Text></Pressable>
          </>}

          {screen === 'entry' && <>
          <View style={[styles.natureScene, isNight && styles.natureSceneNight]}>
            <GirlWaving />
            <Text style={[styles.natureCaption, isNight && styles.natureCaptionNight]}>Your feelings are welcome here.</Text>
          </View>
          <Text style={styles.title}>How are you feeling?</Text>
          <Text style={styles.subtitle}>There is no right answer.</Text>
          <View style={styles.moodRow}>
            {moods.map((mood) => <Pressable accessibilityLabel={`${mood.label} mood`} accessibilityRole="button" key={mood.value} onPress={() => { setSelectedMood(mood.value); setPromptIndex(0); }} style={[styles.moodButton, selectedMood === mood.value && { borderColor: mood.color, borderWidth: 2 }]}><View style={[styles.moodColor, { backgroundColor: mood.color }]} /><Text style={styles.moodLabel}>{mood.label}</Text></Pressable>)}
          </View>

          <View style={styles.energyHeader}><Text style={styles.title}>Energy level</Text><Text style={styles.energyValue}>{energy ? `${energy}/10` : 'Choose 1–10'}</Text></View>
          <Text style={styles.subtitle}>How much energy do you have today?</Text>
          <View style={styles.energyRow}>
            {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => <Pressable accessibilityLabel={`Energy level ${value}`} accessibilityRole="button" key={value} onPress={() => setEnergy(value)} style={[styles.energyButton, energy === value && styles.energyButtonSelected]}><Text style={[styles.energyButtonText, energy === value && styles.energyButtonTextSelected]}>{value}</Text></Pressable>)}
          </View>

          <View style={styles.sleepHeader}><Text style={styles.title}>Sleep</Text><Text style={styles.sleepUnit}>hours last night</Text></View>
          <TextInput accessibilityLabel="Hours slept last night" keyboardType="decimal-pad" maxLength={4} onChangeText={setSleepHours} placeholder="e.g. 7.5" placeholderTextColor="#8E8A9B" style={styles.sleepInput} value={sleepHours} />

          {(existingEntry?.quickEntries ?? []).length > 0 && <View style={styles.quickEntriesCard}>
            <Text style={styles.quickEntriesTitle}>Quick entries</Text>
            {(existingEntry?.quickEntries ?? []).map((quickEntry) => <View key={quickEntry.id} style={styles.quickEntryRow}><Text style={styles.quickEntryTime}>{readableTime(quickEntry.createdAt)}</Text><Text style={styles.quickEntrySavedText}>{quickEntry.text}</Text></View>)}
          </View>}

          <View style={styles.entryHeader}><Text style={styles.title}>A space to reflect</Text>{activePrompts.length > 0 && <Pressable onPress={() => setPromptIndex((current) => (current + 1) % activePrompts.length)}><Text style={styles.newPrompt}>New prompt</Text></Pressable>}</View>
          <Text style={styles.prompt}>{activePrompt}</Text>
          <TextInput accessibilityLabel="Journal entry" maxLength={MAX_ENTRY_LENGTH} multiline onChangeText={setContent} placeholder="Write anything that is on your mind..." placeholderTextColor="#8E8A9B" style={styles.entryInput} textAlignVertical="top" value={content} />
          <Text style={styles.counter}>{content.length}/{MAX_ENTRY_LENGTH}</Text>
          <Pressable accessibilityRole="button" disabled={isSaving} onPress={saveSelectedEntry} style={[styles.saveButton, isSaving && styles.disabledButton]}><Text style={styles.saveButtonText}>{isSaving ? 'Saving…' : existingEntry ? 'Update reflection' : 'Save reflection'}</Text></Pressable>

          <View style={styles.controlsCard}>
            <Text style={styles.controlsTitle}>Your data</Text>
            <Text style={styles.controlsText}>Exports are readable files—only share them somewhere you trust.</Text>
            <View style={styles.controlButtons}>
              <Pressable onPress={exportEntries} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Export all</Text></Pressable>
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
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 22 }, brand: { color: '#29243B', fontSize: 24, fontWeight: '700', letterSpacing: -0.6 }, brandAccent: { color: '#6B5AD6' }, date: { color: '#706C7D', fontSize: 14, marginTop: 3 }, lock: { alignItems: 'center', backgroundColor: '#EAE6FF', borderRadius: 20, height: 40, justifyContent: 'center', width: 40 }, lockText: { color: '#5949B7', fontSize: 9, fontWeight: '800' }, trendsButton: { backgroundColor: '#6554C5', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }, trendsButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' }, backButton: { backgroundColor: '#EAE6FF', borderRadius: 12, paddingHorizontal: 13, paddingVertical: 10 }, backButtonText: { color: '#514593', fontSize: 12, fontWeight: '700' },
  notice: { backgroundColor: '#ECE9FA', borderRadius: 16, marginBottom: 28, padding: 16 }, noticeTitle: { color: '#39334D', fontSize: 15, fontWeight: '700', marginBottom: 5 }, noticeText: { color: '#625D71', fontSize: 13, lineHeight: 19 },
  title: { color: '#29243B', fontSize: 20, fontWeight: '700', letterSpacing: -0.3 }, subtitle: { color: '#706C7D', fontSize: 14, marginTop: 5 }, calendarHeader: { marginBottom: 13 }, monthControls: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }, monthButton: { alignItems: 'center', backgroundColor: '#ECE9FA', borderRadius: 15, height: 30, justifyContent: 'center', width: 30 }, monthButtonText: { color: '#514593', fontSize: 25, lineHeight: 28 }, monthLabel: { color: '#514A63', fontSize: 14, fontWeight: '700' }, weekRow: { flexDirection: 'row', marginBottom: 6 }, weekday: { color: '#817C91', fontSize: 11, fontWeight: '700', textAlign: 'center', width: '14.285%' }, calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 11 }, dayCell: { alignItems: 'center', borderRadius: 13, height: 42, justifyContent: 'center', marginVertical: 1, width: '14.285%' }, daySelected: { backgroundColor: '#6554C5' }, daySelectedOutline: { borderColor: '#29243B', borderWidth: 2 }, dayFuture: { opacity: 0.3 }, dayNumber: { color: '#443D51', fontSize: 14, fontWeight: '600' }, dayNumberSelected: { color: '#FFFFFF' }, entryDot: { backgroundColor: '#6554C5', borderRadius: 3, bottom: 5, height: 5, position: 'absolute', width: 5 }, selectedDate: { color: '#6554C5', fontSize: 13, fontWeight: '700', marginBottom: 25, textAlign: 'center' },
  moodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 27, marginTop: 15 }, moodButton: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#E2DFF0', borderRadius: 13, borderWidth: 1, flexDirection: 'row', minHeight: 44, paddingHorizontal: 10, width: '31%' }, moodColor: { borderRadius: 6, height: 12, marginRight: 7, width: 12 }, moodLabel: { color: '#514A63', fontSize: 11, fontWeight: '700', flexShrink: 1 }, energyHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, energyValue: { color: '#6554C5', fontSize: 13, fontWeight: '700' }, energyRow: { flexDirection: 'row', gap: 4, marginBottom: 30, marginTop: 15 }, energyButton: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#E2DFF0', borderRadius: 8, borderWidth: 1, flex: 1, paddingVertical: 10 }, energyButtonSelected: { backgroundColor: '#6554C5', borderColor: '#6554C5' }, energyButtonText: { color: '#514A63', fontSize: 12, fontWeight: '700' }, energyButtonTextSelected: { color: '#FFFFFF' },
  sleepHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, sleepUnit: { color: '#706C7D', fontSize: 13 }, sleepInput: { backgroundColor: '#FFFFFF', borderColor: '#E2DFF0', borderRadius: 12, borderWidth: 1, color: '#29243B', fontSize: 16, marginBottom: 28, marginTop: 10, paddingHorizontal: 14, paddingVertical: 13 }, trendChart: { flexDirection: 'row', marginBottom: 28 }, trendLabels: { justifyContent: 'space-between', paddingBottom: 23, width: 76 }, trendLabel: { color: '#706C7D', fontSize: 10, height: 28, textAlign: 'right' }, trendColumns: { flexDirection: 'row', paddingRight: 3 }, trendColumn: { alignItems: 'center', minWidth: 38 }, trendCell: { alignItems: 'center', borderBottomColor: '#E2DFF0', borderBottomWidth: 1, height: 28, justifyContent: 'center', width: '100%' }, trendDot: { borderRadius: 7, height: 14, width: 14 }, trendDate: { color: '#706C7D', fontSize: 9, marginTop: 5 }, emptyTrend: { color: '#706C7D', fontSize: 13, fontStyle: 'italic', marginBottom: 28 },
  rangeRow: { flexDirection: 'row', gap: 7, marginBottom: 24 }, rangeButton: { alignItems: 'center', backgroundColor: '#EAE6FF', borderRadius: 11, flex: 1, paddingVertical: 11 }, rangeButtonSelected: { backgroundColor: '#6554C5' }, rangeButtonText: { color: '#514593', fontSize: 12, fontWeight: '700' }, rangeButtonTextSelected: { color: '#FFFFFF' }, trendSummary: { color: '#706C7D', fontSize: 13, marginBottom: 14 }, breakdownTitle: { color: '#29243B', fontSize: 18, fontWeight: '700', marginBottom: 13 }, breakdownRow: { alignItems: 'center', flexDirection: 'row', marginBottom: 12 }, breakdownSwatch: { borderRadius: 5, height: 10, marginRight: 7, width: 10 }, breakdownLabel: { color: '#514A63', fontSize: 12, width: 72 }, breakdownTrack: { backgroundColor: '#E2DFF0', borderRadius: 5, flex: 1, height: 10, overflow: 'hidden' }, breakdownFill: { borderRadius: 5, height: '100%' }, breakdownValue: { color: '#514A63', fontSize: 12, fontWeight: '700', textAlign: 'right', width: 38 }, emptyState: { backgroundColor: '#ECE9FA', borderRadius: 16, padding: 18 }, emptyStateTitle: { color: '#39334D', fontSize: 16, fontWeight: '700', marginBottom: 5 }, emptyStateText: { color: '#625D71', fontSize: 13, lineHeight: 19 },
  natureScene: { alignItems: 'center', backgroundColor: '#DCEFE1', borderRadius: 18, height: 230, justifyContent: 'center', marginBottom: 26, overflow: 'hidden', padding: 12 }, natureSceneNight: { backgroundColor: '#DCE7F3' }, natureCaption: { color: '#315C48', fontSize: 15, fontWeight: '700', marginTop: 2, textAlign: 'center' }, natureCaptionNight: { color: '#3D5872' },
  quickEntryButton: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#DCD6F2', borderRadius: 18, borderWidth: 1, flexDirection: 'row', marginBottom: 16, padding: 15 }, quickEntryIcon: { alignItems: 'center', backgroundColor: '#EEE9FF', borderRadius: 22, height: 44, justifyContent: 'center', marginRight: 12, width: 44 }, quickEntryIconText: { color: '#5C4ABB', fontSize: 25 }, quickEntryCopy: { flex: 1 }, quickEntryTitle: { color: '#39334D', fontSize: 16, fontWeight: '700' }, quickEntryText: { color: '#706C7D', fontSize: 12, lineHeight: 17, marginTop: 3 }, quickEntryArrow: { color: '#6554C5', fontSize: 28, marginLeft: 8 },
  quickEntryHero: { alignItems: 'center', backgroundColor: '#ECE9FA', borderRadius: 20, marginBottom: 24, padding: 24 }, quickEntryHeroTitle: { color: '#39334D', fontSize: 20, fontWeight: '700', textAlign: 'center' }, quickEntryHeroText: { color: '#625D71', fontSize: 13, lineHeight: 19, marginTop: 7, textAlign: 'center' }, microphoneButton: { alignItems: 'center', backgroundColor: '#6554C5', borderRadius: 42, height: 84, justifyContent: 'center', marginTop: 22, width: 84 }, microphoneButtonActive: { backgroundColor: '#D94E4E' }, microphoneIcon: { color: '#FFFFFF', fontSize: 31 }, listeningText: { color: '#514593', fontSize: 13, fontWeight: '700', marginTop: 13 }, quickTranscriptLabel: { color: '#29243B', fontSize: 18, fontWeight: '700', marginBottom: 9 }, quickTranscriptInput: { backgroundColor: '#FFFFFF', borderColor: '#E2DFF0', borderRadius: 16, borderWidth: 1, color: '#29243B', fontSize: 16, lineHeight: 23, minHeight: 150, padding: 16 }, quickPrivacyText: { color: '#706C7D', fontSize: 12, lineHeight: 18, marginTop: 8 }, quickError: { color: '#A43E36', fontSize: 13, lineHeight: 19, marginTop: 12 },
  quickEntriesCard: { backgroundColor: '#FFFFFF', borderColor: '#E2DFF0', borderRadius: 16, borderWidth: 1, marginBottom: 28, padding: 16 }, quickEntriesTitle: { color: '#39334D', fontSize: 16, fontWeight: '700', marginBottom: 10 }, quickEntryRow: { borderTopColor: '#EEEAF5', borderTopWidth: 1, paddingVertical: 10 }, quickEntryTime: { color: '#6554C5', fontSize: 12, fontWeight: '700', marginBottom: 3 }, quickEntrySavedText: { color: '#514A63', fontSize: 14, lineHeight: 20 },
  entryHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, newPrompt: { color: '#6554C5', fontSize: 13, fontWeight: '700' }, prompt: { color: '#625D71', fontSize: 14, lineHeight: 20, marginBottom: 12, marginTop: 8 }, entryInput: { backgroundColor: '#FFFFFF', borderColor: '#E2DFF0', borderRadius: 16, borderWidth: 1, color: '#29243B', fontSize: 16, lineHeight: 24, minHeight: 260, padding: 16 }, counter: { color: '#817C91', fontSize: 11, marginTop: 5, textAlign: 'right' }, saveButton: { alignItems: 'center', backgroundColor: '#6554C5', borderRadius: 14, marginTop: 13, paddingVertical: 16 }, disabledButton: { opacity: 0.55 }, saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  controlsCard: { backgroundColor: '#FFFFFF', borderColor: '#E2DFF0', borderRadius: 16, borderWidth: 1, marginTop: 27, padding: 17 }, controlsTitle: { color: '#39334D', fontSize: 16, fontWeight: '700' }, controlsText: { color: '#706C7D', fontSize: 13, lineHeight: 19, marginTop: 5 }, controlButtons: { flexDirection: 'row', gap: 10, marginTop: 15 }, secondaryButton: { alignItems: 'center', backgroundColor: '#E9E5FF', borderRadius: 10, flex: 1, paddingVertical: 11 }, secondaryButtonText: { color: '#4B3DA7', fontSize: 13, fontWeight: '700' }, deleteButton: { alignItems: 'center', backgroundColor: '#FFF0EE', borderRadius: 10, flex: 1, paddingVertical: 11 }, deleteButtonText: { color: '#A43E36', fontSize: 13, fontWeight: '700' }, deleteAllText: { color: '#A43E36', fontSize: 13, fontWeight: '700', marginTop: 17, textAlign: 'center' },
  supportCard: { backgroundColor: '#FFF4EE', borderRadius: 16, marginTop: 28, padding: 17 }, supportTitle: { color: '#613D2D', fontSize: 15, fontWeight: '700', marginBottom: 6 }, supportText: { color: '#765D51', fontSize: 13, lineHeight: 19 },
});
