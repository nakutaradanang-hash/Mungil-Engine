import React, { useMemo, useState } from 'react';
import { Check, ExternalLink, RefreshCw, Search } from 'lucide-react';
import {
  GITHUB_33_KEYWORDS,
  fetchLiveGitHubTop10,
  search33KeywordsCatalog,
} from '../engine/github33Catalog';
import type { GitHubRepoEntry } from '../engine/types';

interface GitHub33PanelProps {
  adoptedRepos: string[];
  onToggleAdoptRepo: (repo: string) => void;
}

export const GitHub33Panel: React.FC<GitHub33PanelProps> = ({
  adoptedRepos,
  onToggleAdoptRepo,
}) => {
  const [selectedKeyword, setSelectedKeyword] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [liveOverrides, setLiveOverrides] = useState<Record<string, GitHubRepoEntry[]>>({});
  const [loadingLive, setLoadingLive] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);

  const groups = useMemo(() => {
    const base = search33KeywordsCatalog(query, selectedKeyword);
    return base.map((g) => ({
      ...g,
      repos: Object.hasOwn(liveOverrides, g.keyword) ? liveOverrides[g.keyword] : g.repos,
    }));
  }, [query, selectedKeyword, liveOverrides]);

  const totalShownRepos = groups.reduce((acc, g) => acc + g.repos.length, 0);

  const handleRefreshLive = async () => {
    const targetKw = selectedKeyword === 'all' ? 'game' : selectedKeyword;
    setLoadingLive(true);
    setLiveError(null);
    try {
      const fresh = await fetchLiveGitHubTop10(targetKw);
      if (fresh.length > 0) {
        setLiveOverrides((prev) => ({ ...prev, [targetKw]: fresh }));
      }
    } catch {
      setLiveError('GitHub public rate limit reached — displaying curated offline DNA catalog.');
    } finally {
      setLoadingLive(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase text-amber-600 dark:text-amber-400">
              33 Keywords × Top 10 Open-Source Repositories = 330 DNA Connectors
            </p>
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
              GitHub Ecosystem & Multi-Agent Skill Catalog
            </h2>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
            <span>{adoptedRepos.length} Adopted</span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-600 dark:text-slate-400">{totalShownRepos} Visible</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search 330 repos by keyword, license, or engine integration..."
              className="h-9 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-9 pr-3 text-xs text-slate-900 dark:text-white"
            />
          </div>
          <button
            type="button"
            onClick={handleRefreshLive}
            disabled={loadingLive}
            className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingLive ? 'animate-spin' : ''}`} />
            Sync Live GitHub Top 10 ({selectedKeyword === 'all' ? 'game' : selectedKeyword})
          </button>
        </div>

        {liveError && <div className="text-xs text-amber-600 dark:text-amber-400">{liveError}</div>}

        {/* All 33 Keyword Selector Grid */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          <button
            type="button"
            onClick={() => setSelectedKeyword('all')}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
              selectedKeyword === 'all'
                ? 'bg-amber-500 text-slate-950'
                : 'border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-amber-500'
            }`}
          >
            All 33 Keywords
          </button>
          {GITHUB_33_KEYWORDS.map((kw) => (
            <button
              key={kw}
              type="button"
              onClick={() => setSelectedKeyword(kw)}
              className={`rounded-lg px-2.5 py-1 font-mono text-[11px] ${
                selectedKeyword === kw
                  ? 'bg-amber-500 font-semibold text-slate-950'
                  : 'border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-amber-500'
              }`}
            >
              {kw}
            </button>
          ))}
        </div>
      </div>

      {/* Keyword Groups & Ranked Repositories */}
      <div className="space-y-4">
        {groups.map((group) => (
          <div
            key={group.keyword}
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold uppercase text-amber-600 dark:text-amber-400">
                  #{group.keyword}
                </span>
                <span className="text-xs text-slate-500">·</span>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{group.category}</span>
              </div>
              <span className="font-mono text-[11px] tabular-nums text-slate-500">
                Top {group.repos.length} Free OSS
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {group.repos.map((repo) => {
                const isAdopted = adoptedRepos.includes(repo.repo);
                return (
                  <div
                    key={`${group.keyword}-${repo.repo}`}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3 flex flex-col justify-between gap-2"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <a
                          href={repo.url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono font-semibold text-slate-900 dark:text-white hover:text-amber-500 inline-flex items-center gap-1 truncate"
                        >
                          <span className="text-slate-400">#{repo.rank}</span>
                          <span className="truncate">{repo.repo}</span>
                          <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                        </a>
                        <span className="font-mono text-[11px] tabular-nums text-amber-600 dark:text-amber-400 shrink-0">
                          {repo.starsLabel} · {repo.license}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400">{repo.description}</p>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-200/70 dark:border-slate-800 text-[11px]">
                      <span className="text-sky-700 dark:text-sky-300 truncate">{repo.dnaIntegration}</span>
                      <button
                        type="button"
                        onClick={() => onToggleAdoptRepo(repo.repo)}
                        className={`inline-flex items-center gap-1 whitespace-nowrap shrink-0 rounded-md px-2.5 py-1 font-semibold ${
                          isAdopted
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-amber-500 hover:text-slate-950'
                        }`}
                      >
                        {isAdopted && <Check className="h-3 w-3" />}
                        {isAdopted ? 'Adopted' : 'Adopt DNA'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
