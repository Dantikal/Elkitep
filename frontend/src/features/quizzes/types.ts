export type QuizScope = { section: 'command' | 'independent'; category: 'officers' | 'warrant-sergeants'; month: { id: number; title: string }; topic: { id: number; title: string } };
export type Question = { id: string; text: string; options: { id: string; text: string }[] };
export type AttemptResult = { id: number; quiz_id: number; status: 'active' | 'completed' | 'timed_out' | 'failed'; reason: string; percentage: number; answered: number; total: number; deadline: string; server_now: string };
export type StartedAttempt = AttemptResult & { questions: Question[] };
export type Quiz = { id: number; title: string; duration_seconds: number; question_count: number; latest_result: AttemptResult | null; deadline?: string | null; module?: 1 | 2 | null };
export const failureReasons: Record<string, string> = { screenshot: 'Скриншот аныкталды.', app_exit: 'Тиркемеден чыктыңыз.', navigation: 'Тесттен чыктыңыз.', connection_lost: 'Тиркеме же сервер менен байланыш үзүлдү.', time_limit: 'Убакыт бүттү.', submitted: 'Тест аяктады.' };
