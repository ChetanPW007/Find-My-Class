import { useState, useEffect } from 'react';
import { searchClassrooms } from '../api';
import api from '../api';
import Navbar from '../components/Navbar';
import ClassroomCard from '../components/ClassroomCard';
import ChatBot from '../components/ChatBot';
import ClassroomDetailsModal from '../components/ClassroomDetailsModal';
import StudentProfileModal from '../components/StudentProfileModal';
import './StudentDashboard.css';

function StudentDashboard() {
  const [viewMode, setViewMode] = useState('classrooms'); // 'classrooms' | 'teachers'
  const [query, setQuery] = useState('');
  const [teacherQuery, setTeacherQuery] = useState('');
  const [classrooms, setClassrooms] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [waveTrigger, setWaveTrigger] = useState(0);
  const [selectedClassroom, setSelectedClassroom] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [favoriteTeachers, setFavoriteTeachers] = useState([]);


  useEffect(() => {
    loadClassrooms();
    fetchFavorites();
    fetchTeachers();
    
    const handleOpenProfile = () => setShowProfile(true);
    const handleFavUpdate = () => fetchFavorites();
    
    document.addEventListener('open-profile', handleOpenProfile);
    document.addEventListener('favorites-updated', handleFavUpdate);
    
    // Subscribe to Push Notifications
    subscribeToPush();
    
    return () => {
      document.removeEventListener('open-profile', handleOpenProfile);
      document.removeEventListener('favorites-updated', handleFavUpdate);
    };
  }, []);

  const fetchFavorites = async () => {
    try {
      const res = await api.get('/students/profile');
      if (res.data.favorites) setFavorites(res.data.favorites);
      if (res.data.favorite_teachers) setFavoriteTeachers(res.data.favorite_teachers);
    } catch(e) {}
  };

  const fetchTeachers = async () => {
    try {
      const res = await api.get('/teachers');
      setTeachers(res.data);
    } catch (err) {
      console.error('Failed to load teachers:', err);
    }
  };

  const handleToggleFavoriteTeacher = async (teacherId) => {
    const isFav = favoriteTeachers.includes(teacherId);
    try {
      const endpoint = `/students/favorite-teachers/${teacherId}`;
      if (isFav) {
        await api.delete(endpoint);
        setFavoriteTeachers(prev => prev.filter(id => id !== teacherId));
      } else {
        await api.post(endpoint);
        setFavoriteTeachers(prev => [...prev, teacherId]);
      }
    } catch (err) {
      console.error("Failed to toggle favorite teacher:", err);
    }
  };


  const subscribeToPush = async () => {
    if ('serviceWorker' in navigator && 'PushManager' in window && localStorage.getItem('role') === 'student') {
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
          
          await api.post('/students/push-subscribe', subscription);
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

  const loadClassrooms = async (q = '') => {
    setLoading(true);
    try {
      const res = await searchClassrooms(q);
      setClassrooms(res.data);
    } catch (err) {
      console.error('Error loading classrooms:', err);
    }
    setLoading(false);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadClassrooms(query);
  };

  const filteredClassrooms = classrooms.filter((c) => {
    if (filterType === 'all') return true;
    if (filterType === 'free') return c.status === 'free';
    if (filterType === 'occupied') return c.status === 'occupied';
    return c.type === filterType;
  });

  const freeCount = classrooms.filter((c) => c.status === 'free').length;
  const occupiedCount = classrooms.filter((c) => c.status === 'occupied').length;

  // Sorting: Favorites first, then by status (free first), then by name
  const sortedClassrooms = [...filteredClassrooms].sort((a, b) => {
    const aFav = favorites.includes(a._id);
    const bFav = favorites.includes(b._id);
    if (aFav && !bFav) return -1;
    if (!aFav && bFav) return 1;
    
    // Fallback sorting
    if (a.status !== b.status) return a.status === 'free' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  // Filter & sort teachers
  const filteredTeachers = teachers.filter(t => {
    const q = teacherQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      t.name.toLowerCase().includes(q) ||
      (t.department || '').toLowerCase().includes(q) ||
      (t.subjects || []).some(s => s.toLowerCase().includes(q))
    );
  });

  const sortedTeachers = [...filteredTeachers].sort((a, b) => {
    const aFav = favoriteTeachers.includes(a._id);
    const bFav = favoriteTeachers.includes(b._id);
    if (aFav && !bFav) return -1;
    if (!aFav && bFav) return 1;

    const aTeaching = classrooms.some(c => c.status === 'occupied' && c.current_teacher === a.name);
    const bTeaching = classrooms.some(c => c.status === 'occupied' && c.current_teacher === b.name);
    if (aTeaching && !bTeaching) return -1;
    if (!aTeaching && bTeaching) return 1;

    return a.name.localeCompare(b.name);
  });


  return (
    <div className="student-page">
      <Navbar role="student" />
      <div className="page">
        {/* Main View Tab Selector */}
        <div className="main-view-tabs animate-slide-up" style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '24px' }}>
          <button 
            className={`tab main-tab ${viewMode === 'classrooms' ? 'active' : ''}`}
            onClick={() => setViewMode('classrooms')}
            style={{ fontSize: '1rem', padding: '10px 24px' }}
          >
            🏫 Classrooms
          </button>
          <button 
            className={`tab main-tab ${viewMode === 'teachers' ? 'active' : ''}`}
            onClick={() => setViewMode('teachers')}
            style={{ fontSize: '1rem', padding: '10px 24px' }}
          >
            👨‍🏫 Teachers Directory
          </button>
        </div>

        {viewMode === 'classrooms' ? (
          <>
            <div className="student-hero animate-fade-in">
              <h1>🔍 Find Your Classroom <span key={waveTrigger} className="waving-hand">👋</span></h1>
              <p>Search by classroom name, subject, teacher, department, or building</p>

              <form onSubmit={handleSearch} className="search-bar student-search">
                <span className="search-icon">🔍</span>
                <input
                  id="student-search-input"
                  className="input"
                  type="text"
                  placeholder="Search classrooms, subjects, teachers..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <button type="submit" className="btn btn-primary search-submit">
                  Search
                </button>
              </form>
            </div>

            {/* Quick Stats */}
            <div className="quick-stats animate-slide-up">
              <div className="stat-card">
                <span className="stat-value">{classrooms.length}</span>
                <span className="stat-name">Total Rooms</span>
              </div>
              <div className="stat-card free">
                <span className="stat-value">{freeCount}</span>
                <span className="stat-name">Available</span>
              </div>
              <div className="stat-card occupied">
                <span className="stat-value">{occupiedCount}</span>
                <span className="stat-name">Occupied</span>
              </div>
            </div>

            {/* Filters */}
            <div className="filter-bar">
              <div className="tabs">
                {[
                  { key: 'all', label: 'All' },
                  { key: 'free', label: '🟢 Free' },
                  { key: 'occupied', label: '🔴 Occupied' },
                  { key: 'classroom', label: '🏫 Classrooms' },
                  { key: 'laboratory', label: '🔬 Labs' },
                  { key: 'chamber', label: '🚪 Chambers' },
                ].map((f) => (
                  <button
                    key={f.key}
                    className={`tab ${filterType === f.key ? 'active' : ''}`}
                    onClick={() => {
                      setFilterType(f.key);
                      setWaveTrigger(prev => prev + 1);
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <span className="result-count">
                {filteredClassrooms.length} results
              </span>
            </div>

            {/* Results */}
            {loading ? (
              <div className="loading"><div className="spinner"></div></div>
            ) : filteredClassrooms.length === 0 ? (
              <div className="empty-state">
                <div className="icon">🏫</div>
                <h3>No classrooms found</h3>
                <p>Try a different search term or filter</p>
              </div>
            ) : (
              <div className="classroom-grid">
                {sortedClassrooms.map((c, i) => (
                  <ClassroomCard 
                    key={c._id} 
                    classroom={c} 
                    delay={i * 0.05} 
                    onClick={setSelectedClassroom}
                    isFavorite={favorites.includes(c._id)}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          /* Teachers Directory View */
          <div className="teachers-directory animate-fade-in">
            <div className="directory-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ textAlign: 'left' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '800' }}>👨‍🏫 Teachers Directory</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Favorite a teacher to receive push notifications when they start/end classes for your semester.</p>
              </div>
              <div className="search-bar" style={{ width: '100%', maxWidth: '350px' }}>
                <span className="search-icon">🔍</span>
                <input
                  className="input"
                  type="text"
                  placeholder="Search teachers, subjects, depts..."
                  value={teacherQuery}
                  onChange={(e) => setTeacherQuery(e.target.value)}
                />
              </div>
            </div>

            {sortedTeachers.length === 0 ? (
              <div className="empty-state">
                <div className="icon">👨‍🏫</div>
                <h3>No teachers found</h3>
                <p>Try a different search query</p>
              </div>
            ) : (
              <div className="teachers-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                {sortedTeachers.map((t) => {
                  const isFav = favoriteTeachers.includes(t._id);
                  const activeClass = classrooms.find(
                    c => c.status === 'occupied' && c.current_teacher === t.name
                  );

                  return (
                    <div key={t._id} className={`teacher-card glass ${activeClass ? 'teaching-now' : ''}`} style={{ borderRadius: 'var(--radius-md)', padding: '20px', display: 'flex', flexDirection: 'column', border: activeClass ? '1px solid var(--danger)' : '1px solid var(--border)', transition: 'var(--transition)' }}>
                      <div className="teacher-header" style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px', position: 'relative' }}>
                        <div className="teacher-avatar" style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--primary-glow)', color: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', border: '1px solid var(--primary)' }}>
                          {t.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                        </div>
                        <div className="teacher-meta" style={{ flex: 1, textAlign: 'left' }}>
                          <h3 style={{ fontSize: '1.05rem', fontWeight: '700', margin: 0 }}>{t.name}</h3>
                          <span className="teacher-dept" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>🏛️ {t.department}</span>
                        </div>
                        <button 
                          className={`btn-fav ${isFav ? 'active' : ''}`}
                          onClick={() => handleToggleFavoriteTeacher(t._id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: isFav ? '#F59E0B' : 'var(--text-muted)',
                            fontSize: '1.5rem',
                            cursor: 'pointer',
                            padding: '4px',
                            lineHeight: 1,
                            transition: 'color 0.2s'
                          }}
                          title={isFav ? "Remove Favorite" : "Add Favorite"}
                        >
                          {isFav ? '★' : '☆'}
                        </button>
                      </div>

                      <div className="teacher-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', textAlign: 'left' }}>
                        <div style={{ marginBottom: '12px' }}>
                          {activeClass ? (
                            <span className="badge badge-occupied" style={{ display: 'inline-flex', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700', gap: '6px', alignItems: 'center', marginBottom: '8px' }}>
                              <span className="pulse-dot"></span> Live Now
                            </span>
                          ) : (
                            <span className="badge badge-free" style={{ display: 'inline-flex', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700', marginBottom: '8px' }}>
                              Free / Available
                            </span>
                          )}

                          {activeClass && (
                            <div className="active-class-details" style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', padding: '10px', borderRadius: '8px', fontSize: '0.85rem', marginTop: '6px' }}>
                              <div style={{ marginBottom: '4px' }}>📚 <b>Subject:</b> {activeClass.current_subject}</div>
                              <div style={{ marginBottom: '4px' }}>🏫 <b>Room:</b> {activeClass.name}</div>
                              <div>👥 <b>Sem:</b> {activeClass.current_semester} | <b>Sec:</b> {activeClass.current_section}</div>
                            </div>
                          )}
                        </div>

                        <div className="teacher-subjects">
                          <h4 style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: '600' }}>Subjects:</h4>
                          <div className="subject-pills" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {t.subjects && t.subjects.length > 0 ? (
                              t.subjects.map((sub, idx) => (
                                <span key={idx} className="subject-pill" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '3px 8px', borderRadius: '12px', fontSize: '0.75rem' }}>{sub}</span>
                              ))
                            ) : (
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>General Subjects</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <ChatBot />

      {selectedClassroom && (
        <ClassroomDetailsModal 
          classroom={selectedClassroom} 
          onClose={() => setSelectedClassroom(null)} 
          role="student"
        />
      )}

      {showProfile && (
        <StudentProfileModal onClose={() => setShowProfile(false)} />
      )}
    </div>
  );
}

export default StudentDashboard;
