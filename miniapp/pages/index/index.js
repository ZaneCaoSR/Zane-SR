/**
 * index.js - 首页逻辑
 * 功能：天气查询、订阅/取消订阅天气提醒
 */
const { request } = require('../../utils/request')
const app = getApp()

Page({
  data: {
    city: '杭州',         // 当前查询城市
    weather: null,        // 天气数据
    loading: false,       // 天气加载状态
    openid: null,         // 用户 openid
    isSubscribed: false,  // 是否已订阅
    subscribedCity: '',   // 已订阅的城市
    subLoading: false,    // 订阅按钮 loading
    unsubLoading: false,  // 取消订阅按钮 loading
  },

  onLoad() {
    // 等待 app.js 获取 openid，最多等 3 秒
    this.waitForOpenid(() => {
      this.checkSubscribeStatus()
    })
    // 默认加载杭州天气
    this.fetchWeather('杭州')
  },

  /**
   * 等待 openid 就绪（app.js 异步登录）
   */
  waitForOpenid(callback, maxRetry = 10) {
    if (app.globalData.openid) {
      this.setData({ openid: app.globalData.openid })
      callback()
      return
    }
    if (maxRetry <= 0) return
    setTimeout(() => {
      this.waitForOpenid(callback, maxRetry - 1)
    }, 300)
  },

  /**
   * 城市输入监听
   */
  onCityInput(e) {
    this.setData({ city: e.detail.value })
  },

  /**
   * 点击查询天气
   */
  onSearchWeather() {
    const city = this.data.city.trim()
    if (!city) {
      wx.showToast({ title: '请输入城市名', icon: 'none' })
      return
    }
    this.fetchWeather(city)
  },

  /**
   * 拉取天气数据
   */
  async fetchWeather(city) {
    this.setData({ loading: true, weather: null })
    try {
      const weather = await request(`/api/weather/${encodeURIComponent(city)}`)
      this.setData({ weather, city })
    } catch (err) {
      wx.showToast({ title: `获取 ${city} 天气失败`, icon: 'error' })
    } finally {
      this.setData({ loading: false })
    }
  },

  /**
   * 查询订阅状态
   */
  async checkSubscribeStatus() {
    const openid = this.data.openid
    if (!openid) return
    try {
      const res = await request(`/api/subscriber/${openid}`)
      this.setData({
        isSubscribed: res.subscribed,
        subscribedCity: res.city || '',
      })
    } catch (err) {
      console.error('[Page] 查询订阅状态失败:', err)
    }
  },

  /**
   * 点击订阅：先请求订阅消息权限，再调用后端
   */
  onSubscribe() {
    const templateId = 'YOUR_TEMPLATE_ID'  // 替换为实际模板ID

    wx.requestSubscribeMessage({
      tmplIds: [templateId],
      success: (res) => {
        if (res[templateId] === 'accept') {
          // 用户授权成功，调用后端记录订阅
          this.doSubscribe()
        } else {
          wx.showToast({ title: '需要授权才能订阅', icon: 'none' })
        }
      },
      fail: (err) => {
        console.error('[Page] requestSubscribeMessage 失败:', err)
        wx.showToast({ title: '订阅失败，请重试', icon: 'error' })
      }
    })
  },

  /**
   * 调用后端订阅接口
   */
  async doSubscribe() {
    this.setData({ subLoading: true })
    try {
      const res = await request('/api/subscribe', 'POST', {
        openid: this.data.openid,
        city: this.data.city,
      })
      wx.showToast({ title: res.message || '订阅成功', icon: 'success' })
      this.setData({
        isSubscribed: true,
        subscribedCity: this.data.city,
      })
    } catch (err) {
      wx.showToast({ title: '订阅失败，请重试', icon: 'error' })
    } finally {
      this.setData({ subLoading: false })
    }
  },

  /**
   * 取消订阅
   */
  async onUnsubscribe() {
    const confirmed = await new Promise((resolve) => {
      wx.showModal({
        title: '确认取消',
        content: '取消后将不再收到每日天气提醒',
        success: (res) => resolve(res.confirm),
      })
    })
    if (!confirmed) return

    this.setData({ unsubLoading: true })
    try {
      await request('/api/unsubscribe', 'POST', { openid: this.data.openid })
      wx.showToast({ title: '已取消订阅', icon: 'success' })
      this.setData({ isSubscribed: false, subscribedCity: '' })
    } catch (err) {
      wx.showToast({ title: '取消失败，请重试', icon: 'error' })
    } finally {
      this.setData({ unsubLoading: false })
    }
  },
})
