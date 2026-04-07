import { useState, useEffect } from 'react';
import { getUpcomingClasses } from '../api';
import './ClassroomDetailsModal.css';

function ClassroomDetailsModal({ classroom, onClose, role, onStartClass, loading: actionLoading }) {
  const [upcoming, setUpcoming] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState('');
  const [semester, setSemester] = useState('1');
  const [section, setSection] = useState('');
  const c = classroom;
  const isOccupied = c.status === 'occupied';

  const [showStartForm, setShowStartForm] = useState(false);

  useEffect(() => {
    // Lock body scroll on mount
    document.body.style.overflow = 'hidden';
    
    const fetchUpcoming = async () => {
      try {
        const res = await getUpcomingClasses(c._id);
        setUpcoming(res.data);
      } catch (err) {
        console.error('Error fetching upcoming classes:', err);
      }
      setLoading(false);
    };
    fetchUpcoming();

    // Re-enable body scroll on unmount
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [c._id]);

  const typeIcon = {
    classroom: '🏫',
    laboratory: '🔬',
    hall: '🎭',
    chamber: '🚪',
  }[c.type] || '🏫';

  return (
    <div className="modal-overlay cd-modal-overlay" onClick={onClose}>
      <div className="modal cd-modal animate-pop-in" onClick={(e) => e.stopPropagation()}>
        <button className="cd-close-btn" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 24 24" width="24" height="24">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        </button>
        
        <div className="cd-header">
          <div className="cd-badge-row">
            <span className={`badge badge-${c.status}`}>
              <span className={`status-dot ${c.status}`}></span>
              {isOccupied ? 'Currently Occupied' : 'Currently Free'}
            </span>
            <span className="cd-type-badge">{typeIcon} {c.type}</span>
          </div>
          <h1>{c.name}</h1>
          <p className="cd-dept">{c.department}</p>
        </div>

        <div className="cd-grid">
          <div className="cd-main">
            {!isOccupied && role === 'teacher' && onStartClass && (
              <section className="cd-section cd-teacher-actions">
                <h3>⚡ Teacher quick actions</h3>
                {!showStartForm ? (
                  <button className="btn btn-success" style={{ width: '100%', padding: '12px' }} onClick={() => setShowStartForm(true)}>
                    ▶️ Start a Class in this Room
                  </button>
                ) : (
                  <div className="cd-start-form animate-fade-in">
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                      <input 
                        className="input" 
                        placeholder="Subject name..." 
                        value={subject} 
                        onChange={(e) => setSubject(e.target.value)} 
                        style={{ flex: 2 }}
                      />
                      <select className="select" value={semester} onChange={(e) => setSemester(e.target.value)} style={{ flex: 1 }}>
                        {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Sem {s}</option>)}
                      </select>
                      <input 
                        className="input" 
                        placeholder="Sec (e.g. A)" 
                        value={section} 
                        onChange={(e) => setSection(e.target.value)} 
                        style={{ flex: 1 }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn btn-ghost" onClick={() => setShowStartForm(false)} style={{ flex: 1 }}>Cancel</button>
                      <button 
                        className="btn btn-success" 
                        style={{ flex: 1 }} 
                        disabled={actionLoading}
                        onClick={() => { onStartClass(c._id, 'start', subject, semester, section); setShowStartForm(false); }}
                      >
                        {actionLoading ? 'Starting...' : '✅ Confirm'}
                      </button>
                    </div>
                  </div>
                )}
              </section>
            )}

            <section className="cd-section">
              <h3>📍 Location Details</h3>
              <div className="cd-info-list">
                <div className="cd-info-item">
                  <span className="label">Building</span>
                  <span className="value">{c.building}</span>
                </div>
                <div className="cd-info-item">
                  <span className="label">Floor</span>
                  <span className="value">{c.floor}</span>
                </div>
                <div className="cd-info-item">
                  <span className="label">Room No.</span>
                  <span className="value">{c.room_number}</span>
                </div>
                {c.landmark && (
                  <div className="cd-info-item">
                    <span className="label">Landmark</span>
                    <span className="value">{c.landmark}</span>
                  </div>
                )}
                <div className="cd-info-item">
                  <span className="label">Capacity</span>
                  <span className="value">{c.capacity || 'N/A'} people</span>
                </div>
                <div className="cd-info-item">
                  <span className="label">SmartBoard</span>
                  <span className={`value ${c.has_smartboard ? 'has-feature' : 'no-feature'}`}>
                    {c.has_smartboard ? '✅ Available' : '❌ Not Available'}
                  </span>
                </div>
              </div>
            </section>

            {isOccupied && (
              <section className="cd-section cd-occupied-card">
                <h3>📚 Current Occupation</h3>
                <div className="cd-occupied-info">
                  <div className="cd-occ-item">
                    <span className="icon">📖</span>
                    <div>
                      <span className="label">Ongoing Subject</span>
                      <span className="value">{c.current_subject}</span>
                    </div>
                  </div>
                  <div className="cd-occ-item">
                    <span className="icon">👨‍🏫</span>
                    <div>
                      <span className="label">Occupied By</span>
                      <span className="value">{c.current_teacher}</span>
                    </div>
                  </div>
                  <div className="cd-occ-item">
                    <span className="icon">🎓</span>
                    <div>
                      <span className="label">Batch Details</span>
                      <span className="value">Sem {c.current_semester || 'N/A'} {c.current_section && `| Sec: ${c.current_section}`}</span>
                    </div>
                  </div>
                </div>
                {role === 'teacher' && onStartClass && c.current_teacher_id === localStorage.getItem('user_id') && (
                  <button 
                    className="btn btn-danger" 
                    style={{ width: '100%', marginTop: '12px', padding: '10px' }}
                    onClick={() => onStartClass(c._id, 'end')}
                    disabled={actionLoading}
                  >
                    ⏹️ End My Class
                  </button>
                )}
              </section>
            )}
          </div>

          <div className="cd-sidebar">
            <section className="cd-section">
              <h3>📅 Today's Schedule (Upcoming)</h3>
              {loading ? (
                <div className="cd-loading">Loading schedule...</div>
              ) : upcoming.length === 0 ? (
                <div className="cd-empty">No more classes scheduled for today.</div>
              ) : (
                <div className="cd-timeline">
                  {upcoming.map((item, idx) => (
                    <div key={idx} className={`cd-timeline-item ${item.is_ongoing ? 'ongoing' : ''}`}>
                      <div className="time">{item.time_slot}</div>
                      <div className="content">
                        <div className="subject">
                          {item.subject} 
                          {item.is_ongoing && <span className="now-badge">LIVELY</span>}
                        </div>
                        <div className="teacher">{item.teacher}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
        
        <div className="cd-footer">
          <p>⚠️ Schedule based on latest Timetable analysis (ML OCR)</p>
        </div>
      </div>
    </div>
  );
}

export default ClassroomDetailsModal;
