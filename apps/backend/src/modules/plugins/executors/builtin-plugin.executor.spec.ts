import { BuiltinPluginExecutor } from './builtin-plugin.executor';
import { BingWebSearchClient } from '../builtin/bing-web-search.client';
import { ImageUnderstandingClient } from '../builtin/image-understanding.client';

describe('BuiltinPluginExecutor', () => {
  const searchWebpages = jest.fn();
  const summarizePage = jest.fn();
  const pagedSearch = jest.fn();
  const bingWebSearchClient = {
    searchWebpages,
    summarizePage,
    pagedSearch,
  } as unknown as jest.Mocked<BingWebSearchClient>;
  const extractOcrText = jest.fn();
  const analyzeScreenshot = jest.fn();
  const analyzeChartData = jest.fn();
  const describeScene = jest.fn();
  const imageUnderstandingClient = {
    extractOcrText,
    analyzeScreenshot,
    analyzeChartData,
    describeScene,
  } as unknown as jest.Mocked<ImageUnderstandingClient>;

  let executor: BuiltinPluginExecutor;

  beforeEach(() => {
    jest.clearAllMocks();
    executor = new BuiltinPluginExecutor(
      bingWebSearchClient,
      imageUnderstandingClient,
    );
  });

  it('delegates web search to Bing client', async () => {
    searchWebpages.mockResolvedValue({
      results: [{ title: 'NestJS' }],
    });

    const result = await executor.execute({
      functionName: 'bing_web_search__web_search',
      toolCode: 'web_search',
      handlerKey: 'bing_web_search',
      args: {
        query: 'nestjs latest docs',
        count: 5,
        mkt: 'zh-CN',
        freshness: 'Week',
        safeSearch: 'Moderate',
      },
    });

    expect(searchWebpages).toHaveBeenCalledWith({
      query: 'nestjs latest docs',
      count: 5,
      mkt: 'zh-CN',
      freshness: 'Week',
      safeSearch: 'Moderate',
    });
    expect(result).toEqual({
      results: [{ title: 'NestJS' }],
    });
  });

  it('delegates page summary to Bing client', async () => {
    summarizePage.mockResolvedValue({
      title: 'MiniCoze',
    });

    const result = await executor.execute({
      functionName: 'bing_web_search__page_summary',
      toolCode: 'page_summary',
      handlerKey: 'bing_page_summary',
      args: {
        url: 'https://example.com',
        maxChars: 800,
      },
    });

    expect(summarizePage).toHaveBeenCalledWith({
      url: 'https://example.com',
      maxChars: 800,
    });
    expect(result).toEqual({
      title: 'MiniCoze',
    });
  });

  it('delegates paged search to Bing client', async () => {
    pagedSearch.mockResolvedValue({
      page: 2,
      hasMore: true,
    });

    const result = await executor.execute({
      functionName: 'bing_web_search__paged_search',
      toolCode: 'paged_search',
      handlerKey: 'bing_paged_search',
      args: {
        query: 'ai agent news',
        page: 2,
        pageSize: 20,
      },
    });

    expect(pagedSearch).toHaveBeenCalledWith({
      query: 'ai agent news',
      page: 2,
      pageSize: 20,
      mkt: undefined,
      freshness: undefined,
      safeSearch: undefined,
    });
    expect(result).toEqual({
      page: 2,
      hasMore: true,
    });
  });

  it('delegates image ocr to image understanding client', async () => {
    extractOcrText.mockResolvedValue({
      text: 'console.log("hello");',
    });

    const context = {
      userId: 'user-id',
    };

    const result = await executor.execute({
      functionName: 'image_understanding__image_ocr',
      toolCode: 'image_ocr',
      handlerKey: 'image_ocr',
      args: {
        fileId: 'file-id',
        question: '识别代码',
      },
      context: context as never,
    });

    expect(extractOcrText).toHaveBeenCalledWith(
      {
        imageUrl: undefined,
        fileId: 'file-id',
        detail: undefined,
        question: '识别代码',
      },
      context,
    );
    expect(result).toEqual({
      text: 'console.log("hello");',
    });
  });

  it('delegates chart analysis to image understanding client', async () => {
    analyzeChartData.mockResolvedValue({
      chartType: 'bar',
    });

    const result = await executor.execute({
      functionName: 'image_understanding__chart_data_analysis',
      toolCode: 'chart_data_analysis',
      handlerKey: 'chart_data_analysis',
      args: {
        imageUrl: 'https://example.com/chart.png',
        detail: 'high',
      },
    });

    expect(analyzeChartData).toHaveBeenCalledWith(
      {
        imageUrl: 'https://example.com/chart.png',
        fileId: undefined,
        detail: 'high',
        question: undefined,
      },
      undefined,
    );
    expect(result).toEqual({
      chartType: 'bar',
    });
  });
});
