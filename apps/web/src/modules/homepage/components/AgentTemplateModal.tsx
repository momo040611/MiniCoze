import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, Card, Row, Col, Typography, Tag, Avatar, message } from 'antd';
import {
  RobotOutlined,
  CustomerServiceOutlined,
  TranslationOutlined,
  CodeOutlined,
  FileTextOutlined,
  BulbOutlined,
  BookOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { createAgent } from '../../../api/agent-config';

const { Title, Text, Paragraph } = Typography;

interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  persona: string;
  model: string;
  tags: string[];
  color: string;
}

const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    id: 'customer-service',
    name: '智能客服',
    description: '专业的客户服务智能体，能够处理常见问题、解答疑问、提供产品信息',
    icon: <CustomerServiceOutlined />,
    persona: '你是一位专业的客户服务代表。你的职责是友好、耐心地解答客户的问题，提供准确的产品信息和服务支持。如果遇到无法解决的问题，请引导客户联系人工客服。',
    model: 'deepseek-v4-flash',
    tags: ['客服', '问答'],
    color: '#52c41a',
  },
  {
    id: 'translator',
    name: '多语言翻译官',
    description: '支持多种语言互译的翻译智能体，翻译准确、自然流畅',
    icon: <TranslationOutlined />,
    persona: '你是一位专业的多语言翻译专家。你精通中文、英文、日文、韩文等多种语言的互译。翻译时请注意保持原文的语气、风格和文化背景，确保翻译结果自然流畅。',
    model: 'deepseek-v4-flash',
    tags: ['翻译', '多语言'],
    color: '#1890ff',
  },
  {
    id: 'code-assistant',
    name: '编程助手',
    description: '专业的编程辅助智能体，帮助编写代码、调试问题、解释技术概念',
    icon: <CodeOutlined />,
    persona: '你是一位经验丰富的软件工程师。你精通多种编程语言和框架，能够帮助用户编写高质量的代码、调试程序问题、解释复杂的技术概念。请始终提供清晰、可运行的代码示例。',
    model: 'deepseek-v4-flash',
    tags: ['编程', '开发'],
    color: '#722ed1',
  },
  {
    id: 'writer',
    name: '内容创作助手',
    description: '专业的写作助手，帮助撰写文章、文案、报告等各类内容',
    icon: <EditOutlined />,
    persona: '你是一位才华横溢的内容创作者。你擅长各种文体的写作，包括文章、文案、报告、故事等。请根据用户的需求，提供高质量、有创意的内容。注意保持语言的准确性和吸引力。',
    model: 'deepseek-v4-flash',
    tags: ['写作', '创作'],
    color: '#fa8c16',
  },
  {
    id: 'analyst',
    name: '数据分析助手',
    description: '专业的数据分析智能体，帮助分析数据、生成报告、提供洞察',
    icon: <BulbOutlined />,
    persona: '你是一位数据分析专家。你擅长数据处理、统计分析、数据可视化和商业智能。请帮助用户分析数据，提供有价值的洞察和建议。使用清晰的图表和指标来展示分析结果。',
    model: 'deepseek-v4-flash',
    tags: ['分析', '数据'],
    color: '#13c2c2',
  },
  {
    id: 'tutor',
    name: '学习辅导老师',
    description: '耐心的学习辅导智能体，帮助学生理解知识点、解答问题',
    icon: <BookOutlined />,
    persona: '你是一位耐心、专业的学习辅导老师。你擅长用简单易懂的方式解释复杂的概念，引导学生主动思考。请根据学生的水平调整教学方式，多用例子和类比来帮助理解。',
    model: 'deepseek-v4-flash',
    tags: ['教育', '辅导'],
    color: '#eb2f96',
  },
  {
    id: 'document-assistant',
    name: '文档处理助手',
    description: '专业的文档处理智能体，帮助整理、总结、翻译各类文档',
    icon: <FileTextOutlined />,
    persona: '你是一位文档处理专家。你擅长文档整理、内容总结、格式转换和多语言翻译。请帮助用户高效处理各类文档，保持文档的结构清晰、内容准确。',
    model: 'deepseek-v4-flash',
    tags: ['文档', '处理'],
    color: '#faad14',
  },
  {
    id: 'custom',
    name: '自定义智能体',
    description: '从零开始创建你自己的智能体，完全自定义角色和能力',
    icon: <RobotOutlined />,
    persona: '',
    model: 'deepseek-v4-flash',
    tags: ['自定义'],
    color: '#565fe2',
  },
];

interface AgentTemplateModalProps {
  open: boolean;
  onClose: () => void;
}

export function AgentTemplateModal({ open, onClose }: AgentTemplateModalProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);

  const handleSelectTemplate = async (template: AgentTemplate) => {
    setLoading(template.id);
    try {
      const agent = await createAgent({
        name: template.name,
        avatar: '',
        description: template.description,
        model: template.model,
        mode: 'chat',
      });

      // 如果有 persona，更新智能体配置
      if (template.persona) {
        const { updateAgent } = await import('../../../api/agent-config');
        await updateAgent(agent.id, {
          persona: template.persona,
        });
      }

      message.success(`智能体「${template.name}」创建成功`);
      onClose();
      navigate(`/agents/${agent.id}`);
    } catch (err) {
      console.error('创建智能体失败:', err);
      message.error('创建智能体失败，请重试');
    } finally {
      setLoading(null);
    }
  };

  return (
    <Modal
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <RobotOutlined />
          智能体模板库
        </span>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={720}
      styles={{ body: { padding: '16px 0' } }}
    >
      <div style={{ padding: '0 16px' }}>
        <Paragraph type="secondary" style={{ marginBottom: 16 }}>
          选择一个模板快速创建智能体，或从零开始自定义
        </Paragraph>
        <Row gutter={[12, 12]}>
          {AGENT_TEMPLATES.map((template) => (
            <Col key={template.id} xs={24} sm={12} md={8}>
              <Card
                hoverable
                loading={loading === template.id}
                style={{
                  height: '100%',
                  borderRadius: 12,
                  border: '1px solid #f0f0f0',
                  transition: 'all 0.2s ease',
                }}
                styles={{ body: { padding: 16 } }}
                onClick={() => handleSelectTemplate(template)}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <Avatar
                    size={40}
                    icon={template.icon}
                    style={{
                      background: template.color,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Title level={5} style={{ margin: 0, fontSize: 14 }}>
                      {template.name}
                    </Title>
                    <Paragraph
                      type="secondary"
                      style={{
                        margin: '4px 0 0',
                        fontSize: 12,
                        lineHeight: 1.5,
                      }}
                      ellipsis={{ rows: 2 }}
                    >
                      {template.description}
                    </Paragraph>
                    <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {template.tags.map((tag) => (
                        <Tag key={tag} style={{ margin: 0, fontSize: 11 }}>
                          {tag}
                        </Tag>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </div>
    </Modal>
  );
}
