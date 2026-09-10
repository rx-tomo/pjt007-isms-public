'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { PUBLIC_RESEARCH_INTERVIEW_URL } from '@/lib/publicLinks';

type ResultBand = 'exploring' | 'preparing' | 'operating';
type Screen = 'intro' | 'questions' | 'result';

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

const QUESTION_COUNT = 5;
const QUESTION_KEYS = ['scope', 'risk', 'evidence', 'response', 'improvement'] as const;
const RESPONSE_OPTIONS = [
  { key: 'notStarted', score: 0 },
  { key: 'partly', score: 1 },
  { key: 'routine', score: 2 },
] as const;

function pushAssessmentStart() {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: 'assessment_start' });
}

function pushAssessmentComplete(resultBand: ResultBand) {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: 'assessment_complete', result_band: resultBand });
}

function pushInterviewInterestClick() {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: 'interview_interest_click' });
}

function getResultBand(score: number): ResultBand {
  if (score <= 3) return 'exploring';
  if (score <= 7) return 'preparing';
  return 'operating';
}

export default function ResearchAssessment() {
  const t = useTranslations('research');
  const [screen, setScreen] = useState<Screen>('intro');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [selectedScore, setSelectedScore] = useState<number | null>(null);
  const [resultBand, setResultBand] = useState<ResultBand | null>(null);

  const startAssessment = () => {
    setScreen('questions');
    pushAssessmentStart();
  };

  const continueAssessment = () => {
    if (selectedScore === null) return;

    const nextAnswers = [...answers, selectedScore];
    setAnswers(nextAnswers);

    if (questionIndex === QUESTION_COUNT - 1) {
      const nextResultBand = getResultBand(nextAnswers.reduce((sum, score) => sum + score, 0));
      setResultBand(nextResultBand);
      setScreen('result');
      pushAssessmentComplete(nextResultBand);
      return;
    }

    setQuestionIndex((current) => current + 1);
    setSelectedScore(null);
  };

  const restartAssessment = () => {
    setScreen('intro');
    setQuestionIndex(0);
    setAnswers([]);
    setSelectedScore(null);
    setResultBand(null);
  };

  return (
    <section className="bg-gradient-to-br from-primary-50 via-surface to-secondary-50 px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-10 text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-accent">
            {t('eyebrow')}
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-text-primary sm:text-5xl">
            {t('title')}
          </h1>
          <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-text-secondary">
            {t('description')}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-6 shadow-xl sm:p-10">
          <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-950">
            <p className="font-semibold">{t('privacyTitle')}</p>
            <p className="mt-1">{t('privacyNotice')}</p>
          </div>

          <p className="mb-8 rounded-xl bg-primary-50 p-5 text-sm leading-7 text-primary-950">
            {t('disclaimer')}
          </p>

          {screen === 'intro' && (
            <div data-testid="research-intro">
              <h2 className="text-2xl font-semibold text-text-primary">{t('howItWorks.title')}</h2>
              <ol className="mt-6 grid gap-4 sm:grid-cols-3">
                {(['one', 'two', 'three'] as const).map((step, index) => (
                  <li key={step} className="rounded-xl border border-border bg-surface-elevated p-5">
                    <span className="text-sm font-semibold text-accent">0{index + 1}</span>
                    <p className="mt-2 font-semibold text-text-primary">{t(`howItWorks.steps.${step}.title`)}</p>
                    <p className="mt-2 text-sm leading-6 text-text-secondary">{t(`howItWorks.steps.${step}.description`)}</p>
                  </li>
                ))}
              </ol>
              <button
                type="button"
                onClick={startAssessment}
                className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-accent px-6 py-4 text-lg font-semibold text-accent-foreground transition-colors hover:bg-primary-700 sm:w-auto"
                data-testid="research-start"
              >
                {t('start')}
              </button>
            </div>
          )}

          {screen === 'questions' && (
            <div data-testid="research-question">
              <div className="flex items-center justify-between gap-4 text-sm font-medium text-text-secondary">
                <span>{t('questionProgress', { current: questionIndex + 1, total: QUESTION_COUNT })}</span>
                <span>{t('questionHint')}</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-primary-100" aria-hidden="true">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${((questionIndex + 1) / QUESTION_COUNT) * 100}%` }}
                />
              </div>

              <fieldset className="mt-8">
                <legend className="text-2xl font-semibold leading-9 text-text-primary">
                  {t(`questions.${QUESTION_KEYS[questionIndex]}.prompt`)}
                </legend>
                <div className="mt-6 grid gap-3">
                  {RESPONSE_OPTIONS.map((option) => {
                    const isSelected = selectedScore === option.score;
                    const optionId = `research-option-${option.key}`;
                    return (
                      <div key={option.key}>
                        <input
                          id={optionId}
                          type="radio"
                          name="research-answer"
                          value={option.score}
                          checked={isSelected}
                          onChange={() => setSelectedScore(option.score)}
                          className="peer sr-only"
                        />
                        <label
                          htmlFor={optionId}
                          data-testid={`research-option-${option.key}`}
                          className={`block cursor-pointer rounded-xl border px-5 py-4 text-left text-base transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-accent/50 ${
                            isSelected
                              ? 'border-accent bg-primary-50 text-primary-950 ring-2 ring-accent/30'
                              : 'border-border bg-surface text-text-secondary hover:border-accent hover:bg-primary-50'
                          }`}
                        >
                          {t(`options.${option.key}`)}
                        </label>
                      </div>
                    );
                  })}
                </div>
              </fieldset>

              <button
                type="button"
                onClick={continueAssessment}
                disabled={selectedScore === null}
                className="mt-8 rounded-xl bg-accent px-6 py-3 font-semibold text-accent-foreground transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-40"
                data-testid="research-next"
              >
                {questionIndex === QUESTION_COUNT - 1 ? t('showResult') : t('next')}
              </button>
            </div>
          )}

          {screen === 'result' && resultBand && (
            <div data-testid="research-result">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">{t('result.eyebrow')}</p>
              <h2 className="mt-3 text-3xl font-bold text-text-primary">
                {t(`bands.${resultBand}.label`)}
              </h2>
              <p className="mt-4 text-lg leading-8 text-text-secondary">
                {t(`bands.${resultBand}.description`)}
              </p>

              <div className="mt-8 rounded-xl border border-primary-200 bg-primary-50 p-6">
                <h3 className="text-xl font-semibold text-primary-950">{t('result.interviewTitle')}</h3>
                <p className="mt-3 text-sm leading-7 text-primary-950">{t('result.interviewDescription')}</p>
                <a
                  href={PUBLIC_RESEARCH_INTERVIEW_URL}
                  target="_blank"
                  rel="noreferrer"
                  onClick={pushInterviewInterestClick}
                  className="mt-5 inline-flex items-center rounded-xl bg-accent px-5 py-3 font-semibold text-accent-foreground transition-colors hover:bg-primary-700"
                  data-testid="research-interview-link"
                >
                  {t('result.interviewButton')}
                  <span aria-hidden="true" className="ml-2">↗</span>
                </a>
                <p className="mt-4 text-xs leading-6 text-primary-900">{t('result.githubNotice')}</p>
              </div>

              <button
                type="button"
                onClick={restartAssessment}
                className="mt-6 text-sm font-semibold text-accent underline underline-offset-4 hover:text-primary-700"
                data-testid="research-restart"
              >
                {t('restart')}
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
