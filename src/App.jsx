// src/App.jsx
import React, { useState } from 'react';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import Archive from './components/archive/Archive'; 
import Streaming from './components/Workspace/Streaming'; 
import SystemBar from './components/Layout/SystemBar';
import NavDock from './components/Layout/NavDock';

export default function App() {
  const [currentTab, setCurrentTab] = useState('login'); // 사용자 요청에 따라 첫 진입은 로그인창으로 지정!
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  
  const [isRecording, setIsRecording] = useState(false); // 💡 Streaming과 연동하여 하단바 락커 역할 수행
  const [isAdmin, setIsAdmin] = useState(true); 

  // 💡 [개선 포인트] 오디오 연동 플레이를 위해 초기 데이터 구조에 seconds(초 단위 절대좌표) 정보 사전 탑재
  const [meetings, setMeetings] = useState([
    {
      id: 1,
      title: "방위사업청 공격잠수함 페리스코프 부품 국산화 협상 회의", //
      date: "2026. 06. 15",
      duration: "00:14",
      summary: "공격잠수함 잠망경 시스템 구성품 11개 항목에 대한 국산화 전환 검토 완료. 협상을 통해 최종 11개 컴포넌트 전량 확보 성공.", //
      keywords: ["방위사업청", "잠망경국산화", "11개부품"], //
      audioUrl: null, // 초기 고정 데이터는 실시간 테스트 전이므로 null 처리
      transcripts: [
        { speaker: "참석자 1", time: "00:01", seconds: 1, text: "웹소켓 스트리밍 연동 버전입니다." },
        { speaker: "참석자 1", time: "00:08", seconds: 8, text: "오디오 업로드 동기화 엔진을 시험할 준비가 되었습니다." }
      ]
    }
  ]);

  // 검색 시 안전 가드: 요약본이 순간적으로 비어 있어도 튕기지 않도록 방어 코드 구축
  const filteredMeetings = meetings.filter(m => {
    const titleMatch = m.title ? m.title.toLowerCase().includes(searchQuery.toLowerCase()) : false;
    const summaryText = m.summary || m.description || m.content || "";
    const summaryMatch = summaryText.toLowerCase().includes(searchQuery.toLowerCase());
    return titleMatch || summaryMatch;
  });

  const handleDeleteMeeting = (id, e) => {
    e.stopPropagation();
    if (window.confirm("이 회의록을 파기하시겠습니까?")) {
      setMeetings(prev => prev.filter(m => m.id !== id));
      if (selectedMeeting && selectedMeeting.id === id) {
        setSelectedMeeting(null);
        setCurrentTab('archive');
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#f2f4f6] flex justify-center items-center p-0 sm:p-4">
      <div className="w-full sm:w-[390px] h-screen sm:h-[844px] bg-[#f9fafb] sm:rounded-[40px] shadow-2xl overflow-hidden flex flex-col relative sm:border-[8px] sm:border-[#191f28]">
        
        <SystemBar currentTab={currentTab} />

        <div className="flex-1 overflow-y-auto px-5">
          {currentTab === 'login' && <Login setCurrentTab={setCurrentTab} />}
          {currentTab === 'register' && <Register setCurrentTab={setCurrentTab} />}
          
          {/* 💡 [배선 복구] archive 뿐만 아니라 detail 탭 상태일 때도 흰 화면이 되지 않고 내역 창을 열어주도록 결합 */}
          {(currentTab === 'archive' || currentTab === 'detail') && (
            <Archive 
              currentTab={currentTab}
              setCurrentTab={setCurrentTab}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              filteredMeetings={filteredMeetings}
              selectedMeeting={selectedMeeting}
              setSelectedMeeting={setSelectedMeeting}
              handleDeleteMeeting={handleDeleteMeeting}
              setMeetings={setMeetings} // 💡 2번 업로드 기능 가동 시, 보관소 데이터베이스 배열을 갱신해주기 위한 통제 배선 추가
              meetings={meetings} // 💡 [추가] 실시간 정밀 동기화를 위해 원천 데이터베이스 배열을 하위 컴포넌트로 강제 연동 전송
            />
          )}

          {currentTab === 'workspace' && (
            <Streaming 
              currentTab={currentTab}
              setMeetings={setMeetings}
              setCurrentTab={setCurrentTab}
              setSelectedMeeting={setSelectedMeeting}
              setIsParentRecording={setIsRecording} // 💡 부모의 전역 락커 상태 연동 스위치 주입
            />
          )}
        </div>

        <NavDock 
          currentTab={currentTab} 
          setCurrentTab={setCurrentTab} 
          isRecording={isRecording} 
          isAdmin={isAdmin} 
        />

      </div>
    </div>
  );
}