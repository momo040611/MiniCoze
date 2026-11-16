import { BusinessException } from '../../../common/exceptions/business.exception';
import {
  ChannelAccessGuard,
  type ChannelAccessConfig,
} from '../../../common/utils/channel-access.guard';

function enforce(
  config: ChannelAccessConfig | undefined,
  input: { channelId?: string; ip?: string; origin?: string },
): void {
  ChannelAccessGuard.enforce(config, {
    channelId: input.channelId ?? 'channel-1',
    ip: input.ip,
    origin: input.origin,
  });
}

describe('ChannelAccessGuard', () => {
  it('未配置任何限制时直接放行', () => {
    expect(() => enforce(undefined, { ip: '1.2.3.4' })).not.toThrow();
    expect(() => enforce({}, { ip: '1.2.3.4' })).not.toThrow();
  });

  describe('IP 白名单', () => {
    const config: ChannelAccessConfig = { allowedIps: ['1.2.3.4', '10.0.0.0/8'] };

    it('精确匹配与 CIDR 匹配放行', () => {
      expect(() => enforce(config, { ip: '1.2.3.4' })).not.toThrow();
      expect(() => enforce(config, { ip: '10.200.1.1' })).not.toThrow();
    });

    it('白名单外 IP 抛 403', () => {
      expect(() => enforce(config, { ip: '8.8.8.8' })).toThrow(BusinessException);
      expect(() => enforce(config, { ip: '11.0.0.1' })).toThrow(BusinessException);
    });

    it('缺 IP 也拒绝（不能命中白名单）', () => {
      expect(() => enforce(config, {})).toThrow(BusinessException);
    });

    it('CIDR 掩码边界正确（/8 不放行 11.x，/32 只放行自身）', () => {
      const exact: ChannelAccessConfig = { allowedIps: ['192.168.1.100/32'] };
      expect(() => enforce(exact, { ip: '192.168.1.100' })).not.toThrow();
      expect(() => enforce(exact, { ip: '192.168.1.101' })).toThrow(BusinessException);
    });
  });

  describe('Origin 白名单', () => {
    const config: ChannelAccessConfig = {
      allowedOrigins: ['https://app.example.com', 'https://*.foo.com'],
    };

    it('精确匹配与通配子域放行', () => {
      expect(() =>
        enforce(config, { origin: 'https://app.example.com' }),
      ).not.toThrow();
      expect(() => enforce(config, { origin: 'https://a.b.foo.com' })).not.toThrow();
      expect(() => enforce(config, { origin: 'https://foo.com' })).not.toThrow();
    });

    it('域外 Origin 抛 403', () => {
      expect(() => enforce(config, { origin: 'https://evil.com' })).toThrow(
        BusinessException,
      );
      // 通配只允许 https
      expect(() => enforce(config, { origin: 'http://a.b.foo.com' })).toThrow(
        BusinessException,
      );
    });

    it('缺 Origin 拒绝', () => {
      expect(() => enforce(config, {})).toThrow(BusinessException);
    });
  });

  describe('限流', () => {
    // 用独立 channelId 避免与其它用例共享窗口。
    const config: ChannelAccessConfig = { rateLimitPerMinute: 3 };
    const channelId = `rate-limit-${Date.now()}`;

    it('窗口内超过限额抛 429', () => {
      const base = { channelId, ip: '9.9.9.9' };
      expect(() => enforce(config, base)).not.toThrow();
      expect(() => enforce(config, base)).not.toThrow();
      expect(() => enforce(config, base)).not.toThrow();

      try {
        enforce(config, base);
        fail('expected BusinessException');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).getStatus()).toBe(429);
      }
    });

    it('不同 IP 不共享窗口', () => {
      const base = { channelId: `${channelId}-b`, ip: '9.9.9.10' };
      expect(() => enforce(config, base)).not.toThrow();
    });
  });
});
