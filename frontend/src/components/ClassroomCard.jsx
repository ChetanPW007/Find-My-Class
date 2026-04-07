import './ClassroomCard.css';

function ClassroomCard({ classroom, onClick, delay = 0 }) {
  const c = classroom;
  const isOccupied = c.status === 'occupied';
  const typeIcon = {
    classroom: '🏫',
    laboratory: '🔬',
    hall: '🎭',
    chamber: '🚪',
  }[c.type] || '🏫';
  return (
    <div
      className={`classroom-card ${isOccupied ? 'occupied' : 'free'}`}
      style={{ animationDelay: `${delay}s`, cursor: 'pointer' }}
      onClick={() => onClick && onClick(c)}
    >
      <div className="cc-top">
        <div className="cc-type">
          <span className="cc-type-icon">{typeIcon}</span>
          <span className="cc-type-label">{c.type}</span>
        </div>
        <span className={`badge badge-${c.status}`}>
          <span className={`status-dot ${c.status}`}></span>
          {isOccupied ? 'Occupied' : 'Free'}
        </span>
      </div>

      <h3 className="cc-name">{c.name}</h3>
      <p className="cc-dept">{c.department}</p>

      <div className="cc-info">
        <div className="cc-info-item">
          <span className="cc-info-icon">📍</span>
          <span>{c.building}, {c.floor}{c.landmark && ` — ${c.landmark}`}</span>
        </div>
        <div className="cc-info-item">
          <span className="cc-info-icon">🚪</span>
          <span>Room {c.room_number}</span>
        </div>
        {c.capacity > 0 && (
          <div className="cc-info-item">
            <span className="cc-info-icon">👥</span>
            <span>Capacity: {c.capacity}</span>
          </div>
        )}
      </div>

      {isOccupied && (
        <div className="cc-occupied-info">
          <div className="cc-occupied-row">
            <span>📚</span>
            <span>{c.current_subject || 'Ongoing class'}</span>
          </div>
          <div className="cc-occupied-row">
            <span>👨‍🏫</span>
            <span>{c.current_teacher || 'Teacher'}</span>
          </div>
          <div className="cc-occupied-row">
            <span>🎓</span>
            <span>Sem {c.current_semester || 'N/A'} {c.current_section && `| Sec: ${c.current_section}`}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default ClassroomCard;
