import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api';
import './AuthPage.css';

function TeacherLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await login(username, password);
      if (res.data.role !== 'teacher') {
        setError('This login is for teachers only.');
        setLoading(false);
        return;
      }
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('role', res.data.role);
      localStorage.setItem('name', res.data.name);
      localStorage.setItem('user_id', res.data.user_id);
      navigate('/teacher/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    }
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-bg">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
      </div>

      <div className="auth-container animate-slide-up">
        <div className="auth-header">
          <span className="auth-icon">👨‍🏫</span>
          <h1>Teacher Login</h1>
          <p>Sign in to manage your classroom status</p>
        </div>

        <form onSubmit={handleLogin} className="auth-form">
          {error && <div className="auth-error">{error}</div>}

          <div className="form-group">
            <label>Username</label>
            <input
              id="teacher-username"
              className="input"
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              id="teacher-password"
              className="input"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            id="teacher-submit-btn"
            className="btn btn-primary btn-lg"
            type="submit"
            disabled={loading}
            style={{ width: '100%' }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="auth-footer">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>
            ← Back to Home
          </button>
        </div>

        <div className="auth-hint">
          <p>Demo credentials: <strong>rajesh</strong> / <strong>password123</strong></p>
        </div>
      </div>
    </div>
  );
}

export default TeacherLogin;
