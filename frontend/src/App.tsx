import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { FriendsWatchedProvider } from './context/FriendsWatchedContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { HomePage } from './pages/HomePage';
import { SearchPage } from './pages/SearchPage';
import { LibraryPage } from './pages/LibraryPage';
import { WatchlistPage } from './pages/WatchlistPage';
import { TasteProfilePage } from './pages/TasteProfilePage';
import { DecisionPage } from './pages/DecisionPage';
import { GroupPage } from './pages/GroupPage';
import { FriendsPage } from './pages/FriendsPage';
import { MobileBottomNav } from './components/MobileBottomNav';

import { useAuth } from './context/AuthContext';

function AnimatedRoutes() {
  const { user } = useAuth();
  const location = useLocation();

  return (
    <div key={`${user ? `auth-${user.id}` : 'guest'}-${location.pathname}`} className="animate-page-enter flex-1 flex flex-col">
      <Routes location={location}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route
          path="/decision"
          element={
            <ProtectedRoute>
              <DecisionPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/group"
          element={
            <ProtectedRoute>
              <GroupPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/library"
          element={
            <ProtectedRoute>
              <LibraryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/watchlist"
          element={
            <ProtectedRoute>
              <WatchlistPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <TasteProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/friends"
          element={
            <ProtectedRoute>
              <FriendsPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <FriendsWatchedProvider>
        <BrowserRouter>
          <div className="min-h-screen flex flex-col bg-obsidian-950 text-slate-100 font-sans selection:bg-compass-500 selection:text-obsidian-950">
            <Navbar />
            <main className="flex-1 flex flex-col pb-16 md:pb-0">
              <AnimatedRoutes />
            </main>
            <Footer />
            <MobileBottomNav />
          </div>
        </BrowserRouter>
      </FriendsWatchedProvider>
    </AuthProvider>
  );
}

export default App;
