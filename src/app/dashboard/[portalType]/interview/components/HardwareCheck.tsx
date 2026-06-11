'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, Mic, CheckCircle2, AlertCircle, LoaderCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';

interface HardwareCheckProps {
  onPass: () => void;
  onCancel: () => void;
}

const TEST_PHRASE = "I am ready for my AI Interview";
const MIN_LOUDNESS = 12; // Increased threshold to filter out ambient background noise

export function HardwareCheck({ onPass, onCancel }: HardwareCheckProps) {
  const [camStatus, setCamStatus] = useState<'testing' | 'pass' | 'fail'>('testing');
  const [micStatus, setMicStatus] = useState<'testing' | 'pass' | 'fail'>('testing');
  const [resLabel, setResLabel] = useState<string>('');
  const [loudness, setLoudness] = useState(0);
  const [micProgress, setMicProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Device selectors
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamId, setSelectedCamId] = useState<string>('');
  const [selectedMicId, setSelectedMicId] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const rafVideoRef = useRef<number | null>(null);

  const stopHardware = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (rafVideoRef.current) cancelAnimationFrame(rafVideoRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  }, []);

  // 1. Enumerate available media devices on mount
  useEffect(() => {
    async function getDevices() {
      try {
        // Request initial permissions to get device labels
        await navigator.mediaDevices.getUserMedia({ audio: true, video: true }).catch(() => {});
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cams = devices.filter(d => d.kind === 'videoinput');
        const mics = devices.filter(d => d.kind === 'audioinput');
        setVideoDevices(cams);
        setAudioDevices(mics);

        const cachedCam = localStorage.getItem('preferred_webcam_id') || cams[0]?.deviceId || '';
        const cachedMic = localStorage.getItem('preferred_mic_id') || mics[0]?.deviceId || '';
        setSelectedCamId(cachedCam);
        setSelectedMicId(cachedMic);
      } catch (err) {
        console.error('Error enumerating devices:', err);
      }
    }
    getDevices();
  }, []);

  // 2. Persist device selections to local storage
  useEffect(() => {
    if (selectedCamId) localStorage.setItem('preferred_webcam_id', selectedCamId);
  }, [selectedCamId]);

  useEffect(() => {
    if (selectedMicId) localStorage.setItem('preferred_mic_id', selectedMicId);
  }, [selectedMicId]);

  // 3. Start pre-flight test streams and analyzers
  const startCheck = useCallback(async () => {
    if (!selectedCamId && !selectedMicId) return;
    setError(null);
    setCamStatus('testing');
    setMicStatus('testing');
    setMicProgress(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { deviceId: selectedCamId ? { ideal: selectedCamId } : undefined }, 
        audio: selectedMicId ? { deviceId: { ideal: selectedMicId } } : true
      });
      streamRef.current = stream;

      // Camera check with face detection overlay
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          const w = videoRef.current?.videoWidth || 0;
          const h = videoRef.current?.videoHeight || 0;
          setResLabel(`${w}x${h}`);
        };
      }

      // Initialize FaceLandmarker for camera shutter/face check
      let faceLandmarker: any = null;
      let isLandmarkerLoading = true;
      let isLandmarkerFailed = false;

      try {
        const vision = await import('@mediapipe/tasks-vision');
        const fileset = await vision.FilesetResolver.forVisionTasks('/mediapipe');
        faceLandmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: '/mediapipe/face_landmarker.task' },
          runningMode: 'VIDEO',
          numFaces: 1,
        });
        isLandmarkerLoading = false;
      } catch (e) {
        console.error('Failed to load FaceLandmarker in HardwareCheck:', e);
        isLandmarkerLoading = false;
        isLandmarkerFailed = true;
      }

      let facePassedCount = 0;

      const checkFaceTick = () => {
        const video = videoRef.current;
        if (!video || video.readyState < 2) {
          rafVideoRef.current = requestAnimationFrame(checkFaceTick);
          return;
        }

        if (isLandmarkerLoading) {
          rafVideoRef.current = requestAnimationFrame(checkFaceTick);
          return;
        }

        if (faceLandmarker) {
          try {
            const faceRes = faceLandmarker.detectForVideo(video, performance.now());
            const lm = faceRes.faceLandmarks?.[0];
            if (lm && lm.length > 0) {
              facePassedCount++;
              if (facePassedCount >= 60) { // ~1 second of consecutive stable face detection
                setCamStatus('pass');
                setError(null);
              }
            } else {
              facePassedCount = 0;
              setCamStatus('fail');
              setError('No face detected. Please ensure your camera shutter is open and your face is fully visible.');
            }
          } catch (err) {
            /* ignore transient errors */
          }
        } else {
          if (isLandmarkerFailed) {
            setCamStatus('pass'); // Fallback if MediaPipe explicitly failed to load
          } else {
            setCamStatus('fail');
            setError('Webcam analyzer is initializing...');
          }
        }
        rafVideoRef.current = requestAnimationFrame(checkFaceTick);
      };
      rafVideoRef.current = requestAnimationFrame(checkFaceTick);

      // Mic check (closure-safe)
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const buffer = new Uint8Array(analyser.frequencyBinCount);
      let maxSeen = 0;

      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(buffer);
        let sum = 0;
        for(let i=0; i<buffer.length; i++) sum += buffer[i];
        const avg = sum / buffer.length;
        setLoudness(avg);
        
        if (avg > MIN_LOUDNESS) {
          maxSeen = Math.max(maxSeen, avg);
          setMicProgress((prev) => {
            const next = Math.min(100, prev + 3); // Slightly faster increment
            if (next >= 100 && maxSeen > MIN_LOUDNESS) {
              setMicStatus('pass');
            }
            return next;
          });
        } else {
          // Speak levels progress bar decreases when silent!
          setMicProgress((prev) => Math.max(0, prev - 1.5));
        }

        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);

    } catch (err: any) {
      console.error('Hardware check failed:', err);
      setCamStatus('fail');
      setMicStatus('fail');
      
      const errMsg = err.name === 'NotReadableError' || err.message?.includes('Could not start video source')
        ? 'Your camera or microphone is already in use by another application (e.g., Zoom, Teams, or another browser tab). Please close other apps and try again.'
        : err.name === 'OverconstrainedError'
        ? 'The selected camera or microphone does not support the requested configuration. Please choose a different device.'
        : err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
        ? 'Access denied. Please check your browser permissions and allow access to your camera and microphone.'
        : 'Could not access your camera or microphone. Please check connections and permissions.';
        
      setError(errMsg);
    }
  }, [selectedCamId, selectedMicId]);

  useEffect(() => {
    if (selectedCamId || selectedMicId) {
      startCheck();
    }
    return () => stopHardware();
  }, [selectedCamId, selectedMicId, startCheck, stopHardware]);

  const allPassed = camStatus === 'pass' && micStatus === 'pass';

  return (
    <div className="fixed inset-0 z-[110] bg-[#0a0a0b] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl animate-in zoom-in-95 duration-300">
        <div className="glass-card border-teal-500/30 overflow-hidden relative p-8">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-500 via-cyan-500 to-teal-500" />

          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/10 flex items-center justify-center text-teal-500">
              <ShieldCheck size={28} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white leading-tight">Hardware Pre-flight</h2>
              <p className="text-teal-500/80 text-sm font-semibold uppercase tracking-wider">Verification Step</p>
            </div>
          </div>

          {/* Device Selection Dropdowns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 block">Select Camera</label>
              <select
                value={selectedCamId}
                onChange={(e) => {
                  stopHardware();
                  setSelectedCamId(e.target.value);
                }}
                className="w-full bg-[#161618] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
              >
                {videoDevices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Camera ${d.deviceId.slice(0, 5)}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 block">Select Microphone</label>
              <select
                value={selectedMicId}
                onChange={(e) => {
                  stopHardware();
                  setSelectedMicId(e.target.value);
                }}
                className="w-full bg-[#161618] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
              >
                {audioDevices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Microphone ${d.deviceId.slice(0, 5)}`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            {/* Camera Preview */}
            <div className="space-y-3">
              <div className="relative rounded-xl overflow-hidden bg-black/40 aspect-video border border-white/5">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/50 text-[10px] text-zinc-400 font-mono">
                  {resLabel || 'Detecting...'}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-zinc-300">
                  <Camera size={16} className={camStatus === 'pass' ? 'text-teal-400' : 'text-zinc-500'} />
                  <span>Face & Camera Verification</span>
                </div>
                {camStatus === 'testing' ? <LoaderCircle className="w-4 h-4 animate-spin text-zinc-500" /> :
                 camStatus === 'pass' ? <CheckCircle2 className="w-4 h-4 text-teal-400" /> :
                 <AlertCircle className="w-4 h-4 text-red-400" />}
              </div>
            </div>

            {/* Mic Test */}
            <div className="flex flex-col justify-between py-1">
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-xs uppercase font-bold text-zinc-500 tracking-wider">Voice Test</p>
                  <p className="text-sm text-white font-medium italic">"{TEST_PHRASE}"</p>
                  <p className="text-xs text-zinc-400">Please speak the phrase above clearly to test your levels.</p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] uppercase font-bold tracking-tight">
                    <span className="text-zinc-500">Level</span>
                    <span className={loudness > MIN_LOUDNESS ? 'text-teal-400' : 'text-zinc-600'}>
                      {loudness > MIN_LOUDNESS ? 'Detected' : 'Silent'}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                    <div 
                      className="h-full bg-teal-500 transition-all duration-150" 
                      style={{ width: `${Math.min(100, (loudness / 50) * 100)}%` }} 
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] uppercase font-bold tracking-tight">
                    <span className="text-zinc-500">Test Progress</span>
                    <span className="text-teal-400">{micProgress}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                    <div 
                      className="h-full bg-teal-500 transition-all duration-300" 
                      style={{ width: `${micProgress}%` }} 
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-2 text-sm text-zinc-300">
                  <Mic size={16} className={micStatus === 'pass' ? 'text-teal-400' : 'text-zinc-500'} />
                  <span>Microphone Levels</span>
                </div>
                {micStatus === 'testing' ? <LoaderCircle className="w-4 h-4 animate-spin text-zinc-500" /> :
                 micStatus === 'pass' ? <CheckCircle2 className="w-4 h-4 text-teal-400" /> :
                 <AlertCircle className="w-4 h-4 text-red-400" />}
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-8 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="ghost" fullWidth onClick={onCancel}>Cancel</Button>
            <Button 
              variant="primary" 
              fullWidth 
              disabled={!allPassed}
              className="bg-teal-500 hover:bg-teal-600 text-black border-none font-bold disabled:opacity-40"
              onClick={onPass}
              icon={<ArrowRight size={18} />}
            >
              Hardware Verified
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
