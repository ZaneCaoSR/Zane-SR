// 天气首页
const { BASE_URL } = require('../../utils/config');

Page({
  data: {
    city: '杭州',
    weather: {},
    updateTime: '',
    userCity: '杭州'
  },

  onLoad() {
    const app = getApp();
    this.setData({ city: app.globalData.userCity || '杭州' });
    this.loadWeather();
  },

  onShow() {
    const app = getApp();
    if (app.globalData.userCity && app.globalData.userCity !== this.data.city) {
      this.setData({ city: app.globalData.userCity });
      this.loadWeather();
    }
  },

  // 加载天气数据
  loadWeather() {
    wx.showLoading({ title: '加载中...' });
    const that = this;
    wx.request({
      url: `${BASE_URL}/api/weather/${encodeURIComponent(this.data.city)}`,
      success: (res) => {
        if (res.data && res.data.city) {
          const now = new Date();
          const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
          that.setData({
            weather: res.data,
            updateTime: timeStr
          });
        }
      },
      fail: (err) => {
        wx.showToast({ title: '获取天气失败', icon: 'error' });
      },
      complete: () => {
        wx.hideLoading();
      }
    });
  },

  // 城市选择
  onCitySelect() {
    wx.navigateTo({
      url: '/pages/city-select/city-select'
    });
  },

  // 订阅天气
  onSubscribe() {
    const app = getApp();
    if (!app.globalData.openid) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      wx.switchTab({ url: '/pages/my/index' });
      return;
    }
    
    wx.request({
      url: `${BASE_URL}/api/subscribe`,
      method: 'POST',
      data: {
        openid: app.globalData.openid,
        city: this.data.city
      },
      success: (res) => {
        if (res.data.success) {
          wx.showToast({ title: '订阅成功', icon: 'success' });
        } else {
          wx.showToast({ title: res.data.message || '订阅失败', icon: 'error' });
        }
      },
      fail: () => {
        wx.showToast({ title: '订阅失败', icon: 'error' });
      }
    });
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadWeather();
    wx.stopPullDownRefresh();
  }
});
