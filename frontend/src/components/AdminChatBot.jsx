import { useState, useRef, useEffect } from 'react';
import { sendAdminChatMessage, addBatchTimetable } from '../api';
import './AdminChatBot.css';

function AdminChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      from: 'bot',
      text: "👋 Hi Admin! I can help you add subjects to the timetable or extract timetable details from an uploaded image.",
    },
  ]);
  const [input, setInput] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if ((!input.trim() && !imageFile) || loading) return;

    const userText = input.trim();
    const hasImage = !!imageFile;
    
    // Add user message to UI
    let userMsgDisplay = userText;
    if (hasImage) {
      userMsgDisplay = userText ? `${userText} (Image Attached)` : `Uploaded an image: ${imageFile.name}`;
    }

    setMessages((prev) => [...prev, { from: 'user', text: userMsgDisplay }]);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('query', userText);
      if (imageFile) {
        formData.append('image', imageFile);
      }

      // Clear inputs
      setInput('');
      setImageFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      const res = await sendAdminChatMessage(formData);
      const data = res.data;
      
      setMessages((prev) => [
        ...prev,
        {
          from: 'bot',
          text: data.response,
          type: data.type,
          results: data.results, // Useful for timetable_preview
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { from: 'bot', text: '❌ Sorry, something went wrong. ' + (err.response?.data?.error || err.message) },
      ]);
    }
    setLoading(false);
  };

  const handleSaveBatch = async (entries) => {
    setLoading(true);
    try {
      await addBatchTimetable({ entries });
      setMessages((prev) => [
        ...prev,
        { from: 'bot', text: '✅ Timetable entries saved successfully!' }
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { from: 'bot', text: '❌ Failed to save entries: ' + (err.response?.data?.error || 'Unknown error') }
      ]);
    }
    setLoading(false);
  };

  const quickQuestions = [
    "Add subject Math by John in room 101 on Monday from 10:00 To 11:30"
  ];

  return (
    <>
      {/* Toggle Button */}
      <button
        id="admin-chatbot-toggle"
        className={`chatbot-toggle admin-toggle ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Admin AI Assistant"
      >
        {isOpen ? '✕' : '🤖'}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="chatbot-window admin-window animate-slide-up">
          <div className="chatbot-header admin-header">
            <div className="chatbot-title">
              <span className="chatbot-avatar">🤖</span>
              <div>
                <h4>Admin AI Assistant</h4>
                <span className="chatbot-status">
                  <span className="pulse-dot"></span> Online - High Privilege
                </span>
              </div>
            </div>
          </div>

          <div className="chatbot-messages admin-messages">
            {messages.map((msg, i) => (
              <div key={i} className={`chat-msg ${msg.from}`}>
                {msg.from === 'bot' && <span className="msg-avatar">🤖</span>}
                <div className="msg-content w-full">
                  <div className="msg-text" dangerouslySetInnerHTML={{
                    __html: msg.text
                      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                      .replace(/\n/g, '<br/>')
                  }} />
                  
                  {/* Custom Renderer for Timetable Preview */}
                  {msg.type === 'timetable_preview' && msg.results && msg.results.length > 0 && (
                    <div className="timetable-preview-box">
                      <table className="preview-table">
                        <thead>
                          <tr>
                            <th>Day</th>
                            <th>Time</th>
                            <th>Subject</th>
                            <th>Teacher</th>
                            <th>Room</th>
                          </tr>
                        </thead>
                        <tbody>
                          {msg.results.map((entry, idx) => (
                            <tr key={idx}>
                              <td>{entry.day}</td>
                              <td>{entry.time_slot}</td>
                              <td><strong>{entry.subject}</strong></td>
                              <td>{entry.teacher}</td>
                              <td>{entry.classroom}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <button 
                        className="btn btn-primary btn-sm mt-2 w-full"
                        onClick={() => handleSaveBatch(msg.results)}
                        disabled={loading}
                      >
                        📥 Save {msg.results.length} Entries to Database
                      </button>
                    </div>
                  )}
                  
                  {msg.type === 'timetable_preview' && (!msg.results || msg.results.length === 0) && (
                    <div className="text-sm text-red">No entities detected in image.</div>
                  )}
                  
                </div>
              </div>
            ))}
            {loading && (
              <div className="chat-msg bot">
                <span className="msg-avatar">🤖</span>
                <div className="msg-content">
                  <div className="typing-indicator">
                    <span></span><span></span><span></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Questions */}
          {messages.length <= 1 && (
            <div className="quick-questions">
              {quickQuestions.map((q, i) => (
                <button
                  key={i}
                  className="quick-btn admin-quick-btn"
                  onClick={() => { setInput(q); }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Image preview banner if file is selected */}
          {imageFile && (
            <div className="image-preview-banner">
              <span className="filename">🖼️ {imageFile.name}</span>
              <button 
                type="button" 
                className="remove-img-btn" 
                onClick={() => { setImageFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
              >✕</button>
            </div>
          )}

          <form className="chatbot-input admin-input-form" onSubmit={handleSend}>
             <button
              type="button"
              className="attach-btn"
              onClick={() => fileInputRef.current?.click()}
              title="Upload Timetable Image"
            >
              📎
            </button>
            <input
              type="file"
              accept="image/*,.pdf,.doc,.docx"
              style={{ display: 'none' }}
              ref={fileInputRef}
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  setImageFile(e.target.files[0]);
                }
              }}
            />
            
            <input
              id="admin-chatbot-input"
              className="input chat-input"
              type="text"
              placeholder={imageFile ? "Add instruction (optional)..." : "Ask or upload timetable..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
            />
            <button
              type="submit"
              className="btn btn-primary admin-send-btn"
              disabled={loading || (!input.trim() && !imageFile)}
            >
              ➤
            </button>
          </form>
        </div>
      )}
    </>
  );
}

export default AdminChatBot;
