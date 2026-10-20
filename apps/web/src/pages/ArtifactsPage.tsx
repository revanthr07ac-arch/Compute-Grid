import React, { useState, useEffect } from 'react';
import {
  FileCheck,
  Download,
  Eye,
  Copy,
  Check,
  ShieldCheck,
  X,
  FileText,
  RefreshCw,
} from 'lucide-react';
import { api } from '../services/api.js';

export const ArtifactsPage: React.FC = () => {
  const [artifacts, setArtifacts] = useState<any[]>([]);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewFilename, setPreviewFilename] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchArtifacts = async () => {
    try {
      const data = await api.get<any[]>('/artifacts');
      setArtifacts(
        (data || []).map((a: any) => ({
          ...a,
          jobName: a.job?.name || 'Artifact Payload',
        }))
      );
    } catch (err) {
      console.error('Failed to load artifacts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArtifacts();
  }, []);

  const handlePreview = async (artifact: any) => {
    try {
      setPreviewFilename(artifact.filename);
      const res = await fetch(`/api/v1/artifacts/${artifact.id}/download`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const text = await res.text();
      setPreviewContent(text);
    } catch (err: any) {
      alert(`Preview failed: ${err.message}`);
    }
  };

  const copyChecksum = (checksum: string, id: string) => {
    navigator.clipboard.writeText(checksum);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Results & Artifacts</h1>
          <p className="text-xs text-slate-400 mt-1">
            Download validated compute outputs, inspect cryptographic checksums, and view safe previews.
          </p>
        </div>
        <button
          onClick={fetchArtifacts}
          className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        {artifacts.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            <FileCheck className="w-10 h-10 mx-auto mb-2 text-slate-600 stroke-1" />
            <p className="text-sm font-semibold text-slate-300">No generated artifacts found</p>
            <p className="text-xs text-slate-500 mt-1">
              Completed compute jobs will automatically deposit validated outputs here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-900/40">
                  <th className="py-3.5 pl-4">Artifact Name</th>
                  <th className="py-3.5">Associated Job</th>
                  <th className="py-3.5">File Size</th>
                  <th className="py-3.5">SHA-256 Checksum</th>
                  <th className="py-3.5">Generated At</th>
                  <th className="py-3.5 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {artifacts.map(a => (
                  <tr key={a.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3.5 pl-4 font-semibold text-white flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-400" />
                      {a.filename}
                    </td>
                    <td className="py-3.5 text-slate-300">{a.jobName}</td>
                    <td className="py-3.5 font-mono text-slate-400">
                      {formatBytes(a.sizeBytes)}
                    </td>
                    <td className="py-3.5">
                      <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
                        <span className="truncate max-w-[140px]">{a.checksumSha256}</span>
                        <button
                          onClick={() => copyChecksum(a.checksumSha256, a.id)}
                          className="p-1 hover:text-white transition"
                          title="Copy Full Checksum"
                        >
                          {copiedId === a.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="py-3.5 text-slate-400">
                      {new Date(a.createdAt).toLocaleDateString()} {new Date(a.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3.5 pr-4 text-right space-x-2">
                      <button
                        onClick={() => handlePreview(a)}
                        className="py-1 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition inline-flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-400" /> Preview
                      </button>
                      <a
                        href={`/api/v1/artifacts/${a.id}/download`}
                        target="_blank"
                        rel="noreferrer"
                        className="py-1 px-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition inline-flex items-center gap-1"
                      >
                        <Download className="w-3.5 h-3.5" /> Download
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Safe Preview Modal */}
      {previewContent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-2xl rounded-2xl border border-slate-700 p-6 shadow-2xl relative">
            <button
              onClick={() => setPreviewContent(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-sm font-bold text-white mb-4">
              <Eye className="w-4 h-4 text-blue-400" />
              <span>Safe Artifact Preview: {previewFilename}</span>
            </div>

            <pre className="h-80 bg-black/80 rounded-xl p-4 font-mono text-xs text-slate-200 overflow-y-auto border border-slate-800">
              {previewContent}
            </pre>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setPreviewContent(null)}
                className="py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
