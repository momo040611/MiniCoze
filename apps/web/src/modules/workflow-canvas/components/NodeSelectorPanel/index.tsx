import { Input } from 'antd'
import styles from './index.module.css'
import {
    RobotOutlined,
    ApiOutlined,
    BranchesOutlined,
    CodeOutlined,
    DatabaseOutlined,
    SearchOutlined,
    ImportOutlined,
    ExportOutlined,
    EditOutlined,
    FileSearchOutlined
} from '@ant-design/icons'
type NodeType = 'llm' | 'plugin' | 'workflow' | 'code' | 'selector' | 'database' | 'input' | 'output' | 'knowledgeWrite' | 'knowledgeSearch'
interface NodeSelectorPanelProps {
    onAddNode: (type: NodeType) => void
}

const nodeGroups = [
    {
        title: '常用',
        items: [
            { label: '大模型', type: 'llm', icon: <RobotOutlined /> },
            { label: '插件', type: 'plugin', icon: <ApiOutlined /> },
            { label: '工作流', type: 'workflow', icon: <BranchesOutlined /> }
        ],
    },
    {
        title: '业务逻辑',
        items: [
            { label: '代码', type: 'code', icon: <CodeOutlined /> },
            { label: '选择器', type: 'selector', icon: <BranchesOutlined /> },
        ]
    },
    {
        title: '输入&输出',
        items: [
            { label: '输入', type: 'input', icon: <ImportOutlined /> },
            { label: '输出', type: 'output', icon: <ExportOutlined /> }
        ]
    },
    {
        title: '数据库',
        items: [
            { label: '数据库', type: 'database', icon: <DatabaseOutlined /> }
        ]
    },
    {
        title: '知识库&数据',
        items: [
            { label: '知识库写入', type: 'knowledgeWrite', icon: <EditOutlined /> },
            { label: '知识库检索', type: 'knowledgeSearch', icon: < FileSearchOutlined /> }
        ]
    }
] as const

export default function NodeSelectorPanel({ onAddNode }: NodeSelectorPanelProps) {
    return (
        <div className={styles.panel}>
            <Input
                prefix={<SearchOutlined />}
                placeholder="搜索节点、插件、工作流"
                className={styles.search}
            />

            {nodeGroups.map((group) => (
                <div key={group.title} className={styles.group}>
                    <div className={styles.groupTitle}>{group.title}</div>

                    <div className={styles.grid}>
                        {group.items.map((item) => (
                            <div
                                key={item.type}
                                className={styles.nodeItem}
                                onClick={() => onAddNode(item.type)}
                            >
                                <span className={styles.icon}>{item.icon}</span>
                                <span>{item.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}