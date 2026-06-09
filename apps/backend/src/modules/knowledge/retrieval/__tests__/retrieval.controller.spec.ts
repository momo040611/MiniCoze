import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RetrieveRequestDto } from '../dto/retrieve-request.dto';
import { RetrievalController } from '../retrieval.controller';
import type { RetrievalService } from '../retrieval.service';
import type { CurrentUser } from '../../../../shared/types/current-user.type';

const user: CurrentUser = { id: 'u1', email: 'u1@x.com', username: 'u1' };

describe('RetrievalController', () => {
  let service: {
    search: jest.Mock;
    reindexKnowledgeBase: jest.Mock;
  };
  let controller: RetrievalController;

  beforeEach(() => {
    service = {
      search: jest.fn().mockResolvedValue([
        {
          chunkId: 'c1',
          knowledgeBaseId: 'kb1',
          documentId: 'd1',
          documentName: 'doc.md',
          index: 0,
          content: 'hello',
          score: 0.9,
        },
      ]),
      reindexKnowledgeBase: jest.fn().mockResolvedValue({
        knowledgeBaseId: 'kb1',
        processed: 3,
        skipped: 1,
        failed: 0,
      }),
    };
    controller = new RetrievalController(
      service as unknown as RetrievalService,
    );
  });

  describe('retrieve', () => {
    it('happy path: 透传 dto 到 service.search 并包装 results', async () => {
      const dto = plainToInstance(RetrieveRequestDto, {
        knowledgeBaseIds: ['kb1', 'kb2'],
        query: 'hello',
        topK: 8,
        minScore: 0.3,
      });
      const out = await controller.retrieve(user, dto);

      expect(service.search).toHaveBeenCalledWith('u1', {
        knowledgeBaseIds: ['kb1', 'kb2'],
        query: 'hello',
        topK: 8,
        minScore: 0.3,
      });
      expect(out.results).toHaveLength(1);
      expect(out.results[0].score).toBe(0.9);
    });
  });

  describe('reindex', () => {
    it('force=undefined → service 收到 false', async () => {
      await controller.reindex(user, 'kb1', undefined);
      expect(service.reindexKnowledgeBase).toHaveBeenCalledWith(
        'u1',
        'kb1',
        false,
      );
    });

    it('force="true" → true', async () => {
      await controller.reindex(user, 'kb1', 'true');
      expect(service.reindexKnowledgeBase).toHaveBeenCalledWith(
        'u1',
        'kb1',
        true,
      );
    });

    it('force="1" → true', async () => {
      await controller.reindex(user, 'kb1', '1');
      expect(service.reindexKnowledgeBase).toHaveBeenCalledWith(
        'u1',
        'kb1',
        true,
      );
    });

    it('force="false" → false', async () => {
      await controller.reindex(user, 'kb1', 'false');
      expect(service.reindexKnowledgeBase).toHaveBeenCalledWith(
        'u1',
        'kb1',
        false,
      );
    });

    it('force="0" → false（不视作真值）', async () => {
      await controller.reindex(user, 'kb1', '0');
      expect(service.reindexKnowledgeBase).toHaveBeenCalledWith(
        'u1',
        'kb1',
        false,
      );
    });

    it('返回 service 计数原样', async () => {
      const out = await controller.reindex(user, 'kb1', 'true');
      expect(out).toEqual({
        knowledgeBaseId: 'kb1',
        processed: 3,
        skipped: 1,
        failed: 0,
      });
    });
  });

  describe('RetrieveRequestDto 校验', () => {
    const buildDto = (overrides: Partial<Record<string, unknown>> = {}) =>
      plainToInstance(RetrieveRequestDto, {
        knowledgeBaseIds: ['kb1'],
        query: 'q',
        topK: 5,
        minScore: 0,
        ...overrides,
      });

    it('合法入参 → 无错误', async () => {
      const errors = await validate(buildDto());
      expect(errors).toHaveLength(0);
    });

    it('knowledgeBaseIds=[] → 校验失败', async () => {
      const errors = await validate(buildDto({ knowledgeBaseIds: [] }));
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('knowledgeBaseIds');
    });

    it('query="" → 校验失败', async () => {
      const errors = await validate(buildDto({ query: '' }));
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'query')).toBe(true);
    });

    it('topK=100 → 校验失败（>Max=50）', async () => {
      const errors = await validate(buildDto({ topK: 100 }));
      expect(errors.some((e) => e.property === 'topK')).toBe(true);
    });

    it('topK=0 → 校验失败（<Min=1）', async () => {
      const errors = await validate(buildDto({ topK: 0 }));
      expect(errors.some((e) => e.property === 'topK')).toBe(true);
    });

    it('minScore=2 → 校验失败（>Max=1）', async () => {
      const errors = await validate(buildDto({ minScore: 2 }));
      expect(errors.some((e) => e.property === 'minScore')).toBe(true);
    });

    it('minScore=-2 → 校验失败（<Min=-1）', async () => {
      const errors = await validate(buildDto({ minScore: -2 }));
      expect(errors.some((e) => e.property === 'minScore')).toBe(true);
    });

    it('topK / minScore 缺省 → 取默认 5 / 0', async () => {
      const dto = plainToInstance(RetrieveRequestDto, {
        knowledgeBaseIds: ['kb1'],
        query: 'q',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.topK).toBe(5);
      expect(dto.minScore).toBe(0);
    });

    it('knowledgeBaseIds 含非 string → 校验失败', async () => {
      const errors = await validate(
        plainToInstance(RetrieveRequestDto, {
          knowledgeBaseIds: [1, 2],
          query: 'q',
        }),
      );
      expect(errors.some((e) => e.property === 'knowledgeBaseIds')).toBe(true);
    });
  });
});
