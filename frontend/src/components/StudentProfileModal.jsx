import { useState, useEffect } from 'react';

function StudentProfileModal({ onClose }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [semester, setSemester] = useState('');
  
  useEffect(() => {
    fetchProfile();
    // Prevent background scrolling
    document.body.style.overflow = 'hidden';
    return () => document.body.style.overflow = 'unset';
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/students/profile', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      setProfile(data);
      setSemester(data.semester);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('http://localhost:5000/api/students/profile', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}` 
        },
        body: JSON.stringify({ semester })
      });
      setProfile(prev => ({...prev, semester}));
      onClose();
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('name');
    localStorage.removeItem('profile_image');
    window.location.href = '/';
  };

  if (loading) return (
    <div className="modal-overlay" style={{ background: 'rgba(0,0,0,0.8)', zIndex: 1000 }}>
       <div className="spinner"></div>
    </div>
  );

  if (!profile) return null;

  return (
    <div className="modal-overlay cd-modal-overlay" onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div className="modal cd-modal animate-pop-in" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
        
        <button className="cd-close-btn" onClick={onClose}>
          <svg viewBox="0 0 24 24" width="24" height="24">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        </button>

        <div className="cd-header" style={{ textAlign: 'center', paddingBottom: '20px' }}>
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: '15px' }}>
            <img 
              src={profile.profile_image || 'https://ui-avatars.com/api/?name=' + profile.name} 
              alt="Profile" 
              style={{ width: '100px', height: '100px', borderRadius: '50%', border: '4px solid var(--primary)', objectFit: 'cover', boxShadow: '0 8px 16px rgba(0,0,0,0.2)' }} 
            />
            <span style={{ position: 'absolute', bottom: '0', right: '0', background: 'var(--primary)', padding: '5px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', color: 'black' }}>
               STUDENT
            </span>
          </div>
          <h1 style={{ marginBottom: '5px' }}>{profile.name}</h1>
          <p style={{ opacity: 0.7, fontSize: '0.9rem' }}>{profile.usn}</p>
        </div>
        
        <div style={{ padding: '0 20px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
             {[
               { label: 'Department', value: profile.dept, icon: '🏛️' },
               { label: 'University', value: profile.university, icon: '🎓' },
               { label: 'Mobile', value: profile.mobile, icon: '📱' },
               { label: 'Email', value: profile.email, icon: '📧' }
             ].map((item, idx) => (
               <div key={idx} className="glass-strong" style={{ padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <small style={{ display: 'flex', alignItems: 'center', gap: '5px', opacity: 0.6, fontSize: '0.75rem', marginBottom: '4px' }}>
                     {item.icon} {item.label}
                  </small>
                  <div style={{ fontWeight: '500', fontSize: '0.85rem' }}>{item.value}</div>
               </div>
             ))}
          </div>

          <div className="cd-section" style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '16px', marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.9rem', fontWeight: '600' }}>📚 Current Semester</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <select 
                className="input" 
                value={semester} 
                onChange={(e) => setSemester(e.target.value)}
                style={{ flex: 1 }}
              >
                {[1,2,3,4,5,6,7,8].map(s => (
                  <option key={s} value={s}>Semester {s}</option>
                ))}
              </select>
              <button 
                className="btn btn-primary" 
                onClick={handleSave} 
                disabled={saving || semester == profile.semester}
                style={{ padding: '0 20px' }}
              >
                {saving ? '...' : 'Update'}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Close Window</button>
            <button className="btn btn-danger" style={{ flex: 1 }} onClick={handleLogout}>Log Out</button>
          </div>
          
        </div>
        <div className="cd-footer" style={{ textAlign: 'center', opacity: 0.5, fontSize: '0.7rem' }}>
           Session Active • Security encrypted by FindMyClass
        </div>
      </div>
    </div>
  );
}

export default StudentProfileModal;
