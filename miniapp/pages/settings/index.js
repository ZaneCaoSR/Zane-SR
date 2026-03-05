// 宝宝信息设置页
const { BASE_URL } = require('../../utils/config');

Page({
  data: {
    babyInfo: {
      name: '',
      nickname: '',
      birthDate: '',
      gender: 'boy',
      avatar: ''
    },
    privacy: {
      allowShare: false,
      allowAI: true
    },
    isLoading: true,
    isSaving: false,
    showDatePicker: false,
    babyId: '',
    themeColor: '#FF6B9D'
  },

  onLoad() {
    this.loadBabyInfo();
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
  },

  // 加载宝宝信息（从本地存储）
  loadBabyInfo() {
    const babyInfo = wx.getStorageSync('babyInfo');
    if (babyInfo) {
      this.setData({
        babyInfo: babyInfo.info || {
          name: '',
          nickname: '',
          birthDate: '',
          gender: 'boy',
          avatar: ''
        },
        privacy: babyInfo.privacy || {
          allowShare: false,
          allowAI: true
        },
        babyId: babyInfo.id || '',
        isLoading: false
      });
    } else {
      this.setData({ isLoading: false });
    }
  },

  // 名字输入
  onNameInput(e) {
    this.setData({ 'babyInfo.name': e.detail.value });
  },

  // 小名输入
  onNicknameInput(e) {
    this.setData({ 'babyInfo.nickname': e.detail.value });
  },

  // 性别选择
  onGenderChange(e) {
    this.setData({ 'babyInfo.gender': e.currentTarget.dataset.gender });
  },

  // 选择生日
  showDatePicker() {
    this.setData({ showDatePicker: true });
  },

  onDateChange(e) {
    this.setData({
      'babyInfo.birthDate': e.detail.value,
      showDatePicker: false
    });
  },

  onDateCancel() {
    this.setData({ showDatePicker: false });
  },

  // 隐私设置切换
  onPrivacyChange(e) {
    const { key } = e.currentTarget.dataset;
    this.setData({ [`privacy.${key}`]: !this.data.privacy[key] });
  },

  // 保存宝宝信息（到本地存储）
  saveBabyInfo() {
    const { babyInfo, privacy, babyId } = this.data;

    if (!babyInfo.name.trim()) {
      wx.showToast({ title: '请输入宝宝名字', icon: 'none' });
      return;
    }

    this.setData({ isSaving: true });

    // 保存到本地存储
    const data = {
      id: babyId || `baby_${Date.now()}`,
      info: babyInfo,
      privacy: privacy,
      updatedAt: new Date().toISOString()
    };

    wx.setStorageSync('babyInfo', data);

    this.setData({
      isSaving: false,
      babyId: data.id
    });
    wx.showToast({ title: '保存成功', icon: 'success' });
  },

  // 选择头像（使用本地图片）
  chooseAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;

        // 保存到本地存储（转换为 base64 或直接使用临时路径）
        wx.getFileSystemManager().saveFile({
          tempFilePath: tempFilePath,
          success: (saveRes) => {
            this.setData({ 'babyInfo.avatar': saveRes.savedFilePath });
            wx.showToast({ title: '头像已更新', icon: 'success' });
          },
          fail: () => {
            // 失败则使用临时路径
            this.setData({ 'babyInfo.avatar': tempFilePath });
          }
        });
      }
    });
  },

  // 计算宝宝月龄
  getBabyAge() {
    const { birthDate } = this.data.babyInfo;
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
