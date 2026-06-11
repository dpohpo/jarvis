/**
 * At-least-once delivery with replay suppression.
 *
 * Both ends number their outgoing `msg` payloads with a monotonic seq.
 * - Outbox: buffer until acked; on peer reconnect (`hello.resumeFrom`), replay everything after.
 * - Inbox: accept(seq) is true exactly once per seq, so duplicates from
 *   relay-queue + replay overlap collapse harmlessly.
 */
export class Outbox<T> {
  private buf: Array<{ seq: number; item: T }> = [];
  private nextSeq: number;

  /** `startAfter`: highest seq already used by this sender (persist it across restarts!). */
  constructor(startAfter = 0) {
    this.nextSeq = startAfter + 1;
  }

  /** Assigns and returns the seq for this item. */
  add(item: T): number {
    const seq = this.nextSeq++;
    this.buf.push({ seq, item });
    return seq;
  }

  ackUpTo(seq: number): void {
    this.buf = this.buf.filter((e) => e.seq > seq);
  }

  /** Everything after `seq`, in order — what a reconnecting peer is missing. */
  since(seq: number): Array<{ seq: number; item: T }> {
    return this.buf.filter((e) => e.seq > seq);
  }

  get lastSeq(): number {
    return this.nextSeq - 1;
  }

  get pending(): number {
    return this.buf.length;
  }
}

export class Inbox {
  private highest = 0;
  private gaps = new Set<number>();

  /** True if this seq has not been seen before (i.e. process it). */
  accept(seq: number): boolean {
    if (seq <= 0) return false;
    if (seq > this.highest) {
      for (let s = this.highest + 1; s < seq; s++) this.gaps.add(s);
      this.highest = seq;
      return true;
    }
    return this.gaps.delete(seq);
  }

  /** Highest contiguous seq fully received — safe value to ack / resume from. */
  get ackValue(): number {
    if (this.gaps.size === 0) return this.highest;
    return Math.min(...this.gaps) - 1;
  }
}
