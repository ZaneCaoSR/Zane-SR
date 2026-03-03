// 相册首页 - 使用自建后端 API
const { BASE_URL } = require('../../utils/config');

Page({
  data: {
    babyName: '佑佑',
    months: [],
    currentMonthIndex: 0,
    isLoading: true,
    showCameraFab: true,
    themeColor: '#FF6B9D'
  },

  onLoad() {
    this.loadBabyInfo();
    this.loadPhotos();
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

    // 更新自定义 tabBar 颜色和选中态
    if (typeof this.getTabBar === 'function') {
      const tabBar = this.getTabBar();
      if (tabBar) {
        tabBar.setData({ selectedColor: themeColor, selected: 0 });
      }
    }

    // 每次显示时刷新数据
    this.loadPhotos();
  },

  // 加载宝宝信息（简化版）
  loadBabyInfo() {
    // TODO: 后续添加宝宝信息 API 后再完善
    this.setData({ babyName: '佑佑' });
  },

  // 加载照片数据 - 调用自建后端 API
  loadPhotos() {
    this.setData({ isLoading: true });
    
    const that = this;
    wx.request({
      url: `${BASE_URL}/api/photos`,
      method: 'GET',
      success: (res) => {
        if (res.data && res.data.photos) {
          const photos = res.data.photos;
          // 添加完整的 URL
          photos.forEach(p => {
            p.url = `${BASE_URL}/api/photo/${p.filename}`;
          });
          const months = that.groupByMonth(photos);
          that.setData({
            months,
            isLoading: false
          });
        } else {
          that.setData({ isLoading: false });
        }
      },
      fail: (err) => {
        console.error('加载照片失败', err);
        that.setData({ isLoading: false });
      }
    });
  },

  // 按月份分组
  groupByMonth(photos) {
    const monthMap = new Map();
    
    photos.forEach(photo => {
      const date = new Date(photo.created_at || Date.now());
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const key = `${year}-${month}`;
      
      if (!monthMap.has(key)) {
        monthMap.set(key, {
          year,
          month,
          monthLabel: `${year}年${month}月`,
          coverPhoto: null,
          count: 0,
          photos: []
        });
      }
      
      const monthData = monthMap.get(key);
      monthData.photos.push(photo);
      monthData.count++;
      
      // 设置封面为第一张照片
      if (!monthData.coverPhoto && photo.url) {
        monthData.coverPhoto = photo.url;
      }
    });
    
    // 转换为数组并按月份倒序
    return Array.from(monthMap.values()).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });
  },

  // 点击月份卡片
  onMonthTap(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({ currentMonthIndex: index });
  },

  // 点击照片
  onPhotoTap(e) {
    const photoId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/photo/index?id=${photoId}`
    });
  },

  // 跳转天气
  onWeatherTap() {
    wx.navigateTo({
      url: '/pages/weather-detail/weather-detail'
    });
  },

  // 跳转设置
  onSettingsTap() {
    wx.navigateTo({
      url: '/pages/settings/index'
    });
  },

  // 点击上传按钮
  onAddTap() {
    wx.navigateTo({
      url: '/pages/upload/index?type=album'
    });
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadPhotos();
    wx.stopPullDownRefresh();
  }
});
