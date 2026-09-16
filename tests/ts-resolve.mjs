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
    if (/\.[a-zA-Z]+$/.test(specifier)) throw error;

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
