<div align="center">

<img src="https://socialify.git.ci/lyaxsh/VoidBox/image?custom_description=Telegram-Powered+Cloud+Storage+A+minimal%2C+secure%2C+and+privacy-friendly+file+%26+note+storage+web+app+built+on+top+of+Telegram.+Upload+files+or+notes+via+the+site%2C+instantly+sent+to+a+private+Telegram+channel+via+bot.+Metadata+is+safely+stored+in+Supabase.+Retrieve+your+data+anytime+with+just+a+click.&description=1&font=Rokkitt&language=1&name=1&owner=1&pattern=Transparent&theme=Dark" alt="VoidBox" width="640" height="360" />

# VoidBox
## Live at [v0idbox.vercel.app](https://v0idbox.vercel.app/)
<img src=https://voidbox-backend.fly.dev/api/public-proxy/23c43565 /><br>

VoidBox is a modern, privacy-focused file and note sharing platform. It allows users to upload, preview, and share files or text notes securely, with optional registration. Files are stored in a private Telegram channel, and all downloads are proxied through the backend for security. User libraries and metadata are managed via Supabase.

---


</div>

## 🚀 Features

### Basic
- **All File Uploads:** Instantly upload files (images, videos, documents, archives, text) with registration.
- **User Registration & Login:** Sign up, log in, and manage your own file library (powered by Supabase).
- **Drag & Drop Upload:** Drag files onto the upload area for quick sharing.
- **Text Drop:** Create and share text notes as easily as files.
- **File Library (“My Drops”):** View, filter, and manage all your uploaded files and notes in a personal library.
- **File Preview:** Preview images, videos, and text files directly in the browser.
- **Download & Share:** Download files or share secure links with others.
- **File Expiry:** Set files to expire after a certain date or number of days.
- **Delete Files:** Remove files or notes from your library at any time.
- **Dark/Light Theme Toggle:** Switch between beautiful dark and light modes.

### Advanced
- **Telegram Channel Storage:** Files are securely stored in a private Telegram channel via bot API, never exposing your bot token.
- **Backend Proxy for Downloads:** All downloads are proxied through the backend to hide storage details and protect secrets.
- **Supabase Integration:** User file metadata and notes are stored in Supabase for fast, reliable access.
- **Rate Limiting:** Built-in backend rate limiting to prevent abuse.
- **Abuse Reporting:** Users can flag files for abuse or policy violations.
- **ZIP Archive Support:** Upload, preview, and download ZIP files; list contents of ZIPs.
- **API Endpoints:** RESTful API for upload, download, file info, abuse reporting, and more.
- **CRON Cleanup:** Automated backend job to remove expired files.
- **Responsive UI:** Fully responsive design for mobile and desktop.
- **Policies & Info Pages:** Built-in pages for privacy, terms, and usage policies.
- **Vercel/Render/Railway Ready:** Easily deployable to popular cloud platforms.
- **Environment Variable Template:** `.env.example` provided for safe configuration.
- **Contact Support:** Directly contact support from the sidebar

---

## 🔮 Future Features

- [ ] **Google Auth:** OAuth integration with Google for seamless sign-in
- [ ] **Folder Support / Multiple Files:** Upload multiple files at once and organize them in folders
- [ ] **Multiple Bots:** Distribute load across multiple Telegram bots to manage rate limits
- [ ] **E2E Encryption:** End-to-end encryption for enhanced file security and privacy

---

## 🗂️ Project Structure

