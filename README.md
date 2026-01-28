# 시간표 겹치기 & 추천 웹앱 📅

두 사람의 시간표를 비교하고 공통으로 여유로운 시간대를 찾아주는 웹 애플리케이션입니다.

![Next.js](https://img.shields.io/badge/Next.js-16.1-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.0-38bdf8?logo=tailwindcss)

## ✨ 주요 기능

### 1. 개인 시간표 입력
- 7일(월~일) x 24시간 그리드 UI
- 드래그로 간편하게 일정 설정/해제
- 드래그 시작 지점의 상태에 따라 자동으로 set/unset 모드 전환
- 전체 초기화 버튼

### 2. 시간표 비교
- 두 사용자의 시간표를 겹쳐서 시각화
- 색상 코드:
  - ⬜ **흰색**: 둘 다 여유
  - 🟢 **연한 초록**: 한 명만 바쁨
  - 🟩 **진한 초록**: 둘 다 바쁨

### 3. 스마트 추천
- 공통 여유 시간대 자동 탐색
- 최소 2시간 이상 연속된 구간 중 가장 긴 시간대 추천
- 예: "추천: 일요일 19~22시에 만나세요! (3시간 여유)"

## 🚀 빠른 시작

### 설치
```bash
npm install
```

### 개발 서버 실행
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### 프로덕션 빌드
```bash
npm run build
npm start
```

## 📦 배포

### Vercel 배포 (권장)

#### CLI 사용
```bash
# Vercel CLI 설치
npm install -g vercel

# 배포
vercel

# 프로덕션 배포
vercel --prod
```

#### 웹 대시보드 사용
1. GitHub에 코드 푸시
2. [Vercel](https://vercel.com)에서 Import
3. 자동 배포 완료!

자세한 배포 가이드는 [DEPLOYMENT.md](./DEPLOYMENT.md)를 참고하세요.

## 🛠️ 기술 스택

- **프레임워크**: Next.js 16 (App Router)
- **언어**: TypeScript
- **스타일링**: Tailwind CSS
- **배포**: Vercel

## 📂 프로젝트 구조

```
schedule-overlap/
├── app/
│   ├── components/
│   │   ├── TimeGrid.tsx       # 시간표 입력 컴포넌트
│   │   └── OverlapGrid.tsx    # 겹침 비교 컴포넌트
│   ├── utils/
│   │   └── recommendation.ts  # 추천 알고리즘
│   └── page.tsx               # 메인 페이지
├── public/                    # 정적 파일
└── ...
```

## 🎯 사용 방법

1. **사용자 1 탭**에서 첫 번째 사용자의 바쁜 시간대를 드래그로 표시
2. **사용자 2 탭**에서 두 번째 사용자의 바쁜 시간대를 드래그로 표시
3. **비교 및 추천 탭**에서 겹침 현황 및 추천 시간대 확인

## 🔮 향후 계획

- [ ] 실제 사용자 인증 (Supabase/Firebase)
- [ ] 3명 이상 다중 사용자 비교
- [ ] 스케줄 저장 및 공유
- [ ] 모바일 터치 드래그 최적화
- [ ] 다크 모드
- [ ] 다국어 지원

## 📚 Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

## 📄 라이선스

MIT

---

**Made with ❤️ using Next.js + Tailwind CSS**

