/** Independently selected right-hand circuit tool panel; Properties is separate. */
import { useEffect } from 'react';
import { Cable, Code2, Monitor, Table2, X } from 'lucide-react';
import { useLab } from '@/store/lab';
import { WorkbenchSidebarContent, type WorkbenchControlsProps, type WorkbenchPanelTab } from './workbench-dock';

type Props = WorkbenchControlsProps & {
  open: boolean;
  tab: WorkbenchPanelTab;
  onTabChange: (tab: WorkbenchPanelTab) => void;
  onClose: () => void;
  onOpen: () => void;
};

const utilityItems = {
  monitor: {label: 'Monitor', Icon: Monitor},
  guide: {label: 'Wiring Guide', Icon: Cable},
  truth: {label: 'Truth Table', Icon: Table2},
  code: {label: 'Arduino Code', Icon: Code2},
} as const;

export function WorkbenchUtilities({open, tab, onTabChange, onClose, onOpen, ...controls}: Props) {
  // Toolbar commands and keyboard shortcuts open exactly the same side panel
  // as the corresponding right-edge launcher; the underlying store is shared.
  useEffect(() => {
    if ((controls.openArduinoCodeRequest ?? 0) > 0) {
      onTabChange('code');
      onOpen();
    }
  }, [controls.openArduinoCodeRequest]);
  useEffect(() => {
    if ((controls.openMonitorRequest ?? 0) > 0) {
      onTabChange('monitor');
      onOpen();
    }
  }, [controls.openMonitorRequest]);

  const select = (next: WorkbenchPanelTab) => {
    onTabChange(next);
    useLab.getState().setGuideTarget(null);
  };
  const {label, Icon} = utilityItems[tab];
  return <aside
    id="editor-utilities-panel"
    className={`editor-workbench-utilities ${open ? 'is-open' : 'is-closed'} ${tab === 'code' ? 'is-code-workspace' : ''}`}
    aria-label="Workbench utilities"
    aria-hidden={!open}
    data-utility-tab={tab}
  >
    {open && <>
      <header className="editor-utilities-header">
        <div><Icon size={18}/><strong>{label}</strong></div>
        <button type="button" onClick={onClose} aria-label={`Close ${label} panel`}><X size={18}/></button>
      </header>
      <div className={`editor-utilities-body ${tab === 'code' ? 'editor-utilities-code-body' : ''}`}>
        <WorkbenchSidebarContent {...controls} tab={tab} showDetails onTabChange={select}/>
      </div>
    </>}
  </aside>;
}
