/**
 * In-process upload queue for standard (shared) storage under load.
 */
type Job<T> = () => Promise<T>;

class UploadQueue {
  private readonly concurrency: number;
  private running = 0;
  private readonly waiting: Array<{
    job: Job<unknown>;
    resolve: (v: unknown) => void;
    reject: (e: unknown) => void;
  }> = [];

  constructor(concurrency = 2) {
    this.concurrency = Math.max(1, concurrency);
  }

  enqueue<T>(job: Job<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.waiting.push({
        job: job as Job<unknown>,
        resolve: resolve as (v: unknown) => void,
        reject,
      });
      this.pump();
    });
  }

  getStats() {
    return {
      running: this.running,
      waiting: this.waiting.length,
      concurrency: this.concurrency,
    };
  }

  private pump() {
    while (this.running < this.concurrency && this.waiting.length > 0) {
      const next = this.waiting.shift()!;
      this.running++;
      next
        .job()
        .then(next.resolve)
        .catch(next.reject)
        .finally(() => {
          this.running--;
          this.pump();
        });
    }
  }
}

const concurrency = parseInt(process.env.STANDARD_UPLOAD_CONCURRENCY || '2', 10);

export const standardUploadQueue = new UploadQueue(concurrency);
