# Mixpanel 자연어 질의 인터페이스 설계서

## 개요

Mixpanel MCP 서버를 활용하여 자연어로 데이터를 질의하고, 결과를 자연어 답변 + 메타데이터 + 테이블 + 차트로 보여주는 웹 애플리케이션.

## 기술 스택

- **프론트엔드:** React + TypeScript + Vite
- **백엔드:** Node.js + Express + TypeScript
- **차트:** Chart.js (react-chartjs-2)
- **LLM:** Claude API / OpenAI API (설정으로 선택)
- **MCP:** Mixpanel MCP 서버 (백엔드 내장, child process)
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
│  │ LLM Router │  │ MCP Client             │  │
│  │ (Claude/   │←→│ (Mixpanel MCP 서버     │  │
│  │  OpenAI)   │  │  subprocess로 내장)    │  │
│  └────────────┘  └────────────────────────┘  │
└──────────────────────────────────────────────┘
```

### 핵심 흐름

1. 사용자가 자연어 질문 입력 (예: "지난 7일간 DAU 추이를 보여줘")
2. 백엔드가 LLM에 질문 + MCP 도구 스키마 전달
3. LLM이 적절한 MCP 도구를 tool-use로 호출
4. 백엔드가 MCP 서버 실행하여 Mixpanel 데이터 반환
5. LLM이 결과를 자연어로 요약 + 구조화된 메타데이터 생성
6. 프론트엔드에 자연어 답변 + 메타데이터 + 테이블 데이터 전달

LLM이 여러 번 tool-use를 호출할 수 있으며, 백엔드는 `end_turn`까지 tool-use 루프를 반복한다.

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
│   ├── mcp/
│   │   ├── client.ts         # MCP 클라이언트 (서버 프로세스 관리)
│   │   └── tools.ts          # MCP 도구 스키마 정의
│   └── types/
│       └── index.ts          # 공유 타입 정의
├── package.json
└── tsconfig.json
```

### API 응답 스키마

```typescript
interface QueryResponse {
  // 자연어 답변
  answer: string;

  // 메타데이터 (실제 쿼리 정보)
  metadata: {
    query: string;            // 실행된 MCP 도구 + 파라미터
    dateRange: string;        // "2026-03-16 ~ 2026-03-23"
    dimensions: string[];     // ["country", "platform"]
    metrics: string[];        // ["DAU", "Session Count"]
    cohortDefinition?: string;
  };

  // 테이블 데이터
  table: {
    columns: string[];
    rows: any[][];
    totalRows: number;
  };

  // 차트 데이터
  chart?: {
    type: 'line' | 'bar';
    labels: string[];
    datasets: { label: string; data: number[] }[];
  };
}
```

### MCP 서버 내장 방식

- 백엔드 시작 시 Mixpanel MCP 서버를 child process로 spawn
- `@modelcontextprotocol/sdk`를 사용해 stdio 통신
- LLM의 tool-use 응답을 받아 MCP 서버에 전달, 결과를 다시 LLM에 피드백

### 시스템 프롬프트

- Mixpanel 데이터 분석가 역할 부여
- 응답을 반드시 `QueryResponse` JSON 스키마로 반환하도록 지시
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
│        │  │ 쿼리: Run-Query(...)        │    │
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

## 범위 외 (YAGNI)

- 사용자 인증/로그인
- 영구 히스토리 저장 (DB)
- 다국어 지원
- 대시보드 저장/공유
- 복잡한 시각화 (히트맵, 퍼널 차트 등)
