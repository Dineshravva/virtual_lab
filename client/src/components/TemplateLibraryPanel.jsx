import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { experimentTemplates } from '../utils/learningContent';

/**
 * Skeleton placeholder shown while templates are loading.
 */
function SkeletonCard() {
  return (
    <div className="template-card template-card--skeleton" aria-hidden="true">
      <div className="template-skeleton-bar" style={{ width: '60%', height: 14 }} />
      <div className="template-skeleton-bar" style={{ width: '100%', height: 10, marginTop: 8 }} />
      <div className="template-skeleton-bar" style={{ width: '85%', height: 10, marginTop: 4 }} />
      <div className="template-skeleton-bar" style={{ width: 90, height: 28, marginTop: 12, borderRadius: 6 }} />
    </div>
  );
}

/**
 * A single template card with fade-in animation.
 */
function TemplateCard({ template, onLoad, index }) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Staggered fade-in
    const timer = setTimeout(() => setLoaded(true), 60 * index);
    return () => clearTimeout(timer);
  }, [index]);

  // Determine an icon/emoji based on topic
  const topicIcon = useMemo(() => {
    const lower = (template.topic || '').toLowerCase();
    if (lower.includes('oscillat')) return '🔄';
    if (lower.includes('collision')) return '💥';
    if (lower.includes('motion')) return '🚀';
    if (lower.includes('wave')) return '🌊';
    return '🔬';
  }, [template.topic]);

  // Colour based on topic for the accent stripe
  const accentColor = useMemo(() => {
    const lower = (template.topic || '').toLowerCase();
    if (lower.includes('oscillat')) return '#38bdf8';
    if (lower.includes('collision')) return '#f97316';
    if (lower.includes('motion')) return '#a78bfa';
    if (lower.includes('wave')) return '#f472b6';
    return '#38bdf8';
  }, [template.topic]);

  return (
    <div
      className={`template-card ${loaded ? 'template-card--visible' : ''}`}
      style={{ '--accent': accentColor }}
    >
      <div className="template-card-accent" />
      <div className="template-card-content">
        <div className="template-card-header">
          <span className="template-card-icon">{topicIcon}</span>
          <span className="template-card-name">{template.name}</span>
        </div>
        <p className="template-card-description">{template.description}</p>
        <div className="template-card-meta">
          <span className="template-card-badge">
            {template.bodies ? template.bodies.length : 0} {template.bodies && template.bodies.length === 1 ? 'body' : 'bodies'}
          </span>
          <span className="template-card-badge">
            {template.constraints ? template.constraints.length : 0} {template.constraints && template.constraints.length === 1 ? 'constraint' : 'constraints'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onLoad(template)}
          className="template-card-load-btn"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          Load Template
        </button>
      </div>
    </div>
  );
}

/**
 * Template Library Panel — shows categorized experiment templates in a
 * responsive grid with loading skeletons, error handling, and smooth
 * fade-in animations.
 */
export default function TemplateLibraryPanel({ onLoadTemplate }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [templates, setTemplates] = useState([]);

  // Simulate async loading to give skeleton visual feedback
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    // Templates are local static data, but we wrap with a small timeout
    // so the skeleton is visible for a moment and the rendering doesn't
    // jank if more templates are added later.
    const timer = setTimeout(() => {
      try {
        if (cancelled) return;
        if (!experimentTemplates || !Array.isArray(experimentTemplates) || experimentTemplates.length === 0) {
          setError('No templates available.');
          setTemplates([]);
        } else {
          // Validate each template before storing
          const valid = experimentTemplates.filter((t) => {
            return (
              t &&
              typeof t === 'object' &&
              t.id &&
              t.name &&
              Array.isArray(t.bodies)
            );
          });
          if (valid.length === 0) {
            setError('Templates could not be parsed.');
          }
          setTemplates(valid);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[TemplateLibrary] Failed to load templates', err);
          setError('Failed to load templates. Please try again.');
          setTemplates([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const topics = useMemo(() => {
    return [...new Set(templates.map((t) => t.topic).filter(Boolean))];
  }, [templates]);

  const [activeTopic, setActiveTopic] = useState(null);

  // Set default topic once topics are loaded
  useEffect(() => {
    if (topics.length > 0 && activeTopic === null) {
      setActiveTopic(topics[0]);
    }
  }, [topics, activeTopic]);

  const visibleTemplates = useMemo(() => {
    if (!activeTopic) return templates;
    return templates.filter((t) => t.topic === activeTopic);
  }, [templates, activeTopic]);

  const handleRetry = useCallback(() => {
    setLoading(true);
    setError(null);
    const timer = setTimeout(() => {
      try {
        const valid = (experimentTemplates || []).filter((t) =>
          t && t.id && t.name && Array.isArray(t.bodies)
        );
        setTemplates(valid);
        if (valid.length === 0) setError('No templates available.');
      } catch {
        setError('Failed to load templates.');
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="template-library">
      <h3 className="text-sm font-semibold text-lab-accent mb-3 uppercase tracking-wide flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
        </svg>
        Template Library
        {!loading && templates.length > 0 && (
          <span className="template-library-count">{templates.length}</span>
        )}
      </h3>

      {/* Error state */}
      {error && !loading && (
        <div className="template-library-error">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{error}</span>
          <button type="button" onClick={handleRetry} className="template-library-retry">
            Retry
          </button>
        </div>
      )}

      {/* Topic filter tabs */}
      {!loading && topics.length > 1 && (
        <div className="template-topic-tabs">
          <button
            type="button"
            onClick={() => setActiveTopic(null)}
            className={`template-topic-tab ${activeTopic === null ? 'template-topic-tab--active' : ''}`}
          >
            All
          </button>
          {topics.map((topic) => (
            <button
              key={topic}
              type="button"
              onClick={() => setActiveTopic(topic)}
              className={`template-topic-tab ${activeTopic === topic ? 'template-topic-tab--active' : ''}`}
            >
              {topic}
            </button>
          ))}
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="template-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && visibleTemplates.length === 0 && (
        <div className="template-library-empty">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <p>No templates for this topic.</p>
        </div>
      )}

      {/* Template grid */}
      {!loading && visibleTemplates.length > 0 && (
        <div className="template-grid">
          {visibleTemplates.map((template, index) => (
            <TemplateCard
              key={template.id}
              template={template}
              onLoad={onLoadTemplate}
              index={index}
            />
          ))}
        </div>
      )}
    </div>
  );
}
