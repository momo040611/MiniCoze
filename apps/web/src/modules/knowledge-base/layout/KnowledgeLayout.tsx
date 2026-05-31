import { Outlet } from 'react-router-dom';
import styles from './KnowledgeLayout.module.css';

function KnowledgeLayout() {
  return (
    <div className={styles.layout}>
      <Outlet />
    </div>
  );
}

export { KnowledgeLayout };
