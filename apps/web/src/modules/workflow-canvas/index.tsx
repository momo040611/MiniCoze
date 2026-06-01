import React from 'react'
import Header from './page/Header'
import Toolbar from './page/Toolbar'
import styles from './index.module.css'
import { EditorRenderer, FreeLayoutEditorProvider } from '@flowgram.ai/free-layout-editor'
import '@flowgram.ai/free-layout-editor/index.css'
const handleAddNode = (type: string) => {
  console.log('添加节点类型：', type)
}
import { useSimpleEditorProps } from './hooks/useSimpleEditorProps'

function WorkflowCanvasPage() {
  const editorProps = useSimpleEditorProps()
  return (
    <FreeLayoutEditorProvider {...editorProps}>
      <div className={styles.workflowPage}>
        <Header />
        <main className={styles.canvasArea}>
          <EditorRenderer />
        </main>
        <Toolbar onAddNode={handleAddNode} />
      </div>
    </FreeLayoutEditorProvider>
  )
}
export { WorkflowCanvasPage }