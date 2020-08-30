// Type definitions for crontab
// Project: crontab
// Definitions by: Werner Robitza

declare namespace crontab {
  type CrontabCallback = (error: Error | null, crontab: CronTab) => void;

  function load(user: string, callback: CrontabCallback): void;
  function load(callback: CrontabCallback): void;

  class CronTab {
    jobs(options?: {
      command?: string | RegExp;
      comment?: string | RegExp;
    }): CronJob[];
    find(options?: {
      command?: string | RegExp;
      comment?: string | RegExp;
    }): CronJob[];
    vars(
      options: string | { name?: string | RegExp; val?: string | RegExp }
    ): CronVar[];
    save(callback?: CrontabCallback): void;
    render(): string;
    create(
      command: string,
      when?: string | Date | null,
      comment?: string | RegExp
    ): CronJob | null;
    parse(line: string): CronJob;
    remove(jobs: string[]): void;
    remove(job: CronJob): void;
    remove(options: {
      command?: string | RegExp;
      comment?: string | RegExp;
    }): void;
    reset(): void;
    load(callback?: CrontabCallback): void;
  }

  class CronVar {
    constructor(line: string);
    isValid(): boolean;
    render(): string;
    name(): string;
    val(): string;
    toString(): string;
  }

  class CronJob {
    constructor(
      line: string | null,
      command?: string | RegExp,
      comment?: string | RegExp
    );
    isValid(): boolean;
    render(): string;
    clear(): void;
    minute(): TimeSlot;
    hour(): TimeSlot;
    dom(): TimeSlot;
    month(): TimeSlot;
    dow(): TimeSlot;
    command(c?: string): string;
    comment(c?: string): string;
    toString(): string;
  }

  class TimeSlot {
    constructor(
      name: string,
      min: number,
      max: number,
      enumm?: object | null,
      value?: string | null
    );
    getMin(): number;
    getMax(): number;
    getEnum(): object;
    render(): string;
    every(n: number): TimeRange;
    on(...value: number[]): TimeRange;
    between(from: number, to: number): TimeRange | null;
    clear(): void;
    toString(): string;
  }

  class TimeRange {
    constructor(s: TimeSlot, range: string);
    render(): string;
    every(value: number): void;
    toString(): string;
  }
}

export = crontab;
