// 我的页面
const { BASE_URL } = require('../../utils/config');

Page({
  data: {
    isLoggedIn: false,
    userInfo: {},
    themeColor: '#FF6B9D',
    themeColorDark: '#FF9ECA',
    showThemeModal: false,
    customColor: '#FF6B9D',
    colorOptions: [
      { color: '#FF6B9D', colorDark: '#FF9ECA', name: '粉红' },
      { color: '#4A90E2', colorDark: '#67B8DE', name: '蓝色' },
      { color: '#52C41A', colorDark: '#95DE64', name: '绿色' },
      { color: '#FAAD14', colorDark: '#FFC53D', name: '橙色' },
      { color: '#F5222D', colorDark: '#FF7875', name: '红色' },
      { color: '#722ED1', colorDark: '#9254DE', name: '紫色' },
      { color: '#13C2C2', colorDark: '#36CFC9', name: '青色' },
      { color: '#2F54EB', colorDark: '#597EF7', name: '深蓝' },
      { color: '#EB2F96', colorDark: '#FF85C0', name: '玫红' },
      { color: '#FA541C', colorDark: '#FF7A45', name: '橘红' },
      { color: '#435444', colorDark: '#738A76', name: '墨绿' },
      { color: '#722ED1', colorDark: '#B37FEB', name: '淡紫' },
    ]
  },

  onLoad() {
    // 读取本地存储的用户信息
    const userInfo = wx.getStorageSync('userInfo') || {};
    const themeColor = wx.getStorageSync('themeColor') || '#FF6B9D';
    const themeColorDark = wx.getStorageSync('themeColorDark') || '#FF9ECA';
    
    this.setData({
      userInfo,
      themeColor,
      themeColorDark,
      isLoggedIn: !!userInfo.openid
    });
  },

  // 登录
  onLogin() {
    const that = this;
    
    wx.getUserProfile({
      desc: '用于完善用户资料',
      success: (res) => {
        const userInfo = res.userInfo;
        
        wx.login({
          success: (loginRes) => {
            wx.request({
              url: `${BASE_URL}/api/login`,
              method: 'POST',
              data: { code: loginRes.code },
              success: (apiRes) => {
                if (apiRes.data && apiRes.data.openid) {
                  userInfo.openid = apiRes.data.openid;
                  wx.setStorageSync('userInfo', userInfo);
                  
                  const app = getApp();
                  app.globalData.openid = userInfo.openid;
                  
                  that.setData({ userInfo, isLoggedIn: true });
                  wx.showToast({ title: '登录成功', icon: 'success' });
                }
              },
              fail: () => {
                const mockUserInfo = { nickName: '测试用户', avatarUrl: '', openid: 'mock_' + Date.now() };
                wx.setStorageSync('userInfo', mockUserInfo);
                that.setData({ userInfo: mockUserInfo, isLoggedIn: true });
                wx.showToast({ title: '登录成功', icon: 'success' });
              }
            });
          }
        });
      },
      fail: () => {
        const mockUserInfo = { nickName: '测试用户', avatarUrl: '', openid: 'mock_' + Date.now() };
        wx.setStorageSync('userInfo', mockUserInfo);
        this.setData({ userInfo: mockUserInfo, isLoggedIn: true });
        wx.showToast({ title: '登录成功', icon: 'success' });
      }
    });
  },

  // 退出登录
  onLogout() {
    wx.removeStorageSync('userInfo');
    this.setData({ userInfo: {}, isLoggedIn: false });
    wx.showToast({ title: '已退出登录', icon: 'success' });
  },

  // 主题颜色切换
  onThemeChange() {
    this.setData({ showThemeModal: true });
  },

  // 关闭主题弹窗
  onCloseTheme() {
    this.setData({ showThemeModal: false });
  },

  // 选择主题颜色
  selectTheme(e) {
    const { color, colordark } = e.currentTarget.dataset;
    this.applyColor(color, colordark);
  },

  // 自定义颜色输入
  onCustomColor(e) {
    this.setData({ customColor: e.detail.value });
  },

  // 应用自定义颜色
  applyCustomColor() {
    const { customColor } = this.data;
    if (!customColor.startsWith('#')) {
      wx.showToast({ title: '请输入正确的颜色值', icon: 'none' });
      return;
    }
    this.applyColor(customColor, customColor);
  },

  // 应用颜色
  applyColor(color, colorDark) {
    wx.setStorageSync('themeColor', color);
    wx.setStorageSync('themeColorDark', colorDark);
    this.setData({
      themeColor: color,
      themeColorDark: colorDark,
      showThemeModal: false
    });
    wx.showToast({ title: '主题已更新', icon: 'success' });
  },

  // 关于我们
  onAbout() {
    wx.showModal({
      title: '关于我们',
      content: 'Zane-SR 宝宝成长相册\n\n记录宝宝成长的美好瞬间',
      showCancel: false
    });
  }
});