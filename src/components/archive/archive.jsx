// src/components/archive/Archive.jsx
import React, { useState, useRef } from 'react';
import { Search, ChevronRight, AlertCircle, ArrowLeft, CheckCircle2, UploadCloud, FolderOpen, Trash2, Settings, X, ShieldAlert, Loader2, Play } from 'lucide-react';

export default function Archive({
  currentTab,
  setCurrentTab,
  searchQuery,
  setSearchQuery,
  filteredMeetings,
  selectedMeeting,
  setSelectedMeeting,
  handleDeleteMeeting,
  setMeetings, // 💡 App.jsx 허브로부터 내려받은 세션 갱신 함수 접수
  meetings = [] // 💡 [추가] 원본 데이터베이스 배열 디스트럭처링 접수
}) {
  const fileInputRef = useRef(null);
  const audioPlayerRef = useRef(null); // 💡 진짜 오디오 디바이스 조작을 위한 리액트 레퍼런스 선언

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  
  // 💡 [2번 기능 수립용] 파일 업로드 시 Gemini 분석 프로세스 진행 상태 추적
  const [isUploading, setIsUploading] = useState(false);

  // 💡 [치명적 버그 해결] selectedMeeting 임시 복사 객체를 직접 쓰지 않고, 
  // App.jsx의 오리지널 meetings 데이터베이스 배열에서 실시간 최신 정보로 역추적 매핑합니다.
  const activeMeeting = selectedMeeting 
    ? (meetings.find(m => m.id === selectedMeeting.id) || selectedMeeting)
    : null;

  if (currentTab !== 'archive' && currentTab !== 'detail') return null;

  // 💡 [핵심] 파일 탐색기로 6분 BBC MP3 선택 즉시 가동될 고성능 분석 파이프라인
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 업로드 안전 차단선 구축
    setIsUploading(true);
    
    const formData = new FormData();
    formData.append('audio', file);

    try {
      // 💡 [배포 대응 스마트 배선] 로컬이면 로컬로, 배포되었으면 클라우드로 자동 연결
      const BACKEND_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://127.0.0.1:5001'
        : 'https://나중에-만들-백엔드-주소.com'; // 👈 (이 부분은 백엔드 배포 후에 진짜 주소로 다시 바꿀 예정입니다!)

      const response = await fetch(`${BACKEND_URL}/api/upload-transcribe`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error("서버와의 Whisper/Gemini 통신 도중 에러가 발생했습니다.");
      }

      const result = await response.json();

      // 💡 [브라우저 가상 주소 기법] 로컬 브라우저가 해당 MP3 파일의 바이너리 데이터를 직접 가져가 플레이할 수 있게 URL 생성
      const localAudioUrl = URL.createObjectURL(file);

      // 💡 [초강력 수술] 어떤 변수명을 쓰더라도 통신 배선이 매핑되도록 모든 후보 변수명에 요약본을 다 찔러넣어 줍니다.
      const newFileMeeting = {
        id: Date.now(),
        title: `음성 파일 분석 리포트 (${file.name})`,
        date: new Date().toLocaleDateString(),
        duration: "분석완료", 
        summary: result.summary,       // 후보 1
        description: result.summary,   // 후보 2 (가장 유력한 토스 앱 기본 변수명)
        content: result.summary,       // 후보 3
        keywords: result.keywords || ["AI분석", "BBC오디오"],
        transcripts: result.transcripts || [], // 백엔드로부터 문장별 시작 'seconds'가 매핑된 자막 배열 접수
        audioUrl: localAudioUrl // 진짜 플레이를 위한 가상 사운드 좌표 탑재
      };

      // 캐비닛 데이터베이스 갱신 및 강제 화면 전환으로 즉각적인 피드백 선사
      setMeetings(prev => [newFileMeeting, ...prev]);
      setSelectedMeeting(newFileMeeting);
      setCurrentTab('detail');

    } catch (err) {
      console.error("분석 에러 발생:", err);
      alert(`❌ 파일 분석 실패: ${err.message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = ""; // 파일 인풋 인덱스 리셋
    }
  };

  // 💡 [최핵심 기능 - REQ-2.3] 자막 클릭 시 해당 초 시간 지점으로 오디오 바를 즉시 튕겨 보내기
  const handleTimestampJump = (targetSeconds) => {
    if (audioPlayerRef.current) {
      // targetSeconds가 존재하지 않거나 NaN일 경우 방어코드 작동
      if (targetSeconds === undefined || isNaN(targetSeconds)) return;
      
      audioPlayerRef.current.currentTime = targetSeconds; // 오디오 하드웨어의 재생 좌표를 강제 수동 조정
      audioPlayerRef.current.play().catch(err => console.log("자동 재생 정책으로 인해 클릭 대기 수립"));
    }
  };

  const handleChangePassword = (e) => {
    e.preventDefault();
    alert("🔒 비밀번호 변경 요청이 접수되었습니다!");
    setCurrentPw('');
    setNewPw('');
  };

  const handleWithdrawal = () => {
    if (window.confirm("⚠️ 정말로 탈퇴하시겠습니까?")) {
      setIsSettingsOpen(false);
      setCurrentTab('login');
    }
  };

  // 💡 상세 보기 창에서 안전하게 요약본을 읽어오는 추출 함수
  const getSafeSummaryText = (meeting) => {
    if (!meeting) return "";
    // summary, description, content 중 살아있는 데이터를 우선적으로 탐색합니다.
    return meeting.summary || meeting.description || meeting.content || "요약 리포트 파싱 대기 중...";
  };

  return (
    <div className="flex-1 flex flex-col pt-12 select-none animate-fadeIn font-sans pb-6 relative">
      
      {/* 📂 [파트 1] 회의록 보관소 목록 화면 */}
      {currentTab === 'archive' && (
        <>
          <div className="mb-8 flex justify-between items-center">
            <div>
              <span className="text-xs font-bold text-[#3182f6] tracking-wider uppercase">Cabinet</span>
              <h1 className="text-[26px] font-bold text-[#191f28] mt-1 tracking-tighter">회의록 보관소</h1>
            </div>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-2.5 bg-white border border-[#f2f4f6] rounded-xl text-[#8b95a1] hover:text-[#191f28] hover:shadow-sm transition-all duration-200 active:scale-95"
              title="계정 및 설정 관리"
            >
              <Settings className="w-5 h-5 stroke-[2]" />
            </button>
          </div>

          {/* 💡 [로딩 분기 처리] 백엔드가 Whisper STT + 제미나이 연산하는 5~10초간 고도화 로더 카드 노출 */}
          {isUploading ? (
            <div className="mb-6 bg-[#3182f6]/5 rounded-2xl border border-[#3182f6]/10 p-6 text-center shadow-sm">
              <Loader2 className="w-8 h-8 mx-auto text-[#3182f6] animate-spin mb-2" />
              <p className="text-xs font-bold text-[#191f28]">오디오 엔진 정밀 스캔 중...</p>
              <p className="text-[10px] font-medium text-[#8b95a1] mt-1">AI가 음성을 텍스트 변환하여 요약중입니다.</p>
            </div>
          ) : (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="mb-6 bg-white rounded-2xl border-2 border-dashed border-[#e5e8eb] hover:border-[#3182f6] p-5 text-center cursor-pointer transition-all duration-200 group active:scale-[0.99]"
            >
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".mp3,audio/*" // 💡 맥북 호환성 패치 완료
                className="hidden" 
              />
              <UploadCloud className="w-8 h-8 mx-auto text-[#b0b8c1] group-hover:text-[#3182f6] transition-colors stroke-[1.8] mb-1.5" />
              <p className="text-xs font-bold text-[#4e5968] group-hover:text-[#3182f6] transition-colors">음성 파일 올리기</p>
              <p className="text-[11px] font-medium text-[#8b95a1] mt-0.5">mp3 포맷 녹음 이력 분석 센서</p>
            </div>
          )}

          <div className="relative mb-6">
            <Search className="w-4 h-4 text-[#b0b8c1] absolute left-4 top-4" />
            <input 
              type="text" 
              placeholder="제목이나 요약 내용으로 검색..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-12 bg-white border border-[#e5e8eb] rounded-2xl pl-11 pr-4 text-sm font-medium text-[#333d4b] placeholder-[#b0b8c1] focus:outline-none focus:border-[#3182f6] focus:ring-4 focus:ring-[#3182f6]/10 transition-all duration-200"
            />
          </div>

          <div className="flex-1 space-y-4 pb-4">
            {filteredMeetings.length === 0 ? (
              <div className="text-center text-[#b0b8c1] py-16 bg-white rounded-[28px] border border-[#f2f4f6]">
                <FolderOpen className="w-10 h-10 mx-auto mb-3 stroke-[1.3] text-[#b0b8c1]" />
                <p className="text-sm font-bold text-[#4e5968]">저장된 회의록이 없습니다</p>
                <p className="text-xs font-medium text-[#8b95a1] mt-1">새로운 대화를 녹음하거나 파일을 올려보세요.</p>
              </div>
            ) : (
              filteredMeetings.map((m) => (
                <div 
                  key={m.id}
                  onClick={() => { setSelectedMeeting(m); setCurrentTab('detail'); }}
                  className="bg-white rounded-2xl p-5 border border-[#f2f4f6] shadow-[0_4px_16px_rgba(0,0,0,0.01)] hover:border-[#3182f6]/30 hover:shadow-[0_8px_24px_rgba(0,0,0,0.03)] transition-all duration-200 cursor-pointer flex items-center justify-between group active:scale-[0.99] relative"
                >
                  <div className="space-y-2 flex-1 pr-8">
                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] font-mono font-bold text-[#8b95a1]">{m.date}</span>
                      <span className="text-[11px] font-mono font-bold text-[#3182f6] bg-[#3182f6]/10 px-2 py-0.5 rounded-md">{m.duration}</span>
                    </div>
                    <h3 className="text-base font-bold text-[#191f28] group-hover:text-[#3182f6] transition-colors line-clamp-1 tracking-tight">{m.title}</h3>
                    {/* 💡 목록 검색 요약 부분도 다중 변수명 방어 */}
                    <p className="text-xs font-medium text-[#4e5968] line-clamp-2 leading-relaxed">{getSafeSummaryText(m)}</p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {m.keywords && m.keywords.map((k, i) => (
                        <span key={i} className="text-[10px] font-bold text-[#4e5968] bg-[#f2f4f6] px-2 py-0.5 rounded-md">#{k}</span>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-between h-full space-y-4 shrink-0 pl-2">
                    <button 
                      onClick={(e) => handleDeleteMeeting(m.id, e)}
                      className="p-1.5 text-[#b0b8c1] hover:text-[#f04452] hover:bg-[#f04452]/5 rounded-lg transition-colors"
                      title="회의록 파기"
                    >
                      <Trash2 className="w-4 h-4 stroke-[2]" />
                    </button>
                    <ChevronRight className="w-5 h-5 text-[#b0b8c1] group-hover:text-[#3182f6] transition-colors stroke-[2.2]" />
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* 📊 [파트 2] 상세 보기 화면 (클릭 시 1분대, 5분대 싱크 점프 연계 구현 구역) */}
      {currentTab === 'detail' && activeMeeting && (
        <div className="flex-1 flex flex-col pt-2 pb-4 animate-fadeIn">
          <button 
            onClick={() => setCurrentTab('archive')}
            className="mb-6 flex items-center text-sm font-bold text-[#8b95a1] hover:text-[#4e5968] transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5 stroke-[2.5]" /> 목록으로 나가기
          </button>

          {/* 💡 [진짜 사운드 인터페이스] 오디오 재생 바 레이어 물리적 탑재 */}
          {activeMeeting.audioUrl && (
            <div className="mb-6 bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex flex-col space-y-2">
              <span className="text-[10px] font-bold text-[#3182f6] uppercase tracking-wider flex items-center">
                <Play className="w-3 h-3 mr-1 fill-[#3182f6] stroke-none" /> 오디오 컨트롤 타임라인
              </span>
              <audio 
                ref={audioPlayerRef} 
                src={activeMeeting.audioUrl} 
                controls 
                className="w-full h-8 mt-1 focus:outline-none"
              />
              <p className="text-[10px] text-[#8b95a1] font-medium leading-tight">💡 아래 자막(또는 타임스탬프)을 클릭하면 위 플레이어가 해당 시간대로 자동 점프합니다.</p>
            </div>
          )}

          <div className="space-y-1.5 mb-6">
            <div className="flex items-center space-x-2 text-xs font-mono font-bold text-[#8b95a1]">
              <span>{activeMeeting.date}</span>
              <span>•</span>
              <span>녹음 분석 시간 {activeMeeting.duration}</span>
            </div>
            <h1 className="text-2xl font-bold text-[#191f28] leading-snug tracking-tighter">{activeMeeting.title}</h1>
          </div>

          <div className="bg-[#3182f6]/5 rounded-2xl p-5 border border-[#3182f6]/10 mb-6 shadow-sm shadow-[#3182f6]/5">
            <div className="flex items-center space-x-1.5 text-[#3182f6] mb-2">
              <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
              <span className="text-xs font-bold uppercase tracking-wider">AI 스마트 요약</span>
            </div>
            {/* 💡 [수술 완료] 활성화된 오리지널 최신 원본 매핑 객체(activeMeeting)를 호출하여 화면에 확실하게 노출 */}
            <p className="text-sm font-medium text-[#333d4b] leading-relaxed whitespace-pre-line">
              {getSafeSummaryText(activeMeeting)}
            </p>
          </div>

          <div className="flex-1 bg-white rounded-3xl border border-[#f2f4f6] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.01)] flex flex-col">
            <span className="text-xs font-bold text-[#8b95a1] mb-4 block uppercase tracking-wider">전체 발화 기록 (자막 클릭 시 구간 이동)</span>
            <div className="flex-1 overflow-y-auto space-y-3.5 max-h-[320px] pr-1 scrollbar-thin">
              {activeMeeting.transcripts && activeMeeting.transcripts.map((t, idx) => (
                <div 
                  key={idx} 
                  onClick={() => handleTimestampJump(t.seconds)} // 💡 [킬러 기능] 자막 패널 터치 시 시간 축 조작 연동
                  className="space-y-1 animate-fadeIn p-2 hover:bg-[#3182f6]/5 rounded-xl transition-all duration-150 cursor-pointer border border-transparent hover:border-[#3182f6]/10 active:scale-[0.99]"
                  title={`${t.time} 지점으로 이동해서 재생하기`}
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] font-bold text-[#3182f6] bg-[#3182f6]/5 px-2 py-0.5 rounded-md">{t.speaker}</span>
                    <span className="text-[10px] font-mono font-bold text-[#4e5968] bg-gray-100 px-1.5 py-0.5 rounded-md">{t.time}</span>
                  </div>
                  <p className="text-sm font-medium text-[#333d4b] pl-1 leading-relaxed">{t.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 💡 [신규 초대형 레이어 UI] 토스 스타일 내 정보 관리 및 탈퇴 모달창 */}
      {isSettingsOpen && (
        <div className="absolute inset-0 bg-[#000000]/30 z-50 flex flex-col justify-end rounded-[32px] overflow-hidden animate-fadeIn">
          <div className="absolute inset-0 z-0" onClick={() => setIsSettingsOpen(false)}></div>
          <div className="bg-white rounded-t-[32px] p-6 pb-10 relative z-10 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] max-h-[90%] overflow-y-auto transform translate-y-0 transition-transform duration-300">
            <div className="flex justify-between items-center border-b border-[#f2f4f6] pb-4 mb-6">
              <h2 className="text-lg font-bold text-[#191f28] tracking-tight">내 정보 및 설정</h2>
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="p-1.5 bg-[#f2f4f6] text-[#8b95a1] hover:text-[#191f28] rounded-full transition-colors"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            <div className="space-y-3 mb-8">
              <h3 className="text-xs font-bold text-[#8b95a1] uppercase tracking-wider">보안 비밀번호 변경</h3>
              <form onSubmit={handleChangePassword} className="space-y-2.5">
                <input 
                  type="password"
                  placeholder="현재 비밀번호 입력"
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  className="w-full h-11 bg-white border border-[#e5e8eb] rounded-xl px-4 text-xs font-semibold focus:outline-none focus:border-[#3182f6]"
                />
                <input 
                  type="password"
                  placeholder="새로운 비밀번호 설정"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  className="w-full h-11 bg-white border border-[#e5e8eb] rounded-xl px-4 text-xs font-semibold focus:outline-none focus:border-[#3182f6]"
                />
                <button 
                  type="submit"
                  disabled={!currentPw || !newPw}
                  className={`w-full h-10 rounded-xl text-xs font-bold transition-colors ${
                    currentPw && newPw 
                      ? 'bg-[#3182f6] text-white hover:bg-[#1b64da]' 
                      : 'bg-[#f2f4f6] text-[#b0b8c1] cursor-not-allowed'
                  }`}
                >
                  비밀번호 저장
                </button>
              </form>
            </div>

            <div className="border-t border-[#f2f4f6] pt-6">
              <div className="bg-[#f04452]/5 rounded-2xl p-4 border border-[#f04452]/10 flex items-start space-x-3">
                <ShieldAlert className="w-5 h-5 text-[#f04452] shrink-0 mt-0.5 stroke-[2]" />
                <div className="space-y-1.5 flex-1">
                  <h4 className="text-xs font-bold text-[#f04452]">계정 영구 파기 위험구역</h4>
                  <p className="text-[11px] font-medium text-[#4e5968] leading-relaxed">
                    시스템 탈퇴 즉시 기존 본인 인증 내역 및 보관소 회의록 자산 전체가 영구 소거되며 되돌릴 수 없습니다.
                  </p>
                  <button 
                    onClick={handleWithdrawal}
                    className="mt-2 text-xs font-bold text-[#f04452] hover:underline"
                  >
                    이 계정 탈퇴하기
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}