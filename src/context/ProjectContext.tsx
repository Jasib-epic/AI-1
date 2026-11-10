import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import {
  VideoProject,
  TimelineClip,
  TimelineTrack,
  SubtitleItem,
  SubtitleStyle,
  MediaAsset,
  WorkspaceTab,
  ColorGradeSettings,
  MasterAudioSettings,
  EffectType,
  TransitionType,
} from '../types/editor';
import { DEFAULT_COLOR_GRADE } from '../utils/colorGrading';
import { generateInitialMediaBundle } from '../utils/sampleMedia';
import { audioEngine } from '../services/audioEngine';
import { renderEngine } from '../services/renderEngine';


// Local-first project recovery. Media blobs stay on this device and are never uploaded.
const PROJECT_DB = 'cineflow-local-projects';
const PROJECT_STORE = 'projects';
const openProjectDatabase = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB unavailable'));
  const request = indexedDB.open(PROJECT_DB, 1);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(PROJECT_STORE)) {
      request.result.createObjectStore(PROJECT_STORE, { keyPath: 'id' });
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
const saveLocalProject = async (project: VideoProject, assets: MediaAsset[]) => {
  const db = await openProjectDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PROJECT_STORE, 'readwrite');
    tx.objectStore(PROJECT_STORE).put({
      id: project.id,
      project,
      assets: assets.map(({ audioBuffer, ...asset }) => ({ ...asset, url: asset.blob ? '' : asset.url })),
      savedAt: Date.now(),
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
};
const loadLocalProject = async (): Promise<{ project: VideoProject; assets: MediaAsset[] } | null> => {
  const db = await openProjectDatabase();
  const record = await new Promise<any>((resolve, reject) => {
    const request = db.transaction(PROJECT_STORE, 'readonly').objectStore(PROJECT_STORE).getAll();
    request.onsuccess = () => resolve(request.result.sort((a: any, b: any) => b.savedAt - a.savedAt)[0] || null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  if (!record) return null;
  const assets = (record.assets || []).map((asset: MediaAsset) => {
    const url = asset.blob ? URL.createObjectURL(asset.blob) : asset.url;
    return { ...asset, url };
  });
  return { project: record.project, assets };
};

const INITIAL_TRACKS: TimelineTrack[] = [
  { id: 'track-v2', name: 'V2 Overlay', type: 'video', locked: false, muted: false, solo: false, volume: 1, height: 56 },
  { id: 'track-v1', name: 'V1 Main Video', type: 'video', locked: false, muted: false, solo: false, volume: 1, height: 68 },
  { id: 'track-sub', name: 'Captions Track', type: 'caption', locked: false, muted: false, solo: false, volume: 1, height: 44 },
  { id: 'track-a1', name: 'A1 Dialogue & SFX', type: 'audio', locked: false, muted: false, solo: false, volume: 1, height: 52 },
  { id: 'track-a2', name: 'A2 Music Track', type: 'audio', locked: false, muted: false, solo: false, volume: 0.8, height: 52 },
];

const INITIAL_MASTER_AUDIO: MasterAudioSettings = {
  volume: 1.0,
  eqLow: 0,
  eqMid: 0,
  eqHigh: 0,
  compressor: true,
  limiter: true,
  reverb: 0.1,
  noiseReduction: false,
};

interface ProjectContextType {
  project: VideoProject;
  currentTime: number;
  isPlaying: boolean;
  selectedClipId: string | null;
  selectedTrackId: string | null;
  activeTool: 'select' | 'razor' | 'trim';
  zoomLevel: number; // pixels per second
  workspaceTab: WorkspaceTab;
  splitCompare: boolean;
  splitPosition: number;
  showSafeMargins: boolean;
  showScopes: boolean;
  scopeType: 'waveform' | 'vectorscope' | 'histogram';
  mediaAssets: MediaAsset[];
  isAiModalOpen: boolean;
  isExportModalOpen: boolean;
  isSubtitleModalOpen: boolean;
  canUndo: boolean;
  canRedo: boolean;

  // Actions
  setWorkspaceTab: (tab: WorkspaceTab) => void;
  setActiveTool: (tool: 'select' | 'razor' | 'trim') => void;
  setZoomLevel: (zoom: number) => void;
  setSelectedClipId: (id: string | null) => void;
  setSelectedTrackId: (id: string | null) => void;
  setSplitCompare: (enabled: boolean) => void;
  setSplitPosition: (pos: number) => void;
  setShowSafeMargins: (show: boolean) => void;
  setShowScopes: (show: boolean) => void;
  setScopeType: (type: 'waveform' | 'vectorscope' | 'histogram') => void;
  setIsAiModalOpen: (open: boolean) => void;
  setIsExportModalOpen: (open: boolean) => void;
  setIsSubtitleModalOpen: (open: boolean) => void;

  seek: (time: number) => void;
  togglePlay: () => void;
  stepFrame: (frames: number) => void;

  addMediaAsset: (asset: MediaAsset) => void;
  importUserFiles: (files: FileList | File[]) => Promise<void>;
  addClipToTrack: (assetId: string, trackId: string, startTime?: number) => void;
  addTitleClip: (trackId?: string) => void;
  updateClip: (clipId: string, updates: Partial<TimelineClip>) => void;
  splitClipAtPlayhead: (clipId?: string) => void;
  duplicateClip: (clipId: string) => void;
  deleteClip: (clipId: string) => void;

  updateColorGrade: (clipId: string, updates: Partial<ColorGradeSettings>) => void;
  addEffectToClip: (clipId: string, effectType: EffectType) => void;
  toggleEffect: (clipId: string, effectId: string) => void;
  updateEffectIntensity: (clipId: string, effectId: string, intensity: number) => void;
  removeEffect: (clipId: string, effectId: string) => void;

  setClipTransition: (
    clipId: string,
    transitionIn?: { type: TransitionType; duration: number },
    transitionOut?: { type: TransitionType; duration: number }
  ) => void;

  updateSubtitles: (subtitles: SubtitleItem[]) => void;
  setSubtitleStyle: (style: SubtitleStyle) => void;
  updateMasterAudio: (updates: Partial<MasterAudioSettings>) => void;
  updateTrack: (trackId: string, updates: Partial<TimelineTrack>) => void;
  updateProjectName: (name: string) => void;
  updateResolution: (width: number, height: number, label: string, aspectRatio: string) => void;

  applyAIActions: (actions: any[], summary: string) => void;
  undo: () => void;
  redo: () => void;
  resetProject: () => void;
}

const ProjectContext = createContext<ProjectContextType | null>(null);

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [project, setProject] = useState<VideoProject>({
    id: 'proj-default-1',
    name: 'Cinematic Horizon Teaser',
    fps: 30,
    resolution: {
      width: 1920,
      height: 1080,
      label: '1080p Full HD',
      aspectRatio: '16:9',
    },
    duration: 15.0,
    tracks: INITIAL_TRACKS,
    clips: [],
    subtitles: [
      { id: 'sub-1', start: 0.5, end: 3.5, text: 'Experience next-level cinematic video editing' },
      { id: 'sub-2', start: 4.0, end: 7.2, text: 'Real-time color grading with precision 3-way wheels' },
      { id: 'sub-3', start: 7.8, end: 11.5, text: 'Powered by Gemini AI Studio workflow engine' },
    ],
    subtitleStyle: 'highlight_karaoke',
    subtitleFont: 'Plus Jakarta Sans',
    masterAudio: INITIAL_MASTER_AUDIO,
    updatedAt: Date.now(),
  });

  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>('track-v1');
  const [activeTool, setActiveTool] = useState<'select' | 'razor' | 'trim'>('select');
  const [zoomLevel, setZoomLevel] = useState<number>(45); // px per second
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('edit');
  const [splitCompare, setSplitCompare] = useState<boolean>(false);
  const [splitPosition, setSplitPosition] = useState<number>(0.5);
  const [showSafeMargins, setShowSafeMargins] = useState<boolean>(false);
  const [showScopes, setShowScopes] = useState<boolean>(false);
  const [scopeType, setScopeType] = useState<'waveform' | 'vectorscope' | 'histogram'>('waveform');

  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [localRestoreReady, setLocalRestoreReady] = useState(false);
  const [hasSavedLocalProject, setHasSavedLocalProject] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isSubtitleModalOpen, setIsSubtitleModalOpen] = useState<boolean>(false);

  // History stacks
  const historyRef = useRef<VideoProject[]>([]);
  const futureRef = useRef<VideoProject[]>([]);

  // Push state to history
  const pushHistory = useCallback((current: VideoProject) => {
    historyRef.current.push(JSON.parse(JSON.stringify(current)));
    if (historyRef.current.length > 30) historyRef.current.shift();
    futureRef.current = [];
  }, []);

  // Restore the most recently saved local project and its imported media.
  useEffect(() => {
    let cancelled = false;
    loadLocalProject().then((saved) => {
      if (cancelled || !saved) return;
      setHasSavedLocalProject(true);
      setProject(saved.project);
      setMediaAssets(saved.assets);
      for (const asset of saved.assets) {
        if (asset.type === 'video' || asset.type === 'image') {
          renderEngine.getOrCreateMediaElement(asset.id, asset.url, asset.type);
        }
      }
    }).catch((error) => {
      console.warn('CineFlow local recovery unavailable:', error);
    }).finally(() => {
      if (!cancelled) setLocalRestoreReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  // Autosave edits and media metadata to IndexedDB. Imported file blobs remain local.
  useEffect(() => {
    if (!localRestoreReady) return;
    const timer = window.setTimeout(() => {
      saveLocalProject(project, mediaAssets).catch((error) => {
        console.warn('CineFlow autosave failed:', error);
      });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [project, mediaAssets, localRestoreReady]);

  // Initialize with ready-to-edit media assets and starter clips
  useEffect(() => {
    if (!localRestoreReady || hasSavedLocalProject) return;
    generateInitialMediaBundle().then(({ assets }) => {
      setMediaAssets(assets);

      // Pre-populate clips on timeline
      const cyber = assets.find((a) => a.id === 'asset-cyber-1');
      const sunset = assets.find((a) => a.id === 'asset-sunset-2');
      const music = assets.find((a) => a.id === 'asset-lofi-1');
      const sfx = assets.find((a) => a.id === 'asset-whoosh-1');

      if (cyber && sunset) {
        renderEngine.getOrCreateMediaElement(cyber.id, cyber.url, 'video');
        renderEngine.getOrCreateMediaElement(sunset.id, sunset.url, 'video');

        const starterClips: TimelineClip[] = [
          {
            id: 'clip-1',
            trackId: 'track-v1',
            assetId: cyber.id,
            name: cyber.name,
            type: 'video',
            start: 0,
            duration: 6,
            offset: 0,
            speed: 1,
            volume: 0.8,
            opacity: 1,
            transform: { x: 0, y: 0, scale: 1, rotation: 0, fit: 'cover' },
            colorGrade: { ...DEFAULT_COLOR_GRADE, lut: 'teal_orange', contrast: 1.15, saturation: 1.1 },
            effects: [{ id: 'eff-1', type: 'film_grain', name: 'Film Grain', intensity: 0.25, enabled: true }],
            transitionIn: { type: 'dip_black', duration: 0.8 },
            transitionOut: { type: 'crossfade', duration: 1.0 },
          },
          {
            id: 'clip-2',
            trackId: 'track-v1',
            assetId: sunset.id,
            name: sunset.name,
            type: 'video',
            start: 5.5,
            duration: 6,
            offset: 0,
            speed: 1,
            volume: 0.8,
            opacity: 1,
            transform: { x: 0, y: 0, scale: 1, rotation: 0, fit: 'cover' },
            colorGrade: { ...DEFAULT_COLOR_GRADE, lut: 'kodak_portra', temperature: 15, contrast: 1.1 },
            effects: [{ id: 'eff-2', type: 'vignette', name: 'Vignette', intensity: 0.35, enabled: true }],
            transitionIn: { type: 'crossfade', duration: 1.0 },
          },
        ];

        if (music) {
          starterClips.push({
            id: 'clip-music-1',
            trackId: 'track-a2',
            assetId: music.id,
            name: music.name,
            type: 'audio',
            start: 0,
            duration: 12,
            offset: 0,
            speed: 1,
            volume: 0.75,
            opacity: 1,
            transform: { x: 0, y: 0, scale: 1, rotation: 0, fit: 'cover' },
            colorGrade: { ...DEFAULT_COLOR_GRADE },
            effects: [],
          });
        }

        if (sfx) {
          starterClips.push({
            id: 'clip-sfx-1',
            trackId: 'track-a1',
            assetId: sfx.id,
            name: sfx.name,
            type: 'audio',
            start: 5.2,
            duration: 1.5,
            offset: 0,
            speed: 1,
            volume: 0.9,
            opacity: 1,
            transform: { x: 0, y: 0, scale: 1, rotation: 0, fit: 'cover' },
            colorGrade: { ...DEFAULT_COLOR_GRADE },
            effects: [],
          });
        }

        setProject((prev) => ({
          ...prev,
          clips: starterClips,
          duration: 12.0,
        }));

        setSelectedClipId('clip-1');
      }
    });
  }, [localRestoreReady, hasSavedLocalProject]);

  // Playback clock loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const delta = (now - lastTime) / 1000;
      lastTime = now;

      if (isPlaying) {
        setCurrentTime((prev) => {
          const next = prev + delta;
          if (next >= project.duration) {
            setIsPlaying(false);
            return 0;
          }
          return next;
        });
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, project.duration]);

  // Keep audio clips synchronized with the timeline playhead and track controls.
  useEffect(() => {
    audioEngine.syncTimelinePlayback(
      project.clips,
      project.tracks,
      mediaAssets,
      currentTime,
      isPlaying
    );
  }, [project.clips, project.tracks, mediaAssets, currentTime, isPlaying]);

  // Keyboard Shortcuts (Space: Play/Pause, J: Step Back, L: Step Fwd, C: Razor, V: Select, Ctrl+Z: Undo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['input', 'textarea'].includes((e.target as HTMLElement).tagName.toLowerCase())) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'KeyK') {
        setIsPlaying(false);
      } else if (e.code === 'KeyJ') {
        stepFrame(-1);
      } else if (e.code === 'KeyL') {
        stepFrame(1);
      } else if (e.code === 'KeyC') {
        setActiveTool('razor');
      } else if (e.code === 'KeyV') {
        setActiveTool('select');
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedClipId) {
          deleteClip(selectedClipId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, selectedClipId]);

  const seek = useCallback((time: number) => {
    setCurrentTime(Math.max(0, Math.min(project.duration, time)));
  }, [project.duration]);

  const togglePlay = useCallback(() => {
    audioEngine.getContext();
    setIsPlaying((prev) => !prev);
  }, []);

  const stepFrame = useCallback((deltaFrames: number) => {
    const step = 1 / project.fps;
    setCurrentTime((prev) => Math.max(0, Math.min(project.duration, prev + deltaFrames * step)));
  }, [project.fps, project.duration]);

  const addMediaAsset = useCallback((asset: MediaAsset) => {
    setMediaAssets((prev) => [...prev, asset]);
  }, []);

  // Import local user video/audio/image files and register visual media under
  // the exact asset ID used by timeline clips.
  const importUserFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    for (const file of fileArray) {
      const url = URL.createObjectURL(file);
      const isVideo = file.type.startsWith('video/');
      const isAudio = file.type.startsWith('audio/');
      const isImage = file.type.startsWith('image/');
      const assetId = `asset-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

      let duration = 5;
      let width = 1920;
      let height = 1080;
      let thumbnailUrl = '';

      if (isVideo) {
        const metadataVideo = document.createElement('video');
        metadataVideo.preload = 'metadata';
        metadataVideo.muted = true;
        metadataVideo.src = url;
        await new Promise<void>((resolve) => {
          metadataVideo.onloadedmetadata = () => {
            duration = Number.isFinite(metadataVideo.duration) ? metadataVideo.duration : 5;
            width = metadataVideo.videoWidth || 1920;
            height = metadataVideo.videoHeight || 1080;
            resolve();
          };
          metadataVideo.onerror = () => resolve();
        });
        renderEngine.getOrCreateMediaElement(assetId, url, 'video');
      } else if (isAudio) {
        const metadataAudio = document.createElement('audio');
        metadataAudio.preload = 'metadata';
        metadataAudio.src = url;
        await new Promise<void>((resolve) => {
          metadataAudio.onloadedmetadata = () => {
            duration = Number.isFinite(metadataAudio.duration) ? metadataAudio.duration : 10;
            resolve();
          };
          metadataAudio.onerror = () => resolve();
        });
      } else if (isImage) {
        const image = new Image();
        image.src = url;
        await new Promise<void>((resolve) => {
          image.onload = () => {
            width = image.naturalWidth || 1920;
            height = image.naturalHeight || 1080;
            resolve();
          };
          image.onerror = () => resolve();
        });
        renderEngine.getOrCreateMediaElement(assetId, url, 'image');
      }

      const newAsset: MediaAsset = {
        id: assetId,
        name: file.name,
        type: isVideo ? 'video' : isAudio ? 'audio' : 'image',
        url,
        duration,
        width,
        height,
        thumbnailUrl,
        blob: file,
      };

      setMediaAssets((prev) => [...prev, newAsset]);
    }
  }, []);

  const addClipToTrack = useCallback((assetId: string, trackId: string, startTime?: number) => {
    const asset = mediaAssets.find((a) => a.id === assetId);
    if (!asset) return;

    pushHistory(project);

    const start = startTime !== undefined ? startTime : currentTime;
    const clipDuration = Math.min(asset.duration, 8);

    const newClip: TimelineClip = {
      id: `clip-${Date.now()}`,
      trackId,
      assetId,
      name: asset.name,
      type: asset.type,
      start,
      duration: clipDuration,
      offset: 0,
      speed: 1,
      volume: 1,
      opacity: 1,
      transform: { x: 0, y: 0, scale: 1, rotation: 0, fit: 'cover' },
      colorGrade: { ...DEFAULT_COLOR_GRADE },
      effects: [],
    };

    setProject((prev) => {
      const maxEnd = Math.max(prev.duration, start + clipDuration + 2);
      return {
        ...prev,
        clips: [...prev.clips, newClip],
        duration: maxEnd,
        updatedAt: Date.now(),
      };
    });

    setSelectedClipId(newClip.id);
  }, [mediaAssets, currentTime, project, pushHistory]);

  const addTitleClip = useCallback((trackId: string = 'track-v2') => {
    pushHistory(project);

    const newClip: TimelineClip = {
      id: `title-${Date.now()}`,
      trackId,
      assetId: 'none',
      name: 'Cinematic Title',
      type: 'title',
      start: currentTime,
      duration: 4.0,
      offset: 0,
      speed: 1,
      volume: 1,
      opacity: 1,
      transform: { x: 0, y: 0, scale: 1, rotation: 0, fit: 'contain' },
      colorGrade: { ...DEFAULT_COLOR_GRADE },
      effects: [],
      textConfig: {
        text: 'CINEMATIC SEQUENCE',
        fontFamily: '"Plus Jakarta Sans", sans-serif',
        fontSize: 52,
        fontWeight: 'bold',
        color: '#ffffff',
        outlineColor: '#000000',
        outlineWidth: 2,
        backgroundColor: 'transparent',
        alignment: 'center',
        animation: 'fade',
        positionY: 50,
      },
    };

    setProject((prev) => ({
      ...prev,
      clips: [...prev.clips, newClip],
      updatedAt: Date.now(),
    }));

    setSelectedClipId(newClip.id);
  }, [project, currentTime, pushHistory]);

  const updateClip = useCallback((clipId: string, updates: Partial<TimelineClip>) => {
    setProject((prev) => ({
      ...prev,
      clips: prev.clips.map((c) => (c.id === clipId ? { ...c, ...updates } : c)),
      updatedAt: Date.now(),
    }));
  }, []);

  const splitClipAtPlayhead = useCallback((targetClipId?: string) => {
    const clipIdToSplit = targetClipId || selectedClipId;
    if (!clipIdToSplit) return;

    const clip = project.clips.find((c) => c.id === clipIdToSplit);
    if (!clip) return;

    if (currentTime <= clip.start || currentTime >= clip.start + clip.duration) {
      return; // playhead outside clip
    }

    pushHistory(project);

    const splitPoint = currentTime - clip.start;
    const durationFirstPart = splitPoint;
    const durationSecondPart = clip.duration - splitPoint;

    const firstClip: TimelineClip = {
      ...clip,
      duration: durationFirstPart,
    };

    const secondClip: TimelineClip = {
      ...clip,
      id: `clip-${Date.now()}`,
      start: currentTime,
      duration: durationSecondPart,
      offset: clip.offset + splitPoint * clip.speed,
    };

    setProject((prev) => ({
      ...prev,
      clips: prev.clips.map((c) => (c.id === clip.id ? firstClip : c)).concat(secondClip),
      updatedAt: Date.now(),
    }));

    setSelectedClipId(secondClip.id);
  }, [project, currentTime, selectedClipId, pushHistory]);

  const duplicateClip = useCallback((clipId: string) => {
    const clip = project.clips.find((c) => c.id === clipId);
    if (!clip) return;

    pushHistory(project);

    const duplicated: TimelineClip = {
      ...JSON.parse(JSON.stringify(clip)),
      id: `clip-${Date.now()}`,
      start: clip.start + clip.duration + 0.1,
    };

    setProject((prev) => ({
      ...prev,
      clips: [...prev.clips, duplicated],
      duration: Math.max(prev.duration, duplicated.start + duplicated.duration + 2),
      updatedAt: Date.now(),
    }));

    setSelectedClipId(duplicated.id);
  }, [project, pushHistory]);

  const deleteClip = useCallback((clipId: string) => {
    pushHistory(project);
    setProject((prev) => ({
      ...prev,
      clips: prev.clips.filter((c) => c.id !== clipId),
      updatedAt: Date.now(),
    }));
    if (selectedClipId === clipId) setSelectedClipId(null);
  }, [project, selectedClipId, pushHistory]);

  const updateColorGrade = useCallback((clipId: string, updates: Partial<ColorGradeSettings>) => {
    setProject((prev) => ({
      ...prev,
      clips: prev.clips.map((c) =>
        c.id === clipId
          ? { ...c, colorGrade: { ...c.colorGrade, ...updates } }
          : c
      ),
      updatedAt: Date.now(),
    }));
  }, []);

  const addEffectToClip = useCallback((clipId: string, effectType: EffectType) => {
    pushHistory(project);
    const newEffect = {
      id: `eff-${Date.now()}`,
      type: effectType,
      name: effectType.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
      intensity: 0.35,
      enabled: true,
    };

    setProject((prev) => ({
      ...prev,
      clips: prev.clips.map((c) =>
        c.id === clipId ? { ...c, effects: [...c.effects, newEffect] } : c
      ),
      updatedAt: Date.now(),
    }));
  }, [project, pushHistory]);

  const toggleEffect = useCallback((clipId: string, effectId: string) => {
    setProject((prev) => ({
      ...prev,
      clips: prev.clips.map((c) =>
        c.id === clipId
          ? {
              ...c,
              effects: c.effects.map((e) =>
                e.id === effectId ? { ...e, enabled: !e.enabled } : e
              ),
            }
          : c
      ),
      updatedAt: Date.now(),
    }));
  }, []);

  const updateEffectIntensity = useCallback((clipId: string, effectId: string, intensity: number) => {
    setProject((prev) => ({
      ...prev,
      clips: prev.clips.map((c) =>
        c.id === clipId
          ? {
              ...c,
              effects: c.effects.map((e) =>
                e.id === effectId ? { ...e, intensity } : e
              ),
            }
          : c
      ),
      updatedAt: Date.now(),
    }));
  }, []);

  const removeEffect = useCallback((clipId: string, effectId: string) => {
    pushHistory(project);
    setProject((prev) => ({
      ...prev,
      clips: prev.clips.map((c) =>
        c.id === clipId
          ? { ...c, effects: c.effects.filter((e) => e.id !== effectId) }
          : c
      ),
      updatedAt: Date.now(),
    }));
  }, [project, pushHistory]);

  const setClipTransition = useCallback((
    clipId: string,
    transitionIn?: { type: TransitionType; duration: number },
    transitionOut?: { type: TransitionType; duration: number }
  ) => {
    pushHistory(project);
    setProject((prev) => ({
      ...prev,
      clips: prev.clips.map((c) =>
        c.id === clipId
          ? {
              ...c,
              ...(transitionIn !== undefined ? { transitionIn } : {}),
              ...(transitionOut !== undefined ? { transitionOut } : {}),
            }
          : c
      ),
      updatedAt: Date.now(),
    }));
  }, [project, pushHistory]);

  const updateSubtitles = useCallback((subtitles: SubtitleItem[]) => {
    pushHistory(project);
    setProject((prev) => ({
      ...prev,
      subtitles,
      updatedAt: Date.now(),
    }));
  }, [project, pushHistory]);

  const setSubtitleStyle = useCallback((style: SubtitleStyle) => {
    setProject((prev) => ({
      ...prev,
      subtitleStyle: style,
      updatedAt: Date.now(),
    }));
  }, []);

  const updateMasterAudio = useCallback((updates: Partial<MasterAudioSettings>) => {
    setProject((prev) => {
      const nextAudio = { ...prev.masterAudio, ...updates };
      audioEngine.updateMasterSettings(nextAudio);
      return {
        ...prev,
        masterAudio: nextAudio,
        updatedAt: Date.now(),
      };
    });
  }, []);

  const updateTrack = useCallback((trackId: string, updates: Partial<TimelineTrack>) => {
    setProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => (t.id === trackId ? { ...t, ...updates } : t)),
      updatedAt: Date.now(),
    }));
  }, []);

  const updateProjectName = useCallback((name: string) => {
    setProject((prev) => ({ ...prev, name }));
  }, []);

  const updateResolution = useCallback((width: number, height: number, label: string, aspectRatio: string) => {
    setProject((prev) => ({
      ...prev,
      resolution: { width, height, label, aspectRatio },
    }));
  }, []);

  // Execute AI action plan on project
  const applyAIActions = useCallback((actions: any[], summary: string) => {
    pushHistory(project);

    setProject((prev) => {
      let nextClips = [...prev.clips];
      let nextSubtitles = [...prev.subtitles];
      let nextMasterAudio = { ...prev.masterAudio };
      let nextSubtitleStyle = prev.subtitleStyle;

      for (const action of actions) {
        if (action.type === 'set_color_grade') {
          // Apply to selected clip or all video clips
          nextClips = nextClips.map((c) => {
            if (c.type === 'video') {
              return {
                ...c,
                colorGrade: {
                  ...c.colorGrade,
                  ...action.params,
                },
              };
            }
            return c;
          });
        } else if (action.type === 'add_effect') {
          nextClips = nextClips.map((c) => {
            if (c.type === 'video') {
              const eff = {
                id: `eff-${Date.now()}-${Math.random()}`,
                type: action.params.effectType,
                name: action.params.effectType.replace('_', ' '),
                intensity: action.params.intensity || 0.3,
                enabled: true,
              };
              return { ...c, effects: [...c.effects, eff] };
            }
            return c;
          });
        } else if (action.type === 'add_subtitles') {
          if (action.params.subtitles) {
            nextSubtitles = action.params.subtitles.map((s: any, idx: number) => ({
              id: s.id || `sub-ai-${idx}`,
              start: Number(s.start),
              end: Number(s.end),
              text: s.text,
            }));
          }
          if (action.params.style) {
            nextSubtitleStyle = action.params.style;
          }
        } else if (action.type === 'adjust_audio') {
          nextMasterAudio = {
            ...nextMasterAudio,
            ...action.params,
          };
          audioEngine.updateMasterSettings(nextMasterAudio);
        } else if (action.type === 'add_transition') {
          nextClips = nextClips.map((c, i) => {
            if (c.type === 'video' && i > 0) {
              return {
                ...c,
                transitionIn: {
                  type: action.params.transitionType || 'crossfade',
                  duration: action.params.duration || 0.8,
                },
              };
            }
            return c;
          });
        }
      }

      return {
        ...prev,
        clips: nextClips,
        subtitles: nextSubtitles,
        masterAudio: nextMasterAudio,
        subtitleStyle: nextSubtitleStyle,
        updatedAt: Date.now(),
      };
    });
  }, [project, pushHistory]);

  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    const previous = historyRef.current.pop()!;
    futureRef.current.push(JSON.parse(JSON.stringify(project)));
    setProject(previous);
  }, [project]);

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return;
    const next = futureRef.current.pop()!;
    historyRef.current.push(JSON.parse(JSON.stringify(project)));
    setProject(next);
  }, [project]);

  const resetProject = useCallback(() => {
    setProject({
      id: `proj-${Date.now()}`,
      name: 'Untitled Project',
      fps: 30,
      resolution: { width: 1920, height: 1080, label: '1080p Full HD', aspectRatio: '16:9' },
      duration: 10,
      tracks: INITIAL_TRACKS,
      clips: [],
      subtitles: [],
      subtitleStyle: 'highlight_karaoke',
      subtitleFont: 'Plus Jakarta Sans',
      masterAudio: INITIAL_MASTER_AUDIO,
      updatedAt: Date.now(),
    });
    setSelectedClipId(null);
  }, []);

  return (
    <ProjectContext.Provider
      value={{
        project,
        currentTime,
        isPlaying,
        selectedClipId,
        selectedTrackId,
        activeTool,
        zoomLevel,
        workspaceTab,
        splitCompare,
        splitPosition,
        showSafeMargins,
        showScopes,
        scopeType,
        mediaAssets,
        isAiModalOpen,
        isExportModalOpen,
        isSubtitleModalOpen,
        canUndo: historyRef.current.length > 0,
        canRedo: futureRef.current.length > 0,

        setWorkspaceTab,
        setActiveTool,
        setZoomLevel,
        setSelectedClipId,
        setSelectedTrackId,
        setSplitCompare,
        setSplitPosition,
        setShowSafeMargins,
        setShowScopes,
        setScopeType,
        setIsAiModalOpen,
        setIsExportModalOpen,
        setIsSubtitleModalOpen,

        seek,
        togglePlay,
        stepFrame,

        addMediaAsset,
        importUserFiles,
        addClipToTrack,
        addTitleClip,
        updateClip,
        splitClipAtPlayhead,
        duplicateClip,
        deleteClip,

        updateColorGrade,
        addEffectToClip,
        toggleEffect,
        updateEffectIntensity,
        removeEffect,

        setClipTransition,
        updateSubtitles,
        setSubtitleStyle,
        updateMasterAudio,
        updateTrack,
        updateProjectName,
        updateResolution,

        applyAIActions,
        undo,
        redo,
        resetProject,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context) throw new Error('useProject must be used within ProjectProvider');
  return context;
};
