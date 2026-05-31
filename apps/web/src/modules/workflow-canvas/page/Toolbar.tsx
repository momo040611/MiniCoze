import { useState } from 'react'
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
} from '@ant-design/icons'
import { Dropdown, Popover } from 'antd'
import { useClientContext } from '@flowgram.ai/free-layout-editor'
import NodeSelectorPanel from '../components/NodeSelectorPanel'
import { Tooltip } from '../components/Tooltip'
import styles from './Toolbar.module.css'

const exportItems = [
  { key: 'png', label: '导出为 PNG' },
  { key: 'jpeg', label: '导出为 JPEG' },
  { key: 'svg', label: '导出为 SVG' },
]

const scaleItems = [
  { key: 'zoomOut', label: '缩小' },
  { key: 'zoomIn', label: '放大' },
  { key: 'fit', label: '自适应' },
  { type: 'divider' as const },
  { key: '50', label: '缩放到 50%' },
  { key: '100', label: '缩放到 100%' },
  { key: '150', label: '缩放到 150%' },
  { key: '200', label: '缩放到 200%' },
]

interface ToolbarProps {
  onAddNode?: (type: string) => void
}

const handleExportClick = ({ key }: { key: string }) => {
  console.log(`导出为 ${key}`)
}

const getDefaultNodeData = (type: string) => {
  if (type === 'input') {
    return {
      nodeMeta: { title: '输入' },
      outputs: [{ label: '输出', type: 'string', name: 'query' }],
    }
  }

  if (type === 'output') {
    return {
      nodeMeta: { title: '输出' },
      inputs: [{ label: '输入', type: 'string', name: 'content' }],
      config: { outputMode: '返回变量' },
    }
  }

  if (type === 'llm') {
    return {
      nodeMeta: { title: '大模型节点' },
      inputs: [{ label: '输入', type: 'string', name: 'query' }],
      outputs: [{ label: '输出', type: 'string', name: 'content' }],
      config: {
        model: 'deepseek-chat',
        systemPrompt: '你是一个简洁的助手',
        prompt: '用一句话欢迎新用户',
      },
    }
  }

  return {
    nodeMeta: { title: type },
    inputs: [],
    outputs: [],
    config: {},
  }
}

function Toolbar({ onAddNode }: ToolbarProps) {
  const [scale, setScale] = useState(75)
  const ctx = useClientContext()

  const handleScaleClick = ({ key }: { key: string }) => {
    if (key === '50') {
      setScale(50)
    } else if (key === '100') {
      setScale(100)
    } else if (key === '150') {
      setScale(150)
    } else if (key === '200') {
      setScale(200)
    } else if (key === 'zoomOut') {
      setScale((prev) => Math.max(50, prev - 10))
    } else if (key === 'zoomIn') {
      setScale((prev) => Math.min(200, prev + 10))
    } else if (key === 'fit') {
      setScale(85)
    }
  }

  const handleAddNode = (type: string) => {
    onAddNode?.(type)

    ctx.document.createWorkflowNodeByType(
      type,
      { x: 200, y: 200 },
      {
        id: `${type}_${Date.now()}`,
        data: getDefaultNodeData(type),
      },
    )
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
            <button className={styles.buttonStyles}>
              <MessageOutlined style={{ fontSize: 16 }} />
            </button>
          </div>
        </Tooltip>

        <Tooltip text="布局优化" position="top">
          <div>
            <button className={styles.buttonStyles}>
              <AppstoreOutlined style={{ fontSize: 16 }} />
            </button>
          </div>
        </Tooltip>

        <Dropdown
          menu={{ items: exportItems, onClick: handleExportClick }}
          trigger={['click']}
          placement="topLeft"
          align={{ offset: [0, -8] }}
        >
          <div>
            <Tooltip text="导出图片" position="top">
              <div>
                <button className={styles.buttonStyles}>
                  <PictureOutlined style={{ fontSize: 16 }} />
                </button>
              </div>
            </Tooltip>
          </div>
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
          <button>
            <PlayCircleOutlined style={{ fontSize: 14 }} />
            <span>试运行</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default Toolbar