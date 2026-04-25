import { defineComponent } from 'vue'
import template from './cmh-sidebar-collapse.html?raw';
import './cmh-sidebar-collapse.scss';
import AwCollapse from '../../base/cmh-collapse';

/**
 * @description cmh-collapse를 extends하는 사이드바 전용 접기/펼치기 컴포넌트
 */
export default defineComponent({
    template,

    extends: AwCollapse,

    emits: ['change-expanded'],

    props: {
        expandChevronDirection: {
            type: String,
            required: false,
            default: 'right',
            validator: (v: string) => ['up', 'left', 'right', 'down'].includes(v),
        },
    },

    computed: {
        expandButtonClass(): Record<string, boolean> {
            return { 'is--hidden': this.expanded };
        },

        collapseButtonClass(): Record<string, boolean> {
            return { 'is--hidden': !this.expanded };
        },
    },

    methods: {
        collapseItem() {
            this.expanded = !this.expanded;
            this.$emit('change-expanded', { isExpanded: this.expanded });
        },
    },
});
