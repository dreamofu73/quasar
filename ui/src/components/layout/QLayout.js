import { h, ref, reactive, computed, watch, provide, onUnmounted, getCurrentInstance } from 'vue'

import { isRuntimeSsrPreHydration } from '../../plugins/platform/Platform.js'

import QScrollObserver from '../scroll-observer/QScrollObserver.js'
import QResizeObserver from '../resize-observer/QResizeObserver.js'

import { createComponent } from '../../utils/private/create.js'
import { getScrollbarWidth } from '../../utils/scroll.js'
import { hMergeSlot } from '../../utils/private/render.js'
import { layoutKey } from '../../utils/private/symbols.js'

export default createComponent({
  name: 'QLayout',

  props: {
    container: Boolean,
    view: {
      type: String,
      default: 'hhh lpr fff',
      validator: v => /^(h|l)h(h|r) lpr (f|l)f(f|r)$/.test(v.toLowerCase())
    },

    onScroll: Function,
    onScrollHeight: Function,
    onResize: Function
  },

  setup (props, { slots, emit }) {
    const { proxy: { $q } } = getCurrentInstance()

    const rootRef = ref(null)

    // page related
    const height = ref($q.screen.height)
    const width = ref(props.container === true ? 0 : $q.screen.width)
    const scroll = ref({ position: 0, direction: 'down', inflectionPoint: 0 })

    // container only prop
    const containerHeight = ref(0)
    const scrollbarWidth = ref(isRuntimeSsrPreHydration.value === true ? 0 : getScrollbarWidth())

    const classes = computed(() =>
      'q-layout q-layout--'
      + (props.container === true ? 'containerized' : 'standard')
    )

    const style = computed(() => (
      props.container === false
        ? { minHeight: $q.screen.height + 'px' }
        : null
    ))

    // used by container only
    const targetStyle = computed(() => (
      scrollbarWidth.value !== 0
        ? { [ $q.lang.rtl === true ? 'left' : 'right' ]: `${ scrollbarWidth.value }px` }
        : null
    ))

    const targetChildStyle = computed(() => (
      scrollbarWidth.value !== 0
        ? {
            [ $q.lang.rtl === true ? 'right' : 'left' ]: 0,
            [ $q.lang.rtl === true ? 'left' : 'right' ]: `-${ scrollbarWidth.value }px`,
            width: `calc(100% + ${ scrollbarWidth.value }px)`
          }
        : null
    ))

    function onPageScroll (data) {
      if (props.container === true || document.qScrollPrevented !== true) {
        const info = {
          position: data.position.top,
          direction: data.direction,
          directionChanged: data.directionChanged,
          inflectionPoint: data.inflectionPoint.top,
          delta: data.delta.top
        }

        scroll.value = info
        props.onScroll !== void 0 && emit('scroll', info)
      }
    }

    function onPageResize (data) {
      const { height: newHeight, width: newWidth } = data
      let resized = false

      if (height.value !== newHeight) {
        resized = true
        height.value = newHeight
        props.onScrollHeight !== void 0 && emit('scrollHeight', newHeight)
        updateScrollbarWidth()
      }
      if (width.value !== newWidth) {
        resized = true
        width.value = newWidth
      }

      if (resized === true && props.onResize !== void 0) {
        emit('resize', data)
      }
    }

    function onContainerResize ({ height }) {
      if (containerHeight.value !== height) {
        containerHeight.value = height
        updateScrollbarWidth()
      }
    }

    function updateScrollbarWidth () {
      if (props.container === true) {
        const width = height.value > containerHeight.value
          ? getScrollbarWidth()
          : 0

        if (scrollbarWidth.value !== width) {
          scrollbarWidth.value = width
        }
      }
    }

    let animateTimer = null

    const $layout = {
      instances: {},
      view: computed(() => props.view),
      isContainer: computed(() => props.container),

      rootRef,

      height,
      containerHeight,
      scrollbarWidth,
      totalWidth: computed(() => width.value + scrollbarWidth.value),

      rows: computed(() => {
        const rows = props.view.toLowerCase().split(' ')
        return {
          top: rows[ 0 ].split(''),
          middle: rows[ 1 ].split(''),
          bottom: rows[ 2 ].split('')
        }
      }),

      header: reactive({ size: 0, offset: 0, space: false }),
      right: reactive({ size: 300, offset: 0, space: false }),
      footer: reactive({ size: 0, offset: 0, space: false }),
      left: reactive({ size: 300, offset: 0, space: false }),

      scroll,

      animate () {
        if (animateTimer !== null) {
          clearTimeout(animateTimer)
        }
        else {
          document.body.classList.add('q-body--layout-animate')
        }

        animateTimer = setTimeout(() => {
          animateTimer = null
          document.body.classList.remove('q-body--layout-animate')
        }, 155)
      },

      update (part, prop, val) {
        $layout[ part ][ prop ] = val
      }
    }

    provide(layoutKey, $layout)

    // prevent scrollbar flicker while resizing window height
    // if no page scrollbar is already present
    if (__QUASAR_SSR_SERVER__ !== true && getScrollbarWidth() > 0) {
      let timer = null
      const el = document.body

      function restoreScrollbar () {
        timer = null
        el.classList.remove('hide-scrollbar')
      }

      function hideScrollbar () {
        if (timer === null) {
          // if it has no scrollbar then there's nothing to do

          if (el.scrollHeight > $q.screen.height) {
            return
          }

          el.classList.add('hide-scrollbar')
        }
        else {
          clearTimeout(timer)
        }

        timer = setTimeout(restoreScrollbar, 300)
      }

      function updateScrollEvent (action) {
        if (timer !== null && action === 'remove') {
          clearTimeout(timer)
          restoreScrollbar()
        }

        window[ `${ action }EventListener` ]('resize', hideScrollbar)
      }

      watch(
        () => (props.container !== true ? 'add' : 'remove'),
        updateScrollEvent
      )

      props.container !== true && updateScrollEvent('add')

      onUnmounted(() => {
        updateScrollEvent('remove')
      })
    }

    return () => {
      const content = hMergeSlot(slots.default, [
        h(QScrollObserver, { onScroll: onPageScroll }),
        h(QResizeObserver, { onResize: onPageResize })
      ])

      const layout = h('div', {
        class: classes.value,
        style: style.value,
        ref: props.container === true ? void 0 : rootRef,
        tabindex: -1
      }, content)

      if (props.container === true) {
        return h('div', {
          class: 'q-layout-container overflow-hidden',
          ref: rootRef
        }, [
          h(QResizeObserver, { onResize: onContainerResize }),
          h('div', {
            class: 'absolute-full',
            style: targetStyle.value
          }, [
            h('div', {
              class: 'scroll',
              style: targetChildStyle.value
            }, [ layout ])
          ])
        ])
      }

      return layout
    }
  }
})
