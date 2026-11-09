import React from 'react';
import { ProjectProvider } from './context/ProjectContext';
import { Header } from './components/Header';
import { MediaBrowser } from './components/MediaBrowser';
import { PreviewMonitor } from './components/PreviewMonitor';
import { Inspector } from './components/Inspector';
import { Timeline } from './components/Timeline';
import { AIAssistantModal } from './components/AIAssistantModal';
import { SubtitleStudioModal } from './components/SubtitleStudioModal';
import { ExportModal } from './components/ExportModal';

export default function App() {
  return (
    <ProjectProvider>
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#090b11] text-[#e2e8f0]">
        {/* Studio Top Navigation Bar */}
        <Header />

        {/* Studio Workspace Main Split */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel: Media Pool, Effects, Transitions, Audio SFX, Titles */}
          <MediaBrowser />

          {/* Center Panel: Program Video Monitor & Scopes */}
          <PreviewMonitor />

          {/* Right Panel: Property Inspector & Color Grading Wheels */}
          <Inspector />
        </div>

        {/* Bottom Panel: Multitrack Timeline & Playhead Scrubber */}
        <Timeline />

        {/* Studio Modals */}
        <AIAssistantModal />
        <SubtitleStudioModal />
        <ExportModal />
      </div>
    </ProjectProvider>
  );
}
