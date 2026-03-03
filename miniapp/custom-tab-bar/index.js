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
      const dataset = e.currentTarget.dataset
      const url = dataset.path
      const index = dataset.index
      this.setData({ selected: index })
      wx.switchTab({ url })
    }
  },

  attached() {
    // 初始化时设置主题色
    const themeColor = wx.getStorageSync('themeColor') || '#FF6B9D'
    this.setData({ selectedColor: themeColor })

    // 设置当前选中项
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
})
