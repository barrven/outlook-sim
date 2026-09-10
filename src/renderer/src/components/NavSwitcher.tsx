import type { ReactElement } from 'react'
import { NAV_MODULES, type ModuleId } from '../types'

interface NavSwitcherProps {
  activeModule: ModuleId
  onSelectModule: (moduleId: ModuleId) => void
}

function NavSwitcher({ activeModule, onSelectModule }: NavSwitcherProps): ReactElement {
  return (
    <div className="nav-switcher" role="tablist" aria-label="Modules">
      {NAV_MODULES.map((module) => (
        <button
          key={module.id}
          type="button"
          role="tab"
          aria-selected={module.id === activeModule}
          className={`nav-switcher-item${module.id === activeModule ? ' active' : ''}`}
          onClick={() => onSelectModule(module.id)}
        >
          {module.label}
        </button>
      ))}
    </div>
  )
}

export default NavSwitcher
