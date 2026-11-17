import { useState, useEffect, useRef } from 'react'; 
import axios from 'axios'; 
import { useAuth } from '../context/AuthContext'; 
import { io } from 'socket.io-client';
import { auth } from '../firebaseConfig';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { CheckCircle, Map as MapIcon, Check, Phone, MessageCircle } from 'lucide-react';
import DiseaseMap from '../components/DiseaseMap';
import OutbreakBanner from '../components/OutbreakBanner'; 
import '../App.css';

const DoctorDashboard = () => {
  const { token } = useAuth(); 
  const [stats, setStats] = useState([]);
  const [queue, setQueue] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [now, setNow] = useState(new Date());
  const [activeDoctors, setActiveDoctors] = useState(1); 
  const [outbreakAlerts, setOutbreakAlerts] = useState([]);

  const audioRef = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'));
  const alarmRef = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/2868/2868-preview.mp3')); 

  const BASE_URL = import.meta.env.VITE_API_URL || "https://afya-pulse-backend.onrender.com";
  const BACKEND_URL = `${BASE_URL}/api`;

  const sortQueue = (data) => {
    const priority = { 'RED': 0, 'YELLOW': 1, 'GREEN': 2 };
    return [...data].sort((a, b) => {
      const pA = priority[a.triage_category] ?? 99;
      const pB = priority[b.triage_category] ?? 99;
      if (pA !== pB) return pA - pB;
      return new Date(a.created_at) - new Date(b.created_at);
    });
  };

  const checkForOutbreaks = (currentQueue) => {
    const CRITICAL_THRESHOLD = 3; 
    const TIME_WINDOW_MINS = 60; 
    const nowTime = new Date().getTime();
    const timeLimit = nowTime - (TIME_WINDOW_MINS * 60 * 1000);

    const recentCriticalCases = currentQueue.filter(p => {
        const pTime = new Date(p.created_at).getTime();
        return p.triage_category === 'RED' && pTime > timeLimit;
    });

    const locationCounts = {};
    recentCriticalCases.forEach(p => {
        const loc = p.location || 'Unknown';
        locationCounts[loc] = (locationCounts[loc] || 0) + 1;
    });

    const newAlerts = [];
    Object.keys(locationCounts).forEach(loc => {
        if (locationCounts[loc] >= CRITICAL_THRESHOLD) {
            newAlerts.push({
                location: loc,
                message: `⚠️ SURVEILLANCE ALERT: ${locationCounts[loc]} critical cases in ${loc}. Potential cluster.`
            });
        }
    });

    if (newAlerts.length > 0) {
        setOutbreakAlerts(prev => {
            if (JSON.stringify(prev) !== JSON.stringify(newAlerts)) {
                alarmRef.current.play().catch(() => {});
                return newAlerts;
            }
            return prev;
        });
    }
  };

  const calculateAvgWait = () => {
    if (queue.length === 0) return '0m';
    const totalWaitMs = queue.reduce((acc, patient) => acc + (now - new Date(patient.created_at)), 0);
    return `${Math.floor((totalWaitMs / queue.length) / 60000)}m`;
  };

  // 1. DATA INITIALIZATION & STATS REFRESH
  useEffect(() => {
    const fetchData = async () => {
      if (!token) return;
      try {
        const statsRes = await axios.get(`${BACKEND_URL}/triage/stats`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        const responseData = statsRes.data;
        const rawStats = Array.isArray(responseData) ? responseData : responseData.stats;
        if (responseData.active_doctors) setActiveDoctors(responseData.active_doctors);

        const chartData = [
          { name: 'RED', count: 0, color: '#d42a3c' },
          { name: 'YELLOW', count: 0, color: '#f0b400' },
          { name: 'GREEN', count: 0, color: '#23905a' }
        ];

        if (rawStats) {
            rawStats.forEach(item => {
              const category = chartData.find(c => c.name === item.triage_category);
              if (category) category.count = parseInt(item.count);
            });
        }
        setStats(chartData);

        const queueRes = await axios.get(`${BACKEND_URL}/triage/queue`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const sortedData = sortQueue(queueRes.data);
        setQueue(sortedData);
        checkForOutbreaks(sortedData);
      } catch (err) {
        console.error("Data fetch error", err);
      }
    };
    fetchData();
  }, [refreshKey, token, BACKEND_URL]);

  // 2. REAL-TIME SOCKET UPDATES (ADD / UPDATE / REMOVE)
  useEffect(() => {
    // Server rejects sockets without a valid Firebase token
    const socket = io(BASE_URL, {
      auth: async (cb) => cb({ token: auth.currentUser ? await auth.currentUser.getIdToken() : null }),
    });
    
    socket.on('queue_update', (data) => {
        console.log("🔔 Real-time Update Received:", data);
        const { type, patient, id } = data;

        setQueue((prevQueue) => {
          let newQueue;
          if (type === 'ADD') {
            // New patient submission
            newQueue = sortQueue([patient, ...prevQueue]);
            audioRef.current.play().catch(() => {});
          } else if (type === 'UPDATE') {
            // 🔄 SESSION-BASED UPDATE: Find existing patient and replace data
            newQueue = sortQueue(prevQueue.map(item => 
              item.report_id === id ? { ...item, ...patient } : item
            ));
          } else if (type === 'REMOVE') {
            // Case was resolved
            newQueue = prevQueue.filter(item => item.report_id !== id);
          } else {
            newQueue = prevQueue;
          }
          
          checkForOutbreaks(newQueue);
          return newQueue;
        });

        // Always refresh stats counts when any update happens
        setRefreshKey(prev => prev + 1);
    });

    return () => socket.disconnect();
  }, [BASE_URL]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const countOf = (cat) => queue.filter(p => p.triage_category === cat).length;
  const kpiData = [
    { label: 'Red tags', value: countOf('RED'), note: 'see now', tone: 'red' },
    { label: 'Yellow tags', value: countOf('YELLOW'), note: 'see soon', tone: 'yellow' },
    { label: 'Average wait', value: calculateAvgWait(), note: `${queue.length} open case${queue.length === 1 ? '' : 's'}`, tone: '' },
    { label: 'Clinicians online', value: activeDoctors, note: 'doctors on network', tone: 'green' },
  ];

  const markAsTreated = async (id) => {
    if(!window.confirm("Confirm: Case reviewed and advice sent?")) return;
    try {
        await axios.put(`${BACKEND_URL}/triage/${id}/resolve`, 
            { doctor_final_category: 'TREATED' },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        // Optimistic UI update
        setQueue(prev => prev.filter(p => p.report_id !== id));
        setRefreshKey(prev => prev + 1); 
    } catch(err) {
        console.error("Error updating status", err);
    }
  };

  const getWaitingDuration = (dateString) => {
    const diffMins = Math.floor((now - new Date(dateString)) / 60000);
    return diffMins < 1 ? 'Just now' : `+${diffMins}m`;
  };

  // Reports start with "[Age: 54, Sex: Male]" (or "[USSD-EN] [Age:54, Sex:Male]"); show that as details, not text
  const splitReport = (text = '') => {
    const m = text.match(/^(?:\[USSD-\w+\]\s*)?\[Age:\s*([^,\]]*),\s*Sex:\s*([^\]]*)\]\s*/i);
    if (!m) return { age: null, sex: null, body: text };
    return { age: m[1].trim(), sex: m[2].trim(), body: text.slice(m[0].length) };
  };

  const formatPhoneLink = (number) => `tel:${number?.replace(/\s+/g, '') || '#'}`;
  
  const formatWhatsAppLink = (number) => {
    if (!number) return '#';
    let clean = number.replace(/\s+/g, '').replace(/\+/g, ''); 
    if (clean.startsWith('0')) clean = '254' + clean.substring(1);
    const text = encodeURIComponent("Hello, this is the doctor from Afya-Pulse regarding your recent symptom report.");
    return `https://wa.me/${clean}?text=${text}`;
  };

  return (
    <div className="main-content">
      <OutbreakBanner
        alerts={outbreakAlerts}
        onDismiss={(i) => setOutbreakAlerts(prev => prev.filter((_, idx) => idx !== i))}
      />

      <div className="page-head">
        <div>
          <p className="eyebrow">Command center · {now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h2>Patients waiting for review</h2>
        </div>
        <div className="status-badge"><span className="live-dot" /> Live feed</div>
      </div>

      <div className="kpi-strip">
        {kpiData.map((kpi) => (
          <div key={kpi.label} className={`kpi ${kpi.tone}`}>
            <div className="kpi-label">{kpi.label}</div>
            <div className="kpi-value">{kpi.value}</div>
            <div className="kpi-note">{kpi.note}</div>
          </div>
        ))}
      </div>

      <div className="command-grid">
        <section>
          <div className="section-label">
            <h3>Queue <span className="count">· sorted by tag, then wait</span></h3>
            <span className="count">{queue.length} open</span>
          </div>

          <div className="tag-list">
            {queue.map(patient => {
              const report = splitReport(patient.ai_analysis?.interpreted_symptom || patient.symptoms);
              return (
              <article key={patient.report_id} className={`tag-card ${patient.triage_category}`}>
                <div className="tag-strip" aria-label={`${patient.triage_category} tag`}>
                  <strong>{patient.triage_category}</strong>
                </div>
                <div className="tag-main">
                  <div className="tag-meta">
                    <span className="mono">#{patient.report_id}</span>
                    <span>{patient.location || 'Unknown county'}</span>
                    {report.age && <span>{report.age} yrs · {report.sex}</span>}
                    <span className="mono">{new Date(patient.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="tag-wait">{getWaitingDuration(patient.created_at)}</span>
                  </div>
                  <p className="tag-symptoms">{report.body}</p>
                  {patient.ai_analysis?.reasoning && (
                    <p className="kpi-note" style={{ marginTop: 6 }}>AI: {patient.ai_analysis.reasoning}</p>
                  )}
                  {patient.patient_phone && (
                    <div className="tag-contact">
                      <a href={formatPhoneLink(patient.patient_phone)} className="chip-link"><Phone size={13} /> Call</a>
                      <a href={formatWhatsAppLink(patient.patient_phone)} target="_blank" rel="noopener noreferrer" className="chip-link">
                        <MessageCircle size={13} /> WhatsApp
                      </a>
                    </div>
                  )}
                </div>
                <div className="tag-actions">
                  <button className="btn-queue" onClick={() => markAsTreated(patient.report_id)}>
                    <Check size={14} /> Resolve
                  </button>
                </div>
              </article>
              );
            })}
            {queue.length === 0 && (
              <div className="tag-empty">
                <CheckCircle size={32} />
                <strong>No one is waiting</strong>
                New reports from the kiosk and USSD appear here instantly.
              </div>
            )}
          </div>
        </section>

        <aside className="stack">
          <section className="card">
            <div className="section-label">
              <h3><MapIcon size={18} /> Hotspots</h3>
              <span className="count">by county</span>
            </div>
            <div className="map-frame"><DiseaseMap patients={queue} /></div>
          </section>

          <section className="card">
            <div className="section-label">
              <h3>Case volume</h3>
              <span className="count">open cases by tag</span>
            </div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#6a7888" fontSize={11} tickLine={false} axisLine={false} fontFamily="IBM Plex Mono" />
                  <YAxis allowDecimals={false} stroke="#6a7888" fontSize={11} tickLine={false} axisLine={false} fontFamily="IBM Plex Mono" />
                  <Tooltip cursor={{ fill: '#f4f2ed' }} contentStyle={{ borderRadius: 8, border: '1px solid #e0dcd2', fontFamily: 'IBM Plex Sans' }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={44}>
                    {stats.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

export default DoctorDashboard;