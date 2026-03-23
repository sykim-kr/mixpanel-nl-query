# Mixpanel 자연어 질의 인터페이스 설계서

## 개요

Mixpanel REST API와 LLM tool-use를 활용하여 자연어로 데이터를 질의하고, 결과를 자연어 답변 + 메타데이터 + 테이블 + 차트로 보여주는 웹 애플리케이션.

## 기술 스택

- **프론트엔드:** React + TypeScript + Vite
- **백엔드:** Node.js + Express + TypeScript
- **차트:** Chart.js (react-chartjs-2)
- **LLM:** Claude API / OpenAI API (설정으로 선택)
- **데이터:** Mixpanel REST API (Service Account 인증)
- **UI 언어:** 한국어

## 아키텍처

```
┌─────────────────────────────────────────────┐
│  React Frontend (Vite + TypeScript)         │
│  ┌─────────┐ ┌──────────┐ ┌──────────────┐  │
│  │ 질의입력 │ │ 결과패널  │ │ 메타데이터   │  │
│  │         │ │ (테이블+  │ │ (쿼리/기간/  │  │
│  │         │ │  차트)    │ │  차원/지표)  │  │
│  └─────────┘ └──────────┘ └──────────────┘  │
└──────────────────┬──────────────────────────┘
                   │ REST API (POST /api/query)
┌──────────────────▼──────────────────────────┐
│  Express Backend                             │
│  ┌────────────┐  ┌────────────────────────┐  │
│  │ LLM Router │  │ Mixpanel API Client    │  │
│  │ (Claude/   │←→│ (REST API 직접 호출)   │  │
│  │  OpenAI)   │  │                        │  │
│  └────────────┘  └────────────────────────┘  │
│  ┌────────────────────────────────────────┐  │
│  │ Data Parser (테이블/차트 변환)          │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

### 핵심 흐름

1. 사용자가 자연어 질문 입력 (예: "지난 7일간 DAU 추이를 보여줘")
2. 백엔드가 LLM에 질문 + Mixpanel 도구 스키마 전달
3. LLM이 적절한 Mixpanel 도구를 tool-use로 호출 결정
4. 백엔드가 Mixpanel REST API를 직접 호출하여 데이터 반환
5. LLM이 결과를 자연어로 요약 + 메타데이터(기간, 차원, 지표) 추출
6. 백엔드 Data Parser가 Mixpanel 원본 데이터를 테이블/차트 구조로 결정적 변환
7. 프론트엔드에 자연어 답변 + 메타데이터 + 테이블 + 차트 데이터 전달

### Tool-Use 루프 안전장치

- **최대 반복:** 5회 tool-use 호출까지 허용
- **타임아웃:** 전체 질의 사이클 60초 제한
- **에러 처리:** 도구 호출 실패 시 LLM에 에러 메시지 전달, LLM이 대체 방법 시도 또는 사용자에게 에러 안내
- **부분 결과:** 루프 중간 실패 시 이미 수집된 결과로 부분 응답 반환

## 백엔드 구조

```
server/
├── src/
│   ├── index.ts              # Express 앱 진입점
│   ├── routes/
│   │   └── query.ts          # POST /api/query 엔드포인트
│   ├── llm/
│   │   ├── provider.ts       # LLM 프로바이더 인터페이스
│   │   ├── claude.ts         # Claude API 구현
│   │   └── openai.ts         # OpenAI API 구현
│   ├── mixpanel/
│   │   ├── client.ts         # Mixpanel REST API 클라이언트
│   │   ├── tools.ts          # LLM tool-use용 도구 스키마 정의
│   │   └── parser.ts         # 원본 데이터 → 테이블/차트 결정적 변환
│   └── types/
│       └── index.ts          # 공유 타입 정의
├── package.json
└── tsconfig.json
```

### API 요청/응답 스키마

```typescript
// 요청
interface QueryRequest {
  question: string;
  provider?: 'anthropic' | 'openai';
}

// 성공 응답
interface QueryResponse {
  // 자연어 답변
  answer: string;

  // 메타데이터 (실제 쿼리 정보)
  metadata: {
    toolCalls: string[];      // 실행된 도구 호출 목록 (다중 호출 지원)
    dateRange: string;        // "2026-03-16 ~ 2026-03-23"
    dimensions: string[];     // ["country", "platform"]
    metrics: string[];        // ["DAU", "Session Count"]
    cohortDefinition?: string;
  };

  // 테이블 데이터
  table: {
    columns: string[];
    rows: (string | number | null)[][];
    totalRows: number;
  };

  // 차트 데이터
  chart?: {
    type: 'line' | 'bar';
    labels: string[];
    datasets: { label: string; data: number[] }[];
  };
}

