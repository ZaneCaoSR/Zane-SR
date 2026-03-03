/**
 * city-select.js - 城市选择页面逻辑
 * 功能：搜索城市、选择城市、添加到订阅列表（支持多城市）
 */
const { request } = require('../../utils/request')
const app = getApp()

// 热门城市列表
const hotCities = [
  { id: 1, name: '北京', province: '华北' },
  { id: 2, name: '上海', province: '华东' },
  { id: 3, name: '广州', province: '华南' },
  { id: 4, name: '深圳', province: '华南' },
  { id: 5, name: '杭州', province: '华东' },
  { id: 6, name: '成都', province: '西南' },
  { id: 7, name: '武汉', province: '华中' },
  { id: 8, name: '西安', province: '西北' },
  { id: 9, name: '南京', province: '华东' },
  { id: 10, name: '重庆', province: '西南' },
  { id: 11, name: '天津', province: '华北' },
  { id: 12, name: '苏州', province: '华东' },
  { id: 13, name: '郑州', province: '华中' },
  { id: 14, name: '长沙', province: '华中' },
  { id: 15, name: '青岛', province: '华东' },
  { id: 16, name: '沈阳', province: '东北' },
  { id: 17, name: '大连', province: '东北' },
  { id: 18, name: '厦门', province: '华东' },
  { id: 19, name: '昆明', province: '西南' },
  { id: 20, name: '哈尔滨', province: '东北' },
]

Page({
  data: {
    searchKey: '',          // 搜索关键词
    searchResult: [],       // 搜索结果
    searchLoading: false,   // 搜索加载状态
    hotCities: hotCities,   // 热门城市
    commonCities: [],       // 最近使用的城市
    subscribedCities: [],   // 已订阅的城市
  },

  onLoad() {
    // 从缓存加载常用城市
    this.loadCommonCities()
    // 加载已订阅的城市
    this.loadSubscribedCities()
  },

  onShow() {
    // 每次显示时刷新订阅状态
    this.loadSubscribedCities()
  },

  /**
   * 从缓存加载常用城市
   */
  loadCommonCities() {
    const common = wx.getStorageSync('commonCities') || []
    this.setData({ commonCities: common })
  },

  /**
   * 加载已订阅的城市列表
   */
  async loadSubscribedCities() {
    const openid = app.globalData.openid
    if (!openid) {
      // 等待 openid
      setTimeout(() => this.loadSubscribedCities(), 500)
      return
    }
    try {
      // 调用后端获取订阅状态
      const res = await request(`/api/subscribed-cities?openid=${openid}`)
      if (res.subscribed && res.cities) {
        this.setData({ subscribedCities: res.cities })
      } else {
        this.setData({ subscribedCities: [] })
      }
    } catch (err) {
      console.error('[CitySelect] 加载订阅列表失败:', err)
      this.setData({ subscribedCities: [] })
    }
  },

  /**
   * 搜索输入
   */
  onSearchInput(e) {
    const value = e.detail.value
    this.setData({ searchKey: value })

    if (value) {
      this.doSearch(value)
    } else {
      this.setData({ searchResult: [] })
    }
  },

  /**
   * 清空搜索
   */
  onClearSearch() {
    this.setData({ searchKey: '', searchResult: [] })
  },

  /**
   * 执行搜索
   */
  async doSearch(key) {
    if (!key.trim()) return

    this.setData({ searchLoading: true })
    try {
      // 调用后端城市搜索接口
      const res = await request(`/api/cities/search?keyword=${encodeURIComponent(key)}`)
      this.setData({ searchResult: res.cities || [] })
    } catch (err) {
      // 搜索失败时使用本地过滤
      const filtered = hotCities.filter(c =>
        c.name.includes(key) || c.province.includes(key)
      )
      this.setData({ searchResult: filtered })
    } finally {
      this.setData({ searchLoading: false })
    }
  },

  /**
   * 选择城市 - 跳转到天气首页并切换城市
   */
  onSelectCity(e) {
    const city = e.currentTarget.dataset.city
    const cityName = city.name || city.city

    // 保存到常用城市缓存
    this.saveCommonCity(cityName)

    // 保存到全局数据
    app.globalData.userCity = cityName;

    // 跳转到天气首页
    wx.switchTab({
      url: '/pages/weather/index'
    })
  },

  /**
   * 保存到常用城市
   */
  saveCommonCity(cityName) {
    let common = wx.getStorageSync('commonCities') || []
    // 去除重复
    common = common.filter(c => c.name !== cityName)
    // 放在最前面
    common.unshift({ name: cityName })
    // 保留最多10个
    common = common.slice(0, 10)
    wx.setStorageSync('commonCities', common)
    this.setData({ commonCities: common })
  },

  /**
   * 添加到订阅列表（多城市）
   */
  async onAddToSubscribe(e) {
    const city = e.currentTarget.dataset.city
    const cityName = city.name || city.city

    const openid = app.globalData.openid
    if (!openid) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }

    // 检查是否已订阅
    const alreadySubscribed = this.data.subscribedCities.some(c => c.city === cityName)
    if (alreadySubscribed) {
      wx.showToast({ title: '已订阅该城市', icon: 'none' })
      return
    }

    wx.showLoading({ title: '订阅中...' })
    try {
      // 获取当前订阅的城市列表
      const currentCities = this.data.subscribedCities.map(c => ({
        city: c.city,
        cityId: c.cityId || null,
        pushTime: c.pushTime || '08:00',
        isActive: true
      }))

      // 添加新城市
      currentCities.push({
        city: cityName,
        pushTime: '08:00',
        isActive: true
      })

      const res = await request('/api/subscribe-multiple', 'POST', {
        openid,
        cities: currentCities
      })

      if (res.success) {
        wx.showToast({ title: '订阅成功', icon: 'success' })
        // 更新订阅列表
        this.loadSubscribedCities()
      } else {
        wx.showToast({ title: res.message || '订阅失败', icon: 'error' })
      }
    } catch (err) {
      wx.showToast({ title: '订阅失败', icon: 'error' })
    } finally {
      wx.hideLoading()
    }
  },

  /**
   * 取消订阅（单个城市）
   */
  async onRemoveSubscribe(e) {
    const cityName = e.currentTarget.dataset.city

    const confirmed = await new Promise((resolve) => {
      wx.showModal({
        title: '确认取消',
        content: `取消订阅 ${cityName} 的天气推送？`,
        success: (res) => resolve(res.confirm),
      })
    })
    if (!confirmed) return

    const openid = app.globalData.openid
    if (!openid) return

    try {
      await request('/api/unsubscribe-city', 'POST', {
        openid,
        city: cityName
      })
      wx.showToast({ title: '已取消订阅', icon: 'success' })
      this.loadSubscribedCities()
    } catch (err) {
      wx.showToast({ title: '取消失败', icon: 'error' })
    }
  },
})
