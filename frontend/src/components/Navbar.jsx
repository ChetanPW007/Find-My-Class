import { useNavigate, useLocation } from 'react-router-dom';
import './Navbar.css';

function Navbar({ role, name, extra }) {
  const navigate = useNavigate();
  const location = useLocation();

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
        {role === 'student' && localStorage.getItem('profile_image') && (
          <img 
            src={localStorage.getItem('profile_image')} 
            alt="Profile" 
            className="nav-profile-img"
            onClick={() => document.dispatchEvent(new CustomEvent('open-profile'))}
            style={{ width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', border: '2px solid var(--primary)', marginLeft: '10px' }}
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
