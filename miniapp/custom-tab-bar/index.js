// custom-tab-bar/index.js
Component({
  data: {
    selected: 0,
    color: "#B8AFA4",
    selectedColor: "#FF6B9D",
    list: [
      {
        pagePath: "/pages/album/index",
        text: "相册",
        icon: "/assets/icons/album.png",
        activeIcon: "/assets/icons/album-active.png"
      },
      {
        pagePath: "/pages/weather/index",
        text: "天气",
        icon: "/assets/icons/weather.png",
        activeIcon: "/assets/icons/weather-active.png"
      },
      {
        pagePath: "/pages/my/index",
        text: "我的",
        icon: "/assets/icons/my.png",
        activeIcon: "/assets/icons/my-active.png"
      }
    ]
  },

  methods: {
    switchTab(e) {
      const data = e.currentTarget.dataset
      const url = data.path
      wx.switchTab({ url })
    }
  },

  lifetimes: {
    attached() {
      this.updateSelectedColor()
    }
  },

  pageLifetimes: {
    show() {
      this.updateSelectedColor()
      // 更新选中态
      const pages = getCurrentPages()
      if (pages.length) {
        const currentPage = pages[pages.length - 1]
        const path = '/' + currentPage.route
        const selected = this.data.list.findIndex(item => item.pagePath === path)
        if (selected !== -1) {
          this.setData({ selected })
        }
      }
    }
  },

  updateSelectedColor() {
    // 读取主题色
    try {
      const themeColor = wx.getStorageSync('themeColor') || '#FF6B9D'
      this.setData({
        selectedColor: themeColor
      })
    } catch (e) {
      console.error('读取主题色失败', e)
    }
  }
})
