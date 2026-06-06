import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import SplashScreen from './components/SplashScreen';
import StudentAuth from './pages/StudentAuth';
import StudentDashboard from './pages/StudentDashboard';
import TeacherLogin from './pages/TeacherLogin';
import TeacherDashboard from './pages/TeacherDashboard';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';

const playChime = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    // Tone 1: A5 (880Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, ctx.currentTime);
    gain1.gain.setValueAtTime(0, ctx.currentTime);
    gain1.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    
    // Tone 2: E6 (1318.51Hz) starting slightly later
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1318.51, ctx.currentTime + 0.1);
    gain2.gain.setValueAtTime(0, ctx.currentTime);
    gain2.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
    
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.4);
    osc2.start(ctx.currentTime + 0.1);
    osc2.stop(ctx.currentTime + 0.6);
  } catch (err) {
    console.warn("Failed to play synthetic chime:", err);
  }
};

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const handleMessage = (event) => {
        if (event.data && event.data.type === 'PUSH_NOTIFICATION') {
          playChime();
          setNotification({
            title: event.data.title,
            body: event.data.body,
            id: Date.now()
          });
        }
      };
      
      navigator.serviceWorker.addEventListener('message', handleMessage);
      return () => {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      };
    }
  }, []);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Persistent Login Redirection
  const renderProtectedRoute = (Component, roleRequired) => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    
    if (token && role === roleRequired) {
      return <Navigate to={`/${role}/dashboard`} replace />;
    }
    return <Component />;
  };

  return (
    <>
      {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
      
      {notification && (
        <div className="in-app-notification-toast animate-slide-in-right glass-strong" onClick={() => setNotification(null)}>
          <div className="ian-icon">🔔</div>
          <div className="ian-content">
            <h4 className="ian-title">{notification.title}</h4>
            <p className="ian-body">{notification.body}</p>
          </div>
          <button className="ian-close" onClick={() => setNotification(null)}>&times;</button>
        </div>
      )}

      <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        
        {/* Auth Routes with redirection if already logged in */}
        <Route path="/student/auth" element={renderProtectedRoute(StudentAuth, 'student')} />
        <Route path="/teacher/login" element={renderProtectedRoute(TeacherLogin, 'teacher')} />
        <Route path="/admin/login" element={renderProtectedRoute(AdminLogin, 'admin')} />

        <Route path="/student/dashboard" element={<StudentDashboard />} />
        <Route path="/student" element={<Navigate to="/student/auth" replace />} />
        <Route path="/teacher/dashboard" element={<TeacherDashboard />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
    </>
  );
}

export default App;
