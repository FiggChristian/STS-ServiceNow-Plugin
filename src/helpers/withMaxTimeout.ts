import wait from "./wait";

/**
 * Wraps a Promise with a timeout. The returned Promise will reject after a maximum timeout if the
 * wrapped Promise has not resolved or rejected in the specified timeout. The rejection error will
 * be a string indicating the Promise timed out. If the wrapped Promise resolves or rejects before
 * the timeout is met, the wrapped Promise will reflect that result without waiting for the timeout.
 * @param promise The Promise to wrap.
 * @param timeout The number of milliseconds before the Promise times out.
 * @returns A Promise that resolves or rejects based `promise`, or rejects after `timeout`
 *        milliseconds if `promise` hasn't resolved or rejected yet.
 */
export const withMaxTimeout = <T>(
  promise: Promise<T>,
  timeout: number
): Promise<T> => {
  return new Promise((resolve, reject) => {
    let finished = false;
    promise.then(
      (result) => {
        if (!finished) resolve(result);
        finished = true;
      },
      (err) => {
        if (!finished) reject(err);
        finished = true;
      }
    );

    wait(timeout).then(
      () => {
        if (!finished)
          reject(new Error(`Timeout of ${timeout}ms exceeded on Promise.`));
        finished = true;
      },
      (err) => {
        if (!finished) reject(err);
        finished = true;
      }
    );
  });
};

export default withMaxTimeout;
