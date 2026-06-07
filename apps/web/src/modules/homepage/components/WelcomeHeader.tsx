// ① 欢迎横幅 — 简约设计
import styles from './WelcomeHeader.module.css';

interface Props {
  greeting: string;
  userName: string;
  dateStr: string;
  workspaceName: string;
}

export function WelcomeHeader({ greeting, userName, dateStr }: Props) {
  return (
    <div className={styles.banner}>
      <h1 className={styles.greeting}>
        {greeting}，{userName}
      </h1>
      <p className={styles.date}>{dateStr}</p>
    </div>
  );
}
