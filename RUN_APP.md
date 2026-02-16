# Fix "localhost refused to connect"

You see this when **no server is running**. Do this once:

## 1. Install Node.js (required)

- Download: **https://nodejs.org** (LTS version)
- Run the installer and leave **"Add to PATH"** checked
- **Close and reopen** any terminal/PowerShell after installing

## 2. Setup (first time only)

In PowerShell or Command Prompt, from the project folder:

```powershell
cd "c:\Users\lukas\OneDrive\Desktop\crmRestaurant-main"
.\setup-missing.ps1
```

This installs backend dependencies and creates the database.

## 3. Start the app (one server = backend + frontend)

**Option A – Double‑click (easiest)**  
Double‑click **`run-one-server.bat`** in the project folder.  
Then open in your browser: **http://localhost:8000/core/index.html**

**Option B – From a new terminal**  
Open a **new** PowerShell or Command Prompt (so Node is on PATH), then:

```powershell
cd "c:\Users\lukas\OneDrive\Desktop\crmRestaurant-main\backend"
npm start
```

Then open: **http://localhost:8000/core/index.html**

## 4. Stop the app

Close the terminal window where the server is running (or press Ctrl+C in that window).

---

**One server:** The backend now serves the frontend too. You only need Node.js; Python is optional.  
**Two servers (optional):** Run `.\start-dev.ps1` for backend on 8000 + frontend on 3000 (needs Node; Python used if installed).
