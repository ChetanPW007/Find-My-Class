import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getClassrooms, updateClassroomStatus } from '../api';
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

  const teacherName = localStorage.getItem('name') || 'Teacher';
  const userId = localStorage.getItem('user_id') || '';

  useEffect(() => {
    if (!localStorage.getItem('token') || localStorage.getItem('role') !== 'teacher') {
      navigate('/teacher/login');
      return;
    }
    loadClassrooms();
  }, []);

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
        <div className="page-header animate-fade-in">
          <h1>Welcome, {teacherName} 👋</h1>
          <p>Manage your classroom status. Students see these updates in real-time.</p>
        </div>

        <div className="tabs" style={{ marginBottom: '24px', width: 'fit-content' }}>
          <button 
            className={`tab ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            🏫 Dashboard
          </button>
          <button 
            className={`tab ${activeTab === 'plagiarism' ? 'active' : ''}`}
            onClick={() => setActiveTab('plagiarism')}
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
                    <div key={c._id} className="teacher-card active-class">
                      <div className="tc-clickable" onClick={() => setSelectedClassroom(c)} title="View Schedule">
                        <div className="tc-header">
                          <h3>{c.name}</h3>
                          <span className="badge badge-occupied">OCCUPIED</span>
                        </div>
                        <div className="tc-details">
                          <div className="tc-detail">📚 {c.current_subject || 'No subject'} {c.current_section && `(Sec: ${c.current_section})`}</div>
                          <div className="tc-detail">📍 {c.building}, {c.floor} {c.landmark && `— ${c.landmark}`}</div>
                          <div className="tc-detail">🚪 Room {c.room_number}</div>
                        </div>
                      </div>
                      <button
                        className="btn btn-danger"
                        style={{ width: '100%' }}
                        onClick={() => handleStatusUpdate(c._id, 'end')}
                        disabled={actionLoading[c._id]}
                      >
                        {actionLoading[c._id] ? 'Ending...' : '🛑 End Class'}
                      </button>
                    </div>
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

export default TeacherDashboard;
