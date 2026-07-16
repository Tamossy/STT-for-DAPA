import React, { useState } from 'react';
import { Mail, Lock, User, ChevronLeft } from 'lucide-react';

export default function Register({
  setCurrentTab,
  userName,
  setUserName,
  handleRegister
}) {
  // 💡 [학습 포인트] 회원가입 입력 검증을 위해 내부 로컬 상태 추가 선언
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // 💡 세 가지 입력란이 모두 공백이 아닐 때만 회원가입 버튼 잠금 해제!
  const isFormValid = userName.trim() !== '' && email.trim() !== '' && password.trim() !== '';

  return (
    <div className="flex-1 flex flex-col justify-between pt-10 pb-8 px-2 font-sans animate-fadeIn">
      <div>
        {/* 뒤로 가기 버튼을 토스처럼 여백과 얇은 아이콘으로 가볍게 매칭 */}
        <button 
          onClick={() => setCurrentTab('login')} 
          className="mb-8 flex items-center text-sm font-bold text-[#8b95a1] hover:text-[#4e5968] transition-colors"
        >
          <ChevronLeft className="w-5 h-5 mr-1 stroke-[2.5]" /> 로그인으로 돌아가기
        </button>
        
        <h1 className="text-[26px] font-bold text-[#191f28] tracking-tighter leading-tight">
          새로운 계정 만들기
        </h1>
        <p className="text-sm font-medium text-[#8b95a1] mt-2 tracking-tight">
          이름과 이메일을 입력하고 서비스를 시작하세요.
        </p>
        
        <form onSubmit={handleRegister} className="mt-10 space-y-4">
          {/* 이름 입력창 */}
          <div className="relative group">
            <User className="w-5 h-5 text-[#b0b8c1] absolute left-4 top-4 transition-colors group-focus-within:text-[#3182f6]" />
            <input 
              type="text" 
              placeholder="사용자 이름" 
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="w-full h-13 bg-white rounded-2xl border border-[#e5e8eb] pl-12 pr-4 text-sm font-medium text-[#333d4b] placeholder-[#b0b8c1] focus:outline-none focus:border-[#3182f6] focus:ring-4 focus:ring-[#3182f6]/10 transition-all duration-200"
            />
          </div>

          {/* 이메일 입력창 */}
          <div className="relative group">
            <Mail className="w-5 h-5 text-[#b0b8c1] absolute left-4 top-4 transition-colors group-focus-within:text-[#3182f6]" />
            <input 
              type="email" 
              placeholder="이메일 주소" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full h-13 bg-white rounded-2xl border border-[#e5e8eb] pl-12 pr-4 text-sm font-medium text-[#333d4b] placeholder-[#b0b8c1] focus:outline-none focus:border-[#3182f6] focus:ring-4 focus:ring-[#3182f6]/10 transition-all duration-200"
            />
          </div>

          {/* 비밀번호 설정창 */}
          <div className="relative group">
            <Lock className="w-5 h-5 text-[#b0b8c1] absolute left-4 top-4 transition-colors group-focus-within:text-[#3182f6]" />
            <input 
              type="password" 
              placeholder="비밀번호 설정" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full h-13 bg-white rounded-2xl border border-[#e5e8eb] pl-12 pr-4 text-sm font-medium text-[#333d4b] placeholder-[#b0b8c1] focus:outline-none focus:border-[#3182f6] focus:ring-4 focus:ring-[#3182f6]/10 transition-all duration-200"
            />
          </div>

          {/* 조건 충족에 따른 유연한 가입 완료 버튼 */}
          <button 
            type="submit" 
            disabled={!isFormValid}
            className={`w-full h-13 rounded-2xl font-semibold text-base transition-all duration-300 mt-6 shadow-sm ${
              isFormValid 
                ? 'bg-[#3182f6] text-white hover:bg-[#1b64da] active:scale-[0.99]' 
                : 'bg-[#f2f4f6] text-[#b0b8c1] cursor-not-allowed'
            }`}
          >
            회원가입 완료
          </button>
        </form>
      </div>
    </div>
  );
}