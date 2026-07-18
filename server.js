// server.js (실시간 STT 보존 + FFmpeg 무적 전처리 및 타임스탬프 오디오 업로드 분석 통합판)
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url'; 
import http from 'http';               
import { Server } from 'socket.io';    
import { OpenAI } from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

// 💡 [수술 완료] 클라우드(Render) 환경에서도 FFmpeg가 무조건 작동하도록 내장 엔진 탑재
import ffmpeg from 'fluent-ffmpeg'; 
import ffmpegInstaller from 'ffmpeg-static'; 
ffmpeg.setFfmpegPath(ffmpegInstaller);

const app = express();
const PORT = process.env.PORT || 5001; 

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  credentials: true
}));

app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}${ext}`); 
  }
});

const upload = multer({ storage: storage });

const webSocketServer = http.createServer(app);
const io = new Server(webSocketServer, { 
  cors: { origin: "*", methods: ["GET", "POST"] },
  maxHttpBufferSize: 1e7 
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

let clientAudioBuffers = {};
let clientIntervals = {};

io.on('connection', (socket) => {
  console.log(`🔌 [웹소켓] 새로운 클라이언트 연결 성공! (ID: ${socket.id})`);
  
  clientAudioBuffers[socket.id] = [];

  socket.on('start-streaming', () => {
    console.log(`📡 [AI 릴레이] 실시간 5초 파이프라인 가동 신호 수신. (ID: ${socket.id})`);
    clientAudioBuffers[socket.id] = []; 
    
    if (clientIntervals[socket.id]) clearInterval(clientIntervals[socket.id]);
    
    clientIntervals[socket.id] = setInterval(async () => {
      const chunks = clientAudioBuffers[socket.id];
      if (!chunks || chunks.length === 0) return;

      clientAudioBuffers[socket.id] = [];
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      if (totalLength === 0) return;

      const mergedPcm = Buffer.concat(chunks);
      const tempWavPath = `uploads/stream_${socket.id}_${Date.now()}.wav`;

      try {
        const wavBuffer = encodeWAV(mergedPcm, 16000);
        fs.writeFileSync(tempWavPath, wavBuffer);

        const response = await openai.audio.transcriptions.create({
          file: fs.createReadStream(tempWavPath),
          model: "whisper-1",
          language: "ko"
        });

        const recognizedText = response.text || '';
        if (recognizedText.trim().length > 1) {
          console.log(`🟢 [OpenAI Whisper 감지 성공]: ${recognizedText.trim()}`);
          io.to(socket.id).emit('speech-text', { speaker: "참석자", text: recognizedText.trim() });
        }
      } catch (err) {
        console.error("❌ OpenAI Whisper API 통신 에러:", err.message);
      } finally {
        if (fs.existsSync(tempWavPath)) fs.unlinkSync(tempWavPath);
      }
    }, 5000);
  });

  socket.on('audio-stream', (audioData) => {
    if (clientAudioBuffers[socket.id]) {
      const safeBuffer = Buffer.isBuffer(audioData) ? audioData : Buffer.from(audioData);
      clientAudioBuffers[socket.id].push(safeBuffer);
    }
  });

  socket.on('disconnect', () => {
    console.log(`❌ [웹소켓] 클라이언트 연결 종료 (ID: ${socket.id})`);
    if (clientIntervals[socket.id]) clearInterval(clientIntervals[socket.id]);
    delete clientAudioBuffers[socket.id];
    delete clientIntervals[socket.id];
  });
});

function encodeWAV(pcmBuffer, sampleRate) {
  const buffer = Buffer.alloc(44 + pcmBuffer.length);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + pcmBuffer.length, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(pcmBuffer.length, 40);
  pcmBuffer.copy(buffer, 44);
  return buffer;
}

const preprocessToStandardMp3 = (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .toFormat('mp3')
      .audioChannels(1)      
      .audioFrequency(16000) 
      .on('end', () => {
        console.log('✨ [오디오 전처리 완료] Whisper 표준 규격 MP3 인코딩 성공.');
        resolve();
      })
      .on('error', (err) => {
        console.error('❌ 전처리 과정 중 ffmpeg 트랜스코딩 실패:', err);
        reject(err);
      })
      .save(outputPath);
  });
};

app.post('/api/summarize', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ summary: "내용 없음", keywords: [] });
  try {
    const model = ai.getGenerativeModel({ model: "gemini-3.5-flash" });
    const prompt = `회의록 요약 양식에 맞춰 아래 대화를 요약해줘:\n${text}\n\n마지막 줄에 반드시 "키워드: 단어1, 단어2, 단어3"을 적어줘.`;
    const response = await model.generateContent(prompt);
    
    let summary = response.response.text() || "";
    let keywords = ["AI요약"];
    
    try {
      const match = summary.match(/(?:핵심\s*)?키워드\s*:\s*(.+)$/m);
      if (match && match[1]) {
        summary = summary.replace(match[0], "").trim();
        keywords = match[1].replace(/[*#]/g, "").split(',').map(k => k.trim());
      }
    } catch (parseErr) {
      console.warn("⚠️ 요약 키워드 분리 중 예외 발생:", parseErr.message);
    }
    
    res.json({ summary, keywords });
  } catch (error) {
    res.status(500).json({ summary: "요약 실패", keywords: [] });
  }
});

app.post('/api/upload-transcribe', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "업로드된 오디오 파일이 존재하지 않습니다." });
  }

  const originalFilePath = req.file.path;
  const standardMp3Path = path.join(path.dirname(originalFilePath), `standard_${req.file.filename}.mp3`);

  console.log(`📥 [파일 분석 시작] 신규 오디오 파일 탐지 완료. (이름: ${req.file.originalname})`);

  try {
    await preprocessToStandardMp3(originalFilePath, standardMp3Path);

    const whisperResponse = await openai.audio.transcriptions.create({
      file: fs.createReadStream(standardMp3Path), 
      model: "whisper-1",
      response_format: "verbose_json", 
      timestamp_granularities: ["segment"] 
    });

    const segments = whisperResponse.segments || [];
    
    const transcripts = segments.map((seg) => {
      const startSeconds = seg.start; 
      
      const mins = Math.floor(startSeconds / 60);
      const secs = Math.floor(startSeconds % 60);
      const formattedTime = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

      return {
        speaker: "참석자",
        time: formattedTime,
        seconds: startSeconds, 
        text: seg.text.trim()
      };
    });

    console.log(`🟢 [Whisper 번역 완료] 총 ${transcripts.length}개의 정밀 시간 세그먼트 가공 완료.`);

    const fullTextDocument = transcripts.map(t => `${t.speaker}: ${t.text}`).join('\n');
    
    const geminiModel = ai.getGenerativeModel({ model: "gemini-3.5-flash" });
    const geminiPrompt = `
