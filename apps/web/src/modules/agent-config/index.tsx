import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Modal } from "antd";
import styles from "./index.module.css";
import { CreateAgent } from "./creatAgent";
import type { AgentConfig } from "../../api/agent-config/index";
import { createAgent, getAgentList, deleteAgent } from "../../api/agent-config/index";

type FilterValue = 'all' | 'published' | 'draft' | 'recent';

const FILTER_OPTIONS: { label: string; value: FilterValue }[] = [
  { label: '全部', value: 'all' },
  { label: '已发布', value: 'published' },
  { label: '未发布', value: 'draft' },
  { label: '最近打开', value: 'recent' },
];

const FILTER_LABELS: Record<FilterValue, string> = {
  all: '全部',
  published: '已发布',
  draft: '未发布',
  recent: '最近打开',
};

const RECENT_STORAGE_KEY = 'miniCoze_recent_agents';

function loadRecentTimestamps(): Record<string, number> {
  try {
    const raw = localStorage.getItem(RECENT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function recordRecentOpen(agentId: string) {
  const recents = loadRecentTimestamps();
  recents[agentId] = Date.now();
  try {
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(recents));
  } catch {
    // ignore
  }
}

export function CreatAgent() {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterValue>('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getAgentList().then(setAgents);
  }, []);

  const filteredAgents = useMemo(() => {
    let result = agents.filter((a) =>
      a.name.toLowerCase().includes(search.toLowerCase())
    );

    if (filter === 'published') {
      result = result.filter((a) => a.status === 'ACTIVE');
    } else if (filter === 'draft') {
      result = result.filter((a) => a.status === 'DRAFT');
    } else if (filter === 'recent') {
      const recents = loadRecentTimestamps();
      result = [...result].sort((a, b) => {
        const ta = recents[a.id] ?? 0;
        const tb = recents[b.id] ?? 0;
        return tb - ta;
      });
    }

    return result;
  }, [agents, search, filter]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  const handleSelectFilter = (value: FilterValue) => {
    setFilter(value);
    setDropdownOpen(false);
  };

  const handleCreate = async (params: { name: string; avatar: string; description: string }) => {
    const newAgent = await createAgent(params);
    setAgents((prev) => [newAgent, ...prev]);
    setModalVisible(false);
    navigate(`/agents/${newAgent.id}`);
  };

  const handleDelete = (agent: AgentConfig) => {
    Modal.confirm({
      title: '删除智能体',
      content: `确定要删除智能体「${agent.name}」吗？此操作不可恢复，该智能体的所有配置和对话记录将被永久删除。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        await deleteAgent(agent.id);
        setAgents((prev) => prev.filter((a) => a.id !== agent.id));
      },
    });
  };

  const handleSelectAgent = (id: string) => {
    recordRecentOpen(id);
    navigate(`/agents/${id}`);
  };

  return (
    <div className={styles.agentConfig}>
      <div className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <span className={styles.topBarTitle}>智能体</span>
          <div className={styles.filterBar} ref={dropdownRef}>
            <button
              className={styles.filterTrigger}
              onClick={() => setDropdownOpen(!dropdownOpen)}
            >
              <span className={styles.filterTriggerLabel}>
                {FILTER_LABELS[filter]}
              </span>
              <svg
                className={`${styles.filterTriggerArrow} ${dropdownOpen ? styles.filterTriggerArrowOpen : ''}`}
                width="10" height="6" viewBox="0 0 10 6" fill="none"
              >
                <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {dropdownOpen && (
              <div className={styles.filterDropdown}>
                <div className={styles.filterDropdownGroup}>
                  <div className={styles.filterDropdownGroupTitle}>发布状态</div>
                  {FILTER_OPTIONS.slice(0, 3).map((opt) => (
                    <div
                      key={opt.value}
                      className={`${styles.filterDropdownItem} ${filter === opt.value ? styles.filterDropdownItemActive : ''}`}
                      onClick={() => handleSelectFilter(opt.value)}
                    >
                      <span>{opt.label}</span>
                      {filter === opt.value && (
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M3 7L6 10L11 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                  ))}
                </div>
                <div className={styles.filterDropdownDivider} />
                <div className={styles.filterDropdownGroup}>
                  <div className={styles.filterDropdownGroupTitle}>最近打开</div>
                  {FILTER_OPTIONS.slice(3).map((opt) => (
                    <div
                      key={opt.value}
                      className={`${styles.filterDropdownItem} ${filter === opt.value ? styles.filterDropdownItemActive : ''}`}
                      onClick={() => handleSelectFilter(opt.value)}
                    >
                      <span>{opt.label}</span>
                      {filter === opt.value && (
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M3 7L6 10L11 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className={styles.topBarRight}>
          <div className={styles.searchBox}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              className={styles.searchInput}
              type="search"
              placeholder="搜索智能体名称"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            onClick={() => setModalVisible(true)}
            className={styles.topBarCreateBtn}
          >
            + 新建智能体
          </button>
        </div>
      </div>

      <div className={styles.agentList}>
        {filteredAgents.length === 0 ? (
          <div className={styles.agentListEmpty}>
            {search ? "没有找到匹配的智能体" : "暂无智能体，点击上方按钮创建"}
          </div>
        ) : (
          filteredAgents.map((agent) => (
            <div
              key={agent.id}
              className={styles.agentCard}
              onClick={() => handleSelectAgent(agent.id)}
            >
              <img
                src={agent.avatar}
                alt={agent.name}
                className={styles.agentCardAvatar}
              />
              <div className={styles.agentCardBody}>
                <div className={styles.agentCardHeader}>
                  <span className={styles.agentCardName}>{agent.name}</span>
                  <span className={`${styles.agentCardStatus} ${agent.status === 'ACTIVE' ? styles.agentCardStatusPublished : styles.agentCardStatusDraft}`}>
                    {agent.status === 'ACTIVE' ? '已发布' : '未发布'}
                  </span>
                </div>
                {agent.description && (
                  <span className={styles.agentCardDesc}>{agent.description}</span>
                )}
                <span className={styles.agentCardTime}>
                  {new Date(agent.createdAt).toLocaleDateString('zh-CN', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                  })}{' '}
                  创建
                </span>
              </div>
              <button
                className={styles.agentCardDelete}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(agent);
                }}
                title="删除"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>

      <CreateAgent
        visible={modalVisible}
        onCancel={() => setModalVisible(false)}
        onCreate={handleCreate}
      />
    </div>
  );
}
