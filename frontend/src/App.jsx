import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import SplashScreen from './components/SplashScreen';
import StudentAuth from './pages/StudentAuth';
import StudentDashboard from './pages/StudentDashboard';
import TeacherLogin from './pages/TeacherLogin';
import TeacherDashboard from './pages/TeacherDashboard';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';

function App() {
  const [showSplash, setShowSplash] = useState(true);

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