```
VoidBox/
├── backend/
│   ├── Dockerfile
│   ├── fly.toml
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── routes.ts         # Express routes (API endpoints)
│   │   ├── index.ts          # Server entry point
│   │   ├── telegram.ts       # Telegram API integration
│   │   ├── supabase.ts       # Supabase client
│   │   ├── schema.sql        # DB schema
│   │   ├── cron.ts           # CRON cleanup job
│   │   ├── db.ts             # DB connection
│   │   └── types.ts          # Type definitions
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tsconfig.app.json
│   ├── tsconfig.node.json
│   ├── index.html
│   ├── public/
│   │   ├── Light_Mode_MAIN.png
│   │   ├── Dark_Mode_MAIN.png
│   │   ├── light.png
│   │   └── dark.png
│   └── src/
│       ├── App.tsx
│       ├── main.tsx
│       ├── index.css
│       ├── components/
│       │   ├── FilePreviewPage.tsx
│       │   ├── TextDropPage.tsx
│       │   ├── LibraryPage.tsx
│       │   ├── UploadPage.tsx
│       │   ├── Sidebar.tsx
│       │   ├── LoginPage.tsx
│       │   ├── ProfileMenu.tsx
│       │   ├── HomePage.tsx
│       │   ├── PoliciesPage.tsx
│       │   └── ThemeToggle.tsx
│       ├── hooks/
│       ├── lib/
│       ├── types/
│       └── ...
├── .env.example
├── README.md
└── ...
```

---

## ⚙️ Setup & Installation

### Prerequisites
- Node.js (v18+ recommended)
- npm or yarn
- Supabase account (for user management and metadata)
- Telegram bot and private channel (for file storage)

### Environment Variables
Copy `.env.example` to `.env` and fill in your secrets:

```
VITE_SUPABASE_URL=xxxx
VITE_SUPABASE_ANON_KEY=xxxx
SUPABASE_DB_URL=xxxx
TELEGRAM_BOT_TOKEN=xxxx
TELEGRAM_CHANNEL_ID=xxxx
PORT=xxxx
NODE_ENV=xxxx
SUPABASE_URL=xxxx
SUPABASE_SERVICE_ROLE_KEY=xxxx
```

---

## 🏃 Running Locally

### Backend
```sh
cd backend
npm install
npm run build # or use ts-node for dev
npm start     # or: ts-node src/index.ts
```
- The backend will start on the port specified in your `.env` (default: 4000).

### Frontend
```sh
cd frontend
npm install
npm run dev
```
- The frontend will start on [http://localhost:5173](http://localhost:5173)
- Make sure the backend is running for API calls to work.

---

## 🚀 Deployment

### Deploy Backend
- **Docker:**
  - Build and run with the provided `Dockerfile`.
- **Fly.io / Railway / Render:**
  - Use `fly.toml` or your platform’s config.
  - Set all required environment variables in your deployment dashboard.
- **Supabase:**
  - Run `schema.sql` on your Supabase PostgreSQL instance.

### Deploy Frontend
- **Vercel / Netlify / Render:**
  - Set project root to `frontend/`.
  - Build command: `npm run build`
  - Output directory: `dist`
  - Set environment variables in your dashboard.

---

## 📚 API Endpoints

- `POST   /api/upload`           — Upload a file or note
- `GET    /api/file/:slug`       — Get file info
- `GET    /api/download/:slug`   — Download file (proxied)
- `GET    /api/mydrops`          — List user’s files/notes
- `GET    /api/zip-list/:slug`   — List contents of a ZIP file
- `GET    /api/note-content/:slug` — Get note content
- `POST   /api/flag`             — Report abuse
- `DELETE /api/mydrops/:slug`    — Delete a file/note

---

## 🤝 Contributing

- Pull requests are welcome! For major changes, open an issue first to discuss what you’d like to change.
- Please make sure to update tests as appropriate.
- For questions or feature requests, open an issue.

---

## 🏅 Credits

- Developed by [lyaxsh](https://www.github.com/lyaxsh) // [lakshnahar.forwork@gmail.com](mailto:lakshnahar.forwork@gmail.com)
- Assisted by [Bolt](https://www.bolt.new), [CursorAI](https://www.cursor.com/), [Chatgpt](https://www.chatgpt.com)

---

**Deployable to Railway, Render, Fly.io, or Vercel Functions.** 