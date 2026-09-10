import type { ReactElement } from 'react'

function ReadingPane(): ReactElement {
  return (
    <div className="reading-pane">
      <div className="reading-pane-empty">Select an item to read.</div>
    </div>
  )
}

export default ReadingPane
