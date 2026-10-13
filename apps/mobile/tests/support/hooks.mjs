const src = new URL('../../src/', import.meta.url);
const stubs = {
  css: 'export {};',
  'react-native': 'export const Platform = { OS: "test", select: (options) => options.default };',
};

export async function resolve(specifier, context, next) {
  if (specifier === 'react-native') return { url: 'stub:react-native', shortCircuit: true };
  if (specifier.endsWith('.css')) return { url: 'stub:css', shortCircuit: true };
  if (specifier.startsWith('@/')) {
    const url = new URL(specifier.slice(2), src).href;
    for (const candidate of [url, `${url}.ts`, `${url}.tsx`]) {
      try {
        return await next(candidate, context);
      } catch {}
    }
  }
  return next(specifier, context);
}

export async function load(url, context, next) {
  if (url.startsWith('stub:')) {
    return { format: 'module', source: stubs[url.slice(5)], shortCircuit: true };
  }
  return next(url, context);
}
