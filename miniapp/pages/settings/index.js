// 宝宝信息设置页
Page({
  data: {
    babyInfo: {
      name: '',
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
    babyId: ''
  },

  onLoad() {
    this.initCloud();
    this.loadBabyInfo();
  },

  // 初始化云开发
  initCloud() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: 'your-env-id',
        traceUser: true,
      });
    }
  },

  // 加载宝宝信息
  loadBabyInfo() {
    const db = wx.cloud.database();
    
    db.collection('baby_info').limit(1).get().then(res => {
      if (res.data.length > 0) {
        const info = res.data[0];
        this.setData({
          babyInfo: {
            name: info.name || '',
            birthDate: info.birthDate || '',
            gender: info.gender || 'boy',
            avatar: info.avatar || ''
          },
          privacy: info.privacy || {
            allowShare: false,
            allowAI: true
          },
          babyId: info._id,
          isLoading: false
        });
      } else {
        this.setData({ isLoading: false });
      }
    }).catch(err => {
      console.error('加载失败', err);
      this.setData({ isLoading: false });
    });
  },

  // 名字输入
  onNameInput(e) {
    this.setData({ 'babyInfo.name': e.detail.value });
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

  // 保存宝宝信息
  saveBabyInfo() {
    const { babyInfo, privacy, babyId } = this.data;
    
    if (!babyInfo.name.trim()) {
      wx.showToast({ title: '请输入宝宝名字', icon: 'none' });
      return;
    }

    this.setData({ isSaving: true });
    
    const db = wx.cloud.database();
    const data = {
      name: babyInfo.name,
      birthDate: babyInfo.birthDate,
      gender: babyInfo.gender,
      avatar: babyInfo.avatar,
      privacy: privacy,
      _updateTime: db.serverDate()
    };

    if (babyId) {
      // 更新
      db.collection('baby_info').doc(babyId).update({
        data
      }).then(() => {
        this.setData({ isSaving: false });
        wx.showToast({ title: '保存成功', icon: 'success' });
      }).catch(err => {
        this.setData({ isSaving: false });
        wx.showToast({ title: '保存失败', icon: 'none' });
      });
    } else {
      // 新增
      data._createTime = db.serverDate();
      db.collection('baby_info').add({
        data
      }).then(res => {
        this.setData({ 
          isSaving: false,
          babyId: res._id
        });
        wx.showToast({ title: '保存成功', icon: 'success' });
      }).catch(err => {
        this.setData({ isSaving: false });
        wx.showToast({ title: '保存失败', icon: 'none' });
      });
    }
  },

  // 选择头像
  chooseAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        
        // 上传到云存储
        wx.showLoading({ title: '上传中...' });
        const cloudPath = `avatars/${Date.now()}.jpg`;
        
        wx.cloud.uploadFile({
          cloudPath,
          filePath: tempFilePath,
          success: (uploadRes) => {
            this.setData({ 'babyInfo.avatar': uploadRes.fileID });
            wx.hideLoading();
          },
          fail: (err) => {
            wx.hideLoading();
            wx.showToast({ title: '上传失败', icon: 'none' });
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
