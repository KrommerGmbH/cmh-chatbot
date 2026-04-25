import { defineComponent } from 'vue'
import template from './cmh-card-view.html?raw'
import './cmh-card-view.scss'

/**
 * cmh-card-view — 카드 목록 컨테이너 (Shopware sw-card-view 대응)
 *
 * cmh-page #content 슬롯 안에서 mt-card들을 감싸는 역할
 */
export default defineComponent({
  name: 'cmh-card-view',
  template,
})
