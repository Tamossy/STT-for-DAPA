import React from 'react';
import { Mic, Folder, Briefcase, LogOut } from 'lucide-react';

export default function NavDock({ currentTab, setCurrentTab, isRecording, isAdmin }) {
  // 💡 [로그인 예외처리] 첫 게이트인 로그인/회원가입 화면에서는 하단 바를 숨깁니다.
  if (currentTab === 'login' || currentTab === 'register') return null;

  return (
    // 💡 fixed bottom-5: 화면 바닥에서 20px 띄우는 플로팅 기술
    // 💡 left-1/2 -translate-x-1/2: CSS에서 컴포넌트를 정확히 가로축 정중앙에 정렬하는 정석 공식
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md h-16 bg-white/90 backdrop-blur-lg flex items-center justify-around px-3 z-40 rounded-[28px] shadow-[0_12px_40px_rgba(0,0,0,0.08)] border border-gray-100/80">
      
      {/* 🎙️ 탭 1: 스트리밍 (작업대) */}
      <button 
        onClick={() => { if(!isRecording) setCurrentTab('workspace'); }} 
        // 💡 transition-all duration-200: 색상이 0.2초 동안 물들듯 바뀌는 토스식 부드러운 인터랙션
        className={`flex flex-col items-center justify-center flex-1 h-12 rounded-2xl transition-all duration-200 ${
          currentTab === 'workspace' 
            ? 'text-[#3182f6] font-bold bg-[#3182f6]/5' // 토스 정품 블루 컬러 주입
            : 'text-[#8b95a1] hover:text-[#4e5968]'
        }`}
      >
        <Mic className="w-5 h-5 stroke-[2.2]" />
        <span className="text-[10px] mt-1 tracking-tighter">스트리밍</span>
      </button>

      {/* 📁 탭 2: 캐비닛 (보관소) */}
      <button 
        onClick={() => { if(!isRecording) setCurrentTab('archive'); }} 
        className={`flex flex-col items-center justify-center flex-1 h-12 rounded-2xl transition-all duration-200 ${
          currentTab === 'archive' || currentTab === 'detail' 
            ? 'text-[#3182f6] font-bold bg-[#3182f6]/5' 
            : 'text-[#8b95a1] hover:text-[#4e5968]'
        }`}
      >
        <Folder className="w-5 h-5 stroke-[2.2]" />
        <span className="text-[10px] mt-1 tracking-tighter">캐비닛</span>
      </button>

      {/* 💼 탭 3: 관리콘솔 (관리자용 어드민 탭) */}
      {isAdmin && (
        <button 
          onClick={() => { if(!isRecording) setCurrentTab('admin'); }}
          className={`flex flex-col items-center justify-center flex-1 h-12 rounded-2xl relative transition-all duration-200 ${
            currentTab === 'admin'
              ? 'text-[#f04452] font-bold bg-[#f04452]/5' // 관리자는 토스 경고용 레드 계열로 강조
              : 'text-[#8b95a1] hover:text-[#4e5968]'
          }`}
        >
          <Briefcase className="w-5 h-5 stroke-[2.2]" />
          <span className="text-[10px] mt-1 tracking-tighter">관리콘솔</span>
          {/* 배지 디자인 추가 (HQ) */}
          <span className="absolute top-1.5 right-3 bg-[#f04452] text-white text-[7px] px-1 rounded-md font-mono scale-90">HQ</span>
        </button>
      )}

      {/* 🚪 탭 4: 로그아웃 버튼 */}
      <button 
        onClick={() => { if(!isRecording) setCurrentTab('login'); }} 
        className="flex flex-col items-center justify-center flex-1 h-12 rounded-2xl text-[#b0b8c1] hover:text-[#f04452] transition-all duration-200"
      >
        <LogOut className="w-5 h-5 stroke-[2]" />
        <span className="text-[10px] mt-1 tracking-tighter">로그아웃</span>
      </button>
    </div>
  );
}