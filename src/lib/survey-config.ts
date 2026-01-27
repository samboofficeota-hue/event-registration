export type QuestionType = "rating" | "text" | "select" | "nps";

export interface SurveyQuestion {
  id: string;
  label: string;
  type: QuestionType;
  required: boolean;
  options?: string[];
  min?: number;
  max?: number;
  placeholder?: string;
}

export const preSurveyQuestions: SurveyQuestion[] = [
  {
    id: "q1_interest_level",
    label: "このセミナーへの関心度を教えてください",
    type: "rating",
    required: true,
    min: 1,
    max: 5,
  },
  {
    id: "q2_expectations",
    label: "セミナーに期待することを教えてください",
    type: "text",
    required: true,
    placeholder: "自由にご記入ください",
  },
  {
    id: "q3_experience",
    label: "関連する分野でのご経験を教えてください",
    type: "select",
    required: true,
    options: ["初めて", "1年未満", "1〜3年", "3年以上"],
  },
  {
    id: "q4_questions",
    label: "事前に聞きたいことがあればご記入ください",
    type: "text",
    required: false,
    placeholder: "任意でご記入ください",
  },
];

export const postSurveyQuestions: SurveyQuestion[] = [
  {
    id: "q1_satisfaction",
    label: "セミナー全体の満足度を教えてください",
    type: "rating",
    required: true,
    min: 1,
    max: 5,
  },
  {
    id: "q2_content_quality",
    label: "内容の質はいかがでしたか",
    type: "rating",
    required: true,
    min: 1,
    max: 5,
  },
  {
    id: "q3_speaker_rating",
    label: "登壇者の説明はわかりやすかったですか",
    type: "rating",
    required: true,
    min: 1,
    max: 5,
  },
  {
    id: "q4_learnings",
    label: "セミナーで学んだことを教えてください",
    type: "text",
    required: true,
    placeholder: "自由にご記入ください",
  },
  {
    id: "q5_improvements",
    label: "改善してほしい点があれば教えてください",
    type: "text",
    required: false,
    placeholder: "任意でご記入ください",
  },
  {
    id: "q6_recommend",
    label: "このセミナーを他の方にどの程度おすすめしますか",
    type: "nps",
    required: true,
    min: 0,
    max: 10,
  },
];