// 에러 응답
interface QueryErrorResponse {
  error: true;
  code: 'LLM_ERROR' | 'MIXPANEL_ERROR' | 'NO_DATA' | 'TIMEOUT' | 'MAX_ITERATIONS';
  message: string;  // 한국어 사용자 대면 메시지
}
```

### Mixpanel API 통합 방식

- 백엔드가 Mixpanel REST API를 Service Account 인증으로 직접 호출
- LLM에 Mixpanel 도구 스키마를 tool 정의로 전달 (쿼리 실행, 이벤트 조회, 프로퍼티 조회 등)
- LLM의 tool-use 응답을 받아 백엔드가 해당 Mixpanel API 엔드포인트 호출
- 결과를 tool_result로 LLM에 피드백

### Data Parser (결정적 변환)

LLM은 자연어 답변(`answer`)과 메타데이터(`metadata`)만 생성하고, 테이블/차트 데이터는 백엔드 파서가 Mixpanel 원본 응답을 결정적으로 변환한다.

- `parser.ts`가 Mixpanel 응답 형식(insights, funnels 등)을 감지
- 응답 형식에 따라 적절한 `columns + rows` 테이블 구조 생성
- 데이터 특성에 따라 `line` 또는 `bar` 차트 데이터 자동 생성

### 시스템 프롬프트

- Mixpanel 데이터 분석가 역할 부여
- 자연어 답변과 메타데이터만 JSON으로 반환하도록 지시 (테이블/차트는 파서가 처리)
- 한국어로 답변
- 쿼리 메타데이터(기간, 차원, 지표)를 명시적으로 추출하도록 지시

## 프론트엔드 구조

```
client/
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── components/
│   │   ├── QueryInput.tsx       # 질의 입력 (텍스트 + 전송 버튼)
│   │   ├── AnswerPanel.tsx      # 자연어 답변 표시
│   │   ├── MetadataPanel.tsx    # 쿼리/기간/차원/지표/코호트 표시
│   │   ├── DataTable.tsx        # 10행 페이지네이션 테이블
│   │   ├── ChartPanel.tsx       # 라인/바 차트 (Chart.js)
│   │   ├── HistoryList.tsx      # 세션 내 질의 히스토리 사이드바
│   │   ├── ErrorMessage.tsx     # 에러 상태 표시
│   │   └── LoadingSpinner.tsx   # 로딩 상태
│   ├── hooks/
│   │   ├── useQuery.ts          # API 호출 + 상태 관리
│   │   └── useHistory.ts        # 세션 히스토리 관리
│   ├── types/
│   │   └── index.ts             # QueryResponse 등 공유 타입
│   └── styles/
│       └── global.css
├── package.json
├── tsconfig.json
└── vite.config.ts
```

### 화면 레이아웃

```
┌──────────────────────────────────────────────┐
│  Mixpanel 자연어 질의               [Claude ▼]│
├────────┬─────────────────────────────────────┤
│        │                                     │
│ 히스토리│  ┌─ 질의 입력창 ──────── [전송] ─┐  │
│        │  └───────────────────────────────┘  │
│ • DAU  │                                     │
│ • 리텐션│  자연어 답변                        │
│ • ...  │  "지난 7일간 DAU는 평균 12,340..."   │
│        │                                     │
│        │  메타데이터                          │
│        │  ┌─────────────────────────────┐    │
│        │  │ 도구 호출: [Run-Query(...)] │    │
│        │  │ 기간: 03/16 ~ 03/23        │    │
│        │  │ 차원: country, platform     │    │
│        │  │ 지표: DAU                   │    │
│        │  └─────────────────────────────┘    │
│        │                                     │
│        │  차트                                │
│        │  ┌─────────────────────────────┐    │
│        │  │  ▁▃▅▇▆▄▃                    │    │
│        │  └─────────────────────────────┘    │
│        │                                     │
│        │  데이터 테이블                       │
│        │  ┌─────────────────────────────┐    │
│        │  │ 날짜    │ DAU   │ 국가      │    │
│        │  │ 03/16  │ 12.1K │ KR        │    │
│        │  │ ...    │ ...   │ ...       │    │
│        │  │       [< 이전] [다음 >]     │    │
│        │  └─────────────────────────────┘    │
└────────┴─────────────────────────────────────┘
```

### 주요 동작

- **Chart.js** (react-chartjs-2)로 라인/바 차트 렌더링
- DataTable은 전체 데이터를 받아 프론트에서 10행씩 슬라이싱
- LLM 프로바이더 선택 드롭다운 (Claude / GPT) 우측 상단
- 로딩 중 스피너 표시
- 에러 발생 시 ErrorMessage 컴포넌트로 한국어 에러 메시지 표시
- 세션 내 히스토리: 브라우저 새로고침 전까지 유지, 클릭 시 이전 결과 다시 표시

## 환경 변수

```
MIXPANEL_PROJECT_ID=your_project_id
MIXPANEL_SERVICE_ACCOUNT_USERNAME=your_service_account_username
MIXPANEL_SERVICE_ACCOUNT_SECRET=your_service_account_secret
ANTHROPIC_API_KEY=your_anthropic_api_key
OPENAI_API_KEY=your_openai_api_key
LLM_PROVIDER=anthropic
PORT=3001
```

`.env` 파일은 반드시 `.gitignore`에 포함하여 인증 정보가 저장소에 커밋되지 않도록 한다.

## 범위 외 (YAGNI)

- 사용자 인증/로그인
- 영구 히스토리 저장 (DB)
- 다국어 지원
- 대시보드 저장/공유
- 복잡한 시각화 (히트맵, 퍼널 차트 등)
- SSE/스트리밍 (향후 개선 가능)
