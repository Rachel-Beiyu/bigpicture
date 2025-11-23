import React, { useState, useRef, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import ProjectCard from './components/ProjectCard';
import LoginPage from './components/LoginPage';
import { ProjectNote, CanvasState, Coordinates, ProjectColor, User } from './types';
import * as googleService from './services/googleService';

// Initial state helpers
const INITIAL_ZOOM = 1;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2.5;

const App: React.FC = () => {
  // --- Auth State ---
  const [user, setUser] = useState<User | null>(null);
  const [isGoogleReady, setIsGoogleReady] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | undefined>(undefined);
  const [driveFileId, setDriveFileId] = useState<string | null>(null);

  // --- Canvas State ---
  const [canvasState, setCanvasState] = useState<CanvasState>({
    offset: { x: 0, y: 0 },
    zoom: INITIAL_ZOOM,
  });
  
  // --- App State ---
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | 'offline'>('saved');
  const [notes, setNotes] = useState<ProjectNote[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

  // --- Interaction State ---
  const isDraggingCanvas = useRef(false);
  const isDraggingNote = useRef(false);
  const lastMousePos = useRef<Coordinates>({ x: 0, y: 0 });
  const draggingNoteId = useRef<string | null>(null);

  // --- Helper: Default Notes ---
  const getDefaultNotes = (): ProjectNote[] => [{
      id: uuidv4(),
      title: "Welcome to Horizon",
      content: "This is your infinite workspace.<br/><br/><ul><li>Drag empty space to pan.</li><li><b>Rich text</b> is now supported!</li><li>Try adding images via the toolbar.</li></ul>",
      x: window.innerWidth / 2 - 200,
      y: window.innerHeight / 2 - 150,
      width: 400,
      height: 300,
      color: ProjectColor.WHITE,
      createdAt: Date.now(),
      tags: ['tutorial'],
      priority: 'medium'
  }];

  // --- Initialization ---
  
  // 1. Load Google Scripts
  useEffect(() => {
    googleService.initGoogleScripts(() => {
      setIsGoogleReady(true);
    });
  }, []);

  // 2. Auth & Data Loading Handler
  const handleLogin = async () => {
    if (!isGoogleReady) return;
    setIsAuthLoading(true);
    setAuthError(undefined);

    try {
        const result = await googleService.signIn();
        const userData: User = {
            name: result.user.displayName,
            email: result.user.emailAddress, // Might be undefined depending on scope
            picture: result.user.photoLink,
            accessToken: result.accessToken
        };
        setUser(userData);

        // Load data from Drive
        await syncFromDrive();

    } catch (err: any) {
        console.error("Login failed", err);
        // Show the actual error message if available, otherwise generic
        setAuthError(err.message || "Failed to sign in. Please check your configuration.");
    } finally {
        setIsAuthLoading(false);
    }
  };

  const handleGuestLogin = () => {
    const guestUser: User = {
        name: "Guest",
        email: "guest@local",
        picture: "",
        accessToken: "" // Empty token indicates guest mode
    };
    setUser(guestUser);
    
    // Load local storage data
    const localData = localStorage.getItem('horizon_notes');
    if (localData) {
        try {
            setNotes(JSON.parse(localData));
        } catch (e) {
            setNotes(getDefaultNotes());
        }
    } else {
        setNotes(getDefaultNotes());
    }
  };

  const syncFromDrive = async () => {
      setSaveStatus('saving'); // Re-purpose for loading indicator
      try {
          const existingFile = await googleService.findSaveFile();
          
          if (existingFile) {
              console.log("Found existing cloud file:", existingFile.id);
              setDriveFileId(existingFile.id);
              const data = await googleService.loadDataFromDrive(existingFile.id);
              setNotes(data);
          } else {
              // Migration: Check if local storage has data to upload
              const localData = localStorage.getItem('horizon_notes');
              let initialNotes: ProjectNote[] = [];
              
              if (localData) {
                  try {
                      initialNotes = JSON.parse(localData);
                      console.log("Migrating local data to cloud...");
                  } catch (e) { /* ignore */ }
              } 
              
              if (initialNotes.length === 0) {
                  initialNotes = getDefaultNotes();
              }
              
              setNotes(initialNotes);
              // Create the file immediately
              const newFileId = await googleService.saveToDrive(initialNotes, null);
              setDriveFileId(newFileId);
          }
          setSaveStatus('saved');
      } catch (e) {
          console.error("Failed to sync from drive", e);
          setSaveStatus('error');
      }
  };

  const handleSignOut = () => {
      if (user?.accessToken) {
        googleService.signOut();
      }
      setUser(null);
      setNotes([]);
      setDriveFileId(null);
  };

  // --- Persistence ---

  // Save changes (Debounced)
  useEffect(() => {
    if (!user) return;

    setSaveStatus('saving');
    const timer = setTimeout(async () => {
        try {
            if (user.accessToken && driveFileId) {
                // Cloud Save
                await googleService.saveToDrive(notes, driveFileId);
            } else {
                // Local Save (Guest Mode)
                localStorage.setItem('horizon_notes', JSON.stringify(notes));
            }
            setSaveStatus('saved');
        } catch (e) {
            console.error("Save failed", e);
            setSaveStatus('error');
        }
    }, 2000); // 2 second debounce for saving

    return () => clearTimeout(timer);
  }, [notes, user, driveFileId]);


  // --- Event Handlers ---

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const zoomSensitivity = 0.001;
        const delta = -e.deltaY * zoomSensitivity;
        const newZoom = Math.min(Math.max(canvasState.zoom + delta, MIN_ZOOM), MAX_ZOOM);
        setCanvasState(prev => ({ ...prev, zoom: newZoom }));
    } else {
        setCanvasState(prev => ({
            ...prev,
            offset: {
                x: prev.offset.x - e.deltaX,
                y: prev.offset.y - e.deltaY
            }
        }));
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (draggingNoteId.current) return;
    isDraggingCanvas.current = true;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingNote.current && draggingNoteId.current) {
        const dx = (e.clientX - lastMousePos.current.x) / canvasState.zoom;
        const dy = (e.clientY - lastMousePos.current.y) / canvasState.zoom;

        setNotes(prev => prev.map(note => 
            note.id === draggingNoteId.current 
            ? { ...note, x: note.x + dx, y: note.y + dy }
            : note
        ));
        lastMousePos.current = { x: e.clientX, y: e.clientY };
    } else if (isDraggingCanvas.current) {
        const dx = e.clientX - lastMousePos.current.x;
        const dy = e.clientY - lastMousePos.current.y;

        setCanvasState(prev => ({
            ...prev,
            offset: { x: prev.offset.x + dx, y: prev.offset.y + dy }
        }));
        lastMousePos.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseUp = () => {
    isDraggingCanvas.current = false;
    isDraggingNote.current = false;
    draggingNoteId.current = null;
  };

  const onNoteStartDrag = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    isDraggingNote.current = true;
    draggingNoteId.current = id;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    setSelectedNoteId(id);
  }, []);

  const addNote = () => {
    const width = 400;
    const height = 320;
    const gap = 24;

    const viewCenterX = (-canvasState.offset.x + (window.innerWidth / 2)) / canvasState.zoom;
    const viewCenterY = (-canvasState.offset.y + (window.innerHeight / 2)) / canvasState.zoom;

    const startX = viewCenterX - width / 2;
    const startY = viewCenterY - height / 2;

    let finalX = startX;
    let finalY = startY;

    const checkOverlap = (x: number, y: number) => {
        return notes.some(note => 
            x < note.x + note.width + gap &&
            x + width + gap > note.x &&
            y < note.y + note.height + gap &&
            y + height + gap > note.y
        );
    };

    if (checkOverlap(startX, startY)) {
        let d = 0;
        let len = 1;
        let lenCount = 0;
        let turnCount = 0;
        let cx = 0;
        let cy = 0;

        for (let i = 0; i < 100; i++) {
            if (d === 0) cx++;
            else if (d === 1) cy++;
            else if (d === 2) cx--;
            else if (d === 3) cy--;

            lenCount++;
            
            if (lenCount === len) {
                lenCount = 0;
                d = (d + 1) % 4;
                turnCount++;
                if (turnCount === 2) {
                    turnCount = 0;
                    len++;
                }
            }

            const tryX = startX + (cx * (width + gap));
            const tryY = startY + (cy * (height + gap));

            if (!checkOverlap(tryX, tryY)) {
                finalX = tryX;
                finalY = tryY;
                break;
            }
        }
    }

    const newNote: ProjectNote = {
      id: uuidv4(),
      title: "New Note",
      content: "<ul><li>Item 1</li></ul>",
      x: finalX,
      y: finalY,
      width: width,
      height: height,
      color: ProjectColor.WHITE,
      createdAt: Date.now(),
      tags: [],
      priority: 'none'
    };
    setNotes([...notes, newNote]);
    setSelectedNoteId(newNote.id);
  };

  const updateNote = (id: string, updates: Partial<ProjectNote>) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, ...updates } : n));
  };

  const deleteNote = (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  const backgroundStyle = {
    backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
    backgroundSize: `${24 * canvasState.zoom}px ${24 * canvasState.zoom}px`,
    backgroundPosition: `${canvasState.offset.x}px ${canvasState.offset.y}px`,
  };

  // --- Render ---

  if (!user) {
      return (
          <LoginPage 
            onLogin={handleLogin}
            onGuestLogin={handleGuestLogin}
            isLoading={!isGoogleReady || isAuthLoading} 
            error={authError}
          />
      );
  }

  return (
    <div 
      className="w-screen h-screen overflow-hidden bg-gray-100 text-gray-900 select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      <div 
        className="absolute inset-0 z-0 pointer-events-none transition-colors duration-300"
        style={backgroundStyle}
      />

      <div 
        className="absolute inset-0 w-full h-full origin-top-left will-change-transform z-0"
        style={{
            transform: `translate(${canvasState.offset.x}px, ${canvasState.offset.y}px) scale(${canvasState.zoom})`
        }}
      >
        {notes.map(note => (
            <ProjectCard
                key={note.id}
                note={note}
                zoom={canvasState.zoom}
                isSelected={selectedNoteId === note.id}
                onUpdate={updateNote}
                onDelete={deleteNote}
                onSelect={setSelectedNoteId}
                onStartDrag={onNoteStartDrag}
            />
        ))}
      </div>

      <div className="fixed top-6 left-6 z-50 flex flex-col gap-4">
        <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-white/20">
          <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Horizon Canvas
          </h1>
          <p className="text-xs text-gray-500 mt-1">Spatial Project Manager</p>
        </div>
      </div>

      {/* User Profile */}
      <div className="fixed top-6 right-6 z-50 flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white/90 backdrop-blur-md pl-1 pr-4 py-1 rounded-full shadow-lg border border-white/20">
              {user.picture ? (
                  <img src={user.picture} alt={user.name} className="w-8 h-8 rounded-full border border-gray-200" />
              ) : (
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold border border-indigo-200">
                      {user.name.charAt(0)}
                  </div>
              )}
              <div className="flex flex-col">
                  <span className="text-xs font-bold text-gray-700">{user.name}</span>
                  <button 
                    onClick={handleSignOut}
                    className="text-[10px] text-red-500 text-left hover:underline"
                  >
                      {user.accessToken ? 'Sign Out' : 'Exit Guest Mode'}
                  </button>
              </div>
          </div>
      </div>

      {/* Cloud Status Indicator */}
      <div className="fixed bottom-6 left-6 z-50 flex items-center gap-2 px-3 py-1.5 bg-white/80 backdrop-blur rounded-full shadow-sm border border-gray-100">
         <div className={`w-2 h-2 rounded-full ${saveStatus === 'saved' ? 'bg-green-500' : saveStatus === 'error' ? 'bg-red-500' : 'bg-yellow-400 animate-pulse'}`} />
         <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">
            {user.accessToken 
                ? (saveStatus === 'saved' ? 'Synced to Drive' : saveStatus === 'error' ? 'Sync Error' : 'Syncing...') 
                : 'Local Storage (Guest)'}
         </span>
      </div>

      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-white/90 backdrop-blur-md px-2 py-2 rounded-full shadow-2xl border border-gray-200/50">
        <button 
          onClick={() => setCanvasState(s => ({ ...s, zoom: Math.max(s.zoom - 0.1, MIN_ZOOM) }))}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
          title="Zoom Out"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
        
        <span className="w-12 text-center text-xs font-mono text-gray-500">
            {Math.round(canvasState.zoom * 100)}%
        </span>

        <button 
          onClick={() => setCanvasState(s => ({ ...s, zoom: Math.min(s.zoom + 0.1, MAX_ZOOM) }))}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
          title="Zoom In"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1"></div>

        <button 
          onClick={addNote}
          className="bg-gray-900 hover:bg-black text-white px-6 py-2.5 rounded-full font-medium shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New
        </button>
      </div>
    </div>
  );
};

export default App;