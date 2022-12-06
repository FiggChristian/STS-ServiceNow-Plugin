/**
 * Creates and returns a Promise that waits the specified number of milliseconds.
 * @param ms The number of milliseconds to wait.
 * @returns A Promise that resolves after `ms` milliseconds.
 */
export const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(() => resolve(), ms);
  });

export default wait;
