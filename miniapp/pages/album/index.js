// 相册首页
Page({
  data: {
    babyName: '佑佑',
    months: [],
    currentMonthIndex: 0,
    isLoading: true,
    showCameraFab: true
  },

  onLoad() {
    this.initCloud();
    this.loadBabyInfo();
    this.loadPhotos();
  },

  onShow() {
    // 每次显示时刷新数据
    this.loadPhotos();
  },

  // 初始化云开发
  initCloud() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: 'your-env-id', // TODO: 替换为云开发环境ID
        traceUser: true,
      });
    }
  },

  // 加载宝宝信息
  loadBabyInfo() {
    const db = wx.cloud.database();
    db.collection('baby_info').limit(1).get().then(res => {
      if (res.data.length > 0) {
        this.setData({ babyName: res.data[0].name });
      }
    }).catch(err => {
      console.log('暂无宝宝信息', err);
    });
  },

  // 加载照片数据
  loadPhotos() {
    this.setData({ isLoading: true });
    const db = wx.cloud.database();
    
    db.collection('photos').orderBy('shotDate', 'desc').get().then(res => {
      const photos = res.data;
      const months = this.groupByMonth(photos);
      this.setData({
        months,
        isLoading: false
      });
    }).catch(err => {
      console.error('加载照片失败', err);
      this.setData({ isLoading: false });
    });
  },

  // 按月份分组
  groupByMonth(photos) {
    const monthMap = new Map();
    
    photos.forEach(photo => {
      const date = new Date(photo.shotDate || photo._createTime);
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
      
      const group = monthMap.get(key);
      group.photos.push(photo);
      group.count = group.photos.length;
      if (!group.coverPhoto) {
        group.coverPhoto = photo.fileID;
      }
    });

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

  // 跳转拍照上传
  onCameraTap() {
    wx.navigateTo({
      url: '/pages/upload/index?type=camera'
    });
  },

  // 跳转相册选择
  onAlbumTap() {
    wx.navigateTo({
      url: '/pages/upload/index?type=album'
    });
  },

  // 跳转照片详情
  onPhotoTap(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/photo/index?id=${id}`
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

  // 下拉刷新
  onPullDownRefresh() {
    this.loadPhotos();
    wx.stopPullDownRefresh();
  }
});
