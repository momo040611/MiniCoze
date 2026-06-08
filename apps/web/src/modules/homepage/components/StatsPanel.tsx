import { useMemo } from 'react';
import { Card, Row, Col, Typography, Progress } from 'antd';
import {
  MessageOutlined,
  RobotOutlined,
  BookOutlined,
  DeploymentUnitOutlined,
  ThunderboltOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

interface StatItem {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  suffix?: string;
}

interface StatsPanelProps {
  agentCount: number;
  conversationCount: number;
  knowledgeBaseCount: number;
  workflowCount: number;
  totalTokens?: number;
  avgResponseTime?: number;
}

export function StatsPanel({
  agentCount,
  conversationCount,
  knowledgeBaseCount,
  workflowCount,
  totalTokens = 0,
  avgResponseTime = 0,
}: StatsPanelProps) {
  const stats = useMemo<StatItem[]>(
    () => [
      {
        label: '智能体',
        value: agentCount,
        icon: <RobotOutlined />,
        color: '#565fe2',
        bgColor: 'rgba(86, 95, 226, 0.1)',
      },
      {
        label: '对话数',
        value: conversationCount,
        icon: <MessageOutlined />,
        color: '#52c41a',
        bgColor: 'rgba(82, 196, 26, 0.1)',
      },
      {
        label: '知识库',
        value: knowledgeBaseCount,
        icon: <BookOutlined />,
        color: '#fa8c16',
        bgColor: 'rgba(250, 140, 22, 0.1)',
      },
      {
        label: '工作流',
        value: workflowCount,
        icon: <DeploymentUnitOutlined />,
        color: '#722ed1',
        bgColor: 'rgba(114, 46, 209, 0.1)',
      },
      {
        label: '总 Token',
        value: totalTokens,
        icon: <ThunderboltOutlined />,
        color: '#13c2c2',
        bgColor: 'rgba(19, 194, 194, 0.1)',
        suffix: '',
      },
      {
        label: '平均响应',
        value: avgResponseTime,
        icon: <ClockCircleOutlined />,
        color: '#eb2f96',
        bgColor: 'rgba(235, 47, 150, 0.1)',
        suffix: 'ms',
      },
    ],
    [agentCount, conversationCount, knowledgeBaseCount, workflowCount, totalTokens, avgResponseTime],
  );

  // 计算最大值用于进度条
  const maxValue = useMemo(() => {
    return Math.max(...stats.map((s) => s.value), 1);
  }, [stats]);

  return (
    <Card
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ThunderboltOutlined style={{ color: '#565fe2' }} />
          数据统计
        </span>
      }
      style={{ borderRadius: 12 }}
      styles={{ body: { padding: '16px 24px' } }}
    >
      <Row gutter={[24, 16]}>
        {stats.map((stat) => (
          <Col key={stat.label} xs={12} sm={8} md={4}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: stat.bgColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: stat.color,
                    fontSize: 16,
                  }}
                >
                  {stat.icon}
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                    {stat.label}
                  </Text>
                  <Title level={4} style={{ margin: 0, lineHeight: 1.2 }}>
                    {stat.value.toLocaleString()}
                    {stat.suffix && (
                      <Text type="secondary" style={{ fontSize: 12, marginLeft: 2 }}>
                        {stat.suffix}
                      </Text>
                    )}
                  </Title>
                </div>
              </div>
              <Progress
                percent={Math.min((stat.value / maxValue) * 100, 100)}
                showInfo={false}
                strokeColor={stat.color}
                trailColor="#f0f0f0"
                size="small"
              />
            </div>
          </Col>
        ))}
      </Row>
    </Card>
  );
}
