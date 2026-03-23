import { Router, Request, Response } from 'express';
import { MixpanelClient } from '../mixpanel/client';
import { createMixpanelSession, deleteMixpanelSession } from '../lib/sessionStore';
import type { MixpanelAuthRequest, MixpanelAuthResponse, QueryErrorResponse } from '../types';

const router = Router();

router.post('/mixpanel/auth', async (req: Request, res: Response) => {
  const { username, secret } = req.body as MixpanelAuthRequest;

  if (!username?.trim() || !secret?.trim()) {
    const err: QueryErrorResponse = {
      error: true,
      code: 'MIXPANEL_ERROR',
      message: 'Mixpanel username / secret 를 입력해 주세요.',
    };
    return res.status(400).json(err);
  }

  try {
    const client = new MixpanelClient({
      username: username.trim(),
      secret: secret.trim(),
    });

    const projects = await client.getProjects();

    if (projects.length === 0) {
      const err: QueryErrorResponse = {
        error: true,
        code: 'NO_DATA',
        message: '접근 가능한 Mixpanel 프로젝트를 찾지 못했습니다.',
      };
      return res.status(404).json(err);
    }

    const sessionToken = createMixpanelSession({
      username: username.trim(),
      secret: secret.trim(),
      projects,
    });

    const response: MixpanelAuthResponse = { sessionToken, projects };
    return res.json(response);
  } catch (error: any) {
    const err: QueryErrorResponse = {
      error: true,
      code: 'MIXPANEL_ERROR',
      message: `Mixpanel 인증 실패: ${error.message}`,
    };
    return res.status(401).json(err);
  }
});

router.post('/mixpanel/logout', (req: Request, res: Response) => {
  const { sessionToken } = req.body as { sessionToken?: string };
  if (sessionToken) {
    deleteMixpanelSession(sessionToken);
  }
  return res.json({ ok: true });
});

export default router;
