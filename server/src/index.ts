import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import queryRouter from './routes/query';
import mixpanelAuthRouter from './routes/mixpanelAuth';

// 로컬에서만 .env 로드, 프로덕션에선 플랫폼이 환경 변수 주입
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });
}

const app = express();
const PORT = process.env.PORT || 3001;

// CORS: 프로덕션에선 CORS_ORIGIN으로 허용 도메인 제한 (콤마 구분 복수 가능)
const corsOriginEnv = process.env.CORS_ORIGIN || '*';
const corsOrigin = corsOriginEnv === '*' ? '*' : corsOriginEnv.split(',').map(s => s.trim());
app.use(cors({ origin: corsOrigin }));
app.use(express.json());

app.use('/api', mixpanelAuthRouter);
app.use('/api', queryRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
