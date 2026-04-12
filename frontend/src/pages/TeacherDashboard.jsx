import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getClassrooms, updateClassroomStatus, getUpcomingClasses } from '../api';
import Navbar from '../components/Navbar';
import ClassroomDetailsModal from '../components/ClassroomDetailsModal';
import ScheduleMonitor from '../components/ScheduleMonitor';
import PlagiarismChecker from '../components/PlagiarismChecker';
import './TeacherDashboard.css';

function TeacherDashboard() {
  const navigate = useNavigate();
  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [toast, setToast] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedClassroom, setSelectedClassroom] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' or 'plagiarism'
  const [waveTrigger, setWaveTrigger] = useState(0);

  const teacherName = localStorage.getItem('name') || 'Teacher';
  const userId = localStorage.getItem('user_id') || '';

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setWaveTrigger(prev => prev + 1);
  };

    if (!localStorage.getItem('token') || localStorage.getItem('role') !== 'teacher') {
      navigate('/teacher/login');
      return;
    }
    loadClassrooms();
    subscribeToPush();
  }, []);

  const subscribeToPush = async () => {
    if ('serviceWorker' in navigator && 'PushManager' in window && localStorage.getItem('role') === 'teacher') {
      try {
        const registration = await navigator.serviceWorker.ready;
        let subscription = await registration.pushManager.getSubscription();
        
        if (!subscription) {
          const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY;
          if (!VAPID_PUBLIC) return;
          
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC)
          });
          
          await fetch('http://localhost:5000/api/students/push-subscribe', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(subscription)
          });
        }
      } catch(e) {
        console.error('Push subscription failed:', e);
      }
    }
  };

  const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    return new Uint8Array([...rawData].map(char => char.charCodeAt(0)));
  };


  const loadClassrooms = async () => {
    setLoading(true);
    try {
      const res = await getClassrooms();
      setClassrooms(res.data);
    } catch (err) {
      console.error('Error:', err);
    }
    setLoading(false);
  };

  const handleStatusUpdate = async (classroomId, action, subject = '', semester = '', section = '') => {
    setActionLoading((prev) => ({ ...prev, [classroomId]: true }));
    try {
      await updateClassroomStatus(classroomId, { action, subject, semester, section });
      await loadClassrooms();
      showToast(action === 'start' ? '✅ Class started!' : '🔴 Class ended!', 'success');
    } catch (err) {
      showToast('Failed to update status', 'error');
    }
    setActionLoading((prev) => ({ ...prev, [classroomId]: false }));
  };

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Auto-free handler called by ScheduleMonitor when a class ends
  const handleAutoFree = useCallback(async (cls) => {
    // Find the classroom by name
    const match = classrooms.find(c =>
      c.name?.toLowerCase() === cls.classroom?.toLowerCase() ||
      c.room_number?.toLowerCase() === cls.classroom?.toLowerCase()
    );
    if (match && match.status === 'occupied' && match.current_teacher_id === userId) {
      try {
        await updateClassroomStatus(match._id, { action: 'end' });
        showToast(`🔴 "${cls.subject}" ended. Room ${match.name} auto-freed.`, 'success');
        loadClassrooms();
      } catch (e) {
        console.warn('Auto-free failed:', e.message);
      }
    }
  }, [classrooms, userId]);

  // Filter to show assigned classrooms at top
  const myClassrooms = classrooms.filter(
    (c) => c.current_teacher_id === userId || c.current_teacher === teacherName
  );
  
  // Filter the rest based on search and status
  const otherClassrooms = classrooms.filter((c) => {
    // Exclude my classrooms
    if (c.current_teacher_id === userId || c.current_teacher === teacherName) return false;
    
    // Status filter
    if (filterStatus !== 'all' && c.status !== filterStatus) return false;
    
    // Search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.department.toLowerCase().includes(q) ||
        c.building.toLowerCase().includes(q) ||
        c.room_number.toLowerCase().includes(q) ||
        (c.current_subject || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="teacher-page">
      <Navbar role="teacher" name={teacherName} extra={
        <ScheduleMonitor onClassroomFreed={handleAutoFree} />
      } />
      <div className="page">
        <div className="teacher-hero animate-fade-in">
          <h1>👨‍🏫 Welcome, {teacherName} <span key={waveTrigger} className="waving-hand">👋</span></h1>
          <p>Manage your classroom status. Students see these updates in real-time.</p>
        </div>

        <div className="tabs" style={{ marginBottom: '24px', width: 'fit-content', margin: '0 auto 24px' }}>
          <button 
            className={`tab ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => handleTabChange('dashboard')}
          >
            🏫 Dashboard
          </button>
          <button 
            className={`tab ${activeTab === 'plagiarism' ? 'active' : ''}`}
            onClick={() => handleTabChange('plagiarism')}
          >
            🔍 Plagiarism Check
          </button>
        </div>

        {toast && (
          <div className={`toast toast-${toast.type}`}>{toast.message}</div>
        )}

        {loading ? (
          <div className="loading"><div className="spinner"></div></div>
        ) : activeTab === 'plagiarism' ? (
          <PlagiarismChecker />
        ) : (
          <>
            {/* My Active Classes */}
            {myClassrooms.length > 0 && (
              <div className="section animate-slide-up">
                <h2 className="section-title">🟢 Your Active Classes</h2>
                <div className="teacher-grid">
                  {myClassrooms.map((c) => (
                    <ActiveRoomCard 
                      key={c._id} 
                      classroom={c} 
                      onEnd={() => handleStatusUpdate(c._id, 'end')}
                      onSelect={() => setSelectedClassroom(c)}
                      loading={actionLoading[c._id]}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* All Classrooms */}
            <div className="section animate-slide-up" style={{ animationDelay: '0.1s' }}>
              <div className="section-header">
                <h2 className="section-title">🏫 All Classrooms</h2>
                
                {/* Search and Filter */}
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end', alignItems: 'center' }}>
                  <div className="search-bar" style={{ maxWidth: '300px', flex: 1 }}>
                    <span className="search-icon">🔍</span>
                    <input
                      className="input"
                      type="text"
                      placeholder="Search classrooms..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="tabs">
                    {[
                      { key: 'all', label: 'All' },
                      { key: 'free', label: '🟢 Free' },
                      { key: 'occupied', label: '🔴 Occupied' }
                    ].map(f => (
                      <button 
                        key={f.key} 
                        className={`tab ${filterStatus === f.key ? 'active' : ''}`}
                        onClick={() => setFilterStatus(f.key)}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {otherClassrooms.length === 0 ? (
                <div className="empty-state" style={{ padding: '40px 20px' }}>
                  <div className="icon">🔍</div>
                  <h3>No classrooms found</h3>
                  <p>Try a different search term or filter status</p>
                </div>
              ) : (
                <div className="teacher-grid">
                  {otherClassrooms.map((c) => (
                  <div key={c._id} className={`teacher-card ${c.status === 'occupied' ? 'is-occupied' : ''}`}>
                    <div className="tc-clickable" onClick={() => setSelectedClassroom(c)} title="View Schedule">
                      <div className="tc-header">
                        <h3>{c.name}</h3>
                        <span className={`badge badge-${c.status}`}>
                          {c.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="tc-details">
                        <div className="tc-detail">📍 {c.building}, {c.floor} — Room {c.room_number} {c.landmark && `(${c.landmark})`}</div>
                        <div className="tc-detail">🏢 {c.department}</div>
                        {c.status === 'occupied' && (
                          <div className="tc-detail">👨‍🏫 {c.current_teacher} — {c.current_subject} {c.current_section && `(${c.current_section})`}</div>
                        )}
                      </div>
                    </div>
                    {c.status === 'free' ? (
                      <StartClassForm
                        classroomId={c._id}
                        loading={actionLoading[c._id]}
                        onStart={(subject, sem, sec) => handleStatusUpdate(c._id, 'start', subject, sem, sec)}
                      />
                    ) : c.current_teacher_id === userId ? (
                      <button
                        className="btn btn-danger"
                        style={{ width: '100%' }}
                        onClick={() => handleStatusUpdate(c._id, 'end')}
                        disabled={actionLoading[c._id]}
                      >
                        {actionLoading[c._id] ? 'Ending...' : '🛑 End Class'}
                      </button>
                    ) : null}
                  </div>
                ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {selectedClassroom && (
        <ClassroomDetailsModal 
          classroom={classrooms.find(c => c._id === selectedClassroom._id) || selectedClassroom} 
          onClose={() => setSelectedClassroom(null)} 
          role="teacher"
          onStartClass={handleStatusUpdate}
          loading={actionLoading[selectedClassroom._id]}
        />
      )}
    </div>
  );
}

function StartClassForm({ classroomId, loading, onStart }) {
  const [subject, setSubject] = useState('');
  const [semester, setSemester] = useState('1');
  const [section, setSection] = useState('');
  const [showForm, setShowForm] = useState(false);

  if (!showForm) {
    return (
      <button className="btn btn-success" style={{ width: '100%' }} onClick={() => setShowForm(true)}>
        ▶️ Start Class
      </button>
    );
  }

  return (
    <div className="start-form">
      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        <input
          className="input"
          style={{ flex: 2 }}
          placeholder="Subject name"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
        <select 
          className="select" 
          style={{ flex: 1 }}
          value={semester} 
          onChange={(e) => setSemester(e.target.value)}
        >
          {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Sem {s}</option>)}
        </select>
        <input
          className="input"
          style={{ flex: 1 }}
          placeholder="Sec (e.g. CY2A)"
          value={section}
          maxLength={4}
          onChange={(e) => setSection(e.target.value.toUpperCase())}
        />
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          className="btn btn-success"
          style={{ flex: 1 }}
          onClick={() => { onStart(subject, semester, section); setShowForm(false); setSubject(''); setSection(''); }}
          disabled={loading}
        >
          {loading ? 'Starting...' : '✅ Confirm'}
        </button>
        <button className="btn btn-ghost" onClick={() => setShowForm(false)}>✖</button>
      </div>
    </div>
  );
}

function ActiveRoomCard({ classroom, onEnd, onSelect, loading }) {
  const [timeLeft, setTimeLeft] = useState('');
  const [upcoming, setUpcoming] = useState(null);

  useEffect(() => {
    // Load upcoming info
    getUpcomingClasses(classroom._id).then(res => {
      if (res.data && res.data.length > 0) {
        setUpcoming(res.data.find(u => !u.is_ongoing) || res.data[0]);
      }
    }).catch(e => console.warn('Failed to fetch upcoming:', e));

    // Timer for auto-free (1 hour from occupied_at)
    if (!classroom.occupied_at) return;

    const updateTimer = () => {
      const occAt = new Date(classroom.occupied_at).getTime();
      const now = new Date().getTime();
      const diff = 3600000 - (now - occAt); // 1 hour in ms

      if (diff <= 0) {
        setTimeLeft('Auto-freeing...');
      } else {
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${mins}m ${secs}s`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [classroom]);

  return (
    <div className="teacher-card active-class">
      <div className="tc-clickable" onClick={onSelect} title="View Schedule">
        <div className="tc-header">
          <h3>{classroom.name}</h3>
          <span className="badge badge-occupied">OCCUPIED</span>
        </div>
        <div className="tc-details">
          <div className="tc-detail">📚 {classroom.current_subject || 'No subject'} {classroom.current_section && `(Sec: ${classroom.current_section})`}</div>
          <div className="tc-detail">📍 {classroom.building}, {classroom.floor}</div>
          
          <div className="active-meta" style={{ marginTop: '12px', padding: '10px', background: 'rgba(52, 211, 153, 0.1)', borderRadius: '8px' }}>
            <div className="tc-detail" style={{ color: '#059669', fontWeight: 'bold' }}>
              ⏱️ Auto-free in: {timeLeft || '--:--'}
            </div>
            {upcoming && (
              <div className="tc-detail" style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                ⏭️ Up Next: <b>{upcoming.subject}</b> ({upcoming.time_slot})
              </div>
            )}
          </div>
        </div>
      </div>
      <button
        className="btn btn-danger"
        style={{ width: '100%', marginTop: '10px' }}
        onClick={onEnd}
        disabled={loading}
      >
        {loading ? 'Ending...' : '🛑 End Class Now'}
      </button>
    </div>
  );
}

export default TeacherDashboard;
