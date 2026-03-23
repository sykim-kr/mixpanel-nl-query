import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import queryRouter from './routes/query';

// .env는 프로젝트 루트에 있음 (dev: __dirname=server/src, prod: __dirname=server/dist)
// 두 경우 모두 ../../.env가 프로젝트 루트를 가리킴
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api', queryRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
