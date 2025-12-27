"use client";

import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from 'react-markdown';
import { Mic, Square, Activity, ShieldAlert, ShieldCheck, FileText, Loader2, Upload, Users, ChevronDown, Download, UserPlus, LayoutDashboard, Settings, Menu, FileClock, Image as ImageIcon } from "lucide-react";

interface Patient {
  id: number;
  name: string;
  age: number;
  medical_history: string;
}

export default function VitalisApp() {
  // --- NAVIGATION STATE ---
  const [activeTab, setActiveTab] = useState<"consultation" | "patients" | "records">("consultation");
  const [isSidebarOpen, setSidebarOpen] = useState(true);

  // --- APP STATES ---
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  
  // Refresh Patients List
  const fetchPatients = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/patients/");
      const data = await res.json();
      setPatients(data);
      if (data.length > 0 && !selectedPatientId) setSelectedPatientId(data[0].id);
    } catch (error) {
      console.error("Failed to fetch patients", error);
    }
  };

  useEffect(() => { fetchPatients(); }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans flex overflow-hidden">
      
      {/* 1. SIDEBAR (The Navigation) */}
      <aside className={`${isSidebarOpen ? "w-64" : "w-20"} bg-slate-900 border-r border-slate-800 transition-all duration-300 flex flex-col`}>
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
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

        <nav className="flex-1 p-4 space-y-2">
            <NavButton icon={<LayoutDashboard />} label="Consultation" active={activeTab === "consultation"} onClick={() => setActiveTab("consultation")} expanded={isSidebarOpen} />
            <NavButton icon={<UserPlus />} label="Patient Registry" active={activeTab === "patients"} onClick={() => setActiveTab("patients")} expanded={isSidebarOpen} />
            <NavButton icon={<FileClock />} label="Patient Records" active={activeTab === "records"} onClick={() => setActiveTab("records")} expanded={isSidebarOpen} />
        </nav>

        <div className="p-4 border-t border-slate-800">
            <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-2 text-slate-500 hover:text-white transition-colors w-full flex justify-center">
                <Menu className="w-5 h-5" />
            </button>
        </div>
      </aside>

      {/* 2. MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto bg-slate-950 p-8">
        
        {/* HEADER */}
        <header className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-bold text-white">
                {activeTab === "consultation" && "Live Consultation"}
                {activeTab === "patients" && "Patient Registry"}
                {activeTab === "records" && "Patient Medical Records"}
            </h2>
            <div className="flex items-center gap-2 text-xs bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full text-slate-400">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                System Active (M3 Local)
            </div>
        </header>

        {/* CONTENT SWITCHER */}
        {activeTab === "consultation" && (
            <ConsultationView 
                patients={patients} 
                selectedPatientId={selectedPatientId} 
                setSelectedPatientId={setSelectedPatientId}
            />
        )}
        {activeTab === "patients" && (
            <PatientManagerView refreshPatients={fetchPatients} />
        )}
        {activeTab === "records" && (
            <PatientRecordsView patients={patients} />
        )}

      </main>
    </div>
  );
}

// --- SUB-COMPONENT: SIDEBAR BUTTON ---
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

