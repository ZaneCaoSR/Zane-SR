/**
 * app.js - 小程序入口
 * 负责全局登录，获取用户 openid（通过后端 code2session 或直接云调用）
 */
const { BASE_URL } = require('./utils/config');

App({
  globalData: {
    openid: null,        // 用户 openid，登录后存储
    userInfo: null,      // 用户基本信息
    userCity: '杭州',     // 用户订阅的城市
    themeColor: '#FF6B9D', // 主题颜色
    themeColorDark: '#FF9ECA', // 主题深色
  },

  onLaunch() {
    // 读取本地存储的用户信息
    const userInfo = wx.getStorageSync('userInfo');
    const userCity = wx.getStorageSync('userCity') || '杭州';
    const themeColor = wx.getStorageSync('themeColor') || '#FF6B9D';
    const themeColorDark = wx.getStorageSync('themeColorDark') || '#FF9ECA';
    
    if (userInfo) {
      this.globalData.userInfo = userInfo;
      this.globalData.openid = userInfo.openid;
    }
    this.globalData.userCity = userCity;
    this.globalData.themeColor = themeColor;
    this.globalData.themeColorDark = themeColorDark;
    
    // 小程序启动时自动登录
    this.login();
  },

  /**
   * 微信登录，获取 code，换取 openid
   */
  login() {
    const that = this;
    
    wx.login({
      success: (res) => {
        if (res.code) {
          wx.request({
            url: BASE_URL + '/api/login',
            method: 'POST',
            data: { code: res.code },
            success: (loginRes) => {
              if (loginRes.data && loginRes.data.openid) {
                that.globalData.openid = loginRes.data.openid;
                console.log('[App] 登录成功，openid:', that.globalData.openid);
                
                // 如果已经有用户信息，更新 openid
                if (that.globalData.userInfo) {
                  that.globalData.userInfo.openid = loginRes.data.openid;
                  wx.setStorageSync('userInfo', that.globalData.userInfo);
                }
              }
            },
            fail: (err) => {
              console.error('[App] 登录失败:', err);
            }
          });
        }
      },
      fail: (err) => {
        console.error('[App] wx.login 失败:', err);
      }
    });
  },

  /**
   * 更新用户信息
   */
  updateUserInfo(userInfo) {
    this.globalData.userInfo = userInfo;
    wx.setStorageSync('userInfo', userInfo);
  },

  /**
   * 更新主题颜色并应用到全局
   */
  updateThemeColor(color, colorDark) {
    this.globalData.themeColor = color;
    this.globalData.themeColorDark = colorDark;
    wx.setStorageSync('themeColor', color);
    wx.setStorageSync('themeColorDark', colorDark);

    // 应用到导航栏
    this.applyThemeToNavigation();
  },

  /**
   * 应用主题到导航栏
   */
  applyThemeToNavigation() {
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1];
    if (currentPage) {
      const color = this.globalData.themeColor;
      // 将 HEX 转换为 RGB 用于背景
      const bgColor = this.hexToRgb(color);
      wx.setNavigationBarColor({
        frontColor: '#ffffff',
        backgroundColor: color,
        animation: {
          duration: 300,
          timingFunc: 'easeInOut'
        },
        success: () => {
          // 同时设置页面背景
          currentPage.setData({ themeColor: color });
        }
      });
    }
  },

  /**
   * HEX 转 RGB
   */
  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  },

  /**
   * 更新用户城市
   */
  updateUserCity(city) {
    this.globalData.userCity = city;
    wx.setStorageSync('userCity', city);
  }
});