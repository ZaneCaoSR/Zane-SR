/**
 * subscriptions.js - 订阅管理页面逻辑
 * 功能：管理订阅城市、设置推送时间
 */
const { request } = require('../../utils/request')
const app = getApp()

Page({
  data: {
    subscriptions: [],    // 订阅列表
    loading: true,         // 加载状态
    showTimePicker: false, // 时间选择器显示状态
    currentCity: '',       // 当前编辑的城市
    pushTime: '08:00',     // 推送时间
    themeColor: '#FF6B9D'
  },

  onLoad() {
    this.loadSubscriptions()
  },

  onShow() {
    // 应用主题颜色
    const themeColor = wx.getStorageSync('themeColor') || '#FF6B9D';
    this.setData({ themeColor });
    wx.setNavigationBarColor({
      frontColor: '#ffffff',
      backgroundColor: themeColor,
      animation: { duration: 300, timingFunc: 'easeInOut' }
    });

    this.loadSubscriptions()
  },

  /**
   * 加载订阅列表
   */
  async loadSubscriptions() {
    const openid = app.globalData.openid
    if (!openid) {
      // 等待 openid
      setTimeout(() => this.loadSubscriptions(), 500)
      return
    }

    this.setData({ loading: true })
    try {
      // 使用现有的后端接口
      const res = await request(`/api/subscriber/${openid}`)
      
      const subscriptions = []
      if (res.subscribed && res.city) {
        // 获取该城市的天气
        try {
          const weather = await request(`/api/weather/${encodeURIComponent(res.city)}`)
          subscriptions.push({
            city: res.city,
            push_time: '08:00',
            weather: weather
          })
        } catch (err) {
          subscriptions.push({
            city: res.city,
            push_time: '08:00',
            weather: null
          })
        }
      }
      
      this.setData({ subscriptions })
    } catch (err) {
      console.error('[Subscriptions] 加载订阅列表失败:', err)
      wx.showToast({ title: '加载失败', icon: 'error' })
    } finally {
      this.setData({ loading: false })
    }
  },

  /**
   * 查看城市天气详情
   */
  onViewWeather(e) {
    const city = e.currentTarget.dataset.city
    wx.navigateTo({
      url: `/pages/weather-detail/weather-detail?city=${encodeURIComponent(city)}`
    })
  },

  /**
   * 添加城市 - 跳转到城市选择页
   */
  onAddCity() {
    wx.navigateTo({
      url: '/pages/city-select/city-select'
    })
  },

  /**
   * 编辑推送时间
   */
  onEditPushTime(e) {
    const city = e.currentTarget.dataset.city
    const subs = this.data.subscriptions.find(s => s.city === city)
    
    this.setData({
      showTimePicker: true,
      currentCity: city,
      pushTime: subs?.push_time || '08:00',
    })
  },

  /**
   * 关闭时间选择器
   */
  onCloseTimePicker() {
    this.setData({ showTimePicker: false })
  },

  /**
   * 时间变化
   */
  onTimeChange(e) {
    this.setData({ pushTime: e.detail.value })
  },

  /**
   * 确认设置推送时间
   */
  async onConfirmTime() {
    const { currentCity, pushTime } = this.data
    
    // 暂时不做实际更新，只做本地模拟
    // 后端需要支持 /api/subscription/update 接口
    
    wx.showToast({ title: '设置成功', icon: 'success' })
    
    // 更新本地数据
    const subscriptions = this.data.subscriptions.map(s => {
      if (s.city === currentCity) {
        return { ...s, push_time: pushTime }
      }
      return s
    })
    this.setData({ 
      subscriptions,
      showTimePicker: false,
    })
  },

  /**
   * 删除订阅
   */
  async onDeleteSubscribe(e) {
    const city = e.currentTarget.dataset.city
    
    const confirmed = await new Promise((resolve) => {
      wx.showModal({
        title: '确认删除',
        content: `取消订阅 ${city} 的天气推送？`,
        success: (res) => resolve(res.confirm),
      })
    })
    if (!confirmed) return

    const openid = app.globalData.openid
    if (!openid) return

    wx.showLoading({ title: '删除中...' })
    try {
      await request('/api/unsubscribe', 'POST', { 
        openid,
        city,
      })
      
      wx.showToast({ title: '已取消订阅', icon: 'success' })
      
      // 更新本地数据
      const subscriptions = this.data.subscriptions.filter(s => s.city !== city)
      this.setData({ subscriptions })
    } catch (err) {
      wx.showToast({ title: '删除失败', icon: 'error' })
    } finally {
      wx.hideLoading()
    }
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.loadSubscriptions().then(() => {
      wx.stopPullDownRefresh()
    })
  },
})
