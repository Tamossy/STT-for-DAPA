// src/components/Auth/Login.jsx
import React, { useState } from 'react';
import { Mic, Mail, Lock, Eye, EyeOff } from 'lucide-react';

export default function Login({ setCurrentTab }) {
  // 💡 부모에게 의존하지 않고 내부에서 스스로 데이터 관리하도록 교체
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // 💡 로그인 버튼 클릭 시 실행되는 자체 핸들러
  const handleLogin = (e) => {
    e.preventDefault();
    
    // 단순 테스트용 통과 로직 (원하시는 로그인 규칙이 있다면 수정 가능합니다)
    if (userEmail && userPassword) {
      alert(`${userEmail}님, 환영합니다!`);
      setCurrentTab('workspace'); // 로그인 성공 시 메인 회의록 보관소로 이동!
    }
  };

  // 💡 이메일과 비밀번호가 둘 다 입력되었는지 실시간 판별하는 스위치
  const isFormValid = userEmail.trim() !== '' && userPassword.trim() !== '';

  return (
    <div className="flex-1 flex flex-col justify-between pt-16 pb-8 px-2 font-sans select-none animate-fadeIn">
      <div>
        {/* 토스 스타일의 은은한 그림자가 들어간 둥근 앱 아이콘 박스 */}
        <div className="w-14 h-14 bg-[#3182f6] rounded-[22px] flex items-center justify-center mb-8 shadow-[0_8px_20px_rgba(49,130,246,0.2)]">
          <Mic className="w-7 h-7 text-white stroke-[2.2]" />
        </div>
        
        {/* 토스 시그니처 타이포그래피 */}
        <h1 className="text-[28px] font-bold text-[#191f28] tracking-tighter leading-[1.35]">
          간편하고 똑똑한<br />STT 회의록 시스템
        </h1>
        <p className="text-sm font-medium text-[#8b95a1] mt-3 tracking-tight">
          안전하게 회의를 녹음하고 전사하세요.
        </p>
        
        <form onSubmit={handleLogin} className="mt-12 space-y-4">
          {/* 이메일 입력창 파트 */}
          <div className="relative group">
            <Mail className="w-5 h-5 text-[#b0b8c1] absolute left-4 top-4 transition-colors group-focus-within:text-[#3182f6]" />
            <input 
              type="email" 
              placeholder="이메일 주소 (admin 포함 시 관리자)" 
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              className="w-full h-13 bg-white rounded-2xl border border-[#e5e8eb] pl-12 pr-4 text-sm font-medium text-[#333d4b] placeholder-[#b0b8c1] focus:outline-none focus:border-[#3182f6] focus:ring-4 focus:ring-[#3182f6]/10 transition-all duration-200"
            />
          </div>

          {/* 비밀번호 입력창 파트 */}
          <div className="relative group">
            <Lock className="w-5 h-5 text-[#b0b8c1] absolute left-4 top-4 transition-colors group-focus-within:text-[#3182f6]" />
            <input 
              type={showPassword ? "text" : "password"} 
              placeholder="비밀번호" 
              value={userPassword}
              onChange={(e) => setUserPassword(e.target.value)}
              className="w-full h-13 bg-white rounded-2xl border border-[#e5e8eb] pl-12 pr-12 text-sm font-medium text-[#333d4b] placeholder-[#b0b8c1] focus:outline-none focus:border-[#3182f6] focus:ring-4 focus:ring-[#3182f6]/10 transition-all duration-200"
            />
            <button 
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-4 text-[#b0b8c1] hover:text-[#4e5968] transition-colors"
            >
              {showPassword ? <EyeOff className="w-5 h-5 stroke-[1.8]" /> : <Eye className="w-5 h-5 stroke-[1.8]" />}
            </button>
          </div>

          {/* 동적 디자인 작동 버튼 */}
          <button 
            type="submit" 
            disabled={!isFormValid} 
            className={`w-full h-13 rounded-2xl font-semibold text-base transition-all duration-300 mt-4 shadow-sm ${
              isFormValid 
                ? 'bg-[#3182f6] text-white hover:bg-[#1b64da] active:scale-[0.99]' 
                : 'bg-[#f2f4f6] text-[#b0b8c1] cursor-not-allowed'
            }`}
          >
            로그인
          </button>
        </form>
      </div>

      {/* 하단 회원가입 전환 링크 */}
      <div className="text-center mt-8">
        <button 
          type="button"
          onClick={() => setCurrentTab('register')} 
          className="text-sm font-semibold text-[#8b95a1] hover:text-[#4e5968] transition-colors group"
        >
          아직 계정이 없으신가요? <span className="text-[#3182f6] font-bold ml-1 group-hover:underline">회원가입</span>
        </button>
      </div>
    </div>
  );
}