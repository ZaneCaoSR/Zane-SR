/**
 * weather-detail.js - 天气详情页面逻辑
 * 功能：展示详细天气、空气质量、预报、订阅
 */
const { request } = require('../../utils/request')
const app = getApp()

Page({
  data: {
    city: '',              // 当前城市
    weather: null,          // 天气数据
    loading: true,          // 加载状态
    isSubscribed: false,   // 是否已订阅
    subscribedCity: '',    // 已订阅的城市
    hourlyForecast: [],    // 小时预报
    dailyForecast: [],     // 日预报
    lifeIndex: [],         // 生活指数
  },

  onLoad(options) {
    const city = options.city ? decodeURIComponent(options.city) : '杭州'
    this.setData({ city })
    this.fetchWeather(city)
    this.checkSubscribeStatus()
  },

  /**
   * 获取天气数据
   */
  async fetchWeather(city) {
    this.setData({ loading: true })
    try {
      const weather = await request(`/api/weather/${encodeURIComponent(city)}`)
      
      // 处理后端返回的数据，添加默认值
      const processedWeather = {
        ...weather,
        feels_like: weather.feels_like || weather.temp,
        vis: weather.vis || 10,
        pressure: weather.pressure || 1013,
      }
      
      this.setData({ 
        weather: processedWeather,
        hourlyForecast: this.formatHourly(weather.hourly || []),
        dailyForecast: this.formatDaily(weather.daily || []),
        lifeIndex: this.formatLifeIndex(weather.life_index || []),
      })
      
      // 更新页面标题
      wx.setNavigationBarTitle({
        title: `${city}天气`
      })
    } catch (err) {
      wx.showToast({ title: '获取天气失败', icon: 'error' })
      console.error('[WeatherDetail] 获取天气失败:', err)
    } {
      this.setData({ loading: false })
    }
  },

  /**
   * 格式化小时预报
   */
  formatHourly(hourly) {
    if (!hourly || hourly.length === 0) {
      // 模拟数据
      const now = new Date()
      return Array.from({ length: 8 }, (_, i) => {
        const hour = (now.getHours() + i) % 24
        return {
          time: `${hour}:00`,
          icon: i % 2 === 0 ? '☀️' : '⛅',
          temp: Math.floor(Math.random() * 10) + 15,
        }
      })
    }
    return hourly.map(item => ({
      time: item.time,
      icon: item.icon || '☀️',
      temp: item.temp,
    }))
  },

  /**
   * 格式化日预报
   */
  formatDaily(daily) {
    if (!daily || daily.length === 0) {
      // 模拟数据
      const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
      const today = new Date()
      return Array.from({ length: 7 }, (_, i) => {
        const date = new Date(today)
        date.setDate(date.getDate() + i)
        return {
          date: i === 0 ? '今天' : weekdays[date.getDay()],
          icon: i % 2 === 0 ? '☀️' : '🌧️',
          weather: i % 2 === 0 ? '晴' : '小雨',
          min_temp: Math.floor(Math.random() * 5) + 10,
          max_temp: Math.floor(Math.random() * 10) + 20,
        }
      })
    }
    return daily.map(item => ({
      date: item.date,
      icon: item.icon || '☀️',
      weather: item.weather || '晴',
      min_temp: item.min_temp,
      max_temp: item.max_temp,
    }))
  },

  /**
   * 格式化生活指数
   */
  formatLifeIndex(lifeIndex) {
    if (!lifeIndex || lifeIndex.length === 0) {
      // 模拟数据
      return [
        { type: '穿衣', value: '薄外套', icon: '👕' },
        { type: '运动', value: '适宜', icon: '🏃' },
        { type: '紫外线', value: '中等', icon: '☂️' },
        { type: '洗车', value: '适宜', icon: '🚗' },
        { type: '感冒', value: '低发', icon: '🤒' },
        { type: '空气', value: '良', icon: '🌬️' },
      ]
    }
    return lifeIndex
  },

  /**
   * 查询订阅状态
   */
  async checkSubscribeStatus() {
    const openid = app.globalData.openid
    if (!openid) return
    
    try {
      const res = await request(`/api/subscriber/${openid}`)
      this.setData({
        isSubscribed: res.subscribed,
        subscribedCity: res.city || '',
      })
    } catch (err) {
      console.error('[WeatherDetail] 查询订阅状态失败:', err)
    }
  },

  /**
   * 订阅该城市天气
   */
  onSubscribe() {
    const openid = app.globalData.openid
    if (!openid) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }

    const templateId = 'qQ59V186shsA-W4OBRtY5Mwsa7djNzrD95lNqraYklk'
    
    wx.requestSubscribeMessage({
      tmplIds: [templateId],
      success: (res) => {
        if (res[templateId] === 'accept') {
          this.doSubscribe()
        } else {
          wx.showToast({ title: '需要授权才能订阅', icon: 'none' })
        }
      },
      fail: (err) => {
        wx.showToast({ title: '订阅失败', icon: 'error' })
      }
    })
  },

  /**
   * 调用后端订阅接口
   */
  async doSubscribe() {
    wx.showLoading({ title: '订阅中...' })
    try {
      const res = await request('/api/subscribe', 'POST', {
        openid: app.globalData.openid,
        city: this.data.city,
      })
      wx.showToast({ title: '订阅成功', icon: 'success' })
      this.setData({
        isSubscribed: true,
        subscribedCity: this.data.city,
      })
    } catch (err) {
      wx.showToast({ title: '订阅失败', icon: 'error' })
    } finally {
      wx.hideLoading()
    }
  },

  /**
   * 取消订阅
   */
  async onUnsubscribe() {
    const confirmed = await new Promise((resolve) => {
      wx.showModal({
        title: '确认取消',
        content: `取消订阅 ${this.data.city} 的天气推送？`,
        success: (res) => resolve(res.confirm),
      })
    })
    if (!confirmed) return

    try {
      await request('/api/unsubscribe', 'POST', { 
        openid: app.globalData.openid 
      })
      wx.showToast({ title: '已取消订阅', icon: 'success' })
      this.setData({ isSubscribed: false, subscribedCity: '' })
    } catch (err) {
      wx.showToast({ title: '取消失败', icon: 'error' })
    }
  },

  /**
   * 分享给朋友
   */
  onShareAppMessage() {
    return {
      title: `${this.data.city}的天气：${this.data.weather?.temp}°，${this.data.weather?.weather}`,
      path: `/pages/weather-detail/weather-detail?city=${encodeURIComponent(this.data.city)}`,
    }
  },
})
