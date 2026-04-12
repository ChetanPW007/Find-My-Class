import { useState, useEffect } from 'react';
import { searchClassrooms } from '../api';
import Navbar from '../components/Navbar';
import ClassroomCard from '../components/ClassroomCard';
import ChatBot from '../components/ChatBot';
import ClassroomDetailsModal from '../components/ClassroomDetailsModal';
import StudentProfileModal from '../components/StudentProfileModal';
import './StudentDashboard.css';

function StudentDashboard() {
  const [query, setQuery] = useState('');
  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [waveTrigger, setWaveTrigger] = useState(0);
  const [selectedClassroom, setSelectedClassroom] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [favorites, setFavorites] = useState([]);


  useEffect(() => {
    loadClassrooms();
    fetchFavorites();
    
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
      const res = await fetch('http://localhost:5000/api/students/profile', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (data.favorites) setFavorites(data.favorites);
    } catch(e) {}
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


  return (
    <div className="student-page">
      <Navbar role="student" />
      <div className="page">
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
