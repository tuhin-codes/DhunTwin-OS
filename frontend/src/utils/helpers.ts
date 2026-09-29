/**
 * Returns a greeting message.
 * @param name - The name to greet. Defaults to "world".
 */
export function hello(name: string = "world"): string {
  return `Hello, ${name}!`;
}
