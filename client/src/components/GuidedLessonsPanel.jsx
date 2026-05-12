import React, { useMemo, useState } from 'react';
import { experimentTemplates, lessonChapters } from '../utils/learningContent';

export default function GuidedLessonsPanel({ onAddTemplate, onLessonChange }) {
  const fallbackLessonId = lessonChapters[0] ? lessonChapters[0].id : null;
  const [activeLessonId, setActiveLessonId] = useState(fallbackLessonId);
  const [stepIndex, setStepIndex] = useState(0);

  const activeLesson = useMemo(
    () =>
      lessonChapters.find((lesson) => lesson.id === activeLessonId) ||
      lessonChapters[0] ||
      null,
    [activeLessonId]
  );

  if (!activeLesson) {
    return (
      <div className="p-4 border-b border-gray-800 text-xs text-gray-500">
        No lessons available.
      </div>
    );
  }

  const safeStepIndex = Math.min(
    Math.max(0, stepIndex),
    Math.max(0, activeLesson.steps.length - 1)
  );
  const activeStep = activeLesson.steps[safeStepIndex];
  const template = experimentTemplates.find(
    (item) => item.id === activeLesson.templateId
  );

  const selectLesson = (lessonId) => {
    setActiveLessonId(lessonId);
    setStepIndex(0);
    if (onLessonChange) onLessonChange(lessonId);
  };

  const nextStep = () => {
    setStepIndex((current) =>
      Math.min(activeLesson.steps.length - 1, current + 1)
    );
  };

  const previousStep = () => {
    setStepIndex((current) => Math.max(0, current - 1));
  };

  return (
    <div className="p-4 border-b border-gray-800">
      <h3 className="text-sm font-semibold text-lab-accent mb-3 uppercase tracking-wide">
        Guided Lessons
      </h3>

      <div className="grid grid-cols-3 gap-1 mb-3">
        {lessonChapters.map((lesson) => (
          <button
            key={lesson.id}
            type="button"
            onClick={() => selectLesson(lesson.id)}
            className={`rounded border px-2 py-1.5 text-xs transition ${
              activeLessonId === lesson.id
                ? 'border-lab-accent bg-sky-950 text-white'
                : 'border-gray-800 bg-gray-900 text-gray-300 hover:border-gray-600'
            }`}
          >
            {lesson.title}
          </button>
        ))}
      </div>

      <div className="rounded border border-gray-800 bg-gray-900 p-3">
        <div className="mb-2 text-sm font-semibold text-white">
          {activeLesson.title}
        </div>
        <p className="mb-3 text-xs leading-relaxed text-gray-400">
          {activeLesson.summary}
        </p>

        <button
          type="button"
          onClick={() => onAddTemplate(template)}
          className="mb-3 w-full rounded bg-lab-accent px-3 py-2 text-sm font-semibold text-black
                     transition hover:bg-sky-400"
        >
          Load Setup
        </button>

        <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
          Step {safeStepIndex + 1} of {activeLesson.steps.length}
        </div>
        <div className="mt-1 text-sm text-white">
          {activeStep ? activeStep.goal : 'No steps in this lesson.'}
        </div>
        {activeStep && (
          <div className="mt-2 rounded border border-gray-800 bg-gray-950 p-2 text-xs leading-relaxed text-gray-400">
            {activeStep.hint}
          </div>
        )}

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={previousStep}
            disabled={safeStepIndex === 0}
            className="flex-1 rounded border border-gray-700 px-2 py-1.5 text-xs text-gray-200
                       transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={nextStep}
            disabled={safeStepIndex >= activeLesson.steps.length - 1}
            className="flex-1 rounded border border-gray-700 px-2 py-1.5 text-xs text-gray-200
                       transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
