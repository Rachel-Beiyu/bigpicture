import React, { useState, useRef, useEffect } from 'react';
import { ProjectNote, ProjectColor, PriorityLevel } from '../types';
import { generateProjectIdeas } from '../services/geminiService';

interface ProjectCardProps {
  note: ProjectNote;
  zoom: number;
  isSelected: boolean;
  onUpdate: (id: string, updates: Partial<ProjectNote>) => void;
  onDelete: (id: string) => void;
  onSelect: (id: string) => void;
  onStartDrag: (e: React.MouseEvent, id: string) => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({
  note,
  zoom,
  isSelected,
  onUpdate,
  onDelete,
  onSelect,
  onStartDrag,
}) => {
  const [isAiLoading, setIsAiLoading] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);

  // Sync content updates
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== note.content) {
        if (document.activeElement !== editorRef.current) {
            editorRef.current.innerHTML = note.content;
        }
    }
  }, [note.content]);

  const handleContentInput = () => {
    if (editorRef.current) {
      onUpdate(note.id, { content: editorRef.current.innerHTML });
    }
  };

  const execCommand = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    if (editorRef.current) editorRef.current.focus();
    handleContentInput();
  };

  // Markdown shortcut handler
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === ' ') {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      const range = selection.getRangeAt(0);
      const node = range.startContainer;

      // Ensure we are working with a text node
      if (node.nodeType === Node.TEXT_NODE && node.textContent) {
        const offset = range.startOffset;
        // Get the text before the cursor
        const textBefore = node.textContent.slice(0, offset);

        let trigger: { cmd: string; val?: string } | null = null;

        // Check patterns
        if (textBefore === '#') trigger = { cmd: 'formatBlock', val: 'H1' };
        else if (textBefore === '##') trigger = { cmd: 'formatBlock', val: 'H2' };
        else if (textBefore === '###') trigger = { cmd: 'formatBlock', val: 'H3' };
        else if (textBefore === '*' || textBefore === '-') trigger = { cmd: 'insertUnorderedList' };
        else if (textBefore === '>') trigger = { cmd: 'formatBlock', val: 'BLOCKQUOTE' };
        // Regex for ordered list (1., 2., 10., etc.)
        else if (/^\d+\.$/.test(textBefore)) trigger = { cmd: 'insertOrderedList' };

        if (trigger) {
            e.preventDefault(); // Prevent the space insertion

            // Select the trigger characters to delete them
            const rangeToDelete = document.createRange();
            rangeToDelete.setStart(node, 0);
            rangeToDelete.setEnd(node, offset);
            selection.removeAllRanges();
            selection.addRange(rangeToDelete);

            // Delete trigger chars
            document.execCommand('delete');

            // Apply formatting
            document.execCommand(trigger.cmd, false, trigger.val);
        }
      }
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
           if(document.activeElement === editorRef.current) {
               execCommand('insertImage', event.target.result as string);
           } else {
               editorRef.current?.focus();
               execCommand('insertImage', event.target.result as string);
           }
        }
      };
      reader.readAsDataURL(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  
  const handleTextColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      execCommand('foreColor', e.target.value);
  };

  const handleAiBrainstorm = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsAiLoading(true);
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = note.content;
    const plainText = tempDiv.textContent || "";
    
    const suggestion = await generateProjectIdeas(note.title, plainText);
    
    const newContent = note.content + `<br/><br/><strong>AI Suggestion:</strong><br/>` + suggestion.replace(/\n/g, '<br/>');
    onUpdate(note.id, { content: newContent });
    setIsAiLoading(false);
  };

  const handleColorChange = (color: ProjectColor) => {
    onUpdate(note.id, { color });
  };

  // Helper to map color constant to a header background style
  const getHeaderStyle = (baseColor: string) => {
     switch (baseColor) {
        case ProjectColor.BLUE: return 'bg-blue-100 border-blue-200';
        case ProjectColor.YELLOW: return 'bg-yellow-100 border-yellow-200';
        case ProjectColor.GREEN: return 'bg-green-100 border-green-200';
        case ProjectColor.RED: return 'bg-red-100 border-red-200';
        case ProjectColor.PURPLE: return 'bg-purple-100 border-purple-200';
        default: return 'bg-gray-100 border-gray-200';
     }
  };

  // Resize logic
  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent canvas drag
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = note.width;
    const startHeight = note.height;
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = (moveEvent.clientX - startX) / zoom;
      const deltaY = (moveEvent.clientY - startY) / zoom;
      onUpdate(note.id, { 
        width: Math.max(300, startWidth + deltaX), 
        height: Math.max(200, startHeight + deltaY) 
      });
    };
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Prevent drag propagation when clicking inside the card (except header)
  const handleCardMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation(); 
    onSelect(note.id);
  };

  return (
    <div
      className={`absolute flex flex-col shadow-sm transition-shadow duration-200 
        bg-white
        ${isSelected ? 'shadow-2xl ring-2 ring-blue-400 z-20' : 'shadow-md hover:shadow-xl z-0'}
        rounded-xl overflow-hidden border border-black/10`}
      style={{
        left: note.x,
        top: note.y,
        width: note.width,
        height: note.height,
        transform: `scale(1)`,
      }}
      onMouseDown={handleCardMouseDown}
    >
      {/* Header Bar */}
      <div
        className={`h-11 w-full flex items-center justify-between px-3 cursor-grab active:cursor-grabbing select-none shrink-0 border-b ${getHeaderStyle(note.color)}`}
        onMouseDown={(e) => onStartDrag(e, note.id)}
      >
        <div className="flex gap-2 items-center group">
           {/* Color Picker (visible on group hover) */}
           <div className="flex gap-1 -ml-1 mr-1 opacity-40 group-hover:opacity-100 transition-opacity">
            {Object.values(ProjectColor).map((c) => (
                <button
                key={c}
                className={`w-3 h-3 rounded-full border border-black/10 ${c === note.color ? 'ring-1 ring-offset-1 ring-gray-500 scale-110' : ''} ${c}`}
                onClick={(e) => { e.stopPropagation(); handleColorChange(c); }}
                title="Change Note Color"
                onMouseDown={(e) => e.stopPropagation()}
                />
            ))}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
            {/* Priority Dropdown */}
            <div className="relative">
                <select
                    value={note.priority}
                    onChange={(e) => onUpdate(note.id, { priority: e.target.value as PriorityLevel })}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    className={`
                        appearance-none pl-2 pr-6 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white/50 hover:bg-white/80 transition-colors
                        ${note.priority === 'high' ? 'text-red-600 border-red-200' : ''}
                        ${note.priority === 'medium' ? 'text-orange-600 border-orange-200' : ''}
                        ${note.priority === 'low' ? 'text-blue-600 border-blue-200' : ''}
                        ${note.priority === 'none' ? 'text-gray-400 border-gray-200 font-normal' : ''}
                    `}
                >
                    <option value="none">None</option>
                    <option value="low">Low</option>
                    <option value="medium">Med</option>
                    <option value="high">High</option>
                </select>
                {/* Custom Arrow Icon for Select */}
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                   <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>
                </div>
            </div>

            {/* Delete */}
            <button 
                className="text-black/30 hover:text-red-500 transition-colors p-1"
                onClick={(e) => { e.stopPropagation(); onDelete(note.id); }}
                onMouseDown={(e) => e.stopPropagation()}
                title="Delete Project"
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
      </div>

      {/* Content Area - Always White */}
      <div className="flex-1 flex flex-col overflow-hidden relative bg-white">
        {/* Title Input */}
        <div className="px-4 pt-4 pb-2 shrink-0">
             <input
                type="text"
                value={note.title}
                onChange={(e) => onUpdate(note.id, { title: e.target.value })}
                placeholder="Title..."
                className="bg-transparent text-xl font-bold text-gray-800 placeholder-gray-300 focus:outline-none w-full"
            />
            <div className="text-xs text-gray-400 font-mono mt-1 flex justify-between">
                <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                {note.priority !== 'none' && (
                    <span className={`
                        ${note.priority === 'high' ? 'text-red-500' : ''}
                        ${note.priority === 'medium' ? 'text-orange-500' : ''}
                        ${note.priority === 'low' ? 'text-blue-500' : ''}
                    `}>
                        {note.priority.toUpperCase()} PRIORITY
                    </span>
                )}
            </div>
        </div>

        {/* Rich Text Toolbar */}
        <div className="px-4 py-1.5 flex gap-1 border-b border-gray-100 shrink-0 overflow-x-auto custom-scrollbar items-center bg-gray-50/50">
            <ToolbarButton icon="B" onClick={() => execCommand('bold')} label="Bold" bold />
            <ToolbarButton icon="I" onClick={() => execCommand('italic')} label="Italic" italic />
            <ToolbarButton icon="U" onClick={() => execCommand('underline')} label="Underline" underline />
            <div className="w-px h-4 bg-gray-300 mx-1" />
            <ToolbarButton icon="•" onClick={() => execCommand('insertUnorderedList')} label="List" />
            <div className="w-px h-4 bg-gray-300 mx-1" />
            
            {/* Text Color Picker */}
            <div className="relative flex items-center">
                 <button 
                    onClick={() => colorInputRef.current?.click()}
                    className="w-6 h-6 flex flex-col items-center justify-center rounded hover:bg-gray-200 text-gray-600 transition-colors"
                    title="Text Color"
                    onMouseDown={(e) => e.stopPropagation()}
                 >
                    <span className="font-serif text-sm font-bold leading-none mt-1">A</span>
                    <span className="w-3 h-0.5 bg-red-500 mt-0.5 rounded-full"></span>
                </button>
                <input 
                    ref={colorInputRef}
                    type="color" 
                    className="absolute opacity-0 pointer-events-none w-0 h-0"
                    onChange={handleTextColorChange}
                />
            </div>

            <div className="w-px h-4 bg-gray-300 mx-1" />
            <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-200 text-gray-500 text-xs"
                title="Insert Image"
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            </button>
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={handleImageUpload}
            />
        </div>

        {/* Editor */}
        <div 
            ref={editorRef}
            contentEditable
            onInput={handleContentInput}
            onBlur={handleContentInput}
            onKeyDown={handleKeyDown}
            suppressContentEditableWarning
            className="flex-1 p-4 focus:outline-none overflow-y-auto custom-scrollbar text-sm text-gray-700 leading-relaxed rich-text-content selection:bg-blue-100 selection:text-blue-900"
            style={{ minHeight: '100px', cursor: 'text' }}
            onMouseDown={(e) => e.stopPropagation()} // Ensure click in editor doesn't start drag
        />

        {/* Footer Actions (Modified: Tags Removed) */}
        <div className="p-3 border-t border-gray-100 flex items-center justify-end shrink-0 bg-white">
            <button
                onClick={handleAiBrainstorm}
                disabled={isAiLoading}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold text-white transition-all
                  ${isAiLoading ? 'bg-indigo-300 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-700 shadow-sm hover:shadow'}
                `}
            >
                {isAiLoading ? (
                    <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                ) : (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                )}
                AI ASSIST
            </button>
        </div>
      </div>

      {/* Resize Handle */}
      <div 
        className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize flex items-center justify-center text-gray-300 hover:text-gray-500 z-20"
        onMouseDown={handleResizeStart}
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
           <path d="M21 15v6" />
           <path d="M15 21h6" />
           <path d="M21 21l-9-9" />
        </svg>
      </div>
      
      {/* Styles for content editable specifics */}
      <style>{`
        .rich-text-content h1 { font-size: 1.5em; font-weight: 700; margin-bottom: 0.5em; line-height: 1.2; }
        .rich-text-content h2 { font-size: 1.25em; font-weight: 600; margin-bottom: 0.5em; line-height: 1.2; }
        .rich-text-content h3 { font-size: 1.1em; font-weight: 600; margin-bottom: 0.5em; }
        .rich-text-content ul { list-style-type: disc; padding-left: 1.2em; margin-bottom: 0.5em; }
        .rich-text-content ol { list-style-type: decimal; padding-left: 1.2em; margin-bottom: 0.5em; }
        .rich-text-content b { font-weight: 700; }
        .rich-text-content img { max-width: 100%; border-radius: 4px; margin: 8px 0; border: 1px solid #eee; }
        .rich-text-content blockquote { border-left: 3px solid #e5e7eb; padding-left: 1em; color: #6b7280; font-style: italic; }
      `}</style>
    </div>
  );
};

// Simple Toolbar helper
const ToolbarButton: React.FC<{ 
    icon: string; 
    onClick: () => void; 
    label: string; 
    bold?: boolean; 
    italic?: boolean; 
    underline?: boolean;
}> = ({ icon, onClick, label, bold, italic, underline }) => (
    <button
        onClick={onClick}
        className={`
            w-6 h-6 flex items-center justify-center rounded hover:bg-gray-200 text-gray-600 transition-colors
            ${bold ? 'font-bold bg-gray-200' : ''} ${italic ? 'italic bg-gray-200' : ''} ${underline ? 'underline bg-gray-200' : ''}
            text-xs font-serif
        `}
        title={label}
        onMouseDown={(e) => e.stopPropagation()}
    >
        {icon}
    </button>
);

export default ProjectCard;