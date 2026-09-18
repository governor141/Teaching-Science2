# Teaching Science — Android App

An offline Android app for your Chemistry schemes of work (SS1–SS3, all three terms), with a PIN-locked, futuristic UI.

## What's inside
- **Splash screen** — your "Teaching Science" logo
- **PIN screen** — atom icon design; first launch lets you *create your own PIN*; a "Reset" option lets you set a new one later if you forget it
- **Home screen** — SS1 / SS2 / SS3 cards
- **Term screen** — First / Second / Third Term cards per class
- **Scheme of work screen** — full week-by-week breakdown from your file
- Everything runs **fully offline** — no internet needed once installed

## How the APK gets built (no Android Studio needed)
This project includes a GitHub Actions workflow (`.github/workflows/build-apk.yml`) that automatically builds the APK every time you push code to GitHub.

### Step 1 — Create a GitHub repository
1. Go to https://github.com and log in (or create a free account).
2. Click **New repository**. Name it e.g. `teaching-science-app`. Keep it Public or Private — either works. Don't add a README (we already have one).

### Step 2 — Upload this project
**Easiest way (no command line):**
1. Unzip the file I gave you.
2. On your new GitHub repo page, click **"uploading an existing file"**.
3. Drag the whole unzipped folder contents in and commit.

**Or with git, if you have it installed:**
```
cd TeachingScience
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/teaching-science-app.git
git push -u origin main
```

### Step 3 — Let GitHub build the APK
1. After pushing, go to the **Actions** tab on your GitHub repo.
2. You'll see a workflow run called **"Build APK"** — it starts automatically. Wait 2–5 minutes.
3. When it finishes (green checkmark), click into that run.
4. Scroll to **Artifacts** at the bottom and download **`TeachingScience-debug-apk`** — it's a zip containing your `.apk` file.

### Step 4 — Install on your phone
1. Copy the `.apk` file to your Android phone (via USB, WhatsApp to yourself, Google Drive, etc.).
2. Open it on your phone. You may need to allow "Install unknown apps" for the app you used to open the file — Android will prompt you for this the first time.
3. Tap Install, then open the app, set your PIN, and you're in.

## AI Lesson Note Generator (new!)
Every week's card in the scheme of work now has a **"Generate Lesson Note"** button.

### One-time setup
1. Open the app, tap the gear icon (top-right of the home screen) to go to **Settings**.
2. Choose your AI provider: **Gemini** (free, recommended) or **ChatGPT** (needs a funded OpenAI account).
   - Gemini key: go to `aistudio.google.com/apikey` on your phone or computer, sign in with a Google account, click **Create API key**.
   - OpenAI key: go to `platform.openai.com/api-keys`.
3. Paste that key into the matching field in Settings and tap **Save**. It's stored only on your phone. You can switch providers at any time — both keys are remembered separately.

### Using it
1. Go to a class → term → find a week → tap **Generate Lesson Note**.
2. The app sends the topic to your chosen AI and writes a full lesson note (objectives, content, evaluation, assignment) in the standard Nigerian secondary-school format.
3. From the result screen you can:
   - **Regenerate** if you want a different version
   - **Download TXT** or **Download CSV** — saved straight to your phone's Downloads folder
   - **Share** — opens Android's share sheet so you can send it straight to WhatsApp
   - **Ask a follow-up question** — a chat box right below the note. Type a question, or tap the mic icon to ask by voice (uses your phone's built-in speech recognition — Android will ask for microphone permission the first time).

This feature needs an internet connection; everything else in the app (browsing the scheme of work) still works fully offline.

Because this now calls the internet and the microphone, I've added the `INTERNET` and `RECORD_AUDIO` permissions to the app — Android will ask for these the first time, which is expected.

## Adding more subjects later
All the scheme-of-work content lives in one file:
`app/src/main/assets/www/data.js`

It's structured like this:
```js
const SCHEME_DATA = {
  "SS1": {
    "Chemistry": {
      "First Term": [ { "week": 1, "topic": "...", "content": "..." }, ... ],
      "Second Term": [ ... ],
      "Third Term": [ ... ]
    }
  },
  "SS2": { "Chemistry": { ... } },
  "SS3": { "Chemistry": { ... } }
}
```
When you share your other subjects (Physics, Biology, etc.), I can add them as new keys alongside `"Chemistry"` and wire up a subject-selector screen — just send me the files and I'll update this for you.

## Changing your PIN
Tap the lock icon (top-right of the home screen) to go back to the PIN screen, then tap **Reset** to create a new PIN.
