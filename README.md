# Stream Compass 🧭🎬

> **The Intelligent Streaming Decision Engine**  
> Never spend 45 minutes deciding what to watch again.

Stream Compass is an intelligent streaming recommendation engine and decision platform designed to solve choice paralysis. Instead of presenting endless algorithm-biased carousels, it delivers curated **Decision Triads** (Best Match, Safe Choice, Wildcard) calibrated against your real-time mood, available time, viewing company, and evolving Taste DNA.

---

## ✨ Key Features

- **Context-Aware Decision Engine**: Calibrate recommendations based on available runtime, current mood (*Chill, Mind-Bending, High Octane, Dark Suspense, Feel-Good, Deep Drama*), format (*Movie or Series*), and cinema origin (*Bollywood/Indian or Hollywood/Global*).
- **The Decision Triad**:
  - **Best Match**: Tailored to your immediate mood, context constraints, and rating history.
  - **Safe Choice**: Acclaimed, consensus crowd-pleaser with minimal risk.
  - **Wildcard**: Adventurous departure outside your usual habits that still connects with the vibe.
- **Deep Watch Availability Integration**: Direct legal watch deep links to stream titles instantly on **Netflix**, **Amazon Prime Video**, and **Disney+ Hotstar**.
- **Group Mode (Watch Together)**: Invite friends into a collaborative session. Computes harmonic consensus scores, bridges divergent taste profiles with smart compromise choices, and strictly excludes titles already watched by *any* member in the room.
- **Taste DNA & Library**: Track watched titles, log subjective rating rationales, and build an evolving visual profile of your genre affinities.
- **Direct Catalog Search & TMDB Sync**: Search across hundreds of movies and series with live posters and metadata.

---

## 🛠️ Tech Stack

### Backend
- **Framework**: Python 3.11+ / FastAPI
- **Database**: SQLite (local) / PostgreSQL-ready SQLAlchemy ORM
- **Security**: JWT authentication (OAuth2 with password hashing via passlib/bcrypt)
- **External Integration**: TMDB API for live catalog syncing and high-resolution posters

### Frontend
- **Framework**: React 18 / Vite / TypeScript
- **Styling**: Tailwind CSS with custom Obsidian dark theme and micro-interactions
- **Icons**: Lucide React
- **Routing**: React Router DOM v6

---

## 🚀 Getting Started

### 1. Clone the Repository
```bash
git clone https://github.com/<your-username>/compassapp.git
cd compassapp
```

### 2. Backend Setup
```bash
cd backend

# Create and activate virtual environment
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Open .env and add your TMDB_API_KEY (optional but recommended)

# Run database migrations / development server
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
Backend API will be live at `http://127.0.0.1:8000`. Swagger API documentation is available at `http://127.0.0.1:8000/docs`.

### 3. Frontend Setup
```bash
cd ../frontend

# Install packages
npm install

# Start Vite development server
npm run dev
```
Frontend will be accessible at `http://localhost:5173`.

---

## 🧪 Running Tests

Run the full pytest suite for the backend:
```bash
cd backend
pytest -v
```

---

## 📄 License
MIT License.
