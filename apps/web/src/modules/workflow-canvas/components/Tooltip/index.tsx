import { useState } from "react";
import type { ReactNode } from 'react'
import styles from './index.module.css'
type TooltipProps = {
        text: string
        children: ReactNode
        position?: 'top' | 'bottom'
}
export function Tooltip(props: TooltipProps) {
        const { text, children, position = 'bottom' } = props
        const [isShow, setIsShow] = useState(false)
        return (
                <div className={styles.toolTipWrapper}
                        onMouseEnter={() => { setIsShow(true) }}
                        onMouseLeave={() => { setIsShow(false) }}
                >
                        {children}
                        <div className={`
                        ${styles.tooltip}
                        ${styles[position]}
                         ${isShow ? styles.tooltipVisible : ''}
                         `}>
                                {text}
                        </div>
                </div>
        )
}
