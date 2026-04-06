import { useState, useEffect } from 'react';
import { predictOccupancy, trainModel, getPredictStats } from '../api';
import './PredictionPanel.css';

function PredictionPanel({ showToast }) {
  const [stats, setStats] = useState(null);
  const [form, setForm] = useState({ day: '', time_slot: '', classroom: '', department: '' });
  const [prediction, setPrediction] = useState(null);
  const [training, setTraining] = useState(false);
  const [trainResult, setTrainResult] = useState(null);
  const [predicting, setPredicting] = useState(false);

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    try { const res = await getPredictStats(); setStats(res.data); }
    catch (e) { console.error(e); }
  };

  const handleTrain = async () => {
    setTraining(true);
    try {
      const res = await trainModel();
      setTrainResult(res.data);
      showToast(res.data.trained ? '✅ Model trained!' : '⚠️ Not enough data');
    } catch (err) {
      showToast('Training failed', 'error');
    }
    setTraining(false);
  };

  const handlePredict = async (e) => {
    e.preventDefault();
    setPredicting(true);
    try {
      const res = await predictOccupancy(form);
      setPrediction(res.data);
    } catch (err) {
      showToast(err.response?.data?.error || 'Prediction failed', 'error');
    }
    setPredicting(false);
  };

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const timeSlots = [
    '09:00-10:00', '10:00-11:00', '11:00-12:00',
    '12:00-13:00', '14:00-15:00', '15:00-16:00', '16:00-17:00',
  ];

  return (
    <div className="prediction-panel">
      <div className="section-header">
        <h2>🧠 ML Occupancy Prediction</h2>
        <button
          className="btn btn-accent"
          onClick={handleTrain}
          disabled={training}
        >
          {training ? '⏳ Training...' : '🔄 Train Model'}
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="pred-stats">
          <div className="pred-stat-card">
            <span className="pred-stat-value">{stats.total_entries}</span>
            <span className="pred-stat-label">Training Entries</span>
          </div>
          <div className="pred-stat-card">
            <span className="pred-stat-value">{stats.classrooms?.length || 0}</span>
            <span className="pred-stat-label">Unique Classrooms</span>
          </div>
          <div className="pred-stat-card">
            <span className="pred-stat-value">{stats.departments?.length || 0}</span>
            <span className="pred-stat-label">Departments</span>
          </div>
          <div className="pred-stat-card">
            <span className="pred-stat-value">{stats.days?.length || 0}</span>
            <span className="pred-stat-label">Active Days</span>
          </div>
        </div>
      )}

      {/* Train Result */}
      {trainResult && (
        <div className={`train-result ${trainResult.trained ? 'success' : 'warning'}`}>
          <p>{trainResult.message}</p>
          {trainResult.accuracy != null && (
            <p>📊 Accuracy: <strong>{(trainResult.accuracy * 100).toFixed(1)}%</strong> | Samples: {trainResult.total_samples}</p>
          )}
        </div>
      )}

      {/* Prediction Form */}
      <div className="pred-form-card">
        <h3>🔮 Make a Prediction</h3>
        <p className="pred-desc">Select a day, time slot, and classroom to predict occupancy status.</p>

        <form onSubmit={handlePredict} className="pred-form">
          <div className="grid-2">
            <div className="form-group">
              <label>Day</label>
              <select className="select" value={form.day} onChange={(e) => setForm({...form, day: e.target.value})} required>
                <option value="">Select day</option>
                {days.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Time Slot</label>
              <select className="select" value={form.time_slot} onChange={(e) => setForm({...form, time_slot: e.target.value})} required>
                <option value="">Select time</option>
                {timeSlots.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label>Classroom</label>
              <select className="select" value={form.classroom} onChange={(e) => setForm({...form, classroom: e.target.value})}>
                <option value="">Any classroom</option>
                {(stats?.classrooms || []).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Department</label>
              <select className="select" value={form.department} onChange={(e) => setForm({...form, department: e.target.value})}>
                <option value="">Any department</option>
                {(stats?.departments || []).map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={predicting}>
            {predicting ? '⏳ Predicting...' : '🔮 Predict Occupancy'}
          </button>
        </form>
      </div>

      {/* Prediction Result */}
      {prediction && (
        <div className={`pred-result ${prediction.prediction === 'occupied' ? 'occupied' : 'free'}`}>
          <div className="pred-result-icon">
            {prediction.prediction === 'occupied' ? '🔴' : '🟢'}
          </div>
          <div className="pred-result-info">
            <h3>Predicted: <span className={prediction.prediction}>{prediction.prediction.toUpperCase()}</span></h3>
            <p>Confidence: <strong>{(prediction.confidence * 100).toFixed(1)}%</strong></p>
            <p className="pred-details">
              {prediction.details.classroom || 'Any classroom'} on {prediction.details.day} at {prediction.details.time_slot}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default PredictionPanel;