// --- SUB-COMPONENT: PATIENT MANAGER ---
function PatientManagerView({ refreshPatients }: { refreshPatients: () => void }) {
    const [name, setName] = useState("");
    const [age, setAge] = useState("");
    const [history, setHistory] = useState("");
    const [loading, setLoading] = useState(false);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await fetch("http://127.0.0.1:8000/patients/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, age: parseInt(age), medical_history: history })
            });
            alert("Patient Registered Successfully!");
            setName(""); setAge(""); setHistory("");
            refreshPatients();
        } catch (err) {
            alert("Error creating patient");
        }
        setLoading(false);
    };

    return (
        <div className="max-w-2xl mx-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
                <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-emerald-500" /> Register New Patient
                </h3>
                <form onSubmit={handleCreate} className="space-y-6">
                    <div>
                        <label className="block text-sm text-slate-400 mb-2">Full Name</label>
                        <input required value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="e.g. Sarah Connor" />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-2">Age</label>
                        <input required type="number" value={age} onChange={e => setAge(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="e.g. 35" />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-2">Medical History & Allergies (Critical for AI Safety)</label>
                        <textarea required value={history} onChange={e => setHistory(e.target.value)} rows={4} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="e.g. History of Hypertension. ALLERGIC TO SULFA DRUGS." />
                    </div>
                    <button disabled={loading} type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3 rounded-lg transition-colors">
                        {loading ? "Registering..." : "Add to Registry"}
                    </button>
                </form>
            </div>
        </div>
    )
}

// --- SUB-COMPONENT: PATIENT RECORDS (HISTORY + PDF) ---
function PatientRecordsView({ patients }: { patients: Patient[] }) {
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [history, setHistory] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!selectedId) return;
        setLoading(true);
        fetch(`http://127.0.0.1:8000/patients/${selectedId}/history`)
            .then(res => res.json())
            .then(data => {
                setHistory(data);
                setLoading(false);
            })
            .catch(err => setLoading(false));
    }, [selectedId]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[80vh]">
            {/* LIST OF PATIENTS */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 overflow-y-auto">
                <h3 className="text-sm font-semibold text-slate-400 mb-4 uppercase">Select Patient</h3>
                <div className="space-y-2">
                    {patients.map(p => (
                        <button
                            key={p.id}
                            onClick={() => setSelectedId(p.id)}
                            className={`w-full text-left p-3 rounded-lg transition-all ${
                                selectedId === p.id 
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" 
                                : "hover:bg-slate-800 text-slate-300"
                            }`}
                        >
                            <div className="font-medium">{p.name}</div>
                            <div className="text-xs text-slate-500">ID: #{p.id}</div>
                        </button>
                    ))}
                </div>
            </div>

            {/* HISTORY DETAILS */}
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
                        <div className="border-b border-slate-800 pb-6">
                            <h2 className="text-2xl font-bold text-white">{history.patient.name}</h2>
                            <p className="text-slate-400 mt-1">
                                {history.patient.age} years old • {history.patient.history}
                            </p>
                        </div>

                        <div className="space-y-6">
                            {history.consultations.length === 0 && (
                                <p className="text-slate-500 italic">No past consultations found.</p>
                            )}
                            
                            {history.consultations.map((consult: any) => (
                                <div key={consult.id} className="relative pl-8 border-l-2 border-slate-800">
                                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-slate-800 border-2 border-slate-600"></div>
                                    
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="text-xs text-emerald-500 font-mono">
                                            {new Date(consult.timestamp).toLocaleDateString()} • {new Date(consult.timestamp).toLocaleTimeString()}
                                        </div>
                                        
                                        <button 
                                            onClick={async () => {
                                                const res = await fetch(`http://127.0.0.1:8000/consultations/${consult.id}/download`);
                                                if(res.ok) {
                                                    const blob = await res.blob();
                                                    const url = window.URL.createObjectURL(blob);
                                                    const a = document.createElement("a");
                                                    a.href = url;
                                                    a.download = `Consultation_${consult.id}.pdf`;
                                                    document.body.appendChild(a);
                                                    a.click();
                                                    a.remove();
                                                }
                                            }}
                                            className="text-xs flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
                                        >
                                            <Download className="w-3 h-3" /> PDF
                                        </button>
                                    </div>
                                    
                                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                                        <div className="prose prose-invert prose-sm max-w-none text-slate-300">
                                            <ReactMarkdown>{consult.soap_note}</ReactMarkdown>
                                        </div>
                                        {consult.safety_analysis.includes("WARNING") && (
                                            <div className="mt-4 p-2 bg-red-950/30 border border-red-900/50 rounded text-red-300 text-xs flex gap-2">
                                                <ShieldAlert className="w-4 h-4" />
                                                {consult.safety_analysis}
                                            </div>
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

// --- SUB-COMPONENT: CONSULTATION VIEW (VISION + EDITABLE) ---
function ConsultationView({ patients, selectedPatientId, setSelectedPatientId }: any) {
    const [isRecording, setIsRecording] = useState(false);
    const [status, setStatus] = useState<"idle" | "recording" | "processing" | "completed">("idle");
    const [transcript, setTranscript] = useState("");
    const [soapNote, setSoapNote] = useState("");
    const [safetyAnalysis, setSafetyAnalysis] = useState("");
    const [patientHistory, setPatientHistory] = useState("");
    const [visualAnalysis, setVisualAnalysis] = useState("");
    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);

    // --- PHASE 7: IMAGE HANDLER ---
    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            setSelectedImage(e.target.files[0]);
        }
    };

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
          } catch (error) {
            alert("Microphone access denied.");
          }
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

    // --- UPDATED UPLOAD (Multimodal) ---
    const uploadToBackend = async (file: File) => {
        if (!selectedPatientId) { alert("Select a patient first."); setStatus("idle"); return; }
        const formData = new FormData();
        formData.append("file", file);
        formData.append("patient_id", selectedPatientId.toString());
        
        // Phase 7: Append Image if exists
        if (selectedImage) {
            formData.append("image", selectedImage);
        }

        try {
            const res = await fetch("http://127.0.0.1:8000/consultation/", { method: "POST", body: formData });
            if (!res.ok) throw new Error("Failed");
            const data = await res.json();
            
            setTranscript(data.transcript);
            setVisualAnalysis(data.visual_analysis); // Store vision result
            setSoapNote(data.soap_note);
            setSafetyAnalysis(data.safety_analysis);
            setPatientHistory(data.patient_context);
            setStatus("completed");
            setSelectedImage(null); // Clear image after upload
        } catch (e) { console.error(e); setStatus("idle"); alert("Error connecting."); }
    };

    const handleRegenerate = async () => {
        if (!transcript) return;
        setStatus("processing");
        try {
            const formData = new FormData();
            formData.append("text", transcript);
            formData.append("patient_id", selectedPatientId?.toString() || "");

            const res = await fetch("http://127.0.0.1:8000/analyze-text/", { 
                method: "POST",
                body: formData
            });
            const data = await res.json();
            setSoapNote(data.soap_note);
            setSafetyAnalysis(data.safety_analysis);
            setStatus("completed");
        } catch (e) { console.error(e); alert("Failed to regenerate"); setStatus("idle"); }
    };

    const handleDownloadPDF = async () => {
        if (!selectedPatientId || !soapNote) return;
        const formData = new FormData();
        formData.append("patient_id", selectedPatientId.toString());
        formData.append("soap_note", soapNote);
        formData.append("safety_analysis", safetyAnalysis);
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

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
             {/* LEFT COLUMN */}
            <div className="lg:col-span-4 space-y-6">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-slate-300">
                        <Users className="w-5 h-5 text-emerald-500" />
                        <span className="text-sm font-medium">Select Patient</span>
                    </div>
                    <div className="relative">
                        <select 
                            value={selectedPatientId || ""}
                            onChange={(e) => setSelectedPatientId(Number(e.target.value))}
                            className="appearance-none bg-slate-950 border border-slate-700 text-white text-sm rounded-lg px-4 py-2 pr-8 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        >
                            {patients.map((p:any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-3 pointer-events-none" />
                    </div>
                </div>

                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
                    <h2 className="text-sm font-semibold text-slate-400 mb-4 uppercase tracking-wide">Live Consultation</h2>
                    
                    <div className="flex flex-col items-center justify-center py-8 space-y-6">
                        {/* PHASE 7: IMAGE UPLOAD BUTTON */}
                        <div className="flex gap-2 mb-2 w-full justify-center">
                            <input 
                                type="file" 
                                ref={imageInputRef} 
                                onChange={handleImageSelect} 
                                className="hidden" 
                                accept="image/*" 
                            />
                            <button 
                                onClick={() => imageInputRef.current?.click()}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium border transition-all ${
                                    selectedImage 
                                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50" 
                                    : "bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500"
                                }`}
                            >
                                <ImageIcon className="w-4 h-4" />
                                {selectedImage ? "Image Attached" : "Attach X-Ray / Photo"}
                            </button>
                            {selectedImage && (
                                <button onClick={() => setSelectedImage(null)} className="text-slate-500 hover:text-red-400">✕</button>
                            )}
                        </div>

                        {/* RECORD BUTTON */}
                        <button
                            onClick={isRecording ? stopRecording : startRecording}
                            disabled={status === "processing"}
                            className={`relative group w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ${
                            isRecording 
                                ? "bg-red-500/20 text-red-500 ring-2 ring-red-500 ring-offset-4 ring-offset-slate-900" 
                                : "bg-emerald-500 text-white hover:bg-emerald-400 shadow-lg shadow-emerald-500/30"
                            } ${status === "processing" ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                            {status === "processing" ? <Loader2 className="w-8 h-8 animate-spin" /> : isRecording ? <Square className="w-8 h-8 fill-current" /> : <Mic className="w-8 h-8" />}
                            {isRecording && <span className="absolute w-full h-full rounded-full bg-red-500/30 animate-ping"></span>}
                        </button>
                        
                        <div className="text-center space-y-4">
                            <p className="text-lg font-medium text-white">
                                {status === "idle" && "Ready to Listen"}
                                {status === "recording" && "Recording..."}
                                {status === "processing" && "Analyzing Audio..."}
                                {status === "completed" && "Processing Complete"}
                            </p>
                            <div className="flex items-center justify-center gap-2 pt-4 border-t border-slate-800 w-full">
                                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="audio/*" />
                                <button onClick={triggerFileInput} className="text-xs flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
                                    <Upload className="w-4 h-4" /> Upload Audio File
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* EDITABLE TRANSCRIPT */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 h-[400px] flex flex-col">
                    <div className="flex justify-between items-center mb-4 sticky top-0 bg-slate-900 py-2">
                        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-400">
                            <FileText className="w-4 h-4" /> Live Transcript
                        </h2>
                        {transcript && (
                            <button 
                                onClick={handleRegenerate}
                                className="text-xs bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full hover:bg-emerald-500/20 transition-colors"
                            >
                                Regenerate Note ⚡
                            </button>
                        )}
                    </div>
                    <textarea 
                        value={transcript}
                        onChange={(e) => setTranscript(e.target.value)}
                        placeholder="Audio transcription will appear here. You can also type manually..."
                        className="flex-1 bg-transparent border-none outline-none resize-none text-slate-300 leading-relaxed text-sm placeholder:text-slate-700"
                    />
                    {/* VISUAL ANALYSIS DEBUG (Optional display) */}
                    {visualAnalysis && (
                        <div className="mt-2 pt-2 border-t border-slate-800 text-xs text-slate-500">
                            <span className="font-semibold text-emerald-500">Visual Findings:</span> {visualAnalysis}
                        </div>
                    )}
                </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="lg:col-span-8 space-y-6">
                {safetyAnalysis && (
                    <div className={`border rounded-xl p-4 flex items-start gap-4 transition-all duration-500 ${
                    safetyAnalysis.includes("WARNING") 
                        ? "bg-red-950/30 border-red-900/50 text-red-200" 
                        : "bg-emerald-950/30 border-emerald-900/50 text-emerald-200"
                    }`}>
                    <div className={`p-2 rounded-full ${
                        safetyAnalysis.includes("WARNING") ? "bg-red-900/50 text-red-500" : "bg-emerald-900/50 text-emerald-500"
                    }`}>
                        {safetyAnalysis.includes("WARNING") ? <ShieldAlert className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
                    </div>
                    <div>
                        <h3 className="font-bold text-lg mb-1">
                        {safetyAnalysis.includes("WARNING") ? "Safety Alert Triggered" : "Safety Check Passed"}
                        </h3>
                        <p className="text-sm opacity-90">{safetyAnalysis}</p>
                        {patientHistory && (
                        <p className="text-xs mt-2 opacity-60 border-t border-white/10 pt-2">
                            Active Context: {patientHistory}
                        </p>
                        )}
                    </div>
                    </div>
                )}

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 min-h-[600px] relative">
                    <div className="flex justify-between items-start mb-6">
                        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Activity className="w-5 h-5 text-emerald-500" />
                        Generated SOAP Note
                        </h2>
                        {soapNote && (
                        <button 
                            onClick={handleDownloadPDF}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            <Download className="w-4 h-4" /> Download PDF
                        </button>
                        )}
                    </div>
                    {soapNote ? (
                        <div className="prose prose-invert prose-emerald max-w-none text-slate-300">
                            <ReactMarkdown>{soapNote}</ReactMarkdown>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-4">
                            <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center">
                            <Activity className="w-8 h-8 opacity-20" />
                            </div>
                            <p>Waiting for consultation data...</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}