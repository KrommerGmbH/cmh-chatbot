import { defineComponent } from 'vue'
import template from './cmh-collapse.html?raw';
import './cmh-collapse.scss';

/**
 * @description A collapsible container with header/content slots.
 * Exposes `expanded` state to the header slot via scoped slot.
 */
export default defineComponent({
    template,

    props: {
        expandOnLoading: {
            type: Boolean,
            required: false,
            default: false,
        },
    },

    data() {
        return {
            expanded: this.expandOnLoading as boolean,
        };
    },

    methods: {
        collapseItem() {
            this.expanded = !this.expanded;
        },
    },
});
