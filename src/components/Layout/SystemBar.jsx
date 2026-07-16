import React, { useState, useEffect } from 'react';

export default function SystemBar() {
  // 💡 [학습 포인트] 현재 시간을 관리할 리액트 상태(State) 선언
  const [time, setTime] = useState('');

  useEffect(() => {
    // 💡 [학습 포인트] 디지털 시계를 실시간으로 만들어주는 자바스크립트 내장 함수
    const updateClock = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? '오후' : '오전';
      
      hours = hours % 12;
      hours = hours ? hours : 12; // 0시면 12시로 표시
      
      setTime(`${ampm} ${hours}:${minutes}`);
    };

    updateClock(); // 앱이 켜지자마자 최초 한 번 실행
    const timerId = setInterval(updateClock, 1000); // 1초(1000ms)마다 시계 리프레시

    return () => clearInterval(timerId); // [메모리 누수 방지] 컴포넌트가 사라질 때 타이머 청소
  }, []);

  return (
    // 💡 bg-white/70 backdrop-blur-md: 토스/iOS 스타일의 반투명 유리창 효과
    <div className="w-full h-12 bg-white/70 backdrop-blur-md flex justify-between items-center px-6 shrink-0 select-none z-50 sticky top-0 border-b border-gray-100/50">
      {/* 실시간으로 변하는 이쁜 한국형 시간 표시 */}
      <span className="text-xs font-bold text-[#191f28] font-sans tracking-tight">{time}</span>
      
      {/* 📱 폰 느낌을 주는 다이내믹 아일랜드 타원 디자인 바 */}
      <div className="w-28 h-4 bg-[#000000] rounded-full absolute left-1/2 transform -translate-x-1/2 top-2.5 hidden sm:block"></div>
      
      {/* 5G, 배터리 아이콘 대용 텍스트 */}
      <span className="text-[10px] font-black text-[#191f28] tracking-widest">5G</span>
    </div>
  );
}