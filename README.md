A Journalling app which uses AI to provide insights into your mood and energy levels.

How we used Codex and Chat GPT5.6

Every single line of code was written by Codex and ChatGPT5.6. Design of the app was driven by us but the coding was done by Codex. We used 5.6 Terra. Debugging of the code was also done by GPT5.6. We at each step  created iterations of our app using Codex until we got a final polished version .

Included in this app
A calendar: select any past date to create, edit, or view its entry
Connected to an AI agent to provide summary and analysis of your moods .
Color-coded feelings on the calendar: Very Low (black), Low (gray), Okay (yellow), Good/balanced (green), Really Good (blue), and Anxious (red). Customizable.
A saved 1–10 energy-level tracker and rotating reflection prompts
Ten gentle reflection prompts tailored to each feeling, plus a sleep entry
A separate Mood Trends screen with 7-entry, 30-entry, and 6-month filters, a category-by-date graph, and feeling percentages
Encrypted on-device storage using Expo SecureStore
Export-all, delete-one, and delete-all controls
Clear privacy and support language
Entries are stored separately in the device's protected secure storage. To stay within secure-storage limits across iOS and Android, each entry is capped at 1,500 characters. AI features need explicit user consent.


How to run our app :
 Link : https://mindjournal.languidlabs.com/
 App menu has a load test data which load 30 days of journalling data. You can use generate ai summary to generate a summary of your journal data. You can also summarize each entry and there is also a find concepts option which helps you find and learn different terms from your journal. Modify themes , customize feelings and colors assoicated with it .

Run it locally:
Install Node.js (LTS) and the Expo Go app on an iPhone or Android device.
Clone the repository: git clone https://github.com/ajstsubasa/MindJournal-AI.git
Open the project: cd MindJournal-AI
Install dependencies: npm ci
Start the app: npx expo start --tunnel
Scan the QR code using Expo Go.
Suggested demo flow
Tap + to create a reflection.
Choose or customize a mood and its calendar color.
Add a written reflection, energy level, sleep rating, and optional photo.
Open Calendar to revisit entries by date.
Open the top-left menu to view:
Mood trends
Your streak
Feelings & colors
Appearance themes
Export controls
