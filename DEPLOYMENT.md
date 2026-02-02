# 시간표 겹치기 & 추천 웹앱 - Vercel 배포 가이드

## 프로젝트 개요

이 프로젝트는 Next.js App Router + TypeScript + Tailwind CSS로 구현된 시간표 겹치기 및 추천 웹앱입니다.

### 주요 기능
- ✅ 7일 x 24시간 그리드 기반 시간표 입력
- ✅ 드래그로 간편한 일정 설정/해제
- ✅ 두 사용자의 시간표 겹침 비교
- ✅ 공통 여유 시간대 자동 추천 (최소 2시간 이상)

---

## 로컬 개발

### 1. 의존성 설치
```bash
npm install
```

### 2. 개발 서버 실행
```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 확인합니다.

### 3. 프로덕션 빌드 테스트
```bash
npm run buildCtrl + C
npm run dev
npm start
```

---

## Vercel 배포 방법

### 방법 1: Vercel CLI 사용 (권장)

#### 1단계: Vercel CLI 설치
```bash
npm install -g vercel
```

#### 2단계: 로그인
```bash
vercel login
```

#### 3단계: 배포
프로젝트 루트 디렉토리에서 실행:
```bash
vercel
```

첫 배포 시 몇 가지 질문이 나옵니다:
- **Set up and deploy?** → Y
- **Which scope?** → 본인 계정 선택
- **Link to existing project?** → N
- **What's your project's name?** → schedule-overlap (또는 원하는 이름)
- **In which directory is your code located?** → ./ (현재 디렉토리)

배포가 완료되면 URL이 생성됩니다 (예: `https://schedule-overlap-xxx.vercel.app`)

#### 4단계: 프로덕션 배포
```bash
vercel --prod
```

---

### 방법 2: Vercel 웹 대시보드 사용

#### 1단계: GitHub에 코드 푸시
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

#### 2단계: Vercel 대시보드에서 Import
1. [Vercel 대시보드](https://vercel.com/dashboard)에 로그인
2. **Add New... → Project** 클릭
3. GitHub 저장소 선택
4. **Import** 클릭
5. 프로젝트 설정 확인:
   - **Framework Preset**: Next.js (자동 감지)
   - **Build Command**: `npm run build` (기본값)
   - **Output Directory**: `.next` (기본값)
6. **Deploy** 클릭

배포가 완료되면 자동으로 URL이 생성됩니다!

---

## 배포 후 자동화

### GitHub 연동 시 자동 배포
- `main` 브랜치에 push하면 자동으로 프로덕션 배포
- 다른 브랜치에 push하면 프리뷰 배포 생성

### 환경 변수 설정 (추후 확장 시)
Vercel 대시보드 → 프로젝트 → Settings → Environment Variables에서 설정 가능:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- 등등...

---

## 프로젝트 구조

```
schedule-overlap/
├── app/
│   ├── components/
│   │   ├── TimeGrid.tsx       # 시간표 그리드 컴포넌트
│   │   └── OverlapGrid.tsx    # 겹침 비교 컴포넌트
│   ├── utils/
│   │   └── recommendation.ts  # 추천 로직
│   ├── page.tsx               # 메인 페이지
│   ├── layout.tsx             # 레이아웃
│   └── globals.css            # 전역 스타일
├── public/                    # 정적 파일
├── package.json
├── next.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

---

## 주요 컴포넌트 설명

### TimeGrid.tsx
- 7일 x 24시간 드래그 가능한 그리드
- `onPointerDown/Enter/Up` 이벤트로 드래그 구현
- 드래그 시작 셀 상태에 따라 set/unset 모드 자동 결정

### OverlapGrid.tsx
- 두 사용자의 스케줄을 겹쳐 표시
- 겹침 레벨: 0(둘 다 여유), 1(한 명만 바쁨), 2(둘 다 바쁨)

### recommendation.ts
- `findCommonFreeSlots()`: 공통 여유 시간대 탐색
- `findLongestSlot()`: 가장 긴 연속 구간 찾기
- `generateRecommendation()`: 추천 문구 생성

---

## 향후 확장 계획

- [ ] Supabase/Firebase 연동으로 실제 사용자 인증
- [ ] 여러 사용자(3명 이상) 스케줄 비교
- [ ] 스케줄 저장 및 공유 기능
- [ ] 모바일 최적화 (터치 드래그)
- [ ] 다크 모드 지원
- [ ] 다국어 지원

---

## 문제 해결

### 빌드 에러 발생 시
```bash
# node_modules 재설치
rm -rf node_modules package-lock.json
npm install

# 캐시 클리어
rm -rf .next
npm run build
```

### Vercel 배포 실패 시
- Vercel 대시보드에서 Deployment Logs 확인
- Node.js 버전 확인 (package.json의 engines 필드 설정)
- 환경 변수 누락 여부 확인

---

## 참고 링크

- [Next.js 공식 문서](https://nextjs.org/docs)
- [Vercel 배포 가이드](https://vercel.com/docs)
- [Tailwind CSS 문서](https://tailwindcss.com/docs)

---

## 라이선스

MIT
