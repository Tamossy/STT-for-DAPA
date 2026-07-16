// server.js (실시간 STT 보존 + FFmpeg 무적 전처리 및 타임스탬프 오디오 업로드 분석 통합판)
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url'; // ESM 환경을 위한 path 해석 지원
import http from 'http';               
import { Server } from 'socket.io';    
import { OpenAI } from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import ffmpeg from 'fluent-ffmpeg'; // 💡 [추가] 오디오 강제 변환을 위한 전처리 엔진 로드

const app = express();
const port = process.env.PORT || 5001; 

// ES 모듈 환경에서 __dirname 구현하기
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 💡 [대체 완료] 파일 업로드(multipart/form-data) 규격 및 헤더 제한을 전면 해제하여 브라우저의 입구컷을 완벽 차단합니다.
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  credentials: true
}));

// 💡 Express 자체 용량 버퍼 상한선도 안전하게 50MB로 확장합니다.
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 💡 [수술 완료] 멀터 저장소 설정 고도화: 수신된 파일의 진짜 확장자를 강제 보존하여 저장하도록 변경
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
    cb(null, `${Date.now()}${ext}`); // 파일명 유실 및 확장자 탈락으로 인한 Whisper 400 에러를 원천 차단
  }
});

const upload = multer({ storage: storage });

const webSocketServer = http.createServer(app);
const io = new Server(webSocketServer, { 
  cors: { origin: "*", methods: ["GET", "POST"] },
  maxHttpBufferSize: 1e7 // 오디오 대용량 바이너리 수신을 위한 버퍼 상한 확장
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

let clientAudioBuffers = {};
let clientIntervals = {};

// 🎙️ [1번 기능 유지] 실시간 스트리밍 소켓 서버 라인 (완전 보존)
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

// 💡 [킬러 기믹] 업로드된 임의의 파일을 Whisper 전용 표준 16kHz 단일모노 MP3 규격으로 강제 인코딩(전처리)하는 보조 함수
const preprocessToStandardMp3 = (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .toFormat('mp3')
      .audioChannels(1)      // 채널 강제 단일 모노화
      .audioFrequency(16000) // 주파수 강제 16kHz 변환
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

webSocketServer.listen(5002, () => {
  console.log(`📡 [실시간 스트리밍] 중계 웹소켓 엔진이 포트 5002 에서 관제 중입니다.`);
});

app.post('/api/summarize', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ summary: "내용 없음", keywords: [] });
  try {
    const model = ai.getGenerativeModel({ model: "gemini-3.5-flash" });
    const prompt = `회의록 요약 양식에 맞춰 아래 대화를 요약해줘:\n${text}\n\n마지막 줄에 반드시 "키워드: 단어1, 단어2, 단어3"을 적어줘.`;
    const response = await model.generateContent(prompt);
    
    // 💡 [수술 완료] 최신 규격인 response.text() 메서드를 사용하여 확실하게 글자 추출!
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


// 🔥 [2번 기능 수립] 오디오 파일 업로드 및 정밀 타임스탬프 기반 요약 분석 엔드포인트
app.post('/api/upload-transcribe', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "업로드된 오디오 파일이 존재하지 않습니다." });
  }

  const originalFilePath = req.file.path;
  const standardMp3Path = path.join(path.dirname(originalFilePath), `standard_${req.file.filename}.mp3`);

  console.log(`📥 [파일 분석 시작] 신규 오디오 파일 탐지 완료. (이름: ${req.file.originalname})`);

  try {
    // 💡 [수술 핵심] 어떤 규격이 오든 16kHz 모노 규격 MP3로 즉석 트랜스코딩 전처리 단행!
    await preprocessToStandardMp3(originalFilePath, standardMp3Path);

    // 1. OpenAI Whisper를 이용한 단어/문장 단위 조밀 타임스탬프 추출
    const whisperResponse = await openai.audio.transcriptions.create({
      file: fs.createReadStream(standardMp3Path), 
      model: "whisper-1",
      response_format: "verbose_json", 
      timestamp_granularities: ["segment"] 
    });

    const segments = whisperResponse.segments || [];
    
    // 2. 오디오 플레이어 싱크용 자막 객체로 변환 가공
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

    // 3. 자막 텍스트 결합하여 구글 제미나이 요약 가동
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
    
    // 💡 [치명적 버그 해결] response.text 대신 response.text() 또는 response.response.text() 최신 규격으로 안전 텍스트 추출!
    let summary = "";
    if (geminiResponse.response && typeof geminiResponse.response.text === 'function') {
      summary = geminiResponse.response.text();
    } else {
      summary = geminiResponse.text || "";
    }
    
    let keywords = ["AI분석", "BBC오디오", "업로드파일"];

    try {
      // 💡 [안전 가드] 키워드를 정상적으로 낚아채고 혹여나 파싱 에러가 발생해도 본문(summary)은 훼손 없이 보존
      const keywordMatch = summary.match(/(?:핵심\s*)?키워드\s*:\s*(.+)$/m);
      if (keywordMatch && keywordMatch[1]) {
        summary = summary.replace(keywordMatch[0], "").trim();
        keywords = keywordMatch[1].replace(/[*#]/g, "").split(',').map(k => k.trim());
      }
    } catch (parseErr) {
      console.warn("⚠️ 업로드 요약본 키워드 파싱 실패 가드 작동 (요약 리포트는 그대로 출력):", parseErr.message);
    }

    console.log("🟢 [제미나이 요약 완료] 분석 보고서 가공 성공.");
    
    // 4. 추출된 정밀 자막, 요약본, 키워드를 일괄 반환
    res.json({ transcripts, summary, keywords });

  } catch (error) {
    console.error("❌ 파일 업로드 STT/요약 파이프라인 장애 터짐:", error.message);
    res.status(500).json({ error: "음성 파일 분석 중 심각한 오류가 발생했습니다." });
  } finally {
    // 5. 서버 임시 파일 누수 완전 방어 (원본 및 전처리 MP3 둘 다 클리닝)
    if (fs.existsSync(originalFilePath)) fs.unlinkSync(originalFilePath);
    if (fs.existsSync(standardMp3Path)) fs.unlinkSync(standardMp3Path);
    console.log("🧹 [보안 청소] 분석에 활용한 백엔드 임시 파일 안전하게 완전 영구 삭제 완료.");
  }
});


app.listen(PORT, () => {
  console.log(`🚀 [중계 관제 규격] 클라우드 배포용 서버 인프라가 포트 ${PORT} 에서 활성화되었습니다.`);
});