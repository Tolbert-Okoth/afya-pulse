import { useState, useEffect, useRef } from 'react'; 
import axios from 'axios'; 
import { useAuth } from '../context/AuthContext'; 
import { io } from 'socket.io-client'; 
import { Thermometer, Send, AlertTriangle, RotateCcw, Info, Activity, Mic, MicOff, MessageSquare, MapPin, Phone } from 'lucide-react';
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

  // 🛡️ CORRECT BACKEND URL (Port 4000)
  const BACKEND_URL = "http://localhost:4000/api";

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

    // 🛡️ Socket Connects to Port 4000
    const socket = io('http://localhost:4000');
    socket.on('connect', () => console.log("🟢 Nurse Kiosk Connected (Port 4000)"));
    
    socket.on('queue_update', () => {
      fetchStatus(); 
    });

    return () => socket.disconnect();
  }, [token]);

  const getStatusColor = (status) => {
    switch(status) {
      case 'CRITICAL': return 'linear-gradient(135deg, #EF4444 0%, #991B1B 100%)'; 
      case 'HIGH': return 'linear-gradient(135deg, #F59E0B 0%, #B45309 100%)'; 
      case 'MODERATE': return 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)'; 
      default: return 'linear-gradient(135deg, #10B981 0%, #047857 100%)'; 
    }
  };

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

      // 🛡️ API Call to Port 4000 with Auth Header
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

  return (
    <div className="main-content">
      <div style={{ marginBottom: '2rem' }}>
        <h2>Nurse Kiosk</h2>
        <p className="subtitle">AI-Powered Patient Triage System</p>
      </div>

      <div className="split-layout">
        
        {/* LEFT PANEL */}
        <div className="left-panel">
          
          {/* 1. INITIAL FORM */}
          {!result && (
            <section className="card">
               <h3 className="flex items-center gap-2"><Thermometer className="text-blue-500"/> Patient Intake</h3>
               <p style={{ color: '#6B7280', marginBottom: '20px' }}>
                Enter demographics and describe the condition. The AI will analyze urgency.
              </p>
              
              <form onSubmit={(e) => handleSubmit(e, false)}>
                
                {/* Age & Gender */}
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <label>Patient Age</label>
                    <input 
                      type="number" 
                      placeholder="e.g. 45" 
                      required
                      min="0" max="120"
                      value={formData.age}
                      onChange={e => setFormData({...formData, age: e.target.value})}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label>Gender</label>
                    <select 
                      value={formData.gender}
                      onChange={e => setFormData({...formData, gender: e.target.value})}
                      required
                    >
                      <option value="">Select...</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                </div>

                {/* PHONE NUMBER INPUT */}
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Phone size={16} /> Patient Phone Number
                  </label>
                  <input 
                    type="tel" 
                    placeholder="e.g. 0712 345 678" 
                    required
                    value={formData.phone}
                    onChange={e => {
                        setFormData({...formData, phone: e.target.value});
                        if (error.includes('phone')) setError(''); 
                    }}
                    style={{ 
                        width: '100%', padding: '10px', borderRadius: '6px', 
                        border: error.includes('phone') ? '1px solid #EF4444' : '1px solid #D1D5DB', 
                        fontSize: '1rem' 
                    }}
                  />
                </div>

                {/* Location */}
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <MapPin size={16} /> Location (County)
                  </label>
                  <select 
                    value={formData.location}
                    onChange={e => setFormData({...formData, location: e.target.value})}
                    required
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #D1D5DB' }}
                  >
                    <option value="">Select County...</option>
                    {LOCATIONS.map(loc => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                </div>

                <div className="input-group" style={{ position: 'relative' }}>
                  <label style={{ marginBottom: '8px', display: 'block' }}>Symptoms Description</label>
                  <textarea 
                    rows="6" 
                    placeholder="e.g. Severe chest pressure... (Type or use Mic)" 
                    required
                    value={isListening ? (formData.symptoms + " " + interimTranscript) : formData.symptoms}
                    onChange={e => setFormData({...formData, symptoms: e.target.value})}
                    style={{ paddingRight: '50px', borderColor: isListening ? '#EF4444' : '#E5E7EB' }} 
                  ></textarea>

                  <button 
                    type="button"
                    onClick={toggleVoiceInput}
                    style={{
                      position: 'absolute', right: '15px', bottom: '15px',
                      background: isListening ? '#EF4444' : '#F3F4F6',
                      color: isListening ? 'white' : '#6B7280',
                      border: 'none', borderRadius: '50%', width: '40px', height: '40px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                      transform: isListening ? 'scale(1.1)' : 'scale(1)', transition: 'all 0.2s'
                    }}
                  >
                    {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                  </button>
                </div>

                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'Analyzing...' : <> <Send size={18} /> Start Triage </>}
                </button>
              </form>
              
              {error && (
                <div className="error-msg" style={{ 
                    marginTop: '15px', padding: '10px', background: '#FEF2F2', 
                    color: '#DC2626', border: '1px solid #FECACA', borderRadius: '8px',
                    display: 'flex', alignItems: 'center', gap: '8px'
                }}>
                    <AlertTriangle size={18}/> {error}
                </div>
              )}
            </section>
          )}

          {/* 2. RESULT CARD */}
          {result && (
             <section className={`card border-${result.data.triage_category}`}>
                <div className="result-header">
                  <h3>Triage Analysis</h3>
                  <span className={`badge badge-${result.data.triage_category}`}>
                    {result.data.triage_category}
                  </span>
                </div>
                
                <div className="result-details">
                  <div style={{ marginBottom: '15px' }}>
                    <strong style={{ display:'block', marginBottom:'5px', color:'#374151' }}>📝 Clinical Assessment:</strong>
                    <p style={{ margin:0, color:'#4B5563', fontStyle:'italic' }}>"{result.ai_analysis?.reasoning}"</p>
                  </div>

                  {result.ai_analysis?.follow_up_questions && result.ai_analysis.follow_up_questions.length > 0 ? (
                    <div style={{ marginBottom: '20px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '8px', padding: '15px' }}>
                      <strong style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px', color:'#1E40AF' }}>
                        <MessageSquare size={18} /> AI Needs More Info:
                      </strong>
                      {result.ai_analysis.follow_up_questions.map((q, i) => (
                        <div key={i} style={{ marginBottom: '12px' }}>
                          <label style={{ display:'block', fontSize:'0.9rem', color:'#1E3A8A', marginBottom:'4px', fontWeight:'500' }}>{q}</label>
                          <input 
                            type="text" 
                            placeholder="Type patient's answer..."
                            value={followUpAnswers[`q${i}`] || ''}
                            onChange={(e) => setFollowUpAnswers({...followUpAnswers, [`q${i}`]: e.target.value})}
                            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #93C5FD', fontSize:'0.95rem' }}
                          />
                        </div>
                      ))}
                      <button className="btn-primary" style={{ width:'100%', marginTop:'10px', background:'#2563EB', justifyContent:'center' }} onClick={(e) => handleSubmit(e, true)} disabled={loading}>
                          {loading ? 'Thinking...' : 'Submit Answers & Refine Triage'}
                      </button>
                    </div>
                  ) : (
                    <div style={{ textAlign:'center', padding:'10px', background:'#ECFDF5', color:'#065F46', borderRadius:'8px', marginBottom:'15px', border:'1px solid #A7F3D0' }}>
                        ✅ <strong>Assessment Complete</strong><br/><span style={{fontSize:'0.85rem'}}>No further questions required.</span>
                    </div>
                  )}

                  {result.ai_analysis?.possible_conditions && (
                    <div style={{ marginBottom: '15px' }}>
                      <strong style={{ display:'block', marginBottom:'5px', color:'#374151' }}>🔍 Potential Conditions:</strong>
                      <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                        {result.ai_analysis.possible_conditions.map((cause, i) => (
                          <span key={i} style={{ background:'#F3F4F6', padding:'4px 10px', borderRadius:'15px', fontSize:'0.85rem', color:'#374151' }}>{cause}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.ai_analysis?.advice && (
                    <div className="advice-box">
                      <strong>💡 Recommendation:</strong>
                      <p>{result.ai_analysis.advice}</p>
                    </div>
                  )}
                  
                  <div style={{ fontSize:'0.75rem', color:'#9CA3AF', marginTop:'20px', borderTop:'1px solid #E5E7EB', paddingTop:'10px' }}>
                    ⚠️ <strong>Disclaimer:</strong> {result.ai_analysis?.disclaimer || "Not a medical diagnosis."}
                  </div>

                  <button className="btn-primary" onClick={handleReset} style={{ marginTop: '24px', background: '#374151' }}>
                    <RotateCcw size={18} /> Process Next Patient
                  </button>
                </div>
             </section>
          )}
        </div>

        {/* RIGHT PANEL - STATUS */}
        <div className="right-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card" style={{ padding: '1.5rem' }}>
             <h3 className="flex items-center gap-2"><Info size={18} /> Triage Guidelines</h3>
             <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.9rem', color: '#4B5563' }}>
              <li style={{ marginBottom: '12px', display: 'flex', gap: '10px' }}>
                <span className="badge badge-RED" style={{ fontSize: '0.7rem' }}>RED</span> <span>Life-threatening</span>
              </li>
              <li style={{ marginBottom: '12px', display: 'flex', gap: '10px' }}>
                <span className="badge badge-YELLOW" style={{ fontSize: '0.7rem' }}>YELLOW</span> <span>Urgent</span>
              </li>
              <li style={{ display: 'flex', gap: '10px' }}>
                <span className="badge badge-GREEN" style={{ fontSize: '0.7rem' }}>GREEN</span> <span>Self-care</span>
              </li>
            </ul>
          </div>

          <div className="card" style={{ 
            background: getStatusColor(systemStatus), 
            color: 'white',
            transition: 'background 0.5s ease' 
          }}>
            <h3 style={{ color: 'white', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Activity size={20} /> Surveillance Level
            </h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', opacity: 0.9 }}>
              <span>Triage Load:</span> <strong style={{ fontSize: '1.1rem' }}>{systemStatus}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', opacity: 0.9, marginTop: '8px' }}>
              <span>AI Model:</span> <strong>Online (v2.1)</strong>
            </div>
            {(systemStatus === 'HIGH' || systemStatus === 'CRITICAL') && (
               <div style={{ marginTop: '15px', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '8px', fontSize: '0.85rem' }}>
                 ⚠️ High report volume detected.
               </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default NurseKiosk;