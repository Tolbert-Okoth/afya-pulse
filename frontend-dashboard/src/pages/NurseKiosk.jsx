import { useState, useEffect, useRef } from 'react'; 
import axios from 'axios'; 
import { useAuth } from '../context/AuthContext'; 
import { io } from 'socket.io-client';
import { auth } from '../firebaseConfig'; 
import { Send, AlertTriangle, RotateCcw, Info, Activity, Mic, MicOff, MessageSquare, MapPin, Phone } from 'lucide-react';
import '../App.css'; 

const NurseKiosk = () => {
  const { token } = useAuth(); // Get Token
  const [formData, setFormData] = useState({ 
    symptoms: '', location: '', age: '', gender: '', phone: '' 
  });
  
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [systemStatus, setSystemStatus] = useState('NORMAL');
  
  const [history, setHistory] = useState([]); 
  const [followUpAnswers, setFollowUpAnswers] = useState({}); 

  // VOICE STATE
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState(''); 
  const recognitionRef = useRef(null);

  // 🛡️ DYNAMIC URL CONFIGURATION
  const BASE_URL = import.meta.env.VITE_API_URL || "https://afya-pulse-backend.onrender.com";
  const BACKEND_URL = `${BASE_URL}/api`;

  // 📍 LOCATIONS
  const LOCATIONS = [
    "Baringo", "Bomet", "Bungoma", "Busia", "Elgeyo-Marakwet", "Embu", "Garissa", 
    "Homa Bay", "Isiolo", "Kajiado", "Kakamega", "Kericho", "Kiambu", "Kilifi", 
    "Kirinyaga", "Kisii", "Kisumu", "Kitui", "Kwale", "Laikipia", "Lamu", 
    "Machakos", "Makueni", "Mandera", "Marsabit", "Meru", "Migori", "Mombasa", 
    "Murang'a", "Nairobi", "Nakuru", "Nandi", "Narok", "Nyamira", "Nyandarua", 
    "Nyeri", "Samburu", "Siaya", "Taita Taveta", "Tana River", "Tharaka-Nithi", 
    "Trans Nzoia", "Turkana", "Uasin Gishu", "Vihiga", "Wajir", "West Pokot"
  ];

  useEffect(() => {
    const fetchStatus = async () => {
      if (!token) return;

      try {
        const res = await axios.get(`${BACKEND_URL}/triage/stats`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data.system_status) {
          setSystemStatus(res.data.system_status);
        }
      } catch (err) {
        console.error("Status fetch failed", err);
      }
    };

    fetchStatus();

    // 🛡️ Socket Connects to Dynamic BASE_URL
    // Server rejects sockets without a valid Firebase token
    const socket = io(BASE_URL, {
      auth: async (cb) => cb({ token: auth.currentUser ? await auth.currentUser.getIdToken() : null }),
    });
    socket.on('connect', () => console.log(`🟢 Nurse Kiosk Connected: ${BASE_URL}`));
    
    socket.on('queue_update', () => {
      fetchStatus(); 
    });

    return () => socket.disconnect();
    // ✅ Added BACKEND_URL to dependencies to satisfy ESLint
  }, [token, BASE_URL, BACKEND_URL]);

  const correctMedicalTerms = (text) => {
    let cleanText = text.toLowerCase();
    const corrections = {
      'coffee': 'coughing', 'coffin': 'coughing', 'bleeding heavily': 'hemorrhaging', 
      'high blood pleasure': 'high blood pressure', 'hyper tension': 'hypertension',
      'die a beat is': 'diabetes', 'sugar': 'diabetes', 'hot': 'fever',
      'belly': 'abdominal', 'tommy': 'tummy', 'hurt': 'pain',
      'sick': 'nausea', 'throw up': 'vomiting', 'throwing up': 'vomiting',
      'hard attack': 'heart attack', 'chest pane': 'chest pain', 'chest pen': 'chest pain' 
    };
    Object.keys(corrections).forEach(wrongWord => {
      const regex = new RegExp(`\\b${wrongWord}\\b`, 'gi');
      cleanText = cleanText.replace(regex, corrections[wrongWord]);
    });
    return cleanText;
  };

  const toggleVoiceInput = () => {
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
      setInterimTranscript('');
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Your browser does not support voice input. Please use Google Chrome.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-KE'; 
    recognition.interimResults = true; 
    recognition.continuous = true;     
    recognitionRef.current = recognition;
    setIsListening(true);

    recognition.onresult = (event) => {
      let finalChunk = '';
      let interimChunk = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalChunk += correctMedicalTerms(event.results[i][0].transcript);
        } else {
          interimChunk += event.results[i][0].transcript;
        }
      }
      if (finalChunk) {
        setFormData(prev => ({ 
          ...prev, 
          symptoms: (prev.symptoms + " " + finalChunk).trim().replace(/^\w/, c => c.toUpperCase()) 
        }));
      }
      setInterimTranscript(interimChunk);
    };

    recognition.onerror = (event) => {
      console.error("Speech error", event.error);
      setIsListening(false);
      if (event.error === 'network' || event.error === 'service-not-allowed') {
        alert("Voice Dictation Failed. Please use Chrome/Edge.");
      }
    };
    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript('');
    };
    recognition.start();
  };

  const validateKenyanPhone = (phone) => {
    const regex = /^(?:254|\+254|0)?(7|1)\d{8}$/;
    return regex.test(phone.replace(/\s+/g, '')); 
  };

  const handleSubmit = async (e, isFollowUp = false) => {
    if(e) e.preventDefault();
    setError('');

    if (!isFollowUp) {
        if (!formData.phone || !validateKenyanPhone(formData.phone)) {
            setError('Please enter a valid Kenyan phone number (e.g. 0712 345 678)');
            return; 
        }
    }
    
    setLoading(true);
    
    try {
      let currentInput = formData.symptoms;
      let currentHistory = [...history];

      if (isFollowUp) {
        if (result && result.ai_analysis?.follow_up_questions) {
            const aiQuestions = result.ai_analysis.follow_up_questions.join(" ");
            currentHistory.push({ role: 'assistant', content: aiQuestions });
        }

        const answersText = Object.values(followUpAnswers).filter(a => a).join(". ");
        if (!answersText) {
            setLoading(false);
            return; 
        }
        currentInput = answersText;
        currentHistory.push({ role: 'user', content: currentInput });
      } else {
        currentHistory.push({ role: 'user', content: formData.symptoms });
      }

      const res = await axios.post(`${BACKEND_URL}/triage`, { 
          ...formData, 
          symptoms: currentInput,
          history: currentHistory 
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setResult(res.data);
      setHistory(currentHistory); 
      setFollowUpAnswers({}); 
      
    } catch (err) {
      console.error("Triage submission error:", err);
      setError(err.response?.data?.error || 'System Error: Could not reach Triage Server.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFormData({ symptoms: '', location: '', age: '', gender: '', phone: '' });
    setResult(null);
    setHistory([]);
    setFollowUpAnswers({});
    setError('');
  };

  const category = result?.data?.triage_category;
  const CATEGORY_COPY = {
    RED: 'Life-threatening: see a clinician now',
    YELLOW: 'Urgent: needs review soon',
    GREEN: 'Self-care advice is appropriate',
  };

  return (
    <div className="main-content">
      <div className="page-head">
        <div>
          <p className="eyebrow">Patient intake</p>
          <h2>{result ? 'Triage result' : 'New patient'}</h2>
        </div>
        {result && (
          <button type="button" className="btn-primary btn-secondary" style={{ width: 'auto' }} onClick={handleReset}>
            <RotateCcw size={16} /> Next patient
          </button>
        )}
      </div>

      <div className="split-layout">
        <div>
          {!result && (
            <section className="card intake-card">
              <div className="intake-steps" aria-hidden="true">
                <span className="on">1 Details</span><span>→</span><span className="on">2 Symptoms</span><span>→</span><span>3 Tag</span>
              </div>

              <form onSubmit={(e) => handleSubmit(e, false)}>
                <div className="field-row">
                  <div className="field">
                    <label htmlFor="age">Age</label>
                    <input id="age" type="number" placeholder="e.g. 45" required min="0" max="120"
                      value={formData.age} onChange={e => setFormData({ ...formData, age: e.target.value })} />
                  </div>
                  <div className="field">
                    <label htmlFor="gender">Sex</label>
                    <select id="gender" value={formData.gender} required
                      onChange={e => setFormData({ ...formData, gender: e.target.value })}>
                      <option value="">Select…</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                </div>

                <div className="field-row">
                  <div className="field">
                    <label htmlFor="phone"><Phone size={14} /> Phone number</label>
                    <input id="phone" type="tel" placeholder="0712 345 678" required
                      className={error.includes('phone') ? 'invalid' : ''}
                      value={formData.phone}
                      onChange={e => {
                        setFormData({ ...formData, phone: e.target.value });
                        if (error.includes('phone')) setError('');
                      }} />
                  </div>
                  <div className="field">
                    <label htmlFor="county"><MapPin size={14} /> County</label>
                    <select id="county" value={formData.location} required
                      onChange={e => setFormData({ ...formData, location: e.target.value })}>
                      <option value="">Select county…</option>
                      {LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                    </select>
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="symptoms">Symptoms, in the patient&apos;s words</label>
                  <div className={`symptom-box ${isListening ? 'listening' : ''}`}>
                    <textarea id="symptoms" rows="6" required
                      placeholder="e.g. Chest pressure since this morning, short of breath when walking… (type or dictate)"
                      value={isListening ? (formData.symptoms + ' ' + interimTranscript) : formData.symptoms}
                      onChange={e => setFormData({ ...formData, symptoms: e.target.value })} />
                    <button type="button" onClick={toggleVoiceInput} className={`mic-btn ${isListening ? 'on' : ''}`}
                      aria-label={isListening ? 'Stop dictation' : 'Dictate symptoms'}>
                      {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                    </button>
                  </div>
                </div>

                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'Assessing…' : <><Send size={17} /> Assess and tag patient</>}
                </button>
              </form>

              {error && (
                <div className="form-error" role="alert"><AlertTriangle size={17} /> {error}</div>
              )}
            </section>
          )}

          {result && (
            <section className={`card result-tag ${category}`}>
              <div className="result-tag-head">
                <div>
                  <h3>{category}</h3>
                  <p>{CATEGORY_COPY[category] || 'Assessment recorded'}</p>
                </div>
                <span className="eyelet" aria-hidden="true" />
              </div>
              <div className="result-tag-perf" />

              <div className="result-body">
                <div className="result-block">
                  <h4>Clinical assessment</h4>
                  <p>{result.ai_analysis?.reasoning}</p>
                </div>

                {result.ai_analysis?.follow_up_questions?.length > 0 ? (
                  <div className="followup">
                    <div className="result-block" style={{ marginBottom: 12 }}>
                      <h4><MessageSquare size={13} /> Ask the patient</h4>
                    </div>
                    {result.ai_analysis.follow_up_questions.map((q, i) => (
                      <div key={i} className="field">
                        <label htmlFor={`fq${i}`}>{q}</label>
                        <input id={`fq${i}`} type="text" placeholder="Patient's answer"
                          value={followUpAnswers[`q${i}`] || ''}
                          onChange={(e) => setFollowUpAnswers({ ...followUpAnswers, [`q${i}`]: e.target.value })} />
                      </div>
                    ))}
                    <button className="btn-primary" onClick={(e) => handleSubmit(e, true)} disabled={loading}>
                      {loading ? 'Re-assessing…' : 'Submit answers and re-assess'}
                    </button>
                  </div>
                ) : (
                  <div className="complete-note">Assessment complete: no further questions.</div>
                )}

                {result.ai_analysis?.possible_conditions?.length > 0 && (
                  <div className="result-block">
                    <h4>Possible causes</h4>
                    <div className="conditions">
                      {result.ai_analysis.possible_conditions.map((cause, i) => <span key={i}>{cause}</span>)}
                    </div>
                  </div>
                )}

                {result.ai_analysis?.advice && (
                  <div className="result-block advice-box">
                    <h4>Next step</h4>
                    <p>{result.ai_analysis.advice}</p>
                  </div>
                )}

                <p className="disclaimer">
                  {result.ai_analysis?.disclaimer || 'Decision support only, not a diagnosis. A clinician confirms every RED and YELLOW tag.'}
                </p>
              </div>
            </section>
          )}
        </div>

        <aside className="stack">
          <section className="card">
            <h3><Info size={16} /> Tag guide</h3>
            <ul className="guide-list">
              <li><span className="badge badge-RED">RED</span><span>Life-threatening, see now</span></li>
              <li><span className="badge badge-YELLOW">YELLOW</span><span>Urgent, see soon</span></li>
              <li><span className="badge badge-GREEN">GREEN</span><span>Self-care advice</span></li>
            </ul>
          </section>

          <section className={`card load-panel ${systemStatus}`}>
            <h3><Activity size={16} /> Network load</h3>
            <div className="load-value">{systemStatus}</div>
            <div className="load-row"><span>Triage engine</span><strong>online</strong></div>
            {(systemStatus === 'HIGH' || systemStatus === 'CRITICAL') && (
              <div className="load-warn">High volume of urgent reports right now.</div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
};

export default NurseKiosk;