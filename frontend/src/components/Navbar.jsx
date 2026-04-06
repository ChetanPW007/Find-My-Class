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
        {role !== 'student' ? (
          <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
            Logout
          </button>
        ) : (
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>
            ← Home
          </button>
        )}
      </div>
    </nav>
  );
}

export default Navbar;
