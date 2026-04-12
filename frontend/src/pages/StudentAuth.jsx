import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import './AuthPage.css';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'PLACEHOLDER_KEY';

const DEPARTMENTS = [
  "Computer Science",
  "AI & Machine Learning",
  "Data Science",
  "Cyber Security",
  "IoT",
  "Software Engineering",
  "Information Science",
  "Electronics",
  "Mechanical",
  "Civil",
  "BCA",
  "BSc (Computer Science)",
  "BSc (General)",
  "B.Com",
  "Other (Type Manually)"
];

function StudentAuth() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  
  // State for new user custom info step (Google or Manual Signup)
  const [needsDetails, setNeedsDetails] = useState(false);
  const [googleData, setGoogleData] = useState(null);
  const [manualDept, setManualDept] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    university: 'GM University',
    mobile: '',
    dept: '',
    otherDept: '',
    semester: '1',
    usn: ''
  });

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('http://localhost:5000/api/students/google-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: credentialResponse.credential })
      });
      const data = await res.json();
      
      if (res.status === 206) {
        setGoogleData(data.google_data);
        setNeedsDetails(true);
      } else if (res.ok) {
        finishLogin(data);
      } else {
        throw new Error(data.error || 'Google Auth Failed');
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleManualAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      if (mode === 'login') {
        const res = await fetch('http://localhost:5000/api/students/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: formData.email, password: formData.password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        finishLogin(data);
      } else {
        // Mode is signup (initial fields)
        setNeedsDetails(true);
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleFinalSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const finalDept = formData.dept === 'Other (Type Manually)' ? formData.otherDept : formData.dept;
    const payload = googleData ? {
      google_data: googleData,
      ...formData,
      dept: finalDept
    } : {
      ...formData,
      dept: finalDept
    };

    const endpoint = googleData ? 'complete-signup' : 'signup';

    try {
      const res = await fetch(`http://localhost:5000/api/students/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      finishLogin(data);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const finishLogin = (data) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('role', 'student');
    localStorage.setItem('name', data.name);
    localStorage.setItem('user_id', data.user_id);
    localStorage.setItem('profile_image', data.profile_image || '');
    navigate('/student/dashboard');
  };

  if (needsDetails) {
    return (
      <div className="auth-page">
        <div className="auth-container animate-slide-up" style={{ maxWidth: '500px' }}>
          <div className="auth-header">
            <h1>Complete Profile</h1>
            <p>Tell us a bit more about you</p>
          </div>
          <form onSubmit={handleFinalSignup} className="auth-form">
            {!googleData && (
               <div className="form-group">
                <label>Full Name</label>
                <input className="input" type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
              </div>
            )}
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div className="form-group">
                <label>USN (Roll No)</label>
                <input className="input" type="text" placeholder="1RV21..." value={formData.usn} onChange={(e) => setFormData({...formData, usn: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Mobile</label>
                <input className="input" type="tel" value={formData.mobile} onChange={(e) => setFormData({...formData, mobile: e.target.value})} required />
              </div>
            </div>

            <div className="form-group">
              <label>{googleData ? 'Set a Password (for manual login)' : 'Password'}</label>
              <input className="input" type="password" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} required />
            </div>

            <div className="form-group">
              <label>Department</label>
              <select className="input" value={formData.dept} onChange={(e) => setFormData({...formData, dept: e.target.value})} required>
                <option value="">Select Dept</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            {formData.dept === 'Other (Type Manually)' && (
               <div className="form-group animate-fade-in">
                <label>Type Department Name</label>
                <input className="input" type="text" value={formData.otherDept} onChange={(e) => setFormData({...formData, otherDept: e.target.value})} required />
              </div>
            )}

            <div className="form-group">
              <label>Semester</label>
              <select className="input" value={formData.semester} onChange={(e) => setFormData({...formData, semester: e.target.value})} required>
                {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Sem {s}</option>)}
              </select>
            </div>

            <button className="btn btn-primary btn-lg" type="submit" disabled={loading} style={{ width: '100%' }}>
              {loading ? 'Processing...' : 'Finish Signup'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div className="auth-page">
        <div className="auth-bg">
          <div className="orb orb-1"></div>
          <div className="orb orb-2"></div>
        </div>

        <div className="auth-container animate-slide-up">
          <div className="auth-header">
            <span className="auth-icon">🎓</span>
            <h1>{mode === 'login' ? 'Student Login' : 'Student Signup'}</h1>
            <p>{mode === 'login' ? 'Welcome back! Use Google or manual auth' : 'Join our campus network'}</p>
          </div>

          <div className="auth-form">
            {error && <div className="auth-error">{error}</div>}

            <div className="google-btn-container" style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError('Google Auth Failed')}
                shape="pill"
                text="continue_with"
                width="100%"
              />
            </div>

            <div className="divider"><span>OR MANUAL</span></div>

            <form onSubmit={handleManualAuth}>
              <div className="form-group">
                <label>Email Address</label>
                <input 
                  className="input" type="email" placeholder="email@univ.edu" 
                  value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required 
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input 
                  className="input" type="password" placeholder="••••••••" 
                  value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} 
                  required={mode === 'login'}
                />
              </div>
              
              <button className="btn btn-primary btn-lg" type="submit" disabled={loading} style={{ width: '100%', marginTop: '10px' }}>
                {loading ? 'Working...' : (mode === 'login' ? 'Sign In' : 'Continue to Details')}
              </button>
            </form>

            <div className="auth-footer" style={{ marginTop: '20px', textAlign: 'center' }}>
              <button className="btn btn-ghost" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
                {mode === 'login' ? "Don't have an account? Signup" : "Already have an account? Login"}
              </button>
              <br />
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')} style={{ marginTop: '10px' }}>
                ← Back to Home
              </button>
            </div>
          </div>
        </div>
      </div>
    </GoogleOAuthProvider>
  );
}

export default StudentAuth;
