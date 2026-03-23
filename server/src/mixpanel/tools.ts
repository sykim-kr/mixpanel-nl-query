export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const mixpanelTools: ToolDefinition[] = [
  {
    name: 'query_insights',
    description: 'Mixpanel Insights 보고서를 실행합니다. 이벤트 집계, 트렌드, breakdown 분석에 사용합니다.',
    input_schema: {
      type: 'object',
      properties: {
        from_date: { type: 'string', description: 'YYYY-MM-DD 시작일' },
        to_date: { type: 'string', description: 'YYYY-MM-DD 종료일' },
        event: { type: 'string', description: '분석할 이벤트 이름' },
        where: { type: 'string', description: '필터 조건 (Mixpanel 표현식)' },
        group_by: {
          type: 'array',
          items: { type: 'string' },
          description: '그룹 바이 속성 (dimension breakdown)',
        },
      },
      required: ['from_date', 'to_date'],
    },
  },
  {
    name: 'get_events',
    description: '프로젝트에서 사용 가능한 이벤트 이름 목록을 조회합니다.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_event_properties',
    description: '특정 이벤트의 속성(property) 이름 목록을 조회합니다.',
    input_schema: {
      type: 'object',
      properties: {
        event: { type: 'string', description: '이벤트 이름' },
      },
      required: ['event'],
    },
  },
  {
    name: 'get_property_values',
    description: '특정 속성의 고유 값 목록을 조회합니다.',
    input_schema: {
      type: 'object',
      properties: {
        property: { type: 'string', description: '속성 이름' },
      },
      required: ['property'],
    },
  },
  {
    name: 'run_jql',
    description: 'Mixpanel JQL(JavaScript Query Language) 스크립트를 실행합니다. 복잡한 쿼리, 코호트 분석, 커스텀 집계에 사용합니다.',
    input_schema: {
      type: 'object',
      properties: {
        script: { type: 'string', description: 'JQL JavaScript 스크립트' },
      },
      required: ['script'],
    },
  },
];
