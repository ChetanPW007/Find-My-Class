import { useState, useRef, useEffect } from 'react';
import { sendChatMessage } from '../api';
import './ChatBot.css';

function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      from: 'bot',
      text: "👋 Hi! I'm your campus assistant. Ask me about classrooms, schedules, or room availability!",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { from: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const res = await sendChatMessage(userMsg);
      const data = res.data;
      setMessages((prev) => [
        ...prev,
        {
          from: 'bot',
          text: data.response,
          type: data.type,
          results: data.results,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { from: 'bot', text: '❌ Sorry, something went wrong. Please try again.' },
      ]);
    }
    setLoading(false);
  };

  const quickQuestions = [
    "Where is CS Lab 1?",
    "Is EC Room 101 free?",
    "Monday schedule",
    "Find Machine Learning class",
  ];

  return (
    <>
      {/* Toggle Button */}
      <button
        id="chatbot-toggle"
        className={`chatbot-toggle ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? '✕' : '🤖'}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="chatbot-window animate-slide-up">
          <div className="chatbot-header">
            <div className="chatbot-title">
              <span className="chatbot-avatar">🤖</span>
              <div>
                <h4>Campus AI Assistant</h4>
                <span className="chatbot-status">
                  <span className="pulse-dot"></span> Online
                </span>
              </div>
            </div>
          </div>

          <div className="chatbot-messages">
            {messages.map((msg, i) => (
              <div key={i} className={`chat-msg ${msg.from}`}>
                {msg.from === 'bot' && <span className="msg-avatar">🤖</span>}
                <div className="msg-content">
                  <div className="msg-text" dangerouslySetInnerHTML={{
                    __html: msg.text
                      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                      .replace(/\n/g, '<br/>')
                  }} />
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
                  className="quick-btn"
                  onClick={() => { setInput(q); }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          <form className="chatbot-input" onSubmit={handleSend}>
            <input
              id="chatbot-input"
              className="input"
              type="text"
              placeholder="Ask about classrooms, schedules..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
            />
            <button
              type="submit"
              className="btn btn-primary send-btn"
              disabled={loading || !input.trim()}
            >
              ➤
            </button>
          </form>
        </div>
      )}
    </>
  );
}

export default ChatBot;
