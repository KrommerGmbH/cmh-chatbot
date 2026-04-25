import { defineComponent, type PropType } from 'vue'
import template from './cmh-rating-sads.html?raw'
import './cmh-rating-sads.scss'

/**
 * cmh-rating-sads — AI 응답 불만족 점수 컴포넌트
 *
 * SAD 스코어링 (불만족 점수):
 *   1😞=20점, 2😞=40점, 3😞=60점, 4😞=80점, 5😞=100점 (완전 불만족)
 *   0😞(미평가) = null
 *
 * 내부적으로 score(0~100 불만족 점수)를 저장하고, SAD 아이콘(1~5)은 UI 매핑.
 *
 * Usage:
 *   <cmh-rating-sads :score="msg.rating" @update:score="onRate(msg.id, $event)" />
 *   <cmh-rating-sads :score="msg.rating" readonly compact />
 */
export default defineComponent({
  name: 'cmh-rating-sads',
  template,

  props: {
    /** 불만족 점수 (0~100, null=미평가). 0=만족, 100=완전 불만족 */
    score: {
      type: [Number, null] as PropType<number | null>,
      default: null,
    },
    /** 최대 SAD 수 */
    maxSads: {
      type: Number,
      default: 5,
    },
    /** 읽기 전용 모드 */
    readonly: {
      type: Boolean,
      default: false,
    },
    /** 컴팩트 모드 (작은 아이콘) */
    compact: {
      type: Boolean,
      default: false,
    },
    /** 점수 라벨 표시 여부 */
    showScore: {
      type: Boolean,
      default: false,
    },
    /** 답변 모델명 (오른쪽 정렬 표시) */
    modelName: {
      type: String as PropType<string | null>,
      default: null,
    },
  },

  emits: ['update:score'],

  data() {
    return {
      hoverValue: 0,
    }
  },

  computed: {
    /** score(0~100) → SAD 수(1~5) 변환. null이면 0(미평가) */
    displayValue(): number {
      if (this.score === null || this.score === undefined) return 0
      return this.scoreToSads(this.score)
    },

    /** 점수 라벨 텍스트 */
    scoreLabel(): string {
      if (this.score === null || this.score === undefined) {
        return this.$t('cmh-global.rating.unrated')
      }
      return `${this.displayValue}/${this.maxSads}`
    },
  },

  methods: {
    /** SAD 수(1~5) → 불만족 점수(20~100) 변환: 1😞=20, 2😞=40, 3😞=60, 4😞=80, 5😞=100 */
    sadsToScore(sads: number): number {
      return sads * (100 / this.maxSads)
    },

    /** 불만족 점수(20~100) → SAD 수(1~5) 역변환 */
    scoreToSads(score: number): number {
      return Math.round(score / (100 / this.maxSads))
    },

    /** SAD 클릭 시 — 같은 SAD 재클릭하면 평가 해제(null) */
    onRate(sad: number): void {
      if (this.readonly) return
      if (sad === this.displayValue) {
        // 동일 SAD 재클릭 → 미평가로 되돌림
        this.$emit('update:score', null)
      } else {
        this.$emit('update:score', this.sadsToScore(sad))
      }
    },

    /** 각 SAD의 aria-label + tooltip */
    sadLabel(sad: number): string {
      const score = this.sadsToScore(sad)
      return `${this.$t('cmh-global.rating.sadTooltip', { sad, max: this.maxSads, score })}`
    },
  },
})
