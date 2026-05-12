import React, { useMemo, useState } from 'react';
import { quizQuestions } from '../utils/learningContent';

export default function QuizPanel() {
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const score = useMemo(() => {
    return quizQuestions.reduce((total, question) => {
      return answers[question.id] === question.answerIndex ? total + 1 : total;
    }, 0);
  }, [answers]);

  const answerQuestion = (questionId, index) => {
    setAnswers((current) => ({ ...current, [questionId]: index }));
    setSubmitted(false);
  };

  const reset = () => {
    setAnswers({});
    setSubmitted(false);
  };

  const allAnswered = quizQuestions.every(
    (question) => typeof answers[question.id] === 'number'
  );

  return (
    <div className="p-4 border-b border-gray-800">
      <h3 className="text-sm font-semibold text-lab-accent mb-3 uppercase tracking-wide">
        Quiz Mode
      </h3>

      <div className="space-y-3">
        {quizQuestions.map((question, questionIndex) => (
          <div
            key={question.id}
            className="rounded border border-gray-800 bg-gray-900 p-3"
          >
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Question {questionIndex + 1}
            </div>
            <div className="mb-2 text-sm leading-relaxed text-white">
              {question.question}
            </div>
            <div className="space-y-1">
              {question.options.map((option, optionIndex) => {
                const selected = answers[question.id] === optionIndex;
                const correct = submitted && question.answerIndex === optionIndex;
                const wrong = submitted && selected && !correct;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => answerQuestion(question.id, optionIndex)}
                    className={`w-full rounded border px-2 py-1.5 text-left text-xs transition ${
                      correct
                        ? 'border-emerald-500 bg-emerald-950 text-emerald-100'
                        : wrong
                          ? 'border-red-500 bg-red-950 text-red-100'
                          : selected
                            ? 'border-lab-accent bg-sky-950 text-white'
                            : 'border-gray-800 bg-gray-950 text-gray-300 hover:border-gray-600'
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => setSubmitted(true)}
          disabled={!allAnswered}
          className="flex-1 rounded bg-lab-accent px-3 py-2 text-sm font-semibold text-black
                     transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Check
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded border border-gray-700 px-3 py-2 text-sm text-gray-200 transition hover:bg-gray-800"
        >
          Reset
        </button>
      </div>

      {submitted && (
        <div className="mt-3 rounded border border-gray-800 bg-gray-950 p-2 text-xs text-gray-300">
          Score: <span className="text-white">{score}</span> / {quizQuestions.length}
        </div>
      )}
    </div>
  );
}
