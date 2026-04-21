import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './LandingPage.css';

function LandingPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    if (token && role) {
      navigate(`/${role}/dashboard`, { replace: true });
    }
  }, [navigate]);

  return (
    <div className="landing">
      {/* Animated background */}
      <div className="landing-bg">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
        <div className="grid-lines"></div>
      </div>

      <div className="landing-content">
        {/* Hero */}
        <div className="hero animate-fade-in">
          <div className="hero-badge">
            <span className="pulse-dot"></span>
            Smart Campus Navigation
          </div>
          <h1>
            Find My <span className="gradient-text">Class</span>
          </h1>
          <p className="hero-subtitle">
            Locate classrooms, labs, and departments instantly.
            Get real-time occupancy status and AI-powered search
            across your entire campus with AI-powered plagrism detection system.
          </p>
        </div>

        {/* Role Cards */}
        <div className="role-cards">
          <div className="role-card animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <div className="role-icon student-icon">🎓</div>
            <h3>Student</h3>
            <p>Search classrooms, check occupancy, and get AI-powered directions. No login required.</p>
            <ul className="role-features">
              <li>🔍 Smart classroom search</li>
              <li>📊 Real-time occupancy</li>
              <li>🤖 AI chatbot assistant</li>
            </ul>
            <button
              id="student-start-btn"
              className="btn btn-accent btn-lg"
              onClick={() => navigate('/student')}
            >
              Start Exploring →
            </button>
          </div>

          <div className="role-card featured animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <div className="featured-badge">Faculty</div>
            <div className="role-icon teacher-icon">👨‍🏫</div>
            <h3>Teacher</h3>
            <p>Update classroom status in real-time. Mark classes as started or ended for students.</p>
            <ul className="role-features">
              <li>✅ Start / End class</li>
              <li>📍 Assigned rooms</li>
              <li>📋 Quick status update</li>
            </ul>
            <button
              id="teacher-login-btn"
              className="btn btn-primary btn-lg"
              onClick={() => navigate('/teacher/login')}
            >
              Teacher Login →
            </button>
          </div>

          <div className="role-card animate-slide-up" style={{ animationDelay: '0.3s' }}>
            <div className="role-icon admin-icon">⚙️</div>
            <h3>Admin</h3>
            <p>Full system control. Manage classrooms, teachers, timetables, and ML models.</p>
            <ul className="role-features">
              <li>🏫 Manage infrastructure</li>
              <li>📸 OCR timetable upload</li>
              <li>🧠 ML predictions</li>
            </ul>
            <button
              id="admin-login-btn"
              className="btn btn-ghost btn-lg"
              onClick={() => navigate('/admin/login')}
            >
              Admin Login →
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="landing-stats animate-fade-in" style={{ animationDelay: '0.5s' }}>
          <div className="stat">
            <span className="stat-number">12+</span>
            <span className="stat-label">Classrooms</span>
          </div>
          <div className="stat-divider"></div>
          <div className="stat">
            <span className="stat-number">5</span>
            <span className="stat-label">Departments</span>
          </div>
          <div className="stat-divider"></div>
          <div className="stat">
            <span className="stat-number">AI</span>
            <span className="stat-label">Powered Search</span>
          </div>
          <div className="stat-divider"></div>
          <div className="stat">
            <span className="stat-number">24/7</span>
            <span className="stat-label">Access</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LandingPage;
