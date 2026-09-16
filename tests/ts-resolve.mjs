/**
 * 테스트 전용 모듈 리졸버
 *
 * 앱 코드는 번들러 규칙대로 확장자 없이 import 하는데(`./config`),
 * node 의 ESM 로더는 확장자를 요구한다. 테스트에서만 `.ts`/`.tsx`/`index.ts` 를 붙여 재시도한다.
 */
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (!specifier.startsWith('.') && !specifier.startsWith('/')) throw error;
    // 이미 모듈 확장자가 붙어 있으면 재시도하지 않는다
    // ('./words.data' 처럼 확장자가 아닌 점이 들어간 경로도 처리해야 한다)
    if (/\.(m?[jt]sx?|cjs|json)$/.test(specifier)) throw error;

    for (const suffix of ['.ts', '.tsx', '/index.ts']) {
      try {
        return await nextResolve(specifier + suffix, context);
      } catch {
        // 다음 후보 시도
      }
    }
    throw error;
  }
}
