import { useState, useEffect } from 'react';
import { searchClassrooms } from '../api';
import Navbar from '../components/Navbar';
import ClassroomCard from '../components/ClassroomCard';
import ChatBot from '../components/ChatBot';
import ClassroomDetailsModal from '../components/ClassroomDetailsModal';
import './StudentDashboard.css';

function StudentDashboard() {
  const [query, setQuery] = useState('');
  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [selectedClassroom, setSelectedClassroom] = useState(null);

  useEffect(() => {
    loadClassrooms();
  }, []);

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

  return (
    <div className="student-page">
      <Navbar role="student" />
      <div className="page">
        <div className="student-hero animate-fade-in">
          <h1>🔍 Find Your Classroom <span key={filterType} className="waving-hand">👋</span></h1>
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
                onClick={() => setFilterType(f.key)}
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
            {filteredClassrooms.map((c, i) => (
              <ClassroomCard 
                key={c._id} 
                classroom={c} 
                delay={i * 0.05} 
                onClick={setSelectedClassroom} 
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
    </div>
  );
}

export default StudentDashboard;
