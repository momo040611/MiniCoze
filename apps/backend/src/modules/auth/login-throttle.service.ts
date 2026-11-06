import { HttpStatus, Injectable } from '@nestjs/common';
import { ErrorCode } from '../../common/constants/error-code';
import { BusinessException } from '../../common/exceptions/business.exception';

interface FailureBucket {
  failures: number;
  lockedUntil: number;
  lastHitAt: number;
}

/** 连续失败几次后锁定 */
const MAX_FAILURES = 5;
/** 锁定多久 */
const LOCK_MS = 60_000;
/** 多久没再失败就回收这条记录 */
const IDLE_MS = 10 * 60_000;

/**
 * 登录失败限流（内存版）。
 *
 * 为什么是「(IP, 账号)」两个维度一起？
 * - 只按账号：攻击者能锁死别人的账号（拒绝服务）
 * - 只按 IP：同一个出口 NAT 后面的正常用户会互相牵连
 * 两个一起，攻击者只能锁住「自己 IP + 目标账号」这一格。
 *
 * 局限：进程内存，多实例部署各算各的；重启即清零。
 * 要上生产得换 Redis，或至少加「按账号」的软限制。
 */
@Injectable()
export class LoginThrottleService {
  private readonly buckets = new Map<string, FailureBucket>();

  assertAllowed(key: string): void {
    const bucket = this.buckets.get(key);
    if (!bucket) {
      return;
    }

    const now = Date.now();
    if (bucket.lockedUntil > now) {
      const seconds = Math.ceil((bucket.lockedUntil - now) / 1000);
      throw new BusinessException(
        `登录失败次数过多，请 ${seconds} 秒后再试`,
        ErrorCode.TooManyRequests,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  recordFailure(key: string): void {
    const now = Date.now();
    this.sweep(now);

    const bucket = this.buckets.get(key) ?? {
      failures: 0,
      lockedUntil: 0,
      lastHitAt: now,
    };

    if (bucket.lockedUntil !== 0 && bucket.lockedUntil <= now) {
      bucket.failures = 0;
      bucket.lockedUntil = 0;
    }

    bucket.failures += 1;
    bucket.lastHitAt = now;

    if (bucket.failures >= MAX_FAILURES) {
      bucket.lockedUntil = now + LOCK_MS;
      bucket.failures = 0;
    }

    this.buckets.set(key, bucket);
  }

  recordSuccess(key: string): void {
    this.buckets.delete(key);
  }

  /** Map 不能无限涨，超过 1000 条时清掉过期的 */
  private sweep(now: number): void {
    if (this.buckets.size < 1000) {
      return;
    }

    for (const [key, bucket] of this.buckets) {
      if (bucket.lockedUntil <= now && now - bucket.lastHitAt > IDLE_MS) {
        this.buckets.delete(key);
      }
    }
  }
}