import React, { useState } from 'react';
import { 
  FileCode, Download, Copy, Check, FolderArchive
} from 'lucide-react';
import JSZip from 'jszip';
import { PROJECT_FILES, ProjectFile } from '../data/projectFiles';

interface ProjectFilesExportProps {
  onDownloadAllZip: () => void;
  isZipping: boolean;
}

export const ProjectFilesExport: React.FC<ProjectFilesExportProps> = ({
  onDownloadAllZip,
  isZipping,
}) => {
  const [selectedFileId, setSelectedFileId] = useState<string>('main_improved');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const selectedFile: ProjectFile =
    PROJECT_FILES.find((f) => f.id === selectedFileId) || PROJECT_FILES[0];

  const copyFileContent = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const downloadSingleFile = (file: ProjectFile) => {
    const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.filename.includes('(') ? file.filename.split(' ')[0] : file.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Файлы проекта и экспорт исходников
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Все обновленные файлы готовы к копированию или скачиванию единым архивом .zip для PlatformIO.
          </p>
        </div>

        <button
          onClick={onDownloadAllZip}
          disabled={isZipping}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors cursor-pointer shadow-sm disabled:opacity-50 shrink-0"
        >
          <FolderArchive className="w-4 h-4" />
          <span>{isZipping ? 'Упаковка ZIP...' : 'Скачать весь проект (.zip)'}</span>
        </button>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: File Tree */}
        <div className="lg:col-span-4 bg-[#0e131a] p-4 rounded-2xl border border-slate-800 space-y-2">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 py-1 flex items-center justify-between">
            <span>Дерево проекта (PlatformIO)</span>
            <span className="text-[11px] font-mono text-emerald-400">{PROJECT_FILES.length} файлов</span>
          </div>

          <div className="space-y-1">
            {PROJECT_FILES.map((file) => {
              const isSelected = selectedFile.id === file.id;
              return (
                <button
                  key={file.id}
                  onClick={() => setSelectedFileId(file.id)}
                  className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                    isSelected
                      ? 'bg-[#141b25] border-emerald-500/60 shadow-sm'
                      : 'bg-transparent border-transparent text-slate-400 hover:bg-[#121822] hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileCode
                      className={`w-4 h-4 shrink-0 ${
                        isSelected ? 'text-emerald-400' : 'text-slate-500'
                      }`}
                    />
                    <div className="truncate">
                      <div className={`text-xs font-mono truncate ${isSelected ? 'text-white font-semibold' : 'text-slate-300'}`}>
                        {file.filename}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono truncate">
                        {file.path}
                      </div>
                    </div>
                  </div>

                  {file.isNew && (
                    <span className="text-[10px] font-mono uppercase bg-emerald-950 text-emerald-400 border border-emerald-800/80 px-1.5 py-0.5 rounded shrink-0">
                      NEW
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Help Box */}
          <div className="p-3.5 bg-[#080b0f] rounded-xl border border-slate-800/80 text-xs text-slate-400 space-y-2 mt-4">
            <span className="text-white font-semibold block">Как применить в VS Code:</span>
            <p className="text-[11px] leading-relaxed">
              1. Скачайте .zip архив по кнопке вверху.
              <br />
              2. Распакуйте в папку вашего проекта PlatformIO с заменой файлов.
              <br />
              3. Заполните <code className="text-emerald-400 font-mono">include/secrets.h</code> своими данными Wi-Fi и MQTT.
            </p>
          </div>
        </div>

        {/* Right Column: Code Viewer */}
        <div className="lg:col-span-8 bg-[#0e131a] rounded-2xl border border-slate-800 overflow-hidden flex flex-col">
          {/* File Header Bar */}
          <div className="p-4 bg-[#121822] border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-bold text-white font-mono">
                  {selectedFile.path}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {selectedFile.description}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => copyFileContent(selectedFile.content, selectedFile.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer border border-slate-700"
              >
                {copiedId === selectedFile.id ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedId === selectedFile.id ? 'Скопировано!' : 'Копировать'}</span>
              </button>

              <button
                onClick={() => downloadSingleFile(selectedFile)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors cursor-pointer"
                title="Скачать этот отдельный файл"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Скачать файл</span>
              </button>
            </div>
          </div>

          {/* Code Viewer Pre/Code */}
          <pre className="p-5 text-xs font-mono text-slate-300 overflow-x-auto max-h-[620px] leading-relaxed bg-[#080b0f] flex-1">
            <code>{selectedFile.content}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