너는 유능한 수석 비서이자 전문 속기사야.
아래 제공되는 [회의 대화록 리스트]를 철저하게 분석해서 가독성 높은 비즈니스 회의록 요약본을 만들어줘.

[회의 대화록 리스트]:
${fullTextDocument}

반드시 아래 요구 조건에 맞춰서 답변해줘:
1. 답변은 한국어로 작성할 것.
2. '핵심 요약', '주요 결정 사항 및 아젠다', '참석자별 Action Item(To-do 리스트)'이 직관적으로 눈에 띄게 항목별 단락을 나누어 정리해줘.
3. 대화록 전체를 대변하는 핵심 키워드 단어 3개를 뽑아내어, 답변 맨 마지막 줄에 반드시 "키워드: 단어1, 단어2, 단어3" 형태로 명시해줘.
`;

    const geminiResponse = await geminiModel.generateContent(geminiPrompt);
    
    let summary = "";
    if (geminiResponse.response && typeof geminiResponse.response.text === 'function') {
      summary = geminiResponse.response.text();
    } else {
      summary = geminiResponse.text || "";
    }
    
    let keywords = ["AI분석", "BBC오디오", "업로드파일"];

    try {
      const keywordMatch = summary.match(/(?:핵심\s*)?키워드\s*:\s*(.+)$/m);
      if (keywordMatch && keywordMatch[1]) {
        summary = summary.replace(keywordMatch[0], "").trim();
        keywords = keywordMatch[1].replace(/[*#]/g, "").split(',').map(k => k.trim());
      }
    } catch (parseErr) {
      console.warn("⚠️ 업로드 요약본 키워드 파싱 실패 가드 작동 (요약 리포트는 그대로 출력):", parseErr.message);
    }

    console.log("🟢 [제미나이 요약 완료] 분석 보고서 가공 성공.");
    
    res.json({ transcripts, summary, keywords });

  } catch (error) {
    console.error("❌ 파일 업로드 STT/요약 파이프라인 장애 터짐:", error.message);
    res.status(500).json({ error: "음성 파일 분석 중 심각한 오류가 발생했습니다." });
  } finally {
    if (fs.existsSync(originalFilePath)) fs.unlinkSync(originalFilePath);
    if (fs.existsSync(standardMp3Path)) fs.unlinkSync(standardMp3Path);
    console.log("🧹 [보안 청소] 분석에 활용한 백엔드 임시 파일 완전 영구 삭제 완료.");
  }
});

// 💡 [수술 핵심] 분리되어 있던 서버를 하나로 강제 통합하여 렌더의 PORT 입구컷을 무사 통과시킵니다.
webSocketServer.listen(PORT, () => {
  console.log(`🚀 [클라우드 통합 관제] Express 및 웹소켓 엔진이 통합되어 포트 ${PORT} 에서 활성화되었습니다.`);
});