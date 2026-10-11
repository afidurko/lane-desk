export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    let rest = specifier.slice(2);
    if (!/\.[a-z]+$/i.test(rest)) rest += ".ts";
    const url = new URL(`../src/${rest}`, import.meta.url).href;
    return nextResolve(url, context);
  }
  return nextResolve(specifier, context);
}
