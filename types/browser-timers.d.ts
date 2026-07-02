export {};

declare global {
  function setTimeout(handler: TimerHandler, timeout?: number, ...arguments_: unknown[]): number;
  function clearTimeout(handle?: number | null): void;
  function setInterval(handler: TimerHandler, timeout?: number, ...arguments_: unknown[]): number;
  function clearInterval(handle?: number | null): void;
}
