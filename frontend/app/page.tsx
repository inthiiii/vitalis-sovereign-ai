"use client";

import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from 'react-markdown';
import { 
    Mic, Square, Activity, ShieldAlert, ShieldCheck, FileText, Loader2, Upload, Users, ChevronDown, 
    Download, UserPlus, LayoutDashboard, Menu, FileClock, Image as ImageIcon, BookOpen, Volume2, 
    StopCircle, BrainCircuit, Trash2, ToggleLeft, ToggleRight, Sparkles, Info, X, Search, FileUp, 
    HelpCircle, Calendar, RefreshCw, Tag, FileType, FlaskConical, Printer, TrendingUp, Stethoscope,
    Globe, Lock, Unlock, ArrowRight, Share2 , DownloadCloud, Clock, Eye, EyeOff, FileSearch, Shield,
    Zap, Database, AlertTriangle, CheckCircle2, ScanEye, Siren, History, Settings, Eraser, Power, Maximize2,
    MessageSquare, ChevronRight
} from "lucide-react";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceArea } from 'recharts';

// --- REFERENCE RANGES (THE SAFE ZONE) ---
const REFERENCE_RANGES: { [key: string]: { min: number, max: number } } = {
    "Glucose": { min: 65, max: 99 },
    "Hemoglobin": { min: 13.5, max: 17.5 },
    "Platelets": { min: 150, max: 450 },
    "Creatinine": { min: 0.7, max: 1.3 },
    "White Blood Cells (WBC)": { min: 4.5, max: 11.0 },
    "Potassium": { min: 3.5, max: 5.2 },
    "Sodium": { min: 135, max: 145 }
};

// --- TYPES ---

interface Patient {
  id: number;
  name: string;
  age: number;
  medical_history: string;
}

interface ToastMsg {
    id: number;
    type: 'success' | 'error' | 'info';
    text: string;
}

type OmniMessage = {
    role: 'user' | 'ai';
    text: string;
    time: string;
};

