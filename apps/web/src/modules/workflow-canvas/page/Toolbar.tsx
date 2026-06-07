import { useMemo, useState } from 'react';
import {
  AimOutlined,
  AppstoreOutlined,
  DownOutlined,
  EditOutlined,
  MessageOutlined,
  PictureOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { Dropdown, Popover, message } from 'antd';
import type { MenuProps } from 'antd';
import {
  useAutoLayout,
  useClientContext,
  usePlaygroundTools,
} from '@flowgram.ai/free-layout-editor';
import type { WorkflowCanvasData } from '../../../api/workflows';
import NodeSelectorPanel from '../components/NodeSelectorPanel';
import { Tooltip } from '../components/Tooltip';
import styles from './Toolbar.module.css';

const exportItems: MenuProps['items'] = [
  { key: 'png', label: '导出为 PNG' },
  { key: 'jpeg', label: '导出为 JPEG' },
  { key: 'svg', label: '导出为 SVG' },
];

const scaleItems: MenuProps['items'] = [
  { key: 'zoomOut', label: '缩小' },
  { key: 'zoomIn', label: '放大' },
  { key: 'fit', label: '自适应' },
  { type: 'divider' },
  { key: '50', label: '缩放到 50%' },
  { key: '100', label: '缩放到 100%' },
  { key: '150', label: '缩放到 150%' },
  { key: '200', label: '缩放到 200%' },
];

const RASTER_EXPORT_TIMEOUT = 10000;

interface ToolbarProps {
  onAddNode?: (type: string) => void;
  onRunTest?: (canvasData: WorkflowCanvasData) => boolean;
}

type PlaygroundContextWithZoom = {
  playground?: {
    config?: {
      updateZoom?: (zoom: number, easing?: boolean, easingDuration?: number) => void;
    };
  };
};

function getDefaultNodeData(type: string) {
  if (type === 'input') {
    return {
      nodeMeta: { title: '输入' },
      outputs: [{ label: '输出', type: 'string', name: 'query' }],
    };
  }

  if (type === 'output') {
    return {
      nodeMeta: { title: '输出' },
      inputs: [{ label: '输入', type: 'string', name: 'content' }],
      config: { outputMode: '返回变量' },
    };
  }

  if (type === 'llm') {
    return {
      nodeMeta: { title: '大模型节点' },
      inputs: [{ label: '输入', type: 'string', name: 'query' }],
      outputs: [{ label: '输出', type: 'string', name: 'content' }],
      config: {
        model: 'deepseek-chat',
        temperature: 0.7,
        systemPrompt: '你是一个简洁、可靠的助手。',
        prompt: '请回答用户问题：{{input.query}}',
      },
    };
  }

  if (type === 'condition') {
    return {
      nodeMeta: { title: '条件节点' },
      inputs: [{ label: '输入', type: 'string', name: 'value' }],
      outputs: [
        { label: '是', type: 'boolean', name: 'trueBranch' },
        { label: '否', type: 'boolean', name: 'falseBranch' },
      ],
      config: {
        operator: 'equals',
        compareValue: '',
        expression: '',
      },
    };
  }

  if (type === 'plugin') {
    return {
      nodeMeta: { title: '插件节点' },
      inputs: [{ label: '入参', type: 'object', name: 'payload' }],
      outputs: [{ label: '结果', type: 'object', name: 'result' }],
      config: {
        pluginId: '',
        action: '',
        timeout: 30,
      },
    };
  }

  if (type === 'database') {
    return {
      nodeMeta: { title: '数据库节点' },
      inputs: [{ label: '查询参数', type: 'object', name: 'params' }],
      outputs: [{ label: '查询结果', type: 'array', name: 'rows' }],
      config: {
        source: '',
        query: '',
        readonly: true,
      },
    };
  }

  if (type === 'annotation') {
    return {
      nodeMeta: {
        title: '注释',
        description: '',
      },
      inputs: [],
      outputs: [],
      config: {},
    };
  }

  return {
    nodeMeta: { title: type },
    inputs: [{ label: '输入', type: 'string', name: 'input' }],
    outputs: [{ label: '输出', type: 'string', name: 'output' }],
    config: {},
  };
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function inlineComputedStyles(source: Element, target: Element) {
  const computedStyle = window.getComputedStyle(source);

  Array.from(computedStyle).forEach((name) => {
    target.setAttribute(
      'style',
      `${target.getAttribute('style') ?? ''}${name}:${computedStyle.getPropertyValue(name)};`,
    );
  });

  Array.from(source.children).forEach((sourceChild, index) => {
    const targetChild = target.children.item(index);

    if (targetChild) {
      inlineComputedStyles(sourceChild, targetChild);
    }
  });
}

function getCanvasExportTarget() {
  return (
    document.querySelector<HTMLElement>('[data-workflow-export-target="true"]') ??
    document.querySelector<HTMLElement>('.gedit-playground') ??
    document.querySelector<HTMLElement>('[class*="canvasArea"]')
  );
}

function buildSvgFromElement(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const width = Math.max(1, Math.ceil(rect.width));
  const height = Math.max(1, Math.ceil(rect.height));
  const clone = element.cloneNode(true) as HTMLElement;

  inlineComputedStyles(element, clone);
  clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  clone.style.margin = '0';

  const html = new XMLSerializer().serializeToString(clone);
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<foreignObject width="100%" height="100%">${html}</foreignObject>`,
    '</svg>',
  ].join('');

  return { svg, width, height };
}

function svgToRasterBlob(svg: string, width: number, height: number, type: 'image/png' | 'image/jpeg') {
  return new Promise<Blob>((resolve, reject) => {
    const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const image = new Image();
    let settled = false;

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      URL.revokeObjectURL(url);
    };

    const finish = (callback: () => void) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      callback();
    };

    const timeoutId = window.setTimeout(() => {
      finish(() => {
        reject(new Error('图片导出超时，请尝试导出 SVG 或缩小画布后重试'));
      });
    }, RASTER_EXPORT_TIMEOUT);

    image.onload = () => {
      const canvas = document.createElement('canvas');
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = width * pixelRatio;
      canvas.height = height * pixelRatio;

      const context = canvas.getContext('2d');

      if (!context) {
        finish(() => {
          reject(new Error('无法创建导出画布'));
        });
        return;
      }

      context.fillStyle = '#f3f4f8';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.scale(pixelRatio, pixelRatio);
      context.drawImage(image, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            finish(() => {
              resolve(blob);
            });
          } else {
            finish(() => {
              reject(new Error('图片生成失败'));
            });
          }
        },
        type,
        type === 'image/jpeg' ? 0.92 : undefined,
      );
    };

    image.onerror = () => {
      finish(() => {
        reject(new Error('图片渲染失败，请尝试导出 SVG'));
      });
    };

    image.src = url;
  });
}

async function exportCanvasImage(format: 'png' | 'jpeg' | 'svg') {
  const target = getCanvasExportTarget();

  if (!target) {
    message.warning('没有找到可导出的画布区域');
    return;
  }

  const { svg, width, height } = buildSvgFromElement(target);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  message.loading({ content: '正在导出图片...', key: 'workflow-export', duration: 0 });

  if (format === 'svg') {
    downloadBlob(
      new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }),
      `workflow-canvas-${timestamp}.svg`,
    );
    message.success({ content: 'SVG 导出成功', key: 'workflow-export' });
    return;
  }

  const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
  const blob = await svgToRasterBlob(svg, width, height, mimeType);

  downloadBlob(blob, `workflow-canvas-${timestamp}.${format}`);
  message.success({ content: `${format.toUpperCase()} 导出成功`, key: 'workflow-export' });
}

function Toolbar({ onAddNode, onRunTest }: ToolbarProps) {
  const ctx = useClientContext();
  const autoLayout = useAutoLayout();
  const [isLayouting, setIsLayouting] = useState(false);
  const playgroundTools = usePlaygroundTools({
    minZoom: 0.5,
    maxZoom: 2,
  });
  const scale = useMemo(() => Math.round(playgroundTools.zoom * 100), [playgroundTools.zoom]);

  function setCanvasZoom(percent: number) {
    const zoom = percent / 100;
    const playground = (ctx as unknown as PlaygroundContextWithZoom).playground;

    playground?.config?.updateZoom?.(zoom, true, 200);
  }

  async function handleExportClick({ key }: { key: string }) {
    try {
      await exportCanvasImage(key as 'png' | 'jpeg' | 'svg');
    } catch (error) {
      console.error(error);
      message.error({
        content: error instanceof Error ? error.message : '导出失败，请稍后重试',
        key: 'workflow-export',
      });
    }
  }

  function handleScaleClick({ key }: { key: string }) {
    if (key === 'zoomOut') {
      playgroundTools.zoomout(true);
      return;
    }

    if (key === 'zoomIn') {
      playgroundTools.zoomin(true);
      return;
    }

    if (key === 'fit') {
      playgroundTools.fitView(true);
      return;
    }

    if (key === '50' || key === '100' || key === '150' || key === '200') {
      setCanvasZoom(Number(key));
    }
  }

  function handleAddNode(type: string) {
    onAddNode?.(type);

    ctx.document.createWorkflowNodeByType(
      type,
      { x: 200, y: 200 },
      {
        id: `${type}_${Date.now()}`,
        data: getDefaultNodeData(type),
      },
    );
  }

  function handleAddAnnotation() {
    handleAddNode('annotation');
  }

  async function handleOptimizeLayout() {
    if (isLayouting) {
      return;
    }

    const canvasData = ctx.document.toJSON() as WorkflowCanvasData;

    if ((canvasData.nodes?.length ?? 0) <= 1) {
      message.info('No nodes need layout optimization');
      return;
    }

    setIsLayouting(true);
    message.loading({ content: 'Optimizing workflow layout...', key: 'workflow-layout', duration: 0 });

    try {
      await autoLayout({
        enableAnimation: true,
        animationDuration: 300,
        alignTopEdge: true,
        layoutConfig: {
          rankdir: 'LR',
          nodesep: 80,
          ranksep: 140,
        },
      });
      message.success({ content: 'Workflow layout optimized', key: 'workflow-layout' });
    } catch (error) {
      console.error(error);
      message.error({
        content: error instanceof Error ? error.message : 'Layout optimization failed',
        key: 'workflow-layout',
      });
    } finally {
      setIsLayouting(false);
    }
  }

  function handleRunTest() {
    const canvasData = ctx.document.toJSON() as WorkflowCanvasData;
    const canRun = onRunTest?.(canvasData) ?? true;

    if (canRun) {
      message.success('节点配置校验通过，可以继续运行流程');
    }
  }

  return (
    <div>
      <div className={styles.tool}>
        <Tooltip text="鼠标友好模式" position="top">
          <div className={styles.MouseModeSwitch}>
            <AimOutlined style={{ fontSize: 16 }} />
            <DownOutlined style={{ fontSize: 16 }} />
          </div>
        </Tooltip>

        <Dropdown
          menu={{ items: scaleItems, onClick: handleScaleClick }}
          trigger={['click']}
          placement="top"
          align={{ offset: [0, -8] }}
        >
          <div className={styles.ViewScaleControl}>
            <p>{scale}%</p>
            <DownOutlined style={{ fontSize: 16 }} />
          </div>
        </Dropdown>

        <Tooltip text="注释" position="top">
          <div>
            <button className={styles.buttonStyles} type="button" onClick={handleAddAnnotation}>
              <MessageOutlined style={{ fontSize: 16 }} />
            </button>
          </div>
        </Tooltip>

        <Tooltip text="布局优化" position="top">
          <div>
            <button
              className={styles.buttonStyles}
              type="button"
              disabled={isLayouting}
              onClick={handleOptimizeLayout}
            >
              <AppstoreOutlined style={{ fontSize: 16 }} />
            </button>
          </div>
        </Tooltip>

        <Dropdown
          menu={{ items: exportItems, onClick: handleExportClick }}
          trigger={['click']}
          placement="topLeft"
          align={{ offset: [0, -8] }}
          overlayClassName={styles.exportDropdown}
        >
          <button className={styles.buttonStyles} type="button" title="导出图片">
            <PictureOutlined style={{ fontSize: 16 }} />
          </button>
        </Dropdown>

        <Tooltip text="缩略图" position="top">
          <div>
            <button className={styles.buttonStyles}>
              <EditOutlined style={{ fontSize: 16 }} />
            </button>
          </div>
        </Tooltip>

        <Popover
          content={<NodeSelectorPanel onAddNode={handleAddNode} />}
          trigger="click"
          placement="top"
          arrow={false}
        >
          <div className={styles.AddNodeButton}>
            <button>
              <PlusOutlined style={{ fontSize: 16 }} />
              <span>添加节点</span>
            </button>
          </div>
        </Popover>
      </div>

      <div className={styles.run}>
        <Tooltip text="调试" position="top">
          <div>
            <button>
              <ToolOutlined style={{ fontSize: 14 }} />
            </button>
          </div>
        </Tooltip>

        <div className={styles.RunTest}>
          <button type="button" onClick={handleRunTest}>
            <PlayCircleOutlined style={{ fontSize: 14 }} />
            <span>试运行</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default Toolbar;
