import React, { useState } from 'react';
import { ProjectProvider } from './context/ProjectContext';
import { Header } from './components/Header';
import { MediaBrowser } from './components/MediaBrowser';
import { PreviewMonitor } from './components/PreviewMonitor';
import { Inspector } from './components/Inspector';
import { Timeline } from './components/Timeline';
import { AIAssistantModal } from './components/AIAssistantModal';
import { SubtitleStudioModal } from './components/SubtitleStudioModal';
import { ExportModal } from './components/ExportModal';

type MobilePanel = 'media' | 'preview' | 'inspector';

function StudioWorkspace() {
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>('preview');

  return (
    <div className="cineflow-shell flex flex-col h-screen w-screen overflow-hidden bg-[#090b11] text-[#e2e8f0]">
      <Header />
      <nav className="cineflow-mobile-nav" aria-label="Editor panels">
        {([
          ['media', 'Media'],
          ['preview', 'Preview'],
          ['inspector', 'Inspector'],
        ] as const).map(([panel, label]) => (
          <button
            key={panel}
            type="button"
            aria-pressed={mobilePanel === panel}
            className={mobilePanel === panel ? 'active' : ''}
            onClick={() => setMobilePanel(panel)}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className={`cineflow-workspace flex-1 flex overflow-hidden panel-${mobilePanel}`}>
        <MediaBrowser />
        <PreviewMonitor />
        <Inspector />
      </div>
      <Timeline />
      <AIAssistantModal />
      <SubtitleStudioModal />
      <ExportModal />
    </div>
  );
}

export default function App() {
  return (
    <ProjectProvider>
      <StudioWorkspace />
    </ProjectProvider>
  );
}
