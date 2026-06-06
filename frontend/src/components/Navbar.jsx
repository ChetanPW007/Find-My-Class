import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './Navbar.css';

function Navbar({ role, name, extra }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Theme state — initialize from localStorage or default to dark
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : true;
  });

  // Apply theme class to body on mount and whenever isDark changes
  useEffect(() => {
    if (isDark) {
      document.body.classList.remove('light-mode');
    } else {
      document.body.classList.add('light-mode');
    }
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const toggleTheme = () => setIsDark(prev => !prev);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('name');
    localStorage.removeItem('user_id');
    localStorage.removeItem('profile_image');
    navigate('/');
  };

  const getRoleLabel = () => {
    switch (role) {
      case 'student': return '🎓 Student';
      case 'teacher': return '👨‍🏫 Teacher';
      case 'admin': return '⚙️ Admin';
      default: return '';
    }
  };

  return (
    <nav className="navbar glass-strong">
      <div className="nav-left">
        <div className="nav-logo" onClick={() => navigate('/')}>
          <span className="logo-icon">📍</span>
          <span className="logo-text">Find<span className="logo-accent">My</span>Class</span>
        </div>
      </div>

      <div className="nav-right">
        <span className="nav-role">{getRoleLabel()}</span>
        {name && <span className="nav-name">{name}</span>}
        {extra && <div className="nav-extra">{extra}</div>}

        {/* Celestial Theme Toggle */}
        <div className="theme-toggle-wrap" title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
          <button
            id="theme-toggle-btn"
            className={`theme-toggle ${isDark ? 'is-dark' : 'is-light'}`}
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            {/* Sun Rays (visible in light mode) */}
            <div className="sun-rays">
              <span className="sun-ray"></span>
              <span className="sun-ray"></span>
              <span className="sun-ray"></span>
              <span className="sun-ray"></span>
              <span className="sun-ray"></span>
              <span className="sun-ray"></span>
              <span className="sun-ray"></span>
              <span className="sun-ray"></span>
            </div>
            {/* Moon Craters (visible in dark mode) */}
            <div className="moon-craters">
              <span className="crater crater-1"></span>
              <span className="crater crater-2"></span>
              <span className="crater crater-3"></span>
            </div>
            {/* Stars (visible in dark mode) */}
            <div className="toggle-stars">
              <span className="toggle-star"></span>
              <span className="toggle-star"></span>
              <span className="toggle-star"></span>
            </div>
          </button>
        </div>

        {role === 'student' && (
          <img 
            src={localStorage.getItem('profile_image') || `https://ui-avatars.com/api/?name=${encodeURIComponent(localStorage.getItem('name') || 'Student')}&background=random`}
            alt="Profile" 
            className="nav-profile-img"
            onClick={() => document.dispatchEvent(new CustomEvent('open-profile'))}
            style={{ width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', border: '2px solid var(--primary)', marginLeft: '10px', objectFit: 'cover' }}
            title="View Profile"
          />
        )}
        <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </nav>
  );
}

export default Navbar;
