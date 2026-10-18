/** 会员登录账号：导入后自动建立（ADMIN+），以及 Fix Auth 试跑 / 执行补建（仅 SUPER_ADMIN）。 */
import { useCallback, useState } from 'react';
import { MemberAuthService, MemberAuthResponse, MemberAuthResult, FixAuthOptions } from '../services/memberAuthService';

export function useMemberAuth() {
  const [running, setRunning] = useState(false);
  const [processed, setProcessed] = useState(0);
  const [result, setResult] = useState<MemberAuthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runFix = useCallback(async (options: FixAuthOptions) => {
    setRunning(true);
    setProcessed(0);
    setError(null);
    try {
      const res = await MemberAuthService.fixAll(options, setProcessed);
      setResult(res);
      return res;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      setRunning(false);
    }
  }, []);

  const resetFix = useCallback(() => { setResult(null); setError(null); setProcessed(0); }, []);

  const createForMembers = useCallback(
    (memberIds: string[]): Promise<MemberAuthResult[]> => MemberAuthService.createForMembers(memberIds),
    []
  );

  return { runFix, resetFix, running, processed, result, error, createForMembers };
}