// --- MAIN COMPONENT ---
export default function VitalisApp() {
    const [activeTab, setActiveTab] = useState<"about" | "consultation" | "patients" | "records" | "knowledge" | "labs" | "passport" | "omni" >("consultation");
    const [isSidebarOpen, setSidebarOpen] = useState(true);
    const [patients, setPatients] = useState<Patient[]>([]);
    const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
    
    // --- PERSISTENT CONSULTATION STATE ---
    const [consultData, setConsultData] = useState({
        transcript: "",
        soapNote: "",
        safetyAnalysis: "",
        patientHistory: "",
        visualAnalysis: "",
        explanation: "",
        ddx: "",
        selectedImage: null as File | null,
        useRAG: true
    });
  
    // --- SHARED OMNI STATE ---
    const [omniMessages, setOmniMessages] = useState<OmniMessage[]>([
        {role: 'ai', text: "Systems Online. I am **Vitalis Omni**. Accessing secure medical protocols. How may I assist you today?", time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
    ]);
    const [isOmniLoading, setIsOmniLoading] = useState(false);

    // Track Wake Word Status: 'inactive' | 'listening' (Purple) | 'active' (Red)
    const [wakeWordStatus, setWakeWordStatus] = useState<'inactive' | 'listening' | 'active'>('inactive');

    // SHARED SETTINGS (Lifted Up)
    const [settings, setSettings] = useState({
        alwaysListen: false,
        surgicalMode: true,
        deepMemory: true,
        voiceResponse: true
    });

    // --- WAKE WORD ENGINE ---
    useEffect(() => {
        if (!settings.alwaysListen) {
            setWakeWordStatus('inactive');
            return;
        }

        if (!('webkitSpeechRecognition' in window)) {
            addToast("error", "Speech API not supported");
            return;
        }

        const SpeechRecognition = (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        
        // Settings for Wake Word
        recognition.continuous = false; // We want to process phrase-by-phrase
        recognition.interimResults = true; // Essential for "Heard: ..." logs
        recognition.lang = 'en-US';

        let isRestarting = false;

        const startEngine = () => {
            if (isRestarting) return;
            try { recognition.start(); } catch (e) {}
        };

        recognition.onstart = () => {
            // Only set to 'listening' (Purple) if we aren't already 'active' (Red)
            setWakeWordStatus(prev => prev === 'active' ? 'active' : 'listening');
            console.log("👂 Omni Listening...");
        };

        recognition.onresult = (event: any) => {
            const current = event.resultIndex;
            const result = event.results[current];
            const transcript = result[0].transcript.toLowerCase().trim();
            const isFinal = result.isFinal; // <--- CRITICAL: Check if user stopped speaking

            console.log("🎤 Heard:", transcript, "| Final:", isFinal, "| Status:", wakeWordStatus);

            // 1. DETECT WAKE WORD (If waiting)
            if (wakeWordStatus !== 'active' && (transcript.includes("hey vitalis") || transcript.includes("hey omni") || transcript.includes("vitalis"))) {
                setWakeWordStatus('active'); // Turn RED
                addToast("info", "Wake Word Detected!");
                
                // Remove wake word to see if there is a command attached (e.g. "Hey Vitalis Open Labs")
                const command = transcript.replace("hey vitalis", "").replace("hey omni", "").replace("vitalis", "").trim();
                
                if (command.length > 2 && isFinal) {
                    handleOmniMessage(command);
                    setWakeWordStatus('listening'); // Reset to Purple after command
                }
                
                // If just "Hey Vitalis", we stay Red and wait for the next sentence.
            } 
            
            // 2. EXECUTE COMMAND (If Active/Red)
            else if (wakeWordStatus === 'active') {
                // Only execute when the user pauses (isFinal is true)
                if (isFinal) {
                    handleOmniMessage(transcript); // <--- THIS WAS MISSING/COMMENTED
                    setWakeWordStatus('listening'); // Reset to Purple (Standby)
                }
            }
        };

        recognition.onend = () => {
            if (settings.alwaysListen) {
                isRestarting = true;
                setTimeout(() => {
                    isRestarting = false;
                    startEngine();
                }, 200);
            } else {
                setWakeWordStatus('inactive');
            }
        };

        startEngine();

        return () => { recognition.onend = null; recognition.stop(); };
    }, [settings.alwaysListen, wakeWordStatus]); // Added wakeWordStatus dependency to keep state fresh
    // --- TEXT TO SPEECH ---
    const speak = (text: string) => {
        if (!settings.voiceResponse) return;
        const cleanText = text.replace(/<<.*?>>/g, "").replace(/\*\*/g, "");
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(cleanText);
            utterance.rate = 1.1;
            window.speechSynthesis.speak(utterance);
        }
    };
  
    // --- MAIN OMNI HANDLER ---
    const handleOmniMessage = async (text: string) => {
        if (!text.trim()) return;
        
        const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        setOmniMessages(prev => [...prev, {role: 'user', text: text, time}]);
        setIsOmniLoading(true);
  
        try {
            const formData = new FormData(); 
            formData.append("message", text);
            // formData.append("use_memory", settings.deepMemory.toString()); // Ensure backend accepts this
            
            const res = await fetch("http://127.0.0.1:8000/omni/chat/", { method: "POST", body: formData });
            const data = await res.json();
            
            let responseText = data.response;

            // --- COMMAND 1: NAVIGATION ---
            if (responseText.includes("<<NAVIGATE:")) {
                const match = responseText.match(/<<NAVIGATE:(.*?)>>/);
                if (match && match[1]) {
                    const target = match[1].trim().toLowerCase();
                    const validTabs = ["about", "consultation", "patients", "records", "knowledge", "labs", "passport", "omni"];
                    if (validTabs.includes(target)) setActiveTab(target as any);
                }
                responseText = responseText.replace(/<<NAVIGATE:.*?>>/, ""); // Clean tag
            }

            // --- COMMAND 2: PATIENT SELECTION ---
            if (responseText.includes("<<SELECT_PATIENT:")) {
                const match = responseText.match(/<<SELECT_PATIENT:(\d+)>>/);
                if (match && match[1]) {
                    const pid = parseInt(match[1]);
                    console.log("🎤 VOICE ACTION: Selecting Patient ID", pid); // Debug
                    setSelectedPatientId(pid); 
                }
                responseText = responseText.replace(/<<SELECT_PATIENT:.*?>>/, "");
            }

            // --- COMMAND 3: DATA ENTRY (DICTATION) ---
            if (responseText.includes("<<UPDATE_FIELD:")) {
                const match = responseText.match(/<<UPDATE_FIELD:(.*?)\|(.*?)>>/);
                if (match && match[1] && match[2]) {
                    const field = match[1].trim();
                    const content = match[2].trim();
                    
                    if (field === "soap_note") {
                        setConsultData(prev => ({...prev, soapNote: prev.soapNote + "\n• " + content}));
                    } else if (field === "transcript") {
                        setConsultData(prev => ({...prev, transcript: prev.transcript + " " + content}));
                    }
                    // Add more fields as needed
                }
                responseText = responseText.replace(/<<UPDATE_FIELD:.*?>>/, "");
            }

            // Clean up and Speak
            responseText = responseText.trim();
            speak(responseText);

            setOmniMessages(prev => [...prev, {
                role: 'ai', text: responseText, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
            }]);

        } catch (e) { 
            setOmniMessages(prev => [...prev, {role: 'ai', text: "⚠️ Command Failed.", time}]); 
        }
        setIsOmniLoading(false);
    };
  
    const updateConsultData = (updates: any) => setConsultData(prev => ({ ...prev, ...updates }));
    
    const resetConsultation = () => {
        if(confirm("Start new consultation?")) {
            setConsultData({
                transcript: "", soapNote: "", safetyAnalysis: "", patientHistory: "", 
                visualAnalysis: "", explanation: "", ddx: "", selectedImage: null, useRAG: true
            });
        }
    };
  
    // TOAST STATE
    const [toasts, setToasts] = useState<ToastMsg[]>([]);
    const addToast = (type: 'success' | 'error' | 'info', text: string) => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, type, text }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    };
  
    const fetchPatients = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/patients/");
        const data = await res.json();
        setPatients(data);
        if (data.length > 0 && !selectedPatientId) setSelectedPatientId(data[0].id);
      } catch (error) { console.error("Failed to fetch patients", error); }
    };
  
    useEffect(() => { fetchPatients(); }, []);
  
    return (
        <div className="h-screen bg-slate-950 text-slate-200 font-sans flex overflow-hidden relative">
          
          {/* TOASTS */}
          <div className="absolute top-4 right-4 z-[100] flex flex-col gap-2">
              {toasts.map(t => (
                  <div key={t.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl animate-in slide-in-from-right ${
                      t.type === 'success' ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200' :
                      t.type === 'error' ? 'bg-red-950/90 border-red-500/50 text-red-200' :
                      'bg-slate-800/90 border-slate-600 text-slate-200'
                  }`}>
                      {t.type === 'success' ? <Sparkles className="w-4 h-4" /> : t.type === 'error' ? <ShieldAlert className="w-4 h-4" /> : <Info className="w-4 h-4" />}
                      <span className="text-sm font-medium">{t.text}</span>
                  </div>
              ))}
          </div>
    
          {/* OMNI ASSISTANT WIDGET */}
          <OmniAssistant 
              messages={omniMessages} 
              loading={isOmniLoading} 
              onSend={handleOmniMessage}
              onExpand={() => setActiveTab("omni")} 
              wakeWordStatus={wakeWordStatus}
          />
    
          {/* SIDEBAR (Left Side) */}
          <aside className={`${isSidebarOpen ? "w-64" : "w-20"} bg-slate-900 border-r border-slate-800 transition-all duration-300 flex flex-col shrink-0 h-full`}>
            <div className="p-6 flex items-center gap-3 border-b border-slate-800 h-20">
              <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
                <Activity className="text-white w-5 h-5" />
              </div>
              {isSidebarOpen && (
                <div>
                    <h1 className="font-bold text-white tracking-tight">Vitalis</h1>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Sovereign AI</p>
                </div>
              )}
            </div>
    
            <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                <NavButton icon={<HelpCircle />} label="About Vitalis" active={activeTab === "about"} onClick={() => setActiveTab("about")} expanded={isSidebarOpen} />
                <div className="h-px bg-slate-800 my-2 mx-2"></div>
                <NavButton icon={<LayoutDashboard />} label="Consultation" active={activeTab === "consultation"} onClick={() => setActiveTab("consultation")} expanded={isSidebarOpen} />
                <NavButton icon={<FlaskConical />} label="Lab Results" active={activeTab === "labs"} onClick={() => setActiveTab("labs")} expanded={isSidebarOpen} />
                <NavButton icon={<UserPlus />} label="Patient Registry" active={activeTab === "patients"} onClick={() => setActiveTab("patients")} expanded={isSidebarOpen} />
                <NavButton icon={<FileClock />} label="Patient Records" active={activeTab === "records"} onClick={() => setActiveTab("records")} expanded={isSidebarOpen} />
                <NavButton icon={<BookOpen />} label="Medical Knowledge" active={activeTab === "knowledge"} onClick={() => setActiveTab("knowledge")} expanded={isSidebarOpen} />
                <NavButton icon={<Globe />} label="Vitalis Passport" active={activeTab === "passport"} onClick={() => setActiveTab("passport")} expanded={isSidebarOpen} />
                <NavButton icon={<BrainCircuit />} label="Omni Command" active={activeTab === "omni"} onClick={() => setActiveTab("omni")} expanded={isSidebarOpen} />
            </nav>
    
            <div className="p-4 border-t border-slate-800">
                <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-2 text-slate-500 hover:text-white transition-colors w-full flex justify-center">
                    <Menu className="w-5 h-5" />
                </button>
            </div>
          </aside>
    
          {/* MAIN CONTENT AREA */}
          <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950">
            <header className="flex justify-between items-center p-8 pb-4 shrink-0">
                <h2 className="text-2xl font-bold text-white capitalize flex items-center gap-3">
                    {activeTab.replace("-", " ")}
                    {activeTab === "consultation" && (
                        <button onClick={resetConsultation} className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-400 px-3 py-1 rounded-lg transition-colors flex items-center gap-2 border border-slate-700">
                            <RefreshCw className="w-3 h-3" /> New Session
                        </button>
                    )}
                </h2>
                <div className="flex items-center gap-2 text-xs bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full text-slate-400">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    System Active (M3 Local)
                </div>
            </header>
            
            <div className="flex-1 overflow-y-auto p-8 pt-4">
              {activeTab === "about" && <AboutView />}
              {activeTab === "consultation" && (
                  <ConsultationView patients={patients} selectedPatientId={selectedPatientId} setSelectedPatientId={setSelectedPatientId} addToast={addToast} data={consultData} updateData={updateConsultData} />
              )}
              {activeTab === "labs" && <LabResultsView patients={patients} addToast={addToast} />}
              {activeTab === "passport" && <PassportView patients={patients} addToast={addToast} refreshPatients={fetchPatients} />}
              {activeTab === "patients" && <PatientManagerView patients={patients} refreshPatients={fetchPatients} addToast={addToast} />}
              {activeTab === "records" && <PatientRecordsView patients={patients} addToast={addToast} externalSelectedId={selectedPatientId} setExternalSelectedId={setSelectedPatientId}/>}
              {activeTab === "knowledge" && <KnowledgeView addToast={addToast} />}
              
              {/* OMNI VIEW - Takes full height of container */}
              {activeTab === "omni" && (
                  <OmniView 
                      messages={omniMessages} 
                      loading={isOmniLoading} 
                      onSend={handleOmniMessage} 
                      settings={settings}
                      setSettings={setSettings}
                  />
              )}
            </div>
          </main>
        </div>
      );
    }

// --- SIDEBAR BUTTON ---
function NavButton({ icon, label, active, onClick, expanded }: any) {
    return (
        <button 
            onClick={onClick}
            className={`flex items-center gap-3 w-full p-3 rounded-xl transition-all ${
                active ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
        >
            {React.cloneElement(icon, { size: 20 })}
            {expanded && <span className="text-sm font-medium">{label}</span>}
        </button>
    )
}

// --- FIX #6: ENHANCED ABOUT PAGE ---
function AboutView() {
    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="bg-gradient-to-r from-emerald-950/50 to-slate-900 border border-slate-800 rounded-2xl p-8 relative overflow-hidden">
                <div className="relative z-10">
                    <h3 className="text-3xl font-bold text-white mb-4">Vitalis Sovereign AI</h3>
                    <p className="text-emerald-100/70 leading-relaxed max-w-2xl text-lg">
                        The industry's first offline-native medical intelligence platform. Vitalis processes sensitive patient data locally on your device's NPU, ensuring zero data leakage while providing cloud-grade AI capabilities.
                    </p>
                </div>
                <Activity className="absolute -right-10 -bottom-10 w-64 h-64 text-emerald-500/5" />
            </div>
            
            <h4 className="text-xl font-bold text-white mt-8 mb-4 flex items-center gap-2"><Sparkles className="w-5 h-5 text-amber-500"/> Core Capabilities</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FeatureCard icon={<Mic className="text-emerald-500" />} title="AI Scribe" desc="Real-time transcription that understands medical terminology and accents." />
                <FeatureCard icon={<ImageIcon className="text-blue-500" />} title="Vision Analysis" desc="On-device computer vision for analyzing X-Rays, CT scans, and dermoscopy." />
                <FeatureCard icon={<ShieldCheck className="text-purple-500" />} title="Pharmacist Agent" desc="Real-time validation against patient allergies and drug interaction protocols." />
                <FeatureCard icon={<BookOpen className="text-amber-500" />} title="RAG Knowledge" desc="Upload hospital PDF protocols. The AI cites them directly in the SOAP note." />
                <FeatureCard icon={<BrainCircuit className="text-rose-500" />} title="Omni Assistant" desc="A conversational agent that knows your patients, app, and documents." />
                <FeatureCard icon={<FileText className="text-cyan-500" />} title="Auto-Lab (Beta)" desc="Extracts structured data from PDF lab reports [Coming Phase 14]." />
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                <h4 className="font-semibold text-white mb-4">Workflow Guide</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-400">
                    <ul className="list-disc list-inside space-y-2">
                        <li><strong>Start:</strong> Go to 'Patient Registry' to add a new patient (Manual or PDF).</li>
                        <li><strong>Consult:</strong> Select a patient, upload visuals, and record audio.</li>
                        <li><strong>Verify:</strong> Check the Safety Alerts (Red Box) for any contraindications.</li>
                    </ul>
                    <ul className="list-disc list-inside space-y-2">
                        <li><strong>Consult Protocols:</strong> Toggle "Use Knowledge Base" to enforce PDF guidelines.</li>
                        <li><strong>Review:</strong> Click "Second Opinion" for a differential diagnosis.</li>
                        <li><strong>Ask Omni:</strong> Use the bottom-right brain button for any questions.</li>
                    </ul>
                </div>
            </div>
        </div>
    )
}

function FeatureCard({ icon, title, desc }: any) {
    return (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl hover:border-emerald-500/30 transition-all hover:-translate-y-1">
            <div className="mb-4 bg-slate-800/50 w-12 h-12 flex items-center justify-center rounded-lg">{icon}</div>
            <h4 className="font-bold text-white mb-2">{title}</h4>
            <p className="text-sm text-slate-400 leading-snug">{desc}</p>
        </div>
    )
}

// --- FIX #3 & #4: PATIENT REGISTRY (QUICK FILL & LIST VIEW) ---
function PatientManagerView({ patients, refreshPatients, addToast }: any) {
    const [name, setName] = useState("");
    const [age, setAge] = useState("");
    const [history, setHistory] = useState("");
    const [loading, setLoading] = useState(false);
    const pdfInputRef = useRef<HTMLInputElement>(null);

    const fillTemplate = (type: string) => {
        if (type === "healthy") setHistory("No known allergies. No chronic conditions. Regular exercise. Non-smoker.");
        else if (type === "chronic") setHistory("History of Hypertension and Type 2 Diabetes. Allergic to Penicillin. Takes Metformin and Lisinopril.");
        else if (type === "elderly") setHistory("Age-related hearing loss. Osteoarthritis in knees. Allergic to Sulfa Drugs. History of Falls.");
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await fetch("http://127.0.0.1:8000/patients/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, age: parseInt(age), medical_history: history })
            });
            addToast("success", "Patient Registered!");
            setName(""); setAge(""); setHistory("");
            refreshPatients();
        } catch (err) { addToast("error", "Registration Failed"); }
        setLoading(false);
    };

    const handlePdfImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setLoading(true);
        const formData = new FormData();
        formData.append("file", file);
        try {
            const res = await fetch("http://127.0.0.1:8000/patients/extract-from-pdf/", { method: "POST", body: formData });
            const data = await res.json();
            setName(data.name || ""); setAge(data.age?.toString() || ""); setHistory(data.medical_history || "");
            addToast("success", "Data Extracted!");
        } catch (e) { addToast("error", "PDF Extraction Failed"); }
        setLoading(false);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* REGISTRATION FORM */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 h-fit">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <UserPlus className="w-5 h-5 text-emerald-500" /> Register Patient
                    </h3>
                    <div className="relative">
                        <input type="file" ref={pdfInputRef} onChange={handlePdfImport} className="hidden" accept=".pdf" />
                        <button type="button" onClick={() => pdfInputRef.current?.click()} className="text-xs flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded-lg transition-colors border border-slate-700">
                            <FileUp className="w-3 h-3" /> Import via PDF
                        </button>
                    </div>
                </div>

                <form onSubmit={handleCreate} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-slate-400 mb-2">Full Name</label>
                            <input required value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="e.g. Sarah Connor" />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-2">Age</label>
                            <input required type="number" value={age} onChange={e => setAge(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="e.g. 35" />
                        </div>
                    </div>
                    
                    <div>
                        <div className="flex justify-between items-end mb-2">
                            <label className="block text-sm text-slate-400">Medical History</label>
                            <div className="flex gap-1">
                                <button type="button" onClick={() => fillTemplate("healthy")} className="text-[10px] bg-emerald-900/30 text-emerald-400 border border-emerald-900/50 px-2 py-1 rounded hover:bg-emerald-900/50">Healthy</button>
                                <button type="button" onClick={() => fillTemplate("chronic")} className="text-[10px] bg-amber-900/30 text-amber-400 border border-amber-900/50 px-2 py-1 rounded hover:bg-amber-900/50">Chronic</button>
                                <button type="button" onClick={() => fillTemplate("elderly")} className="text-[10px] bg-blue-900/30 text-blue-400 border border-blue-900/50 px-2 py-1 rounded hover:bg-blue-900/50">Elderly</button>
                            </div>
                        </div>
                        <textarea required value={history} onChange={e => setHistory(e.target.value)} rows={4} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none text-sm" placeholder="Enter history or use Quick Fill..." />
                    </div>

                    <button disabled={loading} type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2">
                        {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                        {loading ? "Processing..." : "Register to Database"}
                    </button>
                </form>
            </div>

            {/* LIST VIEW (Fix #4) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 flex flex-col h-[600px]">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-500" /> Database Registry
                </h3>
                <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                    {patients.length === 0 ? (
                        <div className="text-center text-slate-500 mt-20">No patients found. Register one to begin.</div>
                    ) : (
                        patients.map((p: any) => (
                            <div key={p.id} className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex justify-between items-center group hover:border-slate-600 transition-colors">
                                <div>
                                    <div className="font-medium text-white">{p.name}</div>
                                    <div className="text-xs text-slate-500">ID: #{p.id} • {p.age} years old</div>
                                    <div className="text-xs text-slate-400 mt-1 line-clamp-1">{p.medical_history}</div>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 text-xs font-mono">
                                    {p.name.charAt(0)}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}

// --- FIX #5: RECORDS (DATE FILTER) ---
function PatientRecordsView({ patients, addToast, externalSelectedId, setExternalSelectedId }: any) {
    // 1. Initialize State (Sync with external prop if available)
    const [selectedId, setSelectedId] = useState<number | null>(externalSelectedId || null);
    const [history, setHistory] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [dateFilter, setDateFilter] = useState(""); 

    // 2. Sync Effect: Listen for Voice Commands/External Updates
    useEffect(() => {
        if (externalSelectedId) {
            console.log("🔄 Syncing Records View to ID:", externalSelectedId);
            setSelectedId(externalSelectedId);
        }
    }, [externalSelectedId]);

    // 3. Selection Handler (Updates both Local and Global state)
    const handlePatientSelect = (id: number) => {
        setSelectedId(id);
        if (setExternalSelectedId) setExternalSelectedId(id);
    };

    const fetchHistory = () => {
        if (!selectedId) return;
        setLoading(true);
        fetch(`http://127.0.0.1:8000/patients/${selectedId}/history`)
            .then(res => res.json())
            .then(data => { setHistory(data); setLoading(false); })
            .catch(() => setLoading(false));
    };

    // Re-fetch when selectedId changes (either manually or via voice)
    useEffect(() => { fetchHistory(); }, [selectedId]);

    const handleDeleteRecord = async (recordId: number) => {
        if(!confirm("Delete this record permanently?")) return;
        try {
            await fetch(`http://127.0.0.1:8000/consultations/${recordId}`, { method: 'DELETE' });
            addToast("success", "Record Deleted");
            fetchHistory();
        } catch(e) { addToast("error", "Delete Failed"); }
    };

    const filteredPatients = patients.filter((p:any) => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const filteredHistory = history?.consultations?.filter((c:any) => {
        if (!dateFilter) return true;
        const cDate = new Date(c.timestamp).toISOString().split('T')[0];
        return cDate === dateFilter;
    });

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[80vh]">
            {/* LEFT SIDEBAR: PATIENT LIST */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 overflow-y-auto flex flex-col">
                <div className="mb-4 relative">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                    <input className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-emerald-500" placeholder="Search patients..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                <div className="space-y-2 flex-1 overflow-y-auto">
                    {filteredPatients.map((p:any) => (
                        <button 
                            key={p.id} 
                            onClick={() => handlePatientSelect(p.id)} // <--- Updated Handler
                            className={`w-full text-left p-3 rounded-lg transition-all ${selectedId === p.id ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "hover:bg-slate-800 text-slate-300"}`}
                        >
                            <div className="font-medium">{p.name}</div>
                            <div className="text-xs text-slate-500">ID: #{p.id}</div>
                        </button>
                    ))}
                </div>
            </div>

            {/* MAIN CONTENT: HISTORY */}
            <div className="lg:col-span-2 bg-slate-900/50 border border-slate-800 rounded-2xl p-8 overflow-y-auto">
                {!selectedId ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500">
                        <FileClock className="w-12 h-12 mb-4 opacity-20" />
                        <p>Select a patient to view medical history</p>
                    </div>
                ) : loading ? (
                    <div className="flex justify-center p-12"><Loader2 className="animate-spin text-emerald-500" /></div>
                ) : history ? (
                    <div className="space-y-8">
                        <div className="border-b border-slate-800 pb-6 flex justify-between items-end">
                            <div>
                                <h2 className="text-2xl font-bold text-white">{history.patient.name}</h2>
                                <p className="text-slate-400 mt-1">{history.patient.age} years old • {history.patient.history}</p>
                            </div>
                            {/* DATE PICKER */}
                            <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-slate-500" />
                                <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-lg px-3 py-1 outline-none focus:border-emerald-500" />
                                {dateFilter && <button onClick={() => setDateFilter("")} className="text-xs text-slate-500 hover:text-white">Clear</button>}
                            </div>
                        </div>

                        <div className="space-y-6">
                            {filteredHistory?.length === 0 && <p className="text-slate-500 italic">No records found for this date.</p>}
                            {filteredHistory?.map((consult: any) => (
                                <div key={consult.id} className="relative pl-8 border-l-2 border-slate-800 group">
                                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-slate-800 border-2 border-slate-600"></div>
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="text-xs text-emerald-500 font-mono">
                                            {new Date(consult.timestamp).toLocaleDateString()} • {new Date(consult.timestamp).toLocaleTimeString()}
                                        </div>
                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleDeleteRecord(consult.id)} className="text-slate-500 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                                        </div>
                                    </div>
                                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                                        <div className="prose prose-invert prose-sm max-w-none text-slate-300">
                                            <ReactMarkdown>{consult.soap_note}</ReactMarkdown>
                                        </div>
                                        {consult.safety_analysis.includes("WARNING") && (
                                            <div className="mt-4 p-2 bg-red-950/30 border border-red-900/50 rounded text-red-300 text-xs flex gap-2"><ShieldAlert className="w-4 h-4" />{consult.safety_analysis}</div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}

// --- FIX #7: KNOWLEDGE (CATEGORIES + SUMMARY) ---
function KnowledgeView({ addToast }: any) {
  const [files, setFiles] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState("All"); // UI FILTER
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchLibrary = async () => {
      try {
          const res = await fetch("http://127.0.0.1:8000/knowledge/list/");
          const data = await res.json();
          setFiles(data);
      } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchLibrary(); }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);
      try {
          await fetch("http://127.0.0.1:8000/knowledge/upload/", { method: "POST", body: formData });
          fetchLibrary();
          addToast("success", "PDF Ingested!");
      } catch (e) { addToast("error", "Upload Failed"); }
      setUploading(false);
  };

  const handleDelete = async (filename: string) => {
      if(!confirm(`Delete ${filename}?`)) return;
      try {
          await fetch(`http://127.0.0.1:8000/knowledge/${filename}`, { method: 'DELETE' });
          fetchLibrary();
          addToast("info", "File Deleted");
      } catch (e) { addToast("error", "Delete Failed"); }
  };

  // Mock Categories for UI Demo
  const categories = ["All", "Protocols", "Research", "Guidelines"];

  return (
      <div className="max-w-4xl mx-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 mb-8">
              <div className="flex justify-between items-center mb-6">
                  <div>
                      <h2 className="text-xl font-bold text-white flex items-center gap-2">
                          <BookOpen className="w-6 h-6 text-emerald-500" /> Medical Knowledge Base
                      </h2>
                      <p className="text-slate-400 mt-1 text-sm">Upload hospital protocols. Vitalis will use them for RAG.</p>
                  </div>
                  <div>
                      <input type="file" ref={fileInputRef} onChange={handleUpload} className="hidden" accept=".pdf" />
                      <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2">
                          {uploading ? <Loader2 className="animate-spin w-4 h-4" /> : <Upload className="w-4 h-4" />} Ingest PDF
                      </button>
                  </div>
              </div>
              
              {/* CATEGORY TABS */}
              <div className="flex gap-2 border-b border-slate-800 pb-1">
                  {categories.map(cat => (
                      <button 
                        key={cat} 
                        onClick={() => setFilter(cat)}
                        className={`text-xs px-3 py-1.5 rounded-t-lg transition-colors ${filter === cat ? "bg-slate-800 text-white border-b-2 border-emerald-500" : "text-slate-500 hover:text-slate-300"}`}
                      >
                          {cat}
                      </button>
                  ))}
              </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {files.map((file, idx) => (
                  <div key={idx} className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl flex items-center justify-between gap-3 group relative">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-10 h-10 bg-red-500/10 text-red-500 rounded-lg flex items-center justify-center shrink-0">
                            <FileText className="w-5 h-5" />
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-slate-200 font-medium truncate text-sm">{file}</p>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] px-1.5 py-0.5 bg-slate-800 rounded text-slate-400">Protocol</span>
                                <span className="text-xs text-emerald-500">Active</span>
                            </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                          {/* INFO BUTTON WITH TOOLTIP */}
                          <div className="group/info relative">
                              <button className="p-2 text-slate-500 hover:text-blue-400"><Info className="w-4 h-4" /></button>
                              <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-slate-950 border border-slate-700 rounded-xl shadow-2xl opacity-0 group-hover/info:opacity-100 pointer-events-none transition-opacity z-20">
                                  <h5 className="text-xs font-bold text-white mb-1 flex items-center gap-1"><Sparkles className="w-3 h-3 text-purple-500"/> AI Summary</h5>
                                  <p className="text-[10px] text-slate-400 leading-relaxed">
                                      This document contains standard operating procedures for clinical care. Vitalis scans this file during consultations to verify compliance.
                                  </p>
                              </div>
                          </div>
                          <button onClick={() => handleDelete(file)} className="p-2 text-slate-500 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                      </div>
                  </div>
              ))}
          </div>
      </div>
  );
}

// --- FIX #1 & #2: CONSULTATION (SEARCH + PERSISTENCE) ---
function ConsultationView({ patients, selectedPatientId, setSelectedPatientId, addToast, data, updateData }: any) {
    const [isRecording, setIsRecording] = useState(false);
    const [status, setStatus] = useState<"idle" | "recording" | "processing" | "completed">("idle");
    const [loadingDdx, setLoadingDdx] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [isSpeaking, setIsSpeaking] = useState(false);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) updateData({ selectedImage: e.target.files[0] });
    };

    // FIX: Force update when parent passes a new ID (e.g. from Voice Command)
    useEffect(() => {
        if (selectedPatientId) {
            console.log("🔄 Voice Command applied to Consultation:", selectedPatientId);
            // Any specific logic needed when ID changes can go here
            // The <select> value below is already controlled by selectedPatientId, so it should visually update automatically.
        }
    }, [selectedPatientId]);

    // Abbreviated for clarity, same logic as before but calling updateData
    const startRecording = async () => { 
         try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            let mimeType = "audio/webm";
            if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) mimeType = "audio/webm;codecs=opus";
            else if (MediaRecorder.isTypeSupported("audio/mp4")) mimeType = "audio/mp4";
            const mediaRecorder = new MediaRecorder(stream, { mimeType });
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];
            mediaRecorder.ondataavailable = (event) => {
              if (event.data.size > 0) audioChunksRef.current.push(event.data);
            };
            mediaRecorder.onstop = () => processAudioBlob(new Blob(audioChunksRef.current, { type: mimeType }));
            mediaRecorder.start(1000);
            setIsRecording(true);
            setStatus("recording");
          } catch (error) { alert("Microphone access denied."); }
    };
    
    const stopRecording = () => { 
        if (mediaRecorderRef.current && isRecording) {
            setTimeout(() => {
              mediaRecorderRef.current?.stop();
              mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
            }, 500);
            setIsRecording(false);
            setStatus("processing");
          }
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => { 
        const file = event.target.files?.[0];
        if (file) { setStatus("processing"); uploadToBackend(file); }
    };
    
    const triggerFileInput = () => { fileInputRef.current?.click(); };
    
    const processAudioBlob = (blob: Blob) => { 
        if (blob.size < 2000) { alert("Recording too short."); setStatus("idle"); return; }
        const file = new File([blob], "recording.webm", { type: blob.type });
        uploadToBackend(file);
    };

    const uploadToBackend = async (file: File) => {
        if (!selectedPatientId) { addToast("error", "Select a patient first"); setStatus("idle"); return; }
        const formData = new FormData();
        formData.append("file", file);
        formData.append("patient_id", selectedPatientId.toString());
        if (data.selectedImage) formData.append("image", data.selectedImage);
        formData.append("use_rag", data.useRAG.toString());

        try {
            const res = await fetch("http://127.0.0.1:8000/consultation/", { method: "POST", body: formData });
            if (!res.ok) throw new Error("Failed");
            const resData = await res.json();
            
            updateData({
                transcript: resData.transcript,
                visualAnalysis: resData.visual_analysis,
                soapNote: resData.soap_note,
                safetyAnalysis: resData.safety_analysis,
                patientHistory: resData.patient_context,
                selectedImage: null // Clear image after use
            });
            
            setStatus("completed");
            addToast("success", "Analysis Complete");
        } catch (e) { setStatus("idle"); addToast("error", "Connection Failed"); }
    };

    const handleRegenerate = async () => {
        if (!data.transcript) return;
        setStatus("processing");
        try {
            const formData = new FormData();
            formData.append("text", data.transcript);
            formData.append("patient_id", selectedPatientId?.toString() || "");
            formData.append("use_rag", data.useRAG.toString());
            const res = await fetch("http://127.0.0.1:8000/analyze-text/", { method: "POST", body: formData });
            const resData = await res.json();
            updateData({ soapNote: resData.soap_note, safetyAnalysis: resData.safety_analysis });
            setStatus("completed");
            addToast("success", "Note Regenerated");
        } catch (e) { addToast("error", "Failed"); setStatus("idle"); }
    };

    const handleDownloadPDF = async () => {
        if (!selectedPatientId || !data.soapNote) return;
        const formData = new FormData();
        formData.append("patient_id", selectedPatientId.toString());
        formData.append("soap_note", data.soapNote);
        formData.append("safety_analysis", data.safetyAnalysis);
        try {
            const res = await fetch("http://127.0.0.1:8000/generate-report/", { method: "POST", body: formData });
            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url; a.download = "Vitalis_Report.pdf";
                document.body.appendChild(a); a.click(); a.remove();
            }
        } catch (e) { console.error(e); }
    };

    const handleExplain = async () => {
        if (!data.soapNote || !selectedPatientId) return;
        const patientName = patients.find((p:any) => p.id === selectedPatientId)?.name || "Patient";
        setStatus("processing");
        try {
            const formData = new FormData();
            formData.append("soap_note", data.soapNote);
            formData.append("patient_name", patientName);
            const res = await fetch("http://127.0.0.1:8000/explain/", { method: "POST", body: formData });
            const resData = await res.json();
            updateData({ explanation: resData.explanation });
            speakText(resData.explanation);
            setStatus("completed");
        } catch (e) { console.error(e); setStatus("idle"); }
    };

    const speakText = (text: string) => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            const voices = window.speechSynthesis.getVoices();
            const preferredVoice = voices.find(v => v.name.includes("Google US English")) || voices.find(v => v.name.includes("Samantha"));
            if (preferredVoice) utterance.voice = preferredVoice;
            utterance.rate = 1.0; utterance.pitch = 1.0;
            utterance.onstart = () => setIsSpeaking(true);
            utterance.onend = () => setIsSpeaking(false);
            window.speechSynthesis.speak(utterance);
        } else { alert("Text-to-Speech not supported."); }
    };

    const stopSpeaking = () => {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
    }

    const handleSecondOpinion = async () => {
        if (!data.soapNote) return;
        setLoadingDdx(true);
        try {
            const formData = new FormData();
            formData.append("soap_note", data.soapNote);
            const res = await fetch("http://127.0.0.1:8000/second-opinion/", { method: "POST", body: formData });
            const resData = await res.json();
            updateData({ ddx: resData.ddx });
        } catch (e) { console.error(e); }
        setLoadingDdx(false);
    };

    const filteredPatients = patients.filter((p:any) => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 space-y-6">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center gap-3 text-slate-300 mb-3">
                        <Users className="w-5 h-5 text-emerald-500" />
                        <span className="text-sm font-medium">Select Patient</span>
                    </div>
                    {/* FIXED: Search-only Selection */}
                    <div className="relative">
                        <input 
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white mb-2 focus:border-emerald-500 outline-none" 
                            placeholder="Search patient name..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                        <div className="max-h-32 overflow-y-auto border border-slate-800 rounded-lg bg-slate-950">
                            {filteredPatients.map((p:any) => (
                                <button 
                                    key={p.id} 
                                    onClick={() => setSelectedPatientId(p.id)}
                                    className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-800 ${selectedPatientId === p.id ? "bg-emerald-900/30 text-emerald-400" : "text-slate-300"}`}
                                >
                                    {p.name}
                                </button>
                            ))}
                            {filteredPatients.length === 0 && <div className="p-2 text-xs text-slate-500 text-center">No matches</div>}
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
                     <div className="flex flex-col items-center justify-center py-8 space-y-6">
                        <div className="flex gap-2 mb-2 w-full justify-center">
                            <input type="file" ref={imageInputRef} onChange={handleImageSelect} className="hidden" accept="image/*" />
                            <button onClick={() => imageInputRef.current?.click()} className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium border transition-all ${data.selectedImage ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50" : "bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500"}`}>
                                <ImageIcon className="w-4 h-4" /> {data.selectedImage ? "Image Attached" : "Attach X-Ray / Photo"}
                            </button>
                            {data.selectedImage && <button onClick={() => updateData({selectedImage: null})} className="text-slate-500 hover:text-red-400">✕</button>}
                        </div>

                        <button onClick={isRecording ? stopRecording : startRecording} disabled={status === "processing"} className={`relative group w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ${isRecording ? "bg-red-500/20 text-red-500 ring-2 ring-red-500 ring-offset-4 ring-offset-slate-900" : "bg-emerald-500 text-white hover:bg-emerald-400 shadow-lg shadow-emerald-500/30"} ${status === "processing" ? "opacity-50 cursor-not-allowed" : ""}`}>
                            {status === "processing" ? <Loader2 className="w-8 h-8 animate-spin" /> : isRecording ? <Square className="w-8 h-8 fill-current" /> : <Mic className="w-8 h-8" />}
                        </button>
                        
                         <div className="flex items-center justify-center gap-2 pt-4 border-t border-slate-800 w-full">
                                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="audio/*" />
                                <button onClick={triggerFileInput} className="text-xs flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
                                    <Upload className="w-4 h-4" /> Upload Audio File
                                </button>
                        </div>
                    </div>
                </div>
                
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 h-[400px] flex flex-col">
                    <div className="flex justify-between items-center mb-4 sticky top-0 bg-slate-900 py-2">
                        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-400">
                            <FileText className="w-4 h-4" /> Live Transcript
                        </h2>
                        {data.transcript && <button onClick={handleRegenerate} className="text-xs bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full hover:bg-emerald-500/20 transition-colors">Regenerate ⚡</button>}
                    </div>
                    <textarea value={data.transcript} onChange={(e) => updateData({transcript: e.target.value})} placeholder="Audio transcription will appear here..." className="flex-1 bg-transparent border-none outline-none resize-none text-slate-300 leading-relaxed text-sm placeholder:text-slate-700" />
                    
                    <div className="flex items-center justify-between border-t border-slate-800 pt-4 mt-2">
                        <span className="text-xs text-slate-400">Use Knowledge Base</span>
                        <button onClick={() => updateData({useRAG: !data.useRAG})} className="flex items-center gap-2 text-emerald-500 hover:text-emerald-400 transition-colors">
                            {data.useRAG ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6 text-slate-600" />}
                            <span className="text-xs font-medium">{data.useRAG ? "ON" : "OFF"}</span>
                        </button>
                    </div>
                    {data.visualAnalysis && <div className="mt-2 pt-2 border-t border-slate-800 text-xs text-slate-500"><span className="font-semibold text-emerald-500">Visual Findings:</span> {data.visualAnalysis}</div>}
                </div>
            </div>

            <div className="lg:col-span-8 space-y-6">
                 {data.safetyAnalysis && (
                    <div className={`border rounded-xl p-4 flex items-start gap-4 transition-all duration-500 ${data.safetyAnalysis.includes("WARNING") ? "bg-red-950/30 border-red-900/50 text-red-200" : "bg-emerald-950/30 border-emerald-900/50 text-emerald-200"}`}>
                    <div className={`p-2 rounded-full ${data.safetyAnalysis.includes("WARNING") ? "bg-red-900/50 text-red-500" : "bg-emerald-900/50 text-emerald-500"}`}>
                        {data.safetyAnalysis.includes("WARNING") ? <ShieldAlert className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
                    </div>
                    <div>
                        <h3 className="font-bold text-lg mb-1">{data.safetyAnalysis.includes("WARNING") ? "Safety Alert Triggered" : "Safety Check Passed"}</h3>
                        <p className="text-sm opacity-90">{data.safetyAnalysis}</p>
                    </div>
                    </div>
                )}

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 min-h-[600px] relative">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                            <Activity className="w-5 h-5 text-emerald-500" /> Generated SOAP Note
                        </h2>
                        <div className="flex flex-wrap gap-2">
                            {data.soapNote && <button onClick={isSpeaking ? stopSpeaking : handleExplain} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${isSpeaking ? "bg-amber-500/20 text-amber-400 border border-amber-500/50" : "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"}`}>{isSpeaking ? <StopCircle className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}{isSpeaking ? "Speaking..." : "Explain"}</button>}
                            {data.soapNote && !data.ddx && <button onClick={handleSecondOpinion} disabled={loadingDdx} className="flex items-center gap-2 px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/50 rounded-lg text-xs font-medium transition-colors"><BrainCircuit className="w-3 h-3" />{loadingDdx ? "Thinking..." : "Second Opinion"}</button>}
                            {data.soapNote && <button onClick={handleDownloadPDF} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-colors"><Download className="w-3 h-3" /> PDF</button>}
                        </div>
                    </div>

                    {data.soapNote ? (
                        <div className="space-y-6">
                            {data.ddx && <div className="bg-purple-950/20 border border-purple-500/30 rounded-xl p-4 animate-in fade-in slide-in-from-top-2"><div className="flex justify-between items-center mb-2"><h3 className="text-sm font-bold text-purple-400 flex items-center gap-2"><BrainCircuit className="w-4 h-4" /> Dr. House Analysis</h3><button onClick={() => updateData({ddx: ""})} className="text-slate-500 hover:text-white text-xs">Close</button></div><div className="prose prose-invert prose-sm max-w-none text-slate-300 text-xs"><ReactMarkdown>{data.ddx}</ReactMarkdown></div></div>}
                            <div className="prose prose-invert prose-emerald max-w-none text-slate-300"><ReactMarkdown>{data.soapNote}</ReactMarkdown></div>
                            {data.explanation && <div className="mt-8 p-4 bg-slate-950/50 border border-slate-800 rounded-xl"><h4 className="text-xs font-semibold text-slate-500 uppercase mb-2 flex items-center gap-2"><Volume2 className="w-3 h-3" /> Patient Summary (Spoken)</h4><p className="text-slate-300 italic text-sm leading-relaxed">"{data.explanation}"</p></div>}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-4 min-h-[300px]">
                            <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center"><Activity className="w-8 h-8 opacity-20" /></div>
                            <p>Waiting for consultation data...</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

// VITALIS OMNI (WITH VOICE & MEMORY & EXPAND)
function OmniAssistant({ messages, loading, onSend, onExpand, wakeWordStatus }: { 
    messages: OmniMessage[], 
    loading: boolean, 
    onSend: (text: string) => void, 
    onExpand: () => void,
    wakeWordStatus: 'inactive' | 'listening' | 'active'
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState("");
    const [isListening, setIsListening] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); };
    
    // Auto-scroll when new messages arrive OR when widget opens
    useEffect(() => { if(isOpen) scrollToBottom(); }, [messages, isOpen, loading]);

    const toggleListening = () => {
        if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) { alert("Browser does not support Speech API"); return; }
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        if (isListening) { recognition.stop(); setIsListening(false); } 
        else {
            recognition.start(); setIsListening(true);
            recognition.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                setInput(transcript); setIsListening(false);
            };
            recognition.onerror = () => setIsListening(false);
        }
    };

    const handleInputSend = () => {
        if(input.trim()) {
            onSend(input);
            setInput("");
        }
    }

    // Dynamic styles for the Trigger Button based on Voice State
    const getButtonStyles = () => {
        if (isOpen) return 'bg-slate-800 text-white rotate-90 scale-90';
        
        switch (wakeWordStatus) {
            case 'listening': // STANDBY (Waiting for "Hey Vitalis") - PURPLE
                return 'bg-purple-600 text-white hover:scale-110 shadow-purple-500/40 ring-4 ring-purple-500/20';
            case 'active': // ACTIVE (Heard Wake Word) - RED
                return 'bg-red-500 text-white scale-110 shadow-red-500/50 ring-4 ring-red-500/30';
            default: // NORMAL - EMERALD
                return 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white hover:scale-110 hover:shadow-emerald-500/40';
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
            {isOpen && (
                <div className="mb-6 w-[400px] h-[600px] bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300 ring-1 ring-white/10">
                    
                    {/* HEADER */}
                    <div className="p-4 bg-gradient-to-r from-emerald-900/20 to-slate-900 border-b border-white/5 flex justify-between items-center relative overflow-hidden shrink-0">
                        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent"></div>
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center border transition-colors ${
                                    wakeWordStatus === 'listening' ? 'bg-purple-500/20 border-purple-500/30' :
                                    wakeWordStatus === 'active' ? 'bg-red-500/20 border-red-500/30' :
                                    'bg-emerald-500/20 border-emerald-500/30'
                                }`}>
                                    <BrainCircuit className={`w-4 h-4 ${
                                        wakeWordStatus === 'listening' ? 'text-purple-400' :
                                        wakeWordStatus === 'active' ? 'text-red-400' :
                                        'text-emerald-400'
                                    }`} />
                                </div>
                                {/* Pulse Dot */}
                                <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900 animate-pulse ${
                                     wakeWordStatus === 'listening' ? 'bg-purple-500' :
                                     wakeWordStatus === 'active' ? 'bg-red-500' :
                                     'bg-emerald-500'
                                }`}></div>
                            </div>
                            <div>
                                <h3 className="font-bold text-white text-sm tracking-wide">VITALIS OMNI</h3>
                                <p className="text-[10px] font-mono uppercase tracking-wider opacity-70">
                                    {wakeWordStatus === 'listening' ? <span className="text-purple-400">Listening for Wake Word...</span> : 
                                     wakeWordStatus === 'active' ? <span className="text-red-400 animate-pulse">Processing Command...</span> : 
                                     <span className="text-emerald-400">Neural Link Active</span>}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-1">
                            <button onClick={() => { setIsOpen(false); onExpand(); }} className="p-2 hover:bg-white/5 rounded-full transition-colors text-slate-400 hover:text-white" title="Open Command Center"><Maximize2 className="w-4 h-4" /></button>
                            <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
                        </div>
                    </div>

                    {/* CHAT AREA */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-slate-950 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                        {messages.map((m, i) => (
                            <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {m.role === 'ai' && (
                                    <div className="w-6 h-6 mt-1 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shrink-0">
                                        <Sparkles className="w-3 h-3 text-emerald-400" />
                                    </div>
                                )}
                                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm break-words whitespace-pre-wrap ${
                                    m.role === 'user' 
                                    ? 'bg-emerald-600 text-white rounded-tr-sm' 
                                    : 'bg-slate-800/80 border border-slate-700/50 text-slate-200 rounded-tl-sm backdrop-blur-sm'
                                }`}>
                                    <div className="prose prose-invert prose-sm max-w-none">
                                        <ReactMarkdown>{m.text}</ReactMarkdown>
                                    </div>
                                </div>
                            </div>
                        ))}
                        
                        {loading && (
                            <div className="flex gap-3 justify-start">
                                <div className="w-6 h-6 mt-1 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                                    <Sparkles className="w-3 h-3 text-emerald-400" />
                                </div>
                                <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1.5 items-center">
                                    <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce"></div>
                                    <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce delay-75"></div>
                                    <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce delay-150"></div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* INPUT AREA */}
                    <div className="p-4 bg-slate-900/95 border-t border-white/5 backdrop-blur-md shrink-0">
                        <div className="relative flex items-center gap-2 bg-black/20 border border-slate-700/50 rounded-xl p-1 transition-all focus-within:border-emerald-500/50 focus-within:ring-1 focus-within:ring-emerald-500/20">
                            <button 
                                onClick={toggleListening} 
                                className={`p-2.5 rounded-lg transition-all duration-300 ${
                                    isListening 
                                    ? 'bg-red-500/10 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)]' 
                                    : 'text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10'
                                }`}
                            >
                                {isListening ? <div className="relative"><Mic className="w-5 h-5 animate-pulse" /><span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping"></span></div> : <Mic className="w-5 h-5" />}
                            </button>

                            <input 
                                className="flex-1 bg-transparent border-none text-sm text-white placeholder-slate-500 focus:ring-0 px-2 outline-none h-10" 
                                placeholder={isListening ? "Listening..." : "Type a command..."} 
                                value={input} 
                                onChange={e => setInput(e.target.value)} 
                                onKeyDown={e => e.key === 'Enter' && handleInputSend()} 
                                autoFocus
                            />

                            <button 
                                onClick={handleInputSend} 
                                disabled={loading || !input.trim()} 
                                className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-all disabled:opacity-0 disabled:scale-75 active:scale-95 shadow-lg shadow-emerald-500/20"
                            >
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="mt-2 text-center">
                            <p className="text-[10px] text-slate-600 font-mono">SECURE MEDICAL CHANNEL • ENCRYPTED</p>
                        </div>
                    </div>
                </div>
            )}

            {/* TRIGGER BUTTON (Dynamic) */}
            <button 
                onClick={() => setIsOpen(!isOpen)} 
                className={`group relative p-3 rounded-full shadow-2xl transition-all duration-500 z-50 ${getButtonStyles()}`}
            >
                {/* Purple Ring Animation for Standby Mode */}
                {!isOpen && wakeWordStatus === 'listening' && (
                    <span className="absolute inset-0 rounded-full bg-purple-400 opacity-30 animate-ping duration-1000"></span>
                )}
                {/* Emerald Ring Animation for Default Mode */}
                {!isOpen && wakeWordStatus === 'inactive' && (
                    <span className="absolute inset-0 rounded-full bg-emerald-400 opacity-20 animate-ping duration-1000"></span>
                )}
                
                {isOpen ? <X className="w-6 h-6" /> : <BrainCircuit className="w-6 h-6" />}
            </button>
        </div>
    );
}

// --- LAB RESULTS VIEW ---
function LabResultsView({ patients, addToast }: any) {
    const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
    const [labHistory, setLabHistory] = useState<any[]>([]);
    const [extractedData, setExtractedData] = useState<any[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [showVerifyModal, setShowVerifyModal] = useState(false);
    
    const [viewMode, setViewMode] = useState<"history" | "analyze">("history");
    const [trendSummaries, setTrendSummaries] = useState<{[key: string]: string}>({});
    const [analyzingTrend, setAnalyzingTrend] = useState<string | null>(null);
    const [labInsight, setLabInsight] = useState<string>("");

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!selectedPatientId || viewMode === "analyze") return;
        fetchHistory();
    }, [selectedPatientId, viewMode]);

    const fetchHistory = async () => {
        if(!selectedPatientId) return;
        try {
            const res = await fetch(`http://127.0.0.1:8000/patients/${selectedPatientId}/labs`);
            const data = await res.json();
            setLabHistory(data);
            setTrendSummaries({});
            setLabInsight(""); 
        } catch(e) { console.error("Failed to load history"); }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        // --- FIX: Reset the input so 'onChange' triggers again for the same file ---
        e.target.value = ""; 
        
        setIsUploading(true);
        
        const formData = new FormData();
        formData.append("file", file);
        
        try {
            const res = await fetch("http://127.0.0.1:8000/labs/extract/", { method: "POST", body: formData });
            const data = await res.json();
            
            // Check if data is empty to warn the user
            if (Array.isArray(data) && data.length > 0) {
                setExtractedData(data);
                setShowVerifyModal(true);
            } else {
                addToast("error", "No data found in PDF. Is it a scanned image?");
            }
        } catch (e) { addToast("error", "Error analyzing PDF"); }
        setIsUploading(false);
    };

    // --- OPTION 3: EDITABLE VERIFICATION ---
    const handleEditRow = (index: number, field: string, value: string) => {
        const updated = [...extractedData];
        updated[index] = { ...updated[index], [field]: value };
        setExtractedData(updated);
    };

    const handleSave = async () => {
        if (!selectedPatientId && viewMode === "history") return;
        try {
            if(viewMode === "history" && selectedPatientId) {
                const res = await fetch("http://127.0.0.1:8000/labs/save/", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ patient_id: selectedPatientId, results: extractedData })
                });
                const data = await res.json();
                addToast("success", "Lab Results Saved!");
                await fetchHistory();
                if (data.insight) {
                    setLabInsight(data.insight);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            }
            setShowVerifyModal(false);
            setExtractedData([]);
        } catch (e) { addToast("error", "Save Failed"); }
    };

    const handleRunDiagnosis = async () => {
        if (!selectedPatientId) return;
        addToast("info", "Consulting Dr. House...");
        try {
            const formData = new FormData();
            formData.append("patient_id", selectedPatientId.toString());
            const res = await fetch("http://127.0.0.1:8000/labs/analyze-history/", { method: "POST", body: formData });
            const data = await res.json();
            setLabInsight(data.insight);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (e) { addToast("error", "Analysis Failed"); }
    };

    const handleDownloadReport = async () => {
        if (!selectedPatientId) return;
        addToast("info", "Generating PDF...");
        try {
            const formData = new FormData();
            formData.append("patient_id", selectedPatientId.toString());
            const res = await fetch("http://127.0.0.1:8000/labs/generate-report/", { method: "POST", body: formData });
            if(res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url; a.download = `Lab_Report_${selectedPatientId}.pdf`;
                document.body.appendChild(a); a.click(); a.remove();
                addToast("success", "Report Downloaded!");
            }
        } catch(e) { addToast("error", "Download Failed"); }
    };

    const handleQuickDownload = async () => {
        addToast("info", "Generating Analysis...");
        try {
            const res = await fetch("http://127.0.0.1:8000/labs/quick-report/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(extractedData)
            });
            if(res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url; a.download = `Quick_Analysis.pdf`;
                document.body.appendChild(a); a.click(); a.remove();
                addToast("success", "Analysis Downloaded!");
            }
        } catch(e) { addToast("error", "Download Failed"); }
    };

    const getChartData = (testName: string) => {
        return labHistory
            .filter((r: any) => r.test_name === testName)
            .map((r: any) => ({
                date: new Date(r.date).toLocaleDateString(),
                value: parseFloat(r.value)
            }));
    };

    const handleAnalyzeTrend = async (testName: string) => {
        const data = getChartData(testName);
        if(data.length < 2) {
            addToast("info", "Not enough data points to analyze trend.");
            return;
        }
        setAnalyzingTrend(testName);
        try {
            const res = await fetch("http://127.0.0.1:8000/labs/analyze-trend/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ test_name: testName, history: data })
            });
            const resData = await res.json();
            setTrendSummaries(prev => ({...prev, [testName]: resData.summary}));
        } catch(e) { console.error(e); addToast("error", "Trend Analysis Failed"); }
        setAnalyzingTrend(null);
    };

    const uniqueTests = Array.from(new Set(labHistory.map((r: any) => r.test_name)));

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center bg-slate-900 border border-slate-800 p-4 rounded-xl gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-red-500/10 rounded-lg">
                        <Activity className="w-6 h-6 text-red-500" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white">Universal Lab Tracker</h2>
                        <p className="text-xs text-slate-400">AI-Powered Biomarker Analysis</p>
                    </div>
                </div>
                
                <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
                    <button onClick={() => setViewMode("history")} className={`px-4 py-2 text-xs font-medium rounded-md transition-all ${viewMode === "history" ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"}`}>Patient History</button>
                    <button onClick={() => setViewMode("analyze")} className={`px-4 py-2 text-xs font-medium rounded-md transition-all ${viewMode === "analyze" ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"}`}>Quick Analyze</button>
                </div>

                {viewMode === "history" && (
                    <select className="bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none" onChange={(e) => setSelectedPatientId(Number(e.target.value))} value={selectedPatientId || ""}>
                        <option value="">Select Patient...</option>
                        {patients.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                )}
            </div>

            {/* DR HOUSE INSIGHT CARD */}
            {labInsight && viewMode === "history" && (
                <div className="bg-gradient-to-r from-purple-950/40 to-slate-900 border border-purple-500/30 rounded-xl p-6 relative animate-in fade-in slide-in-from-top-4 shadow-lg shadow-purple-900/10">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-purple-900/30 rounded-full border border-purple-500/30">
                            <BrainCircuit className="w-6 h-6 text-purple-400 animate-pulse" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-sm font-bold text-purple-300 mb-2 uppercase tracking-wider flex items-center gap-2">Diagnostic Pattern Detected</h3>
                            <div className="text-slate-200 text-sm leading-relaxed prose prose-invert prose-p:my-0"><ReactMarkdown>{labInsight}</ReactMarkdown></div>
                        </div>
                        <button onClick={() => setLabInsight("")} className="text-slate-500 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
                    </div>
                </div>
            )}

            {/* HISTORY DASHBOARD */}
            {viewMode === "history" && selectedPatientId && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* LEFT: Charts */}
                    <div className="lg:col-span-2 space-y-6">
                        {uniqueTests.length === 0 ? (
                            <div className="h-64 flex flex-col items-center justify-center text-slate-600 border border-dashed border-slate-800 rounded-2xl bg-slate-900/30">
                                <FileText className="w-12 h-12 mb-4 opacity-20" />
                                <p>No historical data found. Upload a report to begin.</p>
                            </div>
                        ) : (
                            uniqueTests.map(test => (
                                <div key={test} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl group transition-all hover:border-slate-700">
                                    <div className="flex justify-between items-start mb-4">
                                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                            {test} History
                                        </h3>
                                        <button onClick={() => handleAnalyzeTrend(test)} disabled={analyzingTrend === test} className="text-xs flex items-center gap-1 text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 px-2 py-1 rounded-lg transition-colors">
                                            {analyzingTrend === test ? <Loader2 className="w-3 h-3 animate-spin" /> : <TrendingUp className="w-3 h-3" />}
                                            {trendSummaries[test] ? "Re-Analyze" : "Analyze Trend"}
                                        </button>
                                    </div>
                                    <div className="h-48 w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={getChartData(test)}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                                <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                                                <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                                                <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }} itemStyle={{ color: '#fff' }} />
                                                
                                                {/* --- OPTION 2: SAFE ZONE --- */}
                                                {REFERENCE_RANGES[test] && (
                                                    <ReferenceArea 
                                                        y1={REFERENCE_RANGES[test].min} 
                                                        y2={REFERENCE_RANGES[test].max} 
                                                        strokeOpacity={0}
                                                        fill="#10b981" 
                                                        fillOpacity={0.1}
                                                        label={{ position: 'insideTopRight', value: 'Normal Range', fill: '#10b981', fontSize: 10 }}
                                                    />
                                                )}
                                                
                                                <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={3} dot={{ fill: '#0f172a', stroke: '#10b981', strokeWidth: 2, r: 4 }} activeDot={{ r: 6, fill: '#10b981' }} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                    {trendSummaries[test] && (
                                        <div className="mt-4 p-3 bg-indigo-900/20 border border-indigo-500/20 rounded-lg animate-in fade-in slide-in-from-top-2">
                                            <div className="flex gap-2">
                                                <Sparkles className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
                                                <p className="text-xs text-indigo-200 leading-relaxed italic">"{trendSummaries[test]}"</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>

                    {/* RIGHT: Upload */}
                    <div className="space-y-6">
                        <div className="bg-gradient-to-br from-indigo-900/20 to-slate-900 border border-indigo-500/30 p-6 rounded-2xl text-center shadow-lg shadow-indigo-900/10">
                            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".pdf" />
                            <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 group">
                                {isUploading ? <Loader2 className="animate-spin" /> : <Upload className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />}
                                Add New Report
                            </button>
                            <button onClick={handleRunDiagnosis} className="w-full mt-3 bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/50 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2">
                                <Stethoscope className="w-4 h-4" /> Run AI Diagnosis
                            </button>
                            <button onClick={handleDownloadReport} className="w-full mt-3 bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 border border-slate-700 hover:border-slate-500">
                                <Download className="w-4 h-4" /> Download Full History PDF
                            </button>
                            <p className="text-xs text-indigo-300/60 mt-3">Supports Blood, Urine, & Metabolic Panels</p>
                        </div>

                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 overflow-hidden h-[400px] flex flex-col">
                            <h4 className="text-xs font-bold text-slate-400 uppercase mb-4 tracking-wider">Recent Results</h4>
                            <div className="space-y-2 overflow-y-auto flex-1 pr-2">
                                {labHistory.slice().reverse().map((res, i) => (
                                    <div key={i} className="flex justify-between items-center p-3 hover:bg-slate-800/50 rounded-xl transition-colors border border-transparent hover:border-slate-700/50">
                                        <div>
                                            <div className="text-sm font-medium text-white">{res.test_name}</div>
                                            <div className="text-[10px] text-slate-500">{new Date(res.date).toLocaleDateString()}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-mono text-white">{res.value} <span className="text-xs text-slate-500">{res.unit}</span></div>
                                            <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-1 ${
                                                res.status === 'High' ? 'bg-red-500/10 text-red-500' : 
                                                res.status === 'Low' ? 'bg-blue-500/10 text-blue-500' : 'bg-emerald-500/10 text-emerald-500'
                                            }`}>{res.status.toUpperCase()}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* QUICK ANALYZE */}
            {viewMode === "analyze" && (
                <div className="flex flex-col items-center justify-center min-h-[400px] space-y-8">
                    <div className="text-center max-w-lg">
                        <h3 className="text-2xl font-bold text-white mb-2">Instant Lab Analysis</h3>
                        <p className="text-slate-400">Upload any medical report PDF to extract structured data instantly without saving it to a patient record.</p>
                    </div>
                    <div className="w-full max-w-md bg-slate-900 border border-dashed border-slate-700 rounded-3xl p-10 text-center hover:border-emerald-500/50 transition-colors cursor-pointer group" onClick={() => fileInputRef.current?.click()}>
                        <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".pdf" />
                        <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform shadow-xl">
                            {isUploading ? <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" /> : <FileUp className="w-8 h-8 text-emerald-500" />}
                        </div>
                        <h4 className="text-white font-medium mb-1">Click to Upload PDF</h4>
                        <p className="text-xs text-slate-500">Processing happens locally on-device</p>
                    </div>
                </div>
            )}

            {/* VERIFICATION MODAL (EDITABLE) */}
            {showVerifyModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
                        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold text-white flex items-center gap-2"><Sparkles className="w-5 h-5 text-indigo-500" /> Verify Extraction</h3>
                                <p className="text-xs text-slate-400 mt-1">Click any cell to edit details before saving.</p>
                            </div>
                            <button onClick={() => setShowVerifyModal(false)} className="text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-500 uppercase bg-slate-800/50">
                                    <tr>
                                        <th className="px-4 py-3 rounded-l-lg">Test Name</th>
                                        <th className="px-4 py-3">Value</th>
                                        <th className="px-4 py-3">Unit</th>
                                        <th className="px-4 py-3">Date</th>
                                        <th className="px-4 py-3 rounded-r-lg">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {extractedData.map((row, i) => (
                                        <tr key={i} className="hover:bg-slate-800/30">
                                            {/* EDITABLE FIELDS */}
                                            <td className="px-4 py-2">
                                                <input value={row.test_name} onChange={(e) => handleEditRow(i, 'test_name', e.target.value)} className="bg-transparent border-b border-transparent focus:border-indigo-500 outline-none w-full text-white font-medium" />
                                            </td>
                                            <td className="px-4 py-2">
                                                <input value={row.value} onChange={(e) => handleEditRow(i, 'value', e.target.value)} className="bg-transparent border-b border-transparent focus:border-indigo-500 outline-none w-16 text-indigo-300 font-mono" />
                                            </td>
                                            <td className="px-4 py-2">
                                                <input value={row.unit} onChange={(e) => handleEditRow(i, 'unit', e.target.value)} className="bg-transparent border-b border-transparent focus:border-indigo-500 outline-none w-16 text-slate-500" />
                                            </td>
                                            <td className="px-4 py-2">
                                                <input value={row.date} onChange={(e) => handleEditRow(i, 'date', e.target.value)} className="bg-transparent border-b border-transparent focus:border-indigo-500 outline-none w-24 text-slate-400 text-xs" />
                                            </td>
                                            <td className="px-4 py-2">
                                                <select 
                                                    value={row.status} 
                                                    onChange={(e) => handleEditRow(i, 'status', e.target.value)} 
                                                    className={`bg-transparent border-b border-transparent focus:border-indigo-500 outline-none w-20 text-xs font-bold ${
                                                        row.status === 'High' ? 'text-red-500' : row.status === 'Low' ? 'text-blue-500' : 'text-emerald-500'
                                                    }`}
                                                >
                                                    <option value="Normal" className="bg-slate-900 text-emerald-500">Normal</option>
                                                    <option value="High" className="bg-slate-900 text-red-500">High</option>
                                                    <option value="Low" className="bg-slate-900 text-blue-500">Low</option>
                                                </select>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-6 border-t border-slate-800 flex justify-end gap-3 bg-slate-900/50">
                            <button onClick={() => setShowVerifyModal(false)} className="px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm">Close</button>
                            {viewMode === "analyze" && (
                                <button onClick={handleQuickDownload} className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-2 rounded-lg font-bold transition-colors text-sm flex items-center gap-2"><Printer className="w-4 h-4" /> Download PDF Analysis</button>
                            )}
                            {viewMode === "history" && (
                                <button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg font-bold transition-colors shadow-lg shadow-indigo-500/20 text-sm flex items-center gap-2"><FileText className="w-4 h-4" /> Confirm & Save to Record</button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// --- COMPONENT: PASSPORT VIEW ---
function PassportView({ patients, addToast, refreshPatients }: any) {
    const [exportId, setExportId] = useState("");
    const [exportPass, setExportPass] = useState("");
    const [validity, setValidity] = useState("24");
    const [isStealth, setIsStealth] = useState(false);
    const [coverImage, setCoverImage] = useState<File | null>(null);
    
    const [importPass, setImportPass] = useState("");
    const [importFile, setImportFile] = useState<File | null>(null);
    const [processing, setProcessing] = useState(false);
    
    // NEW STATES
    const [showInfo, setShowInfo] = useState(false);
    const [previewData, setPreviewData] = useState<any>(null);

    const importRef = useRef<HTMLInputElement>(null);
    const coverInputRef = useRef<HTMLInputElement>(null);

    // ... (Keep handleExport same as before) ...
    const handleExport = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!exportId || !exportPass) return;
        if(isStealth && !coverImage) { addToast("error", "Cover Image Required"); return; }
        
        addToast("info", isStealth ? "Embedding into Image..." : "Encrypting...");
        try {
            const formData = new FormData();
            formData.append("patient_id", exportId);
            formData.append("password", exportPass);
            formData.append("hours", validity);
            if(isStealth && coverImage) formData.append("carrier_image", coverImage);
            
            const res = await fetch("http://127.0.0.1:8000/passport/export/", { method: "POST", body: formData });
            
            if(res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                const patientName = patients.find((p:any) => p.id === parseInt(exportId))?.name || "Patient";
                const ext = isStealth ? "png" : "vitalis";
                a.download = `Passport_${patientName.replace(" ", "_")}.${ext}`;
                document.body.appendChild(a); a.click(); a.remove();
                addToast("success", isStealth ? "Stealth Passport Created!" : "Secure Passport Issued");
                setExportPass(""); setCoverImage(null);
            } else { throw new Error(); }
        } catch(e) { addToast("error", "Export Failed"); }
    };

    // ... (Keep handleImport same as before) ...
    const handleImport = async () => {
        if(!importFile || !importPass) return;
        setProcessing(true);
        try {
            const formData = new FormData();
            formData.append("file", importFile);
            formData.append("password", importPass);
            
            const res = await fetch("http://127.0.0.1:8000/passport/import/", { method: "POST", body: formData });
            const data = await res.json();
            if(res.ok) {
                addToast("success", `Visa Granted: Welcome ${data.name}`);
                setImportFile(null); setImportPass(""); setPreviewData(null); // Close preview
                refreshPatients(); 
            } else { addToast("error", data.detail || "Access Denied"); }
        } catch(e) { addToast("error", "Import Failed"); }
        setProcessing(false);
    };

    // NEW: HANDLE PEEK
    const handlePeek = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!importFile || !importPass) return;
        
        setProcessing(true);
        try {
            const formData = new FormData();
            formData.append("file", importFile);
            formData.append("password", importPass);
            
            const res = await fetch("http://127.0.0.1:8000/passport/peek/", { method: "POST", body: formData });
            const data = await res.json();
            
            if(res.ok) {
                setPreviewData(data);
                addToast("success", "Decryption Successful: Preview Ready");
            } else {
                addToast("error", data.detail || "Invalid Credentials");
            }
        } catch(e) { addToast("error", "Peek Failed"); }
        setProcessing(false);
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 relative">
            
            {/* HERO HEADER WITH INFO TOGGLE */}
            <div className="text-center space-y-4 py-8 relative">
                <button 
                    onClick={() => setShowInfo(!showInfo)}
                    className="absolute right-0 top-8 p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors border border-slate-700"
                >
                    <Info className="w-5 h-5" />
                </button>

                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900 border border-slate-700 text-xs font-mono text-emerald-400">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                    SECURE P2P PROTOCOL ACTIVE
                </div>
                <h2 className="text-4xl font-bold text-white tracking-tight">Vitalis <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-500">Passport</span></h2>
                <p className="text-slate-400 max-w-2xl mx-auto text-lg">
                    Military-grade encrypted data transport. Use Stealth Mode to hide medical history inside standard images.
                </p>
            </div>

            {/* NEW: INFO OVERLAY */}
            {showInfo && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8 animate-in slide-in-from-top-4">
                <InfoCard 
                    icon={<Shield className="text-emerald-500" />} 
                    title="AES-256 Encryption" 
                    desc="Military-grade security. Data is cryptographically sealed and unreadable without the specific PIN." 
                />
                <InfoCard 
                    icon={<EyeOff className="text-purple-500" />} 
                    title="Stealth Mode" 
                    desc="Medical Steganography. Hides the entire encrypted patient history inside a standard X-Ray image." 
                />
                <InfoCard 
                    icon={<Clock className="text-amber-500" />} 
                    title="Time-Lock Protocol" 
                    desc="Set expiration timers. Passports self-destruct and deny decryption after the specified duration." 
                />
                <InfoCard 
                    icon={<Zap className="text-blue-500" />} 
                    title="Bio-Compression" 
                    desc="Smart compression reduces large patient histories (including Labs) into tiny, instant-share files." 
                />
                <InfoCard 
                    icon={<ScanEye className="text-cyan-400" />} 
                    title="Deep Peek" 
                    desc="Trust but Verify. Scan and preview the contents of a secure file before granting it access to your database." 
                />
                <InfoCard 
                    icon={<Siren className="text-red-500" />} 
                    title="AI Customs Officer" 
                    desc="Intelligent Audit. The AI detects conflicts (e.g. Allergies) between the Passport and your Local Record." 
                />
            </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                
                {/* LEFT: EXPORT STATION */}
                <div className={`bg-slate-900/50 backdrop-blur-xl border rounded-3xl p-8 relative overflow-hidden transition-all duration-500 ${isStealth ? "border-purple-500/30" : "border-emerald-500/30"}`}>
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-8">
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-lg ${isStealth ? "bg-purple-500/10 border-purple-500/20 text-purple-400" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"}`}>
                                    {isStealth ? <EyeOff className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white">{isStealth ? "Stealth Protocol" : "Standard Export"}</h3>
                                    <p className="text-xs text-slate-400">{isStealth ? "Embed Data in Image" : "Encrypted .vitalis File"}</p>
                                </div>
                            </div>
                            <button onClick={() => setIsStealth(!isStealth)} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${isStealth ? "bg-purple-500 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}>
                                {isStealth ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                {isStealth ? "STEALTH ON" : "STEALTH OFF"}
                            </button>
                        </div>

                        <form onSubmit={handleExport} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Citizen Identity</label>
                                <div className="relative">
                                    <select value={exportId} onChange={e => setExportId(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 pl-4 text-white focus:ring-2 focus:ring-emerald-500/50 outline-none appearance-none" required>
                                        <option value="">Select Patient Record...</option>
                                        {patients.map((p: any) => <option key={p.id} value={p.id}>{p.name} (ID: #{p.id})</option>)}
                                    </select>
                                    <ChevronDown className="absolute right-4 top-4 w-5 h-5 text-slate-500 pointer-events-none" />
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Security PIN</label>
                                    <input type="password" value={exportPass} onChange={e => setExportPass(e.target.value)} placeholder="Set PIN..." className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-white focus:ring-2 focus:ring-emerald-500/50 outline-none font-mono tracking-widest" required />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Time Lock</label>
                                    <select value={validity} onChange={e => setValidity(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-emerald-300 focus:ring-2 focus:ring-emerald-500/50 outline-none font-mono text-sm" required>
                                        <option value="1">1 Hour</option>
                                        <option value="24">24 Hours</option>
                                        <option value="168">7 Days</option>
                                        <option value="-1">Unlimited</option>
                                    </select>
                                </div>
                            </div>

                            {isStealth && (
                                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                    <label className="text-xs font-bold text-purple-400 uppercase tracking-wider ml-1 flex items-center gap-2"><ImageIcon className="w-3 h-3" /> Cover Image (Carrier)</label>
                                    <div onClick={() => coverInputRef.current?.click()} className={`border-2 border-dashed border-purple-500/30 rounded-xl p-4 text-center cursor-pointer hover:bg-purple-500/10 transition-colors ${coverImage ? "bg-purple-500/20" : ""}`}>
                                        <input type="file" ref={coverInputRef} onChange={e => setCoverImage(e.target.files?.[0] || null)} className="hidden" accept="image/png, image/jpeg" />
                                        <p className="text-xs text-purple-300">{coverImage ? coverImage.name : "Click to select X-Ray or Photo"}</p>
                                    </div>
                                </div>
                            )}

                            <button type="submit" className={`w-full text-white font-bold py-4 rounded-xl flex items-center justify-center gap-3 transition-all transform active:scale-95 shadow-lg ${isStealth ? "bg-purple-600 hover:bg-purple-500 shadow-purple-500/20" : "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20"}`}>
                                {isStealth ? "Download Stealth Image" : "Generate Secure Passport"}
                                <DownloadCloud className="w-5 h-5" />
                            </button>
                        </form>
                    </div>
                </div>

                {/* RIGHT: IMPORT STATION (The Scanner) */}
                <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 relative overflow-hidden group hover:border-blue-500/30 transition-all duration-500">
                    <div className="relative z-10">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20 shadow-lg shadow-blue-500/10">
                                <Unlock className="w-6 h-6 text-blue-400" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">Visa Entry</h3>
                                <p className="text-xs text-slate-400">Import Passport File</p>
                            </div>
                        </div>

                        <form className="space-y-6">
                            <div onClick={() => importRef.current?.click()} className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 overflow-hidden group/drop ${importFile ? "border-blue-500 bg-blue-500/10" : "border-slate-700 hover:border-blue-400/50 hover:bg-slate-800/50"}`}>
                                <input type="file" ref={importRef} onChange={e => setImportFile(e.target.files?.[0] || null)} className="hidden" accept=".vitalis,.png,.jpg,.jpeg" />
                                {importFile ? (
                                    <div className="relative z-10">
                                        <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-xl shadow-blue-500/30"><FileText className="w-8 h-8 text-white" /></div>
                                        <div className="text-blue-300 font-bold font-mono text-sm">{importFile.name}</div>
                                        <p className="text-xs text-blue-400/60 mt-1">Ready for Decryption</p>
                                    </div>
                                ) : (
                                    <div className="relative z-10">
                                        <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover/drop:scale-110 transition-transform"><Upload className="w-8 h-8 text-slate-400 group-hover/drop:text-blue-400" /></div>
                                        <div className="text-slate-300 font-medium">Drop file here</div>
                                        <p className="text-xs text-slate-500 mt-2">Supports <span className="text-emerald-400">.vitalis</span> or <span className="text-purple-400">Stealth Images</span></p>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Decryption Key</label>
                                <div className="relative group/pass">
                                    <input type="password" value={importPass} onChange={e => setImportPass(e.target.value)} placeholder="Enter sender's PIN..." className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 pl-12 text-white focus:ring-2 focus:ring-blue-500/50 outline-none font-mono tracking-widest transition-all" required />
                                    <div className="absolute left-4 top-4 text-slate-500 group-focus-within/pass:text-blue-500 transition-colors"><Unlock className="w-5 h-5" /></div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                {/* NEW: PEEK BUTTON */}
                                <button onClick={handlePeek} disabled={processing} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all border border-slate-600">
                                    {processing ? <Loader2 className="animate-spin w-5 h-5" /> : <FileSearch className="w-5 h-5" />}
                                    Peek Content
                                </button>
                                
                                <button onClick={(e) => { e.preventDefault(); handleImport(); }} disabled={processing} className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/20">
                                    <ArrowRight className="w-5 h-5" />
                                    Grant Access
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

           {/* PREVIEW MODAL WITH AI AUDIT */}
           {previewData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl p-8 relative overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Background Grid */}
                        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none"></div>
                        
                        <div className="relative z-10 text-center space-y-6 overflow-y-auto custom-scrollbar">
                            {/* Header Icon */}
                            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto border border-emerald-500/50 shadow-lg shadow-emerald-500/20">
                                <ShieldCheck className="w-8 h-8 text-emerald-400" />
                            </div>
                            
                            <div>
                                <h3 className="text-2xl font-bold text-white">Identity Verified</h3>
                                <p className={`text-sm font-mono mt-1 ${previewData.status === 'EXPIRED' ? 'text-red-500' : 'text-emerald-400'}`}>
                                    Clearance: {previewData.status}
                                </p>
                            </div>

                            {/* --- AI CUSTOMS REPORT (NEW) --- */}
                            {previewData.audit && previewData.audit.has_conflict ? (
                                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-left animate-in slide-in-from-bottom-2">
                                    <h4 className="text-red-400 font-bold flex items-center gap-2 mb-2">
                                        <AlertTriangle className="w-5 h-5" /> 
                                        Conflict Detected
                                    </h4>
                                    <ul className="list-disc list-inside text-xs text-red-300/80 space-y-1">
                                        {previewData.audit.warnings?.map((w: string, i: number) => (
                                            <li key={i}>{w}</li>
                                        ))}
                                    </ul>
                                    <p className="text-xs font-mono text-red-400 mt-2 uppercase border-t border-red-500/20 pt-2">
                                        Recommendation: {previewData.audit.recommendation}
                                    </p>
                                </div>
                            ) : previewData.audit ? (
                                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-center animate-in slide-in-from-bottom-2">
                                    <p className="text-emerald-400 text-xs font-bold flex items-center justify-center gap-2">
                                        <CheckCircle2 className="w-4 h-4" /> 
                                        AI Audit Passed: No Conflicts with Local Records
                                    </p>
                                </div>
                            ) : null}
                            {/* ------------------------------- */}

                            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-left space-y-3">
                                <div className="flex justify-between border-b border-slate-800 pb-2">
                                    <span className="text-slate-500 text-xs uppercase">Subject</span>
                                    <span className="text-white font-medium">{previewData.name} ({previewData.age}y)</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-800 pb-2">
                                    <span className="text-slate-500 text-xs uppercase">History</span>
                                    <span className="text-slate-300 text-sm truncate max-w-[200px]">{previewData.history_preview}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-slate-900 p-2 rounded text-center">
                                        <div className="text-xl font-bold text-blue-400">{previewData.consult_count}</div>
                                        <div className="text-[10px] text-slate-500 uppercase">Consults</div>
                                    </div>
                                    <div className="bg-slate-900 p-2 rounded text-center">
                                        <div className="text-xl font-bold text-purple-400">{previewData.lab_count}</div>
                                        <div className="text-[10px] text-slate-500 uppercase">Lab Records</div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <button onClick={() => setPreviewData(null)} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-all">
                                    Reject
                                </button>
                                <button 
                                    onClick={() => { handleImport(); }} 
                                    disabled={previewData.status === 'EXPIRED'}
                                    className={`w-full text-white font-bold py-3 rounded-xl transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                                        previewData.audit?.has_conflict 
                                        ? "bg-amber-600 hover:bg-amber-500 shadow-amber-500/20" 
                                        : "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20"
                                    }`}
                                >
                                    {previewData.audit?.has_conflict ? "Force Merge" : "Merge Data"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function InfoCard({ icon, title, desc }: any) {
    return (
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl flex flex-col items-center text-center gap-2 hover:border-slate-600 transition-colors">
            <div className="p-2 bg-slate-950 rounded-lg">{icon}</div>
            <h4 className="font-bold text-white text-sm">{title}</h4>
            <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>
        </div>
    )
}

// --- OMNI COMMAND CENTER ---
function OmniView({ messages, loading, onSend, settings, setSettings }: { 
    messages: OmniMessage[], 
    loading: boolean, 
    onSend: (text: string) => void,
    settings: any,
    setSettings: any
}) {
    const [input, setInput] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

    return (
        <div className="h-full flex flex-col lg:grid lg:grid-cols-4 gap-6 animate-in fade-in duration-500">
            
            {/* LEFT: MEMORY BANK */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col overflow-hidden min-h-0">
                <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50 shrink-0">
                    <h3 className="font-bold text-white flex items-center gap-2"><History className="w-4 h-4 text-emerald-500" /> Memory Bank</h3>
                    <button className="text-slate-500 hover:text-red-400 transition-colors" title="Clear History"><Eraser className="w-4 h-4" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                    {messages.filter(m => m.role === 'user').slice().reverse().map((m, i) => (
                        <button key={i} className="w-full text-left p-3 rounded-xl hover:bg-slate-800 transition-colors group">
                            <div className="text-sm font-medium text-slate-300 group-hover:text-white truncate">{m.text}</div>
                            <div className="text-[10px] text-slate-600">{m.time}</div>
                        </button>
                    ))}
                </div>
            </div>

            {/* CENTER: ACTIVE NEURAL LINK (Chat) */}
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col relative overflow-hidden min-h-0">
                <div className="absolute inset-0 bg-slate-950 opacity-80 pointer-events-none"></div>
                
                <div className="p-4 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center z-10 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_#10b981]"></div>
                        <span className="font-mono text-sm text-emerald-400 tracking-wider">LIVE LINK ACTIVE</span>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 z-10 bg-slate-950/50 custom-scrollbar">
                    {messages.map((m, i) => (
                        <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                            <div className={`max-w-[85%] rounded-2xl px-5 py-4 text-sm leading-relaxed shadow-lg break-words whitespace-pre-wrap ${
                                m.role === 'user' 
                                ? 'bg-emerald-600 text-white rounded-tr-sm' 
                                : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-tl-sm'
                            }`}>
                                <ReactMarkdown>{m.text}</ReactMarkdown>
                            </div>
                            <span className="text-[10px] text-slate-600 mt-1 px-1">{m.time}</span>
                        </div>
                    ))}
                    {loading && (
                        <div className="flex gap-2 items-center text-emerald-500 p-4"><Sparkles className="w-4 h-4 animate-spin" /> <span className="text-xs font-mono">Thinking...</span></div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <div className="p-4 bg-slate-950 border-t border-slate-800 z-10 shrink-0">
                    <div className="relative flex items-center gap-3 bg-slate-900 border border-slate-700 rounded-xl p-2 transition-all focus-within:border-emerald-500/50 focus-within:ring-1 focus-within:ring-emerald-500/20">
                        <input className="flex-1 bg-transparent border-none text-white placeholder-slate-500 focus:ring-0 outline-none h-10 px-2" placeholder="Type or speak to Omni..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && input.trim() && (onSend(input), setInput(''))} />
                        <button onClick={() => { if(input.trim()) { onSend(input); setInput(''); } }} className="p-3 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white shadow-lg shadow-emerald-500/20 transition-all"><ArrowRight className="w-5 h-5" /></button>
                    </div>
                </div>
            </div>

            {/* RIGHT: SETTINGS */}
            <div className="space-y-6 overflow-y-auto custom-scrollbar">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                    <h3 className="font-bold text-white flex items-center gap-2 mb-6"><Settings className="w-4 h-4 text-purple-500" /> Cortex Settings</h3>
                    <div className="space-y-6">
                        {/* Always Listen Toggle */}
                        <div className="flex justify-between items-center group">
                            <div><div className="text-sm text-slate-300 font-medium">Always Listen</div><div className="text-[10px] text-slate-500">Wake word "Hey Omni"</div></div>
                            <button onClick={() => setSettings({...settings, alwaysListen: !settings.alwaysListen})} className={`w-10 h-5 rounded-full relative transition-colors ${settings.alwaysListen ? "bg-emerald-500" : "bg-slate-700"}`}><div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-all ${settings.alwaysListen ? "left-6" : "left-1"}`}></div></button>
                        </div>
                        {/* Voice Response Toggle */}
                        <div className="flex justify-between items-center group">
                            <div><div className="text-sm text-slate-300 font-medium">Vocal Response</div><div className="text-[10px] text-slate-500">Text-to-Speech output</div></div>
                            <button onClick={() => setSettings({...settings, voiceResponse: !settings.voiceResponse})} className={`w-10 h-5 rounded-full relative transition-colors ${settings.voiceResponse ? "bg-blue-500" : "bg-slate-700"}`}><div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-all ${settings.voiceResponse ? "left-6" : "left-1"}`}></div></button>
                        </div>
                        <div className="flex justify-between items-center group opacity-50 cursor-not-allowed">
                            <div><div className="text-sm text-slate-300 font-medium">Deep Memory</div><div className="text-[10px] text-slate-500">Full database context</div></div>
                            <button className="w-10 h-5 rounded-full relative bg-purple-500"><div className="w-3 h-3 bg-white rounded-full absolute top-1 left-6"></div></button>
                        </div>
                    </div>
                </div>
                
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                    <h3 className="font-bold text-white flex items-center gap-2 mb-4"><Info className="w-4 h-4 text-blue-500" /> Capabilities</h3>
                    <ul className="space-y-3">
                        <li className="flex gap-3 items-start"><div className="p-1.5 bg-emerald-500/10 rounded-md mt-0.5"><Mic className="w-3 h-3 text-emerald-500" /></div><p className="text-xs text-slate-400"><span className="text-slate-200 font-medium">Voice Command:</span> Say "Create new patient" or "Open Passport".</p></li>
                        <li className="flex gap-3 items-start"><div className="p-1.5 bg-purple-500/10 rounded-md mt-0.5"><BrainCircuit className="w-3 h-3 text-purple-500" /></div><p className="text-xs text-slate-400"><span className="text-slate-200 font-medium">Context Awareness:</span> Omni knows which file is open.</p></li>
                        <li className="flex gap-3 items-start"><div className="p-1.5 bg-blue-500/10 rounded-md mt-0.5"><Power className="w-3 h-3 text-blue-500" /></div><p className="text-xs text-slate-400"><span className="text-slate-200 font-medium">System Control:</span> Full app navigation control.</p></li>
                    </ul>
                </div>
            </div>
        </div>
    );
}