import type { ReactNode } from 'react';
import styles from './KbPageHeader.module.css';

type KbPageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
};

function KbPageHeader({ title, description, actions }: KbPageHeaderProps) {
  return (
    <div className={styles.header}>
      <div>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </div>
  );
}

export { KbPageHeader };
