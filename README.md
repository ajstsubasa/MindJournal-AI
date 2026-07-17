# MindJournal AI

A calm, local-first mobile journaling starter built with Expo and React Native.

## Included in this starter

- A calendar: select any past date to create, edit, or view its entry
- Color-coded feelings on the calendar: Very Low (black), Low (gray), Okay (yellow), Good/balanced (green), Really Good (blue), and Anxious (red)
- A saved 1–10 energy-level tracker and rotating reflection prompts
- Ten gentle reflection prompts tailored to each feeling, plus a sleep-hours entry
- A separate Mood Trends screen with 7-entry, 30-entry, and 6-month filters, a category-by-date graph, and feeling percentages
- A focused journal-entry screen opened from the calendar, with a calm day/night nature scene
- Encrypted on-device storage using Expo SecureStore
- Export-all, delete-one, and delete-all controls
- Clear privacy and support language

Entries are stored separately in the device's protected secure storage. To stay within secure-storage limits across iOS and Android, each entry is capped at 1,500 characters. AI features are deliberately not enabled yet: they need a privacy design and explicit user consent.

## Run it

From this folder, install dependencies and start Expo:

```powershell
npm install
npx expo install expo-secure-store expo-file-system expo-sharing
npm start
```

Then open the project in Expo Go on a phone, or press `a` / `i` in the Expo terminal for an Android/iOS simulator.

## Safe next milestones

1. Add opt-in authentication and end-to-end encrypted backup only if needed.
2. Add reflection suggestions through a server-side AI integration—never place an API key in the app.
3. Create a clinically reviewed support and crisis-resource experience for each launch region.
