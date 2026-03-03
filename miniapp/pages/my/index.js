// 我的页面
const { BASE_URL } = require('../../utils/config');

Page({
  data: {
    isLoggedIn: false,
    userInfo: {},
    theme: 'light',
    showThemeModal: false
  },

  onLoad() {
    // 读取本地存储的用户信息
    const userInfo = wx.getStorageSync('userInfo') || {};
    const theme = wx.getStorageSync('theme') || 'light';
    
    this.setData({
      userInfo,
      theme,
      isLoggedIn: !!userInfo.openid
    });
  },

  // 登录
  onLogin() {
    const that = this;
    
    // 模拟登录（实际应该调用微信登录）
    wx.getUserProfile({
      desc: '用于完善用户资料',
      success: (res) => {
        const userInfo = res.userInfo;
        
        // 调用后端登录接口
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
                  
                  // 更新全局用户信息
                  const app = getApp();
                  app.globalData.openid = userInfo.openid;
                  
                  that.setData({
                    userInfo,
                    isLoggedIn: true
                  });
                  wx.showToast({ title: '登录成功', icon: 'success' });
                }
              },
              fail: () => {
                // 模拟登录成功
                userInfo.openid = 'mock_' + Date.now();
                wx.setStorageSync('userInfo', userInfo);
                that.setData({
                  userInfo,
                  isLoggedIn: true
                });
                wx.showToast({ title: '登录成功', icon: 'success' });
              }
            });
          }
        });
      },
      fail: () => {
        // 模拟登录成功（用于测试）
        const mockUserInfo = {
          nickName: '测试用户',
          avatarUrl: '',
          openid: 'mock_' + Date.now()
        };
        wx.setStorageSync('userInfo', mockUserInfo);
        this.setData({
          userInfo: mockUserInfo,
          isLoggedIn: true
        });
        wx.showToast({ title: '登录成功', icon: 'success' });
      }
    });
  },

  // 退出登录
  onLogout() {
    wx.removeStorageSync('userInfo');
    this.setData({
      userInfo: {},
      isLoggedIn: false
    });
    wx.showToast({ title: '已退出登录', icon: 'success' });
  },

  // 主题切换
  onThemeChange() {
    this.setData({ showThemeModal: true });
  },

  // 关闭主题弹窗
  onCloseTheme() {
    this.setData({ showThemeModal: false });
  },

  // 选择主题
  selectTheme(e) {
    const theme = e.currentTarget.dataset.theme;
    wx.setStorageSync('theme', theme);
    this.setData({
      theme,
      showThemeModal: false
    });
    wx.showToast({ title: '主题已切换', icon: 'success' });
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
