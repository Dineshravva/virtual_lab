import React, { useEffect, useMemo, useState } from 'react';
import { predictionCards } from '../utils/learningContent';

export default function PredictionPanel({ activeLessonId, observeCount, onPlay }) {
  const card = useMemo(() => {
    return (
      predictionCards.find((item) => item.lessonId === activeLessonId) ||
      predictionCards[0]
    );
  }, [activeLessonId]);

  const [selectedIndex, setSelectedIndex] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [startingObserveCount, setStartingObserveCount] = useState(observeCount);

  useEffect(() => {
    setSelectedIndex(null);
    setRevealed(false);
    setStartingObserveCount(observeCount);
  }, [card.id, observeCount]);

  useEffect(() => {
    if (selectedIndex !== null && observeCount > startingObserveCount) {
      setRevealed(true);
    }
  }, [observeCount, selectedIndex, startingObserveCount]);

  const makeChoice = (index) => {
    setSelectedIndex(index);
    setRevealed(false);
    setStartingObserveCount(observeCount);
  };

  const isCorrect = selectedIndex === card.answerIndex;

  return (
    <div className="p-4 border-b border-gray-800">
      <h3 className="text-sm font-semibold text-lab-accent mb-3 uppercase tracking-wide">
        Predict Then Observe
      </h3>

      <div className="rounded border border-gray-800 bg-gray-900 p-3">
        <p className="mb-3 text-sm leading-relaxed text-white">{card.prompt}</p>

        <div className="space-y-2">
          {card.options.map((option, index) => {
            const isSelected = selectedIndex === index;
            const isAnswer = revealed && index === card.answerIndex;
            return (
              <button
                key={option}
                type="button"
                onClick={() => makeChoice(index)}
                className={`w-full rounded border px-2 py-2 text-left text-xs transition ${
                  isAnswer
                    ? 'border-emerald-500 bg-emerald-950 text-emerald-100'
                    : isSelected
                      ? 'border-lab-accent bg-sky-950 text-white'
                      : 'border-gray-800 bg-gray-950 text-gray-300 hover:border-gray-600'
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onPlay}
          disabled={selectedIndex === null}
          className="mt-3 w-full rounded bg-emerald-700 px-3 py-2 text-sm font-semibold text-white
                     transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Play To Observe
        </button>

        {revealed && (
          <div
            className={`mt-3 rounded border p-2 text-xs leading-relaxed ${
              isCorrect
                ? 'border-emerald-700 bg-emerald-950 text-emerald-100'
                : 'border-amber-700 bg-amber-950 text-amber-100'
            }`}
          >
            <div className="mb-1 font-semibold">
              {isCorrect ? 'Prediction matched.' : 'Good test. Compare the result.'}
            </div>
            {card.explanation}
          </div>
        )}
      </div>
    </div>
  );
}
