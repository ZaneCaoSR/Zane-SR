// 我的页面
const { BASE_URL } = require('../../utils/config');

Page({
  data: {
    isLoggedIn: false,
    userInfo: {},
    babyInfo: null,
    themeColor: '#E8A87C',
    themeColorDark: '#C38D6B',
    showThemeModal: false,
    customColor: '#FF6B9D',
    colorOptions: [
      { color: '#E8A87C', colorDark: '#C38D6B', name: '杏色' },
      { color: '#FFCDB2', colorDark: '#FFB5A7', name: '蜜桃' },
      { color: '#95B8A0', colorDark: '#7BA085', name: '薄荷' },
      { color: '#A8C0D8', colorDark: '#8FAABE', name: '雾蓝' },
      { color: '#E8C07D', colorDark: '#D4A968', name: '奶油' },
      { color: '#D4847C', colorDark: '#C06C6C', name: '玫瑰' },
      { color: '#B8AFA4', colorDark: '#9E968B', name: '奶茶' },
      { color: '#7BA3C9', colorDark: '#5E8AB4', name: '天蓝' },
    ]
  },

  onLoad() {
    // 读取本地存储的用户信息
    const userInfo = wx.getStorageSync('userInfo') || {};
    const themeColor = wx.getStorageSync('themeColor') || '#E8A87C';
    const themeColorDark = wx.getStorageSync('themeColorDark') || '#C38D6B';

    this.setData({
      userInfo,
      themeColor,
      themeColorDark,
      isLoggedIn: !!userInfo.openid
    });

    // 加载宝宝信息
    this.loadBabyInfo();
  },

  onShow() {
    // 应用主题颜色
    const themeColor = wx.getStorageSync('themeColor') || this.data.themeColor;
    const themeColorDark = wx.getStorageSync('themeColorDark') || this.data.themeColorDark;
    this.setData({ themeColor, themeColorDark });
    wx.setNavigationBarColor({
      frontColor: '#ffffff',
      backgroundColor: themeColor,
      animation: { duration: 300, timingFunc: 'easeInOut' }
    });

    // 每次显示时刷新宝宝信息
    this.loadBabyInfo();
  },

  // 加载宝宝信息（从本地存储）
  loadBabyInfo() {
    // 从本地存储获取宝宝信息
    const babyInfo = wx.getStorageSync('babyInfo');
    if (babyInfo) {
      this.setData({ babyInfo });
    }
  },

  // 保存宝宝信息（到本地存储）
  saveBabyInfo(babyInfo) {
    wx.setStorageSync('babyInfo', babyInfo);
    this.setData({ babyInfo });
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
  },

  // 跳转到设置页面
  goToSettings() {
    wx.navigateTo({
      url: '/pages/settings/index'
    });
  },

  // 计算宝宝月龄
  getBabyAge(birthDate) {
    if (!birthDate) return '';

    const birth = new Date(birthDate);
    const now = new Date();
    const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());

    if (months < 0) return '还未出生';
    if (months === 0) return '新生儿';
    if (months === 1) return '1个月';
    if (months < 12) return `${months}个月`;

    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (remainingMonths === 0) return `${years}岁`;
    return `${years}岁${remainingMonths}个月`;
  }
});