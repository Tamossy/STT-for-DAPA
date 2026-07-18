// src/components/Workspace/Streaming.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { io } from 'socket.io-client';

export default function Streaming({ currentTab, setMeetings, setCurrentTab, setSelectedMeeting, setIsParentRecording }) {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [realtimeTranscripts, setRealtimeTranscripts] = useState([]);
  const [isSummarizing, setIsSummarizing] = useState(false);

  const socketRef = useRef(null);
  const audioContextRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const processorRef = useRef(null);
  const chatEndRef = useRef(null); 
  const canStreamRef = useRef(false);

  useEffect(() => {
    let interval = null;
    if (isRecording) {
      interval = setInterval(() => setSeconds((prev) => prev + 1), 1000);
    } else {
      clearInterval(interval);
      setSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [realtimeTranscripts]);

  const startStreaming = async () => {
    try {
      setRealtimeTranscripts([]); 
      
      // 🔥 [해결 1] 무거운 브라우저 마이크 하드웨어 제어권 및 유저 권한 획득을 최상단에서 완벽히 마칩니다.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // 마이크 획득 성공 직후 스트리밍 전송 신호 조기 개방
      canStreamRef.current = true;

      // 🔥 [해결 1 연속] 하드웨어가 잡힌 싱크 위에서 비로소 깨끗하고 안전하게 소켓망 수립!
      const socket = io('https://stt-for-dapa.onrender.com', {
        transports: ['websocket'],
        forceNew: true
      });
      socketRef.current = socket;

      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContext({ sampleRate: 16000 }); 
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(8192, 1, 1);
      processorRef.current = processor;

      source.connect(processor);
      processor.connect(audioContext.destination);

      processor.onaudioprocess = (e) => {
        if (!canStreamRef.current) return;
        const inputData = e.inputBuffer.getChannelData(0); 
        const buffer = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          buffer[i] = Math.min(1, Math.max(-1, inputData[i])) * 0x7FFF;
        }
        
        // 소켓이 확실하게 열려 있는 상태에서만 바이너리 전송 연산 처리
        if (socket && socket.connected) {
          socket.emit('audio-stream', buffer.buffer);
        }
      };

      // 마이크 세팅이 끝난 완벽한 타이밍에 소켓을 타고 전화를 겁니다. (유실 완전 제로)
      socket.on('connect', () => {
        console.log("🟢 [웹소켓] 백엔드 중계기 결합 완료. 관제 스트리밍 프로토콜 발사.");
        socket.emit('start-streaming');
      });

      socket.on('speech-text', (data) => {
        if (data && data.text) {
          setRealtimeTranscripts((prev) => [
            ...prev,
            { speaker: data.speaker || "참석자", time: formatTime(seconds), text: data.text }
          ]);
        }
      });

      setIsRecording(true);
      if (setIsParentRecording) setIsParentRecording(true); 
    } catch (err) {
      console.error('마이크 연결 실패:', err);
      alert('마이크 접근 권한을 확인해 주세요.');
    }
  };

  const stopStreaming = async () => {
    setIsRecording(false);
    if (setIsParentRecording) setIsParentRecording(false); 
    canStreamRef.current = false;

    if (processorRef.current) { processorRef.current.disconnect(); processorRef.current = null; }
    if (audioContextRef.current) { audioContextRef.current.close(); audioContextRef.current = null; }
    if (mediaStreamRef.current) { mediaStreamRef.current.getTracks().forEach(t => t.stop()); mediaStreamRef.current = null; }
    if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; }

    if (realtimeTranscripts.length === 0) {
      alert("자막 내용이 없어 홈으로 이동합니다.");
      setCurrentTab('archive');
      return;
    }

    setIsSummarizing(true);
    const fullTextDocument = realtimeTranscripts.map(item => `${item.speaker}: ${item.text}`).join('\n');

    try {
      const response = await fetch('https://stt-for-dapa.onrender.com/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: fullTextDocument })
      });
      const result = await response.json();
      
      const newMeeting = {
        id: Date.now(),
        title: `AI 요약 회의록 (${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})`,
        date: new Date().toLocaleDateString(),
        duration: formatTime(seconds),
        summary: result.summary || "요약본 생성 실패",
        keywords: result.keywords || ["AI요약"],
        transcripts: realtimeTranscripts 
      };

      setMeetings(prev => [newMeeting, ...prev]);
      setSelectedMeeting(newMeeting);
      setCurrentTab('detail'); 
    } catch (err) {
      alert("요약 중 에러가 발생하여 일반 저장합니다.");
      setCurrentTab('archive');
    } finally {
      setIsSummarizing(false);
    }
  };

  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex-1 flex flex-col justify-between pt-12 select-none font-sans pb-8 h-full">
      <div className="space-y-1.5 text-center">
        <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${isRecording ? 'bg-[#3182f6]/10 text-[#3182f6]' : 'bg-gray-100 text-gray-400'}`}>
          {isRecording ? 'Whisper STT Online' : 'Ready to Stream'}
        </span>
        <h1 className="text-[26px] font-bold text-[#191f28] tracking-tighter mt-3">실시간 STT 회의 제어</h1>
      </div>

      <div className="flex-1 my-4 bg-white rounded-[24px] border border-gray-100 p-4 overflow-y-auto min-h-[180px] max-h-[260px] flex flex-col">
        {isSummarizing ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3">
            <Loader2 className="w-8 h-8 text-[#3182f6] animate-spin" />
            <p className="text-sm font-bold text-[#191f28]">Gemini AI 분석 중...</p>
          </div>
        ) : realtimeTranscripts.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-300">
            <p className="text-xs font-medium">버튼을 누르면 실시간 자막이 표시됩니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {realtimeTranscripts.map((item, idx) => (
              <div key={idx} className="flex flex-col space-y-0.5">
                <span className="text-[11px] font-bold text-[#4e5968]">{item.speaker} ({item.time})</span>
                <div className="bg-[#f2f4f6] text-[#333d4b] text-xs px-3 py-2 rounded-2xl rounded-tl-none max-w-[85%] self-start font-medium">
                  {item.text}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      <div className="flex flex-col items-center justify-center mb-6">
        <span className="text-3xl font-mono font-bold text-[#191f28]">{formatTime(seconds)}</span>
      </div>

      <div className="px-1">
        {isRecording ? (
          <button onClick={stopStreaming} disabled={isSummarizing} className="w-full h-14 bg-[#f04452] text-white font-bold rounded-2xl flex items-center justify-center space-x-2">
            <Square className="w-4 h-4 fill-white" /> <span>회의 종료 및 AI 요약하기</span>
          </button>
        ) : (
          <button onClick={startStreaming} disabled={isSummarizing} className="w-full h-14 bg-[#3182f6] text-white font-bold rounded-2xl flex items-center justify-center space-x-2">
            <Mic className="w-4 h-4" /> <span>회의 실시간 스트리밍 시작</span>
          </button>
        )}
      </div>
    </div>
  );
}